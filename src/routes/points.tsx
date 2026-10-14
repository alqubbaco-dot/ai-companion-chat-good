import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageBody } from "@/components/app/AppShell";
import { ACCENTS, useTheme } from "@/lib/theme";
import {
  canWatchAds,
  getFeaturePrices,
  getMyPoints,
  onAdEvent,
  unlockFeature,
  waitForNewPoint,
  watchRewardedAd,
  type FeaturePrice,
  type PointsState,
} from "@/lib/ad-points";

export const Route = createFileRoute("/points")({
  head: () => ({
    meta: [
      { title: "نقاطي — الغباء الصناعي" },
      { name: "description", content: "اجمع نقاط من الإعلانات وافتح ميزات جديدة." },
    ],
  }),
  component: PointsPage,
});

const FEATURE_EMOJI: Record<string, string> = {
  themes: "🎨",
  ringtone: "🔔",
  funny_characters: "🤡",
  voice_changer: "🎙️",
};

// الميزات الجاهزة فعلاً بالتطبيق. الباقي يطلع "قريباً" وما ينشرى لحد ما نبنيه
const READY_FEATURES = new Set(["themes"]);

const AD_ERRORS: Record<string, string> = {
  login_required: "سجّل دخولك أول حتى تنحسب النقاط باسمك",
  no_fill: "ماكو إعلانات متوفرة هسه، جرّب بعد شوية",
};

