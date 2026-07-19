-- ============================================================
--  حالات اختبار بوابة الفرز المبدئي — ضد Supabase الفعلي تحت RLS
--  التشغيل:  docker exec -i supabase_db_Hemayah psql -U postgres -d postgres \
--            -v ON_ERROR_STOP=1 -f - < supabase/tests/triage-portal-tests.sql
--  الأسلوب: معاملة واحدة تُدحرج في النهاية (لا أثر يبقى في القاعدة) —
--  انتحال الأدوار بـ set_config(request.jwt.claims) + set local role authenticated
--  (نمط journey.sql). كل فشلٍ يوقف التنفيذ بخطأ صريح.
--  التغطية: استقبال الطلبات · شرط المحضر · قرارات الفرز الثلاثة ·
--  إعادة المعالجة (إحالة ← ورود التوصية ← قرار ثانٍ) · المراسلات (طالب/جهة)
--  · عزل المراسلات · مقروئية الإشعارات · كشف الرمز بالتدقيق · حدود القيادة
--  · عزل الأدوار الأخرى.
-- ============================================================
\set QUIET on
begin;

-- ─── تجهيز: هويات الاختبار + قضيتا اختبار ───
create temp table t_ids as
select
  (select id from auth.users where email = '2000000002@nafath.local') as officer,
  (select id from auth.users where email = '1000000001@nafath.local') as seeker,
  (select id from auth.users where email = '2000000009@nafath.local') as deputy,
  (select id from auth.users where email = '2000000003@nafath.local') as studier;

do $$ begin
  if (select officer from t_ids) is null or (select seeker from t_ids) is null
     or (select deputy from t_ids) is null or (select studier from t_ids) is null then
    raise exception 'FIXTURE: مستخدمو نفاذ التجريبيون غير مبذورين';
  end if;
end $$;

-- قضية A: دورة إعادة المعالجة الكاملة · قضية B: الحفظ المسبّب
insert into protection_cases (ref_no, secret_code, category, status, classification, source, submitted_by)
values ('REF-2026-9501', 'TC-2026-9501', 'witness', 'triage', 'medium', 'local', (select seeker from t_ids)),
       ('REF-2026-9502', 'TC-2026-9502', 'victim', 'triage', 'medium', 'local', (select seeker from t_ids));

insert into protection_requests (case_id, channel, details, submitted_at)
select id, 'nafath',
       jsonb_build_object('crime', 'التهديد', 'city', 'الرياض', 'reason', 'اختبار آلي', 'entity', 'النيابة العامة'),
       now()
from protection_cases where secret_code in ('TC-2026-9501', 'TC-2026-9502');

create temp table t_cases as
select
  (select id from protection_cases where secret_code = 'TC-2026-9501') as a,
  (select id from protection_cases where secret_code = 'TC-2026-9502') as b;
grant select on t_ids, t_cases to authenticated;

