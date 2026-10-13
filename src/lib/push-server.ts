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

export type PushResult = { ok: true; sent: number } | { ok: false; error: string };

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
    const env = typeof process !== "undefined" ? process.env : {};
    const privateKey = env.VAPID_PRIVATE_KEY || "";
    if (!privateKey) return { ok: false, error: "VAPID_PRIVATE_KEY is not set" };
    if (!data.accessToken || !data.targetId) return { ok: false, error: "missing input" };

    // نستعمل جلسة المستخدم نفسه: قاعدة البيانات تتأكد إنه صديق قبل ما تعطي العناوين
    const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${data.accessToken}` } },
    });

    const { data: targets, error } = await db.rpc("push_targets", { target_user: data.targetId });
    if (error) return { ok: false, error: error.message };
    const list = (targets || []) as { endpoint: string; p256dh: string; auth: string }[];
    if (list.length === 0) return { ok: true, sent: 0 };

    webpush.setVapidDetails("mailto:noreply@ghabiy.app", VAPID_PUBLIC_KEY, privateKey);

    const payload = JSON.stringify({
      kind: data.kind,
      title: data.title,
      body: data.body,
      url: data.url,
      tag: data.tag,
    });

    let sent = 0;
    await Promise.all(
      list.map(async (sub) => {
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
          }
        }
      }),
    );
    return { ok: true, sent };
  });
