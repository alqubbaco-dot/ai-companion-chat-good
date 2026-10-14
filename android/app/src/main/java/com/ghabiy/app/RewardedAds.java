package com.ghabiy.app;

import android.app.Activity;
import android.provider.Settings;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.RequestConfiguration;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.gms.ads.rewarded.ServerSideVerificationOptions;

import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * الإعلانات بمكافأة (AdMob): المستخدم يضغط "اربح نقطة"، يشوف الإعلان،
 * وGoogle تبلّغ السيرفر مالتنا حتى يضيف النقطة (ما تنضاف من التلفون).
 */
final class RewardedAds {

    /** نتيجة تنبعث للصفحة: loading / shown / rewarded / closed / failed */
    interface Listener {
        void onAdEvent(String status, String message);
    }

    private final Activity activity;
    private final Listener listener;
    private RewardedAd ad;
    private boolean loading = false;
    private boolean showWhenLoaded = false;

    RewardedAds(Activity activity, Listener listener) {
        this.activity = activity;
        this.listener = listener;
    }

    /** تشغيل مكتبة الإعلانات مرة وحدة عند فتح التطبيق */
    void init() {
        List<String> testDevices = new ArrayList<>();
        if (Config.ADS_TEST_MODE) {
            // وضع التجربة: هذا الجهاز ياخذ إعلانات تجريبية من Google (بدون أرباح وبدون خطر على الحساب)
            String id = deviceTestId();
            if (id != null) testDevices.add(id);
        }
        MobileAds.setRequestConfiguration(
                new RequestConfiguration.Builder().setTestDeviceIds(testDevices).build());
        new Thread(() -> MobileAds.initialize(activity, status ->
                activity.runOnUiThread(this::preload))).start();
    }

    /** الصفحة تطلب عرض إعلان */
    void show() {
        activity.runOnUiThread(() -> {
            String userId = Prefs.getUserId(activity);
            if (userId == null || userId.isEmpty()) {
                listener.onAdEvent("failed", "login_required");
                return;
            }
            if (ad != null) {
                present(userId);
            } else {
                showWhenLoaded = true;
                listener.onAdEvent("loading", "");
                load();
            }
        });
    }

    boolean isReady() {
        return ad != null;
    }

    private void preload() {
        if (ad == null) load();
    }

    private void load() {
        if (loading) return;
        loading = true;
        RewardedAd.load(activity, Config.ADMOB_REWARDED_UNIT, new AdRequest.Builder().build(),
                new RewardedAdLoadCallback() {
                    @Override
                    public void onAdLoaded(RewardedAd loaded) {
                        loading = false;
                        ad = loaded;
                        if (showWhenLoaded) {
                            showWhenLoaded = false;
                            String userId = Prefs.getUserId(activity);
                            if (userId != null && !userId.isEmpty()) present(userId);
                        }
                    }

                    @Override
                    public void onAdFailedToLoad(LoadAdError error) {
                        loading = false;
                        ad = null;
                        if (showWhenLoaded) {
                            showWhenLoaded = false;
                            // كود 3 = ماكو إعلانات متوفرة هسه (يصير خصوصاً بالحسابات الجديدة)
                            listener.onAdEvent("failed", error.getCode() == AdRequest.ERROR_CODE_NO_FILL
                                    ? "no_fill" : "load_error_" + error.getCode());
                        }
                    }
                });
    }

    private void present(String userId) {
        RewardedAd current = ad;
        if (current == null) return;
        ad = null;

        // Google ترجّع هذا الرقم للسيرفر حتى نعرف لمن نضيف النقطة
        current.setServerSideVerificationOptions(
                new ServerSideVerificationOptions.Builder().setUserId(userId).build());

        current.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override
            public void onAdShowedFullScreenContent() {
                listener.onAdEvent("shown", "");
            }

            @Override
            public void onAdDismissedFullScreenContent() {
                listener.onAdEvent("closed", "");
                load(); // نجهّز الإعلان الجاي
            }

            @Override
            public void onAdFailedToShowFullScreenContent(AdError error) {
                listener.onAdEvent("failed", "show_error_" + error.getCode());
                load();
            }
        });

        current.show(activity, reward -> listener.onAdEvent("rewarded", String.valueOf(reward.getAmount())));
    }

    /** رقم الجهاز اللي تستعمله Google لإعلانات التجربة (MD5 لرقم الأندرويد) */
    private String deviceTestId() {
        try {
            String androidId = Settings.Secure.getString(activity.getContentResolver(), Settings.Secure.ANDROID_ID);
            if (androidId == null) return null;
            byte[] hash = MessageDigest.getInstance("MD5").digest(androidId.getBytes("UTF-8"));
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) sb.append(String.format("%02x", b));
            return sb.toString().toUpperCase(Locale.US);
        } catch (Exception e) {
            return null;
        }
    }
}
