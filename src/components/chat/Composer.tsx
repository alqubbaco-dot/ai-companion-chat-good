import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

export function Composer({
  onSend,
  disabled,
  focusKey,
}: {
  onSend: (text: string, isFunny: boolean) => void;
  disabled?: boolean;
  focusKey?: string;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState("");
  const [isFunny, setIsFunny] = useState(true); // تفعيل وضع "الغباء الصناعي الهزلي" افتراضياً ليعكس هوية التطبيق الساخرة
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, [focusKey, disabled]);

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text, isFunny);
    setValue("");
    requestAnimationFrame(() => ref.current?.focus());
  };

  const toggleMode = () => {
    const next = !isFunny;
    setIsFunny(next);
    toast(next ? t("funnyModeOn") : t("seriousModeOn"), { duration: 1800 });
  };

  return (
    <div className="px-3 pb-3 pt-2 sm:px-6 sm:pb-5">
      <div className="mx-auto flex w-full max-w-3xl animate-rise items-end gap-1.5 rounded-[1.75rem] border border-line bg-cream p-1.5 shadow-sm focus-within:border-butter/60">
        {/* زر صغير للتبديل بين الهزلي والجاد */}
        <button
          type="button"
          onClick={toggleMode}
          title={isFunny ? t("funnyMode") : t("seriousMode")}
          aria-label={isFunny ? t("funnyMode") : t("seriousMode")}
          className={`flex h-10 shrink-0 items-center gap-1 rounded-full px-2.5 text-[12px] font-bold transition-colors ${
            isFunny
              ? "bg-brand-accent/20 text-ink"
              : "bg-ink/5 text-muted-ink"
          }`}
        >
          <span className="text-base leading-none">{isFunny ? "🤪" : "🧐"}</span>
          <span className="hidden sm:inline">{isFunny ? t("funnyMode") : t("seriousMode")}</span>
        </button>
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