function PointsPage() {
  const [points, setPoints] = useState<PointsState | null>(null);
  const [prices, setPrices] = useState<FeaturePrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [adBusy, setAdBusy] = useState(false);
  const [unlocking, setUnlocking] = useState<string | null>(null);
  const [native, setNative] = useState(false);
  const { accent, setAccent } = useTheme();
  const rewarded = useRef(false);
  const totalBefore = useRef(0);

  const refresh = useCallback(async () => {
    const [p, f] = await Promise.all([getMyPoints(), getFeaturePrices()]);
    if (p) setPoints(p);
    setPrices(f);
    setLoading(false);
  }, []);

  useEffect(() => {
    setNative(canWatchAds());
    void refresh();
  }, [refresh]);

  // أحداث الإعلان من تطبيق الأندرويد
  useEffect(() => {
    return onAdEvent((event) => {
      if (event.status === "loading") return;
      if (event.status === "shown") {
        rewarded.current = false;
        return;
      }
      if (event.status === "rewarded") {
        rewarded.current = true;
        return;
      }
      if (event.status === "failed") {
        setAdBusy(false);
        toast.error(AD_ERRORS[event.message] || "ما اشتغل الإعلان، جرّب مرة ثانية");
        return;
      }
      if (event.status === "closed") {
        if (!rewarded.current) {
          setAdBusy(false);
          toast("لازم تكمّل الإعلان للآخر حتى تاخذ النقطة 🙂");
          return;
        }
        // Google تبلّغ السيرفر خلال ثواني، ننتظر لحد ما توصل النقطة
        void waitForNewPoint(totalBefore.current).then((latest) => {
          setAdBusy(false);
          if (latest) setPoints(latest);
          if (latest && latest.total_earned > totalBefore.current) {
            toast.success("+1 نقطة ⭐");
          } else {
            toast("النقطة بالطريق… إذا ما بانت، حدّث الصفحة بعد دقيقة");
          }
        });
      }
    });
  }, []);

  const watchAd = () => {
    if (adBusy) return;
    totalBefore.current = points?.total_earned ?? 0;
    rewarded.current = false;
    if (!watchRewardedAd()) {
      toast("الإعلانات تشتغل بس داخل تطبيق الأندرويد");
      return;
    }
    setAdBusy(true);
  };

  const unlock = async (feature: FeaturePrice) => {
    setUnlocking(feature.feature);
    const result = await unlockFeature(feature.feature);
    setUnlocking(null);
    if (result === "unlocked") {
      toast.success(`انفتحت: ${feature.title} 🎉`);
      void refresh();
    } else if (result === "not_enough_points") {
      toast.error("نقاطك ما تكفي بعد");
    } else if (result === "already_unlocked") {
      toast("هاي الميزة مفتوحة عندك من قبل");
    } else {
      toast.error("صار خطأ، جرّب مرة ثانية");
    }
  };

  const balance = points?.balance ?? 0;
  const adsToday = points?.ads_today ?? 0;
  const limit = points?.daily_limit ?? 15;
  const reachedLimit = adsToday >= limit;
  const unlocked = new Set(points?.unlocked ?? []);

  return (
    <PageBody title="نقاطي ⭐" subtitle="شوف إعلان، اجمع نقاط، وافتح ميزات جديدة">
      <div className="mx-auto w-full max-w-3xl space-y-5 pb-6">
        {/* الرصيد */}
        <section className="rounded-3xl border-2 border-line bg-butter p-5 text-butter-ink">
          <p className="text-sm font-semibold">رصيدك</p>
          <p className="mt-1 font-display text-5xl font-extrabold leading-none">
            {loading ? "…" : balance}
            <span className="ms-2 text-xl">نقطة</span>
          </p>
          <div className="mt-4">
            <div className="flex justify-between text-[12px] font-semibold">
              <span>إعلانات اليوم</span>
              <span className="font-mono">
                {adsToday} / {limit}
              </span>
            </div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-butter-ink/15">
              <div
                className="h-full rounded-full bg-butter-ink transition-all"
                style={{ width: `${Math.min(100, (adsToday / limit) * 100)}%` }}
              />
            </div>
          </div>
        </section>

        {/* زر الإعلان */}
        <section className="space-y-2">
          <button
            type="button"
            onClick={watchAd}
            disabled={adBusy || reachedLimit || loading}
            className="w-full rounded-2xl border-2 border-line bg-ink px-5 py-4 font-display text-lg font-extrabold text-cream transition-opacity disabled:opacity-50"
          >
            {adBusy ? "لحظة… 📺" : reachedLimit ? "خلصت إعلانات اليوم، ارجع باجر 🌙" : "اربح نقطة 🎁"}
          </button>
          {!native && !loading ? (
            <p className="text-center text-[12px] text-muted-ink">
              الإعلانات تشتغل بس داخل تطبيق الأندرويد، بس تكدر تشوف رصيدك من هنا.
            </p>
          ) : (
            <p className="text-center text-[12px] text-muted-ink">كل إعلان تكمّله للآخر = نقطة وحدة</p>
          )}
        </section>

        {/* اختيار الثيم (بعد فتح ميزة الثيمات) */}
        {unlocked.has("themes") ? (
          <section className="rounded-3xl border-2 border-line bg-cream p-4">
            <h2 className="font-display text-lg font-extrabold">🎨 ثيم الألوان</h2>
            <p className="text-[12px] text-muted-ink">اختار اللون اللي يعجبك، ويتغيّر التطبيق كله فوراً</p>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAccent(a.id)}
                  aria-pressed={accent === a.id}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 p-2 transition-colors ${
                    accent === a.id ? "border-ink bg-ink/5" : "border-line/60 hover:border-line"
                  }`}
                >
                  <span className="size-9 rounded-full ring-2 ring-cream" style={{ background: a.swatch }} />
                  <span className="text-[12px] font-semibold">{a.label}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {/* متجر الميزات */}
        <section>
          <h2 className="mb-2 font-display text-lg font-extrabold">متجر الميزات</h2>
          <div className="space-y-2">
            {prices.map((f) => {
              const isOpen = unlocked.has(f.feature);
              const ready = READY_FEATURES.has(f.feature);
              const affordable = balance >= f.cost;
              const missing = Math.max(0, f.cost - balance);
              return (
                <div
                  key={f.feature}
                  className={`flex items-center gap-3 rounded-2xl border-2 p-3 ${
                    isOpen ? "border-teal bg-teal/10" : "border-line/60 bg-cream/30"
                  }`}
                >
                  <div className="grid size-11 shrink-0 place-items-center rounded-full bg-cream text-xl">
                    {FEATURE_EMOJI[f.feature] ?? "✨"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-semibold leading-snug">{f.title}</p>
                    <p className="text-[12px] text-muted-ink">
                      {isOpen
                        ? "مفتوحة عندك ✅"
                        : !ready
                          ? `${f.cost} نقطة · قريباً 🔜`
                          : affordable
                            ? `${f.cost} نقطة`
                            : `${f.cost} نقطة · باقي لك ${missing}`}
                    </p>
                  </div>
                  {isOpen ? null : (
                    <button
                      type="button"
                      onClick={() => void unlock(f)}
                      disabled={!ready || !affordable || unlocking !== null}
                      className="shrink-0 rounded-full border-2 border-line bg-butter px-4 py-1.5 text-sm font-bold text-butter-ink disabled:bg-transparent disabled:text-muted-ink disabled:opacity-60"
                    >
                      {unlocking === f.feature ? "…" : !ready ? "قريباً" : affordable ? "افتح" : "🔒"}
                    </button>
                  )}
                </div>
              );
            })}
            {!loading && prices.length === 0 ? (
              <p className="rounded-2xl border-2 border-dashed border-line px-4 py-6 text-center text-sm text-muted-ink">
                تعذر تحميل الميزات، حدّث الصفحة
              </p>
            ) : null}
          </div>
          <p className="mt-3 text-center text-[11px] text-muted-ink">
            الميزات اللي مكتوب عليها «قريباً» دا نبنيها، وتنفتح للشراء أول ما تجهز.
          </p>
        </section>
      </div>
    </PageBody>
  );
}
