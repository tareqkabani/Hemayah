-- ============================================================
--  اختبارات هويّة الصفّ في قائمتَي «الواردة» (مهاجرة 20260907000010)
--  التشغيل:  docker exec -i supabase_db_Hemayah psql -U postgres -d postgres \
--            -v ON_ERROR_STOP=1 -f - < supabase/tests/intake-list-row-identity-tests.sql
--  الأسلوب: معاملة واحدة تُدحرج في النهاية (نمط subject-intake-tests.sql).
--
--  الحارس: القضية الورقية قد يُربط بها أكثر من مستندٍ وارد (مستند الطلب
--  ثمّ خطاب توصية الجهة)، وentered_case_id بلا قيد وحدانيّة — ولا يجوز أن
--  يكون له قيد، فالربط سلوكٌ مقصود. فإن عاد الوصل متشعّباً تضاعفت القضية
--  في القائمة، ونُسب إليها قيدُ الخطاب لا قيدُ الطلب.
--  انبثق من عطبٍ حيّ: C-2026-0745 ظهرت صفّين (2026-09-07).
-- ============================================================
\set QUIET on
begin;

create temp table t_ids as
select (select id from auth.users where email = '2000000001@nafath.local') as clerk;

do $$ begin
  if (select clerk from t_ids) is null then
    raise exception 'FIXTURE: موظّف الإدخال التجريبيّ غير مبذور';
  end if;
end $$;
grant select on t_ids to authenticated;

create or replace function pg_temp.impersonate(_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', _uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

-- ─── تجهيز: أربع قضايا ورقية بلا حساب، تغطّي الحالات الحدّية ───
insert into protection_cases (id, ref_no, secret_code, category, status, source, entered_by, entered_at)
values
  ('00000000-0000-4000-b000-000000000001','REF-T-DUP','C-T-DUP','witness','triage','local',(select clerk from t_ids), now()),
  ('00000000-0000-4000-b000-000000000002','REF-T-NIL','C-T-NIL','witness','triage','local',(select clerk from t_ids), now()),
  ('00000000-0000-4000-b000-000000000003','REF-T-REC','C-T-REC','witness','triage','local',(select clerk from t_ids), now()),
  ('00000000-0000-4000-b000-000000000004','REF-T-SUB','C-T-SUB','witness','triage','local',(select clerk from t_ids), now());

insert into intake_inbox (channel, doc_kind, reg_no, arrived_on, entered_case_id) values
  -- (١) طلبٌ ثمّ خطابُ توصية على القضية نفسها — عين العطب الحيّ
  ('inperson','req','T-DUP-REQ','2026-08-16','00000000-0000-4000-b000-000000000001'),
  ('mail',    'rec','T-DUP-REC','2026-08-17','00000000-0000-4000-b000-000000000001'),
  -- (٣) خطابُ توصيةٍ وحده بلا مستند طلب
  ('mail',    'rec','T-REC-ONLY','2026-08-18','00000000-0000-4000-b000-000000000003');
-- (٢) C-T-NIL بلا أيّ مستندٍ وارد

-- (٤) أصيلان: الأقدم بلا وسيلة اتصالٍ والأحدث له — راية has_contact
insert into subjects (case_id, subject_type, contact_enc, created_at) values
  ('00000000-0000-4000-b000-000000000004','principal', null,          now() - interval '2 h'),
  ('00000000-0000-4000-b000-000000000004','principal', '\x00'::bytea, now());

select pg_temp.impersonate((select clerk from t_ids));

create temp table t_out as
select * from public.intake_unclaimed_cases() where secret_code like 'C-T-%';

reset role;

do $$
declare _n int; _v text; _b boolean;
begin
  -- ١) صفٌّ واحدٌ لكلّ قضية وإن تعدّدت مستنداتها
  select count(*) into _n from t_out where secret_code = 'C-T-DUP';
  if _n <> 1 then raise exception 'FAIL ١: القضية ذات المستندين ظهرت % مرّة (المتوقّع 1)', _n; end if;

  -- ٢) والمعروض قيدُ الطلب لا قيدُ الخطاب
  select reg_no into _v from t_out where secret_code = 'C-T-DUP';
  if _v <> 'T-DUP-REQ' then raise exception 'FAIL ٢: عُرض القيد % (المتوقّع T-DUP-REQ)', _v; end if;

  -- ٣) القضية بلا مستندٍ وارد لا تسقط من القائمة
  select count(*) into _n from t_out where secret_code = 'C-T-NIL';
  if _n <> 1 then raise exception 'FAIL ٣: القضية بلا مستندٍ ظهرت % مرّة (المتوقّع 1)', _n; end if;

  -- ٤) والقضية التي مستندُها خطابٌ وحده لا تسقط أيضاً — الانتقاء تفضيلٌ لا ترشيح
  select reg_no into _v from t_out where secret_code = 'C-T-REC';
  if _v is distinct from 'T-REC-ONLY' then
    raise exception 'FAIL ٤: القضية ذات الخطاب وحده أعطت % (المتوقّع T-REC-ONLY)', coalesce(_v,'∅');
  end if;

  -- ٥) راية الاتصال تصدق متى صدقت لأيّ أصيل (لا انتقاء أصيلٍ بعينه)
  select has_contact into _b from t_out where secret_code = 'C-T-SUB';
  if _b is not true then raise exception 'FAIL ٥: has_contact كذبت مع وجود أصيلٍ ذي وسيلة اتصال'; end if;

  -- ٦) لا تكرار على مستوى القائمة كلّها
  select count(*) into _n from (select case_id from t_out group by 1 having count(*) > 1) x;
  if _n <> 0 then raise exception 'FAIL ٦: % قضية مكرّرة في القائمة', _n; end if;
