import { createFileRoute } from "@tanstack/react-router";
import { PageBody } from "@/components/app/AppShell";
import { PersonRow, RowButton } from "@/components/friends/PersonRow";
import { useFriends } from "@/lib/friends-store";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/requests")({
  head: () => ({
    meta: [
      { title: "طلبات الصداقة — الغباء الصناعي" },
      { name: "description", content: "اقبل أو ارفض طلبات الصداقة الواردة وتابع طلباتك المرسلة." },
      { property: "og:title", content: "طلبات الصداقة — الغباء الصناعي" },
      {
        property: "og:description",
        content: "اقبل أو ارفض طلبات الصداقة الواردة وتابع طلباتك المرسلة.",
      },
    ],
  }),
  component: RequestsPage,
});

function RequestsPage() {
  const { t } = useI18n();
  const { incoming, outgoing, acceptRequest, rejectRequest, blockUser, cancelRequest } =
    useFriends();

  return (
    <PageBody title={t("requestsTitle")} subtitle={t("requestsSubtitle")}>
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <section className="space-y-2">
          <h2 className="font-mono text-[11px] tracking-widest text-muted-ink">
            — {t("incoming")} ({incoming.length}) —
          </h2>
          {incoming.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-line bg-cream/60 px-4 py-8 text-center text-sm text-muted-ink">
              {t("noRequests")}
            </p>
          ) : (
            incoming.map((person) => (
              <PersonRow key={person.id} person={person}>
                <RowButton tone="primary" onClick={() => acceptRequest(person.id)}>
                  {t("accept")}
                </RowButton>
                <RowButton onClick={() => rejectRequest(person.id)}>{t("reject")}</RowButton>
                <RowButton tone="danger" onClick={() => blockUser(person.id)}>
                  {t("block")}
                </RowButton>
              </PersonRow>
            ))
          )}
        </section>

        <section className="space-y-2">
          <h2 className="font-mono text-[11px] tracking-widest text-muted-ink">
            — {t("outgoing")} ({outgoing.length}) —
          </h2>
          {outgoing.length === 0 ? (
            <p className="text-sm text-muted-ink">{t("noRequests")}</p>
          ) : (
            outgoing.map((person) => (
              <PersonRow key={person.id} person={person} note={t("pending")}>
                <RowButton onClick={() => cancelRequest(person.id)}>✕</RowButton>
              </PersonRow>
            ))
          )}
        </section>
      </div>
    </PageBody>
  );
}
