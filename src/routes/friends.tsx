import { useState, useEffect, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageBody } from "@/components/app/AppShell";
import { PersonRow, RowButton } from "@/components/friends/PersonRow";
import { useFriends } from "@/lib/friends-store";
import { useCall } from "@/lib/call-store";
import { useI18n } from "@/lib/i18n";
import { friendlyDbError, searchCloudUsers, shareInvite, type CloudUser } from "@/lib/cloud-friends";
import {
  getFriendChatSummaries,
  subscribeToAllMyMessages,
  type FriendChatSummary,
} from "@/lib/private-chat";
import {
  contactsAllowed,
  findContactsOnApp,
  openPhoneSetup,
  canOpenPhoneSetup,
  type ContactMatch,
} from "@/lib/phone-setup";

// وقت آخر رسالة بأسلوب الواتساب: اليوم = الساعة، أمس، أيام الأسبوع، وبعدها التاريخ
function formatChatTime(iso: string, lang: string): string {
  const date = new Date(iso);
  const now = new Date();
  const locale = lang === "ar" ? "ar-IQ" : "en";
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (days <= 0) {
    return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(date);
  }
  if (days === 1) return lang === "ar" ? "أمس" : "Yesterday";
  if (days < 7) return new Intl.DateTimeFormat(locale, { weekday: "long" }).format(date);
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "numeric", year: "2-digit" }).format(date);
}

export const Route = createFileRoute("/friends")({
  head: () => ({
    meta: [
      { title: "الأصدقاء — القبة" },
      {
        name: "description",
        content: "ابحث عن مستخدمين، أرسل طلبات صداقة، وتابع حالة الاتصال لحظة بلحظة.",
      },
      { property: "og:title", content: "الأصدقاء — القبة" },
      {
        property: "og:description",
        content: "ابحث عن مستخدمين، أرسل طلبات صداقة، وتابع حالة الاتصال لحظة بلحظة.",
      },
    ],
  }),
  component: FriendsPage,
});

