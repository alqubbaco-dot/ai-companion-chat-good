package com.alqubba.app;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationManager;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.List;

/**
 * شاشة "تجهيز التطبيق": تظهر أول مرة بعد التنصيب (وتنفتح من الإعدادات بأي وقت).
 * كل خطوة بيها زر يفتح الإذن أو صفحة الإعداد مباشرة، وعلامة ✅ إذا تفعّلت.
 * Android ما يسمح لأي تطبيق يغيّر هذي الإعدادات بنفسه، لازم المستخدم يوافق.
 */
public class SetupActivity extends Activity {

    private static final int REQ_CONTACTS = 11;
    private static final int REQ_NOTIFY = 12;
    private static final int REQ_MEDIA = 13;

    private static final int BG = 0xFF141852;
    private static final int CARD = 0xFF1F2466;
    private static final int ACCENT = 0xFFFFC83D;
    private static final int OK = 0xFF3DDC84;

    private LinearLayout list;

    // أوامر صفحات "التشغيل التلقائي" بهواتف الشركات اللي تقتل التطبيقات بالخلفية
    private static final String[][] AUTOSTART = {
            {"com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"},
            {"com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"},
            {"com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity"},
            {"com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity"},
            {"com.oplus.battery", "com.oplus.startupapp.view.StartupAppListActivity"},
            {"com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"},
            {"com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity"},
            {"com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"},
            {"com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity"},
            {"com.hihonor.systemmanager", "com.hihonor.systemmanager.startupmgr.ui.StartupNormalAppListActivity"},
            {"com.asus.mobilemanager", "com.asus.mobilemanager.entry.FunctionActivity"},
            {"com.letv.android.letvsafe", "com.letv.android.letvsafe.AutobootManageActivity"},
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(BG);
        scroll.setFillViewport(true);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        root.setPadding(dp(18), dp(24), dp(18), dp(24));
        scroll.addView(root);

        TextView title = text("👋 أهلاً بيك بالقبة", 24, Color.WHITE, true);
        root.addView(title);
        TextView sub = text("خطوات بسيطة حتى توصلك المكالمات والرسائل حتى لو التطبيق مسكّر. اضغط كل زر ووافق.",
                15, 0xFFD6D9FF, false);
        sub.setPadding(0, dp(8), 0, dp(16));
        root.addView(sub);

        list = new LinearLayout(this);
        list.setOrientation(LinearLayout.VERTICAL);
        root.addView(list);

        Button done = button("✅ تمام، ابدأ", ACCENT, 0xFF141852);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(56));
        lp.topMargin = dp(20);
        done.setLayoutParams(lp);
        done.setOnClickListener(v -> {
            Prefs.setSetupDone(this);
            finish();
        });
        root.addView(done);

        TextView later = text("تكدر ترجع لهذي الشاشة بأي وقت من: الإعدادات ← تجهيز التلفون", 13, 0xFFAEB3E8, false);
        later.setGravity(Gravity.CENTER);
        later.setPadding(0, dp(12), 0, 0);
        root.addView(later);