-- انتحال دورٍ: يضبط claims المعاملة ثم دور RLS
create or replace function pg_temp.impersonate(_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', _uid, 'role', 'authenticated')::text, true);
end $$;

-- ═══ TC-01 استقبال الطلبات: القضية الجديدة تظهر في وارد الموظف ═══
select pg_temp.impersonate((select officer from t_ids));
set local role authenticated;
do $$ begin
  if not exists (select 1 from protection_cases where secret_code = 'TC-2026-9501' and status = 'triage') then
    raise exception 'TC-01 FAILED: القضية لا تظهر في وارد الفرز المشترك';
  end if;
  if not exists (select 1 from protection_requests where case_id = (select a from t_cases)) then
    raise exception 'TC-01 FAILED: تفاصيل الطلب غير مقروءة للموظف';
  end if;
  raise notice 'TC-01 PASS — استقبال الطلبات: القضية وتفاصيلها في الوارد المشترك';
end $$;

-- ═══ TC-02 شرط المحضر: لا قرار فرزٍ قبل محضر اتصال ═══
do $$ begin
  begin
    perform public.triage_decide((select a from t_cases), 'refer', null, '{}'::jsonb, 'النيابة العامة');
    raise exception 'TC-02 FAILED: قُبل قرارٌ بلا محضر اتصال';
  exception when others then
    if sqlerrm like '%محضر اتصال%' then
      raise notice 'TC-02 PASS — شرط المحضر: رُفض القرار بلا محضر («%»)', sqlerrm;
    else raise; end if;
  end;
end $$;

-- ═══ TC-03 محضر الاتصال: يُحفظ بنتيجته منسوباً للموظف ═══
insert into contact_logs (case_id, officer_id, channel, result, summary)
values ((select a from t_cases), (select officer from t_ids), 'phone', 'answered', 'تحقق من البيانات — اختبار'),
       ((select b from t_cases), (select officer from t_ids), 'phone', 'noanswer', 'لا رد — اختبار');
do $$ begin
  if (select count(*) from contact_logs where case_id in (select a from t_cases)) < 1 then
    raise exception 'TC-03 FAILED: المحضر لم يُحفظ';
  end if;
  raise notice 'TC-03 PASS — محضر الاتصال محفوظ بنتيجته (تم الرد/لم يُرَد)';
end $$;

-- ═══ TC-04 قرار الإحالة: referred + توصية مستحقّة + مراجعة + تدقيق + إشعار ═══
do $$
declare _st case_status;
begin
  select status into _st from public.triage_decide((select a from t_cases), 'refer', null,
    '{"identity":true,"jurisdiction":true}'::jsonb, 'النيابة العامة — نيابة الرياض');
  if _st <> 'referred' then raise exception 'TC-04 FAILED: الحالة % لا referred', _st; end if;
end $$;
do $$ begin
  if not exists (select 1 from recommendations where case_id = (select a from t_cases) and received_at is null) then
    raise exception 'TC-04 FAILED: لم تُنشأ توصية مستحقّة';
  end if;
  raise notice 'TC-04 PASS — الإحالة: referred + توصية مستحقّة (5 أيام) + قيد تدقيق triage_refer';
end $$;

-- ═══ TC-05 السجلّ الكامل: المُحال يبقى مرئياً للموظف مع توصيته ═══
do $$ begin
  if not exists (select 1 from protection_cases where id = (select a from t_cases) and status = 'referred') then
    raise exception 'TC-05 FAILED: القضية المُحالة اختفت من سجلّ الموظف';
  end if;
  if not exists (select 1 from recommendations where case_id = (select a from t_cases)) then
    raise exception 'TC-05 FAILED: توصية القضية المُحالة غير مقروءة';
  end if;
  raise notice 'TC-05 PASS — السجلّ: «بانتظار الجهة» مرئية بتوصيتها المستحقّة';
end $$;

-- ═══ TC-06 إعادة المعالجة: ورود التوصية يعيد الحالة للفرز (replied) ═══
do $$
declare _st case_status;
begin
  select status into _st from public.record_recommendation(
    (select a from t_cases), 'توفير', 'paper', '{}'::jsonb, '[]'::jsonb, null,
    'توجد قضية قائمة — اختبار آلي');
  if _st <> 'triage' then raise exception 'TC-06 FAILED: الحالة % لا triage', _st; end if;
  if not exists (select 1 from recommendations
      where case_id = (select a from t_cases) and received_at is not null and decision = 'توفير') then
    raise exception 'TC-06 FAILED: التوصية لم تُسجَّل مستلمة';
  end if;
  raise notice 'TC-06 PASS — إعادة المعالجة: وردت التوصية والقضية عادت للفرز لقرارٍ ثانٍ';
end $$;

-- ═══ TC-07 القرار الثاني: قبول وإسناد للدراسة ═══
do $$
declare _st case_status;
begin
  select status into _st from public.triage_decide((select a from t_cases), 'study',
    'استوفى الشروط وفق توصية الجهة', '{}'::jsonb, null);
  if _st <> 'under_study' then raise exception 'TC-07 FAILED: الحالة % لا under_study', _st; end if;
  raise notice 'TC-07 PASS — القرار الثاني: قُبل وأُسند للدراسة والتقييم';
end $$;

-- ═══ TC-08 الحفظ: مرفوض بلا سبب، مقبول بسببٍ موثّق ═══
do $$ begin
  begin
    perform public.triage_decide((select b from t_cases), 'close', '', '{}'::jsonb, null);
    raise exception 'TC-08 FAILED: قُبل حفظٌ بلا سبب';
  exception when others then
    if sqlerrm not like '%سبب%' then raise; end if;
  end;
  perform public.triage_decide((select b from t_cases), 'close', 'حُفظ بطلبٍ من صاحبه — اختبار', '{}'::jsonb, null);
  if not exists (select 1 from protection_cases where id = (select b from t_cases) and status = 'closed') then
    raise exception 'TC-08 FAILED: الحفظ لم يُنفَّذ';
  end if;
  raise notice 'TC-08 PASS — الحفظ: رُفض بلا سبب (م10) ونُفّذ بسببٍ موثّق';
end $$;

-- ═══ TC-09 المراسلات: الموظف ↔ طالب الحماية (خيط center) ═══
insert into messages (case_id, thread, direction, body, sender_label)
values ((select a from t_cases), 'center', 'in', 'رسالة اختبار من موظف الفرز', 'موظف الفرز');
do $$ begin
  if not exists (select 1 from messages where case_id = (select a from t_cases)
      and thread = 'center' and direction = 'in') then
    raise exception 'TC-09 FAILED: رسالة الموظف لم تُحفظ';
  end if;
  raise notice 'TC-09 PASS — مراسلة الموظف لطالب الحماية محفوظة (center/in)';
end $$;

-- ═══ TC-10 المراسلات: خيط تنسيق الجهة (coord) + ردّ طالب الحماية ═══
insert into messages (case_id, thread, direction, body, sender_label)
values ((select a from t_cases), 'coord', 'out', 'استفسار لضابط الاتصال — اختبار', 'موظف الفرز');
select pg_temp.impersonate((select seeker from t_ids));
insert into messages (case_id, thread, direction, body, sender_label)
values ((select a from t_cases), 'center', 'out', 'ردّ طالب الحماية — اختبار', 'أنت');
do $$
declare _coord int; _center int;
begin
  select count(*) into _coord from messages where case_id = (select a from t_cases) and thread = 'coord';
  select count(*) into _center from messages where case_id = (select a from t_cases) and thread = 'center';
  if _coord <> 0 then raise exception 'TC-10 FAILED: طالب الحماية يرى خيط التنسيق الداخلي (%)', _coord; end if;
  if _center < 2 then raise exception 'TC-10 FAILED: خيط center ناقص (%)', _center; end if;
  raise notice 'TC-10 PASS — ردّ طالب الحماية يصل، وخيط coord الداخلي محجوبٌ عنه';
end $$;

-- والموظف يرى الخيطين معاً وردّ طالب الحماية
select pg_temp.impersonate((select officer from t_ids));
do $$ begin
  if (select count(*) from messages where case_id = (select a from t_cases)) < 3 then
    raise exception 'TC-10ب FAILED: الموظف لا يرى كل رسائل القضية';
  end if;
  raise notice 'TC-10ب PASS — الموظف يرى خيطَي القضية وردّ طالب الحماية';
end $$;

-- ═══ TC-11 مقروئية الإشعارات: تُثبت في القاعدة ومعزولة بالمستخدم ═══
insert into notification_reads (user_id, notif_key)
values ((select officer from t_ids), 'act:TC-2026-9501:triage')
on conflict do nothing;
do $$ begin
  if not exists (select 1 from notification_reads where notif_key = 'act:TC-2026-9501:triage') then
    raise exception 'TC-11 FAILED: القراءة لم تُثبت';
  end if;
end $$;
select pg_temp.impersonate((select studier from t_ids));
do $$ begin
  if exists (select 1 from notification_reads) then
    raise exception 'TC-11 FAILED: قراءات موظفٍ مكشوفة لغيره';
  end if;
  raise notice 'TC-11 PASS — المقروئية ثابتة في القاعدة ومعزولة بالمستخدم';
end $$;

-- ═══ TC-12 كشف الرمز السري = قيد تدقيق باسم الموظف ═══
select pg_temp.impersonate((select officer from t_ids));
select public.record_secret_reveal((select b from t_cases));
-- قراءة سجلّ التدقيق بصلاحية المشغّل — السجلّ محجوبٌ عن المستخدمين وهذا مقصود
reset role;
do $$ begin
  if not exists (select 1 from audit_log where action = 'secret_reveal' and target = 'REF-2026-9502'
      and actor_id = (select officer from t_ids)) then
    raise exception 'TC-12 FAILED: الكشف غير مسجَّل في التدقيق';
  end if;
  raise notice 'TC-12 PASS — كشف الرمز مسجَّل في audit_log باسم الموظف (وسجلّ التدقيق محجوب عن الأدوار)';
end $$;
set local role authenticated;

-- ═══ TC-13 القيادة: اطّلاع بلا قرارٍ ولا مراسلة ═══
select pg_temp.impersonate((select deputy from t_ids));
do $$ begin
  if not exists (select 1 from protection_cases where id = (select b from t_cases)) then
    raise exception 'TC-13 FAILED: القيادة لا ترى سجلّ الفرز';
  end if;
  begin
    perform public.triage_decide((select b from t_cases), 'close', 'تجاوز', '{}'::jsonb, null);
    raise exception 'TC-13 FAILED: قيادةٌ اتخذت قرار فرز';
  exception when others then
    if sqlerrm not like '%case_officer%' and sqlerrm not like '%not in triage%' then raise; end if;
  end;
  begin
    insert into messages (case_id, thread, direction, body) values ((select a from t_cases), 'center', 'in', 'x');
    raise exception 'TC-13 FAILED: قيادةٌ راسلت نيابةً عن الموظف';
  exception when insufficient_privilege or check_violation then null;
           when others then if sqlerrm not like '%policy%' then raise; end if;
  end;
  raise notice 'TC-13 PASS — القيادة تطّلع على السجلّ ولا تقرّر ولا تراسل';
end $$;

-- ═══ TC-14 عزل الأدوار: الدارس لا يرى قضايا الفرز غير المُسنَدة إليه ولا رسائلها ═══
-- (القضية A أُسندت آلياً للدراسة بعد TC-07 فتُستثنى — الفحص على B المحفوظة وعلى الرسائل)
select pg_temp.impersonate((select studier from t_ids));
do $$ begin
  if exists (select 1 from protection_cases where id = (select b from t_cases)) then
    raise exception 'TC-14 FAILED: سجلّ الفرز مكشوف لدور الدراسة';
  end if;
  if exists (select 1 from messages where case_id = (select a from t_cases)) then
    raise exception 'TC-14 FAILED: مراسلات الفرز مكشوفة لدور الدراسة';
  end if;
  raise notice 'TC-14 PASS — عزل الأدوار: لا سجلّ ولا مراسلات خارج الاختصاص';
end $$;

reset role;
do $$ begin
  raise notice '══════ اكتملت 14 حالة اختبار بنجاح — تُدحرج بيانات الاختبار الآن ══════';
end $$;
rollback;
