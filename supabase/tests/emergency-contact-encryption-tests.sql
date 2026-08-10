-- ============================================================
--  اختبارات تشفير جهة اتصال الطوارئ (مهاجرة 20260810000002)
--  التشغيل:  docker exec -i supabase_db_Hemayah psql -U postgres -d postgres \
--            -v ON_ERROR_STOP=1 -f - < supabase/tests/emergency-contact-encryption-tests.sql
--  الأسلوب: معاملة واحدة تُدحرج في النهاية (نمط journey.sql) —
--  انتحال الأدوار بـ set_config(request.jwt.claims) + set local role authenticated.
--  التغطية: الاعتراض في المسارين (إلكتروني/ورقي) · البتر من details ·
--  التشفير الفعلي · الحمولة الفارغة لا تُنشئ صفاً · كشف التنفيذ مقيَّداً
--  بالتدقيق · حجب غير الأطوار وغير الأدوار · المنحة العموديّة (لا *_enc مباشرةً).
-- ============================================================
\set QUIET on
begin;

-- ─── تجهيز: هويات الاختبار ───
-- مستفيد جديد (لا قضية مفتوحة له — حارس «طلب واحد نشط» لا يعترض)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000', '99000000-0000-4000-8000-000000000901',
  'authenticated', 'authenticated', 'ec-test-seeker@nafath.local', '',
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  '', '', '', '');

create temp table t_ids as
select
  '99000000-0000-4000-8000-000000000901'::uuid                          as seeker,
  (select id from auth.users where email = '2000000002@nafath.local')   as intake,
  (select id from auth.users where email = '2000000007@nafath.local')   as executor,
  (select id from auth.users where email = '2000000003@nafath.local')   as studier;

do $$ begin
  if (select intake from t_ids) is null or (select executor from t_ids) is null
     or (select studier from t_ids) is null then
    raise exception 'FIXTURE: مستخدمو نفاذ التجريبيون غير مبذورين';
  end if;
end $$;
grant select on t_ids to authenticated;

-- انتحال دورٍ: يضبط claims المعاملة ثم دور RLS
create or replace function pg_temp.impersonate(_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', _uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

-- ══ 1) المسار الورقيّ: الاعتراض + البتر + التشفير ══
select pg_temp.impersonate((select intake from t_ids));
create temp table t_paper as
select * from submit_paper_intake(
  'seeker', 'أصيل', 'witness', null, 'التهديد', 'اختبار تشفير جهة الطوارئ', false, null,
  jsonb_build_object(
    'city', 'الرياض', 'channel', 'inperson',
    'identity', jsonb_build_object('name', 'مستفيد الاختبار', 'verified', false),
    'emergency_contact', jsonb_build_object('name', 'سالم الاختباري', 'rel', 'أخ', 'phone', '0550001111')),
  current_date, 'REG-EC-1');
reset role;

do $$
declare _cid uuid := (select case_id from t_paper); _d jsonb; _n int;
begin
  select details into _d from protection_requests where case_id = _cid;
  if _d ? 'emergency_contact' then
    raise exception 'FAIL 1أ: emergency_contact ما زالت نصّاً صريحاً في details بعد الإدخال الورقيّ';
  end if;
  if not (_d ? 'city' and _d ? 'channel') then
    raise exception 'FAIL 1ب: البتر أسقط مفاتيح مجاورة من details';
  end if;
  -- identity صارت تُعترض هي الأخرى إلى subjects (مهاجرة 20260810000003) —
  -- تغطيتها الكاملة في subject-intake-tests.sql
  if _d ? 'identity' then
    raise exception 'FAIL 1ب٢: identity بقيت نصّاً صريحاً في details بعد اعتراض subjects';
  end if;
  select count(*) into _n from emergency_contacts where case_id = _cid
    and name_enc is not null and phone_enc is not null and relationship = 'أخ';
  if _n <> 1 then raise exception 'FAIL 1ج: لا صفّ مشفّر في emergency_contacts للمسار الورقيّ'; end if;
  -- التشفير فعليّ: النص الصريح لا يظهر في البايتات المخزّنة
  if exists (select 1 from emergency_contacts where case_id = _cid
             and (convert_from(name_enc, 'utf8') like '%سالم%')) then
    raise exception 'FAIL 1د: name_enc يحوي النص الصريح — لا تشفير فعلياً';
  end if;
exception when untranslatable_character or character_not_in_repertoire then
  null; -- convert_from فشل على بايتات مشفّرة — هذا هو المطلوب
end $$;

-- ══ 2) المسار الإلكتروني: الاعتراض ذاته عبر submit_protection_request ══
select pg_temp.impersonate((select seeker from t_ids));
create temp table t_elec as
select * from submit_protection_request(
  'أصيل - شاهد', 'witness', null, 'الابتزاز', 'اختبار المسار الإلكتروني', false, null,
  jsonb_build_object('files', '[]'::jsonb,
    'emergency_contact', jsonb_build_object('name', 'نورة الاختبارية', 'relationship', 'زوجة', 'phone', '0550002222')));
reset role;

