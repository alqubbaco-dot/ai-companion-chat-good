-- الصورة الشخصية
-- شغّل هذا الملف مرة وحدة من Supabase → SQL Editor → New query → الصق → Run
-- آمن إذا تشغّله أكثر من مرة.

-- ١) عمود رابط الصورة بدليل الحسابات
alter table public.users_directory
  add column if not exists avatar_url text;

-- ٢) مكان حفظ الصور: عام للعرض، حد أقصى 2 ميغا، صور فقط
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ٣) كل مستخدم يرفع/يغيّر/يحذف بس بمجلده الخاص (avatars/<رقم حسابه>/...)
drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_select_own on storage.objects;
create policy avatars_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ٤) حفظ رابط الصورة (أو حذفه بـ null) — بس لصور من مجلد المستخدم نفسه
create or replace function public.set_my_avatar(p_url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid text := auth.uid()::text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_url is not null and position(('/storage/v1/object/public/avatars/' || uid || '/') in p_url) = 0 then
    raise exception 'invalid avatar url';
  end if;
  update public.users_directory set avatar_url = p_url where id::text = uid;
end;
$$;

grant execute on function public.set_my_avatar(text) to authenticated;
