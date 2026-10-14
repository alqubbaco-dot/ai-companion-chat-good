import { useEffect, useRef, type ReactNode } from "react";
import { useCall } from "@/lib/call-store";

function formatDuration(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// يربط MediaStream بعنصر فيديو
function StreamVideo({ stream, mirrored, className }: { stream: MediaStream | null; mirrored?: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    if (stream) void el.play().catch(() => undefined);
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted // الصوت يطلع من عنصر الصوت المخفي حتى ما يتكرر
      className={`${className ?? ""} ${mirrored ? "-scale-x-100" : ""}`}
    />
  );
}

function RoundButton({
  onClick,
  label,
  children,
  tone = "glass",
  disabled,
  big,
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
  tone?: "glass" | "white" | "red" | "green";
  disabled?: boolean;
  big?: boolean;
}) {
  const tones = {
    glass: "bg-white/15 text-white",
    white: "bg-white text-[#1b1f5c]",
    red: "bg-red-500 text-white",
    green: "bg-emerald-500 text-white",
  } as const;
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={`grid place-items-center rounded-full shadow-lg transition-transform active:scale-95 disabled:opacity-40 ${
          big ? "size-16 text-2xl" : "size-14 text-xl"
        } ${tones[tone]}`}
      >
        {children}
      </button>
      <span className="text-xs text-white/80">{label}</span>
    </div>
  );
}

// شاشة المكالمة (صوت أو فيديو / صادرة / واردة / شغالة) فوق كل التطبيق
export function CallOverlay() {
  const {
    phase,
    call,
    muted,
    seconds,
    endedReason,
    acceptCall,
    rejectCall,
    hangUp,
    toggleMute,
    remoteAudioRef,
    localStream,
    remoteStream,
    cameraOff,
    toggleCamera,
    switchCamera,
  } = useCall();

  const visible = phase !== "idle" && call;
  const isVideo = Boolean(call?.video);
  const hasLocalVideo = Boolean(localStream && localStream.getVideoTracks().length > 0);
  const hasRemoteVideo = Boolean(remoteStream && remoteStream.getVideoTracks().length > 0);
  const showRemoteVideo = isVideo && hasRemoteVideo && (phase === "active" || phase === "connecting");

  const status =
    phase === "outgoing"
      ? isVideo
        ? "مكالمة فيديو… جاري الاتصال"
        : "جاري الاتصال…"
      : phase === "incoming"
        ? isVideo
          ? "📹 مكالمة فيديو واردة"
          : "مكالمة صوتية واردة"
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
          className="fixed inset-0 z-[100] flex flex-col items-center justify-between overflow-hidden bg-gradient-to-b from-[#0f1340] via-[#1b1f5c] to-[#2b145c] px-6 pb-12 pt-16 text-white"
        >
          {/* فيديو الصديق بملء الشاشة */}
          {showRemoteVideo ? (
            <StreamVideo stream={remoteStream} className="absolute inset-0 size-full bg-black object-cover" />
          ) : null}

          {/* فيديوي الصغير بالزاوية */}
          {isVideo && hasLocalVideo && phase !== "incoming" && phase !== "ended" ? (
            <div className="absolute end-4 top-4 z-10 h-40 w-28 overflow-hidden rounded-2xl border-2 border-white/40 bg-black shadow-xl">
              {cameraOff ? (
                <div className="grid size-full place-items-center text-2xl">🚫</div>
              ) : (
                <StreamVideo stream={localStream} mirrored className="size-full object-cover" />
              )}
            </div>
          ) : null}

          <div
            className={`relative z-10 flex flex-col items-center gap-3 text-center ${
              showRemoteVideo ? "rounded-2xl bg-black/35 px-4 py-2 backdrop-blur-sm" : ""
            }`}
          >
            {!showRemoteVideo ? (
              <div className="relative">
                {phase === "incoming" || phase === "outgoing" ? (
                  <span className="absolute inset-0 animate-ping rounded-full bg-white/20" />
                ) : null}
                <div className="relative grid size-28 place-items-center rounded-full bg-white/15 font-display text-5xl font-bold ring-4 ring-white/20">
                  {call.peerName.charAt(0)}
                </div>
              </div>
            ) : null}
            <p className={`font-display font-extrabold ${showRemoteVideo ? "text-lg" : "text-2xl"}`}>{call.peerName}</p>
            <p className={`text-base ${phase === "active" ? "font-mono text-emerald-300" : "text-white/75"}`}>{status}</p>
          </div>

          {phase === "incoming" ? (
            <div className="relative z-10 flex w-full max-w-xs items-center justify-between">
              <RoundButton onClick={rejectCall} label="رفض" tone="red" big>
                <span className="rotate-[135deg]">📞</span>
              </RoundButton>
              <RoundButton onClick={() => void acceptCall()} label="رد" tone="green" big>
                <span className="animate-bounce">{isVideo ? "📹" : "📞"}</span>
              </RoundButton>
            </div>
          ) : phase === "ended" ? (
            <div className="h-16" />
          ) : (
            <div className="relative z-10 flex items-end gap-5">
              <RoundButton
                onClick={toggleMute}
                label={muted ? "مكتوم" : "كتم"}
                tone={muted ? "white" : "glass"}
                disabled={phase === "outgoing"}
              >
                {muted ? "🔇" : "🎙️"}
              </RoundButton>
              {isVideo && hasLocalVideo ? (
                <>
                  <RoundButton onClick={toggleCamera} label={cameraOff ? "الكاميرا مطفية" : "الكاميرا"} tone={cameraOff ? "white" : "glass"}>
                    {cameraOff ? "🚫" : "📷"}
                  </RoundButton>
                  <RoundButton onClick={() => void switchCamera()} label="تبديل">
                    🔄
                  </RoundButton>
                </>
              ) : null}
              <RoundButton onClick={hangUp} label="إنهاء" tone="red" big>
                <span className="rotate-[135deg]">📞</span>
              </RoundButton>
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}
