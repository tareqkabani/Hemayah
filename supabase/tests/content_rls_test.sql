-- ============================================================
-- اختبار RLS لطبقة محتوى المنصّة (20260807000002/3)
-- يُشغَّل بعد تطبيق المهاجرتين:
--   docker exec -i supabase_db_Hemayah psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 -f - < supabase/tests/content_rls_test.sql
-- ينجح صامتاً بسطر NOTICE ختامي، ويفشل باستثناء صريح عند أي خرق.
-- كل شيء داخل معاملة تُرجَع (rollback) — لا أثر على البيانات.
-- ⚠️ درس «وهم القياس»: UPDATE المحجوب بـRLS يرجع صفر صفوف بلا خطأ —
--    لذا تُعدّ الصفوف بـ get diagnostics ولا يُكتفى بغياب الاستثناء.
-- ============================================================
begin;

-- ══ تجهيز مستخدمي الاختبار (داخل المعاملة — يزولون بالتراجع) ══
insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('10000000-0000-4000-8000-00000000c001','authenticated','authenticated','rls.sysadmin@test.local',now(),now()),
  ('10000000-0000-4000-8000-00000000c002','authenticated','authenticated','rls.subject@test.local',now(),now()),
  ('10000000-0000-4000-8000-00000000c003','authenticated','authenticated','rls.chair@test.local',now(),now())
on conflict (id) do nothing;

insert into user_roles (user_id, role) values
  ('10000000-0000-4000-8000-00000000c001','sysadmin'),
  ('10000000-0000-4000-8000-00000000c002','subject'),
  ('10000000-0000-4000-8000-00000000c003','board_chair')
on conflict do nothing;

-- ══ 1) مدير النظام: يكتب قائمة غير مقفلة → ينجح ══
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-00000000c001","role":"authenticated"}', true);
set local role authenticated;

do $$ declare _n int; begin
  update reference_items set label_short = 'اختبار RLS'
   where list_key = 'applicant_role' and item_key = 'self';
  get diagnostics _n = row_count;
  if _n <> 1 then
    raise exception 'RLS FAIL 1: sysadmin لم يستطع تعديل قائمة غير مقفلة (صفوف=%)', _n;
  end if;
end $$;

-- ══ 2) مدير النظام: يكتب قائمة مقفلة → يفشل ══
do $$ declare _n int; begin
  -- التعديل: السياسة تحجب الصفوف المقفلة فيرجع صفر صفوف
  update reference_items set label_short = 'اختراق'
   where list_key = 'protection_types' and item_key = 't1';
  get diagnostics _n = row_count;
  if _n <> 0 then
    raise exception 'RLS FAIL 2a: sysadmin عدّل بنداً في قائمة مقفلة (صفوف=%)', _n;
  end if;
  -- الإدراج: with check يرمي 42501
  begin
    insert into reference_items (list_key, item_key, label)
    values ('protection_types','t99','بند دخيل');
    raise exception 'RLS FAIL 2b: sysadmin أدرج بنداً في قائمة مقفلة';
  exception when sqlstate '42501' then null; -- المتوقّع
  end;
end $$;

-- ══ 3) مدير النظام: يرفع طلب تعديل محتوى مقفل → ينجح ══
do $$ declare _n int; begin
  insert into content_change_requests (target_kind, target_key, payload, requested_by)
  values ('reference_list','protection_types',
          '{"note":"اختبار دورة الاعتماد"}'::jsonb,
          '10000000-0000-4000-8000-00000000c001');
  get diagnostics _n = row_count;
  if _n <> 1 then raise exception 'RLS FAIL 3: sysadmin لم يستطع رفع طلب تعديل'; end if;
end $$;

-- ══ 4) مستخدم موثّق عاديّ: يقرأ وينجح، يكتب ويفشل ══
reset role;
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-00000000c002","role":"authenticated"}', true);
set local role authenticated;

do $$ declare _n int; begin
  select count(*) into _n from reference_lists;
  if _n < 41 then raise exception 'RLS FAIL 4a: الموثّق لا يقرأ القوائم (عدّ=%)', _n; end if;
  select count(*) into _n from notification_templates;
  if _n < 27 then raise exception 'RLS FAIL 4b: الموثّق لا يقرأ القوالب (عدّ=%)', _n; end if;
  select count(*) into _n from legal_texts;
  if _n < 8 then raise exception 'RLS FAIL 4c: الموثّق لا يقرأ النصوص النظامية (عدّ=%)', _n; end if;

  update reference_items set label = 'تخريب' where list_key = 'applicant_role';
  get diagnostics _n = row_count;
  if _n <> 0 then raise exception 'RLS FAIL 4d: الموثّق عدّل بنود قائمة (صفوف=%)', _n; end if;

  update notification_templates set body = 'تخريب' where template_key = 'n_received';
  get diagnostics _n = row_count;
  if _n <> 0 then raise exception 'RLS FAIL 4e: الموثّق عدّل قالب إشعار (صفوف=%)', _n; end if;

  begin
    insert into system_messages (message_key, title, tone, screen, body)
    values ('s_hack','دخيل','info','لا مكان','نص دخيل');
    raise exception 'RLS FAIL 4f: الموثّق أدرج رسالة نظام';
  exception when sqlstate '42501' then null;
  end;

  begin
    insert into content_change_requests (target_kind, target_key, payload, requested_by)
    values ('legal_text','l_truth','{}'::jsonb,'10000000-0000-4000-8000-00000000c002');
    raise exception 'RLS FAIL 4g: الموثّق رفع طلب تعديل محتوى';
  exception when sqlstate '42501' then null;
  end;
end $$;

-- ══ 5) رئيس المركز: يبتّ في طلب التعديل → ينجح ══
reset role;
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-00000000c003","role":"authenticated"}', true);
set local role authenticated;

do $$ declare _n int; begin
  update content_change_requests
     set status = 'approved',
         decided_by = '10000000-0000-4000-8000-00000000c003',
         decided_at = now()
   where target_key = 'protection_types' and status = 'pending';
  get diagnostics _n = row_count;
  if _n < 1 then raise exception 'RLS FAIL 5: رئيس المركز لم يستطع البتّ في طلب التعديل'; end if;
end $$;

-- ══ 6) تدقيق التعديلات: تعديل الخطوة 1 ترك أثراً في audit_log ══
reset role;
do $$ declare _n int; begin
  select count(*) into _n from audit_log
   where action = 'content_reference_items_update' and target = 'self';
  if _n < 1 then raise exception 'AUDIT FAIL 6: تعديل المحتوى لم يُسجَّل في التدقيق'; end if;
end $$;

do $$ begin raise notice '✓ اختبارات RLS لطبقة المحتوى كلها ناجحة'; end $$;

rollback;
