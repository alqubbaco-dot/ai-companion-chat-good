-- "آخر ظهور" + علامات القراءة ✓✓
-- شغّل هذا الملف مرة وحدة من Supabase → SQL Editor → New query → الصق → Run
-- آمن إذا تشغّله أكثر من مرة.

-- ١) آخر ظهور: وقت آخر مرة كان التطبيق مفتوح عند المستخدم
alter table public.users_directory
  add column if not exists last_seen_at timestamptz;

create or replace function public.touch_last_seen()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  update public.users_directory
     set last_seen_at = now()
   where id::text = auth.uid()::text;
end;
$$;

grant execute on function public.touch_last_seen() to authenticated;

-- ٢) علامات القراءة: وقت قراءة الرسالة من الطرف الثاني
alter table public.private_messages
  add column if not exists read_at timestamptz;

create or replace function public.mark_conversation_read(p_conversation uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return;
  end if;
  -- لازم يكون عضو بالمحادثة
  if not exists (
    select 1 from public.private_conversations c
     where c.id = p_conversation
       and (c.user_one_id = uid or c.user_two_id = uid)
  ) then
    return;
  end if;

  update public.private_messages
     set read_at = now()
   where conversation_id = p_conversation
     and sender_id <> uid
     and read_at is null;
end;
$$;

grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- ٣) حتى توصل علامة "قُرئت" للمرسل لحظياً
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'private_messages'
  ) then
    alter publication supabase_realtime add table public.private_messages;
  end if;
end;
$$;
