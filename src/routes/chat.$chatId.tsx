import { createFileRoute } from "@tanstack/react-router";
import { ChatView } from "@/components/chat/ChatView";

export const Route = createFileRoute("/chat/$chatId")({
  head: () => ({
    meta: [
      { title: "المحادثة — القبة" },
      { name: "description", content: "تابع محادثتك مع المساعد الذكي داخل القبة." },
      { property: "og:title", content: "المحادثة — القبة" },
      {
        property: "og:description",
        content: "تابع محادثتك مع المساعد الذكي داخل القبة.",
      },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const { chatId } = Route.useParams();
  return <ChatView chatId={chatId} />;
}
