import { supabase } from "./supabase";

export type PrivateConversation = {
  id: string;
  user_one_id: string;
  user_two_id: string;
  updated_at: string;
};

export type PrivateMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
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
    .select("id,conversation_id,sender_id,content,created_at")
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
    .select("id,conversation_id,sender_id,content,created_at")
    .single();
  if (error) throw error;
  return data as PrivateMessage;
}

export function subscribeToPrivateMessages(
  conversationId: string,
  onMessage: (message: PrivateMessage) => void,
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
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
// ───────────── ترتيب الأصدقاء مثل الواتساب ─────────────

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
