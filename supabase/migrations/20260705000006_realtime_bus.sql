-- ============================================================
--  منصّة «حماية» — مزامنة الناقل حيّاً عبر Supabase Realtime
--  تفعيل postgres_changes على جداول الناقل ليصل تغيير أيّ بوّابةٍ
--  لبقيّة البوّابات فوراً (بدل localStorage المحدود بالأصل الواحد).
-- ============================================================

-- هوية النسخة الكاملة: يلزمها الريل‑تايم لتمرير الصفّ القديم/الجديد وتطبيق RLS على التغييرات.
alter table referrals         replica identity full;
alter table lifecycle_reviews replica identity full;

-- أضِف الجدولين إلى نشر الريل‑تايم (بحذرٍ من التكرار).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'referrals'
  ) then
    alter publication supabase_realtime add table referrals;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'lifecycle_reviews'
  ) then
    alter publication supabase_realtime add table lifecycle_reviews;
  end if;
end $$;
