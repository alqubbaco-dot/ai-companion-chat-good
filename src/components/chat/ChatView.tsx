import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useChatStore } from "@/lib/chat-store";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { Composer } from "./Composer";
import { MessageBubble, TypingBubble } from "./MessageBubble";
import { ConversationList } from "./ConversationList";
import { Avatar } from "@/components/app/Avatar";

export function ChatView({ chatId }: { chatId?: string }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { getConversation, createConversation, sendMessage, streamingId } = useChatStore();
  const conversation = chatId ? getConversation(chatId) : undefined;
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages = conversation?.messages ?? [];
  const isStreaming = streamingId === chatId;
  const lastMessage = messages[messages.length - 1];
  const awaitingFirstToken =
    isStreaming && lastMessage?.role === "assistant" && lastMessage.content === "";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, lastMessage?.content]);

  // تحديث دالة الاستقبال لتلتقط نص الرسالة ومعيار الفكاهة (isFunny) وتمريرهما معاً
  const handleSend = (text: string, isFunny: boolean) => {
    if (chatId && conversation) {
      sendMessage(chatId, text, isFunny);
      return;
    }
    const created = createConversation();
    sendMessage(created.id, text, isFunny);
    navigate({ to: "/chat/\$chatId", params: { chatId: created.id } });
  };

  const handleAudioCall = () => {
    if (conversation?.title) {
      toast.info(`📞 جاري بدء الاتصال الصوتي مع ${conversation.title}... (جاهز للربط السحابي)`);
    }
  };

  const handleVideoCall = () => {
    if (conversation?.title) {
      toast.info(`📹 جاري بدء اتصال الفيديو مع ${conversation.title}... (جاهز للربط السحابي)`);
    }
  };

  const chatTitle = conversation?.title || t("assistant");
  const isFriendChat = Boolean(conversation?.title && conversation.title !== t("assistant"));

  return (
    <>
      <ConversationList activeId={chatId} />
      <main className="flex min-w-0 flex-1 flex-col bg-paper">
        <header className="flex h-16 shrink-0 items-center gap-4 border-b border-line bg-cream/80 px-4 backdrop-blur sm:px-6">
          {isFriendChat && (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleAudioCall}
                className="grid size-9 place-items-center rounded-full text-muted-ink hover:bg-ink/5 transition-colors cursor-pointer"
                title="اتصال صوتي"
              >
                <span className="text-sm">📞</span>
              </button>
              <button
                onClick={handleVideoCall}
                className="grid size-9 place-items-center rounded-full text-muted-ink hover:bg-ink/5 transition-colors cursor-pointer"
                title="اتصال فيديو"
              >
                <span className="text-sm">📹</span>
              </button>
            </div>
          )}

          <div className="flex items-center gap-3 min-w-0 flex-1 justify-end md:justify-start">
            <div className="min-w-0 text-right md:text-left">
              <p className="font-display text-base font-extrabold leading-none text-ink truncate">
                {chatTitle}
              </p>
              <p className="mt-1 text-[11px] font-semibold text-teal">
                {t("assistantStatus")}
              </p>
            </div>
            <Avatar bot={!isFriendChat} name={chatTitle} />
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
            {messages.length === 0 ? (
              <div className="mt-10 animate-rise px-6 py-10 text-center">
                <Avatar bot={!isFriendChat} name={chatTitle} size="xl" className="mx-auto shadow-lg" />
                <h2 className="mt-4 font-display text-xl font-extrabold text-ink">
                  {isFriendChat ? `${t("emptyChatTitle")} ${chatTitle}` : t("emptyChatTitle")}
                </h2>
                <p className="mt-1 text-[13px] text-muted-ink">
                  {isFriendChat ? "اكتب أول رسالة وابدأ السوالف 👋" : t("emptyChatBody")}
                </p>
              </div>
            ) : (
              messages.map((message) =>
                message.role === "assistant" && message.content === "" ? null : (
                  <MessageBubble key={message.id} message={message} />
                ),
              )
            )}
            {awaitingFirstToken ? <TypingBubble /> : null}
            <div ref={bottomRef} />
          </div>
        </div>

        <Composer onSend={handleSend} disabled={isStreaming} focusKey={chatId ?? "new"} />
      </main>
    </>
  );
}
