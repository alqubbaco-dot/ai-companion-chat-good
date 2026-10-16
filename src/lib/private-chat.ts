import { supabase } from "./supabase";

export type PrivateConversation = {
  id: string;
  user_one_id: string;
  user_two_id: string;
  updated_at: string;
};

export type MessageKind = "text" | "image" | "audio";

export type PrivateMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  // للصور والرسائل الصوتية (supabase/chat-media.sql). النسخ القديمة ما بيها هذني
  kind?: MessageKind;
  media_path?: string | null;
  media_duration?: number | null;
  /** وقت قراءة الطرف الثاني للرسالة (بعد تشغيل last-seen-and-read.sql) */
  read_at?: string | null;
};

export const MEDIA_LABEL: Record<Exclude<MessageKind, "text">, string> = {
  image: "📷 صورة",
  audio: "🎤 رسالة صوتية",
};

export async function getOrCreatePrivateConversation(otherUserId: string): Promise<string> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error("Authentication is required");
  if (authData.user.id === otherUserId) throw new Error("Cannot message yourself");

  const { data, error } = await supabase.rpc("get_or_create_private_conversation", {
    other_user_id: otherUserId,
  });
  if (error) throw error;
  return data as string;
}

export async function getPrivateConversation(conversationId: string): Promise<PrivateConversation> {
  const { data, error } = await supabase
    .from("private_conversations")
    .select("id,user_one_id,user_two_id,updated_at")
    .eq("id", conversationId)
    .single();
  if (error) throw error;
  return data as PrivateConversation;
}