end $$;

-- ─── «مُحالة من الفرز»: صفُّها توصيةٌ لا قضية، ولها هويّتُه ───
--  توصيتان معلّقتان لقضيةٍ واحدة لا تبلغهما مسارات النظام اليوم (الضمانة
--  منبثقةٌ من حرّاس triage_decide وdecide_recommendation_approval)، فتُبنى
--  الحالة هنا إدراجاً مباشراً: الغرض إثبات أنّ القائمة تحتمل الشكل متى
--  انكسر الانبثاق، لا محاكاةُ مسارٍ قائم.
insert into protection_cases (id, ref_no, secret_code, category, status, source, submitted_by)
values ('00000000-0000-4000-b000-000000000005','REF-T-TWO','C-T-TWO','witness','referred','local',
        (select id from auth.users where email = '1000000001@nafath.local'));

insert into recommendations (case_id, branch_id, raised_at, due_at)
select '00000000-0000-4000-b000-000000000005', b.id, now() - interval '2 days', now() + interval '3 days'
  from (select distinct on (entity) id, entity from branches
         where entity in ('prosecution','moi') order by entity, region) b;

select pg_temp.impersonate((select clerk from t_ids));
create temp table t_ref as select * from public.intake_referred_list();
reset role;

do $$
declare _rows int; _cases int; _recs int;
begin
  select count(*), count(distinct case_id), count(distinct rec_id)
    into _rows, _cases, _recs
    from t_ref where secret_code = 'C-T-TWO';

  if _rows <> 2 then
    raise exception 'FAIL ٧: التوصيتان أعطتا % صفّاً (المتوقّع 2)', _rows;
  end if;
  if _cases <> 1 then
    raise exception 'FAIL ٨: الصفّان ليسا لقضيةٍ واحدة (% قضية)', _cases;
  end if;
  -- الحارس: هويّة الصفّ تميّزه، وcase_id لا يميّزه — وهو سببُ المفتاح
  if _recs <> 2 then
    raise exception 'FAIL ٩: rec_id لم يميّز الصفّين (% قيمة متمايزة)', _recs;
  end if;
end $$;

\echo '✓ اختبارات هويّة صفّ قائمتَي الإدخال التسعة نجحت كلّها'
rollback;