do $$
declare _cid uuid := (select case_id from t_elec); _n int;
begin
  if exists (select 1 from protection_requests where case_id = _cid and details ? 'emergency_contact') then
    raise exception 'FAIL 2أ: emergency_contact بقيت في details بعد التقديم الإلكتروني';
  end if;
  select count(*) into _n from emergency_contacts where case_id = _cid
    and name_enc is not null and phone_enc is not null and relationship = 'زوجة';
  if _n <> 1 then raise exception 'FAIL 2ب: لا صفّ مشفّر للمسار الإلكتروني (مفتاح relationship البديل)'; end if;
  -- حارس انحدار: إعادة كتابة الدالة يجب أن تحفظ محرّك الإشعارات (نسخة 20260808000006
  -- لا 20260807000001) — الإشعار من قالب n_received وأثره في التدقيق
  if not exists (select 1 from audit_log where action = 'notify_n_received' and target = _cid::text) then
    raise exception 'FAIL 2ج: إعادة كتابة submit_protection_request أسقطت إشعار القالب n_received';
  end if;
end $$;

-- ══ 3) الحمولة الفارغة (نموذج الإدخال يرسل حقولاً خاوية) لا تُنشئ صفاً ══
do $$
begin
  perform public._store_emergency_contact((select case_id from t_paper),
    '{"name":"","rel":"","phone":""}'::jsonb);
  -- الصفّ القائم من (1) يبقى — الحمولة الخاوية لا تحلّ محلّه ولا تُنشئ غيره
  if (select count(*) from emergency_contacts where case_id = (select case_id from t_paper)) <> 1 then
    raise exception 'FAIL 3: الحمولة الخاوية أنشأت أو أسقطت صفاً';
  end if;
end $$;

-- ══ 4) الكشف قبل طور التنفيذ محجوب (القضية ما تزال triage) ══
select pg_temp.impersonate((select executor from t_ids));
do $$
begin
  begin
    perform * from execution_emergency_contact((select case_id from t_paper));
    raise exception 'FAIL 4: كُشفت جهة الطوارئ لقضيةٍ خارج أطوار التنفيذ';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if; -- الحجب المتوقَّع
  end;
end $$;
reset role;

-- ══ 5) في طور التنفيذ: الكشف يعمل ويُقيَّد في التدقيق ══
update protection_cases set status = 'accepted' where id = (select case_id from t_paper);

-- عدّ التدقيق يجري بدور postgres (مالك الجدول يتجاوز RLS) — لا بدور authenticated المحجوب.
create temp table t_audit as
select count(*) as before_n from audit_log where action = 'reveal_emergency_contact';

select pg_temp.impersonate((select executor from t_ids));
do $$
declare _name text; _rel text; _phone text;
begin
  select e.name, e.relationship, e.phone into _name, _rel, _phone
    from execution_emergency_contact((select case_id from t_paper)) e;
  if _name is distinct from 'سالم الاختباري' or _rel is distinct from 'أخ'
     or _phone is distinct from '0550001111' then
    raise exception 'FAIL 5أ: فكّ التشفير أعاد قيماً خاطئة (% / % / %)', _name, _rel, _phone;
  end if;
end $$;
reset role;
do $$
begin
  if (select count(*) from audit_log where action = 'reveal_emergency_contact')
     <> (select before_n from t_audit) + 1 then
    raise exception 'FAIL 5ب: الكشف لم يُقيَّد في سجلّ التدقيق';
  end if;
end $$;
select pg_temp.impersonate((select executor from t_ids));

-- ══ 6) المنحة العموديّة: صلة القرابة تُقرأ مباشرةً، وأعمدة *_enc محجوبة ══
do $$
declare _rel text;
begin
  select relationship into _rel from emergency_contacts
   where case_id = (select case_id from t_paper);
  if _rel is distinct from 'أخ' then
    raise exception 'FAIL 6أ: سياسة ec_execution_read لا تُرجع صلة القرابة لطور التنفيذ';
  end if;
  begin
    perform name_enc from emergency_contacts where case_id = (select case_id from t_paper);
    raise exception 'FAIL 6ب: عمود name_enc مقروء مباشرةً — المنحة العموديّة مخترقة';
  exception when insufficient_privilege then
    null; -- الحجب المتوقَّع
  end;
end $$;
reset role;

-- ══ 7) عزل الأدوار: الدارس لا يرى الجدول ولا يكشف ══
select pg_temp.impersonate((select studier from t_ids));
do $$
declare _n int;
begin
  select count(*) into _n from emergency_contacts;
  if _n <> 0 then raise exception 'FAIL 7أ: الدارس يرى صفوف emergency_contacts'; end if;
  begin
    perform * from execution_emergency_contact((select case_id from t_paper));
    raise exception 'FAIL 7ب: الدارس كشف جهة الطوارئ';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;
reset role;

-- ══ 8) قضية بلا جهة اتصال: الكشف يعيد صفراً من الصفوف ولا يقيّد كشفاً ══
update protection_cases set status = 'accepted' where id = (select case_id from t_elec);
delete from emergency_contacts where case_id = (select case_id from t_elec);
create temp table t_audit8 as
select count(*) as before_n from audit_log where action = 'reveal_emergency_contact';

select pg_temp.impersonate((select executor from t_ids));
do $$
declare _n int;
begin
  select count(*) into _n from execution_emergency_contact((select case_id from t_elec));
  if _n <> 0 then raise exception 'FAIL 8أ: قضية بلا جهة اتصال أعادت صفوفاً'; end if;
end $$;
reset role;
do $$
begin
  if (select count(*) from audit_log where action = 'reveal_emergency_contact')
     <> (select before_n from t_audit8) then
    raise exception 'FAIL 8ب: قُيّد كشفٌ لم يقع';
  end if;
end $$;

\echo '✓ اختبارات تشفير جهة الطوارئ الثمانية نجحت كلّها'
rollback;
