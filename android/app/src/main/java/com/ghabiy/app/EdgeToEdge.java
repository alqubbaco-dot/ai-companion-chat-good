package com.ghabiy.app;

import android.graphics.Insets;
import android.os.Build;
import android.view.View;
import android.view.WindowInsets;

/**
 * من أندرويد 15 فما فوق، التطبيق يترسم ورا شريط الحالة وشريط الأزرار (edge-to-edge إجباري).
 * هذا يضيف فراغ بقدر الأشرطة (والكيبورد) حتى ما ينغطى شي من الشاشة.
 */
final class EdgeToEdge {

    private EdgeToEdge() {
    }

    static void padForSystemBars(View view, boolean includeKeyboard) {
        if (Build.VERSION.SDK_INT < 35) return; // الأجهزة الأقدم ترتب الأشرطة بنفسها
        final int left = view.getPaddingLeft();
        final int top = view.getPaddingTop();
        final int right = view.getPaddingRight();
        final int bottom = view.getPaddingBottom();
        view.setOnApplyWindowInsetsListener((v, insets) -> {
            Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
            int bottomInset = bars.bottom;
            if (includeKeyboard) {
                bottomInset = Math.max(bottomInset, insets.getInsets(WindowInsets.Type.ime()).bottom);
            }
            v.setPadding(left + bars.left, top + bars.top, right + bars.right, bottom + bottomInset);
            return WindowInsets.CONSUMED;
        });
        view.requestApplyInsets();
    }
}
