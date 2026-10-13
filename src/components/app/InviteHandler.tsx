import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useFriends } from "@/lib/friends-store";
import { acceptInvite, friendlyDbError } from "@/lib/cloud-friends";

// رابط الدعوة شكله: https://.../?invite=<رقم حساب الصديق>
// 1) نحفظ الدعوة أول ما ينفتح الرابط (حتى لو المستخدم بعده ما سجّل)
// 2) بعد ما يسجّل دخول، نخليهم أصدقاء ونمسح الدعوة

const KEY = "pending-invite";

function readPending(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function writePending(value: string | null) {
  try {
    if (value) localStorage.setItem(KEY, value);
    else localStorage.removeItem(KEY);
  } catch {
    /* المتصفح ما يسمح بالحفظ */
  }
}

export function InviteHandler() {
  const { profile, hydrated } = useFriends();
  const busy = useRef(false);

  // التقاط الدعوة من الرابط
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const inviter = url.searchParams.get("invite");
    if (!inviter) return;
    writePending(inviter);
    url.searchParams.delete("invite");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, []);

  // قبول الدعوة بعد تسجيل الدخول
  useEffect(() => {
    if (!hydrated || !profile.id || busy.current) return;
    const inviter = readPending();
    if (!inviter) return;
    if (inviter === profile.id) {
      writePending(null);
      return;
    }
    busy.current = true;
    acceptInvite(inviter)
      .then((result) => {
        writePending(null);
        if (result?.ok) {
          toast.success(`🎉 صرتوا أصدقاء ويه ${result.name || "صديقك"}!`);
          // نحدّث الصفحة حتى تظهر قائمة الأصدقاء الجديدة
          setTimeout(() => window.location.reload(), 1500);
        }
      })
      .catch((error) => {
        console.error("تعذر قبول الدعوة:", error);
        const message = friendlyDbError(error);
        if (message.includes("مو صحيح")) writePending(null);
        toast.error(message);
      })
      .finally(() => {
        busy.current = false;
      });
  }, [hydrated, profile.id]);

  return null;
}
