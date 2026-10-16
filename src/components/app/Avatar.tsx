// صورة رمزية موحّدة: شعار التطبيق للمساعد، وحرف ملوّن بتدرّج ثابت لكل شخص
const GRADIENTS = [
  "from-sky-400 to-indigo-500",
  "from-fuchsia-500 to-purple-600",
  "from-amber-400 to-orange-500",
  "from-emerald-400 to-teal-600",
  "from-rose-400 to-pink-600",
  "from-cyan-400 to-blue-600",
];

function pickGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

const SIZES = {
  sm: "size-8 text-sm",
  md: "size-10 text-base",
  lg: "size-16 text-2xl",
  xl: "size-24 text-4xl",
} as const;

export function Avatar({
  name,
  size = "md",
  bot = false,
  className = "",
}: {
  name?: string;
  size?: keyof typeof SIZES;
  bot?: boolean;
  className?: string;
}) {
  const sizeClass = SIZES[size];
  if (bot) {
    return (
      <img
        src="/icons/logo.webp"
        alt="القبة"
        width={64}
        height={64}
        className={`${sizeClass} shrink-0 rounded-[30%] object-cover shadow-sm select-none ${className}`}
        draggable={false}
      />
    );
  }
  const clean = (name || "").trim();
  const letter = clean.charAt(0) || "؟";
  return (
    <div
      className={`${sizeClass} grid shrink-0 place-items-center rounded-full bg-linear-to-br ${pickGradient(
        clean || "?",
      )} font-display font-bold text-white shadow-sm select-none ${className}`}
      aria-hidden
    >
      {letter}
    </div>
  );
}
