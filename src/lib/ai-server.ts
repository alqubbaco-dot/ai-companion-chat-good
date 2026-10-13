import { createServerFn } from "@tanstack/react-start";

// هذا الملف يشتغل على السيرفر فقط، فمفتاح Gemini ما يوصل لمتصفح المستخدمين أبداً

type AskInput = {
  prompt: string;
  lang: "ar" | "en";
  isFunny: boolean;
};

export type AskResult =
  | { ok: true; text: string; model: string }
  | { ok: false; error: string };

// نجرب الموديلات بالترتيب: إذا Google أطفت واحد، ننتقل للي بعده تلقائياً
const MODELS = ["gemini-3.8-flash", "gemini-flash-latest", "gemini-3.6-flash"];

const FUNNY_AR = `إنت "الغباء الصناعي"، مساعد عراقي تحشيشي خفيف الدم.
تحچي باللهجة العراقية البغدادية الدارجة، مثل صديق كاعد ويه ربعه بالكهوة.

أسلوبك:
- تجاوب على السؤال صدگ وبمعلومة صحيحة، بس بطريقة مضحكة.
- تبدي بتعليق ساخر خفيف على السؤال نفسه، بعدين تعطي الجواب.
- تستخدم تشبيهات من الحياة العراقية اليومية: الكهرباء الوطنية والمولدة، الزحمة، الحماية، الكبة والدولمة، الامتحانات الوزارية، الأم العراقية.
- تمثّل إنك عبقري مغرور وإنت أصلاً "غباء صناعي".
- ردودك قصيرة ومركّزة، النكتة لازم تجي بسرعة.
- تستخدم إيموجيات بس مو هواية.

ممنوع:
- السخرية من دين أو طائفة أو قومية أو منطقة أو شكل أحد.
- الشتائم أو الكلام البذيء.
- السياسة والأحزاب.
- إذا واحد حچى عن شي حزين أو خطير (مرض، موت، مشكلة كبيرة)، تترك المزاح وتحچي ويّاه بلطف وجدية.`;

const FUNNY_EN = `You are "Artificial Stupidity", a witty, playful AI sidekick.
Style:
- Actually answer the question with correct, useful information, but make it funny.
- Open with a light sarcastic remark about the question, then give the real answer.
- Act like an overconfident genius even though your name is "Artificial Stupidity".
- Keep replies short and punchy; the joke should land fast. A few emojis, not too many.
Never:
- Mock anyone's religion, sect, ethnicity, region or appearance.
- Swear or use vulgar language.
- Talk party politics.
- If someone shares something sad or serious (illness, death, a big problem), drop the jokes and answer kindly and seriously.`;

const SERIOUS_AR =
  "أنت مساعد تقني جاد ومتزن. أجب على الأسئلة بدقة ووضوح وبشكل مباشر ومفيد.";
const SERIOUS_EN =
  "You are a serious, professional assistant. Provide accurate, clear and direct answers.";

export const askGemini = createServerFn({ method: "POST" })
  .validator((input: AskInput): AskInput => {
    if (!input || typeof input.prompt !== "string" || !input.prompt.trim()) {
      throw new Error("Invalid prompt");
    }
    return {
      prompt: input.prompt.slice(0, 4000),
      lang: input.lang === "en" ? "en" : "ar",
      isFunny: Boolean(input.isFunny),
    };
  })
  .handler(async ({ data }): Promise<AskResult> => {
    const env = typeof process !== "undefined" ? process.env : {};
    const apiKey = env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || "";
    if (!apiKey) {
      return { ok: false, error: "missing_key: GEMINI key is not set in Vercel" };
    }

    const systemText = data.isFunny
      ? data.lang === "ar" ? FUNNY_AR : FUNNY_EN
      : data.lang === "ar" ? SERIOUS_AR : SERIOUS_EN;

    let lastError = "unknown";
    for (const model of MODELS) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: data.prompt }] }],
              systemInstruction: { parts: [{ text: systemText }] },
              generationConfig: { temperature: data.isFunny ? 1.0 : 0.2 },
            }),
          },
        );

        if (!response.ok) {
          const body = (await response.text()).slice(0, 300);
          lastError = `${model} → HTTP ${response.status}: ${body}`;
          console.error("Gemini error:", lastError);
          // الموديل غير موجود أو انطفى: جرّب اللي بعده. غير هيچ (مفتاح غلط، حد استخدام) نوقف
          if (response.status === 404 || response.status === 400) continue;
          return { ok: false, error: lastError };
        }

        const json = (await response.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        const text = json.candidates?.[0]?.content?.parts
          ?.map((p) => p.text ?? "")
          .join("")
          .trim();
        if (text) return { ok: true, text, model };
        lastError = `${model} → empty reply`;
      } catch (err) {
        lastError = `${model} → ${err instanceof Error ? err.message : String(err)}`;
        console.error("Gemini fetch failed:", lastError);
      }
    }
    return { ok: false, error: lastError };
  });
