import { supabase } from "./supabase";

// الصورة الشخصية: نقصّها مربّع 512×512، نرفعها لمجلد المستخدم بـ avatars، ونحفظ رابطها
// (يحتاج تشغيل supabase/avatars.sql مرة وحدة)

const BUCKET = "avatars";
const SIZE = 512;

async function squareJpeg(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("bad image"));
      el.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;
    const out = Math.min(SIZE, side);
    const canvas = document.createElement("canvas");
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out, out);
    ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    if (!blob) throw new Error("encode failed");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function myId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("سجّل دخولك أول");
  return data.user.id;
}

async function listMine(uid: string): Promise<string[]> {
  const { data } = await supabase.storage.from(BUCKET).list(uid, { limit: 100 });
  return (data || []).map((f) => `${uid}/${f.name}`);
}

/** يرفع صورة جديدة ويرجّع رابطها */
export async function uploadMyAvatar(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("اختار صورة");
  const uid = await myId();
  const blob = await squareJpeg(file);
  const path = `${uid}/${Date.now()}.jpg`;

  const { error: upError } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
  if (upError) throw upError;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const { error: saveError } = await supabase.rpc("set_my_avatar", { p_url: data.publicUrl });
  if (saveError) {
    void supabase.storage.from(BUCKET).remove([path]);
    throw saveError;
  }

  // نمسح الصور القديمة حتى ما تاخذ مكان
  const old = (await listMine(uid)).filter((p) => p !== path);
  if (old.length) void supabase.storage.from(BUCKET).remove(old);
  return data.publicUrl;
}

/** يشيل الصورة ويرجع للحرف */
export async function removeMyAvatar(): Promise<void> {
  const uid = await myId();
  const { error } = await supabase.rpc("set_my_avatar", { p_url: null });
  if (error) throw error;
  const files = await listMine(uid);
  if (files.length) await supabase.storage.from(BUCKET).remove(files);
}

/** عند حذف الحساب: نمسح كل صوره */
export async function deleteAllMyAvatars(): Promise<void> {
  const uid = await myId();
  const files = await listMine(uid);
  if (files.length) await supabase.storage.from(BUCKET).remove(files);
}
