import { useMemo, useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PageBody } from "@/components/app/AppShell";
import { useChatStore } from "@/lib/chat-store";
import { useI18n } from "@/lib/i18n";
import { useFriends } from "@/lib/friends-store";

export const Route = createFileRoute("/chats")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      friendId: search.friendId as string | undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "محادثاتي — الغباء الصناعي" },
      {
        name: "description",
        content: "كل محادثاتك في مكان واحد: بحث، إعادة تسمية، حذف ومتابعة.",
      },
      { property: "og:title", content: "محادثاتي — الغباء الصناعي" },
      {
        property: "og:description",
        content: "كل محادثاتك في مكان واحد: بحث، إعادة تسمية، حذف ومتابعة.",
      },
    ],
  }),
  component: ChatsPage,
});

function ChatsPage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { friendId } = Route.useSearch();
  const { friends } = useFriends();
  const { conversations, createConversation } = useChatStore();
  
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const { renameConversation, deleteConversation } = useChatStore();

  // نظام ذكي مثل الواتساب: بمجرد الدخول ومعه معرّف صديق، يتم فتح غرفته الخاصة أو إنشاؤها فوراً
  useEffect(() => {
    if (friendId) {
      const targetFriend = friends.find((f) => f.id === friendId);
      if (targetFriend) {
        const friendName = lang === "ar" ? targetFriend.name : targetFriend.nameEn;
        
        // البحث عن محادثة سابقة تحمل اسم الصديق
        const existingChat = conversations.find(
          (c) => c.title === friendName || c.title === targetFriend.name || c.title === targetFriend.nameEn
        );

        if (existingChat) {
          navigate({ to: "/chat/$chatId", params: { chatId: existingChat.id } });
        } else {
          // إذا كانت أول مرة، ينشئ غرفة مخصصة تحمل اسم الصديق فوراً في الأعلى
          const newChat = createConversation();
          renameConversation(newChat.id, friendName);
          navigate({ to: "/chat/$chatId", params: { chatId: newChat.id } });
        }
      }
    }
  }, [friendId, friends, conversations, navigate, createConversation, renameConversation, lang]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);
    if (!q) return sorted;
    return sorted.filter((c) => (c.title || "").toLowerCase().includes(q));
  }, [conversations, query]);

  const formatDate = (value: number) =>
    new Intl.DateTimeFormat(lang === "ar" ? "ar" : "en", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));

  return (
    <PageBody title={t("chatsTitle")} subtitle={t("chatsSubtitle")}>
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <div className="flex gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-2xl border-2 border-line bg-cream px-3 py-2">
            <span>🔍</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("searchChats")}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-ink/70"
            />
          </div>
          <button
            onClick={() => {
              const conversation = createConversation();
              navigate({ to: "/chat/$chatId", params: { chatId: conversation.id } });
            }}
            className="rounded-2xl border-2 border-line bg-butter px-4 py-2 text-sm font-semibold text-butter-ink"
          >
            ＋ {t("newChat")}
          </button>
        </div>

        {filtered.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-line bg-cream/60 px-4 py-10 text-center text-sm text-muted-ink">
            {t("noChats")}
          </p>
        ) : (
          <div className="space-y-2">
            {filtered.map((conversation) => (
              <div
                key={conversation.id}
                className="animate-rise rounded-2xl border-2 border-line bg-cream p-4"
              >
                {editingId === conversation.id ? (
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          renameConversation(conversation.id, draft);
                          setEditingId(null);
                        }
                      }}
                      className="flex-1 rounded-xl border-2 border-line bg-paper px-3 py-1.5 text-sm outline-none"
                    />
                    <button
                      onClick={() => {
                        renameConversation(conversation.id, draft);
                        setEditingId(null);
                      }}
                      className="rounded-xl border-2 border-line bg-teal px-3 py-1.5 text-[12px] font-semibold text-teal-ink"
                    >
                      {t("save")}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded-xl border-2 border-line px-3 py-1.5 text-[12px] font-semibold"
                    >
                      {t("cancel")}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {conversation.title || t("newChat")}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-ink">
                        {formatDate(conversation.updatedAt)} ·{" "}
                        {conversation.messages.length} 💬
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Link
                        to="/chat/$chatId"
                        params={{ chatId: conversation.id }}
                        className="rounded-full border-2 border-line bg-butter px-3 py-1.5 text-[12px] font-semibold text-butter-ink"
                      >
                        {t("open")}
                      </Link>
                      <button
                        onClick={() => {
                          setEditingId(conversation.id);
                          setDraft(conversation.title);
                        }}
                        className="rounded-full border-2 border-line px-3 py-1.5 text-[12px] font-semibold"
                      >
                        ✎ {t("rename")}
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(t("deleteChatConfirm"))) {
                            deleteConversation(conversation.id);
                          }
                        }}
                        className="rounded-full border-2 border-line px-3 py-1.5 text-[12px] font-semibold text-coral"
                      >
                        🗑 {t("delete")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </PageBody>
  );
}
