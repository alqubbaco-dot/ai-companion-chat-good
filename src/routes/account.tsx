import { useMemo, useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageBody } from "@/components/app/AppShell";
import { Avatar } from "@/components/app/Avatar";
import { useChatStore } from "@/lib/chat-store";
import { useI18n } from "@/lib/i18n";
import { supabase as cloudClient } from "@/lib/supabase";
import { toast } from "sonner";
import { useFriends } from "@/lib/friends-store";
import { friendlyDbError, getMyPhone, saveMyProfile, shareInvite } from "@/lib/cloud-friends";
import { deleteMyChatMedia } from "@/lib/private-chat";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "حسابي — الغباء الصناعي" },
      { name: "description", content: "إدارة ملفك الشخصي ومزامنة سجلاتك السحابية بأمان." },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { conversations, clearAll } = useChatStore();
  const [isSaving, setIsSaving] = useState(false);
  const [account, setAccount] = useState({ id: "", name: "", handle: "", email: "" });
  const [nameDraft, setNameDraft] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneDraft, setPhoneDraft] = useState("");
  const { refreshProfile, resetAll } = useFriends();
  const [deleteStep, setDeleteStep] = useState<0 | 1>(0);
  const [deleteWord, setDeleteWord] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // حذف الحساب نهائياً (الدالة بـ supabase/delete-account.sql)
  const handleDeleteAccount = async () => {
    if (deleteWord.trim() !== "حذف" || isDeleting) return;
    setIsDeleting(true);
    try {
      // الصور والرسائل الصوتية ما تنحذف تلقائياً ويه الحساب، فنمسحها أول
      const myId = (await cloudClient.auth.getUser()).data.user?.id;
      if (myId) await deleteMyChatMedia(myId).catch((e) => console.error("تعذر حذف الوسائط:", e));
      const { error } = await cloudClient.rpc("delete_my_account");
      if (error) throw error;
      clearAll();
      resetAll();
      try {
        localStorage.clear();
      } catch {
        /* */
      }
      await cloudClient.auth.signOut().catch(() => undefined);
      toast.success("انحذف حسابك وكل بياناتك. نتمنى نشوفك مرة ثانية 👋");
      navigate({ to: "/login" });
    } catch (err) {
      console.error("فشل حذف الحساب:", err);
      toast.error("ما گدرنا نحذف الحساب هسه، جرّب بعدين أو راسلنا من صفحة الخصوصية");
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    let active = true;

    const fetchUser = async () => {
      const { data: authData, error: authError } = await cloudClient.auth.getUser();
      const user = authData.user;
      if (authError || !user) return;

      const { data: directoryProfile } = await cloudClient
        .from("users_directory")
        .select("name,handle")
        .eq("id", user.id)
        .maybeSingle();

      if (active) {
        setAccount({
          id: user.id,
          name: directoryProfile?.name || "",
          handle: directoryProfile?.handle || "",
          email: user.email || user.phone || "",
        });
        setNameDraft(directoryProfile?.name || "");
        const saved = await getMyPhone();
        if (active) {
          setPhone(saved);
          setPhoneDraft(saved ? "0" + saved.replace(/^964/, "") : "");
        }
      }
    };

    void fetchUser();
    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    let totalMessages = 0;
    conversations.forEach((c) => { totalMessages += c.messages.length; });
    return { chatsCount: conversations.length, messagesCount: totalMessages };
  }, [conversations]);

  // حفظ الاسم والرقم عن طريق قاعدة البيانات (كل واحد يعدّل نفسه بس)
  const handleSave = async () => {
    const cleanName = nameDraft.trim().replace(/\s+/g, " ");
    const cleanPhone = phoneDraft.trim();
    if (cleanName.length < 2) {
      toast.error("اكتب اسمك (حرفين أو أكثر).");
      return;
    }
    setIsSaving(true);
    try {
      const result = await saveMyProfile(cleanName, cleanPhone || null);
      setAccount((prev) => ({ ...prev, name: cleanName }));
      if (result?.phone) setPhone(result.phone);
      await refreshProfile();
      toast.success("✅ انحفظ. هسه أصدقاءك يكدرون يلگونك بالاسم أو برقمك");
    } catch (error) {
      console.error("تعذر حفظ الملف الشخصي:", error);
      toast.error(friendlyDbError(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleInvite = async () => {
    if (!account.id) return;
    const result = await shareInvite(account.id, account.name);
    if (result === "copied") toast.success("📋 انسخ رابط الدعوة، الصقه لصديقك بالواتساب");
    else if (result === "failed") toast.error("ما گدرنا ننسخ الرابط");
  };

  const unchanged =
    nameDraft.trim() === account.name.trim() &&
    phoneDraft.replace(/\D/g, "").replace(/^0/, "964") === phone;

  return (
    <PageBody title={t("accountTitle") || "حسابي"} subtitle={t("accountSubtitle") || "بياناتك محفوظة بأمان سحابي."}>
      <div className="mx-auto w-full max-w-md space-y-6 py-4 animate-rise text-right" dir="rtl">
        <div className="rounded-3xl border-2 border-line bg-cream p-6 text-center space-y-4">
          <Avatar name={account.name || account.email || account.id} size="lg" className="mx-auto" />
          <div>
            <h2 className="font-display text-base font-extrabold text-ink break-all">{account.name || account.email || account.id}</h2>
            {account.handle && <p className="text-xs font-mono text-muted-ink mt-0.5">{account.handle}</p>}
            <p className="mt-2 inline-block rounded-full bg-teal/10 px-3 py-1 text-[11px] font-bold text-teal border border-teal/20">
              🟢 متصل الآن
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border-2 border-line bg-cream p-4 text-center">
            <p className="text-2xl font-extrabold font-display">{stats.chatsCount}</p>
            <p className="text-[11px] font-bold text-muted-ink mt-1">محادثة</p>
          </div>
          <div className="rounded-2xl border-2 border-line bg-cream p-4 text-center">
            <p className="text-2xl font-extrabold font-display">{stats.messagesCount}</p>
            <p className="text-[11px] font-bold text-muted-ink mt-1">رسالة</p>
          </div>
        </div>

        <div className="rounded-2xl border-2 border-line bg-cream p-4 space-y-3">
          <div className="space-y-1">
            <label htmlFor="display-name" className="block text-xs font-bold text-ink">
              اسمك
            </label>
            <input
              id="display-name"
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="مثلاً: علي حسن"
              maxLength={40}
              className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-butter"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="phone" className="block text-xs font-bold text-ink">
              رقم موبايلك <span className="font-normal text-muted-ink">(ما يظهر لأحد، بس حتى أصدقاءك يلگونك)</span>
            </label>
            <input
              id="phone"
              type="tel"
              inputMode="tel"
              dir="ltr"
              value={phoneDraft}
              onChange={(e) => setPhoneDraft(e.target.value)}
              placeholder="07701234567"
              maxLength={20}
              className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-left text-sm outline-none focus:border-butter"
            />
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || unchanged}
            className="bg-brand w-full rounded-xl py-2.5 text-sm font-bold shadow-sm disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? "لحظة…" : "حفظ"}
          </button>
        </div>

        <button
          type="button"
          onClick={handleInvite}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-line bg-cream py-3 text-sm font-display font-extrabold text-ink transition-colors hover:bg-ink/5 cursor-pointer"
        >
          📨 ادعُ صديق للتطبيق
        </button>

        <button
          type="button"
          onClick={() => {
            if (window.confirm(lang === "ar" ? "هل أنت متأكد من تسجيل الخروج؟" : "Are you sure you want to logout?")) {
              clearAll();
              cloudClient.auth.signOut();
              navigate({ to: "/login" });
            }
          }}
          className="w-full rounded-2xl border-2 border-line bg-cream py-3 text-sm font-display font-extrabold text-coral hover:bg-line/10 transition-colors cursor-pointer"
        >
          تسجيل الخروج
        </button>

        {/* منطقة الخطر: حذف الحساب نهائياً */}
        <div className="rounded-2xl border-2 border-red-300 bg-red-50/60 p-4 dark:bg-red-950/20">
          {deleteStep === 0 ? (
            <button
              type="button"
              onClick={() => setDeleteStep(1)}
              className="w-full text-sm font-display font-extrabold text-red-600 cursor-pointer"
            >
              🗑 حذف الحساب نهائياً
            </button>
          ) : (
            <div className="space-y-3">
              <p className="font-display text-sm font-extrabold text-red-600">⚠️ متأكد تريد تحذف حسابك؟</p>
              <p className="text-[12.5px] leading-6 text-ink/80">
                راح ينمسح ملفك الشخصي ورقمك وأصدقاءك وكل رسائلك وسجل مكالماتك <b>نهائياً</b>، وما نكدر نرجعها.
                حتى تأكد، اكتب كلمة <b>حذف</b> بالمربع:
              </p>
              <input
                value={deleteWord}
                onChange={(e) => setDeleteWord(e.target.value)}
                placeholder="اكتب: حذف"
                className="w-full rounded-xl border-2 border-red-300 bg-paper px-3 py-2 text-sm outline-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleDeleteAccount()}
                  disabled={deleteWord.trim() !== "حذف" || isDeleting}
                  className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white disabled:opacity-40 cursor-pointer"
                >
                  {isDeleting ? "لحظة…" : "احذف حسابي"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteStep(0);
                    setDeleteWord("");
                  }}
                  className="flex-1 rounded-xl border-2 border-line py-2.5 text-sm font-bold cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageBody>
  );
}
