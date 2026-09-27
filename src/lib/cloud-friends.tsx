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
export async function searchCloudUsers(query: string, currentUserId: string): Promise<CloudUser[]> {
  const q = query.trim();
  if (!q) return [];

  try {
    // جلب الحسابات المتطابقة مع استثناء حساب المستخدم الحالي لمنع إرسال طلب لنفسه
    let request = supabase
      .from("users_directory")
      .select("id, name, handle, phone, status")
      .or(`name.ilike.%${q}%,phone.ilike.%${q}%`);

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
