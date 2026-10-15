-- ============================================================
-- الغباء الصناعي: "منو من جهات اتصالي عنده التطبيق؟"
-- شغّل هذا الملف مرة وحدة من Supabase > SQL Editor > Run (بعد friends-and-phone.sql)
-- آمن للتشغيل أكثر من مرة
--
-- الخصوصية: الأرقام اللي يرسلها التلفون تُستخدم بس للمطابقة وما تنحفظ.
-- الدالة ترجّع الاسم + رقم ترتيب الرقم بالقائمة (idx)، وما ترجّع رقم أي مستخدم.
-- ============================================================

create or replace function public.match_contacts(p_phones text[])
returns table (idx int, id text, name text, handle text, status text)
language sql
stable
security definer
set search_path = public
as $$
  with input as (
    select (t.ord - 1)::int as idx, public.normalize_phone(t.raw) as phone
    from unnest(p_phones[1:3000]) with ordinality as t(raw, ord)
  )
  select distinct on (d.id)
    i.idx, d.id::text, d.name::text, d.handle::text, d.status::text
  from input i
  join public.user_phones p on p.phone = i.phone
  join public.users_directory d on d.id::text = p.user_id
  where i.phone is not null
    and p.user_id <> coalesce(auth.uid()::text, '')
  order by d.id, i.idx
$$;

revoke all on function public.match_contacts(text[]) from public, anon;
grant execute on function public.match_contacts(text[]) to authenticated;
