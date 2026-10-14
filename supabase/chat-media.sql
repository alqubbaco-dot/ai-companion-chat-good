-- الصور والرسائل الصوتية بالدردشة الخاصة
-- شغّل هذا الملف مرة وحدة من Supabase → SQL Editor → New query → Run
--
-- الملفات تنحفظ بمخزن خاص (chat-media) بمسار: <رقم المحادثة>/<اسم الملف>
-- وبس الطرفين بالمحادثة يكدرون يفتحوها.

-- ───────────── أعمدة جديدة بجدول الرسائل ─────────────
-- content يبقى إجباري: للصورة والصوت نحط بيه وصف قصير ("📷 صورة" / "🎤 رسالة صوتية")
-- حتى الإشعارات وقائمة الأصدقاء والنسخ القديمة تبقى تشتغل.

alter table public.private_messages
  add column if not exists kind text not null default 'text',
  add column if not exists media_path text,
  add column if not exists media_duration integer;

alter table public.private_messages drop constraint if exists private_messages_kind_check;
alter table public.private_messages
  add constraint private_messages_kind_check check (
    (kind = 'text' and media_path is null)
    or (kind in ('image', 'audio') and media_path is not null
        and split_part(media_path, '/', 1) = conversation_id::text)
  );

-- ───────────── المخزن ─────────────
-- خاص (مو عام)، وحد أقصى 5 ميغا للملف، وأنواع الصور والصوت بس

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-media',
  'chat-media',
  false,
  5242880,
  array['image/jpeg', 'image/webp', 'image/png', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- هل المستخدم الحالي طرف بالمحادثة اللي رقمها أول جزء من مسار الملف؟
create or replace function public.is_chat_media_member(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.private_conversations c
    where c.id::text = split_part(object_name, '/', 1)
      and auth.uid() in (c.user_one_id, c.user_two_id)
  );
$$;

-- رفع: بس لمحادثة إنت بيها ووياه صديق
create or replace function public.can_upload_chat_media(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.private_conversations c
    where c.id::text = split_part(object_name, '/', 1)
      and auth.uid() in (c.user_one_id, c.user_two_id)
      and public.are_friends(c.user_one_id, c.user_two_id)
  );
$$;

grant execute on function public.is_chat_media_member(text) to authenticated;
grant execute on function public.can_upload_chat_media(text) to authenticated;

drop policy if exists chat_media_read_members on storage.objects;
create policy chat_media_read_members on storage.objects
  for select to authenticated
  using (bucket_id = 'chat-media' and public.is_chat_media_member(name));

drop policy if exists chat_media_upload_members on storage.objects;
create policy chat_media_upload_members on storage.objects
  for insert to authenticated
  with check (bucket_id = 'chat-media' and public.can_upload_chat_media(name));

drop policy if exists chat_media_delete_owner on storage.objects;
create policy chat_media_delete_owner on storage.objects
  for delete to authenticated
  using (bucket_id = 'chat-media' and owner_id = auth.uid()::text);
