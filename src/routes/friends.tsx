import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageBody } from "@/components/app/AppShell";
import { PersonRow, RowButton } from "@/components/friends/PersonRow";
import { useFriends } from "@/lib/friends-store";
import { useI18n } from "@/lib/i18n";
import { searchCloudUsers, type CloudUser } from "@/lib/cloud-friends";

export const Route = createFileRoute("/friends")({
  head: () => ({
    meta: [
      { title: "الأصدقاء — الغباء الصناعي" },
      {
        name: "description",
        content: "ابحث عن مستخدمين، أرسل طلبات صداقة، وتابع حالة الاتصال لحظة بلحظة.",
      },
      { property: "og:title", content: "الأصدقاء — الغباء الصناعي" },
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
  
  const {
    profile,
    friends,
    blocked,
    relationOf,
    sendRequest,
    cancelRequest,
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

  const handleAudioCall = (id: string, name: string) => {
    toast.info(`📞 جاري بدء الاتصال الصوتي مع ${name}... (جاهز للربط السحابي)`);
  };

  const handleVideoCall = (id: string, name: string) => {
    toast.info(`📹 جاري بدء اتصال الفيديو مع ${name}... (جاهز للربط السحابي)`);
  };

  const handleSendCloudRequest = async (targetId: string, targetName: string) => {
    try {
      await sendRequest(targetId);
      toast.success(`🚀 ${t("requestSent")} بنجاح إلى ${targetName} عبر السحاب!`);
    } catch (error) {
      console.error("فشل إرسال طلب الصداقة السحابي:", error);
      toast.error("فشل إرسال طلب الصداقة السحابي، يرجى إعادة المحاولة.");
    }
  };

  return (
    <PageBody title={t("friendsTitle")} subtitle={t("friendsSubtitle")}>
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div className="flex items-center gap-2 rounded-2xl border-2 border-line bg-cream px-3 py-2">
          <span>🔍</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchUsers")}
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-ink/70"
          />
          {isSearching && <span className="text-xs text-muted-ink animate-pulse">جاري جلب السحاب...</span>}
        </div>

        {query.trim() ? (
          <section className="space-y-2">
            <h2 className="font-mono text-[11px] tracking-widest text-muted-ink">
              — {t("results")} —
            </h2>
            {cloudResults.length === 0 && !isSearching ? (
              <p className="text-sm text-muted-ink">{t("noResults")}</p>
            ) : (
              cloudResults.map((cloudPerson) => {
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
                    onAudioCall={relation === "friend" ? (id) => handleAudioCall(id, name) : undefined}
                    onVideoCall={relation === "friend" ? (id) => handleVideoCall(id, name) : undefined}
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

        <section className="space-y-2">
          <h2 className="font-mono text-[11px] tracking-widest text-muted-ink">
            — {t("myFriends")} ({friends.length}) —
          </h2>
          {friends.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-line bg-cream/60 px-4 py-8 text-center text-sm text-muted-ink">
              {t("noFriends")}
            </p>
          ) : (
            friends.map((person) => {
              const name = lang === "ar" ? person.name : person.nameEn;
              return (
                <PersonRow 
                  key={person.id} 
                  person={person}
                  onAudioCall={(id) => handleAudioCall(id, name)}
                  onVideoCall={(id) => handleVideoCall(id, name)}
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
