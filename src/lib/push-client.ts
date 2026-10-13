import { supabase } from "./supabase";
import { VAPID_PUBLIC_KEY } from "./push-config";
import { sendPushToFriend, type PushKind } from "./push-server";

// جهة المتصفح لإشعارات Push: تسجيل الجهاز + طلب إرسال إشعار لصديق

export type PushState = "unsupported" | "default" | "denied" | "granted";

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function pushState(): PushState {
  if (!pushSupported()) return "unsupported";
  return Notification.permission as PushState;
}

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

// يسجّل هذا الجهاز للمستخدم الحالي (إذا الإذن موجود)
export async function ensurePushSubscription(): Promise<boolean> {
  if (pushState() !== "granted") return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
    }
    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;
    const { error } = await supabase.rpc("save_push_subscription", {
      p_endpoint: json.endpoint,
      p_p256dh: json.keys.p256dh,
      p_auth: json.keys.auth,
      p_user_agent: navigator.userAgent.slice(0, 200),
    });
    if (error) {
      console.error("تعذر حفظ جهاز الإشعارات:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("تعذر تفعيل الإشعارات:", err);
    return false;
  }
}

// يطلب الإذن من المستخدم (لازم يكون بعد ضغطة زر)
export async function enablePush(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  const result = (await Notification.requestPermission()) as PushState;
  if (result === "granted") await ensurePushSubscription();
  return result;
}

// يرسل إشعار لأجهزة صديق (ما يوقف شي إذا فشل)
export async function notifyFriend(
  targetId: string,
  kind: PushKind,
  title: string,
  body: string,
  url: string,
  tag: string,
): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken || !targetId) return;
    const result = await sendPushToFriend({ data: { accessToken, targetId, kind, title, body, url, tag } });
    if (!result.ok) console.warn("push:", result.error);
  } catch (err) {
    console.warn("تعذر إرسال الإشعار:", err);
  }
}
