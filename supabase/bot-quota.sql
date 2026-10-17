-- حد رسائل البوت (الهزلي والجاد سوية): 20 رسالة مجانية باليوم
-- والرسائل الإضافية تنشرى بالنقاط: نقطة وحدة = 5 رسائل
-- شغّل هذا الملف مرة وحدة من Supabase → SQL Editor → New query → Run
-- (لازم يكون ملف ad-points.sql مشغّل قبله)
--
-- اليوم يتجدد الساعة 12 بالليل بتوقيت بغداد.
-- الرسائل اللي تنشرى بالنقاط ما تنتهي بآخر اليوم، تبقى لحد ما يستخدمها.

-- ───────────── الجدول ─────────────

create table if not exists public.bot_usage (
  user_id uuid primary key references auth.users(id) on delete cascade,
  day date not null default (now() at time zone 'Asia/Baghdad')::date,
  used_today integer not null default 0 check (used_today >= 0),
  extra integer not null default 0 check (extra >= 0),
  updated_at timestamptz not null default now()
);

alter table public.bot_usage enable row level security;

drop policy if exists bot_usage_read_own on public.bot_usage;
create policy bot_usage_read_own on public.bot_usage
  for select to authenticated using (user_id = auth.uid());

-- ───────────── الإعدادات ─────────────
-- تكدر تغيّر الأرقام من هنا بدون تحديث التطبيق

create or replace function public.bot_daily_free()
returns integer language sql immutable as $$ select 20 $$;

create or replace function public.bot_messages_per_point()
returns integer language sql immutable as $$ select 5 $$;

-- ───────────── الدوال ─────────────

-- حالة رسائل المستخدم الحالي
create or replace function public.my_bot_quota()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'free_left', greatest(0, public.bot_daily_free() - coalesce((
      select case when day = (now() at time zone 'Asia/Baghdad')::date then used_today else 0 end
      from public.bot_usage where user_id = auth.uid()
    ), 0)),
    'extra', coalesce((select extra from public.bot_usage where user_id = auth.uid()), 0),
    'daily_free', public.bot_daily_free(),
    'per_point', public.bot_messages_per_point()
  )
  where auth.uid() is not null;
$$;

-- يحسب رسالة وحدة على المستخدم (من المجاني أول، وبعدين من المشتراة)
-- يرجّع 'ok' أو 'exhausted'
create or replace function public.use_bot_message()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'Asia/Baghdad')::date;
  row_ public.bot_usage;
begin
  if auth.uid() is null then
    return 'not_authenticated';
  end if;

  insert into public.bot_usage (user_id, day) values (auth.uid(), today)
  on conflict (user_id) do nothing;

  -- نقفل الصف حتى رسالتين بنفس اللحظة ما يعبرن الحد
  select * into row_ from public.bot_usage where user_id = auth.uid() for update;

  if row_.day <> today then
    row_.day := today;
    row_.used_today := 0;
  end if;

  if row_.used_today < public.bot_daily_free() then
    row_.used_today := row_.used_today + 1;
  elsif row_.extra > 0 then
    row_.extra := row_.extra - 1;
  else
    update public.bot_usage set day = row_.day, used_today = row_.used_today, updated_at = now()
      where user_id = auth.uid();
    return 'exhausted';
  end if;

  update public.bot_usage
    set day = row_.day, used_today = row_.used_today, extra = row_.extra, updated_at = now()
    where user_id = auth.uid();
  return 'ok';
end;
$$;

-- يشتري رسائل إضافية: يخصم نقطة وحدة ويضيف 5 رسائل
create or replace function public.buy_bot_messages()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance integer;
begin
  if auth.uid() is null then
    return 'not_authenticated';
  end if;

  select balance into current_balance from public.user_points where user_id = auth.uid() for update;
  if coalesce(current_balance, 0) < 1 then
    return 'not_enough_points';
  end if;

  update public.user_points
    set balance = balance - 1, updated_at = now()
    where user_id = auth.uid();

  insert into public.bot_usage (user_id, extra) values (auth.uid(), public.bot_messages_per_point())
  on conflict (user_id) do update
    set extra = public.bot_usage.extra + public.bot_messages_per_point(),
        updated_at = now();

  return 'bought';
end;
$$;

-- من يكدر يستدعي شنو
revoke all on function public.my_bot_quota() from public, anon;
revoke all on function public.use_bot_message() from public, anon;
revoke all on function public.buy_bot_messages() from public, anon;
grant execute on function public.my_bot_quota() to authenticated;
grant execute on function public.use_bot_message() to authenticated;
grant execute on function public.buy_bot_messages() to authenticated;
