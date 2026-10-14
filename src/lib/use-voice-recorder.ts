import { useCallback, useEffect, useRef, useState } from "react";

// تسجيل رسالة صوتية بالمايكروفون (MediaRecorder)، حد أقصى دقيقتين

export const MAX_VOICE_SECONDS = 120;

export type VoiceResult = { blob: Blob; contentType: string; ext: string; duration: number };

const CANDIDATES: { mime: string; contentType: string; ext: string }[] = [
  { mime: "audio/webm;codecs=opus", contentType: "audio/webm", ext: "webm" },
  { mime: "audio/webm", contentType: "audio/webm", ext: "webm" },
  { mime: "audio/mp4", contentType: "audio/mp4", ext: "m4a" },
  { mime: "audio/ogg;codecs=opus", contentType: "audio/ogg", ext: "ogg" },
];

function pickFormat() {
  if (typeof MediaRecorder === "undefined") return null;
  for (const c of CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(c.mime)) return c;
    } catch {
      /* */
    }
  }
  return null;
}

export function useVoiceRecorder(onFinished: (result: VoiceResult) => void, onError: (message: string) => void) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sendOnStopRef = useRef(true);
  // المستخدم بعده ضاغط؟ (إذا شال إصبعه قبل ما يشتغل المايك، ما نبدي)
  const wantRef = useRef(false);
  const finishedRef = useRef(onFinished);
  finishedRef.current = onFinished;

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    setRecording(false);
    setElapsed(0);
  }, []);

  const stop = useCallback((send: boolean) => {
    wantRef.current = false;
    const rec = recorderRef.current;
    sendOnStopRef.current = send;
    if (rec && rec.state !== "inactive") rec.stop();
    else cleanup();
  }, [cleanup]);

  const start = useCallback(async () => {
    if (recorderRef.current) return;
    wantRef.current = true;
    const format = pickFormat();
    if (!format || !navigator.mediaDevices?.getUserMedia) {
      onError("جهازك ما يدعم تسجيل الرسائل الصوتية");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!wantRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      const rec = new MediaRecorder(stream, { mimeType: format.mime });
      recorderRef.current = rec;
      chunksRef.current = [];
      sendOnStopRef.current = true;
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const duration = (Date.now() - startedAtRef.current) / 1000;
        const blob = new Blob(chunksRef.current, { type: format.contentType });
        const send = sendOnStopRef.current;
        cleanup();
        // أقل من ثانية = ضغطة بالغلط، ما نرسلها
        if (send && duration >= 1 && blob.size > 0) {
          finishedRef.current({ blob, contentType: format.contentType, ext: format.ext, duration });
        }
      };
      startedAtRef.current = Date.now();
      rec.start(250);
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => {
        const secs = (Date.now() - startedAtRef.current) / 1000;
        setElapsed(secs);
        if (secs >= MAX_VOICE_SECONDS) stop(true);
      }, 200);
    } catch {
      cleanup();
      onError("لازم تسمح بالمايكروفون حتى تسجّل رسالة صوتية");
    }
  }, [cleanup, onError, stop]);

  // إذا طلع من الصفحة وهو يسجّل: نلغي
  useEffect(() => () => {
    sendOnStopRef.current = false;
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  return { recording, elapsed, start, stop };
}
