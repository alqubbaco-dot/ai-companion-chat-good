import type { ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";

// صفحة سياسة الخصوصية (عامة، تنفتح بدون تسجيل دخول) — مطلوبة لنشر التطبيق على Google Play
export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "سياسة الخصوصية — الغباء الصناعي" },
      { name: "description", content: "سياسة الخصوصية لتطبيق الغباء الصناعي: شنو البيانات اللي نجمعها وليش وشلون نحميها." },
    ],
  }),
  component: PrivacyPage,
});

const UPDATED = "14 أكتوبر 2026";
const UPDATED_EN = "October 14, 2026";
const CONTACT = "abnalramady@gmail.com";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-lg font-extrabold text-ink">{title}</h2>
      <div className="space-y-2 text-[15px] leading-7 text-ink/85">{children}</div>
    </section>
  );
}

function PrivacyPage() {
  return (
    <div className="min-h-dvh w-full overflow-y-auto bg-paper">
      <main className="mx-auto w-full max-w-3xl space-y-8 px-5 py-10">
        <header className="space-y-2 border-b-2 border-line pb-6">
          <div className="flex items-center gap-3">
            <img src="/icons/icon-192.png" alt="" width={48} height={48} className="size-12 rounded-2xl" />
            <h1 className="font-display text-3xl font-extrabold">سياسة الخصوصية</h1>
          </div>
          <p className="text-sm text-muted-ink">تطبيق «الغباء الصناعي» — آخر تحديث: {UPDATED}</p>
        </header>

        <div dir="rtl" className="space-y-7">
          <p className="text-[15px] leading-7">
            هذي الصفحة توضّح شنو المعلومات اللي يجمعها تطبيق «الغباء الصناعي» (الموقع وتطبيق الأندرويد)، وليش
            نحتاجها، وشلون نحميها، وشنو حقوقك. باستخدامك للتطبيق إنت توافق على هذي السياسة.
          </p>

          <Section title="1. المعلومات اللي نجمعها">
            <ul className="list-disc space-y-1 ps-5">
              <li>
                <b>رقم الهاتف:</b> حتى تسجّل دخول وحتى أصدقاءك يكدرون يلگونك بالبحث.
              </li>
              <li>
                <b>معلومات الملف الشخصي:</b> الاسم واسم المستخدم والنبذة اللي تكتبها بنفسك.
              </li>
              <li>
                <b>قائمة الأصدقاء:</b> طلبات الصداقة والأصدقاء والمحظورين.
              </li>
              <li>
                <b>الرسائل الخاصة:</b> نص الرسائل اللي تتبادلها ويا أصدقاءك، حتى توصلهم وتبقى محفوظة بمحادثتكم.
              </li>
              <li>
                <b>محادثات المساعد («الغبي»):</b> الأسئلة اللي ترسلها للمساعد الذكي.
              </li>
              <li>
                <b>معرّف الجهاز للإشعارات:</b> رمز تقني يخلّينا نرسل لتلفونك إشعارات المكالمات والرسائل.
              </li>
            </ul>
          </Section>

          <Section title="2. المكالمات والمايكروفون والكاميرا">
            <p>
              المكالمات الصوتية ومكالمات الفيديو تروح <b>مباشرة بين جهازك وجهاز صديقك</b> (تقنية WebRTC). إحنا{" "}
              <b>ما نسجّل المكالمات ولا نحفظ الصوت أو الصورة</b> على أي سيرفر. نستخدم المايكروفون والكاميرا
              بس أثناء المكالمة اللي إنت تبدأها أو ترد عليها.
            </p>
          </Section>

          <Section title="3. ليش نستخدم هذي المعلومات">
            <ul className="list-disc space-y-1 ps-5">
              <li>حتى يشتغل التطبيق: تسجيل الدخول، الأصدقاء، الرسائل، والمكالمات.</li>
              <li>حتى نرسل لك إشعار من يتصل بيك صديق أو يرسلك رسالة.</li>
              <li>حتى يجاوبك المساعد الذكي على أسئلتك.</li>
              <li>حتى نحمي الحسابات ونمنع إساءة الاستخدام.</li>
            </ul>
            <p>
              <b>ما نبيع بياناتك لأي أحد</b>، وما نستخدمها لإعلانات موجّهة لك شخصياً.
            </p>
          </Section>

          <Section title="4. الخدمات اللي نعتمد عليها">
            <ul className="list-disc space-y-1 ps-5">
              <li>
                <b>Supabase:</b> لحفظ الحسابات والأصدقاء والرسائل، وتوصيل إشارات المكالمات.
              </li>
              <li>
                <b>Google Firebase Cloud Messaging:</b> لإرسال إشعارات المكالمات والرسائل لتطبيق الأندرويد.
              </li>
              <li>
                <b>Google Gemini:</b> لتوليد ردود المساعد الذكي. نص سؤالك يوصل لهذي الخدمة حتى تجاوب عليه.
              </li>
              <li>
                <b>Vercel:</b> لاستضافة التطبيق.
              </li>
            </ul>
            <p>كل خدمة من هذني تتعامل ويا البيانات حسب سياسة الخصوصية الخاصة بيها.</p>
          </Section>

          <Section title="5. حماية البيانات">
            <p>
              البيانات تنتقل بشكل مشفّر (HTTPS)، وقاعدة البيانات محمية بحيث كل مستخدم يشوف بس محادثاته وأصدقاءه.
              ما في نظام محمي 100%، بس نسوي كل اللي نكدر عليه حتى نحافظ على معلوماتك.
            </p>
          </Section>

          <Section title="6. حذف الحساب والبيانات">
            <p>
              تكدر تطلب حذف حسابك وكل بياناتك (الملف الشخصي، الأصدقاء، الرسائل) بأي وقت. أرسل طلبك من نفس رقم
              الهاتف المسجّل أو اذكره بالرسالة على الإيميل: <b dir="ltr">{CONTACT}</b>، ونحذف البيانات خلال 30
              يوم كحد أقصى.
            </p>
          </Section>

          <Section title="7. الأطفال">
            <p>التطبيق مو موجّه للأطفال تحت 13 سنة، وما نجمع بياناتهم عن قصد.</p>
          </Section>

          <Section title="8. التغييرات على هذي السياسة">
            <p>إذا غيّرنا هذي السياسة، نحدّث التاريخ بأعلى الصفحة. التغييرات المهمة نبلّغ بيها داخل التطبيق.</p>
          </Section>

          <Section title="9. تواصل ويانا">
            <p>
              لأي سؤال عن خصوصيتك: <b dir="ltr">{CONTACT}</b>
            </p>
          </Section>
        </div>

        {/* English version */}
        <div dir="ltr" lang="en" className="space-y-5 border-t-2 border-line pt-8 text-left">
          <h2 className="font-display text-2xl font-extrabold">Privacy Policy (English)</h2>
          <p className="text-sm text-muted-ink">"Artificial Stupidity" (الغباء الصناعي) — Last updated: {UPDATED_EN}</p>
          <div className="space-y-3 text-[15px] leading-7 text-ink/85">
            <p>
              <b>Data we collect:</b> your phone number (for sign-in and friend search), profile details you enter
              (name, username, bio), your friends list, the text of private messages you exchange with friends,
              questions you send to the in-app AI assistant, and a device token used to deliver call and message
              notifications.
            </p>
            <p>
              <b>Calls:</b> voice and video calls are peer-to-peer (WebRTC). We do not record calls or store any
              audio or video. The microphone and camera are used only during a call you start or answer.
            </p>
            <p>
              <b>How we use data:</b> to provide the app (sign-in, friends, messaging, calls), to notify you of
              incoming calls and messages, to answer your AI assistant questions, and to protect accounts. We do
              not sell your data or use it for personalized advertising.
            </p>
            <p>
              <b>Service providers:</b> Supabase (accounts, messages, call signaling), Google Firebase Cloud
              Messaging (notifications), Google Gemini (AI assistant replies), and Vercel (hosting).
            </p>
            <p>
              <b>Security:</b> data is encrypted in transit (HTTPS) and database access is restricted so each user
              can only read their own conversations and friends.
            </p>
            <p>
              <b>Account and data deletion:</b> you can request deletion of your account and all associated data
              at any time by emailing <b>{CONTACT}</b> with your registered phone number. We delete the data within
              30 days.
            </p>
            <p>
              <b>Children:</b> the app is not directed to children under 13 and we do not knowingly collect their
              data.
            </p>
            <p>
              <b>Contact:</b> {CONTACT}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
