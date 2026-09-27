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

  return (
    <div className="px-4 pb-5 pt-2 sm:px-6 space-y-2">
      {/* مجسم مفتاح التبديل (Toggle Switch) الأنيق والمحكم لتحديد مسار النبضة فوريّاً */}
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-2 py-1 bg-cream/30 rounded-2xl border border-line/40 animate-rise">
        <span className="text-[11px] font-bold text-muted-ink select-none">
          {isFunny ? "🎭 نمط الاستجابة: الغباء الصناعي (هزلي)" : "🧠 نمط الاستجابة: العقل المفكر (جاد)"}
        </span>
        <div className="flex items-center gap-1 bg-paper p-0.5 rounded-xl border border-line/60">
          <button
            type="button"
            onClick={() => setIsFunny(false)}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition-all cursor-pointer ${
              !isFunny ? "bg-ink text-cream shadow-sm" : "text-muted-ink hover:text-ink"
            }`}
          >
            🧐 جاد
          </button>
          <button
            type="button"
            onClick={() => setIsFunny(true)}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition-all cursor-pointer ${
              isFunny ? "bg-coral text-cream shadow-sm border border-line/20" : "text-muted-ink hover:text-ink"
            }`}
          >
            🤪 هزلي
          </button>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-3xl animate-rise items-end gap-2 rounded-3xl border-2 border-line bg-cream p-2">
        <button
          type="button"
          title={t("attach")}
          aria-label={t("attach")}
          onClick={() => toast(t("attachSoon"))}
          className="grid size-11 shrink-0 place-items-center rounded-2xl text-xl transition-colors hover:bg-ink/5"
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
          className="max-h-40 flex-1 resize-none bg-transparent py-2.5 text-[15px] outline-none placeholder:text-muted-ink/70 text-right"
          dir="rtl"
        />
        <button
          type="button"
          onClick={submit}
          disabled={disabled || !value.trim()}
          aria-label={t("send")}
          className="grid size-11 shrink-0 place-items-center rounded-2xl bg-ink font-bold text-cream transition-colors hover:bg-coral disabled:opacity-40 cursor-pointer"
        >
          ↑
        </button>
      </div>
    </div>
  );
}
