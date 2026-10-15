import { supabase } from "./supabase";

// ربط الموقع بتطبيق الأندرويد: شاشة تجهيز التلفون + جهات الاتصال

type SetupBridge = {
  openSetup?: () => void;
  contactsAllowed?: () => boolean;
  getContacts?: () => string;
};

function bridge(): SetupBridge | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { GhabiyNative?: SetupBridge }).GhabiyNative ?? null;
}

/** هل نسخة التطبيق تدعم شاشة التجهيز؟ (النسخ القديمة ما بيها) */
export function canOpenPhoneSetup(): boolean {
  return typeof bridge()?.openSetup === "function";
}

export function openPhoneSetup() {
  bridge()?.openSetup?.();
}

/** null = مو تطبيق أندرويد (أو نسخة قديمة) */
export function contactsAllowed(): boolean | null {
  const b = bridge();
  if (!b || typeof b.contactsAllowed !== "function") return null;
  try {
    return b.contactsAllowed();
  } catch {
    return false;
  }
}

export type ContactMatch = {
  id: string;
  name: string;
  handle: string;
  status: "online" | "offline";
  contactName: string; // الاسم المحفوظ بتلفونك
};

/** يطابق أرقام جهات الاتصال ويرجّع منو منهم عنده التطبيق (الأرقام ما تنحفظ) */
export async function findContactsOnApp(): Promise<ContactMatch[]> {
  const b = bridge();
  if (!b || typeof b.getContacts !== "function") return [];
  let pairs: [string, string][] = [];
  try {
    pairs = JSON.parse(b.getContacts() || "[]");
  } catch {
    return [];
  }
  if (!Array.isArray(pairs) || pairs.length === 0) return [];

  const phones = pairs.map((p) => String(p[0] ?? ""));
  const { data, error } = await supabase.rpc("match_contacts", { p_phones: phones });
  if (error) throw error;

  return ((data as { idx: number; id: string; name: string; handle: string; status: string }[] | null) || []).map(
    (u) => ({
      id: String(u.id),
      name: u.name,
      handle: u.handle || "",
      status: u.status === "online" ? "online" : "offline",
      contactName: String(pairs[u.idx]?.[1] ?? ""),
    }),
  );
}
