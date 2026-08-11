-- ============================================================
--  اختبارات تعبئة subjects من مسارَي التقديم (مهاجرة 20260810000003)
--  التشغيل:  docker exec -i supabase_db_Hemayah psql -U postgres -d postgres \
--            -v ON_ERROR_STOP=1 -f - < supabase/tests/subject-intake-tests.sql
--  الأسلوب: معاملة واحدة تُدحرج في النهاية (نمط journey.sql).
--  التغطية: الإلكتروني (هوية نفاذ من auth.users بوسم live) · الورقي (اعتراض
--  identity: تشفير المعرِّف + إسكان غير المعرِّف + البتر من details) ·
--  دمج الهاتف والبريد في contact_enc · تاريخ ميلادٍ فاسد يسقط بصمت ·
--  الحمولة الخاوية لا تُنشئ صفاً · deny-all على subjects لكل الأدوار.
-- ============================================================
\set QUIET on
begin;

-- ─── تجهيز: مستفيد جديد بهوية نفاذ كاملة في metadata ───
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000', '99000000-0000-4000-8000-000000000902',
  'authenticated', 'authenticated', 'subj-test-seeker@nafath.local', '',
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"name":"موضي الاختبارية","national_id":"1077777777","source":"nafath-gateway"}'::jsonb,
  '', '', '', '');

create temp table t_ids as
select
  '99000000-0000-4000-8000-000000000902'::uuid                          as seeker,
  (select id from auth.users where email = '2000000002@nafath.local')   as intake,
  (select id from auth.users where email = '2000000003@nafath.local')   as studier;

do $$ begin
  if (select intake from t_ids) is null or (select studier from t_ids) is null then
    raise exception 'FIXTURE: مستخدمو نفاذ التجريبيون غير مبذورين';
  end if;
end $$;
grant select on t_ids to authenticated;

create or replace function pg_temp.impersonate(_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', _uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

-- ══ 1) الإلكتروني: هوية نفاذ إلى subjects مشفّرةً بوسم live ══
select pg_temp.impersonate((select seeker from t_ids));
create temp table t_elec as
select * from submit_protection_request(
  'أصيل', 'witness', null, 'التهديد', 'اختبار تعبئة subjects', false, null,
  '{"files": []}'::jsonb);
reset role;

do $$
declare _cid uuid := (select case_id from t_elec); _s record;
begin
  select * into _s from subjects where case_id = _cid and subject_type = 'principal';
  if _s is null then raise exception 'FAIL 1أ: لا صفّ subjects للتقديم الإلكتروني'; end if;
  if _s.source_flags->>'nafath' is distinct from 'live' then
    raise exception 'FAIL 1ب: هوية نفاذ لم توسَم live (%)', _s.source_flags;
  end if;
  if pgp_sym_decrypt(_s.full_name_enc, public._subject_identity_key()) is distinct from 'موضي الاختبارية'
     or pgp_sym_decrypt(_s.national_id_enc, public._subject_identity_key()) is distinct from '1077777777' then
    raise exception 'FAIL 1ج: فكّ تشفير الاسم/الهوية لا يطابق metadata نفاذ';
  end if;
end $$;

-- ══ 2) الورقي: اعتراض identity — تشفير المعرِّف وإسكان غير المعرِّف والبتر ══
select pg_temp.impersonate((select intake from t_ids));
create temp table t_paper as
select * from submit_paper_intake(
  'seeker', 'أصيل', 'reporter', null, 'جريمة ورقية', 'اختبار اعتراض الهوية', false, null,
  jsonb_build_object(
    'city', 'الرياض', 'channel', 'mail',
    'identity', jsonb_build_object(
      'name', 'سالم الاختباري', 'nid', '1099999999', 'phone', '0550000001',
      'email', 'salem@test.local', 'nationality', 'سعودي', 'dob', '1990-04-15',
      'marital', 'متزوج', 'source_verified', false)),
  current_date - 1, 'REG-SUBJ-1');
reset role;

