-- إشعارات Push (المكالمات والرسائل والتطبيق مسكّر)
-- شغّل هذا الملف مرة وحدة من Supabase → SQL Editor → New query → Run

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- كل مستخدم يدير أجهزته فقط
drop policy if exists push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own
  on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- تسجيل/تحديث جهاز المستخدم الحالي (حتى لو الجهاز جان مسجّل باسم حساب ثاني)
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth, user_agent, updated_at)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth, p_user_agent, now())
  on conflict (endpoint) do update
    set user_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, updated_at = now();
end;
$$;

-- عناوين أجهزة صديق (فقط إذا الصداقة مؤكدة) حتى نرسل له إشعار
create or replace function public.push_targets(target_user uuid)
returns table (endpoint text, p256dh text, auth text)
language sql
stable
security definer
set search_path = public
as $$
  select s.endpoint, s.p256dh, s.auth
  from public.push_subscriptions s
  where s.user_id = target_user
    and auth.uid() is not null
    and public.are_friends(auth.uid(), target_user);
$$;

-- حذف جهاز صديق انتهت صلاحية عنوانه (المتصفح ألغاه)
create or replace function public.prune_push_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.push_subscriptions s
  where s.endpoint = p_endpoint
    and auth.uid() is not null
    and (s.user_id = auth.uid() or public.are_friends(auth.uid(), s.user_id));
$$;

grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.push_targets(uuid) to authenticated;
grant execute on function public.prune_push_subscription(text) to authenticated;
