import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { useFriends, type Person } from "@/lib/friends-store";
import { useI18n } from "@/lib/i18n";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { getOrCreatePrivateConversation } from "@/lib/private-chat";
import { friendlyDbError } from "@/lib/cloud-friends";

const accentBg: Record<Person["accent"], string> = {
  teal: "bg-teal/20",
  coral: "bg-coral/20",
  butter: "bg-butter/40",
};

export function PersonRow({
  person,
  children,
  note,
  lastMessage,
  lastTime,
  unread = 0,
  onCall,
  showQuickActions = false,
}: {
  person: Person;
  children?: ReactNode;
  note?: string;
  /** مقطع من آخر رسالة (مثل الواتساب) */
  lastMessage?: string;
  /** وقت آخر رسالة جاهز للعرض */
  lastTime?: string;
  /** عدد الرسائل غير المقروءة */
  unread?: number;
  onCall?: (id: string) => void;
  /** إظهار زرّي الرسالة والاتصال مباشرة */
  showQuickActions?: boolean;
}) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [showOptions, setShowOptions] = useState(false);
  
  const name = lang === "ar" ? person.name : person.nameEn;
  const role = lang === "ar" ? person.role : person.roleEn;
  const { isOnline: isOnlineNow } = useFriends();
  const isOnline = isOnlineNow(person.id);

  // دالة الضغط الذكية لفتح شاشة المراسلة فوراً بالاسم والصورة مثل الواتساب
  const handleCardClick = async () => {
    try {
      const conversationId = await getOrCreatePrivateConversation(person.id);
      navigate({ to: "/private-chat/$conversationId", params: { conversationId } });
    } catch (error) {
      console.error("تعذر فتح المحادثة الخاصة:", error);
      toast.error(friendlyDbError(error));
    }
  };

  // صف الصديق مثل الواتساب: الاسم كامل بدون أزرار، الضغط يفتح الدردشة (وبيها أزرار الاتصال)،
  // والضغط المطوّل يطلّع الخيارات (حذف/حظر). غير الأصدقاء تبقى أزرارهم (مثل إرسال طلب) ظاهرة.
  const isFriendRow = showQuickActions;
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  const clearPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };

  const startPress = () => {
    if (!isFriendRow || !children) return;
    longPressed.current = false;
    clearPress();
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      setShowOptions(true);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(30);
    }, 500);
  };

  const onRowClick = () => {
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    if (showOptions) {
      setShowOptions(false);
      return;
    }
    void handleCardClick();
  };

  // onCall ما عاد يُستعمل بالصف (أزرار الاتصال بصفحة الدردشة)
  void onCall;

  return (
    <div className="relative animate-rise rounded-2xl border-2 border-line/60 bg-cream/30 transition-colors hover:border-line">
      <div
        onClick={onRowClick}
        onPointerDown={startPress}
        onPointerUp={clearPress}
        onPointerLeave={clearPress}
        onPointerCancel={clearPress}
        onContextMenu={(e) => {
          if (!isFriendRow || !children) return;
          e.preventDefault();
          clearPress();
          setShowOptions(true);
        }}
        className="flex cursor-pointer select-none items-center gap-3 p-3"
        title={isFriendRow ? "اضغط للمراسلة · اضغط مطوّلاً للخيارات" : undefined}
      >
        <div className="relative shrink-0">
          <div className={`grid size-12 place-items-center rounded-full font-display text-lg font-bold ${accentBg[person.accent]}`}>
            {name.charAt(0)}
          </div>
          <span className={`absolute -bottom-0.5 -start-0.5 size-3.5 rounded-full ring-2 ring-cream ${isOnline ? "bg-emerald-500" : "bg-red-300"}`} title={isOnline ? "متصل الآن" : "غير متصل"} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <p className="line-clamp-2 min-w-0 flex-1 break-words text-[15px] font-bold leading-snug text-ink">{name}</p>
            {lastTime ? (
              <span className={`shrink-0 pt-0.5 text-[11px] ${unread > 0 ? "font-bold text-emerald-600" : "text-muted-ink"}`}>
                {lastTime}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <p className={`min-w-0 flex-1 truncate text-[13px] ${unread > 0 ? "font-semibold text-ink" : "text-muted-ink"}`}>
              {lastMessage ?? note ?? (isOnline ? t("online") : `${person.handle} · ${role}`)}
            </p>
            {unread > 0 ? (
              <span className="grid min-w-5 shrink-0 place-items-center rounded-full bg-emerald-500 px-1.5 text-[10.5px] font-bold leading-5 text-white">
                {unread > 99 ? "99+" : unread}
              </span>
            ) : null}
          </div>
        </div>

      </div>

      {/* غير الأصدقاء: أزرارهم (إرسال طلب، قبول...) تحت الاسم حتى ما ياخذون مكانه */}
      {!isFriendRow && children ? (
        <div
          className="-mt-1 flex flex-wrap items-center gap-1.5 px-3 pb-3 ps-[4.5rem]"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      ) : null}

      {/* خيارات الصديق بعد الضغط المطوّل */}
      {isFriendRow && showOptions ? (
        <div
          className="flex animate-pop flex-wrap items-center gap-1.5 border-t-2 border-line/40 px-3 py-2"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
          <button
            onClick={() => setShowOptions(false)}
            className="ms-auto rounded-xl border border-line px-2 py-1 text-[11px] font-bold hover:bg-ink/5"
          >
            ✕
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function RowButton({
  onClick,
  children,
  tone = "plain",
}: {
  onClick: () => void;
  children: ReactNode;
  tone?: "plain" | "primary" | "danger";
}) {
  const tones = {
    plain: "border-line hover:bg-ink/5",
    primary: "border-line bg-teal text-teal-ink",
    danger: "border-line text-coral hover:bg-coral/10",
  } as const;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`rounded-full border-2 px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer ${tones[tone]}`}
    >
      {children}
    </button>
  );
}
