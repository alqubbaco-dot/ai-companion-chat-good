import { supabase } from "./supabase";
import { VAPID_PUBLIC_KEY } from "./push-config";
import { sendPushToFriend, warmUpPush, type PushKind } from "./push-server";

// يصحّي سيرفر الإشعارات مسبقاً حتى أول مكالمة ما تتأخر (مرة كل 3 دقايق بالأكثر)
let lastWarmUp = 0;
export function warmUpCallServer() {
  const now = Date.now();
  if (now - lastWarmUp < 3 * 60_000) return;
  lastWarmUp = now;
  warmUpPush().catch(() => {
    lastWarmUp = 0;
  });
}

// جهة المتصفح لإشعارات Push: تسجيل الجهاز + طلب إرسال إشعار لصديق

export type PushState = "unsupported" | "default" | "denied" | "granted";

// ───────────── تطبيق الأندرويد (WebView) ─────────────

type GhabiyNativeBridge = {
  isNative: () => boolean;
  getFcmToken: () => string;
  setUser: (userId: string) => void;
};

export function nativeBridge(): GhabiyNativeBridge | null {
  if (typeof window === "undefined") return null;
  const bridge = (window as unknown as { GhabiyNative?: GhabiyNativeBridge }).GhabiyNative;
  return bridge && typeof bridge.getFcmToken === "function" ? bridge : null;
}

let savedNativeToken = "";

async function saveNativeToken(token: string) {
  if (!token || token === savedNativeToken) return;
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: `fcm:${token}`,
    p_p256dh: "fcm",
    p_auth: "fcm",
    p_user_agent: "android-app",
  });
  if (error) console.error("تعذر حفظ جهاز الأندرويد:", error);
  else savedNativeToken = token;
}

// يسجّل تلفون الأندرويد للمستخدم الحالي حتى توصله المكالمات
export function registerNativeDevice(userId: string): () => void {
  const bridge = nativeBridge();
  if (!bridge || !userId) return () => undefined;
  try {
    bridge.setUser(userId);
  } catch {
    /* */
  }
  savedNativeToken = "";
  void saveNativeToken(bridge.getFcmToken());
  const onToken = (event: Event) => {
    const token = (event as CustomEvent<string>).detail;
    if (typeof token === "string") void saveNativeToken(token);
  };
  window.addEventListener("ghabiy-fcm-token", onToken);
  return () => window.removeEventListener("ghabiy-fcm-token", onToken);
}

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
  icon?: string | null,
): Promise<{ sent: number; devices: number; reason: string }> {
  try {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken || !targetId) return { sent: 0, devices: 0, reason: "no session" };
    const result = await sendPushToFriend({ data: { accessToken, targetId, kind, title, body, url, tag, icon: icon || undefined } });
    if (!result.ok) {
      console.warn("push:", result.error);
      return { sent: 0, devices: 0, reason: result.error };
    }
    return { sent: result.sent, devices: result.devices, reason: result.errors.join(" | ") };
  } catch (err) {
    console.warn("تعذر إرسال الإشعار:", err);
    return { sent: 0, devices: 0, reason: err instanceof Error ? err.message : "error" };
  }
}
