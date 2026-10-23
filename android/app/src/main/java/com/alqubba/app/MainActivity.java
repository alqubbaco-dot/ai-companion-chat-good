package com.alqubba.app;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;
import android.window.OnBackInvokedDispatcher;

import com.google.firebase.messaging.FirebaseMessaging;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * الشاشة الرئيسية: تفتح موقع التطبيق داخل WebView
 * وتربطه بإشعارات Firebase والمايكروفون.
 */
public class MainActivity extends Activity {

    static volatile boolean inForeground = false;

    private static final int REQ_PERMISSIONS = 1;
    private static final int REQ_FILE = 2;
    private ValueCallback<Uri[]> fileCallback;
    private WebView web;
    private PermissionRequest pendingWebPermission;
    private RewardedAds rewardedAds;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        web = new WebView(this);
        // حاوية بلون التطبيق: تاخذ مكان شريط الحالة والأزرار بأندرويد 15+
        FrameLayout container = new FrameLayout(this);
        container.setBackgroundColor(0xFF141852);
        container.addView(web, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(container);
        EdgeToEdge.padForSystemBars(container, true);

        // زر الرجوع بأندرويد 13+ (أندرويد 16 ما يستدعي onBackPressed)
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::handleBack);
        }

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setUserAgentString(s.getUserAgentString() + " GhabiyApp/1");

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);

        web.addJavascriptInterface(new Bridge(), "GhabiyNative");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String host = uri.getHost();
                if (host != null && host.equals(Uri.parse(Config.BASE_URL).getHost())) {
                    return false;
                }
                // روابط خارجية (واتساب، يوتيوب...) تنفتح بالتطبيق المناسب
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) {
                }
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                pushTokenToPage();
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            // زر 📎 بالدردشة: يفتح معرض الصور ويرجّع الصورة للصفحة
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), REQ_FILE);
                } catch (Exception e) {
                    fileCallback = null;
                    callback.onReceiveValue(null);
                    return false;
                }
                return true;
            }

            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    String[] missing = missingFor(request);
                    if (missing.length == 0) {
                        request.grant(request.getResources());
                    } else {
                        pendingWebPermission = request;
                        requestPermissions(missing, REQ_PERMISSIONS);
                    }
                });
            }
        });

        // أول مرة بعد التنصيب: شاشة تجهيز التلفون (أذونات + البطارية + التشغيل التلقائي)
        if (!Prefs.setupDone(this)) {
            startActivity(new Intent(this, SetupActivity.class));
        } else {
            requestStartupPermissions();
        }

        FirebaseMessaging.getInstance().getToken().addOnSuccessListener(token -> {
            Prefs.setToken(this, token);
            pushTokenToPage();
        });

        // الإعلانات بمكافأة (نظام النقاط)
        rewardedAds = new RewardedAds(this, this::sendAdEventToPage);
        rewardedAds.init();

        // فحص التحديثات: بس بنسخة GitHub (Google Play تمنع التحديث الذاتي)
        if (BuildConfig.SELF_UPDATE) UpdateChecker.checkAsync(this);

        if (savedInstanceState != null) {
            web.restoreState(savedInstanceState);
        } else {
            web.loadUrl(Config.BASE_URL + pathFrom(getIntent()));
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_FILE && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            fileCallback = null;
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        final String path = intent.getStringExtra("path");
        if (path == null || web == null) return;
        if (path.contains("call=")) {
            // الصفحة مفتوحة أصلاً: نسلّمها المكالمة مباشرة بدل إعادة تحميل التطبيق كله (أسرع بكثير)
            String js = "(function(){try{return !!(window.__qubbaOpen&&window.__qubbaOpen("
                    + org.json.JSONObject.quote(path) + "));}catch(e){return false;}})()";
            web.evaluateJavascript(js, result -> {
                if (!"true".equals(result)) web.loadUrl(Config.BASE_URL + path);
            });
            return;
        }
        web.loadUrl(Config.BASE_URL + path);
    }

    private String pathFrom(Intent intent) {
        String path = intent != null ? intent.getStringExtra("path") : null;
        return path != null && path.startsWith("/") ? path : "/";
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (web != null) web.saveState(outState);
    }

    @Override
    protected void onResume() {
        super.onResume();
        inForeground = true;
        Notifier.cancelMessages(this);
    }

    @Override
    protected void onPause() {
        super.onPause();
        inForeground = false;
    }

    @Override
    public void onBackPressed() {
        handleBack();
    }

    // نرجع صفحة بالتطبيق، وإذا ماكو صفحة قبلها نخلي التطبيق بالخلفية (حتى توصل المكالمات بسرعة)
    private void handleBack() {
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else {
            moveTaskToBack(true);
        }
    }

    // الأذونات اللي يحتاجها الموقع (مايك و/أو كاميرا) وبعدها ما انطت
    private String[] missingFor(PermissionRequest request) {
        List<String> missing = new ArrayList<>();
        for (String res : request.getResources()) {
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(res) && !hasPermission(Manifest.permission.RECORD_AUDIO)) {
                missing.add(Manifest.permission.RECORD_AUDIO);
            }
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(res) && !hasPermission(Manifest.permission.CAMERA)) {
                missing.add(Manifest.permission.CAMERA);
            }
        }
        return missing.toArray(new String[0]);
    }

    private boolean hasPermission(String permission) {
        return checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED;
    }

    private void requestStartupPermissions() {
        List<String> needed = new ArrayList<>();
        if (!hasPermission(Manifest.permission.RECORD_AUDIO)) needed.add(Manifest.permission.RECORD_AUDIO);
        if (Build.VERSION.SDK_INT >= 33 && !hasPermission(Manifest.permission.POST_NOTIFICATIONS)) {
            needed.add(Manifest.permission.POST_NOTIFICATIONS);
        }
        if (!needed.isEmpty()) {
            requestPermissions(needed.toArray(new String[0]), REQ_PERMISSIONS);
        } else {
            checkFullScreenPermission();
        }
    }

    // أندرويد 14: إذن شاشة المكالمة الكاملة لازم يتفعّل من الإعدادات
    private void checkFullScreenPermission() {
        if (Build.VERSION.SDK_INT < 34) return;
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null || nm.canUseFullScreenIntent()) return;
        if (Prefs.askedFullScreen(this)) return;
        Prefs.setAskedFullScreen(this);
        Toast.makeText(this, "فعّل خيار المكالمات بملء الشاشة حتى يرن التلفون مثل الواتساب", Toast.LENGTH_LONG).show();
        try {
            Intent i = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,
                    Uri.parse("package:" + getPackageName()));
            startActivity(i);
        } catch (Exception ignored) {
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (pendingWebPermission != null) {
            // نعطي الموقع بس الأشياء اللي المستخدم وافق عليها
            List<String> granted = new ArrayList<>();
            for (String res : pendingWebPermission.getResources()) {
                if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(res) && hasPermission(Manifest.permission.RECORD_AUDIO)) {
                    granted.add(res);
                } else if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(res) && hasPermission(Manifest.permission.CAMERA)) {
                    granted.add(res);
                }
            }
            if (granted.isEmpty()) {
                pendingWebPermission.deny();
                Toast.makeText(this, "لازم تسمح بالمايكروفون حتى تشتغل المكالمات", Toast.LENGTH_LONG).show();
            } else {
                pendingWebPermission.grant(granted.toArray(new String[0]));
            }
            pendingWebPermission = null;
        }
        checkFullScreenPermission();
    }

    private void pushTokenToPage() {
        final String token = Prefs.getToken(this);
        if (token == null || web == null) return;
        runOnUiThread(() -> web.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('ghabiy-fcm-token',{detail:" + JSONObject.quote(token) + "}))",
                null));
    }

    // نبلّغ الصفحة بحالة الإعلان: window.addEventListener('ghabiy-ad', e => e.detail.status)
    private void sendAdEventToPage(String status, String message) {
        if (web == null) return;
        try {
            JSONObject detail = new JSONObject();
            detail.put("status", status);
            detail.put("message", message == null ? "" : message);
            final String js = "window.dispatchEvent(new CustomEvent('ghabiy-ad',{detail:" + detail + "}))";
            runOnUiThread(() -> web.evaluateJavascript(js, null));
        } catch (Exception ignored) {
        }
    }

    /** دوال يكدر الموقع يستدعيها: window.GhabiyNative.xxx() */
    private class Bridge {
        @JavascriptInterface
        public boolean isNative() {
            return true;
        }

        @JavascriptInterface
        public String getFcmToken() {
            String t = Prefs.getToken(MainActivity.this);
            return t == null ? "" : t;
        }

        @JavascriptInterface
        public void setUser(String userId) {
            Prefs.setUserId(MainActivity.this, userId);
        }

        /** عرض إعلان بمكافأة (النقطة تنضاف من السيرفر بعد تأكيد Google) */
        @JavascriptInterface
        public void showRewardedAd() {
            if (rewardedAds != null) rewardedAds.show();
        }

        @JavascriptInterface
        public boolean isRewardedAdReady() {
            return rewardedAds != null && rewardedAds.isReady();
        }

        /** وضع المكالمة (true عند بدء الاتصال، false عند انتهائه) */
        @JavascriptInterface
        public void callAudio(boolean active) {
            runOnUiThread(() -> CallAudio.setActive(MainActivity.this, active));
        }

        /** السبيكر (true) أو سماعة الأذن (false) */
        @JavascriptInterface
        public void setSpeaker(boolean on) {
            runOnUiThread(() -> CallAudio.setSpeaker(MainActivity.this, on));
        }

        /** فتح شاشة تجهيز التلفون (من صفحة الإعدادات) */
        @JavascriptInterface
        public String getRingtone() {
            return Prefs.getRingtone(MainActivity.this);
        }

        @JavascriptInterface
        public void setRingtone(String id) {
            Prefs.setRingtone(MainActivity.this, id);
            Notifier.ensureChannels(MainActivity.this);
        }

        @JavascriptInterface
        public void openSetup() {
            runOnUiThread(() -> startActivity(new Intent(MainActivity.this, SetupActivity.class)));
        }

        /** هل المستخدم سمح بقراءة جهات الاتصال؟ */
        @JavascriptInterface
        public boolean contactsAllowed() {
            return Contacts.allowed(MainActivity.this);
        }

        /** أرقام جهات الاتصال للمطابقة: [["رقم","اسم"], ...] */
        @JavascriptInterface
        public String getContacts() {
            return Contacts.readJson(MainActivity.this);
        }

        @JavascriptInterface
        public String appVersion() {
            try {
                return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
            } catch (Exception e) {
                return "";
            }
        }
    }
}
