package com.alqubba.app;

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

    // شاشة "تجهيز التلفون" انعرضت أول مرة
    static boolean setupDone(Context c) {
        return sp(c).getBoolean("setup_done", false);
    }

    static void setSetupDone(Context c) {
        sp(c).edit().putBoolean("setup_done", true).apply();
    }

    static boolean autostartDone(Context c) {
        return sp(c).getBoolean("autostart_done", false);
    }

    static void setAutostartDone(Context c) {
        sp(c).edit().putBoolean("autostart_done", true).apply();
    }

    static boolean contactsDeclined(Context c) {
        return sp(c).getBoolean("contacts_declined", false);
    }

    static void setContactsDeclined(Context c, boolean v) {
        sp(c).edit().putBoolean("contacts_declined", v).apply();
    }

    static int skippedVersion(Context c) {
        return sp(c).getInt("skipped_version", -1);
    }

    static void setSkippedVersion(Context c, int v) {
        sp(c).edit().putInt("skipped_version", v).apply();
    }

    // نغمة رنين المكالمات (من نغمات القبة بمجلد res/raw)
    static final String[] RINGTONES = {"qubba", "bayati", "hijaz", "darbuka", "marimba", "news", "kia", "calm"};

    static boolean isRingtone(String id) {
        if (id == null) return false;
        for (String r : RINGTONES) if (r.equals(id)) return true;
        return false;
    }

    static String getRingtone(Context c) {
        String id = sp(c).getString("ringtone", "qubba");
        return isRingtone(id) ? id : "qubba";
    }

    static void setRingtone(Context c, String id) {
        if (isRingtone(id)) sp(c).edit().putString("ringtone", id).apply();
    }

    private Prefs() {
    }
}
