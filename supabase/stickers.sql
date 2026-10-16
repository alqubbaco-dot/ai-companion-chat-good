-- ============================================================
-- القبة: ميزة "ملصقات عراقية" بدل "مغيّر الصوت" (100 نقطة)
-- شغّل هذا الملف مرة وحدة من Supabase > SQL Editor > New query > Run
-- آمن للتشغيل أكثر من مرة
-- ============================================================

insert into public.feature_prices (feature, cost, title, sort_order)
values ('stickers', 100, 'ملصقات عراقية بمحادثات الأصدقاء', 4)
on conflict (feature) do update set cost = excluded.cost, title = excluded.title, sort_order = excluded.sort_order;

-- إذا أحد فاتح "مغيّر الصوت" (ما چانت جاهزة)، ننقله للملصقات بدون ما يخسر نقاطه
insert into public.unlocked_features (user_id, feature, unlocked_at)
select user_id, 'stickers', unlocked_at from public.unlocked_features where feature = 'voice_changer'
on conflict do nothing;

delete from public.unlocked_features where feature = 'voice_changer';
delete from public.feature_prices where feature = 'voice_changer';
