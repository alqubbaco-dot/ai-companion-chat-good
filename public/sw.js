// عامل الخدمة لتطبيق "الغباء الصناعي"
// - يحفظ صفحة "بدون نت" والأيقونات حتى تشتغل حتى لو انقطع الاتصال
// - الصفحات: من النت أولاً، وإذا ماكو نت تطلع صفحة "بدون نت"
// - الملفات الثابتة (JS/CSS/صور): من الذاكرة فوراً، وتتحدّث بالخلفية
// - ما يلمس طلبات السيرفر ولا Supabase ولا Gemini

const VERSION = "v1";
const CORE_CACHE = `ghabiy-core-${VERSION}`;
const STATIC_CACHE = `ghabiy-static-${VERSION}`;
const OFFLINE_URL = "/offline.html";

const CORE_FILES = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/logo.webp",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/favicon-32.png",
];

const STATIC_FILE = /\.(?:js|css|woff2?|ttf|png|jpe?g|webp|svg|ico|webmanifest)$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CORE_CACHE).then((cache) => cache.addAll(CORE_FILES)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([CORE_CACHE, STATIC_CACHE]);
      const names = await caches.keys();
      await Promise.all(names.filter((n) => !keep.has(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

// التطبيق يرسل هذي الرسالة لما المستخدم يضغط "حدّث"
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase و Gemini والخطوط: نتركها للمتصفح
  if (url.pathname.startsWith("/_serverFn") || url.pathname.startsWith("/api")) return;
  if (url.pathname === "/sw.js") return;

  // فتح صفحة: النت أولاً، وإذا فشل نعرض صفحة "بدون نت"
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cached = await caches.match(OFFLINE_URL);
          return cached || new Response("Offline", { status: 503 });
        }
      })(),
    );
    return;
  }

  // الملفات الثابتة: من الذاكرة فوراً، ونحدّثها بالخلفية
  if (STATIC_FILE.test(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response && response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => undefined);
        if (cached) {
          event.waitUntil(network);
          return cached;
        }
        const fresh = await network;
        return fresh || (await caches.match(request)) || new Response("", { status: 504 });
      })(),
    );
  }
});
