import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Ban, ChevronDown, Flag, MoreVertical, Phone, Video } from "lucide-react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useFriends } from "@/lib/friends-store";
import { useCall } from "@/lib/call-store";
import { notifyFriend } from "@/lib/push-client";
import { AudioBubble, ImageBubble, formatDuration } from "@/components/chat/MediaBubbles";
import { useVoiceRecorder, type VoiceResult } from "@/lib/use-voice-recorder";
import {
  compressImage,
  sendMediaMessage,
  getPrivateConversation,
  getPrivateMessages,
  markConversationRead,
  markConversationReadRemote,
  sendPrivateMessage,
  subscribeToPrivateMessages,
  type PrivateMessage,
} from "@/lib/private-chat";
import { supabase } from "@/lib/supabase";
import { PersonPhoto } from "@/components/app/Avatar";
import { STICKERS, STICKERS_FEATURE, StickerArt, stickerContent, stickerFromContent, type Sticker } from "@/components/chat/Stickers";
import { getMyPoints } from "@/lib/ad-points";
import type { RealtimeChannel } from "@supabase/supabase-js";

export const Route = createFileRoute("/private-chat/$conversationId")({
  component: PrivateChatPage,
});

// زر اتصال واحد مثل الواتساب: يفتح قائمة (مكالمة صوتية / مكالمة فيديو)
function CallMenu({ onVoice, onVideo }: { onVoice: () => void; onVideo: () => void }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div ref={boxRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 items-center gap-0.5 rounded-full border-2 border-line bg-cream px-3 text-ink transition-transform active:scale-95"
        title="اتصال"
        aria-label="اتصال"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Phone className="size-[22px]" strokeWidth={1.8} />
        <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={2} />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute end-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-2xl border-2 border-line bg-cream py-1.5 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => pick(onVoice)}
            className="flex w-full items-center gap-3 px-4 py-3 text-start font-display text-[15px] font-bold hover:bg-ink/5 active:bg-ink/10"
          >
            <Phone className="size-5 shrink-0 text-emerald-600" strokeWidth={1.8} />
            مكالمة صوتية
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => pick(onVideo)}
            className="flex w-full items-center gap-3 px-4 py-3 text-start font-display text-[15px] font-bold hover:bg-ink/5 active:bg-ink/10"
          >
            <Video className="size-5 shrink-0 text-emerald-600" strokeWidth={1.8} />
            مكالمة فيديو
          </button>
        </div>
      ) : null}
    </div>
  );
}

