package com.ghabiy.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * يفحص إذا أكو نسخة أحدث من التطبيق على GitHub Releases،
 * ويعرض على المستخدم يحدّث بضغطة وحدة (ينزّل الملف ويفتح شاشة التثبيت).
 * ما يشتغل إذا التطبيق منصّب من Google Play (هناك التحديث تلقائي).
 */
final class UpdateChecker {

    private static final String LATEST_API =
            "https://api.github.com/repos/alqubbaco-dot/ai-companion-chat-good/releases/latest";
    private static final String APK_NAME = "ghabiy-update.apk";

    private UpdateChecker() {
    }

    static void checkAsync(Activity activity) {
        if (installedFromPlay(activity)) return;
        new Thread(() -> {
            try {
                JSONObject release = fetchLatest();
                if (release == null) return;
                String tag = release.optString("tag_name", "");
                int latest = parseVersion(tag);
                int current = currentVersion(activity);
                if (latest <= current) return;
                if (latest == Prefs.skippedVersion(activity)) return;

                String apkUrl = null;
                JSONArray assets = release.optJSONArray("assets");
                if (assets != null) {
                    for (int i = 0; i < assets.length(); i++) {
                        JSONObject a = assets.getJSONObject(i);
                        if (a.optString("name", "").endsWith(".apk")) {
                            apkUrl = a.optString("browser_download_url", null);
                            break;
                        }
                    }
                }
                if (apkUrl == null) return;
                final String url = apkUrl;
                activity.runOnUiThread(() -> showDialog(activity, latest, url));
            } catch (Exception ignored) {
                // ماكو نت أو GitHub ما رد: نحاول المرة الجاية
            }
        }).start();
    }

    private static boolean installedFromPlay(Context c) {
        try {
            String installer;
            if (Build.VERSION.SDK_INT >= 30) {
                installer = c.getPackageManager().getInstallSourceInfo(c.getPackageName()).getInstallingPackageName();
            } else {
                installer = c.getPackageManager().getInstallerPackageName(c.getPackageName());
            }
            return "com.android.vending".equals(installer);
        } catch (Exception e) {
            return false;
        }
    }

    private static int parseVersion(String tag) {
        // android-v12 → 12
        String digits = tag.replaceAll("[^0-9]", "");
        if (digits.isEmpty()) return -1;
        try {
            return Integer.parseInt(digits);
        } catch (NumberFormatException e) {
            return -1;
        }
    }

    @SuppressWarnings("deprecation")
    private static int currentVersion(Context c) {
        try {
            PackageInfo info = c.getPackageManager().getPackageInfo(c.getPackageName(), 0);
            return Build.VERSION.SDK_INT >= 28 ? (int) info.getLongVersionCode() : info.versionCode;
        } catch (PackageManager.NameNotFoundException e) {
            return Integer.MAX_VALUE;
        }
    }

    private static JSONObject fetchLatest() throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(LATEST_API).openConnection();
        conn.setConnectTimeout(8000);
        conn.setReadTimeout(8000);
        conn.setRequestProperty("Accept", "application/vnd.github+json");
        try {
            if (conn.getResponseCode() != 200) return null;
            StringBuilder sb = new StringBuilder();
            try (BufferedReader r = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = r.readLine()) != null) sb.append(line);
            }
            return new JSONObject(sb.toString());
        } finally {
            conn.disconnect();
        }
    }

    private static void showDialog(Activity activity, int version, String apkUrl) {
        if (activity.isFinishing()) return;
        new AlertDialog.Builder(activity)
                .setTitle("✨ أكو تحديث جديد")
                .setMessage("نسخة جديدة من «الغباء الصناعي» جاهزة (نسخة " + version + "). تريد تحدّث هسه؟")
                .setPositiveButton("حدّث هسه", (d, w) -> startDownload(activity, apkUrl))
                .setNegativeButton("بعدين", null)
                .setNeutralButton("تخطّي هاي النسخة", (d, w) -> Prefs.setSkippedVersion(activity, version))
                .show();
    }

    private static void startDownload(Activity activity, String apkUrl) {
        // أندرويد 8+: لازم إذن "تثبيت التطبيقات من هذا المصدر"
        if (Build.VERSION.SDK_INT >= 26 && !activity.getPackageManager().canRequestPackageInstalls()) {
            Toast.makeText(activity, "فعّل \"السماح من هذا المصدر\" وارجع اضغط حدّث مرة ثانية", Toast.LENGTH_LONG).show();
            try {
                activity.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + activity.getPackageName())));
            } catch (Exception ignored) {
            }
            return;
        }

        DownloadManager dm = (DownloadManager) activity.getSystemService(Context.DOWNLOAD_SERVICE);
        if (dm == null) {
            openInBrowser(activity, apkUrl);
            return;
        }
        // نمسح أي ملف تحديث قديم
        java.io.File old = new java.io.File(activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), APK_NAME);
        if (old.exists()) //noinspection ResultOfMethodCallIgnored
            old.delete();

        DownloadManager.Request req = new DownloadManager.Request(Uri.parse(apkUrl))
                .setTitle("تحديث الغباء الصناعي")
                .setDescription("جاري تنزيل النسخة الجديدة…")
                .setMimeType("application/vnd.android.package-archive")
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setDestinationInExternalFilesDir(activity, Environment.DIRECTORY_DOWNLOADS, APK_NAME);
        final long id;
        try {
            id = dm.enqueue(req);
        } catch (Exception e) {
            openInBrowser(activity, apkUrl);
            return;
        }
        Toast.makeText(activity, "جاري تنزيل التحديث… لحظات", Toast.LENGTH_SHORT).show();

        final Context app = activity.getApplicationContext();
        BroadcastReceiver done = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                long got = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                if (got != id) return;
                try {
                    app.unregisterReceiver(this);
                } catch (Exception ignored) {
                }
                Uri file = dm.getUriForDownloadedFile(id);
                if (file == null) {
                    Toast.makeText(app, "ما گدرنا ننزّل التحديث، جرّب مرة ثانية", Toast.LENGTH_LONG).show();
                    return;
                }
                Intent install = new Intent(Intent.ACTION_VIEW)
                        .setDataAndType(file, "application/vnd.android.package-archive")
                        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                try {
                    app.startActivity(install);
                } catch (Exception e) {
                    openInBrowser(app, apkUrl);
                }
            }
        };
        IntentFilter filter = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
        if (Build.VERSION.SDK_INT >= 33) {
            app.registerReceiver(done, filter, Context.RECEIVER_EXPORTED);
        } else {
            app.registerReceiver(done, filter);
        }
    }

    private static void openInBrowser(Context c, String url) {
        try {
            c.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        } catch (Exception ignored) {
        }
    }
}
