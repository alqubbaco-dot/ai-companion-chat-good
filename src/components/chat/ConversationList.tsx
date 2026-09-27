import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useChatStore } from "@/lib/chat-store";
import { useI18n } from "@/lib/i18n";

export function ConversationList({ activeId }: { activeId?: string | undefined }) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { conversations, createConversation, deleteConversation, renameConversation } =
    useChatStore();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);
    if (!q) return sorted;
    return sorted.filter((c) => (c.title || "").toLowerCase().includes(q));
  }, [conversations, query]);

  const formatTime = (value: number) =>
    new Intl.DateTimeFormat(lang === "ar" ? "ar" : "en", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));

  return (
    <section className="hidden w-80 shrink-0 flex-col border-e-2 border-line bg-cream lg:flex">
      <div className="p-4 pb-3">
        <div className="flex gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-2xl border-2 border-line bg-paper px-3 py-2">
            <span className="text-base">🔍</span>
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
            aria-label={t("newChat")}
            className="grid size-10 shrink-0 place-items-center rounded-2xl border-2 border-line bg-butter text-lg text-butter-ink"
          >
            ＋
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-3">
        {filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-[13px] text-muted-ink">{t("noChats")}</p>
        ) : (
          filtered.map((conversation) => {
            const isActive = conversation.id === activeId;
            const last = conversation.messages[conversation.messages.length - 1];
            return (
              <div
                key={conversation.id}
                className={`group animate-rise rounded-2xl p-3 transition-colors ${
                  isActive
                    ? "border-2 border-line bg-butter/40"
                    : "border-2 border-transparent hover:bg-ink/5"
                }`}
              >
                <Link
                  to="/chat/$chatId"
                  params={{ chatId: conversation.id }}
                  className="block"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">
                      {conversation.title || t("newChat")}
                    </p>
                    <span className="shrink-0 font-mono text-[11px] text-muted-ink">
                      {formatTime(conversation.updatedAt)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-[12px] text-muted-ink">
                    {last
                      ? `«${last.content
                          .replace(/```[\s\S]*?```/g, " ")
                          .replace(/[#*`>|-]/g, "")
                          .replace(/\s+/g, " ")
                          .trim()
                          .slice(0, 46)}…»`
                      : t("emptyChatBody")}
                  </p>
                </Link>
                <div className="mt-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => {
                      const next = window.prompt(t("rename"), conversation.title);
                      if (next) renameConversation(conversation.id, next);
                    }}
                    className="rounded-full border-2 border-line px-2.5 py-0.5 text-[11px]"
                  >
                    ✎ {t("rename")}
                  </button>
                  <button
                    onClick={() => {
                      if (!window.confirm(t("deleteChatConfirm"))) return;
                      deleteConversation(conversation.id);
                      if (isActive) navigate({ to: "/" });
                    }}
                    className="rounded-full border-2 border-line px-2.5 py-0.5 text-[11px] text-coral"
                  >
                    ✕ {t("delete")}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
