import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://etkacphlxhpdjhrvoaqz.supabase.co";
const supabaseAnonKey = "sb_publishable_qwvchdJI-viQlVbiDPtfhg_VG6UOjkk";
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type Profile = {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
};

export type Chat = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  chat_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};
