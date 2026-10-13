package com.ghabiy.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.service.notification.StatusBarNotification;

import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/** كل شي يخص إشعارات المكالمات والرسائل */
final class Notifier {

    static final String CH_CALLS = "calls_v1";
    static final String CH_MESSAGES = "messages_v1";
    static final String EXTRA_CALL_ID = "callId";
    static final String EXTRA_FROM = "from";
    static final String EXTRA_NAME = "name";
    static final String EXTRA_TAG = "tag";
    static final String EXTRA_PATH = "path";

    private Notifier() {
    }

    static int idFor(String tag) {
        return tag == null ? 1 : (tag.hashCode() & 0x7fffffff);
    }

    static void ensureChannels(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null) return;

        NotificationChannel calls = new NotificationChannel(CH_CALLS, "المكالمات", NotificationManager.IMPORTANCE_HIGH);
        calls.setDescription("رنين المكالمات الواردة");
        calls.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE),
                new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build());
        calls.enableVibration(true);
        calls.setVibrationPattern(new long[]{0, 800, 400, 800, 400, 800});
        calls.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        calls.setBypassDnd(true);
        nm.createNotificationChannel(calls);

        NotificationChannel messages = new NotificationChannel(CH_MESSAGES, "الرسائل", NotificationManager.IMPORTANCE_HIGH);
        messages.setDescription("الرسائل الجديدة من الأصدقاء");
        messages.enableVibration(true);
        nm.createNotificationChannel(messages);
    }

    private static int piFlags() {
        return PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
    }

    private static String query(String url, String key) {
        try {
            return Uri.parse(Config.BASE_URL + url).getQueryParameter(key);
        } catch (Exception e) {
            return null;
        }
    }

    static void showIncomingCall(Context c, Map<String, String> d) {
        ensureChannels(c);
        String url = d.get("url") != null ? d.get("url") : "/friends";
        String tag = d.get("tag");
        String title = d.get("title") != null ? d.get("title") : "📞 مكالمة واردة";
        String name = d.get("name");
        if (name == null) name = title.replace("📞 مكالمة من ", "");
        String callId = query(url, "call");
        String from = query(url, "from");
        int id = idFor(tag);

        Intent full = new Intent(c, IncomingCallActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_USER_ACTION)
                .putExtra(EXTRA_CALL_ID, callId)
                .putExtra(EXTRA_FROM, from)
                .putExtra(EXTRA_NAME, name)
                .putExtra(EXTRA_TAG, tag)
                .putExtra(EXTRA_PATH, url);
        PendingIntent fullPi = PendingIntent.getActivity(c, id, full, piFlags());

        Intent accept = new Intent(c, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP)
                .putExtra(EXTRA_PATH, url + (url.contains("?") ? "&" : "?") + "autoaccept=1");
        PendingIntent acceptPi = PendingIntent.getActivity(c, id + 1, accept, piFlags());

        Intent decline = new Intent(c, DeclineReceiver.class)
                .putExtra(EXTRA_CALL_ID, callId)
                .putExtra(EXTRA_FROM, from)
                .putExtra(EXTRA_TAG, tag);
        PendingIntent declinePi = PendingIntent.getBroadcast(c, id + 2, decline, piFlags());

        NotificationCompat.Builder b = new NotificationCompat.Builder(c, CH_CALLS)
                .setSmallIcon(R.drawable.ic_stat_call)
                .setContentTitle(title)
                .setContentText(d.get("body") != null ? d.get("body") : "مكالمة صوتية واردة")
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(true)
                .setAutoCancel(false)
                .setTimeoutAfter(Config.RING_TIMEOUT_MS)
                .setContentIntent(fullPi)
                .setFullScreenIntent(fullPi, true)
                .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE), AudioManager.STREAM_RING)
                .setVibrate(new long[]{0, 800, 400, 800, 400, 800})
                .addAction(0, "❌ رفض", declinePi)
                .addAction(0, "✅ رد", acceptPi);

        Notification n = b.build();
        n.flags |= Notification.FLAG_INSISTENT; // يبقى يرن لحد ما يرد أو يرفض
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            try {
                nm.notify(id, n);
            } catch (SecurityException ignored) {
            }
        }
    }

    static boolean isShowing(Context c, int id) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return false;
        for (StatusBarNotification s : nm.getActiveNotifications()) {
            if (s.getId() == id) return true;
        }
        return false;
    }

    static void cancel(Context c, String tag) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(idFor(tag));
    }

    /** المتصل سكّر الخط قبل الرد */
    static void endCall(Context c, Map<String, String> d) {
        String tag = d.get("tag");
        boolean wasRinging = isShowing(c, idFor(tag)) || IncomingCallActivity.isShowing(tag);
        cancel(c, tag);
        IncomingCallActivity.closeIfShowing(tag);
        if (wasRinging) {
            showSimple(c, idFor(tag + "-missed"),
                    d.get("title") != null ? d.get("title") : "📵 مكالمة فائتة",
                    d.get("body") != null ? d.get("body") : "",
                    "/friends");
        }
    }

    static void showMessage(Context c, Map<String, String> d) {
        String tag = d.get("tag");
        showSimple(c, idFor(tag),
                d.get("title") != null ? d.get("title") : "💬 رسالة جديدة",
                d.get("body") != null ? d.get("body") : "",
                d.get("url") != null ? d.get("url") : "/");
    }

    private static void showSimple(Context c, int id, String title, String body, String path) {
        ensureChannels(c);
        Intent open = new Intent(c, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP)
                .putExtra(EXTRA_PATH, path);
        PendingIntent pi = PendingIntent.getActivity(c, id, open, piFlags());
        Notification n = new NotificationCompat.Builder(c, CH_MESSAGES)
                .setSmallIcon(R.drawable.ic_stat_call)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setAutoCancel(true)
                .setContentIntent(pi)
                .build();
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            try {
                nm.notify(id, n);
            } catch (SecurityException ignored) {
            }
        }
    }

    /** يشيل إشعارات الرسائل لما المستخدم يفتح التطبيق */
    static void cancelMessages(Context c) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        for (StatusBarNotification s : nm.getActiveNotifications()) {
            Notification n = s.getNotification();
            if (n != null && !NotificationCompat.CATEGORY_CALL.equals(n.category)) {
                nm.cancel(s.getId());
            }
        }
    }

    /** نبلغ المتصل إن المكالمة انرفضت (عن طريق Supabase Realtime) */
    static void sendReject(Context c, String callId, String callerId) {
        final String myId = Prefs.getUserId(c);
        if (callId == null || callerId == null || myId == null) return;
        new Thread(() -> {
            HttpURLConnection conn = null;
            try {
                JSONObject payload = new JSONObject()
                        .put("type", "reject")
                        .put("callId", callId)
                        .put("from", myId)
                        .put("reason", "declined");
                JSONObject msg = new JSONObject()
                        .put("topic", "call:" + callerId)
                        .put("event", "signal")
                        .put("payload", payload)
                        .put("private", false);
                JSONObject body = new JSONObject().put("messages", new JSONArray().put(msg));

                conn = (HttpURLConnection) new URL(Config.SUPABASE_URL + "/realtime/v1/api/broadcast").openConnection();
                conn.setRequestMethod("POST");
                conn.setConnectTimeout(8000);
                conn.setReadTimeout(8000);
                conn.setDoOutput(true);
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setRequestProperty("apikey", Config.SUPABASE_ANON_KEY);
                conn.setRequestProperty("Authorization", "Bearer " + Config.SUPABASE_ANON_KEY);
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(body.toString().getBytes(StandardCharsets.UTF_8));
                }
                conn.getResponseCode();
            } catch (Exception ignored) {
            } finally {
                if (conn != null) conn.disconnect();
            }
        }).start();
    }
}
