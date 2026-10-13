import { useCall } from "@/lib/call-store";

function formatDuration(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// شاشة المكالمة (صادرة / واردة / شغالة) فوق كل التطبيق
export function CallOverlay() {
  const { phase, call, muted, seconds, endedReason, acceptCall, rejectCall, hangUp, toggleMute, remoteAudioRef } =
    useCall();

  const visible = phase !== "idle" && call;

  const status =
    phase === "outgoing"
      ? "جاري الاتصال…"
      : phase === "incoming"
        ? "مكالمة صوتية واردة"
        : phase === "connecting"
          ? "جاري الربط…"
          : phase === "active"
            ? formatDuration(seconds)
            : endedReason || "انتهت المكالمة";

  return (
    <>
      {/* عنصر الصوت يبقى موجود دائماً حتى ما ينقطع الصوت */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {visible ? (
        <div
          dir="rtl"
          className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-gradient-to-b from-[#0f1340] via-[#1b1f5c] to-[#2b145c] px-6 pb-14 pt-20 text-white"
        >
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="relative">
              {phase === "incoming" || phase === "outgoing" ? (
                <span className="absolute inset-0 animate-ping rounded-full bg-white/20" />
              ) : null}
              <div className="relative grid size-28 place-items-center rounded-full bg-white/15 font-display text-5xl font-bold ring-4 ring-white/20">
                {call.peerName.charAt(0)}
              </div>
            </div>
            <p className="font-display text-2xl font-extrabold">{call.peerName}</p>
            <p className={`text-base ${phase === "active" ? "font-mono text-emerald-300" : "text-white/75"}`}>{status}</p>
          </div>

          {phase === "incoming" ? (
            <div className="flex w-full max-w-xs items-center justify-between">
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={rejectCall}
                  className="grid size-16 place-items-center rounded-full bg-red-500 text-2xl shadow-lg active:scale-95"
                  aria-label="رفض"
                >
                  <span className="rotate-[135deg]">📞</span>
                </button>
                <span className="text-sm text-white/80">رفض</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => void acceptCall()}
                  className="grid size-16 animate-bounce place-items-center rounded-full bg-emerald-500 text-2xl shadow-lg active:scale-95"
                  aria-label="رد"
                >
                  📞
                </button>
                <span className="text-sm text-white/80">رد</span>
              </div>
            </div>
          ) : phase === "ended" ? (
            <div className="h-16" />
          ) : (
            <div className="flex items-center gap-10">
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={toggleMute}
                  disabled={phase === "outgoing"}
                  className={`grid size-14 place-items-center rounded-full text-xl transition-colors active:scale-95 disabled:opacity-40 ${
                    muted ? "bg-white text-[#1b1f5c]" : "bg-white/15"
                  }`}
                  aria-label="كتم المايك"
                >
                  {muted ? "🔇" : "🎙️"}
                </button>
                <span className="text-xs text-white/75">{muted ? "مكتوم" : "كتم"}</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={hangUp}
                  className="grid size-16 place-items-center rounded-full bg-red-500 text-2xl shadow-lg active:scale-95"
                  aria-label="إنهاء"
                >
                  <span className="rotate-[135deg]">📞</span>
                </button>
                <span className="text-xs text-white/75">إنهاء</span>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}
