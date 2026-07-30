-- ============================================================
--  اختبارات دورة إحالات م14: الإصدار من المركز → معالجة الجهة → الإقفال من المركز
--  التشغيل:  docker exec -i supabase_db_Hemayah psql -U postgres -d postgres \
--            -v ON_ERROR_STOP=1 -f - < supabase/tests/referral-closure-tests.sql
--  الأسلوب: معاملة واحدة تُدحرج في النهاية (لا أثر يبقى) — انتحال الأدوار
--  بـ set_config(request.jwt.claims) + set local role authenticated.
--  التغطية: referral_create (الحارس النشط · اللاازدواج · التدقيق) ·
--  referral_update (الدورة الكاملة حتى done · حارس الإقفال · عزل السلطة) ·
--  referral_close (done→closed حصراً · لموظف المركز حصراً · التدقيق) ·
--  إعادة الإصدار بعد الإقفال · القسم القانوني الداخلي · سياسة قراءة المركز.
-- ============================================================
\set QUIET on
begin;

-- ─── تجهيز: هويات الاختبار + قضيتا اختبار ───
create temp table t_ids as
select
  (select user_id from user_roles where role = 'case_officer'   limit 1) as officer,
  (select user_id from user_roles where role = 'moh_specialist' limit 1) as moh,
  (select user_id from user_roles where role = 'hr_specialist'  limit 1) as hr;

do $$ begin
  if (select officer from t_ids) is null or (select moh from t_ids) is null then
    raise exception 'FIXTURE: مستخدمو الأدوار التجريبيون غير مبذورين';
  end if;
end $$;

-- قضية نشطة (تُقبل الإحالات) + قضية في الفرز (تُرفض الإحالات)
insert into protection_cases (ref_no, secret_code, category, status, classification, source)
values ('REF-2026-9701', 'TC-2026-9701', 'witness', 'active', 'high',   'local'),
       ('REF-2026-9702', 'TC-2026-9702', 'victim',  'triage', 'medium', 'local');

grant select on t_ids to authenticated;

create or replace function pg_temp.impersonate(_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', _uid, 'role', 'authenticated')::text, true);
end $$;

-- ════════ ١) الإصدار من المركز ════════
select pg_temp.impersonate((select officer from t_ids));
set local role authenticated;

create temp table t_ref as
select id, ref, status from referral_create('TC-2026-9701', 'psych', 'health', 'جلسات إرشاد نفسي — اختبار آلي');

do $$ begin
  if (select status from t_ref) <> 'new' then raise exception '١: الإحالة لم تُنشأ بحالة new'; end if;
end $$;

-- لا ازدواج لنفس التدبير الحيّ
do $$ begin
  begin
    perform referral_create('TC-2026-9701', 'psych', 'health', 'ازدواج');
    raise exception '١أ: قبلت إحالة مزدوجة لتدبير حيّ';
  exception when others then
    if sqlerrm like '١أ:%' then raise; end if;
  end;
end $$;

-- لا إحالة لقضية غير نشطة
do $$ begin
  begin
    perform referral_create('TC-2026-9702', 'psych', 'health', 'قضية في الفرز');
    raise exception '١ب: قبلت إحالة لقضية غير نشطة';
  exception when others then
    if sqlerrm like '١ب:%' then raise; end if;
  end;
end $$;

-- المركز يقرأ إحالاته (سياسة referral_center_read)
do $$ begin
  if not exists (select 1 from referrals where id = (select id from t_ref)) then
    raise exception '١ج: موظف المركز لا يرى الإحالة التي أصدرها';
  end if;
end $$;

-- المركز ليس سلطة الصحة: لا يُحدّث إحالتها
do $$ begin
  begin
    perform referral_update((select id from t_ref), 'assigned', 'س1', null, 'تجاوز');
    raise exception '١د: موظف المركز حدّث إحالة سلطة الصحة';
  exception when others then
    if sqlerrm like '١د:%' then raise; end if;
  end;
end $$;

-- ════════ ٢) معالجة الجهة (الصحة) حتى الاعتماد ════════
select pg_temp.impersonate((select moh from t_ids));

do $$
declare _id uuid := (select id from t_ref);
begin
  perform referral_update(_id, 'assigned', 'مختص الاختبار', null, 'استلام الإحالة وإسنادها');
  perform referral_update(_id, 'progress', null, jsonb_build_object('sched', 'الأحد ١٠ص'), 'حفظ الجدولة وبدء المعالجة');
  perform referral_update(_id, 'review',   null, jsonb_build_object('sched', 'الأحد ١٠ص', 'result', 'اكتملت الجلسات'), 'رفع النتيجة لاعتماد المدير');
  perform referral_update(_id, 'done',     null, jsonb_build_object('sched', 'الأحد ١٠ص', 'result', 'اكتملت الجلسات'), 'اعتماد النتيجة والرد على المركز');
  if (select status from referrals where id = _id) <> 'done' then
    raise exception '٢: الدورة لم تبلغ done';
  end if;
