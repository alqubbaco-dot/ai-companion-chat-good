import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// رابط التحقق من Google AdMob (Server-Side Verification)
// Google تستدعي هذا الرابط بعد ما المستخدم يكمّل الإعلان بمكافأة،
// نتأكد من توقيع Google، وبعدها نضيف النقطة بقاعدة البيانات.
//
// الرابط اللي ينحط بإعدادات الوحدة الإعلانية بـ AdMob:
//   https://ai-companion-chat-good.vercel.app/api/admob-ssv
//
// يحتاج متغير بإعدادات Vercel: SUPABASE_SERVICE_ROLE_KEY

const SUPABASE_URL = "https://etkacphlxhpdjhrvoaqz.supabase.co";
const KEYS_URL = "https://www.gstatic.com/admob/reward/verifier-keys.json";
// رقم الوحدة الإعلانية points_reward (الجزء بعد الشَرطة)
const AD_UNIT_ID = "1170984501";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type VerifierKey = { keyId: number | string; pem: string };
let cachedKeys: { keys: Map<string, string>; fetchedAt: number } | null = null;

async function getGoogleKeys(force = false): Promise<Map<string, string>> {
  // Google تبدّل المفاتيح بين فترة وفترة، فما نخزنها أكثر من 12 ساعة
  if (!force && cachedKeys && Date.now() - cachedKeys.fetchedAt < 12 * 60 * 60 * 1000) {
    return cachedKeys.keys;
  }
  const res = await fetch(KEYS_URL);
  if (!res.ok) throw new Error(`verifier keys ${res.status}`);
  const json = (await res.json()) as { keys?: VerifierKey[] };
  const keys = new Map<string, string>();
  for (const k of json.keys || []) keys.set(String(k.keyId), k.pem);
  cachedKeys = { keys, fetchedAt: Date.now() };
  return keys;
}

async function verifySignature(rawQuery: string, params: URLSearchParams): Promise<boolean> {
  const signature = params.get("signature");
  const keyId = params.get("key_id");
  const cut = rawQuery.indexOf("&signature=");
  if (!signature || !keyId || cut < 0) return false;

  // الرسالة الموقّعة = كل شي قبل &signature= بنفس الترتيب بالضبط
  const message = Buffer.from(rawQuery.slice(0, cut), "utf8");
  const sig = Buffer.from(signature, "base64url");
  const { verify } = await import("node:crypto");

  let keys = await getGoogleKeys();
  if (!keys.has(keyId)) keys = await getGoogleKeys(true);
  const pem = keys.get(keyId);
  if (!pem) return false;

  try {
    return verify("sha256", message, pem, sig);
  } catch {
    return false;
  }
}

const text = (body: string, status = 200) =>
  new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

export const Route = createFileRoute("/api/admob-ssv")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const rawQuery = url.search.startsWith("?") ? url.search.slice(1) : url.search;
        const params = new URLSearchParams(rawQuery);

        // طلب فحص الرابط من لوحة AdMob (بدون توقيع): نرد OK حتى يقبل الرابط
        if (!params.get("signature")) return text("ok");

        let valid = false;
        try {
          valid = await verifySignature(rawQuery, params);
        } catch (err) {
          console.error("admob ssv: key fetch failed", err);
          // خطأ مؤقت: Google تعيد المحاولة إذا ما رجعنا 200
          return text("temporary error", 503);
        }
        if (!valid) {
          console.warn("admob ssv: bad signature");
          return text("bad signature", 403);
        }

        const userId = params.get("user_id") || "";
        const transactionId = params.get("transaction_id") || "";
        const adUnit = params.get("ad_unit") || "";
        const amount = Number.parseInt(params.get("reward_amount") || "1", 10) || 1;

        // توقيع صحيح لكن مو من وحدتنا، أو بدون مستخدم: نقبله وما نضيف شي
        if (!adUnit.endsWith(AD_UNIT_ID) || !UUID_RE.test(userId) || !transactionId) {
          console.warn("admob ssv: ignored", { adUnit, hasUser: !!userId });
          return text("ignored");
        }

        const env = (typeof process !== "undefined" ? process.env : {}) as Record<string, string | undefined>;
        const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceKey) {
          console.error("admob ssv: SUPABASE_SERVICE_ROLE_KEY is not set");
          return text("server not configured", 500);
        }

        const db = createClient(SUPABASE_URL, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data, error } = await db.rpc("credit_ad_reward", {
          p_user: userId,
          p_transaction: transactionId,
          p_ad_unit: adUnit,
          p_amount: amount,
        });
        if (error) {
          console.error("admob ssv: credit failed", error.message);
          return text("db error", 500);
        }
        return text(String(data ?? "ok"));
      },
    },
  },
});
