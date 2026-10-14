package com.ghabiy.app;

import android.content.Context;
import android.content.SharedPreferences;

final class Prefs {
    private static SharedPreferences sp(Context c) {
        return c.getSharedPreferences("ghabiy", Context.MODE_PRIVATE);
    }

    static String getToken(Context c) {
        return sp(c).getString("fcm_token", null);
    }

    static void setToken(Context c, String token) {
        sp(c).edit().putString("fcm_token", token).apply();
    }

    static String getUserId(Context c) {
        return sp(c).getString("user_id", null);
    }

    static void setUserId(Context c, String id) {
        sp(c).edit().putString("user_id", id).apply();
    }

    static boolean askedFullScreen(Context c) {
        return sp(c).getBoolean("asked_fsi", false);
    }

    static void setAskedFullScreen(Context c) {
        sp(c).edit().putBoolean("asked_fsi", true).apply();
    }

    static int skippedVersion(Context c) {
        return sp(c).getInt("skipped_version", -1);
    }

    static void setSkippedVersion(Context c, int v) {
        sp(c).edit().putInt("skipped_version", v).apply();
    }

    private Prefs() {
    }
}
