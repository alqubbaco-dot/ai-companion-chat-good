create table if not exists public.private_conversations (
  id uuid primary key default gen_random_uuid(),
  user_one_id uuid not null references auth.users(id) on delete cascade,
  user_two_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_one_id < user_two_id),
  unique (user_one_id, user_two_id)
);

create table if not exists public.private_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.private_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (length(trim(content)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists private_messages_conversation_created_idx
  on public.private_messages (conversation_id, created_at);

create or replace function public.are_friends(first_user uuid, second_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
      and ((sender_id = first_user and receiver_id = second_user)
        or (sender_id = second_user and receiver_id = first_user))
  );
$$;

create or replace function public.get_or_create_private_conversation(other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  conversation_id uuid;
begin
  if current_user_id is null or other_user_id is null or current_user_id = other_user_id then
    raise exception 'invalid private conversation participants';
  end if;

  if not public.are_friends(current_user_id, other_user_id) then
    raise exception 'private conversations require an accepted friendship';
  end if;

  select id into conversation_id
  from public.private_conversations
  where user_one_id = least(current_user_id, other_user_id)
    and user_two_id = greatest(current_user_id, other_user_id);

  if conversation_id is null then
    insert into public.private_conversations (user_one_id, user_two_id)
    values (least(current_user_id, other_user_id), greatest(current_user_id, other_user_id))
    on conflict (user_one_id, user_two_id) do update set updated_at = now()
    returning id into conversation_id;
  end if;

  return conversation_id;
end;
$$;

alter table public.private_conversations enable row level security;
alter table public.private_messages enable row level security;

drop policy if exists private_conversations_select_members on public.private_conversations;
create policy private_conversations_select_members
  on public.private_conversations for select to authenticated
  using (auth.uid() in (user_one_id, user_two_id));

drop policy if exists private_messages_select_members on public.private_messages;
create policy private_messages_select_members
  on public.private_messages for select to authenticated
  using (exists (
    select 1 from public.private_conversations c
    where c.id = conversation_id and auth.uid() in (c.user_one_id, c.user_two_id)
  ));

drop policy if exists private_messages_insert_members on public.private_messages;
create policy private_messages_insert_members
  on public.private_messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.private_conversations c
      where c.id = conversation_id
        and auth.uid() in (c.user_one_id, c.user_two_id)
        and public.are_friends(c.user_one_id, c.user_two_id)
    )
  );

drop policy if exists private_messages_update_owner on public.private_messages;
create policy private_messages_update_owner
  on public.private_messages for update to authenticated
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid());

drop policy if exists private_messages_delete_owner on public.private_messages;
create policy private_messages_delete_owner
  on public.private_messages for delete to authenticated
  using (sender_id = auth.uid());

grant execute on function public.are_friends(uuid, uuid) to authenticated;
grant execute on function public.get_or_create_private_conversation(uuid) to authenticated;

alter table public.private_messages replica identity full;

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