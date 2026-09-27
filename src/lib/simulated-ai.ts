import type { Lang } from "./i18n";

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
  
  // قراءة مفتاح جيميناي بأمان من متغيرات بيئة فيرسل العالمية
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const systemInstruction = isFunny
    ? lang === "ar"
      ? "أنت مساعد ذكاء اصطناعي ساخر وكوميدي جداً اسمك 'الغباء الصناعي'. مهمتك هي الإجابة على رسائل المستخدم بطريقة مضحكة، تهكمية، ومستهزئة للغاية وباللهجة العراقية الدارجة المحببة والمحششة. لا تعطه إجابة جادة أبداً، وتظاهر بأنك مبرمج لتكون غبياً ومسلياً ومشاكساً. استخدم تعبيرات مضحكة وإيموجيات تحشيشية."
      : "You are a highly sarcastic, comically dumb, and mocking AI assistant named 'Artificial Stupidity'. Respond in a hilarious, dry, and unexpected way using funny emojis."
    : lang === "ar"
      ? "أنت مبرمج خبير ومساعد تقني جاد ومتزن للغاية. أجب على الأسئلة بدقة مجهرية هندسية وبلفظ واضح ومباشر وبأعلى مستويات النقاء البرمجي."
      : "You are an expert software engineer and a highly serious technical assistant. Provide accurate, clear, and direct professional answers.";

  const runCall = async () => {
    try {
      if (!apiKey) {
        throw new Error("VITE_GEMINI_API_KEY is not configured");
      }

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: systemInstruction }] },
          generationConfig: { temperature: isFunny ? 1.0 : 0.1 }
        }),
      });

      if (!response.ok) throw new Error("Gemini Cloud Error");
      const data = await response.json();
      if (cancelled) return;

      // سحب النص الحي المتغير المولد من خوادم جوجل مباشرة لأول مرة أونلاين
      const fullReply = data.candidates?.[0]?.content?.parts?.[0]?.text || 
        (lang === "ar" ? "⚠️ تاهت الكلمات، جرب إرسال الرسالة مرة أخرى!" : "⚠️ Words got twisted, try again!");

      const tokens = fullReply.match(/\S+\s*/g) ?? [fullReply];
      let currentTokenIndex = 0;

      const streamTicks = () => {
        if (cancelled) return;
        currentTokenIndex += 1;
        const currentProgressText = tokens.slice(0, currentTokenIndex).join("");

        if (currentTokenIndex >= tokens.length) {
          onDone(fullReply);
          return;
        }

        onChunk(currentProgressText);
        setTimeout(streamTicks, 15 + Math.random() * 25);
      };

      streamTicks();
    } catch (error) {
      console.error("API Error:", error);
      if (cancelled) return;
      onDone(lang === "ar" ? "⚠️ النبضة السحابية انقطعت! تأكد من مفتاح الـ API في فيرسل." : "⚠️ Cloud pulse dropped! Check API Key in Vercel.");
    }
  };

  runCall();
  return () => { cancelled = true; };
}
