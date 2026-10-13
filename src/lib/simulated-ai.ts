import type { Lang } from "./i18n";
import { askGemini } from "./ai-server";

export function titleFromPrompt(prompt: string): string {
  const clean = prompt.replace(/\s+/g, " ").trim();
  return clean.length > 34 ? `${clean.slice(0, 34)}…` : clean || "…";
}

export function streamSimulatedReply(
  prompt: string,
  lang: Lang,
  isFunny: boolean,
  onChunk: (fullText: string) => void,
  onDone: (fullText: string) => void,
): () => void {
  let cancelled = false;

  const runCall = async () => {
    try {
      // الطلب يروح لسيرفر التطبيق، وهو اللي يحچي ويه Gemini (المفتاح يبقى مخفي)
      // إذا السيرفر ما رد خلال 35 ثانية نعتبره نايم، حتى المحادثة ما تبقى معلّكة
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("client timeout")), 35_000),
      );
      const result = await Promise.race([
        askGemini({ data: { prompt, lang, isFunny } }),
        timeout,
      ]);
      if (cancelled) return;

      if (!result.ok) {
        console.error("AI Error:", result.error);
        onDone(
          lang === "ar"
            ? "⚠️ الغباء الصناعي نايم هسه 😴 جرب ترسل الرسالة مرة ثانية بعد شوية."
            : "⚠️ Artificial Stupidity is napping 😴 Try again in a moment.",
        );
        return;
      }

      const fullReply = result.text;
      const tokens = fullReply.match(/\S+\s*/g) ?? [fullReply];
      let currentTokenIndex = 0;

      const streamTicks = () => {
        if (cancelled) return;
        currentTokenIndex += 1;
        if (currentTokenIndex >= tokens.length) {
          onDone(fullReply);
          return;
        }
        onChunk(tokens.slice(0, currentTokenIndex).join(""));
        setTimeout(streamTicks, 15 + Math.random() * 25);
      };

      streamTicks();
    } catch (error) {
      console.error("AI request failed:", error);
      if (cancelled) return;
      onDone(
        lang === "ar"
          ? "⚠️ الغباء الصناعي غفى بنص الجواب 😴 جرب ترسل الرسالة مرة ثانية."
          : "⚠️ Artificial Stupidity dozed off mid-reply 😴 Try again.",
      );
    }
  };

  runCall();
  return () => {
    cancelled = true;
  };
}
