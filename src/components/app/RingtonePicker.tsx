import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { getMyPoints } from "@/lib/ad-points";
import { RINGTONES, RINGTONE_FEATURE, getRingtone, ringtoneUrl, setRingtone } from "@/lib/ringtones";

// اختيار نغمة رنين المكالمات من الإعدادات: تسمعها قبل ما تختار
export function RingtonePicker() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState("qubba");
  const [unlocked, setUnlocked] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setCurrent(getRingtone());
    void getMyPoints().then((p) => setUnlocked(Boolean(p?.unlocked?.includes(RINGTONE_FEATURE))));
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const togglePlay = (id: string) => {
    audioRef.current?.pause();
    if (playing === id) {
      setPlaying(null);
      return;
    }
    const audio = new Audio(ringtoneUrl(id));
    audio.onended = () => setPlaying(null);
    audioRef.current = audio;
    setPlaying(id);
    void audio.play().catch(() => {
      setPlaying(null);
      toast.error("ما گدرنا نشغّل النغمة، جرّب مرة ثانية");
    });
  };

  const choose = (id: string, free?: boolean) => {
    if (!free && !unlocked) {
      toast("🔒 النغمات تنفتح بـ 25 نقطة من صفحة النقاط");
      navigate({ to: "/points" });
      return;
    }
    setRingtone(id);
    setCurrent(id);
    toast.success("✅ صارت نغمة الرنين");
  };

  return (
    <section className="rounded-3xl border-2 border-line bg-cream p-5">
      <h2 className="font-display text-lg font-bold">🔔 نغمة الرنين</h2>
      <p className="mt-1 text-sm text-muted-ink">
        {unlocked ? "اسمع واختار نغمة المكالمات الواردة." : "رنين القبة ببلاش، والباقي تنفتح بـ 25 نقطة."}
      </p>
      <ul className="mt-3 divide-y divide-line">
        {RINGTONES.map((r) => {
          const locked = !r.free && !unlocked;
          const selected = current === r.id;
          return (
            <li key={r.id} className="flex items-center gap-3 py-2.5">
              <button
                type="button"
                onClick={() => togglePlay(r.id)}
                aria-label={playing === r.id ? `إيقاف ${r.name}` : `اسمع ${r.name}`}
                className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-line text-base transition-transform active:scale-95"
              >
                {playing === r.id ? "⏸" : "▶"}
              </button>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{r.name}</span>
                <span className="block truncate text-[12px] text-muted-ink">{r.hint}</span>
              </span>
              <button
                type="button"
                onClick={() => choose(r.id, r.free)}
                disabled={selected}
                className={`shrink-0 rounded-full border-2 px-3 py-1.5 text-[13px] font-bold ${
                  selected ? "border-ink bg-ink text-cream" : "border-line"
                }`}
              >
                {selected ? "✓ مختارة" : locked ? "🔒" : "اختار"}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
