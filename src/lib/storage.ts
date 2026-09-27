export const STORAGE_PREFIX = "ghabiy:";

export function readStored<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeStored<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable — ignore */
  }
}

// دالة تطهير آمنة ومخصصة تمسح الحسابات القديمة المربوطة بالبادئة لحل مشكلة الاتصال السحابي
export function clearStoredAuth(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_PREFIX + "profile");
    window.localStorage.removeItem(STORAGE_PREFIX + "relations");
    window.sessionStorage.clear();
  } catch {
    /* ignore */
  }
}

export function createId(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}
