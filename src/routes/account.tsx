import { useMemo, useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageBody } from "@/components/app/AppShell";
import { Avatar } from "@/components/app/Avatar";
import { useChatStore } from "@/lib/chat-store";
import { useI18n } from "@/lib/i18n";
import { supabase as cloudClient } from "@/lib/supabase";
import { toast } from "sonner";
import { useFriends } from "@/lib/friends-store";

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
  const { refreshProfile } = useFriends();

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

  // حفظ الاسم بدليل الحسابات حتى الأصدقاء يكدرون يلگونك بالبحث
  const handleSaveName = async () => {
    const clean = nameDraft.trim().replace(/\s+/g, " ");
    if (clean.length < 2) {
      toast.error("اكتب اسمك (حرفين أو أكثر).");
      return;
    }
    if (!account.id) return;
    setIsSaving(true);
    try {
      const handle =
        account.handle || "@" + clean.toLowerCase().replace(/\s+/g, "_") + "_" + account.id.slice(0, 4);
      const { error } = await cloudClient.from("users_directory").upsert([
        {
          id: account.id,
          name: clean,
          name_en: clean,
          handle,
          role: "مستخدم حقيقي",
          role_en: "Real User",
          status: "online",
          last_seen_minutes: 0,
          accent: "teal",
        },
      ]);
      if (error) throw error;
      setAccount((prev) => ({ ...prev, name: clean, handle }));
      await refreshProfile();
      toast.success("✅ انحفظ اسمك، هسه أصدقاءك يكدرون يلگونك بالبحث");
    } catch (error) {
      console.error("تعذر حفظ الاسم:", error);
      toast.error("ما گدرنا نحفظ الاسم، جرّب مرة ثانية.");
    } finally {
      setIsSaving(false);
    }
  };

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

        <div className="rounded-2xl border-2 border-line bg-cream p-4 space-y-2">
          <label htmlFor="display-name" className="block text-xs font-bold text-ink">
            اسمك (هذا اللي يبحث عنه أصدقاءك)
          </label>
          <div className="flex gap-2">
            <input
              id="display-name"
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="مثلاً: علي حسن"
              maxLength={40}
              className="min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-butter"
            />
            <button
              type="button"
              onClick={handleSaveName}
              disabled={isSaving || nameDraft.trim() === account.name.trim()}
              className="bg-brand shrink-0 rounded-xl px-4 py-2 text-sm font-bold shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? "لحظة…" : "حفظ"}
            </button>
          </div>
        </div>

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
      </div>
    </PageBody>
  );
}
