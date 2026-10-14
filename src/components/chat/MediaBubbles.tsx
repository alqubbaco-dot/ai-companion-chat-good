import { useEffect, useRef, useState } from "react";
import { getMediaUrl } from "@/lib/private-chat";

// يجيب رابط مؤقت للملف (الصلاحيات بـ Supabase تسمح بس لطرفي المحادثة)
function useMediaUrl(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!path) return;
    let active = true;
    setFailed(false);
    getMediaUrl(path)
      .then((u) => active && setUrl(u))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [path]);
  return { url, failed };
}

export function formatDuration(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** صورة بالدردشة: مصغّرة، والضغط يفتحها بالشاشة كلها */
export function ImageBubble({ path }: { path: string }) {
  const { url, failed } = useMediaUrl(path);
  const [open, setOpen] = useState(false);

  if (failed) {
    return <div className="grid h-40 w-56 place-items-center rounded-xl bg-ink/5 text-xs text-muted-ink">تعذر تحميل الصورة</div>;
  }
  if (!url) {
    return <div className="h-40 w-56 animate-pulse rounded-xl bg-ink/10" />;
  }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block overflow-hidden rounded-xl" aria-label="فتح الصورة">
        <img src={url} alt="صورة" className="max-h-72 w-auto max-w-full object-cover" loading="lazy" />
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/90 p-3"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <img src={url} alt="صورة" className="max-h-full max-w-full rounded-lg object-contain" />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute end-4 top-4 grid size-10 place-items-center rounded-full bg-white/15 text-xl text-white"
            aria-label="سكّر"
          >
            ✕
          </button>
        </div>
      ) : null}
    </>
  );
}

/** رسالة صوتية: زر تشغيل/إيقاف، شريط تقدّم، والمدة */
export function AudioBubble({ path, duration, mine }: { path: string; duration?: number | null; mine: boolean }) {
  const { url, failed } = useMediaUrl(path);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [current, setCurrent] = useState(0);
  const total = duration || 0;

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      // نوقف أي رسالة صوتية ثانية شغّالة
      document.querySelectorAll("audio[data-voice]").forEach((a) => {
        if (a !== el) (a as HTMLAudioElement).pause();
      });
      void el.play().catch(() => setPlaying(false));
    }
  };

  const seek = (ratio: number) => {
    const el = audioRef.current;
    const length = el && Number.isFinite(el.duration) && el.duration > 0 ? el.duration : total;
    if (!el || !length) return;
    el.currentTime = ratio * length;
  };

  return (
    <div className="flex w-56 items-center gap-2.5 py-1">
      {url ? (
        <audio
          ref={audioRef}
          src={url}
          preload="metadata"
          data-voice
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setProgress(0);
            setCurrent(0);
          }}
          onTimeUpdate={(e) => {
            const el = e.currentTarget;
            const length = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : total;
            setCurrent(el.currentTime);
            setProgress(length ? Math.min(1, el.currentTime / length) : 0);
          }}
        />
      ) : null}
      <button
        type="button"
        onClick={toggle}
        disabled={!url}
        className={`grid size-10 shrink-0 place-items-center rounded-full text-base disabled:opacity-40 ${
          mine ? "bg-emerald-600 text-white" : "bg-butter text-butter-ink"
        }`}
        aria-label={playing ? "إيقاف" : "تشغيل"}
      >
        {failed ? "!" : playing ? "❚❚" : "▶"}
      </button>
      <div className="min-w-0 flex-1">
        <div
          className="relative h-1.5 cursor-pointer rounded-full bg-ink/15"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const ratio = getComputedStyle(e.currentTarget).direction === "rtl" ? 1 - x / rect.width : x / rect.width;
            seek(Math.min(1, Math.max(0, ratio)));
          }}
        >
          <div className="absolute inset-y-0 start-0 rounded-full bg-current opacity-70" style={{ width: `${progress * 100}%` }} />
        </div>
        <p className="mt-1 text-[11px] opacity-70">
          🎤 {formatDuration(playing || current > 0 ? current : total)}
        </p>
      </div>
    </div>
  );
}
