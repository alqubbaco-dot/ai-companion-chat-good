import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "./supabase";
import { useFriends } from "./friends-store";
import { notifyFriend } from "./push-client";
import { saveCallLog, type CallStatus } from "./call-logs";
import { getTurnIceServers } from "./turn-server";

/*
 * الاتصال الصوتي بين الأصدقاء (WebRTC)
 * ─────────────────────────────────────
 * - الصوت يروح مباشرة بين التلفونين (peer-to-peer).
 * - Supabase Realtime (broadcast) يستعمل بس لتوصيل إشارات الاتصال:
 *   دعوة، رد، رفض، إنهاء، وعناوين الشبكة (ICE).
 * - كل مستخدم يستمع على قناة باسمه: call:<userId>
 * - ما نقبل مكالمة إلا من صديق مؤكد.
 */

export type CallPhase =
  | "idle"
  | "outgoing" // جاري الاتصال… (ينتظر رد الطرف الثاني)
  | "incoming" // مكالمة واردة (يرن)
  | "connecting" // تم الرد، جاري ربط الصوت
  | "active" // المكالمة شغالة
  | "ended";

export type CallInfo = {
  callId: string;
  peerId: string;
  peerName: string;
  direction: "out" | "in";
  video: boolean;
};

type Signal =
  | { type: "invite"; callId: string; from: string; fromName: string; sdp: RTCSessionDescriptionInit; video?: boolean }
  | { type: "answer"; callId: string; from: string; sdp: RTCSessionDescriptionInit }
  | { type: "ice"; callId: string; from: string; candidate: RTCIceCandidateInit }
  | { type: "reject"; callId: string; from: string; reason?: "busy" | "declined" }
  | { type: "hangup"; callId: string; from: string }
  // المستلم فتح التطبيق من الإشعار وصار جاهز يستلم الدعوة
  | { type: "ready"; callId: string; from: string };

type CallValue = {
  phase: CallPhase;
  call: CallInfo | null;
  muted: boolean;
  speaker: boolean;
  /** زر السبيكر يشتغل بس بتطبيق الأندرويد */
  canToggleSpeaker: boolean;
  toggleSpeaker: () => void;
  seconds: number;
  endedReason: string | null;
  startCall: (peerId: string, peerName: string, video?: boolean) => Promise<void>;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  cameraOff: boolean;
  toggleCamera: () => void;
  switchCamera: () => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  hangUp: () => void;
  toggleMute: () => void;
  remoteAudioRef: RefObject<HTMLAudioElement | null>;
};

const CallContext = createContext<CallValue | null>(null);

export function useCall(): CallValue {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used inside CallProvider");
  return ctx;
}

const RING_TIMEOUT_MS = 45_000;

// خوادم الشبكة: STUN مجاني من Google، وTURN اختياري من متغيرات Vercel
function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ];
  // السيرفر الوسيط من Cloudflare (إذا مضبوط)
  if (turnCache && turnCache.expires > Date.now()) servers.push(...turnCache.servers);
  const env = import.meta.env as Record<string, string | undefined>;
  const turnUrl = env.VITE_TURN_URL;
  if (turnUrl) {
    servers.push({
      urls: turnUrl.split(",").map((u) => u.trim()).filter(Boolean),
      username: env.VITE_TURN_USERNAME,
      credential: env.VITE_TURN_CREDENTIAL,
    });
  }
  return servers;
}

// ── السيرفر الوسيط (TURN) من Cloudflare: نجيب كلمات سر مؤقتة ونخزنها ──
let turnCache: { servers: RTCIceServer[]; expires: number } | null = null;
let turnLoading: Promise<void> | null = null;

