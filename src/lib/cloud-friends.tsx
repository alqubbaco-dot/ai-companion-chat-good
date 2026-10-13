// التوجيه الهندسي الموحد: الاستيراد المباشر لعميل سوبابيز من ملف محطة الطاقة المركزية الأصلي لإنهاء التكرار والتداخل
import { supabase } from "./supabase";

export type CloudUser = {
  id: string;
  name: string;
  handle: string;
  phone: string;
  status: "online" | "offline";
};

/**
 * 1. دالة البحث الديناميكي المشترك (بالاسم الثلاثي الصريح أو رقم الهاتف)
 * تبحث في السحاب وتجلب الحسابات الحقيقية المتطابقة فوراً عبر العميل الموحد
 */
/** هل النص رقم موبايل؟ (أرقام فقط بعد حذف المسافات و + و -) */
export function looksLikePhone(text: string): boolean {
  const digits = text.replace(/[\s+\-()]/g, "");
  return /^\d{7,15}$/.test(digits);
}

/** رسالة واضحة لأخطاء قاعدة البيانات */
export function friendlyDbError(error: unknown): string {
  const e = error as { message?: string; code?: string } | null;
  const msg = e?.message || String(error);
  if (msg.includes("phone_taken")) return "هذا الرقم مسجّل بحساب ثاني.";
  if (msg.includes("bad_phone")) return "رقم الموبايل مو صحيح. اكتبه مثل 07701234567";
  if (msg.includes("bad_name")) return "الاسم لازم يكون بين حرفين و40 حرف.";
  if (msg.includes("not_signed_in")) return "لازم تسجّل دخول أول.";
  if (msg.includes("unknown_inviter")) return "رابط الدعوة مو صحيح.";
  if (e?.code === "PGRST202" || msg.includes("Could not find the function"))
    return "قاعدة البيانات تحتاج تحديث (ملف friends-and-phone.sql).";
  return `صار خطأ: ${msg}`;
}

/** حفظ اسمي و/أو رقمي */
export async function saveMyProfile(name: string | null, phone: string | null) {
  const { data, error } = await supabase.rpc("save_my_profile", {
    p_name: name && name.trim() ? name : null,
    p_phone: phone && phone.trim() ? phone : null,
  });
  if (error) throw error;
  return data as { ok: boolean; phone: string | null };
}

/** رقمي المحفوظ (يرجّع نص فارغ إذا ماكو) */
export async function getMyPhone(): Promise<string> {
  const { data, error } = await supabase.rpc("my_phone");
  if (error) return "";
  return (data as string | null) || "";
}

/** قبول رابط دعوة من صديق */
export async function acceptInvite(inviterId: string) {
  const { data, error } = await supabase.rpc("accept_invite", { p_inviter: inviterId });
  if (error) throw error;
  return data as { ok: boolean; name?: string; reason?: string };
}

/** رابط الدعوة الخاص بي */
export function inviteLink(userId: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://ai-companion-chat-good.vercel.app";
  return `${origin}/?invite=${encodeURIComponent(userId)}`;
}

/** مشاركة رابط الدعوة (واتساب وغيره)، وإذا ما يدعم المشاركة ننسخه */
export async function shareInvite(userId: string, myName: string): Promise<"shared" | "copied" | "failed"> {
  const url = inviteLink(userId);
  const text = `${myName ? myName + " يدعوك" : "تعال"} لتطبيق الغباء الصناعي 🤪 نسولف ونضحك سوية:`;
  if (typeof navigator !== "undefined" && "share" in navigator) {
    try {
      await navigator.share({ title: "الغباء الصناعي", text, url });
      return "shared";
    } catch {
      /* المستخدم سكّر نافذة المشاركة: نجرب النسخ */
    }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    return "copied";
  } catch {
    return "failed";
  }
}

export async function searchCloudUsers(query: string, currentUserId: string): Promise<CloudUser[]> {
  const q = query.trim();
  if (!q) return [];

  try {
    // إذا كتب رقم موبايل كامل: نبحث بالرقم (الرقم نفسه ما يطلع لأحد)
    if (looksLikePhone(q)) {
      const { data, error } = await supabase.rpc("find_user_by_phone", { p_phone: q });
      if (error) throw error;
      return ((data as { id: string; name: string; handle: string; status: string }[] | null) || []).map(
        (u) => ({
          id: String(u.id),
          name: u.name,
          handle: u.handle || "",
          phone: "",
          status: u.status === "online" ? "online" : "offline",
        }),
      );
    }

    // جلب الحسابات المتطابقة بالاسم أو اسم المستخدم، مع استثناء حساب المستخدم الحالي
    const safe = q.replace(/[,()%]/g, " ").trim();
    if (!safe) return [];
    let request = supabase
      .from("users_directory")
      .select("id, name, handle, phone, status")
      .or(`name.ilike.%${safe}%,handle.ilike.%${safe}%`);

    if (currentUserId) request = request.neq("id", currentUserId);

    const { data, error } = await request;

    if (error) throw error;
    if (!data) return [];

    return data as CloudUser[];
  } catch (err) {
    console.error("خطأ أثناء محرك البحث السحابي الموحد:", err);
    return [];
  }
}

/**
 * 2. دالة إرسال طلب صداقة حقيقي ومزامنته في السحاب
 */
export async function sendFriendRequest(senderId: string, receiverId: string): Promise<boolean> {
  if (!senderId || !receiverId) return false;

  try {
    const { error } = await supabase
      .from("friendships")
      .insert([
        {
          sender_id: senderId,
          receiver_id: receiverId,
          status: "pending" // حالة معلقة حتى يقبلها الطرف الثاني
        }
      ]);

    if (error) {
      console.error("فشل إرسال طلب الصداقة السحابي الموحد:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("خطأ غير متوقع في المزامنة السحابية الموحدة:", err);
    return false;
  }
}

/**
 * 3. دالة جلب قائمة طلبات الصداقة المعلقة الحية لكل هاتف
 */
export async function fetchPendingRequests(userId: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from("friendships")
      .select(`
        id,
        status,
        sender_id,
        users_directory!friendships_sender_id_fkey(name, handle, phone)
      `)
      .eq("receiver_id", userId)
      .eq("status", "pending");

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("خطأ في جلب الطلبات المعلقة الموحدة:", err);
    return [];
  }
}
