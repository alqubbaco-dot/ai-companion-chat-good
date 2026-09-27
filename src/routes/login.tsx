
import { useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useFriends } from "@/lib/friends-store"; 
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (mode === "signup" && !cleanName) {
      toast.error("يرجى كتابة الاسم الكريم لإنشاء الحساب الجديد.");
      return;
    }

    if (!cleanEmail) {
      toast.error("يرجى كتابة البريد الإلكتروني الحقيقي للعبور.");
      return;
    }

    if (!cleanPassword || cleanPassword.length < 6) {
      toast.error("تأمين الحساب حرج؛ كلمة المرور يجب ألا تقل عن 6 أحرف.");
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
          toast.error(`فشلت مصادقة سوبابيز: ${authError.message}`);
          setIsSubmitting(false);
          return;
        }

          authUserId = authData.user?.id || "";
          if (authData.user) {
          const generatedHandle = "@" + finalName.toLowerCase().replace(/\s+/g, "_") + "_" + cleanEmail.split('@')[0].slice(-3);
          
          const cloudPayload = {
            id: authData.user.id, // استخدام الـ UID الشرعي والمولد من نظام الأمان
            name: finalName,
            name_en: finalName,
            handle: generatedHandle,
            role: "مستخدم حقيقي",
            role_en: "Real User",
            status: "online",
            last_seen_minutes: 0,
            accent: "teal",
            phone: null // ترك حقل الهاتف مؤقتاً تلبية لخطتك الاستراتيجية
          };

          // 🟢 2. قذف وحفر سجلات الحساب تلقائياً داخل جدول دليل الحسابات
          const { error: dbError } = await supabase
            .from("users_directory")
            .insert([cloudPayload]);

            if (dbError) {
              toast.error(`تعذر حفظ ملف الحساب: ${dbError.message}`);
              setIsSubmitting(false);
              return;
            }
        }
      } else {
        // 🔐 في حالة تسجيل دخول مسجل قديم، المطابقة والعبور الصارم بالإيميل والرمز
        const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        });

        if (signInError) {
          toast.error(`خطأ في تسجيل الدخول: ${signInError.message}`);
          setIsSubmitting(false);
          return;
        }

        authUserId = authData.user?.id || "";
      }

      if (!authUserId) {
        toast.error("تعذر تحديد هوية الحساب الحالي.");
        setIsSubmitting(false);
        return;
      }

      await refreshProfile();
      
      if (mode === "signup") {
        toast.success(`🟢 تم إنشاء الهوية وتفعيل الدخول بالإيميل بنجاح.`);
      } else {
        toast.success(`🔐 أهلاً بك مجدداً! تم تسجيل دخولك بأمان.`);
      }
      
      router.navigate({ to: "/" });

    } catch (err: unknown) {
      console.error("خطأ أثناء معالجة الهوية السحابية والمحلية:", err);
      toast.error("تعذر تحميل بيانات الحساب الحالي.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4 py-4 sm:py-8">
      <div className="w-full max-w-md space-y-3.5 rounded-3xl border-2 border-line bg-cream p-5 sm:p-8 shadow-xl animate-rise">
        
        <div className="text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-ink text-2xl">💬</div>
          <h2 className="mt-2 font-display text-xl font-extrabold tracking-tight text-ink">
            {mode === "signup" ? "إنشاء هوية رقمية" : "تسجيل دخول الحساب"}
          </h2>
          <p className="mt-1 text-[11px] font-semibold text-muted-ink">
            {mode === "signup" ? "سجل بريدك الإلكتروني لصب البيانات" : "أدخل بريدك والرمز للعبور الفوري لغرف المراسلة"}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-2xl border-2 border-line bg-paper p-1">
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`rounded-xl py-1.5 text-xs font-bold transition-all cursor-pointer text-center ${
              mode === "signup" ? "bg-teal text-teal-ink border-2 border-line/40 shadow-sm" : "text-muted-ink hover:text-ink"
            }`}
          >
            👤 مستخدم جديد
          </button>
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={`rounded-xl py-1.5 text-xs font-bold transition-all cursor-pointer text-center ${
              mode === "signin" ? "bg-teal text-teal-ink border-2 border-line/40 shadow-sm" : "text-muted-ink hover:text-ink"
            }`}
          >
            🔐 مسجل قديم
          </button>
        </div>
        
        <form className="space-y-3" onSubmit={handleLoginSubmit}>
          
          {mode === "signup" && (
            <div className="space-y-1 animate-fade-in">
              <label className="text-xs font-bold text-ink">الاسم الثلاثي الكريم:</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: الاسم الثلاثي"
                className="w-full rounded-xl border-2 border-line bg-paper px-3 py-1.5 text-sm outline-none focus:border-teal"
              />
            </div>
          )}

          {/* 🟢 تحويل وتطهير حقل الهاتف بالكامل إلى حقل البريد الإلكتروني القياسي الشرعي */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-ink">البريد الإلكتروني (Email):</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border-2 border-line bg-paper px-3 py-1.5 text-sm outline-none focus:border-teal text-left"
              dir="ltr"
              autoComplete="email"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-ink">كلمة المرور (Password):</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border-2 border-line bg-paper px-3 py-1.5 text-sm outline-none focus:border-teal text-left"
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
                أوافق على اتفاقية الاستخدام وسياسات حفظ الهوية السحابية المحمية.
              </label>
            </div>
          )}

          <button
            type="submit"
            className="mt-2 w-full rounded-full border-2 border-line bg-teal py-2 text-sm font-bold text-teal-ink hover:bg-teal/90 transition-colors shadow-md cursor-pointer text-center flex items-center justify-center gap-1.5"
          >
            {isSubmitting ? (
              "جاري تفعيل الهوية..."
            ) : mode === "signup" ? (
              <>🚀 إنشاء وتفعيل الحساب</>
            ) : (
              <>🔐 تسجيل دخول الحساب</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
