// نغمات رنين القبة (تأليف أصلي، الملفات بـ public/ringtones ونسخة بتطبيق الأندرويد res/raw)
// "رنين القبة" ببلاش للكل، والباقي ينفتح بميزة "ringtone" بالنقاط

export type Ringtone = { id: string; name: string; hint: string; free?: boolean };

export const RINGTONE_FEATURE = "ringtone";

export const RINGTONES: Ringtone[] = [
  { id: "qubba", name: "رنين القبة", hint: "جرس مزدوج كلاسيكي", free: true },
  { id: "bayati", name: "مقام بيات", hint: "نقر عود ويه دوم" },
  { id: "hijaz", name: "مقام حجاز", hint: "دخلة قانون درامية" },
  { id: "darbuka", name: "دربكة", hint: "إيقاع مقسوم" },
  { id: "marimba", name: "ماريمبا", hint: "مرحة وخفيفة" },
  { id: "news", name: "خبر عاجل", hint: "موسيقى نشرة أخبار" },
  { id: "kia", name: "سايق الكيا", hint: "طوط طوط ويه دربكة" },
  { id: "calm", name: "هادئة", hint: "أجراس ناعمة" },
];

const KEY = "ringtone";

type RingBridge = { getRingtone?: () => string; setRingtone?: (id: string) => void };

function bridge(): RingBridge | null {
  if (typeof window === "undefined") return null;
  const b = (window as unknown as { GhabiyNative?: RingBridge }).GhabiyNative;
  return b && typeof b.setRingtone === "function" ? b : null;
}

export function ringtoneUrl(id: string): string {
  return `/ringtones/${id}.mp3`;
}

export function getRingtone(): string {
  try {
    const native = bridge()?.getRingtone?.();
    if (native && RINGTONES.some((r) => r.id === native)) return native;
  } catch {
    /* */
  }
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && RINGTONES.some((r) => r.id === saved)) return saved;
  } catch {
    /* */
  }
  return "qubba";
}

export function setRingtone(id: string): void {
  if (!RINGTONES.some((r) => r.id === id)) return;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* */
  }
  try {
    bridge()?.setRingtone?.(id);
  } catch {
    /* */
  }
}
