import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Phone, Video } from "lucide-react";
import { createFileRoute, Link } from "@tanstack/react-router";
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
  sendPrivateMessage,
  subscribeToPrivateMessages,
  type PrivateMessage,
} from "@/lib/private-chat";
import { supabase } from "@/lib/supabase";

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

function PrivateChatPage() {
  const { conversationId } = Route.useParams();
  const { directory, profile } = useFriends();
  const { startCall } = useCall();
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
    const unsubscribe = subscribeToPrivateMessages(conversationId, (message) => {
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
    });

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

  const addMessage = (message: PrivateMessage) =>
    setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);

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
      notifyOther(message);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "تعذر إرسال الرسالة");
    } finally {
      setSending(false);
    }
  };

  const isOnline = otherUser?.status === "online";
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
          <div className="grid size-10 place-items-center rounded-full bg-teal/20 font-display font-bold">
            {title.charAt(0)}
          </div>
          {isOnline ? (
            <span className="absolute -bottom-0.5 -start-0.5 size-3 rounded-full bg-emerald-500 ring-2 ring-cream" />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[15px] font-extrabold leading-tight">{title}</p>
          <p className={`truncate text-[11px] ${isOnline ? "text-emerald-600" : "text-muted-ink"}`}>
            {isOnline ? "متصل الآن" : otherUser?.handle || ""}
          </p>
        </div>
        {otherUserId ? (
          <CallMenu
            onVoice={() => void startCall(otherUserId, title)}
            onVideo={() => void startCall(otherUserId, title, true)}
          />
        ) : null}
      </header>

      {/* الرسائل */}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-4">
        {loading ? <p className="text-center text-sm text-muted-ink">جاري تحميل الرسائل...</p> : null}
        {!loading && messages.length === 0 ? (
          <p className="text-center text-sm text-muted-ink">لا توجد رسائل بعد. سلّم على صديقك 👋</p>
        ) : null}
        {messages.map((message) => {
          const mine = message.sender_id === profile.id;
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
                <p className={`mt-0.5 text-end text-[10px] opacity-60 ${message.kind === "image" ? "px-2 pb-0.5" : ""}`}>
                  {formatTime(message.created_at)}
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
              onChange={(event) => setDraft(event.target.value)}
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
