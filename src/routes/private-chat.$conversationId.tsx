import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageBody } from "@/components/app/AppShell";
import { useFriends } from "@/lib/friends-store";
import {
  getPrivateConversation,
  getPrivateMessages,
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
  }, [messages]);

  const otherUser = directory.find((person) => person.id === otherUserId);
  const title = otherUser?.name || "محادثة خاصة";

  const submit = async () => {
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      const message = await sendPrivateMessage(conversationId, draft);
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      setDraft("");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "تعذر إرسال الرسالة");
    } finally {
      setSending(false);
    }
  };

  return (
    <PageBody title={title} subtitle="محادثة خاصة بين صديقين">
      <div className="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col rounded-3xl border-2 border-line bg-cream p-4">
        <div className="mb-4 flex items-center justify-between border-b-2 border-line pb-3">
          <span className="text-sm font-semibold">{otherUser?.handle || otherUserId}</span>
          <Link to="/friends" className="text-sm text-teal">العودة للأصدقاء</Link>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-3">
          {loading ? <p className="text-center text-sm text-muted-ink">جاري تحميل الرسائل...</p> : null}
          {!loading && messages.length === 0 ? (
            <p className="text-center text-sm text-muted-ink">لا توجد رسائل بعد.</p>
          ) : null}
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.sender_id === profile.id ? "justify-start" : "justify-end"}`}>
              <p className="max-w-[80%] rounded-2xl border-2 border-line bg-paper px-3 py-2 text-sm">{message.content}</p>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {error ? <p className="py-2 text-sm text-coral">{error}</p> : null}
        <div className="mt-3 flex gap-2 border-t-2 border-line pt-3">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submit();
              }
            }}
            disabled={sending || loading}
            placeholder="اكتب رسالة خاصة..."
            className="min-h-11 flex-1 resize-none rounded-2xl border-2 border-line bg-paper px-3 py-2 text-sm outline-none"
          />
          <button type="button" onClick={() => void submit()} disabled={sending || loading || !draft.trim()} className="rounded-2xl bg-ink px-4 text-cream disabled:opacity-40">
            إرسال
          </button>
        </div>
      </div>
    </PageBody>
  );
}