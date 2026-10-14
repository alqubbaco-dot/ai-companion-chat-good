import { Link } from "@tanstack/react-router";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { useChatStore } from "@/lib/chat-store";
import { useFriends } from "@/lib/friends-store";

// الشريط العلوي للموبايل: الشعار والاسم، وأزرار اللغة والوضع الليلي والإعدادات
export function MobileTopBar() {
  const { t, lang, setLang } = useI18n();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="shrink-0 border-b border-line bg-cream/90 backdrop-blur md:hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <img
            src="/icons/logo.webp"
            alt=""
            width={32}
            height={32}
            className="size-8 shrink-0 rounded-[30%]"
            draggable={false}
          />
          <span className="truncate font-display text-base font-extrabold">{t("appName")}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => setLang(lang === "ar" ? "en" : "ar")}
            aria-label="language"
            className="grid size-9 place-items-center rounded-full font-mono text-[11px] font-semibold text-muted-ink transition-colors hover:bg-ink/5"
          >
            {lang === "ar" ? "EN" : "ع"}
          </button>
          <button
            onClick={toggleTheme}
            aria-label="theme"
            className="grid size-9 place-items-center rounded-full text-base text-muted-ink transition-colors hover:bg-ink/5"
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>
          <Link
            to="/points"
            aria-label={t("navPoints")}
            className="grid size-9 place-items-center rounded-full text-base text-muted-ink transition-colors hover:bg-ink/5"
            activeProps={{
              className: "grid size-9 place-items-center rounded-full text-base bg-butter/15 text-butter",
            }}
          >
            ⭐
          </Link>
          <Link
            to="/settings"
            aria-label={t("navSettings")}
            className="grid size-9 place-items-center rounded-full text-base text-muted-ink transition-colors hover:bg-ink/5"
            activeProps={{
              className: "grid size-9 place-items-center rounded-full text-base bg-butter/15 text-butter",
            }}
          >
            ⚙️
          </Link>
        </div>
      </div>
    </div>
  );
}

type TabItem = {
  to: string;
  emoji: string;
  labelKey: TranslationKey;
  badge?: number;
};

// الشريط السفلي للموبايل، مثل تطبيقات المراسلة
export function MobileBottomNav() {
  const { t } = useI18n();
  const { conversations } = useChatStore();
  const { incoming } = useFriends();

  const items: TabItem[] = [
    { to: "/", emoji: "🤖", labelKey: "tabAssistant" },
    { to: "/chats", emoji: "💬", labelKey: "tabChats", badge: conversations.length || undefined },
    { to: "/friends", emoji: "👥", labelKey: "tabFriends" },
    { to: "/requests", emoji: "🔔", labelKey: "tabRequests", badge: incoming.length || undefined },
    { to: "/account", emoji: "👤", labelKey: "tabAccount" },
  ];

  return (
    <nav className="pb-safe shrink-0 border-t border-line bg-cream/95 backdrop-blur md:hidden">
      <ul className="grid grid-cols-5">
        {items.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              className="group relative flex flex-col items-center gap-0.5 px-1 pt-2 pb-1 text-muted-ink"
              activeProps={{
                className:
                  "group relative flex flex-col items-center gap-0.5 px-1 pt-2 pb-1 text-butter font-semibold",
              }}
            >
              <span className="grid h-7 w-12 place-items-center rounded-full text-lg leading-none transition-colors group-[.text-butter]:bg-butter/15">
                {item.emoji}
              </span>
              <span className="text-[10.5px] leading-tight">{t(item.labelKey)}</span>
              {item.badge ? (
                <span
                  className={`absolute top-1 start-[calc(50%+6px)] min-w-4 rounded-full px-1 text-center font-mono text-[9px] leading-4 ${
                    item.to === "/requests" ? "bg-coral text-coral-ink" : "bg-ink/15 text-ink"
                  }`}
                >
                  {item.badge}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// للتوافق مع أي استيراد قديم
export const MobileNav = MobileTopBar;
