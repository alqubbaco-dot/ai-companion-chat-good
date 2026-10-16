-- ============================================================
-- القبة: الإبلاغ عن مستخدم (مطلوب من Google Play لتطبيقات المحادثة)
-- شغّل هذا الملف مرة وحدة من Supabase > SQL Editor > New query > Run
-- آمن للتشغيل أكثر من مرة
--
-- البلاغات تشوفها انت من: Supabase > Table Editor > user_reports
-- المستخدمين ما يكدرون يقرون البلاغات، والمبلَّغ عنه ما يعرف منو بلّغ عليه.
-- ============================================================

create table if not exists public.user_reports (
  id bigint generated always as identity primary key,
  reporter_id uuid references auth.users (id) on delete set null,
  reported_id uuid references auth.users (id) on delete set null,
  reason text not null check (reason in ('spam', 'abuse', 'scam', 'fake', 'other')),
  note text,
  conversation_id uuid,
  status text not null default 'new' check (status in ('new', 'reviewed', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists user_reports_reported_idx on public.user_reports (reported_id, created_at desc);

-- مقفول على الكل: ماكو قراءة ولا كتابة مباشرة، بس عن طريق الدالة تحت
alter table public.user_reports enable row level security;
revoke all on public.user_reports from anon, authenticated;

create or replace function public.report_user(
  p_reported uuid,
  p_reason text,
  p_note text default null,
  p_conversation uuid default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clean_note text := nullif(btrim(left(coalesce(p_note, ''), 500)), '');
begin
  if uid is null then
    raise exception 'not_signed_in';
  end if;
  if p_reported is null or p_reported = uid then
    raise exception 'bad_target';
  end if;
  if p_reason not in ('spam', 'abuse', 'scam', 'fake', 'other') then
    raise exception 'bad_reason';
  end if;

  -- حماية من الإزعاج: بلاغ واحد على نفس الشخص كل 24 ساعة، و20 بلاغ باليوم كحد أقصى
  if exists (
    select 1 from public.user_reports
    where reporter_id = uid and reported_id = p_reported
      and created_at > now() - interval '24 hours'
  ) then
    return json_build_object('ok', true, 'duplicate', true);
  end if;
  if (select count(*) from public.user_reports
      where reporter_id = uid and created_at > now() - interval '24 hours') >= 20 then
    raise exception 'too_many_reports';
  end if;

  insert into public.user_reports (reporter_id, reported_id, reason, note, conversation_id)
  values (uid, p_reported, p_reason, clean_note, p_conversation);

  return json_build_object('ok', true);
end;
$$;

revoke all on function public.report_user(uuid, text, text, uuid) from public, anon;
grant execute on function public.report_user(uuid, text, text, uuid) to authenticated;
