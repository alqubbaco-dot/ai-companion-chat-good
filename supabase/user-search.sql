-- ============================================================
-- القبة: البحث داخل السيرفر بدل تحميل قائمة كل المستخدمين
-- شغّل هذا الملف من Supabase > SQL Editor > Run (آمن للتشغيل أكثر من مرة)
-- (تم تشغيله على المشروع بتاريخ 19 أكتوبر 2026)
-- ============================================================

-- 0) قفل الجدول بوجه غير المسجّلين + حذف الأعمدة الفارغة القديمة
drop policy if exists "Enable insert for anonymous signup" on public.users_directory;
drop policy if exists "Enable restricted select for anonymous users" on public.users_directory;
revoke all on public.users_directory from anon;
alter table public.users_directory drop column if exists password;
alter table public.users_directory drop column if exists phone;

-- 1) البحث بالاسم أو اسم المستخدم: أول 20 نتيجة، بدون "آخر ظهور"
create or replace function public.search_users(p_query text)
returns table (id text, name text, name_en text, handle text, status text, avatar_url text, accent text)
language sql
stable
security definer
set search_path = public
as $$
  select d.id, d.name, d.name_en, d.handle, d.status, d.avatar_url, d.accent
  from public.users_directory d
  where auth.uid() is not null
    and char_length(btrim(coalesce(p_query, ''))) >= 2
    and d.id <> auth.uid()::text
    and (
      strpos(lower(coalesce(d.name, '')), lower(btrim(p_query))) > 0
      or strpos(lower(coalesce(d.name_en, '')), lower(btrim(p_query))) > 0
      or strpos(lower(coalesce(d.handle, '')), lower(btrim(p_query))) > 0
    )
  order by (lower(coalesce(d.name, '')) like lower(btrim(p_query)) || '%') desc, d.name
  limit 20
$$;

-- 2) أصدقائي وطلباتي فقط. "آخر ظهور" يرجع للأصدقاء بس
create or replace function public.my_directory()
returns table (
  id text, name text, name_en text, handle text, role text, role_en text, status text,
  accent text, avatar_url text, last_seen_at timestamptz, last_seen_minutes integer
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (select auth.uid()::text as uid),
  rel as (
    select case when f.sender_id = me.uid then f.receiver_id else f.sender_id end as other,
           bool_or(f.status = 'accepted') as is_friend
    from public.friendships f, me
    where me.uid is not null and (f.sender_id = me.uid or f.receiver_id = me.uid)
    group by 1
  )
  select d.id, d.name, d.name_en, d.handle, d.role, d.role_en, d.status, d.accent, d.avatar_url,
         case when rel.is_friend then d.last_seen_at end,
         case when rel.is_friend then coalesce(d.last_seen_minutes, 0) else 0 end
  from rel
  join public.users_directory d on d.id = rel.other
$$;

-- 3) الاسم والصورة لأشخاص محددين (مثل سجل المكالمات)، بدون "آخر ظهور"
create or replace function public.users_basic(p_ids text[])
returns table (id text, name text, name_en text, handle text, status text, avatar_url text, accent text)
language sql
stable
security definer
set search_path = public
as $$
  select d.id, d.name, d.name_en, d.handle, d.status, d.avatar_url, d.accent
  from public.users_directory d
  where auth.uid() is not null
    and d.id = any (coalesce(p_ids[1:200], '{}'::text[]))
$$;

-- 4) للمستخدمين المسجّلين بس
revoke all on function public.search_users(text) from public, anon;
revoke all on function public.my_directory() from public, anon;
revoke all on function public.users_basic(text[]) from public, anon;
grant execute on function public.search_users(text) to authenticated;
grant execute on function public.my_directory() to authenticated;
grant execute on function public.users_basic(text[]) to authenticated;
