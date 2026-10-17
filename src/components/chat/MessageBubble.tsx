import { toast } from "sonner";
import type { ChatMessage } from "@/lib/chat-store";
import { useI18n } from "@/lib/i18n";
import { Avatar } from "@/components/app/Avatar";
import { Markdown } from "./Markdown";
import { QuotaActions } from "./QuotaActions";
import { isQuotaMessage } from "@/lib/bot-quota";

export function TypingBubble() {
  const { t } = useI18n();
  return (
    <div className="flex max-w-[85%] animate-rise items-end gap-2">
      <Avatar bot size="sm" />
      <div className="flex items-center gap-2 rounded-3xl rounded-es-md border border-line bg-cream px-4 py-3 shadow-sm">
        <span className="flex gap-1">
          <span className="size-1.5 animate-bounce rounded-full bg-butter/80 [animation-delay:0ms]" />
          <span className="size-1.5 animate-bounce rounded-full bg-butter/60 [animation-delay:120ms]" />
          <span className="size-1.5 animate-bounce rounded-full bg-butter/40 [animation-delay:240ms]" />
        </span>
        <span className="text-[12px] text-muted-ink">{t("typing")}</span>
      </div>
    </div>
  );
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  const { t } = useI18n();

  if (message.role === "user") {
    return (
      <div className="ms-auto flex max-w-[82%] animate-rise justify-end">
        <div className="bg-brand rounded-3xl rounded-ee-md px-4 py-2.5 shadow-sm">
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{message.content}</p>
        </div>
      </div>
    );
  }

  // رسالة "خلصت سوالف اليوم": نطلع وياها أزرار الإعلان والنقاط بدل النسخ والمشاركة
  if (isQuotaMessage(message.content)) {
    return (
      <div className="flex max-w-[88%] animate-rise items-end gap-2">
        <Avatar bot size="sm" className="mb-1" />
        <div className="min-w-0 flex-1">
          <div className="rounded-3xl rounded-es-md border border-line bg-cream px-4 py-3 shadow-sm">
            <p className="text-[15px] leading-relaxed">{message.content}</p>
            <QuotaActions />
          </div>
        </div>
      </div>
    );
  }

  const copyAnswer = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      toast.success(t("copied"));
    } catch {
      toast.error("clipboard");
    }
  };

  const share = async () => {
    const shareData = { title: t("appName"), text: message.content };
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        /* user dismissed — fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(message.content);
      toast.success(t("shared"));
    } catch {
      toast.error("share");
    }
  };

  return (
    <div className="flex max-w-[88%] animate-rise items-end gap-2">
      <Avatar bot size="sm" className="mb-7" />
      <div className="min-w-0 flex-1">
        <div className="rounded-3xl rounded-es-md border border-line bg-cream px-4 py-3 shadow-sm">
          <Markdown content={message.content} />
        </div>
        {/* أزرار صغيرة تحت الرسالة بدل الأزرار الكبيرة */}
        <div className="mt-1 flex gap-1 ps-2">
          <button
            onClick={copyAnswer}
            title={t("copyAnswer")}
            aria-label={t("copyAnswer")}
            className="grid size-7 place-items-center rounded-full text-[13px] text-muted-ink transition-colors hover:bg-ink/5 hover:text-ink"
          >
            📋
          </button>
          <button
            onClick={share}
            title={t("share")}
            aria-label={t("share")}
            className="grid size-7 place-items-center rounded-full text-[13px] text-muted-ink transition-colors hover:bg-ink/5 hover:text-ink"
          >
            ↗
          </button>
        </div>
      </div>
    </div>
  );
}
