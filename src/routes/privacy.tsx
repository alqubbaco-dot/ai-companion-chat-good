import type { ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";

// صفحة سياسة الخصوصية (عامة، تنفتح بدون تسجيل دخول) — مطلوبة لنشر التطبيق على Google Play
export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "سياسة الخصوصية — القبة" },
      { name: "description", content: "سياسة الخصوصية لتطبيق القبة: شنو البيانات اللي نجمعها وليش وشلون نحميها." },
    ],
  }),
  component: PrivacyPage,
});

const UPDATED = "16 أكتوبر 2026";
const UPDATED_EN = "October 16, 2026";
const CONTACT = "abnalramady@gmail.com";

function Section({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="space-y-2 scroll-mt-6">
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
          <p className="text-sm text-muted-ink">تطبيق «القبة» — آخر تحديث: {UPDATED}</p>
        </header>

        <div dir="rtl" className="space-y-7">
          <p className="text-[15px] leading-7">
            هذي الصفحة توضّح شنو المعلومات اللي يجمعها تطبيق «القبة» (الموقع وتطبيق الأندرويد)، وليش
            نحتاجها، وشلون نحميها، وشنو حقوقك. باستخدامك للتطبيق إنت توافق على هذي السياسة.
          </p>

          <Section title="1. المعلومات اللي نجمعها">
            <ul className="list-disc space-y-1 ps-5">
              <li>
                <b>الإيميل وكلمة السر:</b> حتى تسوّي حساب وتسجّل دخول. كلمة السر تنحفظ مشفّرة وما يكدر يشوفها أحد.
              </li>
              <li>
                <b>رقم الهاتف (اختياري):</b> إذا كتبته، أصدقاءك يكدرون يلگونك بالبحث برقمك. الرقم ما يطلع لأي أحد،
                البحث يطلّع الاسم بس.
              </li>
              <li>
                <b>معلومات الملف الشخصي:</b> الاسم واسم المستخدم والصورة الشخصية (إذا حطيت صورة).
              </li>
              <li>
                <b>قائمة الأصدقاء:</b> طلبات الصداقة والأصدقاء والمحظورين.
              </li>
              <li>
                <b>الرسائل الخاصة:</b> نص الرسائل والصور والرسائل الصوتية اللي تتبادلها ويا أصدقاءك، حتى توصلهم
                وتبقى محفوظة بمحادثتكم. الصور والأصوات محفوظة بمخزن خاص ما يفتحه غير أطراف المحادثة.
              </li>
              <li>
                <b>سجل المكالمات:</b> منو اتصل بمنو، ووقت المكالمة ومدتها، وهل كانت صوت أو فيديو (بدون أي صوت أو صورة).
              </li>
              <li>
                <b>حالة الاتصال:</b> «متصل الآن» و«آخر ظهور» وعلامات قراءة الرسائل ✓✓، وتنعرض لأصدقاءك بس.
              </li>
              <li>
                <b>البلاغات:</b> إذا بلّغت عن شخص، نحفظ سبب البلاغ وملاحظتك حتى نراجعه.
              </li>
              <li>
                <b>محادثات المساعد («الغبي»):</b> الأسئلة اللي ترسلها للمساعد الذكي.
              </li>
              <li>
                <b>معرّف الجهاز للإشعارات:</b> رمز تقني يخلّينا نرسل لتلفونك إشعارات المكالمات والرسائل.
              </li>
              <li>
                <b>معرّف الإعلانات ومعلومات الجهاز:</b> تجمعها خدمة Google AdMob داخل تطبيق الأندرويد حتى تعرض
                الإعلانات وتقيس أداءها.
              </li>
              <li>
                <b>سجل النقاط:</b> عدد الإعلانات اللي كمّلتها، رصيد نقاطك، والميزات اللي فتحتها بالنقاط.
              </li>
            </ul>
          </Section>

          <Section title="2. المكالمات والمايكروفون والكاميرا">
            <p>
              المكالمات الصوتية ومكالمات الفيديو تروح <b>مباشرة بين جهازك وجهاز صديقك</b> (تقنية WebRTC)، وتكون مشفّرة.
              إذا شبكة الموبايل منعت الربط المباشر، المكالمة تمر مشفّرة عن طريق سيرفر وسيط (Cloudflare) بدون ما ينحفظ
              منها شي. إحنا{" "}
              <b>ما نسجّل المكالمات ولا نحفظ الصوت أو الصورة</b> على أي سيرفر. نستخدم المايكروفون والكاميرا
              بس أثناء المكالمة اللي إنت تبدأها أو ترد عليها.
            </p>
          </Section>

          <Section title="جهات الاتصال (اختياري)" id="contacts">
            <p>
              تطبيق الأندرويد يطلب إذن <b>جهات الاتصال</b> بس إذا إنت وافقت، وتكدر ترفض والتطبيق يبقى يشتغل عادي.
              نستخدمه لهدف واحد: نعرف <b>منو من الأرقام المحفوظة بتلفونك عنده حساب بالتطبيق</b> حتى نطلّعهم لك
              وتضيفهم بسهولة.
            </p>
            <ul className="list-disc space-y-1 ps-5">
              <li>نرسل أرقام جهات الاتصال للسيرفر بشكل مشفّر (HTTPS) <b>للمطابقة بس</b>، و<b>ما نحفظها</b>.</li>
              <li>أسماء جهات الاتصال <b>ما تطلع من تلفونك</b> أبداً، تنعرض عندك بس.</li>
              <li>ما نرسل أي رسالة أو دعوة لجهات اتصالك، وما نشاركها ويا أي أحد.</li>
              <li>تكدر تسحب الإذن بأي وقت من: إعدادات التلفون ← التطبيقات ← القبة ← الأذونات.</li>
            </ul>
          </Section>

          <Section title="3. ليش نستخدم هذي المعلومات">
            <ul className="list-disc space-y-1 ps-5">
              <li>حتى يشتغل التطبيق: تسجيل الدخول، الأصدقاء، الرسائل، والمكالمات.</li>
              <li>حتى نرسل لك إشعار من يتصل بيك صديق أو يرسلك رسالة.</li>
              <li>حتى يجاوبك المساعد الذكي على أسئلتك.</li>
              <li>حتى نحسب نقاطك ونفتح لك الميزات اللي تختارها.</li>
              <li>حتى نحمي الحسابات ونمنع إساءة الاستخدام.</li>
            </ul>
            <p>
              <b>الإعلانات:</b> تطبيق الأندرويد يعرض <b>إعلانات بمكافأة</b> عن طريق Google AdMob، وبس لما إنت تضغط
              «اربح نقطة». Google ممكن تستخدم معرّف الإعلانات بجهازك حتى تعرض إعلانات تناسبك. تكدر توقف الإعلانات
              المخصصة أو تمسح معرّف الإعلانات بأي وقت من إعدادات التلفون: <b>الإعدادات ← Google ← الإعلانات</b>.
            </p>
            <p>
              <b>ما نبيع بياناتك لأي أحد</b>، وما نشارك ويا المعلنين رسائلك أو مكالماتك أو رقم هاتفك.
            </p>
          </Section>

          <Section title="4. الخدمات اللي نعتمد عليها">
            <ul className="list-disc space-y-1 ps-5">
              <li>
                <b>Supabase:</b> لحفظ الحسابات والأصدقاء والرسائل والصور والرسائل الصوتية، وتوصيل إشارات المكالمات.
              </li>
              <li>
                <b>Cloudflare:</b> سيرفر وسيط للمكالمات لما الشبكة تمنع الربط المباشر (يمرّر بس، وما يحفظ شي).
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
              <li>
                <b>Google AdMob:</b> لعرض الإعلانات بمكافأة. شلون تستخدم Google البيانات:{" "}
                <a
                  className="underline"
                  dir="ltr"
                  href="https://policies.google.com/technologies/partner-sites"
                  target="_blank"
                  rel="noreferrer"
                >
                  policies.google.com/technologies/partner-sites
                </a>
              </li>
            </ul>
            <p>كل خدمة من هذني تتعامل ويا البيانات حسب سياسة الخصوصية الخاصة بيها.</p>
          </Section>

          <Section title="5. حماية البيانات">
            <p>
              البيانات تنتقل بشكل مشفّر (HTTPS)، وقاعدة البيانات محمية بحيث كل مستخدم يشوف بس محادثاته وأصدقاءه.
              ما في نظام محمي 100%، بس نسوي كل اللي نكدر عليه حتى نحافظ على معلوماتك.
            </p>
            <p>
              <b>الحظر والإبلاغ:</b> من داخل أي محادثة اضغط ⋮ حتى تحظر شخص أو تبلّغ عنه. البلاغ يوصل لإدارة التطبيق بس
              (سبب البلاغ وملاحظتك ورقم المحادثة)، والشخص المبلَّغ عنه ما يعرف منو بلّغ عليه. نراجع البلاغات ونوقف الحسابات المخالفة.
            </p>
          </Section>

          <Section title="6. حذف الحساب والبيانات" id="delete-account">
            <p>
              تكدر تحذف حسابك وكل بياناتك (الملف الشخصي، الأصدقاء، الرسائل، سجل المكالمات، النقاط والميزات المفتوحة) بنفسك بأي وقت: من
              التطبيق افتح <b>حسابي</b> ← <b>حذف الحساب نهائياً</b>. الحذف فوري ونهائي. وإذا ما تكدر تدخل للتطبيق،
              راسلنا على <b dir="ltr">{CONTACT}</b> واذكر رقم هاتفك المسجّل، ونحذف البيانات خلال 30 يوم كحد أقصى.
            </p>
          </Section>

          <Section title="7. العمر">
            <p>التطبيق مخصص لعمر 18 سنة وأكثر. ما نسمح لمن هو أصغر يستخدمه، وما نجمع بيانات الأطفال عن قصد. إذا عرفنا إن حساب يعود لشخص أصغر من 18، نحذفه.</p>
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
          <p className="text-sm text-muted-ink">"Qubba Chat" (القبة) — Last updated: {UPDATED_EN}</p>
          <div className="space-y-3 text-[15px] leading-7 text-ink/85">
            <p>
              <b>Data we collect:</b> your email address and password (for sign-up and sign-in; the password is
              stored hashed), your phone number if you choose to add it (so friends can find you; it is never shown to
              others), profile details you enter (name, username, profile photo), your friends list, the text, photos
              and voice messages you exchange with friends (media is kept in private storage only the chat members can
              open), your call history (who called whom, when, duration, voice or video — never audio or video
              content), your online status, last seen and read receipts (shown only to your friends), reports you
              submit about other users,
              questions you send to the in-app AI assistant, a device token used to deliver call and message
              notifications, your points record (rewarded ads completed, points balance, features unlocked), and —
              through Google AdMob in the Android app — your device's advertising ID and device information used to
              serve and measure ads.
            </p>
            <p>
              <b>Calls:</b> voice and video calls are encrypted and peer-to-peer (WebRTC). When a mobile network blocks
              a direct connection, the encrypted call is relayed through a Cloudflare TURN server, which stores nothing.
              We do not record calls or store any
              audio or video. The microphone and camera are used only during a call you start or answer.
            </p>
            <p>
              <b>Contacts (optional):</b> the Android app asks for contacts access only if you agree, and works
              normally if you decline. If you allow it, the phone numbers in your contacts are sent over HTTPS
              solely to check which of them have an account in the app, so we can show them to you. The numbers are
              <b> not stored</b>, contact names never leave your phone, and we never message or share your contacts.
              You can revoke the permission at any time in your phone's app settings.
            </p>
            <p>
              <b>How we use data:</b> to provide the app (sign-in, friends, messaging, calls), to notify you of
              incoming calls and messages, to answer your AI assistant questions, to track your points and unlocked
              features, and to protect accounts. We do not sell your data, and we never share your messages, calls or
              phone number with advertisers.
            </p>
            <p>
              <b>Ads:</b> the Android app shows <b>rewarded ads</b> through Google AdMob, only when you tap "Earn a
              point". Google may use your device's advertising ID to show ads that are relevant to you. You can opt out
              of personalized ads or delete your advertising ID at any time in your phone's settings (Settings → Google
              → Ads). See how Google uses data:{" "}
              <a className="underline" href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noreferrer">
                policies.google.com/technologies/partner-sites
              </a>
              .
            </p>
            <p>
              <b>Service providers:</b> Supabase (accounts, messages, photos and voice messages, call signaling),
              Cloudflare (call relay when needed), Google Firebase Cloud
              Messaging (notifications), Google Gemini (AI assistant replies), Google AdMob (rewarded ads), and Vercel (hosting).
            </p>
            <p>
              <b>Security:</b> data is encrypted in transit (HTTPS) and database access is restricted so each user
              can only read their own conversations and friends.
            </p>
            <p>
              <b>Blocking and reporting:</b> inside any chat, tap ⋮ to block or report a user. Reports (reason, your
              note and the conversation reference) go only to the app's administrators; the reported user is not told
              who reported them. We review reports and suspend accounts that break the rules.
            </p>
            <p>
              <b>Account and data deletion:</b> you can delete your account and all associated data (including points and unlocked features) yourself at
              any time from the app: open <b>My account</b> → <b>Delete account permanently</b>. Deletion is immediate
              and permanent. If you cannot access the app, email <b>{CONTACT}</b> with your registered phone number and
              we will delete the data within 30 days.
            </p>
            <p>
              <b>Age:</b> the app is intended for users aged 18 and over. We do not knowingly collect data from
              anyone younger, and we delete accounts we learn belong to someone under 18.
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
