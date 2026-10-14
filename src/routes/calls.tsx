import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageBody } from "@/components/app/AppShell";
import { useFriends } from "@/lib/friends-store";
import { useCall } from "@/lib/call-store";
import { getCallLogs, type CallLog } from "@/lib/call-logs";

export const Route = createFileRoute("/calls")({
  head: () => ({
    meta: [
      { title: "سجل المكالمات — الغباء الصناعي" },
      { name: "description", content: "مكالماتك الصادرة والواردة والفائتة." },
    ],
  }),
  component: CallsPage,
});

function formatWhen(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  const time = new Intl.DateTimeFormat("ar-IQ", { hour: "numeric", minute: "2-digit" }).format(date);
  if (days <= 0) return `اليوم ${time}`;
  if (days === 1) return `أمس ${time}`;
  if (days < 7) return `${new Intl.DateTimeFormat("ar-IQ", { weekday: "long" }).format(date)} ${time}`;
  return new Intl.DateTimeFormat("ar-IQ", { day: "numeric", month: "short" }).format(date) + ` ${time}`;
}

function formatDuration(total: number) {
  if (total < 60) return `${total} ثانية`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return s ? `${m} دقيقة و${s} ثانية` : `${m} دقيقة`;
}

function describe(log: CallLog, mine: boolean): { label: string; missed: boolean } {
  // mine = أني المتصل
  if (log.status === "answered") {
    return { label: mine ? "صادرة" : "واردة", missed: false };
  }
  if (mine) {
    const labels: Record<string, string> = {
      missed: "ما رد",
      cancelled: "ملغاة",
      declined: "رفض المكالمة",
      busy: "الخط مشغول",
      failed: "ما ربطت",
    };
    return { label: labels[log.status] ?? "صادرة", missed: false };
  }
  if (log.status === "declined") return { label: "رفضتها", missed: false };
  return { label: "فائتة", missed: true };
}

function CallsPage() {
  const { profile, directory } = useFriends();
  const { startCall, phase } = useCall();
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLogs(await getCallLogs());
      setError(null);
    } catch (err) {
      console.error(err);
      setError("تعذر تحميل سجل المكالمات");
    } finally {
      setLoading(false);
    }
  }, []);

  // نحدّث السجل كل ما تخلص مكالمة
  useEffect(() => {
    if (phase === "idle") void load();
  }, [phase, load]);

  return (
    <PageBody title="سجل المكالمات" subtitle="مكالماتك الصادرة والواردة والفائتة">
      <div className="mx-auto w-full max-w-3xl space-y-2">
        {loading ? <p className="py-6 text-center text-sm text-muted-ink">لحظة…</p> : null}
        {error ? <p className="py-6 text-center text-sm text-coral">{error}</p> : null}
        {!loading && !error && logs.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-line bg-cream/60 px-4 py-10 text-center text-sm text-muted-ink">
            ماكو مكالمات بعد. اتصل بصديق وتطلع هنا 📞
          </p>
        ) : null}

        {logs.map((log) => {
          const mine = log.caller_id === profile.id;
          const otherId = mine ? log.callee_id : log.caller_id;
          const person = directory.find((p) => p.id === otherId);
          const name = person?.name || "صديق";
          const { label, missed } = describe(log, mine);
          return (
            <div
              key={log.id}
              className="flex items-center gap-3 rounded-2xl border-2 border-line/60 bg-cream/30 p-3"
            >
              <div className="grid size-11 shrink-0 place-items-center rounded-full bg-teal/20 font-display font-bold">
                {name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`break-words text-sm font-semibold leading-snug ${missed ? "text-red-600" : "text-ink"}`}>{name}</p>
                <p className={`text-[12px] leading-snug ${missed ? "text-red-600" : "text-muted-ink"}`}>
                  <span className="me-1">{mine ? "↗" : "↙"}</span>
                  {log.video ? "📹 " : "📞 "}
                  {label}
                  {log.status === "answered" && log.duration_seconds > 0
                    ? ` · ${formatDuration(log.duration_seconds)}`
                    : ""}
                </p>
                <p className="text-[11px] text-muted-ink">{formatWhen(log.started_at)}</p>
              </div>
              <div className="flex shrink-0 flex-col items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => void startCall(otherId, name, true)}
                  className="grid size-9 place-items-center rounded-full border-2 border-line bg-cream hover:bg-line/20"
                  aria-label="مكالمة فيديو"
                  title="مكالمة فيديو"
                >
                  📹
                </button>
                <button
                  type="button"
                  onClick={() => void startCall(otherId, name)}
                  className="grid size-9 place-items-center rounded-full bg-emerald-500 text-white"
                  aria-label="اتصال"
                  title="اتصال"
                >
                  📞
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </PageBody>
  );
}
