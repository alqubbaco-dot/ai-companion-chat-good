import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageBody } from "@/components/app/AppShell";
import { useI18n, type Lang } from "@/lib/i18n";
import { useTheme, type Theme } from "@/lib/theme";
import { useChatStore } from "@/lib/chat-store";
import { useFriends } from "@/lib/friends-store";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "الإعدادات — الغباء الصناعي" },
      { name: "description", content: "تخصيص اللغات، المظهر، الصوت، الإشعارات، والخصوصية لتطبيق الغباء الصناعي." },
      { property: "og:title", content: "الإعدادات — الغباء الصناعي" },
      {
        property: "og:description",
        content: "تخصيص اللغات، المظهر، الصوت، الإشعارات، والخصوصية لتطبيق الغباء الصناعي.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const { clearAll } = useChatStore();
  const { resetAll } = useFriends();

  // حالات برمجية مضافة حديثاً لإدارة خيارات الصوت والمؤثرات
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [messagesSound, setMessagesSound] = useState(true);
  const [notificationsSound, setNotificationsSound] = useState(false);

  // حالة تفعيل تدمير واختفاء الرسائل بعد 24 ساعة
  const [autoDelete24h, setAutoDelete24h] = useState(false);

  const option = (active: boolean) =>
    `rounded-full border-2 border-line px-5 py-2 text-sm font-semibold transition-colors ${
      active ? "bg-butter text-butter-ink" : "hover:bg-ink/5"
    }`;

  // زر التبديل (Switch) المصمم بالكامل بدون أي حرف زائد أو رمز مكسور
  const switchButton = (enabled: boolean, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-line transition-colors duration-200 ease-in-out ${
        enabled ? "bg-butter" : "bg-ink/10"
      }`}
    >
      <span
        className={`pointer-events-none inline-block size-4 transform rounded-full bg-ink border border-line shadow ring-0 transition duration-200 ease-in-out ${
          enabled ? (lang === "ar" ? "-translate-x-5" : "translate-x-5") : "translate-x-0"
        } mt-0.5 mx-0.5`}
      />
    </button>
  );

  return (
    <PageBody title={t("settingsTitle")} subtitle={t("settingsSubtitle")}>
      <div className="mx-auto w-full max-w-2xl space-y-4 pb-10">
        
        {/* 1. قسم اللغة */}
        <section className="rounded-3xl border-2 border-line bg-cream p-5">
          <h2 className="font-display text-lg font-bold">{t("language")}</h2>
          <div className="mt-3 flex gap-2">
            {(
              [
                { code: "ar", label: "العربية (RTL)" },
                { code: "en", label: "English (LTR)" },
              ] as { code: Lang; label: string }[]
            ).map((item) => (
              <button
                key={item.code}
                onClick={() => setLang(item.code)}
                className={option(lang === item.code)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>

        {/* 2. قسم Mظهر التّطبيق */}
        <section className="rounded-3xl border-2 border-line bg-cream p-5">
          <h2 className="font-display text-lg font-bold">{t("theme")}</h2>
          <div className="mt-3 flex gap-2">
            {(
              [
                { code: "light", label: `☀ ${t("light")}` },
                { code: "dark", label: `☾ ${t("dark")}` },
              ] as { code: Theme; label: string }[]
            ).map((item) => (
              <button
                key={item.code}
                onClick={() => setTheme(item.code)}
                className={option(theme === item.code)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>

        {/* 3. قسم الصوت والمؤثرات كما في صورتك للتطبيق القديم */}
        <section className="rounded-3xl border-2 border-line bg-cream p-5 space-y-4">
          <div>
            <h2 className="font-display text-lg font-bold">
              {lang === "ar" ? "الصوت" : "Sound"}
            </h2>
            <p className="text-[12px] text-muted-ink mt-0.5">
              {lang === "ar" ? "تحكم في أصوات ومؤثرات التطبيق" : "Control application sounds"}
            </p>
          </div>
          
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between border-b border-line/40 pb-2">
              <span className="text-sm font-semibold">{lang === "ar" ? "المؤثرات الصوتية" : "Sound Effects"}</span>
              {switchButton(soundEnabled, () => setSoundEnabled(!soundEnabled))}
            </div>
            
            <div className="flex items-center justify-between border-b border-line/40 pb-2">
              <span className="text-sm font-semibold">{lang === "ar" ? "صوت الرسائل" : "Messages Sound"}</span>
              {switchButton(messagesSound, () => setMessagesSound(!messagesSound))}
            </div>

            <div className="flex items-center justify-between pb-1">
              <span className="text-sm font-semibold">{lang === "ar" ? "صوت الإشعار" : "Notification Sound"}</span>
              {switchButton(notificationsSound, () => setNotificationsSound(!notificationsSound))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => toast.success(lang === "ar" ? "تم حفظ التغييرات بنجاح" : "Changes saved successfully!")}
            className="w-full mt-2 rounded-full border-2 border-line bg-teal text-teal-ink py-2 text-sm font-bold transition-transform hover:scale-[1.01]"
          >
            {lang === "ar" ? "حفظ التغييرات" : "Save Changes"}
          </button>
        </section>

        {/* 4. قسم التدمير الذاتي للرسائل بعد 24 ساعة */}
        <section className="rounded-3xl border-2 border-line bg-cream p-5">
          <h2 className="font-display text-lg font-bold">
            {lang === "ar" ? "⏱️ التدمير الذاتي للرسائل" : "⏱️ Messages Self-Destruct"}
          </h2>
          <p className="text-[12px] text-muted-ink mt-0.5">
            {lang === "ar" 
              ? "عند التفعيل، سيتم مسح واختفاء جميع رسائل المحادثات تلقائياً بعد مرور 24 ساعة." 
              : "When enabled, all conversation messages will disappear automatically after 24 hours."}
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setAutoDelete24h(true);
                toast.success(lang === "ar" ? "🔒 تم تفعيل اختفاء الرسائل تلقائياً بعد 24 ساعة" : "Disappearing messages activated");
              }}
              className={option(autoDelete24h === true)}
            >
              {lang === "ar" ? "تفعيل (24 ساعة)" : "Enable (24h)"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAutoDelete24h(false);
                toast.error(lang === "ar" ? "🔓 تم إيقاف ميزة اختفاء الرسائل" : "Disappearing messages deactivated");
              }}
              className={option(autoDelete24h === false)}
            >
              {lang === "ar" ? "إيقاف التفعيل" : "Disable"}
            </button>
          </div>
          
          <div className="mt-4 pt-3 border-t border-line/30 flex items-center justify-between">
            <span className="text-xs text-muted-ink">{lang === "ar" ? "📜 سياسة الخصوصية والتطبيق" : "📜 Application Policy"}</span>
            <button
              type="button"
              onClick={() => toast.info(lang === "ar" ? "سيتم كتابة بنود السياسة لاحقاً عند التوصيل السحابي." : "Policy details will be written later.")}
              className="text-xs font-bold text-ink underline hover:text-muted-ink"
            >
              {lang === "ar" ? "عرض السياسة (قريباً)" : "View Policy (Soon)"}
            </button>
          </div>
        </section>

        {/* 5. قسم مسح البيانات الحرج */}
        <section className="rounded-3xl border-2 border-line bg-cream p-5">
          <h2 className="font-display text-lg font-bold">{t("dataTitle")}</h2>
          <p className="mt-1 text-[13px] text-muted-ink">{t("dataBody")}</p>
          <button
            type="button"
            onClick={() => {
              if (!window.confirm(t("clearData"))) return;
              clearAll();
              resetAll();
              toast.success(t("cleared"));
            }}
            className="mt-3 rounded-full border-2 border-line px-5 py-2 text-sm font-semibold text-coral transition-colors hover:bg-coral/10"
          >
            🗑 {t("clearData")}
          </button>
        </section>

      </div>
    </PageBody>
  );
}
