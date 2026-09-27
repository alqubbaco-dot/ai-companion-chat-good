import type { ReactNode } from "react";
import { useState } from "react";
import type { Person } from "@/lib/friends-store";
import { useI18n } from "@/lib/i18n";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { getOrCreatePrivateConversation } from "@/lib/private-chat";

const accentBg: Record<Person["accent"], string> = {
  teal: "bg-teal/20",
  coral: "bg-coral/20",
  butter: "bg-butter/40",
};

export function PersonRow({
  person,
  children,
  note,
}: {
  person: Person;
  children?: ReactNode;
  note?: string;
}) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [showOptions, setShowOptions] = useState(false);
  
  const name = lang === "ar" ? person.name : person.nameEn;
  const role = lang === "ar" ? person.role : person.roleEn;
  const isOnline = person.status === "online";

  // دالة الضغط الذكية لفتح شاشة المراسلة فوراً بالاسم والصورة مثل الواتساب
  const handleCardClick = async () => {
    try {
      const conversationId = await getOrCreatePrivateConversation(person.id);
      navigate({ to: "/private-chat/$conversationId", params: { conversationId } });
    } catch (error) {
      console.error("تعذر فتح المحادثة الخاصة:", error);
      toast.error("لا يمكن فتح محادثة إلا مع صديق مقبول فعلياً.");
    }
  };

  return (
    <div className="relative flex animate-rise items-center gap-3 rounded-2xl border-2 border-line/60 p-3 transition-colors hover:border-line bg-cream/30">
      
      {/* منطقة الصديق القابلة للضغط لبدء المراسلة الفورية */}
      <div 
        onClick={handleCardClick}
        className="flex flex-1 items-center gap-3 cursor-pointer min-w-0"
        title="اضغط للمراسلة الفورية"
      >
        <div className="relative shrink-0">
          <div className={`grid size-11 place-items-center rounded-full font-display font-bold ${accentBg[person.accent]}`}>
            {name.charAt(0)}
          </div>
          <span className={`absolute -bottom-0.5 -start-0.5 size-3.5 rounded-full ring-2 ring-cream ${isOnline ? "bg-teal" : "bg-ink/25"}`} />
        </div>
        
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink hover:text-teal transition-colors">{name}</p>
          <p className="truncate text-[11px] text-muted-ink">
            {note ?? `${person.handle} · ${role}`}
          </p>
          <p className={`text-[11px] font-semibold ${isOnline ? "text-teal" : "text-muted-ink"}`}>
            {isOnline ? t("online") : t("offline")}
          </p>
        </div>
      </div>
      
      {/* منطقة الأزرار: تم تنظيفها من أزرار الاتصال المكررة لتبقى فقط أزرار الإعدادات الناعمة */}
      <div className="flex shrink-0 items-center gap-1.5 z-10">
        {/* زر الترس الدائري والناعم لعزل الحظر والحذف مثل خيارات الواتساب */}
        <button
          onClick={() => setShowOptions(!showOptions)}
          className={`p-2 rounded-full border-2 border-line bg-cream hover:bg-line/20 transition-colors cursor-pointer font-bold text-xs ${showOptions ? 'bg-line/20' : ''}`}
          title="خيارات إضافية"
        >
          ⚙️
        </button>

        {/* قائمة الخيارات الفرعية المنبثقة النظيفة */}
        {showOptions && (
          <div className="absolute left-3 top-14 z-50 rounded-2xl border-2 border-line bg-cream p-1.5 shadow-xl animate-pop flex items-center gap-1">
            {children}
            <button 
              onClick={() => setShowOptions(false)}
              className="text-[10px] font-bold px-2 py-1 border border-line rounded-xl hover:bg-ink/5"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function RowButton({
  onClick,
  children,
  tone = "plain",
}: {
  onClick: () => void;
  children: ReactNode;
  tone?: "plain" | "primary" | "danger";
}) {
  const tones = {
    plain: "border-line hover:bg-ink/5",
    primary: "border-line bg-teal text-teal-ink",
    danger: "border-line text-coral hover:bg-coral/10",
  } as const;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`rounded-full border-2 px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer ${tones[tone]}`}
    >
      {children}
    </button>
  );
}
