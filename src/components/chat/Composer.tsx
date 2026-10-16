import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { getMyPoints } from "@/lib/ad-points";
import { CHARACTERS, CHARACTERS_FEATURE, isCharacter, type AiMode } from "@/lib/characters";

const MODE_KEY = "ai-mode";

function readMode(): AiMode {
  try {
    const saved = localStorage.getItem(MODE_KEY);
    if (saved === "serious" || saved === "ghabiy" || (saved && isCharacter(saved))) return saved as AiMode;
  } catch {
    /* */
  }
  return "ghabiy";
}

export function Composer({
  onSend,
  disabled,
  focusKey,
}: {
  onSend: (text: string, isFunny: boolean, character?: string) => void;
  disabled?: boolean;
  focusKey?: string;
}) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  // الوضع: الغبي (هزلي، الافتراضي) أو جاد أو شخصية مفتوحة بالنقاط
  const [mode, setMode] = useState<AiMode>("ghabiy");
  const [menuOpen, setMenuOpen] = useState(false);
  const [charactersOpen, setCharactersOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const isFunny = mode !== "serious";
  const activeCharacter = CHARACTERS.find((c) => c.id === mode);

  // نرجع آخر وضع اختاره، ونشوف إذا فاتح الشخصيات
  useEffect(() => {
    const saved = readMode();
    setMode(saved);
    void getMyPoints().then((points) => {
      const open = Boolean(points?.unlocked?.includes(CHARACTERS_FEATURE));
      setCharactersOpen(open);
      if (!open && isCharacter(saved)) setMode("ghabiy");
    });
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menuOpen]);

  const pickMode = (next: AiMode) => {
    setMenuOpen(false);
    if (isCharacter(next) && !charactersOpen) {
      toast("🔒 الشخصيات تنفتح بـ 50 نقطة من صفحة النقاط");
      navigate({ to: "/points" });
      return;
    }
    setMode(next);
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      /* */
    }
    const c = CHARACTERS.find((x) => x.id === next);
    toast(c ? `${c.emoji} ${c.name}: ${c.hint}` : next === "serious" ? t("seriousModeOn") : t("funnyModeOn"), {
      duration: 1800,
    });
  };

  useEffect(() => {
    ref.current?.focus();
  }, [focusKey, disabled]);

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text, isFunny, activeCharacter?.id);
    setValue("");
    requestAnimationFrame(() => ref.current?.focus());
  };

  const modeEmoji = activeCharacter ? activeCharacter.emoji : isFunny ? "🤪" : "🧐";
  const modeLabel = activeCharacter ? activeCharacter.name : isFunny ? t("funnyMode") : t("seriousMode");
  const itemClass =
    "flex w-full items-center gap-3 px-4 py-2.5 text-start text-[14px] font-bold hover:bg-ink/5 active:bg-ink/10";

  return (
    <div className="px-3 pb-3 pt-2 sm:px-6 sm:pb-5">
      <div className="mx-auto flex w-full max-w-3xl animate-rise items-end gap-1.5 rounded-[1.75rem] border border-line bg-cream p-1.5 shadow-sm focus-within:border-butter/60">
        {/* زر الوضع: قائمة (الغبي / جاد / الشخصيات) */}
        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            title={modeLabel}
            aria-label={modeLabel}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className={`flex h-10 items-center gap-1 rounded-full px-2.5 text-[12px] font-bold transition-colors ${
              isFunny ? "bg-brand-accent/20 text-ink" : "bg-ink/5 text-muted-ink"
            }`}
          >
            <span className="text-base leading-none">{modeEmoji}</span>
            <span className="hidden sm:inline">{modeLabel}</span>
          </button>
          {menuOpen ? (
            <div
              role="menu"
              className="absolute bottom-full start-0 z-50 mb-2 w-64 overflow-hidden rounded-2xl border-2 border-line bg-cream py-1.5 shadow-lg"
            >
              <button type="button" role="menuitem" onClick={() => pickMode("ghabiy")} className={itemClass}>
                <span className="text-lg">🤪</span>
                <span className="flex-1">{lang === "ar" ? "الغبي (هزلي)" : t("funnyMode")}</span>
                {mode === "ghabiy" ? <span>✓</span> : null}
              </button>
              <button type="button" role="menuitem" onClick={() => pickMode("serious")} className={itemClass}>
                <span className="text-lg">🧐</span>
                <span className="flex-1">{t("seriousMode")}</span>
                {mode === "serious" ? <span>✓</span> : null}
              </button>
              {lang === "ar" ? (
                <>
                  <p className="border-t border-line px-4 pb-1 pt-2 text-[11px] font-bold text-muted-ink">
                    شخصيات {charactersOpen ? "" : "· 🔒 50 نقطة"}
                  </p>
                  {CHARACTERS.map((c) => (
                    <button key={c.id} type="button" role="menuitem" onClick={() => pickMode(c.id)} className={itemClass}>
                      <span className="text-lg">{c.emoji}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block">{c.name}</span>
                        <span className="block truncate text-[11px] font-normal text-muted-ink">{c.hint}</span>
                      </span>
                      {mode === c.id ? <span>✓</span> : !charactersOpen ? <span>🔒</span> : null}
                    </button>
                  ))}
                </>
              ) : null}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          title={t("attach")}
          aria-label={t("attach")}
          onClick={() => toast(t("attachSoon"))}
          className="grid size-10 shrink-0 place-items-center rounded-full text-lg text-muted-ink transition-colors hover:bg-ink/5"
        >
          📎
        </button>
        <textarea
          ref={ref}
          rows={1}
          value={value}
          disabled={disabled}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={t("composerPlaceholder")}
          className="max-h-40 min-w-0 flex-1 resize-none bg-transparent px-1 py-2.5 text-[15px] outline-none placeholder:text-muted-ink/70"
          dir="auto"
        />
        <button
          type="button"
          onClick={submit}
          disabled={disabled || !value.trim()}
          aria-label={t("send")}
          className="bg-brand grid size-10 shrink-0 place-items-center rounded-full text-lg font-bold shadow-sm transition-transform hover:scale-105 disabled:opacity-40 disabled:hover:scale-100 cursor-pointer"
        >
          ↑
        </button>
      </div>
    </div>
  );
}
