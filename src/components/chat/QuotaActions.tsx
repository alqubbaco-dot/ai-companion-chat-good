import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { canWatchAds, getMyPoints, onAdEvent, waitForNewPoint, watchRewardedAd } from "@/lib/ad-points";
import { buyBotMessages } from "@/lib/bot-quota";

// الأزرار اللي تطلع تحت رسالة "خلصت سوالف اليوم":
// شاهد إعلان ← تنضاف نقطة ← تتحول تلقائياً لـ 5 رسائل
// أو استخدم نقطة من رصيدك مباشرة
export function QuotaActions() {
  const [native, setNative] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const rewarded = useRef(false);
  const waitingAd = useRef(false);
  const totalBefore = useRef(0);

  useEffect(() => {
    setNative(canWatchAds());
    void getMyPoints().then((p) => setBalance(p?.balance ?? 0));
  }, []);

  const spendPoint = async () => {
    const result = await buyBotMessages();
    if (result === "bought") {
      toast.success("+5 رسائل 🎉 كمّل سوالفك");
    } else if (result === "not_enough_points") {
      toast.error("نقاطك ما تكفي، شوف إعلان");
    } else {
      toast.error("صار خطأ، جرّب مرة ثانية");
    }
    const p = await getMyPoints();
    setBalance(p?.balance ?? 0);
  };

  useEffect(() => {
    return onAdEvent((event) => {
      if (!waitingAd.current) return;
      if (event.status === "shown") {
        rewarded.current = false;
      } else if (event.status === "rewarded") {
        rewarded.current = true;
      } else if (event.status === "failed") {
        waitingAd.current = false;
        setBusy(false);
        toast.error(event.message === "no_fill" ? "ماكو إعلانات هسه، جرّب بعد شوية" : "ما اشتغل الإعلان، جرّب مرة ثانية");
      } else if (event.status === "closed") {
        waitingAd.current = false;
        if (!rewarded.current) {
          setBusy(false);
          toast("لازم تكمّل الإعلان للآخر حتى تاخذ الرسائل 🙂");
          return;
        }
        void waitForNewPoint(totalBefore.current).then(async (latest) => {
          if (latest && latest.total_earned > totalBefore.current) {
            await spendPoint();
          } else {
            toast("الرسائل بالطريق… جرّب بعد دقيقة");
          }
          setBusy(false);
        });
      }
    });
  }, []);

  const watchAd = async () => {
    if (busy) return;
    const p = await getMyPoints();
    totalBefore.current = p?.total_earned ?? 0;
    rewarded.current = false;
    if (!watchRewardedAd()) {
      toast("الإعلانات تشتغل بس داخل تطبيق الأندرويد");
      return;
    }
    waitingAd.current = true;
    setBusy(true);
  };

  const spendFromBalance = async () => {
    if (busy) return;
    setBusy(true);
    await spendPoint();
    setBusy(false);
  };

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {native ? (
        <button
          type="button"
          onClick={watchAd}
          disabled={busy}
          className="rounded-full border-2 border-line bg-ink px-4 py-2 text-[13px] font-bold text-cream disabled:opacity-50"
        >
          {busy ? "لحظة… 📺" : "شاهد إعلان 📺"}
        </button>
      ) : null}
      {balance !== null && balance > 0 ? (
        <button
          type="button"
          onClick={spendFromBalance}
          disabled={busy}
          className="rounded-full border-2 border-line bg-butter px-4 py-2 text-[13px] font-bold text-butter-ink disabled:opacity-50"
        >
          استخدم نقطة ⭐ (عندك {balance})
        </button>
      ) : null}
      {!native && !balance ? (
        <p className="text-[12px] text-muted-ink">الإعلانات تشتغل بس داخل تطبيق الأندرويد</p>
      ) : null}
    </div>
  );
}
