-- مسح سجل المكالمات (لكل شخص سجله فقط، مثل واتساب)
-- المسح يخفي المكالمة من سجلك أنت، وتبقى بسجل صديقك
-- شغّل هذا الملف مرة وحدة من Supabase → SQL Editor → New query → Run
-- (لازم يكون ملف call-logs.sql مشغّل قبله)

alter table public.call_logs add column if not exists hidden_for_caller boolean not null default false;
alter table public.call_logs add column if not exists hidden_for_callee boolean not null default false;

-- يخفي مكالمات معيّنة من سجل المستخدم الحالي
create or replace function public.hide_call_logs(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  update public.call_logs set hidden_for_caller = true
    where id = any(p_ids) and caller_id = auth.uid();
  update public.call_logs set hidden_for_callee = true
    where id = any(p_ids) and callee_id = auth.uid();
  -- إذا الطرفين مسحوها، ما إلها داعي تبقى
  delete from public.call_logs
    where id = any(p_ids) and hidden_for_caller and hidden_for_callee;
end;
$$;

-- يمسح كل سجل المستخدم الحالي
create or replace function public.clear_call_logs()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  update public.call_logs set hidden_for_caller = true
    where caller_id = auth.uid() and not hidden_for_caller;
  update public.call_logs set hidden_for_callee = true
    where callee_id = auth.uid() and not hidden_for_callee;
  delete from public.call_logs
    where auth.uid() in (caller_id, callee_id) and hidden_for_caller and hidden_for_callee;
end;
$$;

grant execute on function public.hide_call_logs(uuid[]) to authenticated;
grant execute on function public.clear_call_logs() to authenticated;
