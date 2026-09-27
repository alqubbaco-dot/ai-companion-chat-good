import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-paper text-ink">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav />
        <div className="flex min-h-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

export function PageBody({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-0 w-full flex-col">
      <header className="flex h-auto shrink-0 flex-col gap-1 border-b-2 border-line bg-cream/70 px-6 py-4">
        <h1 className="font-display text-2xl font-extrabold leading-none">{title}</h1>
        {subtitle ? <p className="text-[12px] text-muted-ink">{subtitle}</p> : null}
      </header>
      
      {/* مستطيل الإعلانات الأفقي المخصص للأرباح - مجهز للربط بـ Google AdSense لاحقاً */}
      <div className="w-full px-6 pt-4 shrink-0">
        <div 
          id="adsense-container"
          className="w-full py-3 px-4 rounded-2xl border-2 border-dashed border-line bg-cream/50 flex flex-col sm:flex-row items-center justify-between gap-2 animate-rise"
        >
          <div className="flex items-center gap-2">
            <span className="text-base">📢</span>
            <div>
              <p className="text-xs font-bold font-display leading-none">إعلان ممول · Sponsored Ad</p>
              <p className="text-[10px] text-muted-ink mt-0.5">مساحة إعلانية مخصصة لتوليد الأرباح</p>
            </div>
          </div>
          
          <button 
            type="button"
            onClick={() => window.open("#", "_blank")}
            className="text-[11px] font-bold bg-butter text-butter-ink border-2 border-line rounded-full px-4 py-1 hover:scale-105 transition-transform"
          >
            أعلن هنا · Advertise here 🚀
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
    </div>
  );
}
