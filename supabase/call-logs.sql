-- سجل المكالمات (صادرة، واردة، فائتة)
-- شغّل هذا الملف مرة وحدة من Supabase → SQL Editor → New query → Run

create table if not exists public.call_logs (
  id uuid primary key default gen_random_uuid(),
  call_id text not null unique,
  caller_id uuid not null references auth.users(id) on delete cascade,
  callee_id uuid not null references auth.users(id) on delete cascade,
  video boolean not null default false,
  -- answered = انرد عليها، missed = ما رد، cancelled = المتصل سكّر قبل الرد،
  -- declined = انرفضت، busy = الخط مشغول، failed = ما ربطت
  status text not null check (status in ('answered', 'missed', 'cancelled', 'declined', 'busy', 'failed')),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  started_at timestamptz not null default now()
);

create index if not exists call_logs_caller_idx on public.call_logs (caller_id, started_at desc);
create index if not exists call_logs_callee_idx on public.call_logs (callee_id, started_at desc);

alter table public.call_logs enable row level security;

-- كل واحد يشوف بس مكالماته (اللي سواها أو اللي وصلته)
drop policy if exists call_logs_select_own on public.call_logs;
create policy call_logs_select_own
  on public.call_logs for select to authenticated
  using (auth.uid() in (caller_id, callee_id));

-- المتصل هو اللي يسجّل المكالمة، وبس ويا صديق
drop policy if exists call_logs_insert_caller on public.call_logs;
create policy call_logs_insert_caller
  on public.call_logs for insert to authenticated
  with check (caller_id = auth.uid() and public.are_friends(caller_id, callee_id));

