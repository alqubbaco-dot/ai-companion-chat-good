import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

// هذا الملف يشتغل على السيرفر فقط، فمفتاح Gemini ما يوصل لمتصفح المستخدمين أبداً

// نتأكد إن الطالب مستخدم مسجّل، حتى محد من برّا يستهلك حصة Gemini
const SUPABASE_URL = "https://etkacphlxhpdjhrvoaqz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_qwvchdJI-viQlVbiDPtfhg_VG6UOjkk";

type AskInput = {
  accessToken: string;
  prompt: string;
  lang: "ar" | "en";
  isFunny: boolean;
};

export type AskResult =
  | { ok: true; text: string; model: string }
  | { ok: false; error: string };

// نجرب الموديلات بالترتيب: إذا واحد مضغوط أو انطفى أو بطيء، ننتقل للي بعده تلقائياً
const MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.6-flash",
  "gemini-flash-latest",
  "gemini-3.8-flash",
];

// أقصى وقت ننتظر بيه كل موديل، وأقصى وقت للطلب كله، حتى المحادثة ما تعلّك
const PER_MODEL_TIMEOUT_MS = 10_000;
const TOTAL_BUDGET_MS = 30_000;

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
      accessToken: String(input.accessToken ?? "").slice(0, 4000),
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
    if (!data.accessToken) return { ok: false, error: "not signed in" };
    const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: user, error: authError } = await db.auth.getUser(data.accessToken);
    if (authError || !user?.user) return { ok: false, error: "not signed in" };

    const systemText = data.isFunny
      ? data.lang === "ar" ? FUNNY_AR : FUNNY_EN
      : data.lang === "ar" ? SERIOUS_AR : SERIOUS_EN;

    let lastError = "unknown";
    // نطلب من الموديل يفكّر قليل حتى يرد بسرعة. إذا رفض هالإعداد، نكمل بدونه
    let useLowThinking = true;
    const startedAt = Date.now();
    const timeLeft = () => TOTAL_BUDGET_MS - (Date.now() - startedAt);

    // جولتين على كل الموديلات: إذا كلها مزحومة بالجولة الأولى، نصبر شوية ونعيد
    for (let round = 0; round < 2; round++) {
      if (round > 0) {
        if (timeLeft() < 5_000) break;
        await new Promise((r) => setTimeout(r, 1_200));
      }
      for (const model of MODELS) {
        if (timeLeft() < 2_500) {
          lastError = `${lastError} | out of time`;
          return { ok: false, error: lastError };
        }
        const attempt = await callModel(model, useLowThinking);
        if (attempt.kind === "ok") {
          console.log(`Gemini ok: ${model} in ${Date.now() - startedAt}ms`);
          return { ok: true, text: attempt.text, model };
        }
        lastError = attempt.error;
        console.error("Gemini error:", lastError);
        if (attempt.kind === "fatal") return { ok: false, error: lastError };
        if (attempt.kind === "bad_thinking" && useLowThinking) {
          // الموديل ما يقبل إعداد التفكير: نعيد نفس الموديل بدونه
          useLowThinking = false;
          const retry = await callModel(model, false);
          if (retry.kind === "ok") return { ok: true, text: retry.text, model };
          lastError = retry.error;
          console.error("Gemini error:", lastError);
        }
      }
    }
    return { ok: false, error: lastError };

    async function callModel(
      model: string,
      lowThinking: boolean,
    ): Promise<
      | { kind: "ok"; text: string }
      | { kind: "retry" | "fatal" | "bad_thinking"; error: string }
    > {
      const generationConfig: Record<string, unknown> = {
        temperature: data.isFunny ? 1.0 : 0.2,
      };
      if (lowThinking) generationConfig.thinkingConfig = { thinkingLevel: "low" };
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
              generationConfig,
            }),
            signal: AbortSignal.timeout(Math.min(PER_MODEL_TIMEOUT_MS, timeLeft())),
          },
        );

        if (!response.ok) {
          const body = (await response.text()).slice(0, 300);
          const error = `${model} → HTTP ${response.status}: ${body}`;
          // مفتاح غلط أو ممنوع: ما يفيد نجرب موديل ثاني
          if (response.status === 401 || response.status === 403) {
            return { kind: "fatal", error };
          }
          if (response.status === 400 && /thinking/i.test(body)) {
            return { kind: "bad_thinking", error };
          }
          // موديل مزحوم 503، حد استخدام 429، موديل منطفي 404...: جرّب اللي بعده
          return { kind: "retry", error };
        }

        const json = (await response.json()) as {
          candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
        };
        const text = json.candidates?.[0]?.content?.parts
          ?.filter((p) => !p.thought)
          .map((p) => p.text ?? "")
          .join("")
          .trim();
        if (text) return { kind: "ok", text };
        return { kind: "retry", error: `${model} → empty reply` };
      } catch (err) {
        return {
          kind: "retry",
          error: `${model} → ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }
  });
