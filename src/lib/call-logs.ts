import { supabase } from "./supabase";

// سجل المكالمات (الجدول بـ supabase/call-logs.sql)

export type CallStatus = "answered" | "missed" | "cancelled" | "declined" | "busy" | "failed";

export type CallLog = {
  id: string;
  call_id: string;
  caller_id: string;
  callee_id: string;
  video: boolean;
  status: CallStatus;
  duration_seconds: number;
  started_at: string;
};

export async function saveCallLog(entry: {
  callId: string;
  callerId: string;
  calleeId: string;
  video: boolean;
  status: CallStatus;
  durationSeconds: number;
  startedAt: string;
}): Promise<void> {
  const { error } = await supabase.from("call_logs").insert({
    call_id: entry.callId,
    caller_id: entry.callerId,
    callee_id: entry.calleeId,
    video: entry.video,
    status: entry.status,
    duration_seconds: Math.max(0, Math.round(entry.durationSeconds)),
    started_at: entry.startedAt,
  });
  if (error) console.warn("تعذر حفظ سجل المكالمة:", error.message);
}

export async function getCallLogs(limit = 100): Promise<CallLog[]> {
  const { data, error } = await supabase
    .from("call_logs")
    .select("id,call_id,caller_id,callee_id,video,status,duration_seconds,started_at")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as CallLog[];
}
