import { useEffect, useState } from "react";
import { toast } from "sonner";

// يدير كل شي يخص "التطبيق الحقيقي":
// 1) يسجّل عامل الخدمة (sw.js)
// 2) يعرض زر "ثبّت التطبيق" (أو شرح الآيفون)
// 3) يبلّغ المستخدم لما تنزل نسخة جديدة

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "pwa-install-dismissed-at";
const DISMISS_DAYS = 7;

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // الآيفون
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iPadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return /iphone|ipad|ipod/i.test(ua) || iPadOs;
}

function recentlyDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return at > 0 && Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function rememberDismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* المتصفح ما يسمح بالحفظ: عادي */
  }
}

export function PwaManager() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [hidden, setHidden] = useState(true);

  // تسجيل عامل الخدمة + تنبيه النسخة الجديدة
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (location.hostname === "localhost" || location.hostname === "127.0.0.1") return;

    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const askToUpdate = (worker: ServiceWorker) => {
      toast("✨ أكو نسخة جديدة من القبة", {
        duration: Infinity,
        action: {
          label: "حدّث",
          onClick: () => worker.postMessage({ type: "SKIP_WAITING" }),
        },
      });
    };

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        // نسخة جديدة جاهزة من قبل
        if (registration.waiting && navigator.serviceWorker.controller) {
          askToUpdate(registration.waiting);
        }
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            // نسأل بس إذا أكو نسخة قديمة شغّالة (مو أول تنصيب)
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              askToUpdate(worker);
            }
          });
        });
        // نفحص التحديثات لما المستخدم يرجع للتطبيق
        const onVisible = () => {
          if (document.visibilityState === "visible") void registration.update();
        };
        document.addEventListener("visibilitychange", onVisible);
      } catch (err) {
        console.error("تعذر تسجيل عامل الخدمة:", err);
      }
    };

    if (document.readyState === "complete") void register();
    else window.addEventListener("load", () => void register(), { once: true });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  // زر التثبيت
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone() || recentlyDismissed()) return;

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
      setHidden(false);
    };
    const onInstalled = () => {
      setInstallEvent(null);
      setHidden(true);
      toast.success("🎉 انتصبت القبة على جهازك!");
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    // الآيفون ما يدعم زر تلقائي، فنعرض شرح قصير بعد شوية
    let iosTimer: ReturnType<typeof setTimeout> | undefined;
    if (isIos()) {
      iosTimer = setTimeout(() => {
        setShowIosHint(true);
        setHidden(false);
      }, 4000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, []);

  if (hidden || (!installEvent && !showIosHint)) return null;

  const close = () => {
    rememberDismiss();
    setHidden(true);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome !== "accepted") rememberDismiss();
    setInstallEvent(null);
    setHidden(true);
  };

  return (
    <div
      className="fixed inset-x-3 bottom-[5.5rem] z-50 mx-auto max-w-md animate-rise md:bottom-6"
      role="dialog"
      aria-label="تثبيت التطبيق"
    >
      <div className="flex items-center gap-3 rounded-3xl border border-line bg-cream/95 p-3 shadow-xl backdrop-blur">
        <img
          src="/icons/logo.webp"
          alt=""
          width={48}
          height={48}
          className="size-12 shrink-0 rounded-[30%]"
          draggable={false}
        />
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-extrabold leading-tight">ثبّت القبة 📲</p>
          {showIosHint && !installEvent ? (
            <p className="mt-0.5 text-[11.5px] leading-snug text-muted-ink">
              اضغط زر المشاركة <span aria-hidden>⬆️</span> بالأسفل، وبعدين «إضافة إلى الشاشة الرئيسية».
            </p>
          ) : (
            <p className="mt-0.5 text-[11.5px] leading-snug text-muted-ink">
              يفتح أسرع، وبدون شريط المتصفح، مثل أي تطبيق.
            </p>
          )}
        </div>
        {installEvent ? (
          <button
            type="button"
            onClick={install}
            className="bg-brand shrink-0 rounded-full px-4 py-2 text-xs font-bold shadow-sm"
          >
            ثبّت
          </button>
        ) : null}
        <button
          type="button"
          onClick={close}
          aria-label="إغلاق"
          className="grid size-8 shrink-0 place-items-center rounded-full text-muted-ink hover:bg-ink/5"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
