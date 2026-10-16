package com.alqubba.app;

import androidx.annotation.NonNull;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/** يستلم إشعارات Firebase حتى والتطبيق مسكّر */
public class CallMessagingService extends FirebaseMessagingService {

    @Override
    public void onNewToken(@NonNull String token) {
        Prefs.setToken(this, token);
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        Map<String, String> data = message.getData();
        if (data == null || data.isEmpty()) return;
        String kind = data.get("kind");
        if ("call".equals(kind)) {
            // التطبيق مفتوح: هو يرن بنفسه
            if (MainActivity.inForeground) return;
            Notifier.showIncomingCall(this, data);
        } else if ("call-end".equals(kind)) {
            Notifier.endCall(this, data);
        } else {
            if (MainActivity.inForeground) return;
            Notifier.showMessage(this, data);
        }
    }
}
