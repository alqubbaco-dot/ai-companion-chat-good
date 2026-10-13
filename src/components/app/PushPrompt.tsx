import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useFriends } from "@/lib/friends-store";
import { enablePush, ensurePushSubscription, nativeBridge, pushState, registerNativeDevice } from "@/lib/push-client";

const DISMISS_KEY = "push-prompt-dismissed-at";
const DISMISS_DAYS = 3;

function recentlyDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return at > 0 && Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

// شريط صغير يطلب تفعيل الإشعارات حتى يوصل رنين المكالمات والتطبيق مسكّر
export function PushPrompt() {
  const { profile } = useFriends();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile.id) return;
    // داخل تطبيق الأندرويد: الإشعارات عن طريق Firebase، ما نحتاج نسأل
    if (nativeBridge()) {
      setShow(false);
      return registerNativeDevice(profile.id);
    }
    const state = pushState();
    if (state === "granted") {
      // الإذن موجود: نسجّل الجهاز بصمت (يتحدث إذا تغيّر الحساب)
      void ensurePushSubscription();
      setShow(false);
    } else if (state === "default" && !recentlyDismissed()) {
      setShow(true);
    }
  }, [profile.id]);

  if (!show) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* */
    }
    setShow(false);
  };

  const enable = async () => {
    setBusy(true);
    const result = await enablePush();
    setBusy(false);
    setShow(false);
    if (result === "granted") toast.success("🔔 تم! هسه توصلك المكالمات والرسائل حتى والتطبيق مسكّر");
    else if (result === "denied") toast.error("الإشعارات مرفوضة. تكدر تفعّلها من إعدادات المتصفح للموقع");
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-x-3 bottom-24 z-[90] mx-auto max-w-md animate-rise rounded-2xl border-2 border-line bg-cream p-3 shadow-xl md:bottom-6"
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">🔔</span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-extrabold">فعّل الإشعارات</p>
          <p className="text-[12px] text-muted-ink">
            حتى يرن تلفونك من يتصل بيك صديق، وتوصلك الرسائل حتى والتطبيق مسكّر.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => void enable()}
              disabled={busy}
              className="rounded-full bg-emerald-500 px-4 py-1.5 text-[12px] font-bold text-white disabled:opacity-50"
            >
              {busy ? "لحظة…" : "فعّل"}
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="rounded-full border-2 border-line px-4 py-1.5 text-[12px] font-bold"
            >
              لاحقاً
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
