import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
// @ts-expect-error - مكتبة web-push ما بيها تعريفات TypeScript مدمجة
import webpush from "web-push";
import { VAPID_PUBLIC_KEY } from "./push-config";

// هذا الملف يشتغل على السيرفر فقط: يرسل إشعار Push لأجهزة صديق
// (المفتاح الخاص VAPID_PRIVATE_KEY بإعدادات Vercel وما يوصل للمتصفح)

const SUPABASE_URL = "https://etkacphlxhpdjhrvoaqz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_qwvchdJI-viQlVbiDPtfhg_VG6UOjkk";

export type PushKind = "call" | "call-end" | "message";

type PushInput = {
  accessToken: string;
  targetId: string;
  kind: PushKind;
  title: string;
  body: string;
  url: string;
  tag: string;
};

export type PushResult = { ok: true; sent: number; devices: number; errors: string[] } | { ok: false; error: string };

const clip = (value: unknown, max: number) => String(value ?? "").slice(0, max);

export const sendPushToFriend = createServerFn({ method: "POST" })
  .validator((input: PushInput): PushInput => {
    const kind: PushKind = input?.kind === "call" || input?.kind === "call-end" ? input.kind : "message";
    const url = clip(input?.url, 300);
    return {
      accessToken: clip(input?.accessToken, 4000),
      targetId: clip(input?.targetId, 64),
      kind,
      title: clip(input?.title, 80),
      body: clip(input?.body, 160),
      // نسمح بروابط داخل التطبيق فقط
      url: url.startsWith("/") && !url.startsWith("//") ? url : "/",
      tag: clip(input?.tag, 80),
    };
  })
  .handler(async ({ data }): Promise<PushResult> => {
    const env = (typeof process !== "undefined" ? process.env : {}) as Record<string, string | undefined>;
    const vapidKey = env.VAPID_PRIVATE_KEY || "";
    if (!data.accessToken || !data.targetId) return { ok: false, error: "missing input" };

    // نستعمل جلسة المستخدم نفسه: قاعدة البيانات تتأكد إنه صديق قبل ما تعطي العناوين
    const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${data.accessToken}` } },
    });

    const { data: targets, error } = await db.rpc("push_targets", { target_user: data.targetId });
    if (error) return { ok: false, error: error.message };
    const list = (targets || []) as { endpoint: string; p256dh: string; auth: string }[];
    if (list.length === 0) return { ok: true, sent: 0, devices: 0, errors: [] };
    const errors: string[] = [];

    const message = {
      kind: data.kind,
      title: data.title,
      body: data.body,
      url: data.url,
      tag: data.tag,
    };
    const payload = JSON.stringify(message);
    if (vapidKey) webpush.setVapidDetails("mailto:noreply@ghabiy.app", VAPID_PUBLIC_KEY, vapidKey);

    let sent = 0;
    await Promise.all(
      list.map(async (sub) => {
        // تطبيق الأندرويد: عن طريق Firebase
        if (sub.endpoint.startsWith("fcm:")) {
          const result = await sendFcm(env, sub.endpoint.slice(4), message);
          if (result === "sent") sent += 1;
          else if (result === "gone") {
            errors.push("android device expired");
            await db.rpc("prune_push_subscription", { p_endpoint: sub.endpoint });
          } else errors.push(result);
          return;
        }
        // المتصفح: Web Push
        if (!vapidKey) {
          errors.push("VAPID_PRIVATE_KEY missing");
          return;
        }
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
            { TTL: data.kind === "call" ? 45 : 60 * 60 * 12, urgency: "high" },
          );
          sent += 1;
        } catch (err) {
          const status = (err as { statusCode?: number })?.statusCode;
          if (status === 404 || status === 410) {
            await db.rpc("prune_push_subscription", { p_endpoint: sub.endpoint });
          } else {
            console.error("push failed", status, err);
            errors.push(`web push ${status ?? "error"}`);
          }
        }
      }),
    );
    return { ok: true, sent, devices: list.length, errors };
  });

// ───────────── Firebase Cloud Messaging (تطبيق الأندرويد) ─────────────

type ServiceAccount = { client_email: string; private_key: string; project_id: string };

let cachedAccess: { token: string; expires: number } | null = null;

function base64url(input: string | Buffer) {
  return Buffer.from(input).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function readServiceAccount(env: Record<string, string | undefined>): ServiceAccount | null {
  const raw = env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw.trim()) as ServiceAccount;
    if (!parsed.client_email || !parsed.private_key || !parsed.project_id) return null;
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    return parsed;
  } catch (err) {
    console.error("FIREBASE_SERVICE_ACCOUNT is not valid JSON", err);
    return null;
  }
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  if (cachedAccess && cachedAccess.expires > Date.now() + 60_000) return cachedAccess.token;
  const { createSign } = await import("node:crypto");
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const signature = base64url(signer.sign(sa.private_key));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${signature}`,
    }),
  });
  const json = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !json.access_token) throw new Error(`google oauth failed: ${json.error || res.status}`);
  cachedAccess = { token: json.access_token, expires: Date.now() + (json.expires_in || 3600) * 1000 };
  return json.access_token;
}

async function sendFcm(
  env: Record<string, string | undefined>,
  token: string,
  message: Record<string, string>,
): Promise<string> {
  const sa = readServiceAccount(env);
  if (!sa) {
    console.error("FIREBASE_SERVICE_ACCOUNT is not set");
    return env.FIREBASE_SERVICE_ACCOUNT ? "FIREBASE_SERVICE_ACCOUNT invalid JSON" : "FIREBASE_SERVICE_ACCOUNT missing";
  }
  try {
    const access = await getAccessToken(sa);
    const isCall = message.kind === "call";
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          token,
          data: message,
          android: { priority: "HIGH", ttl: isCall ? "45s" : "43200s" },
        },
      }),
    });
    if (res.ok) return "sent";
    const text = await res.text();
    if (res.status === 404 || text.includes("UNREGISTERED")) return "gone";
    console.error("fcm failed", res.status, text);
    return `fcm ${res.status}: ${text.slice(0, 120)}`;
  } catch (err) {
    console.error("fcm error", err);
    return `fcm error: ${err instanceof Error ? err.message.slice(0, 120) : "unknown"}`;
  }
}
