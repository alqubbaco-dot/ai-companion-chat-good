-- نظام النقاط: كل إعلان بمكافأة = نقطة، والنقاط تفتح ميزات بالتطبيق
-- شغّل هذا الملف مرة وحدة من Supabase → SQL Editor → New query → Run
--
-- الأمان: المستخدم ما يكدر يزيد نقاطه بنفسه.
-- النقطة تنضاف فقط من السيرفر بعد ما Google تأكد إن الإعلان انشاف كامل.

-- ───────────── الجداول ─────────────

-- رصيد كل مستخدم
create table if not exists public.user_points (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  total_earned integer not null default 0,
  updated_at timestamptz not null default now()
);

-- سجل كل إعلان كمّله المستخدم (رقم العملية من Google يمنع حساب نفس الإعلان مرتين)
create table if not exists public.ad_rewards (
  transaction_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  ad_unit text,
  amount integer not null default 1,
  credited boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists ad_rewards_user_time_idx on public.ad_rewards (user_id, created_at desc);

-- الميزات وأسعارها بالنقاط (تكدر تغيّر الأسعار من هنا بدون تحديث التطبيق)
create table if not exists public.feature_prices (
  feature text primary key,
  cost integer not null check (cost > 0),
  title text not null,
  sort_order integer not null default 0
);

insert into public.feature_prices (feature, cost, title, sort_order) values
  ('themes', 10, 'ثيمات وألوان للمحادثات', 1),
  ('ringtone', 25, 'نغمة رنين مخصصة للمكالمات', 2),
  ('funny_characters', 50, 'شخصيات جديدة للوضع الهزلي', 3),
  ('voice_changer', 100, 'مغيّر الصوت بالمكالمات', 4)
on conflict (feature) do nothing;

-- الميزات اللي فتحها كل مستخدم
create table if not exists public.unlocked_features (
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null references public.feature_prices(feature),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, feature)
);

-- ───────────── الصلاحيات (RLS) ─────────────
-- كل مستخدم يشوف بياناته فقط، والكتابة بس عن طريق الدوال تحت

alter table public.user_points enable row level security;
alter table public.ad_rewards enable row level security;
alter table public.feature_prices enable row level security;
alter table public.unlocked_features enable row level security;

drop policy if exists user_points_read_own on public.user_points;
create policy user_points_read_own on public.user_points
  for select to authenticated using (user_id = auth.uid());

drop policy if exists ad_rewards_read_own on public.ad_rewards;
create policy ad_rewards_read_own on public.ad_rewards
  for select to authenticated using (user_id = auth.uid());

drop policy if exists feature_prices_read_all on public.feature_prices;
create policy feature_prices_read_all on public.feature_prices
  for select to anon, authenticated using (true);

drop policy if exists unlocked_features_read_own on public.unlocked_features;
create policy unlocked_features_read_own on public.unlocked_features
  for select to authenticated using (user_id = auth.uid());

-- ───────────── الدوال ─────────────

-- السقف اليومي للإعلانات (بتوقيت بغداد)
create or replace function public.ad_daily_limit()
returns integer language sql immutable as $$ select 15 $$;

-- إضافة نقطة بعد تأكيد Google (يستدعيها السيرفر فقط بمفتاح service_role)
create or replace function public.credit_ad_reward(
  p_user uuid,
  p_transaction text,
  p_ad_unit text,
  p_amount integer default 1
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  today_count integer;
  amount integer := greatest(1, least(coalesce(p_amount, 1), 5));
begin
  if p_user is null or coalesce(p_transaction, '') = '' then
    return 'invalid';
  end if;
  if not exists (select 1 from auth.users where id = p_user) then
    return 'unknown_user';
  end if;

  -- نفس الإعلان ما ينحسب مرتين
  if exists (select 1 from public.ad_rewards where transaction_id = p_transaction) then
    return 'duplicate';
  end if;

  select count(*) into today_count
  from public.ad_rewards
  where user_id = p_user
    and credited
    and (created_at at time zone 'Asia/Baghdad')::date = (now() at time zone 'Asia/Baghdad')::date;

  if today_count >= public.ad_daily_limit() then
    insert into public.ad_rewards (transaction_id, user_id, ad_unit, amount, credited)
    values (p_transaction, p_user, p_ad_unit, amount, false);
    return 'daily_limit';
  end if;

  insert into public.ad_rewards (transaction_id, user_id, ad_unit, amount, credited)
  values (p_transaction, p_user, p_ad_unit, amount, true);

  insert into public.user_points (user_id, balance, total_earned, updated_at)
  values (p_user, amount, amount, now())
  on conflict (user_id) do update
    set balance = public.user_points.balance + amount,
        total_earned = public.user_points.total_earned + amount,
        updated_at = now();

  return 'credited';
end;
$$;

-- حالة المستخدم الحالي: الرصيد + إعلانات اليوم + الميزات المفتوحة
create or replace function public.my_points()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'balance', coalesce((select balance from public.user_points where user_id = auth.uid()), 0),
    'total_earned', coalesce((select total_earned from public.user_points where user_id = auth.uid()), 0),
    'ads_today', (
      select count(*) from public.ad_rewards
      where user_id = auth.uid() and credited
        and (created_at at time zone 'Asia/Baghdad')::date = (now() at time zone 'Asia/Baghdad')::date
    ),
    'daily_limit', public.ad_daily_limit(),
    'unlocked', coalesce(
      (select json_agg(feature order by unlocked_at) from public.unlocked_features where user_id = auth.uid()),
      '[]'::json
    )
  )
  where auth.uid() is not null;
$$;

-- فتح ميزة بالنقاط (يخصم السعر من الرصيد)
create or replace function public.unlock_feature(p_feature text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  price integer;
  current_balance integer;
begin
  if auth.uid() is null then
    return 'not_authenticated';
  end if;

  select cost into price from public.feature_prices where feature = p_feature;
  if price is null then
    return 'unknown_feature';
  end if;

  if exists (select 1 from public.unlocked_features where user_id = auth.uid() and feature = p_feature) then
    return 'already_unlocked';
  end if;

  -- نقفل صف الرصيد حتى ما يصير خصم مرتين بنفس اللحظة
  select balance into current_balance from public.user_points where user_id = auth.uid() for update;
  if coalesce(current_balance, 0) < price then
    return 'not_enough_points';
  end if;

  update public.user_points
    set balance = balance - price, updated_at = now()
    where user_id = auth.uid();

  insert into public.unlocked_features (user_id, feature) values (auth.uid(), p_feature);
  return 'unlocked';
end;
$$;

-- من يكدر يستدعي شنو
revoke all on function public.credit_ad_reward(uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.credit_ad_reward(uuid, text, text, integer) to service_role;
grant execute on function public.my_points() to authenticated;
grant execute on function public.unlock_feature(text) to authenticated;
