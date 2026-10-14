-- حذف الحساب نهائياً (مطلوب من Google Play)
-- شغّل هذا الملف مرة وحدة من Supabase → SQL Editor → New query → Run
--
-- الدالة تمسح كل بيانات المستخدم الحالي فقط (auth.uid())، وبعدها تمسح حسابه نفسه.
-- الرسائل والمحادثات والمكالمات وأجهزة الإشعارات تنمسح تلقائياً ويا الحساب (on delete cascade).

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  -- جداول ممكن ما تكون مربوطة بالحساب مباشرة: نمسحها بأنفسنا (إذا موجودة)
  if to_regclass('public.friendships') is not null then
    execute 'delete from public.friendships where sender_id::text = $1 or receiver_id::text = $1' using uid::text;
  end if;
  if to_regclass('public.user_phones') is not null then
    execute 'delete from public.user_phones where user_id::text = $1' using uid::text;
  end if;
  if to_regclass('public.users_directory') is not null then
    execute 'delete from public.users_directory where id::text = $1' using uid::text;
  end if;
  if to_regclass('public.messages') is not null and to_regclass('public.chats') is not null then
    execute 'delete from public.messages where chat_id in (select id from public.chats where user_id::text = $1)' using uid::text;
  end if;
  if to_regclass('public.chats') is not null then
    execute 'delete from public.chats where user_id::text = $1' using uid::text;
  end if;
  if to_regclass('public.profiles') is not null then
    execute 'delete from public.profiles where id::text = $1' using uid::text;
  end if;

  -- آخر شي: الحساب نفسه (وكل شي مربوط بيه ينمسح ويّاه)
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