function FriendsPage() {
  const { t, lang } = useI18n();
  const [query, setQuery] = useState("");
  const [cloudResults, setCloudResults] = useState<CloudUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [summaries, setSummaries] = useState<Record<string, FriendChatSummary>>({});
  // جهات الاتصال: null = مو تطبيق أندرويد، false = ما سمح، true = سمح
  const [contactsOk, setContactsOk] = useState<boolean | null>(null);
  const [contactMatches, setContactMatches] = useState<ContactMatch[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  
  const {
    profile,
    friends,
    blocked,
    relationOf,
    sendRequest,
    cancelRequest,
    acceptRequest,
    removeFriend,
    blockUser,
    unblockUser,
  } = useFriends();

  // محرك البحث السحابي المزدوج اللحظي (الاسم الثلاثي أو رقم الهاتف)
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      const q = query.trim();
      if (!q) {
        setCloudResults([]);
        return;
      }
      setIsSearching(true);
      try {
        // مطابقة الهوية الصافية برقم الهاتف المباشر المتوافق مع دالة الدخول الفوري الجديدة
        const res = await searchCloudUsers(q, profile.id);
        setCloudResults(res);
      } catch (err) {
        console.error("خطأ في جلب نتائج البحث السحابي:", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [query, profile]);

  // منو من جهات الاتصال عنده التطبيق (نعيد الفحص كل ما يرجع للصفحة، حتى لو فعّل الإذن هسه)
  useEffect(() => {
    if (!profile.id) return;
    let active = true;
    const check = async () => {
      const ok = contactsAllowed();
      if (!active) return;
      setContactsOk(ok);
      if (!ok) return;
      setLoadingContacts(true);
      try {
        const found = await findContactsOnApp();
        if (active) setContactMatches(found);
      } catch (err) {
        console.error("تعذر مطابقة جهات الاتصال:", err);
      } finally {
        if (active) setLoadingContacts(false);
      }
    };
    void check();
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [profile.id]);

  // تحميل آخر رسالة لكل صديق + تحديث لحظي عند وصول أي رسالة جديدة
  useEffect(() => {
    if (!profile.id) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const load = async () => {
      try {
        const next = await getFriendChatSummaries(profile.id);
        if (active) setSummaries(next);
      } catch (err) {
        console.error("تعذر تحميل آخر الرسائل:", err);
      }
    };
    const reloadSoon = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void load(), 400);
    };

    void load();
    const unsubscribe = subscribeToAllMyMessages(reloadSoon);
    const onVisible = () => {
      if (document.visibilityState === "visible") reloadSoon();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      active = false;
      clearTimeout(timer);
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [profile.id, friends.length]);

  // ترتيب مثل الواتساب: الأحدث محادثة فوق، والباقي أبجدياً + فلترة البحث بين الأصدقاء
  const visibleFriends = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    const list = friends.filter((person) => {
      if (!q) return true;
      return (
        person.name.toLowerCase().includes(q) ||
        person.nameEn.toLowerCase().includes(q) ||
        person.handle.toLowerCase().includes(q) ||
        (digits.length >= 3 && (person.phone ?? "").replace(/\D/g, "").includes(digits))
      );
    });
    return list.sort((a, b) => {
      const at = summaries[a.id]?.lastAt;
      const bt = summaries[b.id]?.lastAt;
      if (at && bt) return bt.localeCompare(at);
      if (at) return -1;
      if (bt) return 1;
      const an = lang === "ar" ? a.name : a.nameEn;
      const bn = lang === "ar" ? b.name : b.nameEn;
      return an.localeCompare(bn, lang === "ar" ? "ar" : "en");
    });
  }, [friends, summaries, query, lang]);

  // نتائج البحث السحابي بدون الأصدقاء الموجودين (يطلعون فوق بقائمة أصدقائي)
  const newPeople = useMemo(
    () => cloudResults.filter((person) => relationOf(person.id) !== "friend"),
    [cloudResults, relationOf],
  );

  // جهات الاتصال اللي عندهم التطبيق وبعدهم مو أصدقاء
  const contactPeople = useMemo(
    () => contactMatches.filter((c) => relationOf(c.id) !== "friend"),
    [contactMatches, relationOf],
  );

  const { startCall } = useCall();
  const handleAudioCall = (id: string, name: string) => {
    void startCall(id, name);
  };

  const handleSendCloudRequest = async (targetId: string, targetName: string) => {
    try {
      await sendRequest(targetId);
      toast.success(`🚀 انرسل طلب الصداقة إلى ${targetName}`);
    } catch (error) {
      console.error("فشل إرسال طلب الصداقة السحابي:", error);
      toast.error(friendlyDbError(error));
    }
  };

  const handleInvite = async () => {
    if (!profile.id) return;
    const result = await shareInvite(profile.id, profile.name);
    if (result === "copied") toast.success("📋 انسخ رابط الدعوة، الصقه لصديقك بالواتساب");
    else if (result === "failed") toast.error("ما گدرنا ننسخ الرابط");
  };

  return (
    <PageBody title={t("friendsTitle")} subtitle={t("friendsSubtitle")}>
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <Link
          to="/calls"
          className="flex w-full items-center gap-3 rounded-2xl border-2 border-line bg-cream p-3 text-start transition-colors hover:bg-line/10"
        >
          <span className="text-xl">🕘</span>
          <span className="min-w-0 flex-1 font-display text-sm font-extrabold">سجل المكالمات</span>
          <span className="text-muted-ink">←</span>
        </Link>

        <button
          type="button"
          onClick={handleInvite}
          className="bg-brand flex w-full items-center gap-3 rounded-2xl p-4 text-start shadow-sm transition-transform hover:scale-[1.01] cursor-pointer"
        >
          <span className="text-2xl">📨</span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-sm font-extrabold">ادعُ صديق برابط</span>
            <span className="block text-[11.5px] opacity-90">
              أرسله بالواتساب، وأول ما يفتحه ويسجّل تصيرون أصدقاء تلقائياً
            </span>
          </span>
        </button>

        {contactsOk === false && canOpenPhoneSetup() ? (
          <button
            type="button"
            onClick={openPhoneSetup}
            className="flex w-full items-center gap-3 rounded-2xl border-2 border-line bg-cream p-3 text-start transition-colors hover:bg-line/10 cursor-pointer"
          >
            <span className="text-xl">👥</span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-sm font-extrabold">اعرف منو من جهات اتصالك عنده التطبيق</span>
              <span className="block text-[11.5px] text-muted-ink">اختياري — الأرقام بس للمطابقة وما تنحفظ</span>
            </span>
            <span className="text-muted-ink">←</span>
          </button>
        ) : null}

        {contactsOk && !query.trim() && (contactPeople.length > 0 || loadingContacts) ? (
          <section className="space-y-2">
            <h2 className="font-mono text-[11px] tracking-widest text-muted-ink">
              — 📱 من جهات اتصالك ({contactPeople.length}) —
            </h2>
            {loadingContacts && contactPeople.length === 0 ? (
              <p className="text-sm text-muted-ink animate-pulse">ندوّر بجهات اتصالك…</p>
            ) : (
              contactPeople.map((c) => {
                const person = {
                  id: c.id,
                  name: c.name,
                  nameEn: c.name,
                  handle: c.handle,
                  role: "مستخدم حقيقي",
                  roleEn: "Real User",
                  status: c.status,
                  lastSeenMinutes: 0,
                  accent: "teal" as const,
                };
                const relation = relationOf(c.id);
                return (
                  <PersonRow
                    key={c.id}
                    person={person}
                    note={c.contactName ? `📱 محفوظ عندك: ${c.contactName}` : undefined}
                  >
                    {relation === "none" ? (
                      <RowButton tone="primary" onClick={() => handleSendCloudRequest(c.id, c.name)}>
                        {t("sendRequest")}
                      </RowButton>
                    ) : null}
                    {relation === "outgoing" ? (
                      <RowButton onClick={() => cancelRequest(c.id)}>{t("pending")} ✕</RowButton>
                    ) : null}
                    {relation === "incoming" ? (
                      <RowButton
                        tone="primary"
                        onClick={() =>
                          acceptRequest(c.id).catch((error) => toast.error(friendlyDbError(error)))
                        }
                      >
                        قبول الطلب
                      </RowButton>
                    ) : null}
                    {relation === "blocked" ? (
                      <RowButton onClick={() => unblockUser(c.id)}>{t("unblock")}</RowButton>
                    ) : null}
                  </PersonRow>
                );
              })
            )}
          </section>
        ) : null}

        <div className="flex items-center gap-2 rounded-2xl border-2 border-line bg-cream px-3 py-2">
          <span>🔍</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchUsers")}
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-ink/70"
          />
          {isSearching && <span className="shrink-0 text-xs text-muted-ink animate-pulse">لحظة…</span>}
        </div>

        <section className="space-y-2">
          <h2 className="font-mono text-[11px] tracking-widest text-muted-ink">
            — {t("myFriends")} ({query.trim() ? `${visibleFriends.length}/${friends.length}` : friends.length}) —
          </h2>
          {friends.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-line bg-cream/60 px-4 py-8 text-center text-sm text-muted-ink">
              {t("noFriends")}
            </p>
          ) : visibleFriends.length === 0 ? (
            <p className="text-sm text-muted-ink">
              {lang === "ar" ? "ماكو صديق بهذا الاسم" : "No friend matches"}
            </p>
          ) : (
            visibleFriends.map((person) => {
              const name = lang === "ar" ? person.name : person.nameEn;
              const summary = summaries[person.id];
              const preview = summary
                ? `${summary.lastSenderId === profile.id ? (lang === "ar" ? "أنت: " : "You: ") : ""}${summary.lastMessage}`
                : undefined;
              return (
                <PersonRow
                  key={person.id}
                  person={person}
                  lastMessage={preview}
                  lastTime={summary ? formatChatTime(summary.lastAt, lang) : undefined}
                  unread={summary?.unread ?? 0}
                  showQuickActions
                  onCall={(id) => handleAudioCall(id, name)}
                >
                  <RowButton tone="danger" onClick={() => removeFriend(person.id)}>
                    {t("removeFriend")}
                  </RowButton>
                  <RowButton tone="danger" onClick={() => blockUser(person.id)}>
                    {t("block")}
                  </RowButton>
                </PersonRow>
              );
            })
          )}
        </section>

        {query.trim() && (newPeople.length > 0 || isSearching || visibleFriends.length === 0) ? (
          <section className="space-y-2">
            <h2 className="font-mono text-[11px] tracking-widest text-muted-ink">
              — {lang === "ar" ? "أشخاص جدد تكدر تضيفهم" : "People you can add"} —
            </h2>
            {newPeople.length === 0 && !isSearching ? (
              <p className="text-sm text-muted-ink">{t("noResults")}</p>
            ) : (
              newPeople.map((cloudPerson) => {
                const person = {
                  id: cloudPerson.id,
                  name: cloudPerson.name,
                  nameEn: cloudPerson.name,
                  handle: cloudPerson.handle,
                  role: "مستخدم حقيقي",
                  roleEn: "Real User",
                  status: cloudPerson.status,
                  lastSeenMinutes: 0,
                  accent: "teal" as const
                };

                const relation = relationOf(person.id);
                const name = person.name;
                
                return (
                  <PersonRow 
                    key={person.id} 
                    person={person}
                    showQuickActions={relation === "friend"}
                    onCall={relation === "friend" ? (id) => handleAudioCall(id, name) : undefined}
                  >
                    {relation === "none" ? (
                      <RowButton
                        tone="primary"
                        onClick={() => handleSendCloudRequest(person.id, name)}
                      >
                        {t("sendRequest")}
                      </RowButton>
                    ) : null}
                    {relation === "outgoing" ? (
                      <RowButton onClick={() => cancelRequest(person.id)}>
                        {t("pending")} ✕
                      </RowButton>
                    ) : null}
                    {relation === "friend" ? (
                      <RowButton tone="danger" onClick={() => removeFriend(person.id)}>
                        {t("removeFriend")}
                      </RowButton>
                    ) : null}
                    {relation === "blocked" ? (
                      <RowButton onClick={() => unblockUser(person.id)}>
                        {t("unblock")}
                      </RowButton>
                    ) : (
                      <RowButton tone="danger" onClick={() => blockUser(person.id)}>
                        {t("block")}
                      </RowButton>
                    )}
                  </PersonRow>
                );
              })
            )}
          </section>
        ) : null}

        {blocked.length > 0 ? (
          <section className="space-y-2">
            <h2 className="font-mono text-[11px] tracking-widest text-muted-ink">
              — {t("blocked")} —
            </h2>
            {blocked.map((person) => (
              <PersonRow key={person.id} person={person}>
                <RowButton onClick={() => unblockUser(person.id)}>{t("unblock")}</RowButton>
              </PersonRow>
            ))}
          </section>
        ) : null}
      </div>
    </PageBody>
  );
}
