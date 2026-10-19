package com.alqubba.app;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.BitmapShader;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.graphics.drawable.BitmapDrawable;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.io.InputStream;
import java.lang.ref.WeakReference;
import java.net.HttpURLConnection;
import java.net.URL;

/** شاشة المكالمة الواردة بملء الشاشة (حتى والتلفون مقفول) */
public class IncomingCallActivity extends Activity {

    private static WeakReference<IncomingCallActivity> current = new WeakReference<>(null);

    private String callId;
    private String from;
    private String tag;
    private String path;
    private boolean video;
    private String avatarUrl;
    private final Handler handler = new Handler(Looper.getMainLooper());

    static boolean isShowing(String tag) {
        IncomingCallActivity a = current.get();
        return a != null && !a.isFinishing() && tag != null && tag.equals(a.tag);
    }

    static void closeIfShowing(String tag) {
        IncomingCallActivity a = current.get();
        if (a != null && (tag == null || tag.equals(a.tag))) {
            a.runOnUiThread(a::finish);
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        readIntent(getIntent());
        current = new WeakReference<>(this);
        buildUi(getIntent().getStringExtra(Notifier.EXTRA_NAME));

        // ما رد خلال وقت الرنين = مكالمة فائتة
        handler.postDelayed(this::finish, Config.RING_TIMEOUT_MS);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        readIntent(intent);
        buildUi(intent.getStringExtra(Notifier.EXTRA_NAME));
    }

    private void readIntent(Intent i) {
        callId = i.getStringExtra(Notifier.EXTRA_CALL_ID);
        from = i.getStringExtra(Notifier.EXTRA_FROM);
        tag = i.getStringExtra(Notifier.EXTRA_TAG);
        path = i.getStringExtra(Notifier.EXTRA_PATH);
        avatarUrl = i.getStringExtra(Notifier.EXTRA_AVATAR);
        video = i.getBooleanExtra(Notifier.EXTRA_VIDEO, false);
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    /** يحمّل صورة المتصل ويعرضها دائرية بدل الحرف الأول */
    private void loadAvatar(final TextView view) {
        final String url = avatarUrl;
        if (url == null || !url.startsWith("https://")) return;
        final int size = dp(120);
        new Thread(() -> {
            Bitmap round = null;
            HttpURLConnection conn = null;
            try {
                conn = (HttpURLConnection) new URL(url).openConnection();
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(5000);
                try (InputStream in = conn.getInputStream()) {
                    Bitmap src = BitmapFactory.decodeStream(in);
                    if (src != null) round = circle(src, size);
                }
            } catch (Exception ignored) {
                // ما وصلت الصورة: يبقى الحرف الأول
            } finally {
                if (conn != null) conn.disconnect();
            }
            final Bitmap result = round;
            if (result == null) return;
            handler.post(() -> {
                if (isFinishing()) return;
                view.setText("");
                view.setBackground(new BitmapDrawable(getResources(), result));
            });
        }).start();
    }

    private static Bitmap circle(Bitmap src, int size) {
        int side = Math.min(src.getWidth(), src.getHeight());
        Bitmap sq = Bitmap.createBitmap(src, (src.getWidth() - side) / 2, (src.getHeight() - side) / 2, side, side);
        Bitmap scaled = Bitmap.createScaledBitmap(sq, size, size, true);
        Bitmap out = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(out);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setShader(new BitmapShader(scaled, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP));
        canvas.drawCircle(size / 2f, size / 2f, size / 2f, paint);
        return out;
    }

    private void buildUi(String name) {
        if (name == null || name.trim().isEmpty()) name = "صديق";

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        root.setPadding(dp(24), dp(90), dp(24), dp(70));
        GradientDrawable bg = new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,
                new int[]{Color.parseColor("#0f1340"), Color.parseColor("#1b1f5c"), Color.parseColor("#2b145c")});
        root.setBackground(bg);

        TextView avatar = new TextView(this);
        avatar.setText(name.substring(0, 1));
        avatar.setTextColor(Color.WHITE);
        avatar.setTextSize(48);
        avatar.setTypeface(Typeface.DEFAULT_BOLD);
        avatar.setGravity(Gravity.CENTER);
        GradientDrawable circle = new GradientDrawable();
        circle.setShape(GradientDrawable.OVAL);
        circle.setColor(Color.argb(40, 255, 255, 255));
        circle.setStroke(dp(4), Color.argb(50, 255, 255, 255));
        avatar.setBackground(circle);
        root.addView(avatar, new LinearLayout.LayoutParams(dp(120), dp(120)));
        loadAvatar(avatar);

        TextView title = new TextView(this);
        title.setText(name);
        title.setTextColor(Color.WHITE);
        title.setTextSize(28);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams tp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        tp.topMargin = dp(20);
        root.addView(title, tp);

        TextView sub = new TextView(this);
        sub.setText(video ? "📹 مكالمة فيديو واردة… القبة" : "مكالمة صوتية واردة… القبة");
        sub.setTextColor(Color.argb(200, 255, 255, 255));
        sub.setTextSize(16);
        sub.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams sp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        sp.topMargin = dp(8);
        root.addView(sub, sp);

        View spacer = new View(this);
        root.addView(spacer, new LinearLayout.LayoutParams(1, 0, 1f));

        LinearLayout buttons = new LinearLayout(this);
        buttons.setOrientation(LinearLayout.HORIZONTAL);
        buttons.setGravity(Gravity.CENTER);
        buttons.addView(roundButton("رفض", "#ef4444", v -> decline()));
        View gap = new View(this);
        buttons.addView(gap, new LinearLayout.LayoutParams(dp(90), 1));
        buttons.addView(roundButton("رد", "#10b981", v -> accept()));
        root.addView(buttons, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        setContentView(root);
        EdgeToEdge.padForSystemBars(root, false);
    }

    private View roundButton(String label, String color, View.OnClickListener click) {
        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setGravity(Gravity.CENTER_HORIZONTAL);

        TextView btn = new TextView(this);
        btn.setText("📞");
        btn.setTextSize(30);
        btn.setGravity(Gravity.CENTER);
        GradientDrawable d = new GradientDrawable();
        d.setShape(GradientDrawable.OVAL);
        d.setColor(Color.parseColor(color));
        btn.setBackground(d);
        btn.setOnClickListener(click);
        col.addView(btn, new LinearLayout.LayoutParams(dp(76), dp(76)));

        TextView t = new TextView(this);
        t.setText(label);
        t.setTextColor(Color.WHITE);
        t.setTextSize(15);
        t.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.topMargin = dp(8);
        col.addView(t, lp);
        return col;
    }

    private void accept() {
        Notifier.cancel(this, tag);
        final String target = (path != null ? path : "/friends")
                + ((path != null && path.contains("?")) ? "&" : "?") + "autoaccept=1";
        Runnable open = () -> {
            Intent i = new Intent(this, MainActivity.class)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP)
                    .putExtra(Notifier.EXTRA_PATH, target);
            startActivity(i);
            finish();
        };
        KeyguardManager km = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && km != null && km.isKeyguardLocked()) {
            km.requestDismissKeyguard(this, new KeyguardManager.KeyguardDismissCallback() {
                @Override
                public void onDismissSucceeded() {
                    open.run();
                }
            });
        } else {
            open.run();
        }
    }

    private void decline() {
        Notifier.cancel(this, tag);
        Notifier.sendReject(this, callId, from);
        finish();
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (current.get() == this) current = new WeakReference<>(null);
        super.onDestroy();
    }
}
