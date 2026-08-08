-- ============================================================
-- اختبار محرّك الإشعارات (20260808000001)
-- يُشغَّل بعد تطبيق المهاجرة:
--   docker exec -i supabase_db_Hemayah psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 -f - < supabase/tests/notification_engine_test.sql
-- ينجح بسطر NOTICE ختامي ويفشل باستثناء صريح. كله داخل معاملة تُرجَع.
-- ============================================================
begin;

-- قضية اختبار + توصية متجاوزة المهلة (تزول بالتراجع)
insert into protection_cases (id, ref_no, secret_code, category, status)
values ('20000000-0000-4000-8000-00000000e001', 'REF-TEST-9001', 'ح-9001', 'witness', 'referred');
insert into recommendations (case_id, source_body, raised_at, due_at)
values ('20000000-0000-4000-8000-00000000e001', 'prosecution', now() - interval '7 days', now() - interval '2 days');

-- ══ 1) التعبئة الصارمة: متغيّر ناقص = خطأ صريح لا نصّ ناقص ══
do $$ begin
  begin
    perform render_template_text('طلبكم {رقم_الطلب} بتاريخ {تاريخ}', '{"رقم_الطلب":"REF-1"}'::jsonb);
    raise exception 'ENGINE FAIL 1: قُبل نصّ بمتغيّر ناقص';
  exception when sqlstate '22023' then null; -- المتوقّع
  end;
end $$;

-- ══ 2) التعبئة الصحيحة ══
do $$ declare _out text; begin
  _out := render_template_text('طلبكم {رقم_الطلب} × {رقم_الطلب}', '{"رقم_الطلب":"REF-1"}'::jsonb);
  if _out <> 'طلبكم REF-1 × REF-1' then
    raise exception 'ENGINE FAIL 2: تعبئة خاطئة: %', _out;
  end if;
end $$;

-- ══ 3) قالب غير معرّف = خطأ تهيئة صريح ══
do $$ begin
  begin
    perform notify_from_template('n_no_such_key', '{}'::jsonb);
    raise exception 'ENGINE FAIL 3: قالب غير موجود لم يرمِ خطأ';
  exception when sqlstate 'P0002' then null;
  end;
end $$;

-- ══ 4) القالب الموقوف من بوابة الأدمن: لا إرسال ولا خطأ ══
do $$ declare _sent boolean; _n int; begin
  update notification_templates set active = false where template_key = 'n_grv_received';
  _sent := notify_from_template('n_grv_received',
    '{"رقم_التظلم":"GRV-1","تاريخ_التقديم":"2026-08-08"}'::jsonb,
    '20000000-0000-4000-8000-00000000e001', 'grievance_in', 'requests');
  if _sent then raise exception 'ENGINE FAIL 4a: أُرسل من قالب موقوف'; end if;
  select count(*) into _n from notifications
   where case_id = '20000000-0000-4000-8000-00000000e001' and type = 'grievance_in';
  if _n <> 0 then raise exception 'ENGINE FAIL 4b: صفّ إشعار رغم الإيقاف'; end if;
  update notification_templates set active = true where template_key = 'n_grv_received';
end $$;

-- ══ 5) إرسال فعلي: نصّ معبّأ من القالب + أثر تدقيق ══
do $$ declare _sent boolean; _row record; _n int; begin
  _sent := notify_from_template('n_grv_result',
    jsonb_build_object('رقم_التظلم','GRV-77','تاريخ_البت','2026-08-08',
      'نتيجة_التظلم','رفض التظلّم وتأييد القرار','الأسباب','اكتمال المسوّغات'),
    '20000000-0000-4000-8000-00000000e001', 'grievance_dismissed', 'requests');
  if not _sent then raise exception 'ENGINE FAIL 5a: لم يُرسل من قالب مفعّل'; end if;
  select * into _row from notifications
   where case_id = '20000000-0000-4000-8000-00000000e001' and type = 'grievance_dismissed'
   order by created_at desc limit 1;
  if _row.title <> 'نتيجة التظلّم GRV-77' then
    raise exception 'ENGINE FAIL 5b: عنوان غير معبّأ: %', _row.title; end if;
  if _row.body not like '%GRV-77%' or _row.body not like '%اكتمال المسوّغات%' then
    raise exception 'ENGINE FAIL 5c: متن غير معبّأ: %', _row.body; end if;
  if _row.body like '%{%' then
    raise exception 'ENGINE FAIL 5d: بقايا متغيّرات في المتن'; end if;
  select count(*) into _n from audit_log where action = 'notify_n_grv_result'
   and target = '20000000-0000-4000-8000-00000000e001';
  if _n < 1 then raise exception 'ENGINE FAIL 5e: لا أثر تدقيق للإرسال'; end if;
end $$;

-- ══ 6) مراقب مهلة التوصية: تصعيد التجاوز للجهة وللقيادة، بلا تكرار يومي ══
do $$ declare _ent int; _lead int; _before int; _after int; begin
  update app_settings set value = 'on' where key = 'watchdog';
  if not found then insert into app_settings (key, value) values ('watchdog', 'on'); end if;

  perform recommendations_watchdog();
  select count(*) into _ent from notifications
   where case_id = '20000000-0000-4000-8000-00000000e001'
     and title like 'تجاوز مهلة التوصية%' and authority = 'competent';
  if _ent <> 1 then raise exception 'WATCHDOG FAIL 6a: إشعار الجهة بالتجاوز = % (المتوقع 1)', _ent; end if;
  select count(*) into _lead from notifications n join user_roles ur on ur.user_id = n.recipient_id
   where n.case_id = '20000000-0000-4000-8000-00000000e001'
     and n.title like 'تجاوز مهلة التوصية%' and ur.role in ('deputy_chair','board_chair');
  if _lead < 1 then raise exception 'WATCHDOG FAIL 6b: لا تصعيد للقيادة'; end if;

  -- تشغيل ثانٍ في اليوم نفسه = لا تكرار
  select count(*) into _before from notifications where title like 'تجاوز مهلة التوصية%';
  perform recommendations_watchdog();
  select count(*) into _after from notifications where title like 'تجاوز مهلة التوصية%';
  if _after <> _before then raise exception 'WATCHDOG FAIL 6c: تكرار التصعيد في اليوم نفسه'; end if;
end $$;

-- ══ 7) قوالب القرار بعد المواءمة: المتغيّرات المتاحة فعلاً فقط ══
do $$ declare _vars text[]; begin
  select variables into _vars from notification_templates where template_key = 'n_dec_accept';
  if 'رقم_القرار' = any(_vars) then
    raise exception 'TPL FAIL 7: n_dec_accept ما زال يطلب {رقم_القرار} غير المتاح'; end if;
  if not ('رقم_الطلب' = any(_vars)) then
    raise exception 'TPL FAIL 7b: n_dec_accept فقد {رقم_الطلب}'; end if;
end $$;

do $$ begin raise notice '✓ اختبارات محرّك الإشعارات كلها ناجحة'; end $$;

rollback;
