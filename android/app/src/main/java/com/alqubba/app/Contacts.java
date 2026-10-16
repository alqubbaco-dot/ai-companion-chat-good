package com.alqubba.app;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.provider.ContactsContract;

import org.json.JSONArray;

import java.util.HashSet;
import java.util.Set;

/**
 * يقرا أرقام جهات الاتصال (بس إذا المستخدم سمح) حتى الموقع يطابقها ويطلّع منو عنده التطبيق.
 * يرجّع JSON: [["07701234567","أحمد"], ...]  — الأرقام ما تنحفظ بأي مكان.
 */
final class Contacts {
    private static final int MAX = 3000;

    private Contacts() {
    }

    static boolean allowed(Context c) {
        return c.checkSelfPermission(Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED;
    }

    static String readJson(Context c) {
        JSONArray out = new JSONArray();
        if (!allowed(c)) return out.toString();
        String[] cols = {
                ContactsContract.CommonDataKinds.Phone.NUMBER,
                ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
        };
        Set<String> seen = new HashSet<>();
        try (Cursor cur = c.getContentResolver().query(
                ContactsContract.CommonDataKinds.Phone.CONTENT_URI, cols, null, null, null)) {
            if (cur == null) return out.toString();
            while (cur.moveToNext() && out.length() < MAX) {
                String number = cur.getString(0);
                String name = cur.getString(1);
                if (number == null) continue;
                String digits = number.replaceAll("[^0-9+]", "");
                if (digits.length() < 7 || !seen.add(digits)) continue;
                JSONArray pair = new JSONArray();
                pair.put(digits);
                pair.put(name == null ? "" : name);
                out.put(pair);
            }
        } catch (Exception ignored) {
        }
        return out.toString();
    }
}