export async function getPrivateMessages(conversationId: string): Promise<PrivateMessage[]> {
  const { data, error } = await supabase
    .from("private_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []) as PrivateMessage[];
}

export async function sendPrivateMessage(
  conversationId: string,
  content: string,
): Promise<PrivateMessage> {
  const trimmed = content.trim();
  if (!trimmed) throw new Error("Message cannot be empty");

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error("Authentication is required");

  const { data, error } = await supabase
    .from("private_messages")
    .insert({
      conversation_id: conversationId,
      sender_id: authData.user.id,
      content: trimmed,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as PrivateMessage;
}

export function subscribeToPrivateMessages(
  conversationId: string,
  onMessage: (message: PrivateMessage) => void,
  onUpdate?: (message: PrivateMessage) => void,
) {
  const channel = supabase
    .channel(`private-messages:${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "private_messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => onMessage(payload.new as PrivateMessage),
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "private_messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => onUpdate?.(payload.new as PrivateMessage),
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
// ───────────── ترتيب الأصدقاء مثل الواتساب ─────────────

/** نبلّغ المرسل إن رسائله انقرت (علامة ✓✓ الزرقاء). يتجاهل الخطأ إذا ملف SQL بعده ما انشغّل */
export async function markConversationReadRemote(conversationId: string): Promise<void> {
  const { error } = await supabase.rpc("mark_conversation_read", { p_conversation: conversationId });
  if (error) console.warn("علامات القراءة غير مفعّلة بعد:", error.message);
}

export type FriendChatSummary = {
  conversationId: string;
  lastMessage: string;
  lastAt: string; // ISO
  lastSenderId: string;
  unread: number;
};

const READ_KEY = (conversationId: string) => `ai-chat:last-read:${conversationId}`;

// نخزن على هذا الجهاز آخر وقت قرأ بيه المستخدم المحادثة، حتى نحسب الرسائل غير المقروءة
export function markConversationRead(conversationId: string, at: string = new Date().toISOString()) {
  try {
    const previous = localStorage.getItem(READ_KEY(conversationId));
    if (!previous || previous < at) localStorage.setItem(READ_KEY(conversationId), at);
  } catch {
    /* التخزين غير متاح - نتجاهل */
  }
}

function getLastRead(conversationId: string): string | null {
  try {
    return localStorage.getItem(READ_KEY(conversationId));
  } catch {
    return null;
  }
}

// يرجع لكل صديق: آخر رسالة، وقتها، وعدد الرسائل غير المقروءة
export async function getFriendChatSummaries(
  myId: string,
): Promise<Record<string, FriendChatSummary>> {
  if (!myId) return {};

  const { data: conversations, error } = await supabase
    .from("private_conversations")
    .select("id,user_one_id,user_two_id")
    .or(`user_one_id.eq.${myId},user_two_id.eq.${myId}`);
  if (error) throw error;
  if (!conversations || conversations.length === 0) return {};

  const otherByConversation = new Map<string, string>();
  for (const c of conversations as PrivateConversation[]) {
    otherByConversation.set(c.id, c.user_one_id === myId ? c.user_two_id : c.user_one_id);
  }

  const { data: messages, error: messagesError } = await supabase
    .from("private_messages")
    .select("id,conversation_id,sender_id,content,created_at")
    .in("conversation_id", [...otherByConversation.keys()])
    .order("created_at", { ascending: false })
    .limit(1000);
  if (messagesError) throw messagesError;

  const result: Record<string, FriendChatSummary> = {};
  for (const m of (messages || []) as PrivateMessage[]) {
    const otherId = otherByConversation.get(m.conversation_id);
    if (!otherId) continue;
    let summary = result[otherId];
    if (!summary) {
      // أول رسالة نلگاها هي الأحدث لأن الترتيب تنازلي
      summary = result[otherId] = {
        conversationId: m.conversation_id,
        lastMessage: m.content,
        lastAt: m.created_at,
        lastSenderId: m.sender_id,
        unread: 0,
      };
    }
    if (m.sender_id !== myId) {
      const lastRead = getLastRead(m.conversation_id);
      if (!lastRead || m.created_at > lastRead) summary.unread += 1;
    }
  }
  return result;
}

// اشتراك لحظي بكل الرسائل الجديدة (الصلاحيات بقاعدة البيانات تخلي كل واحد يستلم رسائله فقط)
export function subscribeToAllMyMessages(onMessage: (message: PrivateMessage) => void) {
  const channel = supabase
    .channel(`private-messages:all:${Math.random().toString(36).slice(2)}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "private_messages" },
      (payload) => onMessage(payload.new as PrivateMessage),
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}


// ───────────── الصور والرسائل الصوتية ─────────────

const MEDIA_BUCKET = "chat-media";

function randomId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

/** يرفع ملف للمخزن الخاص ويرسل رسالة صورة/صوت */
export async function sendMediaMessage(
  conversationId: string,
  kind: "image" | "audio",
  file: Blob,
  options: { ext: string; contentType: string; duration?: number },
): Promise<PrivateMessage> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error("Authentication is required");

  const path = `${conversationId}/${randomId()}.${options.ext}`;
  const { error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, { contentType: options.contentType, upsert: false });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("private_messages")
    .insert({
      conversation_id: conversationId,
      sender_id: authData.user.id,
      content: MEDIA_LABEL[kind],
      kind,
      media_path: path,
      media_duration: options.duration ? Math.round(options.duration) : null,
    })
    .select("*")
    .single();
  if (error) {
    // الرسالة ما انحفظت: نمسح الملف حتى ما يبقى ملف يتيم
    void supabase.storage.from(MEDIA_BUCKET).remove([path]);
    throw error;
  }
  return data as PrivateMessage;
}

const urlCache = new Map<string, { url: string; expires: number }>();

/** رابط مؤقت (ساعة) لملف بالمحادثة. بس الطرفين يكدرون ياخذونه */
export async function getMediaUrl(path: string): Promise<string> {
  const cached = urlCache.get(path);
  if (cached && cached.expires > Date.now() + 60_000) return cached.url;
  const { data, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) throw error || new Error("no url");
  urlCache.set(path, { url: data.signedUrl, expires: Date.now() + 3600_000 });
  return data.signedUrl;
}

/** يصغّر الصورة قبل الرفع: أطول ضلع 1280 بكسل، JPEG لحد ~250 كيلوبايت */
export async function compressImage(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("bad image"));
      el.src = url;
    });
    const maxSide = 1280;
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    let quality = 0.8;
    let blob: Blob | null = null;
    for (let i = 0; i < 5; i++) {
      blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
      if (blob && blob.size <= 250_000) break;
      quality -= 0.12;
    }
    if (!blob) throw new Error("compress failed");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** عند حذف الحساب: نمسح الصور والأصوات اللي رفعها المستخدم */
export async function deleteMyChatMedia(myId: string): Promise<void> {
  const { data } = await supabase
    .from("private_messages")
    .select("media_path")
    .eq("sender_id", myId)
    .not("media_path", "is", null)
    .limit(1000);
  const paths = ((data || []) as { media_path: string | null }[])
    .map((row) => row.media_path)
    .filter((p): p is string => !!p);
  for (let i = 0; i < paths.length; i += 100) {
    await supabase.storage.from(MEDIA_BUCKET).remove(paths.slice(i, i + 100));
  }
}
