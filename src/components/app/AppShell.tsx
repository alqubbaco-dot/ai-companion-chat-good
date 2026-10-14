import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { MobileBottomNav, MobileTopBar } from "./MobileNav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh overflow-hidden bg-paper text-ink">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar />
        <div className="flex min-h-0 flex-1">{children}</div>
        <MobileBottomNav />
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
      
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
    </div>
  );
}
