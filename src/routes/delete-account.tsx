import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

// صفحة حذف الحساب (عامة، تنفتح بدون تسجيل دخول) — رابطها مطلوب باستمارة «أمان البيانات» في Google Play
export const Route = createFileRoute("/delete-account")({
  head: () => ({
    meta: [
      { title: "حذف الحساب — القبة" },
      { name: "description", content: "شلون تحذف حسابك وبياناتك من تطبيق القبة." },
    ],
  }),
  component: DeleteAccountPage,
});

const CONTACT = "alqubba@gmail.com";
const DEVELOPER = "Qubba Apps";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-lg font-extrabold text-ink">{title}</h2>
      <div className="space-y-2 text-[15px] leading-7 text-ink/85">{children}</div>
    </section>
  );
}

function DeleteAccountPage() {
  return (
    <div className="min-h-dvh w-full overflow-y-auto bg-paper">
      <main className="mx-auto w-full max-w-3xl space-y-8 px-5 py-10">
        <header className="space-y-2 border-b-2 border-line pb-6">
          <div className="flex items-center gap-3">
            <img src="/icons/icon-192.png" alt="" width={48} height={48} className="size-12 rounded-2xl" />
            <h1 className="font-display text-3xl font-extrabold">حذف الحساب</h1>
          </div>
          <p className="text-sm text-muted-ink">
            تطبيق «القبة» — يديره <b dir="ltr">{DEVELOPER}</b>
          </p>
        </header>

        <div dir="rtl" className="space-y-7">
          <Section title="الطريقة الأولى: من داخل التطبيق (فوري)">
            <ol className="list-decimal space-y-1 ps-5">
              <li>افتح تطبيق «القبة» وسجّل دخول.</li>
              <li>
                اضغط <b>حسابي</b>.
              </li>
              <li>
                اضغط <b>حذف الحساب نهائياً</b> وأكّد.
              </li>
            </ol>
            <p>الحذف يصير فوراً وما يرجع.</p>
          </Section>

          <Section title="الطريقة الثانية: بالإيميل">
            <p>
              إذا ما تكدر تدخل للتطبيق، أرسل رسالة إلى <b dir="ltr">{CONTACT}</b> من نفس الإيميل المسجّل بحسابك،
              واكتب بيها «أريد حذف حسابي». نحذف الحساب وكل بياناته خلال 30 يوم كحد أقصى.
            </p>
          </Section>

          <Section title="شنو ينحذف">
            <p>
              الملف الشخصي (الاسم والصورة ورقم الهاتف)، قائمة الأصدقاء، الرسائل والصور والرسائل الصوتية، سجل المكالمات،
              النقاط والميزات المفتوحة.
            </p>
            <p>
              للتفاصيل الكاملة شوف{" "}
              <Link to="/privacy" className="underline">
                سياسة الخصوصية
              </Link>
              .
            </p>
          </Section>
        </div>

        {/* English version */}
        <div dir="ltr" lang="en" className="space-y-4 border-t-2 border-line pt-8 text-left">
          <h2 className="font-display text-2xl font-extrabold">Delete your account (English)</h2>
          <p className="text-sm text-muted-ink">
            "Qubba Chat" (القبة) — operated by <b>{DEVELOPER}</b>
          </p>
          <div className="space-y-3 text-[15px] leading-7 text-ink/85">
            <p>
              <b>In the app (immediate):</b> open the app, sign in, tap <b>My account</b> → <b>Delete account
              permanently</b>, and confirm. Deletion is immediate and cannot be undone.
            </p>
            <p>
              <b>By email:</b> if you cannot access the app, email <b>{CONTACT}</b> from the email address registered to
              your account and ask us to delete it. We will delete the account and its data within 30 days.
            </p>
            <p>
              <b>What is deleted:</b> your profile (name, photo and phone number), friends list, messages, photos and
              voice messages, call history, points and unlocked features.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