async function ensureTurnServers(timeoutMs = 3000): Promise<void> {
  if (turnCache && turnCache.expires > Date.now() + 10 * 60_000) return;
  if (!turnLoading) {
    turnLoading = (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const accessToken = data.session?.access_token;
        if (!accessToken) return;
        const result = await getTurnIceServers({ data: { accessToken } });
        if (result.ok && result.iceServers.length > 0) {
          // نخزنها لأقل من مدتها حتى ما تنتهي وسط مكالمة
          turnCache = { servers: result.iceServers, expires: Date.now() + (result.ttl * 1000) / 2 };
        } else if (!result.ok && result.error !== "turn not configured") {
          console.warn("TURN:", result.error);
        }
      } catch (err) {
        console.warn("TURN fetch failed", err);
      } finally {
        turnLoading = null;
      }
    })();
  }
  // ما نأخر المكالمة أكثر من 3 ثواني: إذا ما وصل، نكمل بالربط المباشر
  await Promise.race([turnLoading, new Promise((r) => setTimeout(r, timeoutMs))]);
}

// ── السبيكر عن طريق تطبيق الأندرويد ──
type AudioBridge = { callAudio?: (active: boolean) => void; setSpeaker?: (on: boolean) => void };
function audioBridge(): AudioBridge | null {
  if (typeof window === "undefined") return null;
  const b = (window as unknown as { GhabiyNative?: AudioBridge }).GhabiyNative;
  return b && typeof b.setSpeaker === "function" && typeof b.callAudio === "function" ? b : null;
}

function newCallId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// رنين بسيط مصنوع بالكود (بدون ملفات صوت)
function createRinger(kind: "incoming" | "outgoing") {
  let ctx: AudioContext | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;

  const beep = () => {
    if (!ctx) return;
    const now = ctx.currentTime;
    const tones = kind === "incoming" ? [880, 660] : [440];
    tones.forEach((freq, i) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.0001, now + i * 0.35);
      gain.gain.exponentialRampToValueAtTime(0.25, now + i * 0.35 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.35 + 0.3);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(now + i * 0.35);
      osc.stop(now + i * 0.35 + 0.32);
    });
    if (kind === "incoming") {
      try {
        navigator.vibrate?.([400, 200, 400]);
      } catch {
        /* */
      }
    }
  };

  return {
    start() {
      try {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ctx = new Ctor();
        void ctx.resume().catch(() => undefined);
        beep();
        timer = setInterval(beep, kind === "incoming" ? 1800 : 3000);
      } catch {
        /* الصوت غير متاح */
      }
    },
    stop() {
      clearInterval(timer);
      timer = undefined;
      try {
        navigator.vibrate?.(0);
      } catch {
        /* */
      }
      void ctx?.close().catch(() => undefined);
      ctx = null;
    },
  };
}

