-- ============================================================
-- اختبار حارس assign_study_eval (20260808000007)
--   docker exec -i supabase_db_Hemayah psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 -f - < supabase/tests/assign_guard_test.sql
-- داخل معاملة تُرجَع. ينجح بسطر NOTICE، ويفشل باستثناء صريح.
-- ============================================================
begin;

insert into auth.users (id, aud, role, email, created_at, updated_at)
values ('10000000-0000-4000-8000-00000000d001','authenticated','authenticated','guard.subject@test.local',now(),now())
on conflict (id) do nothing;
insert into user_roles (user_id, role) values
  ('10000000-0000-4000-8000-00000000d001','subject') on conflict do nothing;

insert into protection_cases (id, ref_no, secret_code, category, status)
values ('20000000-0000-4000-8000-00000000d001','REF-GUARD-1','ح-guard-1','witness','under_study');

-- ══ 1) مستخدم موثَّق لا يستطيع استدعاء الإسناد مباشرةً ══
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-00000000d001","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  begin
    perform assign_study_eval('20000000-0000-4000-8000-00000000d001');
    raise exception 'GUARD FAIL 1: مستخدم موثَّق نفّذ assign_study_eval مباشرةً';
  exception when insufficient_privilege then null; -- المتوقّع (42501)
  end;
end $$;
reset role;

-- ══ 2) المسار الشرعي (مُشغّل under_study) ما زال يُسنِد آلياً ══
-- الحالة أُدرجت under_study مباشرةً أعلاه دون المرور بالمُشغّل (after update)،
-- فنحدّثها ذهاباً وإياباً ليُطلَق المُشغّل شرعياً.
do $$ declare _s int; _a int; begin
  update protection_cases set status='triage'
   where id='20000000-0000-4000-8000-00000000d001';
  update protection_cases set status='under_study'
   where id='20000000-0000-4000-8000-00000000d001';   -- يُطلق trg_assign_study_eval
  select count(*) into _s from studies where case_id='20000000-0000-4000-8000-00000000d001';
  select count(*) into _a from assessments where case_id='20000000-0000-4000-8000-00000000d001';
  if _s < 1 or _a < 1 then
    raise exception 'GUARD FAIL 2: المسار الشرعي لم يُسنِد (دارسون=% مقيّمون=%)', _s, _a;
  end if;
end $$;

do $$ begin raise notice '✓ حارس assign_study_eval: منعٌ مباشرٌ للعملاء وإسنادٌ شرعيٌّ عبر المُشغّل'; end $$;

rollback;
