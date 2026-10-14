import { supabase } from "./supabase";

// نظام النقاط من جهة الصفحة: الرصيد، فتح الميزات، وطلب إعلان من تطبيق الأندرويد.
// النقطة نفسها تنضاف من السيرفر (/api/admob-ssv) بعد تأكيد Google، مو من هنا.

export type PointsState = {
  balance: number;
  total_earned: number;
  ads_today: number;
  daily_limit: number;
  unlocked: string[];
};

export type FeaturePrice = { feature: string; cost: number; title: string; sort_order: number };

export type UnlockResult = "unlocked" | "already_unlocked" | "not_enough_points" | "unknown_feature" | "not_authenticated";

export type AdEvent = { status: "loading" | "shown" | "rewarded" | "closed" | "failed"; message: string };

type AdBridge = {
  showRewardedAd?: () => void;
  isRewardedAdReady?: () => boolean;
};

function adBridge(): AdBridge | null {
  if (typeof window === "undefined") return null;
  const bridge = (window as unknown as { GhabiyNative?: AdBridge }).GhabiyNative;
  return bridge && typeof bridge.showRewardedAd === "function" ? bridge : null;
}

/** الإعلانات تشتغل بس داخل تطبيق الأندرويد (مو بالمتصفح) */
export function canWatchAds(): boolean {
  return adBridge() !== null;
}

export async function getMyPoints(): Promise<PointsState | null> {
  const { data, error } = await supabase.rpc("my_points");
  if (error) {
    console.error("تعذر جلب النقاط:", error);
    return null;
  }
  return (data as PointsState | null) ?? null;
}

export async function getFeaturePrices(): Promise<FeaturePrice[]> {
  const { data, error } = await supabase.from("feature_prices").select("*").order("sort_order");
  if (error) {
    console.error("تعذر جلب أسعار الميزات:", error);
    return [];
  }
  return (data as FeaturePrice[]) ?? [];
}

export async function unlockFeature(feature: string): Promise<UnlockResult | "error"> {
  const { data, error } = await supabase.rpc("unlock_feature", { p_feature: feature });
  if (error) {
    console.error("تعذر فتح الميزة:", error);
    return "error";
  }
  return data as UnlockResult;
}

/** يسمع لأحداث الإعلان من تطبيق الأندرويد */
export function onAdEvent(handler: (event: AdEvent) => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const listener = (e: Event) => handler((e as CustomEvent<AdEvent>).detail);
  window.addEventListener("ghabiy-ad", listener);
  return () => window.removeEventListener("ghabiy-ad", listener);
}

/** يطلب إعلان بمكافأة. يرجّع false إذا مو داخل التطبيق */
export function watchRewardedAd(): boolean {
  const bridge = adBridge();
  if (!bridge?.showRewardedAd) return false;
  bridge.showRewardedAd();
  return true;
}

/**
 * بعد ما المستخدم يكمّل الإعلان، تأكيد Google يوصل للسيرفر خلال ثواني،
 * فنعيد جلب الرصيد كم مرة لحد ما يزيد.
 */
export async function waitForNewPoint(previousTotal: number, tries = 6): Promise<PointsState | null> {
  let latest: PointsState | null = null;
  for (let i = 0; i < tries; i++) {
    await new Promise((r) => setTimeout(r, 1500 + i * 500));
    latest = await getMyPoints();
    if (latest && latest.total_earned > previousTotal) return latest;
  }
  return latest;
}
