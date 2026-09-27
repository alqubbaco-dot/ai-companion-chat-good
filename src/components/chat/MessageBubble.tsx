import { toast } from "sonner";
import type { ChatMessage } from "@/lib/chat-store";
import { useI18n } from "@/lib/i18n";
import { Markdown } from "./Markdown";

export function TypingBubble() {
  const { t } = useI18n();
  return (
    <div className="flex max-w-[85%] animate-rise justify-start">
      <div className="flex items-center gap-2 rounded-3xl rounded-ss-md border-2 border-line bg-cream px-5 py-3.5">
        <span className="flex gap-1">
          <span className="size-1.5 animate-bounce rounded-full bg-ink/60 [animation-delay:0ms]" />
          <span className="size-1.5 animate-bounce rounded-full bg-ink/45 [animation-delay:120ms]" />
          <span className="size-1.5 animate-bounce rounded-full bg-ink/30 [animation-delay:240ms]" />
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
      <div className="ms-auto flex max-w-[80%] animate-rise justify-end">
        <div className="rounded-3xl rounded-ee-md bg-ink px-5 py-3 text-cream">
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{message.content}</p>
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
    <div className="flex max-w-[85%] animate-rise justify-start">
      <div className="w-full rounded-3xl rounded-ss-md border-2 border-line bg-cream px-5 py-4">
        <Markdown content={message.content} />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={copyAnswer}
            className="flex items-center gap-1.5 rounded-full border-2 border-line bg-butter px-4 py-1.5 text-[13px] font-semibold text-butter-ink transition-transform hover:-translate-y-0.5"
          >
            📋 {t("copyAnswer")}
          </button>
          <button
            onClick={share}
            className="flex items-center gap-1.5 rounded-full border-2 border-line px-4 py-1.5 text-[13px] font-semibold transition-colors hover:bg-ink/5"
          >
            ↗ {t("share")}
          </button>
        </div>
      </div>
    </div>
  );
}
