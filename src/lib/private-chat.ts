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