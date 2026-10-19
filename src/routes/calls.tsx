import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createFileRoute } from "@tanstack/react-router";
import { PageBody } from "@/components/app/AppShell";
import { useFriends } from "@/lib/friends-store";
import { useCall } from "@/lib/call-store";
import { clearCallLogs, getCallLogs, hideCallLogs, type CallLog } from "@/lib/call-logs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/calls")({
  head: () => ({
    meta: [
      { title: "سجل المكالمات — القبة" },
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
  const { profile, directory, ensureUsers } = useFriends();
  const { startCall, phase } = useCall();
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // التأكيد قبل المسح: "all" = كل السجل، أو مكالمة وحدة
  const [confirm, setConfirm] = useState<"all" | CallLog | null>(null);
  const [busy, setBusy] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const load = useCallback(async () => {
    if (!profile.id) return;
    try {
      setLogs(await getCallLogs(profile.id));
      setError(null);
    } catch (err) {
      console.error(err);
      setError("تعذر تحميل سجل المكالمات");
    } finally {
      setLoading(false);
    }
  }, [profile.id]);

  // نحدّث السجل كل ما تخلص مكالمة
  useEffect(() => {
    if (phase === "idle") void load();
  }, [phase, load]);

  // أسماء وصور الأشخاص بالسجل اللي مو بقائمة أصدقائي (مثلاً صديق محذوف)
  useEffect(() => {
    if (!profile.id) return;
    ensureUsers(logs.map((log) => (log.caller_id === profile.id ? log.callee_id : log.caller_id)));
  }, [logs, profile.id, ensureUsers]);

  // ضغط مطوّل على المكالمة = حذفها
  const startPress = (log: CallLog) => {
    clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => {
      navigator.vibrate?.(30);
      setConfirm(log);
    }, 550);
  };
  const cancelPress = () => clearTimeout(pressTimer.current);
  useEffect(() => () => clearTimeout(pressTimer.current), []);

  const doDelete = async () => {
    const target = confirm;
    if (!target) return;
    setBusy(true);
    const before = logs;
    // نشيلها من الشاشة فوراً، وإذا فشل نرجّعها
    setLogs(target === "all" ? [] : logs.filter((l) => l.id !== target.id));
    setConfirm(null);
    try {
      if (target === "all") await clearCallLogs();
      else await hideCallLogs([target.id]);
      toast.success(target === "all" ? "انمسح السجل" : "انحذفت المكالمة");
    } catch (err) {
      console.error(err);
      setLogs(before);
      const msg = err instanceof Error ? err.message : "";
      toast.error(
        /hide_call_logs|clear_call_logs|function/.test(msg)
          ? "المسح بعده ما مفعّل: لازم يتشغّل ملف call-logs-hide.sql بـ Supabase"
          : "تعذر المسح، حاول مرة ثانية",
        { duration: 8000 },
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageBody title="سجل المكالمات" subtitle="مكالماتك الصادرة والواردة والفائتة">
      <div className="mx-auto w-full max-w-3xl space-y-2">
        {logs.length > 0 ? (
          <div className="flex items-center justify-between gap-2 pb-1">
            <p className="text-[11px] text-muted-ink">اضغط مطوّلاً على مكالمة حتى تحذفها</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirm("all")}
              className="shrink-0 rounded-full border-2 border-line bg-cream px-3 py-1 text-[12px] font-semibold text-red-600 hover:bg-line/20 disabled:opacity-50"
            >
              🗑️ مسح السجل
            </button>
          </div>
        ) : null}
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
              onPointerDown={(e) => {
                // الضغط على أزرار الاتصال ما يحسب
                if ((e.target as HTMLElement).closest("button")) return;
                startPress(log);
              }}
              onPointerUp={cancelPress}
              onPointerLeave={cancelPress}
              onPointerCancel={cancelPress}
              onContextMenu={(e) => {
                e.preventDefault();
                cancelPress();
                setConfirm(log);
              }}
              className="flex select-none items-center gap-3 rounded-2xl border-2 border-line/60 bg-cream/30 p-3 [-webkit-touch-callout:none]"
            >
              {person?.avatarUrl ? (
                <img
                  src={person.avatarUrl}
                  alt=""
                  className="size-11 shrink-0 rounded-full object-cover"
                  draggable={false}
                />
              ) : (
                <div className="grid size-11 shrink-0 place-items-center rounded-full bg-teal/20 font-display font-bold">
                  {name.charAt(0)}
                </div>
              )}
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

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === "all" ? "مسح كل السجل؟" : "حذف هذه المكالمة؟"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "all"
                ? "تنمسح كل المكالمات من سجلك أنت فقط، وتبقى بسجل أصدقائك."
                : "تنحذف من سجلك أنت فقط، وتبقى بسجل صديقك."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>لا</AlertDialogCancel>
            <AlertDialogAction onClick={() => void doDelete()} className="bg-red-600 text-white hover:bg-red-700">
              {confirm === "all" ? "امسح الكل" : "احذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageBody>
  );
}
