
import { useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useFriends } from "@/lib/friends-store"; 
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { friendlyDbError, saveMyProfile } from "@/lib/cloud-friends";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

type LoginMode = "signup" | "signin";

function LoginPage() {
  const { refreshProfile } = useFriends();
  const router = useRouter();
  
  const [mode, setMode] = useState<LoginMode>("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (mode === "signup" && !cleanName) {
      toast.error("اكتب اسمك حتى نسوّيلك الحساب.");
      return;
    }

    if (!cleanEmail) {
      toast.error("اكتب إيميلك.");
      return;
    }

    if (!cleanPassword || cleanPassword.length < 6) {
      toast.error("كلمة السر لازم تكون 6 أحرف أو أكثر.");
      return;
    }

    setIsSubmitting(true);
    
    try {
      const finalName = cleanName;
      let authUserId = "";
      
      if (mode === "signup") {
        // 🟢 1. حفر ومصادقة الحساب الشرعي داخل نظام أمان Supabase Auth (Emails)
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: cleanEmail,
          password: cleanPassword,
        });

        if (authError) {
          toast.error(`ما گدرنا نسوّي الحساب: ${authError.message}`);
          setIsSubmitting(false);
          return;
        }

          authUserId = authData.user?.id || "";
          if (authData.user && authData.session) {
            // نحفظ الاسم والرقم عن طريق قاعدة البيانات. إذا فشل ما نوقف التسجيل،
            // لأن السجل ينسوّى تلقائياً بأول دخول، والمستخدم يكدر يعدّله من حسابي
            try {
              await saveMyProfile(finalName, phone.trim() || null);
            } catch (profileError) {
              console.error("تعذر حفظ الملف الشخصي وقت التسجيل:", profileError);
              const message = friendlyDbError(profileError);
              if (message.includes("الرقم")) toast.error(message);
            }
          }
      } else {
        // 🔐 في حالة تسجيل دخول مسجل قديم، المطابقة والعبور الصارم بالإيميل والرمز
        const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        });

        if (signInError) {
          toast.error(`الإيميل أو كلمة السر غلط: ${signInError.message}`);
          setIsSubmitting(false);
          return;
        }

        authUserId = authData.user?.id || "";
      }

      if (!authUserId) {
        toast.error("صار خلل بالدخول، جرّب مرة ثانية.");
        setIsSubmitting(false);
        return;
      }

      await refreshProfile();
      
      if (mode === "signup") {
        toast.success(`🎉 أهلاً بيك! حسابك صار جاهز.`);
      } else {
        toast.success(`👋 هلا بيك من جديد!`);
      }
      
      router.navigate({ to: "/" });

    } catch (err: unknown) {
      console.error("خطأ أثناء معالجة الهوية السحابية والمحلية:", err);
      toast.error("صار خلل بالدخول، جرّب مرة ثانية.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--brand-to)_30%,transparent)_0%,transparent_60%)] px-4 py-4 sm:py-8">
      <div className="w-full max-w-md space-y-4 rounded-3xl border border-line bg-cream/95 p-5 sm:p-8 shadow-xl backdrop-blur animate-rise">
        
        <div className="text-center">
          <img
            src="/icons/logo.webp"
            alt="الغباء الصناعي"
            width={80}
            height={80}
            className="mx-auto size-20 rounded-[30%] shadow-lg"
            draggable={false}
          />
          <p className="mt-2 font-display text-sm font-bold text-butter">الغباء الصناعي</p>
          <h2 className="mt-2 font-display text-xl font-extrabold tracking-tight text-ink">
            {mode === "signup" ? "حساب جديد" : "تسجيل الدخول"}
          </h2>
          <p className="mt-1 text-[11px] font-semibold text-muted-ink">
            {mode === "signup" ? "سوّي حسابك وابدأ السوالف ويه الغباء الصناعي" : "دخّل إيميلك وكلمة السر وارجع لسوالفك"}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-1 rounded-full border border-line bg-paper p-1">
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`rounded-full py-1.5 text-xs font-bold transition-all cursor-pointer text-center ${
              mode === "signup" ? "bg-brand shadow-sm" : "text-muted-ink hover:text-ink"
            }`}
          >
            حساب جديد
          </button>
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={`rounded-full py-1.5 text-xs font-bold transition-all cursor-pointer text-center ${
              mode === "signin" ? "bg-brand shadow-sm" : "text-muted-ink hover:text-ink"
            }`}
          >
            عندي حساب
          </button>
        </div>
        
        <form className="space-y-3" onSubmit={handleLoginSubmit}>
          
          {mode === "signup" && (
            <div className="space-y-1 animate-fade-in">
              <label className="text-xs font-bold text-ink">اسمك</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثلاً: علي حسن"
                className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-butter"
              />
            </div>
          )}

          {mode === "signup" && (
            <div className="space-y-1 animate-fade-in">
              <label className="text-xs font-bold text-ink">
                رقم موبايلك <span className="font-normal text-muted-ink">(اختياري، حتى أصدقاءك يلگونك)</span>
              </label>
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07701234567"
                className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-butter text-left"
                dir="ltr"
                autoComplete="tel"
              />
            </div>
          )}

          {/* 🟢 تحويل وتطهير حقل الهاتف بالكامل إلى حقل البريد الإلكتروني القياسي الشرعي */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-ink">الإيميل</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-butter text-left"
              dir="ltr"
              autoComplete="email"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-ink">كلمة السر</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-butter text-left"
              dir="ltr"
              autoComplete="current-password"
            />
          </div>

          {mode === "signup" && (
            <div className="flex items-start gap-2 py-0.5 animate-fade-in">
              <input 
                type="checkbox" 
                id="agree" 
                required 
                defaultChecked 
                className="mt-0.5 rounded border-line accent-teal"
              />
              <label htmlFor="agree" className="text-[10px] font-semibold text-muted-ink leading-tight select-none">
                أوافق على شروط الاستخدام وسياسة الخصوصية.
              </label>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-brand mt-2 w-full rounded-full py-2.5 text-sm font-bold shadow-md transition-transform hover:scale-[1.01] disabled:opacity-60 cursor-pointer text-center flex items-center justify-center gap-1.5"
          >
            {isSubmitting ? (
              "لحظة…"
            ) : mode === "signup" ? (
              <>🚀 سوّي الحساب</>
            ) : (
              <>دخول</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
