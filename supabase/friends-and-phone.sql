-- ============================================================
-- الغباء الصناعي: حفظ الملف الشخصي + البحث برقم الموبايل + روابط الدعوة
-- شغّل هذا الملف مرة وحدة من Supabase > SQL Editor > Run
-- آمن للتشغيل أكثر من مرة
-- ============================================================

-- 1) جدول خاص بأرقام الموبايل: محد يكدر يقراه مباشرة، بس عن طريق الدوال تحت
create table if not exists public.user_phones (
  user_id text primary key,
  phone text not null unique,
  updated_at timestamptz not null default now()
);
alter table public.user_phones enable row level security;
-- ماكو أي قاعدة قراءة/كتابة = الجدول مقفول على الكل، والدوال تشتغل بصلاحية النظام
revoke all on public.user_phones from anon, authenticated;

-- 2) توحيد شكل الرقم: 0770... أو +964770... أو 00964770... كلها تصير 964770...
create or replace function public.normalize_phone(p text)
returns text
language sql
immutable
as $$
  select case
    when d ~ '^9647[0-9]{9}$' then d
    when d ~ '^07[0-9]{9}$' then '964' || substr(d, 2)
    when d ~ '^7[0-9]{9}$' then '964' || d
    when d ~ '^009647[0-9]{9}$' then substr(d, 3)
    when length(d) between 8 and 15 and d !~ '^0' then d
    else null
  end
  from (select regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') as d) s
$$;

-- 3) حفظ اسمي ورقمي (كل مستخدم يعدّل نفسه بس)
create or replace function public.save_my_profile(p_name text default null, p_phone text default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid text := auth.uid()::text;
  clean_name text := nullif(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), '');
  norm text;
begin
  if uid is null then
    raise exception 'not_signed_in';
  end if;

  if clean_name is not null then
    if char_length(clean_name) < 2 or char_length(clean_name) > 40 then
      raise exception 'bad_name';
    end if;
    update public.users_directory set name = clean_name, name_en = clean_name where id::text = uid;
    if not found then
      -- نستخدم قيم نصية بدون نوع حتى تتوافق مع أنواع الأعمدة الموجودة
      execute format(
        'insert into public.users_directory (id, name, name_en, handle, role, role_en, status, last_seen_minutes, accent)
         values (%L, %L, %L, %L, %L, %L, %L, 0, %L)',
        uid, clean_name, clean_name, '@user_' || left(replace(uid, '-', ''), 6),
        'مستخدم حقيقي', 'Real User', 'online', 'teal'
      );
    end if;
  end if;

  if p_phone is not null and btrim(p_phone) <> '' then
    norm := public.normalize_phone(p_phone);
    if norm is null then
      raise exception 'bad_phone';
    end if;
    if exists (select 1 from public.user_phones where phone = norm and user_id <> uid) then
      raise exception 'phone_taken';
    end if;
    insert into public.user_phones (user_id, phone)
    values (uid, norm)
    on conflict (user_id) do update set phone = excluded.phone, updated_at = now();
  end if;

  return json_build_object('ok', true, 'phone', norm);
end;
$$;

-- 4) رقمي أنا (حتى يظهر بصفحة حسابي)
create or replace function public.my_phone()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select phone from public.user_phones where user_id = auth.uid()::text
$$;

-- 5) البحث برقم كامل: يرجّع الاسم بس، والرقم ما يطلع لأحد
create or replace function public.find_user_by_phone(p_phone text)
returns table (id text, name text, handle text, status text)
language sql
stable
security definer
set search_path = public
as $$
  select d.id::text, d.name::text, d.handle::text, d.status::text
  from public.user_phones p
  join public.users_directory d on d.id::text = p.user_id
  where p.phone = public.normalize_phone(p_phone)
    and p.user_id <> coalesce(auth.uid()::text, '')
  limit 1
$$;

-- 6) قبول رابط الدعوة: يصيرون أصدقاء مباشرة
create or replace function public.accept_invite(p_inviter text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid text := auth.uid()::text;
  inviter_name text;
begin
  if uid is null then
    raise exception 'not_signed_in';
  end if;
  if p_inviter is null or p_inviter = uid then
    return json_build_object('ok', false, 'reason', 'self');
  end if;

  select name::text into inviter_name from public.users_directory where id::text = p_inviter;
  if inviter_name is null then
    raise exception 'unknown_inviter';
  end if;

  if exists (
    select 1 from public.friendships
    where (sender_id::text = uid and receiver_id::text = p_inviter)
       or (sender_id::text = p_inviter and receiver_id::text = uid)
  ) then
    -- إذا أكو طلب معلّق نقبله، والحظر ما نلمسه
    update public.friendships set status = 'accepted'
    where status = 'pending'
      and ((sender_id::text = uid and receiver_id::text = p_inviter)
        or (sender_id::text = p_inviter and receiver_id::text = uid));
  else
    execute format(
      'insert into public.friendships (sender_id, receiver_id, status) values (%L, %L, %L)',
      p_inviter, uid, 'accepted'
    );
  end if;

  return json_build_object('ok', true, 'name', inviter_name);
end;
$$;

-- 7) الدوال للمستخدمين المسجلين بس
revoke all on function public.save_my_profile(text, text) from public, anon;
revoke all on function public.my_phone() from public, anon;
revoke all on function public.find_user_by_phone(text) from public, anon;
revoke all on function public.accept_invite(text) from public, anon;
grant execute on function public.save_my_profile(text, text) to authenticated;
grant execute on function public.my_phone() to authenticated;
grant execute on function public.find_user_by_phone(text) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;
