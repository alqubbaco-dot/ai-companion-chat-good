import type { ReactNode } from "react";

// ملصقات عراقية مرسومة بالكود (SVG). 4 ببلاش للكل، والباقي بميزة "stickers" (100 نقطة)
// الملصق ينرسل كرسالة نص عادية: "الإيموجي + الاسم" وبآخرها علامة مخفية،
// فالمعاينة والإشعار يطلعون مفهومين، والمحادثة ترسمه كملصق.

export const STICKERS_FEATURE = "stickers";
const MARK = "⁣"; // فاصل مخفي يميّز رسالة الملصق

export type Sticker = { id: string; label: string; emoji: string; free?: boolean; bg: string; art: ReactNode };

const INK = "#2b2118";
const SKIN = "#f2b866";
const SKIN_D = "#d99545";

export const STICKERS: Sticker[] = [
  {
    id: "hala",
    label: "هلا بيك",
    emoji: "👋",
    free: true,
    bg: "#ffe9a8",
    art: (
      <g stroke={INK} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
        <path d="M30 40 q-6 -4 -10 0 M28 30 q-6 -6 -12 -2" fill="none" />
        <g transform="translate(6 10) rotate(-15 60 62)">
          <rect x="40" y="22" width="11" height="34" rx="5.5" fill={SKIN} />
          <rect x="52" y="16" width="11" height="40" rx="5.5" fill={SKIN} />
          <rect x="64" y="20" width="11" height="36" rx="5.5" fill={SKIN} />
          <rect x="76" y="28" width="10" height="30" rx="5" fill={SKIN} />
          <path d="M38 50 h50 v22 q0 22 -25 22 q-25 0 -25 -22 z" fill={SKIN} />
          <path d="M38 62 q-14 -10 -18 -2 q8 14 20 24" fill={SKIN} />
        </g>
      </g>
    ),
  },
  {
    id: "ashat",
    label: "عاشت ايدك",
    emoji: "👍",
    free: true,
    bg: "#c9ecd9",
    art: (
      <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
        <path d="M50 52 q6 -14 4 -30 q10 -4 14 8 q2 10 -2 22 z" fill={SKIN} />
        <rect x="36" y="50" width="52" height="40" rx="12" fill={SKIN} />
        <path d="M88 60 h-20 M88 70 h-20 M88 80 h-20" stroke={SKIN_D} fill="none" />
        <rect x="24" y="52" width="14" height="38" rx="4" fill="#3d7ea6" />
        <path d="M96 30 l6 -6 M100 42 h8 M92 22 v-8" stroke="#2e8b57" fill="none" strokeLinecap="round" />
      </g>
    ),
  },
  {
    id: "chai",
    label: "استكان چاي",
    emoji: "☕",
    free: true,
    bg: "#f7d9c4",
    art: (
      <g stroke={INK} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
        <path d="M50 22 q-4 -8 2 -14 M62 22 q-4 -8 2 -14 M74 22 q-4 -8 2 -14" fill="none" stroke="#9c8f86" />
        <ellipse cx="62" cy="96" rx="34" ry="8" fill="#ffffff" />
        <path d="M42 30 h40 q-2 18 -10 26 q10 10 8 34 h-36 q-2 -24 8 -34 q-8 -8 -10 -26 z" fill="#ffffffcc" />
        <path d="M45 40 h34 q-3 10 -9 16 q9 9 8 32 h-32 q-1 -23 8 -32 q-6 -6 -9 -16 z" fill="#b5401b" stroke="none" />
        <path d="M42 30 h40" fill="none" />
        <path d="M92 74 l10 -18" stroke="#9c8f86" />
      </g>
    ),
  },
  {
    id: "hhh",
    label: "هههه مت",
    emoji: "😂",
    free: true,
    bg: "#d6e4ff",
    art: (
      <g stroke={INK} strokeWidth="3" strokeLinecap="round">
        <circle cx="60" cy="60" r="38" fill="#ffd34d" />
        <path d="M40 48 q6 -8 12 0 M68 48 q6 -8 12 0" fill="none" />
        <path d="M38 64 h44 q-4 22 -22 22 q-18 0 -22 -22 z" fill="#7a2b2b" strokeLinejoin="round" />
        <path d="M46 74 q14 8 28 0" stroke="#ff8a8a" strokeWidth="5" fill="none" />
        <path d="M28 52 q-8 10 -4 18 q6 2 8 -6 z M92 52 q8 10 4 18 q-6 2 -8 -6 z" fill="#5fb8ff" strokeLinejoin="round" />
      </g>
    ),
  },
  {
    id: "naal",
    label: "نعال الحجية",
    emoji: "🩴",
    bg: "#ffd1dc",
    art: (
      <g stroke={INK} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
        <path d="M14 40 h14 M10 54 h16 M16 68 h12" fill="none" stroke="#c0567a" />
        <g transform="rotate(-25 66 62)">
          <path d="M34 66 q0 -20 30 -20 q36 0 40 20 q-4 20 -40 20 q-30 0 -30 -20 z" fill="#e9d3a8" />
          <path d="M40 60 q0 -16 24 -16 q30 0 34 16 q-4 16 -34 16 q-24 0 -24 -16 z" fill="#3b5ba5" />
          <path d="M58 46 q14 18 30 2" fill="none" stroke="#e8463c" strokeWidth="8" />
        </g>
      </g>
    ),
  },
  {
    id: "zmal",
    label: "زمال",
    emoji: "🐴",
    bg: "#e3e0f5",
    art: (
      <g stroke={INK} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
        <path d="M44 34 l-6 -26 q10 2 14 22 z M76 34 l6 -26 q-10 2 -14 22 z" fill="#9b9bab" />
        <path d="M40 40 q20 -14 40 0 q8 30 4 46 h-48 q-4 -16 4 -46 z" fill="#a9a9b8" />
        <ellipse cx="60" cy="88" rx="22" ry="14" fill="#e6dcd0" />
        <circle cx="52" cy="88" r="2.5" fill={INK} />
        <circle cx="68" cy="88" r="2.5" fill={INK} />
        <circle cx="48" cy="56" r="3.5" fill={INK} />
        <circle cx="72" cy="56" r="3.5" fill={INK} />
        <path d="M56 36 q4 -8 8 0" fill="none" />
      </g>
    ),
  },
  {
    id: "hayesha",
    label: "هايشة",
    emoji: "🐄",
    bg: "#d8f0c8",
    art: (
      <g stroke={INK} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
        <path d="M36 36 q-14 -2 -16 -16 q10 6 20 8 M84 36 q14 -2 16 -16 q-10 6 -20 8" fill="#f3e6c8" />
        <path d="M34 40 q26 -16 52 0 q6 22 0 40 h-52 q-6 -18 0 -40 z" fill="#ffffff" />
        <path d="M38 46 q8 -4 12 4 q-4 8 -12 4 z M72 44 q10 -2 10 8 q-8 4 -10 -8 z" fill={INK} />
        <ellipse cx="60" cy="84" rx="24" ry="14" fill="#f7a8b8" />
        <circle cx="52" cy="84" r="3" fill={INK} />
        <circle cx="68" cy="84" r="3" fill={INK} />
        <circle cx="48" cy="60" r="3.5" fill={INK} />
        <circle cx="72" cy="60" r="3.5" fill={INK} />
      </g>
    ),
  },
  {
    id: "kia",
    label: "كيا",
    emoji: "🚐",
    bg: "#cfe8f5",
    art: (
      <g stroke={INK} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
        <path d="M8 40 h10 M4 52 h12" fill="none" stroke="#7aa6c2" />
        <path d="M22 42 q2 -12 14 -12 h50 q12 0 16 14 l6 18 v18 h-86 z" fill="#ffffff" />
        <path d="M22 66 h86" fill="none" stroke="#2f6fb0" strokeWidth="6" />
        <rect x="32" y="38" width="16" height="14" rx="2" fill="#a8d4f0" />
        <rect x="52" y="38" width="16" height="14" rx="2" fill="#a8d4f0" />
        <rect x="72" y="38" width="14" height="14" rx="2" fill="#a8d4f0" />
        <path d="M90 38 h8 l6 14 h-14 z" fill="#a8d4f0" />
        <circle cx="40" cy="82" r="9" fill="#3a3a3a" />
        <circle cx="90" cy="82" r="9" fill="#3a3a3a" />
      </g>
    ),
  },
  {
    id: "mawlida",
    label: "المولدة طفت",
    emoji: "⚡",
    bg: "#d9d9de",
    art: (
      <g stroke={INK} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
        <path d="M60 18 q26 0 26 26 q0 14 -12 24 v12 h-28 v-12 q-12 -10 -12 -24 q0 -26 26 -26 z" fill="#8d8d96" />
        <rect x="46" y="80" width="28" height="12" rx="3" fill="#bfbfc6" />
        <path d="M52 98 h16" fill="none" />
        <path d="M54 34 l-6 14 h10 l-6 14" fill="none" stroke="#ffd34d" strokeOpacity="0.5" />
        <path d="M84 20 l16 16 M100 20 l-16 16" stroke="#d93a3a" strokeWidth="5" fill="none" />
      </g>
    ),
  },
  {
    id: "dolma",
    label: "دولمة",
    emoji: "🍲",
    bg: "#ffe0b8",
    art: (
      <g stroke={INK} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
        <path d="M44 22 q-4 -8 2 -14 M60 22 q-4 -8 2 -14 M76 22 q-4 -8 2 -14" fill="none" stroke="#9c8f86" />
        <rect x="36" y="34" width="16" height="22" rx="8" fill="#6d9b3a" />
        <rect x="52" y="30" width="16" height="26" rx="8" fill="#7fb045" />
        <ellipse cx="78" cy="44" rx="10" ry="12" fill="#d9442c" />
        <path d="M78 32 v-6" stroke="#2f7a2f" />
        <path d="M20 54 h80 l-6 34 q-2 8 -10 8 h-48 q-8 0 -10 -8 z" fill="#b8b8c0" />
        <path d="M14 56 h10 M96 56 h10" fill="none" strokeWidth="5" />
      </g>
    ),
  },
  {
    id: "shako",
    label: "شكو ماكو؟",
    emoji: "🤔",
    bg: "#fde2a8",
    art: (
      <g stroke={INK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="54" cy="64" r="34" fill="#ffd34d" />
        <circle cx="44" cy="56" r="4" fill={INK} />
        <circle cx="64" cy="56" r="4" fill={INK} />
        <path d="M38 46 l12 -4 M60 44 l12 2" fill="none" />
        <path d="M44 80 q10 -6 20 2" fill="none" />
        <path d="M86 30 q0 -12 12 -12 q12 0 12 12 q0 8 -12 12 v8" fill="none" stroke="#2f6fb0" strokeWidth="6" />
        <circle cx="98" cy="62" r="4" fill="#2f6fb0" stroke="none" />
      </g>
    ),
  },
  {
    id: "yesa3dk",
    label: "الله يساعدك",
    emoji: "🙏",
    bg: "#d4f1ee",
    art: (
      <g stroke={INK} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
        <path d="M58 18 q-10 2 -12 16 l-10 44 q-2 10 8 14 l14 4 z" fill={SKIN} />
        <path d="M62 18 q10 2 12 16 l10 44 q2 10 -8 14 l-14 4 z" fill={SKIN} />
        <path d="M30 92 h22 l8 -4 l8 4 h22 v10 h-60 z" fill="#3d7ea6" />
        <path d="M30 30 l-8 -6 M90 30 l8 -6 M26 46 h-10 M94 46 h10" fill="none" stroke="#e8a317" />
      </g>
    ),
  },
];

export function stickerContent(s: Sticker): string {
  return `${s.emoji} ${s.label}${MARK}`;
}

/** إذا الرسالة ملصق، يرجّع الملصق، وإلا null */
export function stickerFromContent(content: string): Sticker | null {
  if (!content.endsWith(MARK)) return null;
  return STICKERS.find((s) => stickerContent(s) === content) ?? null;
}

export function StickerArt({ sticker, size = 120 }: { sticker: Sticker; size?: number }) {
  return (
    <span className="inline-flex flex-col items-center gap-1" style={{ width: size }}>
      <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={sticker.label}>
        <circle cx="60" cy="60" r="56" fill={sticker.bg} stroke="#ffffff" strokeWidth="6" />
        {sticker.art}
      </svg>
      <span
        className="rounded-full px-2.5 py-0.5 text-[12px] font-extrabold"
        style={{ background: sticker.bg, color: INK }}
      >
        {sticker.label}
      </span>
    </span>
  );
}
