import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useFriends } from "@/lib/friends-store";
import { useCall } from "@/lib/call-store";
import { notifyFriend } from "@/lib/push-client";
import {
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
  const bottomRef = useRef<HTMLDivElement>(null);

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

  const submit = async () => {
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      const message = await sendPrivateMessage(conversationId, draft);
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      setDraft("");
      // إشعار لصديقك إذا جان التطبيق مسكّر عنده
      if (otherUserId) {
        void notifyFriend(
          otherUserId,
          "message",
          `💬 ${profile.name || "رسالة جديدة"}`,
          message.content.length > 120 ? `${message.content.slice(0, 120)}…` : message.content,
          `/private-chat/${conversationId}`,
          `msg-${conversationId}`,
        );
      }
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
          <button
            type="button"
            onClick={() => void startCall(otherUserId, title)}
            className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-500 text-lg text-white shadow-sm transition-transform active:scale-95"
            title="اتصال صوتي"
            aria-label="اتصال صوتي"
          >
            📞
          </button>
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
                className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-sm shadow-sm ${
                  mine ? "rounded-ss-sm bg-emerald-100 text-emerald-950" : "rounded-se-sm border border-line bg-cream"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
                <p className="mt-0.5 text-end text-[10px] opacity-60">{formatTime(message.created_at)}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error ? <p className="px-3 py-1 text-sm text-coral">{error}</p> : null}

      {/* مربع الكتابة */}
      <div className="flex shrink-0 items-end gap-2 border-t-2 border-line bg-cream px-3 py-2">
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
        <button
          type="button"
          onClick={() => void submit()}
          disabled={sending || loading || !draft.trim()}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-emerald-500 text-lg text-white disabled:opacity-40"
          aria-label="إرسال"
          title="إرسال"
        >
          <span className="rtl:-scale-x-100">➤</span>
        </button>
      </div>
    </div>
  );
}