        setContentView(scroll);
        EdgeToEdge.padForSystemBars(scroll, false);
    }

    @Override
    protected void onResume() {
        super.onResume();
        render(); // نحدّث العلامات بعد ما يرجع من صفحة الإعدادات
    }

    @Override
    public void onBackPressed() {
        Prefs.setSetupDone(this);
        super.onBackPressed();
    }

    // ───────── الخطوات ─────────

    private void render() {
        list.removeAllViews();

        addStep("👥", "جهات الاتصال (اختياري)",
                "حتى نعرف منو من أصدقائك عنده التطبيق ونطلّعهم لك. نستخدم الأرقام بس للمطابقة وما نحفظها، وما نرسل لأحد شي.",
                hasPermission(Manifest.permission.READ_CONTACTS), "سماح",
                () -> requestPermissions(new String[]{Manifest.permission.READ_CONTACTS}, REQ_CONTACTS),
                Prefs.contactsDeclined(this) ? null : "لا شكراً",
                () -> {
                    Prefs.setContactsDeclined(this, true);
                    render();
                });

        if (Build.VERSION.SDK_INT >= 33) {
            addStep("🔔", "الإشعارات",
                    "حتى توصلك المكالمات والرسائل.",
                    hasPermission(Manifest.permission.POST_NOTIFICATIONS), "سماح",
                    () -> requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIFY),
                    null, null);
        }

        addStep("🎙️", "المايكروفون والكاميرا",
                "للمكالمات الصوتية والفيديو. نستخدمها بس أثناء المكالمة.",
                hasPermission(Manifest.permission.RECORD_AUDIO) && hasPermission(Manifest.permission.CAMERA), "سماح",
                this::requestMedia, null, null);

        addStep("🔋", "البطارية بدون تقييد (مهم)",
                "هذا أهم إعداد حتى التطبيق ما ينام. بالصفحة اللي تنفتح اضغط «البطارية» واختار «غير مقيّد».",
                batteryUnrestricted(), "فتح الإعداد",
                this::openBatterySettings, null, null);

        final Intent autostart = findAutostartIntent();
        if (autostart != null) {
            addStep("🚀", "التشغيل التلقائي",
                    "تلفونك يسكّر التطبيقات بالخلفية. فعّل «القبة» بالقائمة اللي تنفتح، وارجع.",
                    Prefs.autostartDone(this), "فتح الإعداد",
                    () -> {
                        Prefs.setAutostartDone(this);
                        safeStart(autostart);
                    }, null, null);
        }

        if (Build.VERSION.SDK_INT >= 34) {
            addStep("📞", "المكالمة بملء الشاشة",
                    "حتى المكالمة تطلع على الشاشة المقفولة مثل الواتساب. فعّل الخيار بالصفحة اللي تنفتح.",
                    canFullScreen(), "فتح الإعداد",
                    () -> safeStart(new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,
                            Uri.parse("package:" + getPackageName()))),
                    null, null);
        }
    }

    private void addStep(String icon, String title, String desc, boolean done,
                         String actionLabel, Runnable action,
                         String secondLabel, Runnable second) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        card.setPadding(dp(14), dp(14), dp(14), dp(14));
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(CARD);
        bg.setCornerRadius(dp(16));
        if (done) bg.setStroke(dp(2), OK);
        card.setBackground(bg);
        LinearLayout.LayoutParams cardLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        cardLp.bottomMargin = dp(12);
        card.setLayoutParams(cardLp);

        card.addView(text(icon + "  " + title + (done ? "  ✅" : ""), 17, Color.WHITE, true));
        TextView d = text(desc, 14, 0xFFD6D9FF, false);
        d.setPadding(0, dp(6), 0, done ? 0 : dp(10));
        card.addView(d);

        if (!done) {
            LinearLayout row = new LinearLayout(this);
            row.setOrientation(LinearLayout.HORIZONTAL);
            row.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);

            Button main = button(actionLabel, ACCENT, 0xFF141852);
            main.setOnClickListener(v -> action.run());
            row.addView(main, new LinearLayout.LayoutParams(0, dp(46), 1f));

            if (secondLabel != null && second != null) {
                Button other = button(secondLabel, 0xFF2E3480, Color.WHITE);
                other.setOnClickListener(v -> second.run());
                LinearLayout.LayoutParams olp = new LinearLayout.LayoutParams(0, dp(46), 1f);
                olp.setMarginStart(dp(8));
                row.addView(other, olp);
            }
            card.addView(row);
        }
        list.addView(card);
    }

    // ───────── الأذونات والإعدادات ─────────

    private void requestMedia() {
        List<String> need = new ArrayList<>();
        if (!hasPermission(Manifest.permission.RECORD_AUDIO)) need.add(Manifest.permission.RECORD_AUDIO);
        if (!hasPermission(Manifest.permission.CAMERA)) need.add(Manifest.permission.CAMERA);
        if (!need.isEmpty()) requestPermissions(need.toArray(new String[0]), REQ_MEDIA);
    }

    private boolean hasPermission(String p) {
        return checkSelfPermission(p) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean batteryUnrestricted() {
        PowerManager pm = getSystemService(PowerManager.class);
        return pm != null && pm.isIgnoringBatteryOptimizations(getPackageName());
    }

    private boolean canFullScreen() {
        if (Build.VERSION.SDK_INT < 34) return true;
        NotificationManager nm = getSystemService(NotificationManager.class);
        return nm != null && nm.canUseFullScreenIntent();
    }

    // صفحة معلومات التطبيق (بيها «البطارية»). هذي الطريقة مسموحة بسياسة Google Play
    private void openBatterySettings() {
        Intent details = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.parse("package:" + getPackageName()));
        if (!safeStart(details)) {
            safeStart(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
        }
        Toast.makeText(this, "اضغط «البطارية» واختار «غير مقيّد»", Toast.LENGTH_LONG).show();
    }

    private Intent findAutostartIntent() {
        PackageManager pm = getPackageManager();
        for (String[] c : AUTOSTART) {
            Intent i = new Intent();
            i.setComponent(new ComponentName(c[0], c[1]));
            if (pm.resolveActivity(i, PackageManager.MATCH_DEFAULT_ONLY) != null) return i;
        }
        return null;
    }

    private boolean safeStart(Intent i) {
        try {
            startActivity(i);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        boolean granted = grantResults.length > 0;
        for (int r : grantResults) if (r != PackageManager.PERMISSION_GRANTED) granted = false;
        if (!granted) {
            // إذا رفض مرتين، Android ما يطلّع النافذة مرة ثانية: نفتح صفحة الأذونات
            boolean canAskAgain = false;
            for (String p : permissions) if (shouldShowRequestPermissionRationale(p)) canAskAgain = true;
            if (!canAskAgain && requestCode != REQ_CONTACTS) {
                Toast.makeText(this, "فعّل الإذن من صفحة «الأذونات»", Toast.LENGTH_LONG).show();
                safeStart(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                        Uri.parse("package:" + getPackageName())));
            }
        }
        render();
    }

    // ───────── أدوات الرسم ─────────

    private TextView text(String s, int sp, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        t.setTextColor(color);
        t.setTextDirection(View.TEXT_DIRECTION_RTL);
        t.setLineSpacing(0, 1.15f);
        if (bold) t.setTypeface(Typeface.DEFAULT_BOLD);
        return t;
    }

    private Button button(String label, int bgColor, int textColor) {
        Button b = new Button(this);
        b.setText(label);
        b.setAllCaps(false);
        b.setTextColor(textColor);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        GradientDrawable g = new GradientDrawable();
        g.setColor(bgColor);
        g.setCornerRadius(dp(12));
        b.setBackground(g);
        b.setStateListAnimator(null);
        return b;
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }
}