export function CallProvider({ children }: { children: ReactNode }) {
  const { profile, relationOf, directory } = useFriends();
  const myId = profile.id;

  // نجهّز السيرفر الوسيط من يفتح التطبيق، حتى المكالمة تبدي بسرعة
  useEffect(() => {
    if (myId) void ensureTurnServers(10_000);
  }, [myId]);

  const [phase, setPhase] = useState<CallPhase>("idle");
  const [call, setCall] = useState<CallInfo | null>(null);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const [canToggleSpeaker, setCanToggleSpeaker] = useState(false);
  const audioActiveRef = useRef(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const facingRef = useRef<"user" | "environment">("user");
  const [seconds, setSeconds] = useState(0);
  const [endedReason, setEndedReason] = useState<string | null>(null);

  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callRef = useRef<CallInfo | null>(null);
  const phaseRef = useRef<CallPhase>("idle");
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const peerChannelRef = useRef<RealtimeChannel | null>(null);
  const peerChannelPeerRef = useRef<string | null>(null);
  const ringerRef = useRef<ReturnType<typeof createRinger> | null>(null);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // المستخدم ضغط "رد" من شاشة الأندرويد: نرد تلقائياً أول ما توصل الدعوة
  const autoAcceptRef = useRef<string | null>(null);
  // سجل المكالمة: متى بدت، متى انردّت، وشنو صار بيها
  const startedAtRef = useRef<string>(new Date().toISOString());
  const answeredAtRef = useRef<number | null>(null);
  const outcomeRef = useRef<CallStatus | null>(null);
  const loggedRef = useRef<string | null>(null);
  const acceptCallRef = useRef<() => Promise<void>>(async () => undefined);
  const relationOfRef = useRef(relationOf);
  relationOfRef.current = relationOf;
  const directoryRef = useRef(directory);
  directoryRef.current = directory;

  const updatePhase = useCallback((next: CallPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  // ── قناة الطرف الثاني (نرسل عليها الإشارات) ──
  const openPeerChannel = useCallback(async (peerId: string) => {
    // القناة مفتوحة أصلاً لنفس الشخص: نستعملها
    if (peerChannelRef.current && peerChannelPeerRef.current === peerId) {
      return peerChannelRef.current;
    }
    if (peerChannelRef.current) {
      void supabase.removeChannel(peerChannelRef.current);
      peerChannelRef.current = null;
    }
    const channel = supabase.channel(`call:${peerId}`, {
      config: { broadcast: { self: false, ack: true } },
    });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("signal-timeout")), 10_000);
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timer);
          resolve();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          clearTimeout(timer);
          reject(new Error(status));
        }
      });
    });
    peerChannelRef.current = channel;
    peerChannelPeerRef.current = peerId;
    return channel;
  }, []);

  const sendSignal = useCallback(async (signal: Signal) => {
    const channel = peerChannelRef.current;
    if (!channel) return;
    await channel.send({ type: "broadcast", event: "signal", payload: signal });
  }, []);

  // ── تنظيف كل شي بعد انتهاء المكالمة ──
  const cleanup = useCallback(
    (reason: string | null) => {
      // المتصل يسجّل المكالمة بالسجل (مرة وحدة لكل مكالمة)
      const ended = callRef.current;
      if (ended && ended.direction === "out" && myId && loggedRef.current !== ended.callId) {
        loggedRef.current = ended.callId;
        const answeredAt = answeredAtRef.current;
        const status: CallStatus = answeredAt ? "answered" : outcomeRef.current ?? "missed";
        void saveCallLog({
          callId: ended.callId,
          callerId: myId,
          calleeId: ended.peerId,
          video: ended.video,
          status,
          durationSeconds: answeredAt ? (Date.now() - answeredAt) / 1000 : 0,
          startedAt: startedAtRef.current,
        });
      }
      answeredAtRef.current = null;
      outcomeRef.current = null;
      clearTimeout(ringTimeoutRef.current);
      ringerRef.current?.stop();
      ringerRef.current = null;
      pcRef.current?.getSenders().forEach((s) => s.track?.stop());
      pcRef.current?.close();
      pcRef.current = null;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      pendingOfferRef.current = null;
      pendingIceRef.current = [];
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
      setLocalStream(null);
      setRemoteStream(null);
      setCameraOff(false);
      facingRef.current = "user";
      if (peerChannelRef.current) {
        void supabase.removeChannel(peerChannelRef.current);
        peerChannelRef.current = null;
      }
      peerChannelPeerRef.current = null;
      setMuted(false);
      setEndedReason(reason);
      if (callRef.current) {
        updatePhase("ended");
        setTimeout(() => {
          if (phaseRef.current === "ended") {
            callRef.current = null;
            setCall(null);
            setSeconds(0);
            updatePhase("idle");
          }
        }, 1800);
      } else {
        updatePhase("idle");
      }
    },
    [myId, updatePhase],
  );

  // ── إنشاء اتصال WebRTC ──
  const createPeer = useCallback(
    (info: CallInfo) => {
      const pc = new RTCPeerConnection({ iceServers: iceServers() });
      pc.onicecandidate = (event) => {
        if (event.candidate && myId) {
          void sendSignal({
            type: "ice",
            callId: info.callId,
            from: myId,
            candidate: event.candidate.toJSON(),
          });
        }
      };
      pc.ontrack = (event) => {
        const [stream] = event.streams;
        if (stream) setRemoteStream(stream);
        if (remoteAudioRef.current && stream) {
          remoteAudioRef.current.srcObject = stream;
          void remoteAudioRef.current.play().catch(() => undefined);
        }
      };
      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === "connected") {
          ringerRef.current?.stop();
          clearTimeout(ringTimeoutRef.current);
          if (!answeredAtRef.current) answeredAtRef.current = Date.now();
          updatePhase("active");
        } else if (state === "failed") {
          void sendSignal({ type: "hangup", callId: info.callId, from: myId });
          if (!answeredAtRef.current) outcomeRef.current = "failed";
          cleanup("تعذر ربط المكالمة بين الجهازين (الشبكة تمنع الاتصال)");
        } else if (state === "disconnected") {
          // ننطي فرصة قصيرة يرجع الاتصال
          setTimeout(() => {
            if (pcRef.current === pc && pc.connectionState === "disconnected") {
              cleanup("انقطع الاتصال");
            }
          }, 6000);
        }
      };
      pcRef.current = pc;
      return pc;
    },
    [cleanup, myId, sendSignal, updatePhase],
  );

  const flushPendingIce = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || !pc.remoteDescription) return;
    const list = pendingIceRef.current;
    pendingIceRef.current = [];
    for (const candidate of list) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (err) {
        console.warn("ICE candidate error", err);
      }
    }
  }, []);

  const getMedia = useCallback(async (video: boolean) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("المتصفح ما يدعم المايكروفون");
    }
    const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
    let stream: MediaStream;
    if (video) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio,
          video: { facingMode: facingRef.current, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } },
        });
      } catch (err) {
        // الكاميرا مو متاحة: نكمل بالصوت بس
        console.warn("camera unavailable, audio only", err);
        toast.info("ما گدرنا نشغّل الكاميرا، المكالمة تكمل بالصوت");
        stream = await navigator.mediaDevices.getUserMedia({ audio, video: false });
      }
    } else {
      stream = await navigator.mediaDevices.getUserMedia({ audio, video: false });
    }
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  }, []);

  // إشعار "مكالمة فائتة" يشيل إشعار الرنين من تلفون الصديق
  const notifyMissed = useCallback(
    (info: CallInfo) => {
      if (info.direction !== "out") return;
      void notifyFriend(
        info.peerId,
        "call-end",
        "📵 مكالمة فائتة",
        `من ${profile.name || "صديق"}`,
        "/friends",
        `call-${info.callId}`,
      );
    },
    [profile.name],
  );

  // ── بدء مكالمة ──
  const startCall = useCallback(
    async (peerId: string, peerName: string, video = false) => {
      if (!myId) {
        toast.error("لازم تسجّل دخول أول");
        return;
      }
      if (phaseRef.current !== "idle") {
        toast.info("أكو مكالمة شغالة هسه");
        return;
      }
      const info: CallInfo = { callId: newCallId(), peerId, peerName, direction: "out", video };
      startedAtRef.current = new Date().toISOString();
      answeredAtRef.current = null;
      outcomeRef.current = null;
      callRef.current = info;
      setCall(info);
      setSeconds(0);
      setEndedReason(null);
      updatePhase("outgoing");

      try {
        const [stream] = await Promise.all([getMedia(video), ensureTurnServers()]);
        await openPeerChannel(peerId);
        const pc = createPeer(info);
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        if (video && stream.getVideoTracks().length === 0) {
          // ما عندي كاميرا بس أريد أشوف صديقي
          pc.addTransceiver("video", { direction: "recvonly" });
        }
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await sendSignal({
          type: "invite",
          callId: info.callId,
          from: myId,
          fromName: profile.name || "صديق",
          sdp: { type: offer.type, sdp: offer.sdp },
          video,
        });
        // إشعار Push حتى يرن تلفونه لو التطبيق مسكّر
        const myName = profile.name || "صديق";
        void notifyFriend(
          peerId,
          "call",
          video ? `📹 مكالمة فيديو من ${myName}` : `📞 مكالمة من ${myName}`,
          "اضغط حتى ترد على المكالمة",
          `/friends?call=${encodeURIComponent(info.callId)}&from=${encodeURIComponent(myId)}`,
          `call-${info.callId}`,
        ).then((r) => {
          // نوضّح للمتصل إذا الإشعار ما وصل لتلفون صديقه
          if (r.sent > 0) return;
          if (r.devices === 0) {
            toast.info("صديقك ما مفعّل الإشعارات، يرن بس إذا التطبيق مفتوح عنده", { duration: 6000 });
          } else {
            toast.error(`ما وصل إشعار المكالمة: ${r.reason || "سبب غير معروف"}`, { duration: 10000 });
          }
        });
        ringerRef.current = createRinger("outgoing");
        ringerRef.current.start();
        ringTimeoutRef.current = setTimeout(() => {
          if (phaseRef.current === "outgoing") {
            void sendSignal({ type: "hangup", callId: info.callId, from: myId });
            notifyMissed(info);
            cleanup("ما رد");
          }
        }, RING_TIMEOUT_MS);
      } catch (err) {
        console.error("فشل بدء المكالمة:", err);
        loggedRef.current = info.callId; // المكالمة ما بدت أصلاً: ما نسجّلها
        const name = err instanceof DOMException ? err.name : "";
        cleanup(
          name === "NotAllowedError"
            ? "لازم تسمح للتطبيق يستخدم المايكروفون"
            : "تعذر بدء المكالمة، تأكد من الإنترنت",
        );
      }
    },
    [cleanup, createPeer, getMedia, myId, notifyMissed, openPeerChannel, profile.name, sendSignal, updatePhase],
  );

  // ── الرد على مكالمة واردة ──
  const acceptCall = useCallback(async () => {
    const info = callRef.current;
    const offer = pendingOfferRef.current;
    if (!info || !offer || phaseRef.current !== "incoming") return;
    ringerRef.current?.stop();
    clearTimeout(ringTimeoutRef.current);
    updatePhase("connecting");
    try {
      const [stream] = await Promise.all([getMedia(info.video), ensureTurnServers()]);
      const pc = createPeer(info);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      await pc.setRemoteDescription(offer);
      await flushPendingIce();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendSignal({
        type: "answer",
        callId: info.callId,
        from: myId,
        sdp: { type: answer.type, sdp: answer.sdp },
      });
      ringTimeoutRef.current = setTimeout(() => {
        if (phaseRef.current === "connecting") {
          void sendSignal({ type: "hangup", callId: info.callId, from: myId });
          cleanup("تعذر ربط الصوت بين الجهازين");
        }
      }, 25_000);
    } catch (err) {
      console.error("فشل الرد:", err);
      void sendSignal({ type: "hangup", callId: info.callId, from: myId });
      const name = err instanceof DOMException ? err.name : "";
      cleanup(name === "NotAllowedError" ? "لازم تسمح للتطبيق يستخدم المايكروفون" : "تعذر الرد على المكالمة");
    }
  }, [cleanup, createPeer, flushPendingIce, getMedia, myId, sendSignal, updatePhase]);

  acceptCallRef.current = acceptCall;

  const rejectCall = useCallback(() => {
    const info = callRef.current;
    if (!info) return;
    void sendSignal({ type: "reject", callId: info.callId, from: myId, reason: "declined" });
    cleanup("رفضت المكالمة");
  }, [cleanup, myId, sendSignal]);

  const hangUp = useCallback(() => {
    const info = callRef.current;
    if (!info) return;
    void sendSignal({ type: "hangup", callId: info.callId, from: myId });
    if (phaseRef.current === "outgoing") {
      notifyMissed(info);
      outcomeRef.current = "cancelled";
    }
    cleanup("انتهت المكالمة");
  }, [cleanup, myId, notifyMissed, sendSignal]);

  // وضع صوت المكالمة: الصوتية تبدي بسماعة الأذن، والفيديو بالسبيكر (مثل الواتساب)
  useEffect(() => {
    const bridge = audioBridge();
    setCanToggleSpeaker(!!bridge);
    if (!bridge) return;
    const inCall = phase === "outgoing" || phase === "connecting" || phase === "active";
    if (inCall && !audioActiveRef.current) {
      audioActiveRef.current = true;
      const startOnSpeaker = !!call?.video;
      bridge.callAudio?.(true);
      bridge.setSpeaker?.(startOnSpeaker);
      setSpeaker(startOnSpeaker);
    } else if (!inCall && audioActiveRef.current) {
      audioActiveRef.current = false;
      bridge.callAudio?.(false);
      setSpeaker(false);
    }
  }, [phase, call?.video]);

  const toggleSpeaker = useCallback(() => {
    const bridge = audioBridge();
    if (!bridge) return;
    const next = !speaker;
    bridge.setSpeaker?.(next);
    setSpeaker(next);
  }, [speaker]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !muted;
    stream.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
  }, [muted]);

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !cameraOff;
    stream.getVideoTracks().forEach((t) => (t.enabled = !next));
    setCameraOff(next);
  }, [cameraOff]);

  // تبديل الكاميرا الأمامية/الخلفية
  const switchCamera = useCallback(async () => {
    const stream = localStreamRef.current;
    const pc = pcRef.current;
    if (!stream || stream.getVideoTracks().length === 0) return;
    const nextFacing = facingRef.current === "user" ? "environment" : "user";
    try {
      const fresh = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: nextFacing, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      const newTrack = fresh.getVideoTracks()[0];
      const oldTrack = stream.getVideoTracks()[0];
      const sender = pc?.getSenders().find((sd) => sd.track?.kind === "video");
      if (sender) await sender.replaceTrack(newTrack);
      stream.removeTrack(oldTrack);
      oldTrack.stop();
      newTrack.enabled = !cameraOff;
      stream.addTrack(newTrack);
      facingRef.current = nextFacing;
      setLocalStream(new MediaStream(stream.getTracks()));
    } catch (err) {
      console.warn("switch camera failed", err);
      toast.error("ما گدرنا نبدّل الكاميرا");
    }
  }, [cameraOff]);

  // ── الاستماع على قناتي للإشارات الواردة ──
  useEffect(() => {
    if (!myId) return;

    const handleSignal = async (signal: Signal) => {
      if (!signal || signal.from === myId) return;
      const current = callRef.current;

      if (signal.type === "invite") {
        // نقبل المكالمات من الأصدقاء فقط
        if (relationOfRef.current(signal.from) !== "friend") return;
        if (phaseRef.current !== "idle") {
          // مشغول: نبلغ المتصل
          try {
            const busyChannel = supabase.channel(`call:${signal.from}`, {
              config: { broadcast: { self: false } },
            });
            busyChannel.subscribe((status) => {
              if (status === "SUBSCRIBED") {
                void busyChannel
                  .send({
                    type: "broadcast",
                    event: "signal",
                    payload: { type: "reject", callId: signal.callId, from: myId, reason: "busy" },
                  })
                  .finally(() => void supabase.removeChannel(busyChannel));
              }
            });
          } catch {
            /* */
          }
          return;
        }
        const friend = directoryRef.current.find((p) => p.id === signal.from);
        const info: CallInfo = {
          callId: signal.callId,
          peerId: signal.from,
          peerName: friend?.name || signal.fromName || "صديق",
          direction: "in",
          video: Boolean(signal.video),
        };
        callRef.current = info;
        pendingOfferRef.current = signal.sdp;
        pendingIceRef.current = [];
        setCall(info);
        setSeconds(0);
        setEndedReason(null);
        updatePhase("incoming");
        try {
          await openPeerChannel(signal.from);
        } catch (err) {
          console.error("تعذر فتح قناة الرد:", err);
        }
        if (autoAcceptRef.current === signal.callId) {
          autoAcceptRef.current = null;
          void acceptCallRef.current();
          return;
        }
        ringerRef.current = createRinger("incoming");
        ringerRef.current.start();
        ringTimeoutRef.current = setTimeout(() => {
          if (phaseRef.current === "incoming") cleanup("مكالمة فائتة");
        }, RING_TIMEOUT_MS);
        if (document.visibilityState !== "visible" && "Notification" in window && Notification.permission === "granted") {
          try {
            new Notification("📞 مكالمة واردة", { body: info.peerName, tag: "incoming-call" });
          } catch {
            /* */
          }
        }
        return;
      }

      // باقي الإشارات لازم تخص المكالمة الحالية
      if (!current || signal.callId !== current.callId || signal.from !== current.peerId) return;

      if (signal.type === "answer") {
        const pc = pcRef.current;
        if (!pc) return;
        ringerRef.current?.stop();
        clearTimeout(ringTimeoutRef.current);
        updatePhase("connecting");
        try {
          await pc.setRemoteDescription(signal.sdp);
          await flushPendingIce();
        } catch (err) {
          console.error("خطأ بالرد:", err);
          cleanup("تعذر ربط المكالمة");
        }
        return;
      }

      if (signal.type === "ice") {
        const pc = pcRef.current;
        if (pc && pc.remoteDescription) {
          try {
            await pc.addIceCandidate(signal.candidate);
          } catch (err) {
            console.warn("ICE error", err);
          }
        } else {
          pendingIceRef.current.push(signal.candidate);
        }
        return;
      }

      if (signal.type === "ready") {
        // صديقك فتح التطبيق من الإشعار: نعيد إرسال الدعوة (فيها كل عناوين الشبكة)
        const pc = pcRef.current;
        if (phaseRef.current === "outgoing" && pc?.localDescription) {
          await sendSignal({
            type: "invite",
            callId: current.callId,
            from: myId,
            fromName: profile.name || "صديق",
            sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp },
            video: current.video,
          });
        }
        return;
      }

      if (signal.type === "reject") {
        outcomeRef.current = signal.reason === "busy" ? "busy" : "declined";
        cleanup(signal.reason === "busy" ? "الخط مشغول" : "رفض المكالمة");
        return;
      }

      if (signal.type === "hangup") {
        cleanup(phaseRef.current === "incoming" ? "مكالمة فائتة" : "انتهت المكالمة");
      }
    };

    const inbox = supabase
      .channel(`call:${myId}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "signal" }, ({ payload }) => {
        void handleSignal(payload as Signal);
      })
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        // فتح التطبيق من إشعار مكالمة؟ نبلغ المتصل حتى يعيد إرسال الدعوة
        try {
          const params = new URLSearchParams(window.location.search);
          const callId = params.get("call");
          const from = params.get("from");
          if (callId && from && from !== myId) {
            if (params.get("autoaccept") === "1") autoAcceptRef.current = callId;
            params.delete("call");
            params.delete("from");
            params.delete("autoaccept");
            const rest = params.toString();
            window.history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : ""));
            void (async () => {
              try {
                await openPeerChannel(from);
                await sendSignal({ type: "ready", callId, from: myId });
              } catch (err) {
                console.warn("ready signal failed", err);
              }
            })();
          }
        } catch (err) {
          console.warn("ready signal failed", err);
        }
      });

    return () => {
      void supabase.removeChannel(inbox);
    };
  }, [cleanup, flushPendingIce, myId, openPeerChannel, profile.name, sendSignal, updatePhase]);

  // عدّاد وقت المكالمة
  useEffect(() => {
    if (phase !== "active") return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  // إنهاء المكالمة إذا سكّر الصفحة
  useEffect(() => {
    const onUnload = () => {
      const info = callRef.current;
      if (info && phaseRef.current !== "idle" && phaseRef.current !== "ended") {
        void sendSignal({ type: "hangup", callId: info.callId, from: myId });
      }
    };
    window.addEventListener("pagehide", onUnload);
    return () => window.removeEventListener("pagehide", onUnload);
  }, [myId, sendSignal]);

  const value = useMemo<CallValue>(
    () => ({
      phase,
      call,
      muted,
      speaker,
      canToggleSpeaker,
      toggleSpeaker,
      seconds,
      endedReason,
      startCall,
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
    }),
    [
      phase,
      call,
      muted,
      speaker,
      canToggleSpeaker,
      toggleSpeaker,
      seconds,
      endedReason,
      startCall,
      acceptCall,
      rejectCall,
      hangUp,
      toggleMute,
      localStream,
      remoteStream,
      cameraOff,
      toggleCamera,
      switchCamera,
    ],
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}
