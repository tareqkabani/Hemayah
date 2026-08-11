-- ============================================================
-- اختبار رؤية بوابة الجهات المختصة بالفرع (20260811000001 + seed §1-ب/§5)
--   docker exec -i supabase_db_Hemayah psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 -f - < supabase/tests/competent-branch-visibility-test.sql
-- داخل معاملة تُرجَع. ينجح بسطر NOTICE، ويفشل باستثناء صريح.
--
-- يوثّق الخلل الأصلي ويحرس إصلاحه: مستخدم competent_body بسمة
-- {"authority":"competent"} فقط لا يرى شيئاً (cb_branch()‏ NULL)، وبمنحه
-- branch_id+level يرى توصيات فرعه وقضاياها حصراً — لا فروعَ غيره.
-- ============================================================
begin;

-- مستخدم جهةٍ مختصّة تجريبي — بسمة السلطة فقط (حال البذور قبل الإصلاح)
insert into auth.users (id, aud, role, email, created_at, updated_at)
values ('10000000-0000-4000-8000-00000000e001','authenticated','authenticated','cbv.head@test.local',now(),now())
on conflict (id) do nothing;
insert into user_roles (user_id, role, attributes)
values ('10000000-0000-4000-8000-00000000e001','competent_body','{"authority":"competent"}'::jsonb)
on conflict (user_id, role) do update set attributes = excluded.attributes;

-- قضيتان وتوصيتاهما في نيابتين مختلفتين (فرعا الرياض والمدينة من البذور البنيوية)
create temp table _fx as select
  (select id from branches where entity='prosecution' and region='RUH' and kind='region' limit 1) as b_ruh,
  (select id from branches where entity='prosecution' and region='MED' and kind='region' limit 1) as b_med;
grant select on _fx to authenticated; -- تُقرأ داخل كتل الانتحال

do $$
declare f record;
begin
  select * into f from _fx;
  if f.b_ruh is null or f.b_med is null then
    raise exception 'FIXTURE FAIL: نيابتا الرياض/المدينة غير موجودتين في branches';
  end if;
  insert into protection_cases (id, ref_no, secret_code, category, status, branch_id) values
    ('20000000-0000-4000-8000-00000000e001','REF-CBV-1','ح-cbv-1','witness','triage', f.b_ruh),
    ('20000000-0000-4000-8000-00000000e002','REF-CBV-2','ح-cbv-2','witness','triage', f.b_med);
  insert into recommendations (case_id, source_body, raised_at, branch_id) values
    ('20000000-0000-4000-8000-00000000e001','اختبار الرؤية بالفرع', now(), f.b_ruh),
    ('20000000-0000-4000-8000-00000000e002','اختبار الرؤية بالفرع', now(), f.b_med);
end $$;

select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-00000000e001","role":"authenticated"}', true);

-- ══ 1) بلا branch_id/level: لا تمرّ أي توصية (جوهر الخلل الموثَّق) ══
set local role authenticated;
do $$ declare _n int;
begin
  select count(*) into _n from recommendations where source_body = 'اختبار الرؤية بالفرع';
  if _n <> 0 then
    raise exception 'FAIL 1: مستخدم بلا فرع يرى % توصية — rec_branch_rw مخترقة', _n;
  end if;
end $$;
reset role;

-- ══ 2) بمنح الفرع والمستوى (ما تفعله البذور/المهاجرة): توصية فرعه حصراً ══
update user_roles
   set attributes = attributes
    || jsonb_build_object('level','head','branch_id',(select b_ruh from _fx)::text,'entity','prosecution')
 where user_id = '10000000-0000-4000-8000-00000000e001' and role = 'competent_body';

set local role authenticated;
do $$ declare f record; _n int; _cid uuid;
begin
  select * into f from _fx;
  select count(*), min(case_id::text)::uuid into _n, _cid
    from recommendations where source_body = 'اختبار الرؤية بالفرع';
  if _n <> 1 or _cid <> '20000000-0000-4000-8000-00000000e001' then
    raise exception 'FAIL 2أ: المتوقّع توصية فرع الرياض وحدها، والمرئي % (%)', _n, _cid;
  end if;
  -- تضمين القضية (case_branch_read): قضية فرعه مرئية، وقضية الفرع الآخر محجوبة
  select count(*) into _n from protection_cases
   where id in ('20000000-0000-4000-8000-00000000e001','20000000-0000-4000-8000-00000000e002');
  if _n <> 1 then
    raise exception 'FAIL 2ب: المتوقّع قضية واحدة عبر case_branch_read، والمرئي %', _n;
  end if;
end $$;
reset role;

do $$ begin
  raise notice 'CBV PASS: الحجب بلا فرع، والعزل الفرعي للتوصيات والقضايا معاً، سليمان';
end $$;

-- ── حارس الإصلاح نفسه (لا السياسة فقط): سمات حساب البوابة بعد البذر ──
--  الحزمة أعلاه تبني مستخدمها وتمنحه السمات يدوياً، فتنجح حتى لو أُلغي
--  الطلب كلُّه. هذا البند يفحص أثر الإصلاح على الحساب المبذور فعلاً.
do $$
declare _a jsonb;
begin
  select ur.attributes into _a
    from user_roles ur join auth.users u on u.id = ur.user_id
   where u.email = '3000000001@nafath.local' and ur.role = 'competent_body';
  if _a is null then
    raise notice 'CBV تخطٍّ: حساب بوابة الجهة غير مبذور في هذه القاعدة';
  else
    if nullif(btrim(coalesce(_a->>'branch_id','')), '') is null then
      raise exception 'CBV FAIL: حساب البوابة بلا branch_id — cb_branch() ترجع NULL فتُحجب كل الصفوف';
    end if;
    if coalesce(_a->>'level','') not in ('clerk','head') then
      raise exception 'CBV FAIL: مستوى حساب البوابة (%) خارج clerk|head فلا يمرّ rec_branch_rw', coalesce(_a->>'level','—');
    end if;
    raise notice 'CBV PASS — سمات حساب البوابة: level=% · branch_id مضبوط', _a->>'level';
  end if;
end $$;

rollback;
