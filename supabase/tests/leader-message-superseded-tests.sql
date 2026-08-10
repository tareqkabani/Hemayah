-- ============================================================
-- اختبار حارس superseded في send_leader_message (20260810000005)
--   docker exec -i supabase_db_Hemayah psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 -f - < supabase/tests/leader-message-superseded-tests.sql
-- داخل معاملة تُرجَع. ينجح بأسطر NOTICE، ويفشل باستثناء صريح.
-- ============================================================
begin;

-- ══ التهيئة: قضية واحدة وأربعة موظفين بأحوال اطّلاع مختلفة ══
insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('30000000-0000-4000-8000-00000000e001','authenticated','authenticated','lm.studier.active@test.local',now(),now()),
  ('30000000-0000-4000-8000-00000000e002','authenticated','authenticated','lm.studier.submitted@test.local',now(),now()),
  ('30000000-0000-4000-8000-00000000e003','authenticated','authenticated','lm.studier.superseded@test.local',now(),now()),
  ('30000000-0000-4000-8000-00000000e004','authenticated','authenticated','lm.evaluator.superseded@test.local',now(),now())
on conflict (id) do nothing;
insert into user_roles (user_id, role) values
  ('30000000-0000-4000-8000-00000000e001','studier'),
  ('30000000-0000-4000-8000-00000000e002','studier'),
  ('30000000-0000-4000-8000-00000000e003','studier'),
  ('30000000-0000-4000-8000-00000000e004','evaluator')
on conflict do nothing;

-- إدراج مباشر بحالة under_study لا يمرّ بمُشغّل الإسناد (after update).
insert into protection_cases (id, ref_no, secret_code, category, status)
values ('40000000-0000-4000-8000-00000000e001','REF-LM-1','ح-lm-1','witness','under_study');

insert into studies (case_id, studier_id, submitted_at, superseded_at, superseded_reason) values
  ('40000000-0000-4000-8000-00000000e001','30000000-0000-4000-8000-00000000e001', null, null, null),
  ('40000000-0000-4000-8000-00000000e001','30000000-0000-4000-8000-00000000e002', now(), null, null),
  ('40000000-0000-4000-8000-00000000e001','30000000-0000-4000-8000-00000000e003', null, now(), 'deadline_close');
insert into assessments (case_id, evaluator_id, submitted_at, superseded_at, superseded_reason) values
  ('40000000-0000-4000-8000-00000000e001','30000000-0000-4000-8000-00000000e004', null, now(), 'deadline_close');

-- خيطان قائمان من قبل: للمُسلِّم (شرعي) وللموسوم (من قبل سحب اطّلاعه).
insert into leadership_messages (case_id, author_id, author_role, leader, direction, body) values
  ('40000000-0000-4000-8000-00000000e001','30000000-0000-4000-8000-00000000e002','studier','deputy','out','خيط قائم قبل التسليم'),
  ('40000000-0000-4000-8000-00000000e001','30000000-0000-4000-8000-00000000e003','studier','deputy','out','خيط قائم قبل الوسم');

-- ══ 1) الدارس النشط (غير موسوم) يفتح خيطاً جديداً ══
select set_config('request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-00000000e001","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  perform send_leader_message('40000000-0000-4000-8000-00000000e001','deputy','استفسار عن القضية');
end $$;
reset role;
do $$ begin raise notice '✓ 1: الدارس النشط يفتح خيطاً جديداً'; end $$;

-- ══ 2) المُسلِّم (غير موسوم) يردّ في خيطه القائم — جواز الردّ باقٍ ══
select set_config('request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-00000000e002","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  perform send_leader_message('40000000-0000-4000-8000-00000000e001','deputy','ردّ بعد التسليم');
end $$;
reset role;
do $$ begin raise notice '✓ 2: المُسلِّم يردّ في خيطه القائم'; end $$;

-- ══ 3) المُسلِّم لا يفتح خيطاً جديداً مع قائد آخر — السلوك القديم باقٍ ══
select set_config('request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-00000000e002","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  begin
    perform send_leader_message('40000000-0000-4000-8000-00000000e001','chair','خيط جديد بعد التسليم');
    raise exception 'LM FAIL 3: المُسلِّم فتح خيطاً جديداً مع الرئيس';
  exception when others then
    if sqlerrm not like '%المكتمل لا يُفتح له خيط مراسلة%' then raise; end if;
  end;
end $$;
reset role;
do $$ begin raise notice '✓ 3: المُسلِّم ممنوع من خيط جديد مع قائد آخر'; end $$;

-- ══ 4) الدارس الموسوم مرفوض — حتى في خيطه القائم (سحب الاطّلاع كامل) ══
select set_config('request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-00000000e003","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  begin
    perform send_leader_message('40000000-0000-4000-8000-00000000e001','deputy','محاولة بعد الوسم');
    raise exception 'LM FAIL 4: الدارس الموسوم راسل القيادة';
  exception when others then
    if sqlerrm not like '%الطلب غير مُسنَدٍ إليك%' then raise; end if;
  end;
end $$;
reset role;
do $$ begin raise notice '✓ 4: الدارس الموسوم مرفوض ولو كان له خيط قائم'; end $$;

-- ══ 5) المقيّم الموسوم مرفوض كذلك ══
select set_config('request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-00000000e004","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  begin
    perform send_leader_message('40000000-0000-4000-8000-00000000e001','deputy','محاولة مقيّم موسوم');
    raise exception 'LM FAIL 5: المقيّم الموسوم راسل القيادة';
  exception when others then
    if sqlerrm not like '%الطلب غير مُسنَدٍ إليك%' then raise; end if;
  end;
end $$;
reset role;
do $$ begin raise notice '✓ 5: المقيّم الموسوم مرفوض'; end $$;

-- ══ 6) لم تُسجَّل أي رسالة من الموسومَين بعد الوسم ══
do $$ declare _n int; begin
  select count(*) into _n from leadership_messages
   where case_id='40000000-0000-4000-8000-00000000e001'
     and author_id in ('30000000-0000-4000-8000-00000000e003','30000000-0000-4000-8000-00000000e004')
     and body like 'محاولة%';
  if _n > 0 then raise exception 'LM FAIL 6: تسرّبت رسالة من موظف موسوم (%)', _n; end if;
end $$;
do $$ begin raise notice '✓ 6: لا رسائل متسرّبة من الموسومَين'; end $$;

rollback;