end $$;

-- الجهة لا تُقفل: لا عبر referral_update (الحارس) ولا عبر referral_close (الدور)
do $$
declare _id uuid := (select id from t_ref);
begin
  begin
    perform referral_update(_id, 'closed', null, null, 'إقفال من الجهة');
    raise exception '٢أ: الجهة أقفلت عبر referral_update';
  exception when others then
    if sqlerrm like '٢أ:%' then raise; end if;
  end;
  begin
    perform referral_close(_id, 'إقفال من الجهة');
    raise exception '٢ب: الجهة أقفلت عبر referral_close';
  exception when others then
    if sqlerrm like '٢ب:%' then raise; end if;
  end;
end $$;

-- ════════ ٣) الإقفال من المركز ════════
select pg_temp.impersonate((select officer from t_ids));

-- لا إقفال قبل اعتماد الجهة (إحالة ثانية ما تزال new)
create temp table t_ref2 as
select id from referral_create('TC-2026-9701', 'transfer', 'hr', 'نقل من مكان العمل — اختبار آلي');
do $$ begin
  begin
    perform referral_close((select id from t_ref2), 'إقفال مبكر');
    raise exception '٣أ: أُقفلت إحالة لم تعتمدها الجهة';
  exception when others then
    if sqlerrm like '٣أ:%' then raise; end if;
  end;
end $$;

do $$
declare _row referrals;
begin
  _row := referral_close((select id from t_ref), null);
  if _row.status <> 'closed' then raise exception '٣: الإقفال لم يبلغ closed'; end if;
end $$;

-- المقفلة نهائية: الجهة لا تلمسها بعد الإقفال
select pg_temp.impersonate((select moh from t_ids));
do $$ begin
  begin
    perform referral_update((select id from t_ref), 'progress', null, null, 'إحياء بعد الإقفال');
    raise exception '٣ب: عُدّلت إحالة مقفلة';
  exception when others then
    if sqlerrm like '٣ب:%' then raise; end if;
  end;
end $$;

-- بعد الإقفال يجوز إعادة إصدار التدبير نفسه
select pg_temp.impersonate((select officer from t_ids));
do $$ begin
  perform referral_create('TC-2026-9701', 'psych', 'health', 'إعادة إصدار بعد الإقفال');
end $$;

-- ════════ ٤) القسم القانوني الداخلي: المركز سلطة legal ════════
create temp table t_ref3 as
select id from referral_create('TC-2026-9701', 'legal', 'legal', 'استشارة قانونية — اختبار آلي');
do $$
declare _id uuid := (select id from t_ref3);
begin
  perform referral_update(_id, 'assigned', 'مستشار قانوني', null, 'استلام الإحالة');
  perform referral_update(_id, 'review', null, jsonb_build_object('result', 'رأي قانوني', '_by', 'مستشار قانوني'), 'رفع للاعتماد');
  perform referral_update(_id, 'done', null, null, 'اعتماد وإشعار المشمول');
  if (select status from referrals where id = _id) <> 'done' then
    raise exception '٤: دورة القسم القانوني الداخلي لم تكتمل';
  end if;
end $$;

-- ════════ ٥) التدقيق والإشعار ════════
reset role;
do $$
declare _officer uuid := (select officer from t_ids);
begin
  if not exists (select 1 from audit_log where actor_id = _officer and action = 'referral_create_health' and target = (select ref from t_ref)) then
    raise exception '٥: لا قيد تدقيق للإصدار';
  end if;
  if not exists (select 1 from audit_log where actor_id = _officer and action = 'referral_closed_health' and target = 'REF-2026-9701') then
    raise exception '٥أ: لا قيد تدقيق للإقفال';
  end if;
  if not exists (select 1 from notifications n join protection_cases c on c.id = n.case_id
                 where c.secret_code = 'TC-2026-9701' and n.type = 'referral') then
    raise exception '٥ب: لا إشعار للمركز عند اعتماد الجهة';
  end if;
end $$;

\echo '✅ referral-closure-tests: كل التأكيدات مرّت (إصدار المركز · دورة الجهة · حارس الإقفال · الإقفال · التدقيق)'
rollback;
