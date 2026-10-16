import { createFileRoute } from "@tanstack/react-router";
import { ChatView } from "@/components/chat/ChatView";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "محادثة جديدة — القبة" },
      {
        name: "description",
        content: "ابدأ محادثة جديدة مع المساعد الذكي: ردود فورية، تنسيق كود، نسخ ومشاركة.",
      },
      { property: "og:title", content: "محادثة جديدة — القبة" },
      {
        property: "og:description",
        content: "ابدأ محادثة جديدة مع المساعد الذكي: ردود فورية، تنسيق كود، نسخ ومشاركة.",
      },
    ],
  }),
  component: NewChatPage,
});

function NewChatPage() {
  // فتح المسار وعرض المكون لتتولى بوابة الحماية الكلية الـ root حظرها التلقائي وعرض حقول التسجيل
  return <ChatView />;
}