// زر ⋮ بأعلى المحادثة: قائمة منسدلة بيها (إبلاغ / حظر)
function MoreMenu({
  blocked,
  onReport,
  onBlock,
  onUnblock,
}: {
  blocked: boolean;
  onReport: () => void;
  onBlock: () => void;
  onUnblock: () => void;
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (action: () => void) => {
    setOpen(false);
    action();
  };

  const itemClass =
    "flex w-full items-center gap-3 px-4 py-3 text-start font-display text-[15px] font-bold hover:bg-ink/5 active:bg-ink/10";

  return (
    <div ref={boxRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="grid size-10 place-items-center rounded-full text-ink transition-transform hover:bg-ink/5 active:scale-95"
        title="خيارات"
        aria-label="خيارات"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreVertical className="size-[22px]" strokeWidth={1.8} />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute end-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-2xl border-2 border-line bg-cream py-1.5 shadow-lg"
        >
          <button type="button" role="menuitem" onClick={() => pick(onReport)} className={itemClass}>
            <Flag className="size-5 shrink-0 text-amber-600" strokeWidth={1.8} />
            إبلاغ
          </button>
          {blocked ? (
            <button type="button" role="menuitem" onClick={() => pick(onUnblock)} className={itemClass}>
              <Ban className="size-5 shrink-0 text-muted-ink" strokeWidth={1.8} />
              إلغاء الحظر
            </button>
          ) : (
            <button type="button" role="menuitem" onClick={() => pick(onBlock)} className={`${itemClass} text-red-600`}>
              <Ban className="size-5 shrink-0" strokeWidth={1.8} />
              حظر
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

const REPORT_REASONS: { id: string; label: string }[] = [
  { id: "spam", label: "إزعاج أو رسائل كثيرة" },
  { id: "abuse", label: "كلام مسيء أو تهديد" },
  { id: "scam", label: "احتيال أو نصب" },
  { id: "fake", label: "حساب مزيّف أو ينتحل شخصية" },
  { id: "other", label: "سبب ثاني" },
];

// نافذة صغيرة بنص الشاشة (للإبلاغ ولتأكيد الحظر)
function Sheet({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40 p-3 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-3xl border-2 border-line bg-cream p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function ReportDialog({
  name,
  alreadyBlocked,
  onClose,
  onSubmit,
}: {
  name: string;
  alreadyBlocked: boolean;
  onClose: () => void;
  onSubmit: (reason: string, note: string, alsoBlock: boolean) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(!alreadyBlocked);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!reason || busy) return;
    setBusy(true);
    try {
      await onSubmit(reason, note, alsoBlock && !alreadyBlocked);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet onClose={busy ? () => undefined : onClose}>
      <h2 className="font-display text-lg font-extrabold">الإبلاغ عن {name}</h2>
      <p className="mt-1 text-[13px] text-muted-ink">
        البلاغ يوصل لإدارة التطبيق بس، و{name} ما يعرف منو بلّغ عليه.
      </p>
      <div className="mt-4 space-y-2">
        {REPORT_REASONS.map((r) => (
          <label
            key={r.id}
            className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 px-3 py-2.5 text-[14px] font-bold ${
              reason === r.id ? "border-ink bg-butter/30" : "border-line"
            }`}
          >
            <input
              type="radio"
              name="report-reason"
              value={r.id}
              checked={reason === r.id}
              onChange={() => setReason(r.id)}
              className="size-4 accent-ink"
            />
            {r.label}
          </label>
        ))}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, 500))}
        placeholder="تفاصيل إضافية (اختياري)"
        rows={3}
        className="mt-3 w-full resize-none rounded-2xl border-2 border-line bg-paper px-3 py-2 text-[14px] outline-none focus:border-ink"
      />
      {!alreadyBlocked ? (
        <label className="mt-3 flex cursor-pointer items-center gap-3 text-[14px] font-bold">
          <input
            type="checkbox"
            checked={alsoBlock}
            onChange={(e) => setAlsoBlock(e.target.checked)}
            className="size-4 accent-ink"
          />
          واحظره هم (ما يكدر يراسلك أو يتصل بيك)
        </label>
      ) : null}
      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!reason || busy}
          className="flex-1 rounded-full border-2 border-ink bg-ink px-4 py-2.5 font-display font-bold text-cream disabled:opacity-40"
        >
          {busy ? "جاري الإرسال…" : "إرسال البلاغ"}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="rounded-full border-2 border-line px-4 py-2.5 font-display font-bold"
        >
          إلغاء
        </button>
      </div>
    </Sheet>
  );
}

function BlockConfirm({ name, onClose, onConfirm }: { name: string; onClose: () => void; onConfirm: () => void }) {
  return (
    <Sheet onClose={onClose}>
      <h2 className="font-display text-lg font-extrabold">تحظر {name}؟</h2>
      <p className="mt-2 text-[14px] text-muted-ink">
        ما يكدر يراسلك ولا يتصل بيك، وينشال من أصدقائك. تكدر تلغي الحظر بعدين من صفحة الأصدقاء.
      </p>
      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="flex-1 rounded-full border-2 border-red-600 bg-red-600 px-4 py-2.5 font-display font-bold text-white"
        >
          حظر
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border-2 border-line px-4 py-2.5 font-display font-bold"
        >
          إلغاء
        </button>
      </div>
    </Sheet>
  );
}

// "آخر ظهور اليوم 2:30 م" / "أمس" / تاريخ
function formatLastSeen(iso?: string | null): string {
  if (!iso) return "غير متصل";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "غير متصل";
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return "آخر ظهور قبل لحظات";
  const time = new Intl.DateTimeFormat("ar-IQ", { hour: "numeric", minute: "2-digit" }).format(date);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const dayMs = 86_400_000;
  if (date.getTime() >= startOfToday.getTime()) return `آخر ظهور اليوم ${time}`;
  if (date.getTime() >= startOfToday.getTime() - dayMs) return `آخر ظهور أمس ${time}`;
  const day = new Intl.DateTimeFormat("ar-IQ", { day: "numeric", month: "long" }).format(date);
  return `آخر ظهور ${day}`;
}

function PrivateChatPage() {
  const { conversationId } = Route.useParams();
  const { directory, profile, isOnline: isOnlineNow, relationOf, blockUser, unblockUser } = useFriends();
  const { startCall } = useCall();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<null | "report" | "block">(null);
  const [stickersOpen, setStickersOpen] = useState(false);
  const [stickersUnlocked, setStickersUnlocked] = useState(false);

  useEffect(() => {
    void getMyPoints().then((p) => setStickersUnlocked(Boolean(p?.unlocked?.includes(STICKERS_FEATURE))));
  }, []);
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [otherUserId, setOtherUserId] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<null | "image" | "audio">(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const micStartX = useRef(0);
  const micPressAt = useRef(0);
  const [cancelHint, setCancelHint] = useState(false);
  // تسجيل مقفول: ضغطة سريعة تبدي التسجيل، وبعدها زر ➤ يرسل و✕ يلغي
  const [voiceLocked, setVoiceLocked] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const load = async () => {
      try {
        const conversation = await getPrivateConversation(conversationId);
        const currentUserId = profile.id || (await supabase.auth.getUser()).data.user?.id;
        const otherId = conversation.user_one_id === currentUserId
          ? conversation.user_two_id
          : conversation.user_one_id;
        const loadedMessages = await getPrivateMessages(conversationId);
        if (active) {
          setOtherUserId(otherId);
          setMessages(loadedMessages);
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "تعذر تحميل المحادثة");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    const unsubscribe = subscribeToPrivateMessages(
      conversationId,
      (message) => {
        setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      },
      // تحديث رسالة (مثلاً صديقك قرأها) → تتحول العلامة ✓✓ زرقاء
      (updated) => {
        setMessages((current) =>
          current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
        );
      },
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [conversationId, profile.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    // المحادثة مفتوحة = كل رسائلها مقروءة
    const last = messages[messages.length - 1];
    markConversationRead(conversationId, last?.created_at);
  }, [messages, conversationId]);

  // نبلّغ صديقك إننا قرينا رسائله (✓✓ زرقاء عنده) — فقط والتطبيق قدامنا
  const hasUnreadFromOther = messages.some((m) => m.sender_id !== profile.id && !m.read_at);
  useEffect(() => {
    if (!hasUnreadFromOther || !profile.id) return;
    const mark = () => {
      if (document.visibilityState === "visible") void markConversationReadRemote(conversationId);
    };
    const timer = window.setTimeout(mark, 600);
    document.addEventListener("visibilitychange", mark);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", mark);
    };
  }, [hasUnreadFromOther, conversationId, profile.id]);

  const otherUser = directory.find((person) => person.id === otherUserId);
  const title = otherUser?.name || "محادثة خاصة";

  // إشعار لصديقك إذا جان التطبيق مسكّر عنده
  const notifyOther = (message: PrivateMessage) => {
    if (!otherUserId) return;
    void notifyFriend(
      otherUserId,
      "message",
      `💬 ${profile.name || "رسالة جديدة"}`,
      message.content.length > 120 ? `${message.content.slice(0, 120)}…` : message.content,
      `/private-chat/${conversationId}`,
      `msg-${conversationId}`,
    );
  };

  // "يكتب الآن…" و"يسجّل صوت…": إشارات سريعة بقناة خاصة بالمحادثة (ما تنحفظ بقاعدة البيانات)
  const activityChannel = useRef<RealtimeChannel | null>(null);
  const lastActivitySent = useRef(0);
  const activityTimer = useRef<number | undefined>(undefined);
  const [otherActivity, setOtherActivity] = useState<null | "typing" | "recording">(null);

  useEffect(() => {
    if (!profile.id) return;
    const channel = supabase.channel(`activity:${conversationId}`, {
      config: { broadcast: { self: false } },
    });
    channel
      .on("broadcast", { event: "activity" }, ({ payload }) => {
        const data = payload as { from?: string; kind?: "typing" | "recording" | "stop" };
        if (!data?.from || data.from === profile.id) return;
        window.clearTimeout(activityTimer.current);
        if (data.kind === "stop" || !data.kind) {
          setOtherActivity(null);
          return;
        }
        setOtherActivity(data.kind);
        activityTimer.current = window.setTimeout(() => setOtherActivity(null), 4000);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") activityChannel.current = channel;
      });
    return () => {
      activityChannel.current = null;
      window.clearTimeout(activityTimer.current);
      setOtherActivity(null);
      void supabase.removeChannel(channel);
    };
  }, [conversationId, profile.id]);

  const sendActivity = useCallback(
    (kind: "typing" | "recording" | "stop", force = false) => {
      const channel = activityChannel.current;
      if (!channel || !profile.id) return;
      const now = Date.now();
      if (!force && now - lastActivitySent.current < 2000) return;
      lastActivitySent.current = kind === "stop" ? 0 : now;
      void channel.send({ type: "broadcast", event: "activity", payload: { from: profile.id, kind } });
    },
    [profile.id],
  );

  // أول ما توصل رسالة من صديقك نشيل "يكتب…"
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last && last.sender_id !== profile.id) setOtherActivity(null);
  }, [messages, profile.id]);

  const addMessage = (message: PrivateMessage) =>
    setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);

  // ملصق: 4 ببلاش، والباقي يحتاج ميزة الملصقات (100 نقطة)
  const sendSticker = async (sticker: Sticker) => {
    if (!sticker.free && !stickersUnlocked) {
      toast("🔒 هذا الملصق ينفتح بـ 100 نقطة من صفحة النقاط");
      navigate({ to: "/points" });
      return;
    }
    setStickersOpen(false);
    try {
      const message = await sendPrivateMessage(conversationId, stickerContent(sticker));
      addMessage(message);
      notifyOther(message);
    } catch (err) {
      console.error("تعذر إرسال الملصق:", err);
      toast.error("ما انرسل الملصق، تأكد من النت وجرّب مرة ثانية");
    }
  };

  const mediaError = (err: unknown) => {
    console.error("تعذر إرسال الوسائط:", err);
    const text = err instanceof Error ? err.message : String(err);
    toast.error(
      /bucket|not found|policy|row-level|kind|media_path|column/i.test(text)
        ? "إرسال الصور والصوت يحتاج تشغيل ملف chat-media.sql بـ Supabase أول"
        : "ما انرسلت، تأكد من النت وجرّب مرة ثانية",
    );
  };

  const sendImage = async (file: File | undefined) => {
    if (!file || uploading) return;
    if (!file.type.startsWith("image/")) {
      toast.error("اختار صورة بس");
      return;
    }
    setUploading("image");
    try {
      const blob = await compressImage(file);
      const message = await sendMediaMessage(conversationId, "image", blob, { ext: "jpg", contentType: "image/jpeg" });
      addMessage(message);
      notifyOther(message);
    } catch (err) {
      mediaError(err);
    } finally {
      setUploading(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const sendVoice = useCallback(async (voice: VoiceResult) => {
    setUploading("audio");
    try {
      const message = await sendMediaMessage(conversationId, "audio", voice.blob, {
        ext: voice.ext,
        contentType: voice.contentType,
        duration: voice.duration,
      });
      addMessage(message);
      notifyOther(message);
    } catch (err) {
      mediaError(err);
    } finally {
      setUploading(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, otherUserId, profile.name]);

  const voiceError = useCallback((text: string) => toast.error(text), []);
  const recorder = useVoiceRecorder((v) => void sendVoice(v), voiceError);
  const voiceActive = recorder.recording || recorder.starting || voiceLocked;
  // إذا خلص التسجيل (وصل الحد الأقصى أو صار خطأ) نرجع الشريط الطبيعي
  useEffect(() => {
    if (voiceLocked && !recorder.recording && !recorder.starting) setVoiceLocked(false);
  }, [voiceLocked, recorder.recording, recorder.starting]);

  const submit = async () => {
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      const message = await sendPrivateMessage(conversationId, draft);
      addMessage(message);
      setDraft("");
      sendActivity("stop", true);
      notifyOther(message);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "تعذر إرسال الرسالة");
    } finally {
      setSending(false);
    }
  };

  // أثناء تسجيل رسالة صوتية نبلّغ صديقك كل ثانيتين
  useEffect(() => {
    if (!recorder.recording) return;
    sendActivity("recording", true);
    const timer = window.setInterval(() => sendActivity("recording", true), 2500);
    return () => {
      window.clearInterval(timer);
      sendActivity("stop", true);
    };
  }, [recorder.recording, sendActivity]);

  const isBlocked = otherUserId ? relationOf(otherUserId) === "blocked" : false;

  const handleBlock = async () => {
    setDialog(null);
    if (!otherUserId) return;
    await blockUser(otherUserId);
    toast.success(`انحظر ${title}`);
    navigate({ to: "/friends" });
  };

  // البلاغ يروح لجدول user_reports بـ Supabase (supabase/reports.sql)
  const handleReport = async (reason: string, note: string, alsoBlock: boolean) => {
    if (!otherUserId) return;
    const { error: reportError } = await supabase.rpc("report_user", {
      p_reported: otherUserId,
      p_reason: reason,
      p_note: note || null,
      p_conversation: conversationId,
    });
    if (reportError) {
      console.error("تعذر إرسال البلاغ:", reportError);
      toast.error(
        reportError.message.includes("too_many_reports")
          ? "وصلت الحد اليومي للبلاغات، جرّب باچر"
          : "ما گدرنا نرسل البلاغ هسه، جرّب بعد شوية",
      );
      return;
    }
    setDialog(null);
    toast.success("وصلنا بلاغك، شكراً. راح نراجعه 🙏");
    if (alsoBlock) {
      await blockUser(otherUserId);
      navigate({ to: "/friends" });
    }
  };

  const isOnline = otherUserId ? isOnlineNow(otherUserId) : false;
  const formatTime = (iso: string) =>
    new Intl.DateTimeFormat("ar-IQ", { hour: "numeric", minute: "2-digit" }).format(new Date(iso));

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-paper">
      {/* شريط علوي مثل الواتساب: رجوع، الصورة والاسم، وزر الاتصال */}
      <header className="flex shrink-0 items-center gap-3 border-b-2 border-line bg-cream px-3 py-2.5">
        <Link
          to="/friends"
          className="grid size-9 shrink-0 place-items-center rounded-full text-xl hover:bg-ink/5"
          aria-label="رجوع"
          title="رجوع"
        >
          <span className="ltr:-scale-x-100">→</span>
        </Link>
        <div className="relative shrink-0">
          <PersonPhoto src={otherUser?.avatarUrl} name={title} className="size-10" fallbackClassName="bg-teal/20" />
          {otherUserId ? (
            <span
              className={`absolute -bottom-0.5 -start-0.5 size-3 rounded-full ring-2 ring-cream ${isOnline ? "bg-emerald-500" : "bg-red-300"}`}
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[15px] font-extrabold leading-tight">{title}</p>
          <p className={`truncate text-[11px] ${otherActivity || isOnline ? "text-emerald-600" : "text-muted-ink"}`}>
            {otherActivity === "typing"
              ? "يكتب الآن…"
              : otherActivity === "recording"
                ? "يسجّل رسالة صوتية…"
                : isOnline
                  ? "متصل الآن"
                  : formatLastSeen(otherUser?.lastSeenAt)}
          </p>
        </div>
        {otherUserId && !isBlocked ? (
          <CallMenu
            onVoice={() => void startCall(otherUserId, title)}
            onVideo={() => void startCall(otherUserId, title, true)}
          />
        ) : null}
        {otherUserId ? (
          <MoreMenu
            blocked={isBlocked}
            onReport={() => setDialog("report")}
            onBlock={() => setDialog("block")}
            onUnblock={() => void unblockUser(otherUserId)}
          />
        ) : null}
      </header>

      {dialog === "report" ? (
        <ReportDialog
          name={title}
          alreadyBlocked={isBlocked}
          onClose={() => setDialog(null)}
          onSubmit={handleReport}
        />
      ) : null}
      {dialog === "block" ? (
        <BlockConfirm name={title} onClose={() => setDialog(null)} onConfirm={() => void handleBlock()} />
      ) : null}

      {isBlocked ? (
        <p className="shrink-0 border-b-2 border-line bg-red-50 px-4 py-2 text-center text-[13px] font-bold text-red-700">
          حظرت هذا الشخص. ما يكدر يراسلك أو يتصل بيك.
        </p>
      ) : null}

      {/* الرسائل */}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-4">
        {loading ? <p className="text-center text-sm text-muted-ink">جاري تحميل الرسائل...</p> : null}
        {!loading && messages.length === 0 ? (
          <p className="text-center text-sm text-muted-ink">لا توجد رسائل بعد. سلّم على صديقك 👋</p>
        ) : null}
        {messages.map((message) => {
          const mine = message.sender_id === profile.id;
          const sticker = message.kind === "image" || message.kind === "audio" ? null : stickerFromContent(message.content);
          if (sticker) {
            return (
              <div key={message.id} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
                <div className="flex flex-col items-center">
                  <StickerArt sticker={sticker} size={110} />
                  <p className="mt-0.5 text-[10px]">
                    <span className="opacity-60">{formatTime(message.created_at)}</span>
                    {mine ? (
                      <span className={`ms-1 font-bold ${message.read_at ? "text-sky-500" : "opacity-60"}`}>
                        {message.read_at ? "✓✓" : "✓"}
                      </span>
                    ) : null}
                  </p>
                </div>
              </div>
            );
          }
          return (
            <div key={message.id} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[80%] rounded-2xl text-sm shadow-sm ${
                  message.kind === "image" ? "p-1" : "px-3 py-1.5"
                } ${
                  mine ? "rounded-ss-sm bg-emerald-100 text-emerald-950" : "rounded-se-sm border border-line bg-cream"
                }`}
              >
                {message.kind === "image" && message.media_path ? (
                  <ImageBubble path={message.media_path} />
                ) : message.kind === "audio" && message.media_path ? (
                  <AudioBubble path={message.media_path} duration={message.media_duration} mine={mine} />
                ) : (
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                )}
                <p className={`mt-0.5 text-end text-[10px] ${message.kind === "image" ? "px-2 pb-0.5" : ""}`}>
                  <span className="opacity-60">{formatTime(message.created_at)}</span>
                  {mine ? (
                    <span
                      className={`ms-1 font-bold ${message.read_at ? "text-sky-500" : "opacity-60"}`}
                      title={message.read_at ? "قُرئت" : "أُرسلت"}
                    >
                      {message.read_at ? "✓✓" : "✓"}
                    </span>
                  ) : null}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error ? <p className="px-3 py-1 text-sm text-coral">{error}</p> : null}

      {uploading ? (
        <p className="px-3 py-1 text-center text-[12px] text-muted-ink">
          {uploading === "image" ? "📷 دا نرسل الصورة…" : "🎤 دا نرسل الرسالة الصوتية…"}
        </p>
      ) : null}

      {/* لوحة الملصقات */}
      {stickersOpen && !isBlocked ? (
        <div className="shrink-0 border-t-2 border-line bg-paper px-3 py-3">
          <div className="mb-2 flex items-center justify-between text-[12px] font-bold text-muted-ink">
            <span>ملصقات عراقية</span>
            {!stickersUnlocked ? <span>🔒 الباقي بـ 100 نقطة</span> : null}
          </div>
          <div className="grid max-h-64 grid-cols-4 gap-2 overflow-y-auto">
            {STICKERS.map((s) => {
              const locked = !s.free && !stickersUnlocked;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => void sendSticker(s)}
                  className={`relative grid place-items-center rounded-2xl p-1 transition-transform active:scale-95 ${locked ? "opacity-50" : ""}`}
                  aria-label={locked ? `${s.label} (مقفول)` : `إرسال ${s.label}`}
                >
                  <StickerArt sticker={s} size={64} />
                  {locked ? <span className="absolute end-1 top-1 text-sm">🔒</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* مربع الكتابة */}
      <div className="relative flex shrink-0 items-end gap-2 border-t-2 border-line bg-cream px-3 py-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => void sendImage(event.target.files?.[0])}
        />

        {voiceActive ? (
          // شريط التسجيل مثل الواتساب
          <div className="flex min-h-11 min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-3xl border-2 border-coral/50 bg-paper px-3">
            <span className="size-2.5 animate-pulse rounded-full bg-red-500" />
            <span className="font-mono text-sm font-bold">{formatDuration(recorder.elapsed)}</span>
            <span className={`min-w-0 flex-1 truncate text-[12px] ${cancelHint ? "font-bold text-coral" : "text-muted-ink"}`}>
              {!recorder.recording
                ? "جاري تشغيل المايك…"
                : voiceLocked
                  ? "ديسجّل…"
                  : cancelHint
                    ? "شيل إصبعك حتى تلغي ✕"
                    : "اسحب للجنب حتى تلغي"}
            </span>
            {voiceLocked && (
              <button
                type="button"
                onClick={() => {
                  recorder.stop(false);
                  setVoiceLocked(false);
                  toast("انلغت الرسالة الصوتية");
                }}
                className="grid size-8 shrink-0 place-items-center rounded-full text-base text-coral hover:bg-ink/5"
                aria-label="إلغاء التسجيل"
                title="إلغاء التسجيل"
              >
                ✕
              </button>
            )}
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setStickersOpen((v) => !v)}
              disabled={loading || isBlocked}
              className={`grid size-11 shrink-0 place-items-center rounded-full text-xl hover:bg-ink/5 disabled:opacity-40 ${stickersOpen ? "bg-ink/10" : "text-muted-ink"}`}
              aria-label="ملصقات"
              title="ملصقات"
              aria-expanded={stickersOpen}
            >
              😀
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || uploading !== null}
              className="grid size-11 shrink-0 place-items-center rounded-full text-xl text-muted-ink hover:bg-ink/5 disabled:opacity-40"
              aria-label="إرسال صورة"
              title="إرسال صورة"
            >
              📎
            </button>
            <textarea
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                if (event.target.value.trim()) sendActivity("typing");
                else sendActivity("stop", true);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void submit();
                }
              }}
              rows={1}
              disabled={sending || loading}
              placeholder="اكتب رسالة..."
              className="max-h-32 min-h-11 flex-1 resize-none rounded-3xl border-2 border-line bg-paper px-4 py-2.5 text-sm outline-none"
            />
          </>
        )}

        {draft.trim() && !voiceActive ? (
          <button
            type="button"
            onClick={() => void submit()}
            disabled={sending || loading}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-emerald-500 text-lg text-white disabled:opacity-40"
            aria-label="إرسال"
            title="إرسال"
          >
            <span className="rtl:-scale-x-100">➤</span>
          </button>
        ) : (
          voiceLocked ? (
          // التسجيل مقفول: هذا الزر يرسل
          <button
            type="button"
            onClick={() => {
              recorder.stop(true);
              setVoiceLocked(false);
            }}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-emerald-500 text-lg text-white"
            aria-label="إرسال الرسالة الصوتية"
            title="إرسال الرسالة الصوتية"
          >
            <span className="rtl:-scale-x-100">➤</span>
          </button>
        ) : (
          // اضغط مطوّل وسجّل، شيل إصبعك يرسل، اسحب للجنب يلغي
          // ضغطة سريعة: يبقى يسجّل (مقفول) وترسل بزر ➤
          <button
            type="button"
            disabled={loading || uploading !== null}
            onPointerDown={(e) => {
              e.preventDefault();
              try {
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch {
                /* */
              }
              micStartX.current = e.clientX;
              micPressAt.current = Date.now();
              setCancelHint(false);
              void recorder.start();
            }}
            onPointerMove={(e) => {
              if (!recorder.recording && !recorder.starting) return;
              setCancelHint(Math.abs(e.clientX - micStartX.current) > 90);
            }}
            onPointerUp={(e) => {
              const cancel = Math.abs(e.clientX - micStartX.current) > 90;
              setCancelHint(false);
              if (cancel) {
                recorder.stop(false);
                toast("انلغت الرسالة الصوتية");
                return;
              }
              const quickTap = Date.now() - micPressAt.current < 500;
              // ضغطة سريعة، أو المايك بعده ما اشتغل: نخلي التسجيل يكمل
              if (quickTap || !recorder.recording) setVoiceLocked(true);
              else recorder.stop(true);
            }}
            onPointerCancel={() => {
              // أندرويد أحياناً يقطع اللمسة (مثلاً لما يطلب إذن المايك): ما نلغي، نقفل التسجيل
              setCancelHint(false);
              setVoiceLocked(true);
            }}
            onContextMenu={(e) => e.preventDefault()}
            className={`grid size-11 shrink-0 touch-none select-none place-items-center rounded-full text-lg text-white transition-transform disabled:opacity-40 ${
              recorder.recording ? "scale-125 bg-red-500" : "bg-emerald-500"
            }`}
            aria-label="اضغط وسجّل رسالة صوتية"
            title="اضغط وسجّل رسالة صوتية"
          >
            🎤
          </button>
        )
        )}
      </div>
    </div>
  );
}
