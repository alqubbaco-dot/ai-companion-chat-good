import { createFileRoute } from "@tanstack/react-router";
import { ChatView } from "@/components/chat/ChatView";

export const Route = createFileRoute("/chat/$chatId")({
  head: () => ({
    meta: [
      { title: "المحادثة — الغباء الصناعي" },
      { name: "description", content: "تابع محادثتك مع المساعد الذكي داخل الغباء الصناعي." },
      { property: "og:title", content: "المحادثة — الغباء الصناعي" },
      {
        property: "og:description",
        content: "تابع محادثتك مع المساعد الذكي داخل الغباء الصناعي.",
      },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const { chatId } = Route.useParams();
  return <ChatView chatId={chatId} />;
}
