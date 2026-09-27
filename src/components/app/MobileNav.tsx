import { Link } from "@tanstack/react-router";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

const items: { to: string; emoji: string; labelKey: TranslationKey }[] = [
  { to: "/", emoji: "🤖", labelKey: "navNewChat" },
  { to: "/chats", emoji: "💬", labelKey: "navChats" },
  { to: "/friends", emoji: "👥", labelKey: "navFriends" },
  { to: "/requests", emoji: "🔔", labelKey: "navRequests" },
  { to: "/account", emoji: "👤", labelKey: "navAccount" },
  { to: "/settings", emoji: "⚙️", labelKey: "navSettings" },
];

export function MobileNav() {
  const { t, lang, setLang } = useI18n();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="shrink-0 border-b-2 border-line bg-cream md:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="font-display text-base font-extrabold">{t("appName")}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLang(lang === "ar" ? "en" : "ar")}
            className="rounded-full border-2 border-line px-3 py-1 font-mono text-[11px] font-semibold"
          >
            {lang === "ar" ? "EN" : "ع"}
          </button>
          <button
            onClick={toggleTheme}
            aria-label="theme"
            className="grid size-8 place-items-center rounded-full border-2 border-line text-xs"
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-3">
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.to === "/" }}
            className="flex shrink-0 items-center gap-1.5 rounded-full border-2 border-transparent px-3 py-1.5 text-[13px] text-muted-ink"
            activeProps={{
              className:
                "flex shrink-0 items-center gap-1.5 rounded-full border-2 border-line bg-butter px-3 py-1.5 text-[13px] font-semibold text-butter-ink",
            }}
          >
            <span>{item.emoji}</span>
            <span>{t(item.labelKey)}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
