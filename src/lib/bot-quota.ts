import { supabase } from "./supabase";

// حد رسائل البوت: 20 مجانية باليوم، والباقي يشتريها المستخدم بالنقاط (نقطة = 5 رسائل)
// العدّ نفسه يصير بالسيرفر (supabase/bot-quota.sql)، مو بالتلفون، حتى محد يكدر يغش

export const QUOTA_TEXT_AR = "حبيبي خلصت سوالف اليوم 😂 شوف اعلان واخذ 5 رسائل مجانية لو تعال باچر";
export const QUOTA_TEXT_EN = "You're out of chats for today 😂 Watch an ad and get 5 free messages, or come back tomorrow";

/** هل هاي الرسالة هي رسالة "خلصت سوالفك"؟ (حتى نطلع وياها الأزرار ونشيلها من ذاكرة المحادثة) */
export function isQuotaMessage(content: string): boolean {
  return content === QUOTA_TEXT_AR || content === QUOTA_TEXT_EN;
}

export type BotQuota = { free_left: number; extra: number; daily_free: number; per_point: number };

export async function getMyBotQuota(): Promise<BotQuota | null> {
  const { data, error } = await supabase.rpc("my_bot_quota");
  if (error) {
    console.error("تعذر جلب رسائل البوت:", error);
    return null;
  }
  return (data as BotQuota | null) ?? null;
}

/** يخصم نقطة وحدة ويضيف 5 رسائل */
export async function buyBotMessages(): Promise<"bought" | "not_enough_points" | "not_authenticated" | "error"> {
  const { data, error } = await supabase.rpc("buy_bot_messages");
  if (error) {
    console.error("تعذر شراء رسائل:", error);
    return "error";
  }
  return data as "bought" | "not_enough_points" | "not_authenticated";
}
