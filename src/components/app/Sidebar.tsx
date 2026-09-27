import { Link } from "@tanstack/react-router";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { useChatStore } from "@/lib/chat-store";
import { useFriends } from "@/lib/friends-store";

type NavItem = {
  to: string;
  emoji: string;
  labelKey: TranslationKey;
  badge?: number | undefined;
  badgeTone?: "muted" | "alert" | undefined;
};

export function Sidebar() {
  const { t, lang, setLang } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const { conversations } = useChatStore();
  const { incoming, profile } = useFriends();

  const items: NavItem[] = [
    { to: "/", emoji: "🤖", labelKey: "navNewChat" },
    {
      to: "/chats",
      emoji: "💬",
      labelKey: "navChats",
      badge: conversations.length || undefined,
      badgeTone: "muted",
    },
    { to: "/friends", emoji: "👥", labelKey: "navFriends" },
    {
      to: "/requests",
      emoji: "🔔",
      labelKey: "navRequests",
      badge: incoming.length || undefined,
      badgeTone: "alert",
    },
    { to: "/account", emoji: "👤", labelKey: "navAccount" },
    { to: "/settings", emoji: "⚙️", labelKey: "navSettings" },
  ];

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-e-2 border-line bg-cream md:flex">
      <div className="px-5 pb-3 pt-6 border-b border-line/10">
        <div className="inline-flex items-center gap-2 rounded-2xl bg-ink px-3 py-2 text-cream">
          <span className="font-mono text-[10px] text-butter">AI</span>
          <span className="font-display text-lg font-extrabold leading-none">
            {t("appName")}
          </span>
        </div>
        <p className="mt-3 text-[11px] leading-snug text-muted-ink">{t("appTagline")}</p>
        
        {/* تم نقل التوقيع البرمجي هنا في الأعلى ليكون ظاهراً دائماً فوق الأزرار وواضحاً لعينك */}
        <div className="mt-3 pt-2 border-t border-line/20 select-none">
          <p className="font-mono text-[10px] tracking-tight text-muted-ink">
            Developed by: <span className="font-bold text-ink">Jabbar Hassan Mahmoud</span>
          </p>
        </div>
      </div>

      <div className="mb-3 mt-3 flex items-center gap-2 px-4">
        <div className="flex flex-1 rounded-full border-2 border-line p-0.5">
          {(["ar", "en"] as const).map((code) => (
            <button
              key={code}
              onClick={() => setLang(code)}
              className={`flex-1 rounded-full px-2 py-1 font-mono text-[11px] font-semibold transition-colors ${
                lang === code ? "bg-ink text-cream" : "text-muted-ink hover:bg-ink/5"
              }`}
            >
              {code === "ar" ? "ع" : "EN"}
            </button>
          ))}
        </div>
        <button
          onClick={toggleTheme}
          aria-label="theme"
          className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-line text-sm transition-colors hover:bg-butter"
        >
          {theme === "dark" ? "☀" : "☾"}
        </button>
      </div>

      <nav className="space-y-1 px-3">
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.to === "/" }}
            className="flex items-center gap-3 rounded-2xl border-2 border-transparent px-4 py-3 text-muted-ink transition-colors hover:bg-ink/5"
            activeProps={{
              className:
                "flex items-center gap-3 rounded-2xl border-2 border-line bg-butter px-4 py-3 font-semibold text-butter-ink",
            }}
          >
            <span className="text-lg leading-none">{item.emoji}</span>
            <span className="text-[15px]">{t(item.labelKey)}</span>
            {item.badge ? (
              <span
                className={`ms-auto rounded-full px-2 py-0.5 font-mono text-[11px] ${
                  item.badgeTone === "alert"
                    ? "bg-coral text-coral-ink"
                    : "bg-ink/10 text-ink"
                }`}
              >
                {item.badge}
              </span>
            ) : null}
          </Link>
        ))}
      </nav>

      <div className="mt-auto p-4">
        <Link
          to="/account"
          className="flex animate-pop items-center gap-3 rounded-2xl border-2 border-line bg-cream p-3 transition-colors hover:bg-ink/5"
        >
          <div className="grid size-10 place-items-center rounded-full bg-teal/20 font-display font-bold">
            {profile.name.trim().charAt(0) || "؟"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{profile.name}</p>
            <p className="truncate text-[11px] text-muted-ink">{profile.handle}</p>
          </div>
        </Link>
      </div>
    </aside>
  );
}
