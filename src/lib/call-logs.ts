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

const LOG_FIELDS = "id,call_id,caller_id,callee_id,video,status,duration_seconds,started_at";

// سجلي أنا: نخفي المكالمات اللي مسحتها (المسح بـ supabase/call-logs-hide.sql)
export async function getCallLogs(myId: string, limit = 100): Promise<CallLog[]> {
  const { data, error } = await supabase
    .from("call_logs")
    .select(LOG_FIELDS)
    .or(
      `and(caller_id.eq.${myId},hidden_for_caller.eq.false),and(callee_id.eq.${myId},hidden_for_callee.eq.false)`,
    )
    .order("started_at", { ascending: false })
    .limit(limit);
  if (!error) return (data || []) as CallLog[];

  // ملف المسح بعده ما انشغّل بـ Supabase: نعرض السجل بالطريقة القديمة
  if (/hidden_for_/.test(error.message)) {
    const old = await supabase
      .from("call_logs")
      .select(LOG_FIELDS)
      .order("started_at", { ascending: false })
      .limit(limit);
    if (old.error) throw old.error;
    return (old.data || []) as CallLog[];
  }
  throw error;
}

// يمسح مكالمات معيّنة من سجلي فقط (تبقى بسجل صديقي)
export async function hideCallLogs(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.rpc("hide_call_logs", { p_ids: ids });
  if (error) throw error;
}

// يمسح كل سجلي
export async function clearCallLogs(): Promise<void> {
  const { error } = await supabase.rpc("clear_call_logs");
  if (error) throw error;
}
