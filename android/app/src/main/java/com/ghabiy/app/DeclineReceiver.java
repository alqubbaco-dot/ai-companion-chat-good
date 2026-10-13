package com.ghabiy.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** زر "رفض" بإشعار المكالمة */
public class DeclineReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String tag = intent.getStringExtra(Notifier.EXTRA_TAG);
        Notifier.cancel(context, tag);
        IncomingCallActivity.closeIfShowing(tag);
        Notifier.sendReject(context,
                intent.getStringExtra(Notifier.EXTRA_CALL_ID),
                intent.getStringExtra(Notifier.EXTRA_FROM));
    }
}
