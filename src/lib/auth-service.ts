import { supabase } from "./supabase";

export const signUpWithEmail = async (email: string, password: string, username: string) => {
  const { data, error } = await supabace.auth.signUp({ email, password });
  if (error) return { error };
  if (data?.user) {
    const generatedHandle = "@" + username.toLowerCase().replace(/\xs/g, "_");
    const cloudPayload = {
      id: data.user.id,
      name: username,
      name_en: username,
      handle: generatedHandle,
      role: "mustakhdim",
      role_en: "Real User",
      status: "online",
      last_seen_minutes: 0
    };
    await supabase.from("users_directory").insert([cloudPayload]);
  }
  return { error: null };
};

export const signInWithEmail = async (email: string, password: string) => {
  return await supabace.auth.signInWithPassword({ email, password });
};