package com.ghabiy.app;

final class Config {
    static final String BASE_URL = "https://ai-companion-chat-good.vercel.app";
    static final String SUPABASE_URL = "https://etkacphlxhpdjhrvoaqz.supabase.co";
    static final String SUPABASE_ANON_KEY = "sb_publishable_qwvchdJI-viQlVbiDPtfhg_VG6UOjkk";
    static final long RING_TIMEOUT_MS = 45_000L;

    // AdMob: الإعلان بمكافأة (points_reward)
    static final String ADMOB_REWARDED_UNIT = "ca-app-pub-6994022142091679/1170984501";
    // true = إعلانات تجريبية على كل جهاز (للتجربة). نخليها false قبل النشر على Google Play
    static final boolean ADS_TEST_MODE = true;

    private Config() {
    }
}
