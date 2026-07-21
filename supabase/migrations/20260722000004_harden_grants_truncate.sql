-- ============================================================
--  سدّ ثغرة TRUNCATE (كشفها التحقق العدائي 2026-07-22)
--  امتيازات Supabase الافتراضية كانت تمنح anon/authenticated صلاحية
--  TRUNCATE (وREFERENCES/TRIGGER) على كل جداول public — وTRUNCATE
--  لا تحكمه RLS: أي جلسة مصادَقة (بل anon!) كانت تستطيع تفريغ
--  audit_log أو protection_cases بالكامل، بما ينسف ضمانة عدم قابلية
--  سجل التدقيق للتلاعب (م24–32). أُثبتت الثغرة حيّاً ثم دُحرجت.
-- ============================================================

do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke truncate, references, trigger on table public.%I from anon, authenticated', r.tablename);
  end loop;
end $$;

-- وللجداول المستقبلية: تُنشأ بلا هذه الامتيازات أصلاً
alter default privileges in schema public revoke truncate, references, trigger on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke truncate, references, trigger on tables from anon, authenticated;

-- إثبات ذاتي: فشل المهاجرة إن بقيت الثغرة
do $$
begin
  if has_table_privilege('authenticated', 'public.audit_log', 'TRUNCATE')
     or has_table_privilege('anon', 'public.audit_log', 'TRUNCATE')
     or has_table_privilege('authenticated', 'public.protection_cases', 'TRUNCATE') then
    raise exception 'ثغرة TRUNCATE ما تزال قائمة';
  end if;
end $$;
