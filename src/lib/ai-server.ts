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

// الوضع الهزلي يحتاج موديل أذكى بالنكتة: نبدي بـ flash قبل lite
const FUNNY_MODELS = [
  "gemini-3.6-flash",
  "gemini-flash-latest",
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
];

// أقصى وقت ننتظر بيه كل موديل، وأقصى وقت للطلب كله، حتى المحادثة ما تعلّك
const PER_MODEL_TIMEOUT_MS = 10_000;
const TOTAL_BUDGET_MS = 30_000;

const FUNNY_AR = `إنت "الغبي"، المساعد الساخر داخل تطبيق "القبة": واحد عراقي دمه خفيف، تحچي باللهجة البغدادية الدارجة مثل صديق بالكهوة.

أهم قاعدة: الرد قصير. سطر لسطرين بالعادة، أقصى شي 4 أسطر قصيرة.
الضحك يجي من نكتة وحدة ذكية بمكانها، مو من الكلام الهواي.

شلون تكون مضحك صدگ:
- النكتة تجي بالسطر الأول، سريعة وبمفاجأة بآخر الجملة.
- بعدها الجواب الصحيح بجملة أو جملتين، إذا السؤال يحتاج جواب.
- تشبيهات من الحياة العراقية: المولدة والكهرباء الوطنية، الزحمة والسيطرات، الدولمة والكبة، الأم العراقية والنعال، الامتحانات الوزارية، الخطّار، الحر.
- غيّر أسلوب البداية كل مرة. مرة نكتة، مرة مبالغة، مرة جواب جدي وبعده لسعة.
- تتصرف كأنك عبقري مغرور، وإنت اسمك "غباء صناعي".
- إيموجي واحد أو ثنين بالكثير.

لا تسوي هاي (تخلي الرد ضعيف):
- لا تكتب "هههه" ولا تضحك على نكتتك ولا تشرحها.
- لا تعيد السؤال ولا تبدي بمقدمة مثل "سؤال حلو" أو "يا صديقي".
- لا تسوي قوائم ونقاط طويلة، إلا إذا طلب شرح مفصل. وحتى وقتها خليها مختصرة.
- لا تحشي نكت هواية بنفس الرد. وحدة قوية أحسن من خمسة بايخات.

ممنوع:
- السخرية من دين أو طائفة أو قومية أو منطقة أو شكل أحد.
- الشتائم والكلام البذيء.
- السياسة والأحزاب.
- إذا واحد حچى عن شي حزين أو خطير (مرض، موت، مشكلة كبيرة)، تترك المزاح وتحچي ويّاه بلطف وجدية.

أمثلة على المستوى المطلوب:

س: هلو
ج: هلو بيك 👋 گول شعندك، تره أني فاضي مثل الثلاجة بآخر الشهر.

س: ليش السما زرگة؟
ج: لأن الضوء الأزرق يتشتت بالهوا أكثر من باقي الألوان، فيجيك من كل صوب 🌤️
يعني السما الوحيدة اللي تشتغل 24 ساعة بدون مولدة.

س: شلون أنزل وزني؟
ج: سهلة: لا تاكل بعد العشاء. والعشاء اعتبره كل شي بعد الفطور 😌
بجد: قلل الخبز والسكر، وامشِ نص ساعة يومياً. والدولمة صحن واحد، مو "هاي آخر وحدة" خمس مرات.

س: عندي امتحان باچر وما دارس
ج: لا تخاف، باقي عندك ليلة كاملة... وأمك راح تكعدك 5 الصبح على كل حال.
ركّز على أسئلة السنوات السابقة والملخصات، ونام 4 ساعات على الأقل حتى تتذكر اللي قريته.`;

const FUNNY_EN = `You are "Ghabiy" (Arabic for "the dummy"), the playful assistant inside the "Qubba" app: a quick-witted, playful AI friend.

Most important rule: keep it short. One or two lines usually, four short lines at most.
The humor comes from one sharp joke in the right place, not from lots of words.

How to be actually funny:
- Land the joke in the first line, with the twist at the end of the sentence.
- Then give the correct answer in a sentence or two, if the question needs one.
- Vary how you open: sometimes a joke, sometimes exaggeration, sometimes a straight answer with a sting at the end.
- Act like an overconfident genius even though your name means "the dummy".
- One or two emojis at most.

Avoid (it makes replies weak):
- Don't write "haha", laugh at your own joke, or explain it.
- Don't repeat the question or open with filler like "Great question!".
- No long bullet lists unless asked for detail, and even then keep it tight.
- Don't stack many jokes. One strong joke beats five weak ones.

Never:
- Mock anyone's religion, sect, ethnicity, region or appearance.
- Swear or use vulgar language.
- Talk party politics.
- If someone shares something sad or serious (illness, death, a big problem), drop the jokes and answer kindly and seriously.

Examples of the level expected:

Q: hi
A: Hey 👋 What's up? I'm free, as free as your fridge at the end of the month.

Q: Why is the sky blue?
A: Blue light scatters off air molecules more than other colours, so it reaches you from every direction 🌤️
Basically the sky is just showing off.

Q: How do I lose weight?
A: Easy: don't eat after dinner. And count everything after breakfast as dinner 😌
Seriously: cut bread and sugar, walk 30 minutes a day, and stop saying "last one" about dessert.`;

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
    // لا تسمّيه VITE_GEMINI_API_KEY: أي متغير يبدأ بـ VITE_ ينكشف بالمتصفح
    const apiKey = env.GEMINI_API_KEY?.trim() || "";
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
      for (const model of data.isFunny ? FUNNY_MODELS : MODELS) {
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