do $$
declare _cid uuid := (select case_id from t_paper); _s record; _d jsonb;
begin
  select details into _d from protection_requests where case_id = _cid;
  if _d ? 'identity' then
    raise exception 'FAIL 2أ: identity بقيت نصّاً صريحاً في details';
  end if;
  if not (_d ? 'city' and _d ? 'reg_no') then
    raise exception 'FAIL 2ب: البتر أسقط مفاتيح مجاورة من details';
  end if;
  select * into _s from subjects where case_id = _cid and subject_type = 'principal';
  if _s is null then raise exception 'FAIL 2ج: لا صفّ subjects للإدخال الورقيّ'; end if;
  if _s.source_flags->>'nafath' is distinct from 'manual' then
    raise exception 'FAIL 2د: الهوية اليدوية لم توسَم manual (%)', _s.source_flags;
  end if;
  if _s.nationality is distinct from 'سعودي' or _s.birth_date is distinct from date '1990-04-15'
     or _s.marital_status is distinct from 'متزوج' then
    raise exception 'FAIL 2هـ: غير المعرِّف لم يُسكَن في أعمدته (% / % / %)',
      _s.nationality, _s.birth_date, _s.marital_status;
  end if;
  if pgp_sym_decrypt(_s.contact_enc, public._subject_identity_key())
     is distinct from '0550000001 · salem@test.local' then
    raise exception 'FAIL 2و: contact_enc لا يجمع الهاتف والبريد';
  end if;
  -- التشفير فعليّ: النصّ الصريح لا يظهر في البايتات المخزّنة
  if exists (select 1 from subjects where case_id = _cid
             and convert_from(full_name_enc, 'utf8') like '%سالم%') then
    raise exception 'FAIL 2ز: full_name_enc يحوي النص الصريح — لا تشفير فعلياً';
  end if;
exception when untranslatable_character or character_not_in_repertoire then
  null; -- convert_from فشل على بايتات مشفّرة — هذا هو المطلوب
end $$;

-- ══ 3) تاريخ ميلادٍ فاسد يسقط بصمت — لا الطلبُ كلُّه ══
do $$
declare _cid uuid := (select case_id from t_paper); _bd date;
begin
  perform public._store_subject(_cid,
    '{"name":"سالم الاختباري","nid":"1099999999","dob":"غير معروف"}'::jsonb, 'manual');
  select birth_date into _bd from subjects where case_id = _cid and subject_type = 'principal';
  if _bd is not null then raise exception 'FAIL 3: تاريخ فاسد لم يسقط إلى null'; end if;
end $$;

-- ══ 4) الحمولة الخاوية لا تُنشئ صفاً ولا تُسقط القائم ══
do $$
declare _cid uuid := (select case_id from t_elec);
begin
  perform public._store_subject(_cid, '{"name":"","nid":"","phone":""}'::jsonb, 'manual');
  if (select count(*) from subjects where case_id = _cid) <> 1 then
    raise exception 'FAIL 4: الحمولة الخاوية أنشأت أو أسقطت صفاً';
  end if;
  -- الصفّ القائم لم يُستبدل (الوسم ما يزال live)
  if (select source_flags->>'nafath' from subjects where case_id = _cid and subject_type = 'principal')
     is distinct from 'live' then
    raise exception 'FAIL 4ب: الحمولة الخاوية استبدلت الصفّ القائم';
  end if;
end $$;

-- ══ 5) deny-all: subjects محجوب عن كل الأدوار مباشرةً (sysadmin_no_pii) ══
select pg_temp.impersonate((select studier from t_ids));
do $$
declare _n int;
begin
  select count(*) into _n from subjects;
  if _n <> 0 then raise exception 'FAIL 5أ: الدارس يرى صفوف subjects'; end if;
end $$;
reset role;
select pg_temp.impersonate((select intake from t_ids));
do $$
declare _n int;
begin
  select count(*) into _n from subjects;
  if _n <> 0 then raise exception 'FAIL 5ب: موظف المركز يرى صفوف subjects مباشرةً'; end if;
end $$;
reset role;

-- ══ 6) قارئ المفتاح محجوب عن عملاء API ══
select pg_temp.impersonate((select intake from t_ids));
do $$
begin
  begin
    perform public._subject_identity_key();
    raise exception 'FAIL 6: _subject_identity_key متاح لدور authenticated';
  exception when insufficient_privilege then
    null; -- الحجب المتوقَّع
  end;
end $$;
reset role;

\echo '✓ اختبارات تعبئة subjects الستة نجحت كلّها'
rollback;
