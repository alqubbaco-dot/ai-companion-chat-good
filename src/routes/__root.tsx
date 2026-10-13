import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useLocation,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { I18nProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";
import { FriendsProvider, useFriends } from "@/lib/friends-store";
import { ChatProvider } from "@/lib/chat-store";
import { AppShell } from "@/components/app/AppShell";
import { Toaster } from "@/components/ui/sonner";
import { PwaManager } from "@/components/app/PwaManager";
import { InviteHandler } from "@/components/app/InviteHandler";
import { CallProvider } from "@/lib/call-store";
import { CallOverlay } from "@/components/app/CallOverlay";
import { PushPrompt } from "@/components/app/PushPrompt";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-extrabold text-ink">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-ink">الصفحة غير موجودة</h2>
        <p className="mt-2 text-sm text-muted-ink">
          الرابط الذي فتحته لا يوجد أو تم نقله.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full border-2 border-line bg-butter px-5 py-2 text-sm font-semibold text-butter-ink"
          >
            العودة للرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-xl font-bold text-ink">لم تُحمَّل هذه الصفحة</h1>
        <p className="mt-2 text-sm text-muted-ink">حدث خطأ ما. جرّب التحديث أو العودة للرئيسية.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-full border-2 border-line bg-butter px-5 py-2 text-sm font-semibold text-butter-ink"
          >
            إعادة المحاولة
          </button>
          <a
            href="/"
            className="rounded-full border-2 border-line px-5 py-2 text-sm font-semibold text-ink"
          >
            الرئيسية
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#14106f" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "الغباء الصناعي" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { title: "الغباء الصناعي" },
      {
        name: "description",
        content: "مساعد دردشة ذكي مع نظام أصدقاء، بالعربية والإنجليزية، فاتح وداكن.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
      },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/icons/favicon-32.png" },
      { rel: "icon", type: "image/png", sizes: "48x48", href: "/icons/favicon-48.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/icons/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function CloudSecurityGateway({ children }: { children: ReactNode }) {
  const { profile, hydrated } = useFriends();
  const router = useRouter();
  // 🟢 الحل الهندسي: قراءة المسار الحي والدقيق من نظام توجيه التطبيق مباشرة لمنع تعليق المتصفحات
  const location = useLocation();

  // الحساب يُعتبر مسجّلاً إذا كان صاحبه داخلاً فعلاً عبر Supabase (عنده id)
  const isRegistered = Boolean(profile && profile.id);
  const currentPath = location.pathname;

  useEffect(() => {
    if (!hydrated) return;
    if (!isRegistered && currentPath !== "/login") {
      router.navigate({ to: "/login" });
    } else if (isRegistered && currentPath === "/login") {
      // بعد نجاح الدخول انقل المستخدم لصفحة المحادثات بدل البقاء على صفحة الدخول
      router.navigate({ to: "/" });
    }
  }, [hydrated, isRegistered, currentPath, router]);

  // انتظر حتى يتم تحميل الذاكرة بشكل كامل وصحيح أولاً من المتجر
  if (!hydrated) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-paper">
        <img
          src="/icons/logo.webp"
          alt="الغباء الصناعي"
          width={80}
          height={80}
          className="size-20 animate-pulse rounded-[30%] shadow-lg"
          draggable={false}
        />
        <div className="font-display text-sm font-bold text-muted-ink">لحظة…</div>
      </div>
    );
  }

  // إذا تم التحميل وتبيّن أن الحساب فارغ ولم يسجل رقم هاتف، اعرض واجهة التسجيل فقط وامنع تسرب الأجزاء الداخلية
  if (!isRegistered) {
    return <Outlet />;
  }

  // العبور الآمن للداخل فقط بعد التحقق القاطع من وجود هاتف موثق وثابت
  return <>{children}</>;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ThemeProvider>
          <FriendsProvider>
            <ChatProvider>
              <CallProvider>
              <CloudSecurityGateway>
                <AppShell>
                  <Outlet />
                </AppShell>
              </CloudSecurityGateway>
              <Toaster position="top-center" />
              <PwaManager />
              <InviteHandler />
              <CallOverlay />
              <PushPrompt />
              </CallProvider>
            </ChatProvider>
          </FriendsProvider>
        </ThemeProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
