import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

// السيرفر الوسيط للمكالمات (Cloudflare TURN)
// لما شبكة الموبايل تمنع الربط المباشر بين التلفونين، الصوت والفيديو يمرون عن طريقه.
// المفاتيح بإعدادات Vercel فقط (ما توصل للمتصفح):
//   CLOUDFLARE_TURN_KEY_ID
//   CLOUDFLARE_TURN_API_TOKEN
// هذي الدالة تنطي كلمات سر مؤقتة (24 ساعة) للمستخدمين المسجّلين بس.

const SUPABASE_URL = "https://etkacphlxhpdjhrvoaqz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_qwvchdJI-viQlVbiDPtfhg_VG6UOjkk";
const TTL_SECONDS = 86_400;

export type TurnResult = { ok: true; iceServers: RTCIceServer[]; ttl: number } | { ok: false; error: string };

type CfIceServer = { urls: string | string[]; username?: string; credential?: string };

export const getTurnIceServers = createServerFn({ method: "POST" })
  .validator((input: { accessToken: string }) => ({ accessToken: String(input?.accessToken ?? "").slice(0, 4000) }))
  .handler(async ({ data }): Promise<TurnResult> => {
    const env = (typeof process !== "undefined" ? process.env : {}) as Record<string, string | undefined>;
    const keyId = env.CLOUDFLARE_TURN_KEY_ID?.trim();
    const token = env.CLOUDFLARE_TURN_API_TOKEN?.trim();
    if (!keyId || !token) return { ok: false, error: "turn not configured" };
    if (!data.accessToken) return { ok: false, error: "not signed in" };

    // بس المستخدمين المسجّلين (حتى محد يستهلك الحصة المجانية من برّا)
    const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: user, error: authError } = await db.auth.getUser(data.accessToken);
    if (authError || !user?.user) return { ok: false, error: "not signed in" };

    try {
      const res = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ttl: TTL_SECONDS }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("cloudflare turn failed", res.status, text.slice(0, 200));
        return { ok: false, error: `cloudflare ${res.status}` };
      }
      const json = (await res.json()) as { iceServers?: CfIceServer | CfIceServer[] };
      const list = Array.isArray(json.iceServers) ? json.iceServers : json.iceServers ? [json.iceServers] : [];
      // المنفذ 53 محجوب بالمتصفحات، نشيله حتى ما ينتظر عليه
      const iceServers: RTCIceServer[] = list
        .map((s) => {
          const urls = (Array.isArray(s.urls) ? s.urls : [s.urls]).filter((u) => !/:53(\?|$)/.test(u));
          return { urls, username: s.username, credential: s.credential };
        })
        .filter((s) => s.urls.length > 0);
      return { ok: true, iceServers, ttl: TTL_SECONDS };
    } catch (err) {
      console.error("cloudflare turn error", err);
      return { ok: false, error: "turn fetch failed" };
    }
  });
