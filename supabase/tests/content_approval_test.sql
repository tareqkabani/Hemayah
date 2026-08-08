-- ============================================================
-- اختبار دورة اعتماد المحتوى المقفل (20260808000002)
--   docker exec -i supabase_db_Hemayah psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 -f - < supabase/tests/content_approval_test.sql
-- كله داخل معاملة تُرجَع. ينجح بسطر NOTICE ويفشل باستثناء صريح.
-- ============================================================
begin;

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('10000000-0000-4000-8000-00000000c101','authenticated','authenticated','ccr.sysadmin@test.local',now(),now()),
  ('10000000-0000-4000-8000-00000000c102','authenticated','authenticated','ccr.chair@test.local',now(),now()),
  ('10000000-0000-4000-8000-00000000c103','authenticated','authenticated','ccr.subject@test.local',now(),now())
on conflict (id) do nothing;
insert into user_roles (user_id, role) values
  ('10000000-0000-4000-8000-00000000c101','sysadmin'),
  ('10000000-0000-4000-8000-00000000c102','board_chair'),
  ('10000000-0000-4000-8000-00000000c103','subject')
on conflict do nothing;

-- طلبا تعديل من مدير النظام: قائمة مقفلة + نص نظامي
insert into content_change_requests (id, target_kind, target_key, payload, requested_by) values
('30000000-0000-4000-8000-00000000f001','reference_list','protection_types',
 (select jsonb_build_object('items',
    jsonb_agg(jsonb_build_object('item_key', item_key, 'label',
      case when item_key = 't1' then 'الحماية الأمنية للشخص' else label end,
      'active', active) order by sort_order)
    || jsonb_build_array(jsonb_build_object('item_key','(مفتاح يُولَّد عند الاعتماد)','label','بند مُستحدَث للاختبار','active',true)))
  from reference_items where list_key='protection_types'),
 '10000000-0000-4000-8000-00000000c101'),
('30000000-0000-4000-8000-00000000f002','legal_text','l_truth',
 '{"body":"نصّ إقرارٍ محدَّث للاختبار."}'::jsonb,
 '10000000-0000-4000-8000-00000000c101');

-- ══ 1) غير الرئيس لا يبتّ ══
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-00000000c103","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  begin
    perform content_change_decide('30000000-0000-4000-8000-00000000f001', true);
    raise exception 'CCR FAIL 1: غير الرئيس اعتمد تعديلاً';
  exception when others then
    if sqlerrm not like '%رئيس المركز%' then raise; end if;
  end;
end $$;
reset role;

-- ══ 2) الرفض يتطلّب سبباً ══
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-00000000c102","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  begin
    perform content_change_decide('30000000-0000-4000-8000-00000000f002', false, '');
    raise exception 'CCR FAIL 2: رُفض بلا سبب';
  exception when others then
    if sqlerrm not like '%سبباً%' then raise; end if;
  end;
end $$;

-- ══ 3) اعتماد تعديل القائمة المقفلة: تحديث بالمفتاح + توليد مفتاح للجديد ══
do $$ declare _label text; _newkey text; _st text; begin
  select cd.status into _st from content_change_decide('30000000-0000-4000-8000-00000000f001', true, 'اعتماد اختباري') cd;
  if _st <> 'approved' then raise exception 'CCR FAIL 3a: الحالة % لا approved', _st; end if;
  select label into _label from reference_items where list_key='protection_types' and item_key='t1';
  if _label <> 'الحماية الأمنية للشخص' then raise exception 'CCR FAIL 3b: نصّ t1 لم يُطبَّق: %', _label; end if;
  select item_key into _newkey from reference_items
   where list_key='protection_types' and label='بند مُستحدَث للاختبار';
  if _newkey is null or _newkey !~ '^protection_types_\d+$' then
    raise exception 'CCR FAIL 3c: البند الجديد بلا مفتاح مولَّد (%)', coalesce(_newkey,'∅'); end if;
end $$;

-- ══ 4) اعتماد النص النظامي: نسخة جديدة بتاريخ سريان ══
do $$ declare _v int; _body text; _eff timestamptz; begin
  perform content_change_decide('30000000-0000-4000-8000-00000000f002', true, null);
  select version, body, effective_at into _v, _body, _eff from legal_texts where text_key='l_truth';
  if _body <> 'نصّ إقرارٍ محدَّث للاختبار.' then raise exception 'CCR FAIL 4a: النص لم يُطبَّق'; end if;
  if _v < 2 then raise exception 'CCR FAIL 4b: النسخة لم تُرفَع (%)', _v; end if;
  if _eff is null then raise exception 'CCR FAIL 4c: بلا تاريخ سريان'; end if;
end $$;

-- ══ 5) لا بتّ مكرّر ══
do $$ begin
  begin
    perform content_change_decide('30000000-0000-4000-8000-00000000f001', false, 'سبب');
    raise exception 'CCR FAIL 5: بُتّ في طلبٍ مبتوت';
  exception when others then
    if sqlerrm not like '%مبتوت%' then raise; end if;
  end;
end $$;
reset role;

-- ══ 6) الأثر في التدقيق بالمعتمِد ══
do $$ declare _n int; begin
  select count(*) into _n from audit_log
   where action = 'content_change_approved_reference_list'
     and actor_id = '10000000-0000-4000-8000-00000000c102';
  if _n < 1 then raise exception 'CCR FAIL 6: لا أثر اعتماد بالمعتمِد'; end if;
end $$;

do $$ begin raise notice '✓ اختبارات دورة اعتماد المحتوى كلها ناجحة'; end $$;

rollback;
