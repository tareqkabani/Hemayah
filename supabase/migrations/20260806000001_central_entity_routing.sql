-- ============================================================
-- توجيه الإحالة بحسب النموذج التنظيمي للجهة المختصة.
--
-- الحقائق التنظيمية (بتأكيد الجهة المالكة 2026-08-06):
--   - النيابة العامة: مناطقية — نيابات مناطق (13). (الهيكل الهرمي الكامل
--     نيابات مناطق + فروع محافظات مرحلةٌ تالية بانتظار القائمة الرسمية.)
--   - نزاهة، رئاسة أمن الدولة، وزارة الداخلية، وزارة العدل: **مركزية** —
--     وحدة استقبال واحدة بلا فروع.
--
-- كان triage_decide يحلّ الفرع بثنائية (جهة، منطقة) وينشئ فرعاً تلقائياً
-- إن غاب — فمع الجهات المركزية كانت كل إحالةٍ بمنطقةٍ ≠ الرياض تُنشئ وحدةً
-- وهميةً لا يراها موظف الجهة المربوط بمركزها (RLS بالفرع)، فتضيع الإحالة
-- (شوهد فعلياً: «نزاهة — فرع منطقة مكة المكرمة» بتوصيتين لا يراهما أحد).
--
-- المعالجة الجذرية هنا بثلاثة أجزاء:
--   1) بذرٌ رسميّ لوحدات الاستقبال: وحدة is_hq واحدة لكل جهةٍ مركزية،
--      و13 نيابة منطقة للنيابة العامة (تنتقل من بذور snippets اليدوية
--      إلى هجرةٍ فتحصل عليها كل بيئة).
--   2) توحيدٌ بأثرٍ رجعي: دمج الوحدات المتناثرة للجهات المركزية في
--      مركزها بنقل كل الإشارات (توصيات/اعتمادات/قضايا/سمات مستخدمين).
--   3) triage_decide: الجهة ذات وحدة is_hq تُوجَّه إليها مباشرةً أياً كانت
--      المنطقة (تبقى معلومةَ اختصاصٍ على القضية)؛ المناطقية تُحَلّ بالمنطقة؛
--      و**يُلغى الإنشاء التلقائي للفروع نهائياً** — يرفض بدل أن يخترع.
--
-- اشتقاق النموذج من البيانات لا من قائمةٍ ثانية: مركزية = لجهتها وحدة
-- is_hq نشطة (المصدر التطبيقي الموازي: COMPETENT_ENTITIES في @hemaya/domain
-- ويحرسه اختبار التغطية label-coverage).
-- ============================================================

-- ── 1) بذر وحدات الاستقبال الرسمية ──
do $$
declare
  ent record;
  reg record;
  _b  uuid;
begin
  for ent in
    select * from (values
      ('prosecution',    'النيابة العامة',              'regional'),
      ('state_security', 'رئاسة أمن الدولة',            'central'),
      ('moi',            'وزارة الداخلية',              'central'),
      ('nazaha',         'هيئة الرقابة ومكافحة الفساد', 'central'),
      ('moj',            'وزارة العدل',                 'central')
    ) as e(code, label, model)
  loop
    if ent.model = 'central' then
      -- الوحدة المركزية: الموسومة hq إن وُجدت، وإلا صفّ الرياض يُحوَّل، وإلا تُنشأ
      select id into _b from branches
       where entity = ent.code::competent_entity and is_hq limit 1;
      if _b is null then
        select id into _b from branches
         where entity = ent.code::competent_entity and region = 'RUH'::region_code limit 1;
      end if;
      if _b is null then
        insert into branches (entity, region, name, is_hq, active)
        values (ent.code::competent_entity, 'RUH'::region_code,
                ent.label || ' — المركز الرئيسي', true, true)
        returning id into _b;
      else
        update branches
           set name = ent.label || ' — المركز الرئيسي', is_hq = true, active = true
         where id = _b;
      end if;

      -- 2) توحيد بأثر رجعي: نقل كل ما يشير لوحداتٍ أخرى للجهة إلى المركز ثم حذفها
      update recommendations set branch_id = _b
       where branch_id in (select id from branches where entity = ent.code::competent_entity and id <> _b);
      update recommendation_approvals set branch_id = _b
       where branch_id in (select id from branches where entity = ent.code::competent_entity and id <> _b);
      update protection_cases set branch_id = _b
       where branch_id in (select id from branches where entity = ent.code::competent_entity and id <> _b);
      update user_roles set attributes = attributes || jsonb_build_object('branch_id', _b::text)
       where attributes->>'branch_id' in
             (select id::text from branches where entity = ent.code::competent_entity and id <> _b);
      delete from branches where entity = ent.code::competent_entity and id <> _b;
    else
      -- نيابات المناطق الثلاث عشرة (توحيد الاسم إن سبق بذره بصيغة أخرى)
      for reg in
        select * from (values
          ('RUH','نيابة منطقة الرياض'), ('MAK','نيابة منطقة مكة المكرمة'),
          ('MED','نيابة منطقة المدينة المنورة'), ('QAS','نيابة منطقة القصيم'),
          ('EAS','نيابة المنطقة الشرقية'), ('ASR','نيابة منطقة عسير'),
          ('TAB','نيابة منطقة تبوك'), ('HAI','نيابة منطقة حائل'),
          ('NOR','نيابة منطقة الحدود الشمالية'), ('JAZ','نيابة منطقة جازان'),
          ('NAJ','نيابة منطقة نجران'), ('BAH','نيابة منطقة الباحة'),
          ('JOF','نيابة منطقة الجوف')
        ) as r(code, label)
      loop
        insert into branches (entity, region, name, is_hq, active)
        values (ent.code::competent_entity, reg.code::region_code,
                ent.label || ' — ' || reg.label, false, true)
        on conflict (entity, region) do update set name = excluded.name, active = true;
      end loop;
    end if;
  end loop;
end $$;

-- ── 3) triage_decide: التوجيه بحسب النموذج، ولا إنشاء تلقائياً للفروع ──
create or replace function public.triage_decide(
  _case_id uuid,
  _decision text,
  _reason text,
  _formal_check jsonb default '{}'::jsonb,
  _authority text default null,
  _entity_name text default null,
  _region text default null
)
returns table(status case_status)
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  _uid uuid := auth.uid();
  _cur case_status;
  _new case_status;
  _ref text;
  _ent competent_entity;
  _branch uuid;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid, 'case_officer') then raise exception 'forbidden: not case_officer'; end if;

  select c.status, c.ref_no into _cur, _ref from protection_cases c where c.id = _case_id for update;
  if _cur is null then raise exception 'case not found'; end if;
  if _cur <> 'triage' then raise exception 'case not in triage (%).', _cur; end if;

  -- شرط: محضر اتصالٍ واحد على الأقل قبل أي قرار (م — الفرز).
  if not exists (select 1 from contact_logs where case_id = _case_id) then
    raise exception 'محضر اتصالٍ واحد شرطٌ قبل القرار.';
  end if;

  _new := case _decision
            when 'study' then 'under_study'::case_status
            when 'refer' then 'referred'::case_status
            when 'close' then 'closed'::case_status
            else null end;
  if _new is null then raise exception 'قرار غير معروف: %', _decision; end if;
  if _decision = 'close' and (_reason is null or btrim(_reason) = '') then
    raise exception 'الحفظ يتطلّب سبباً موثّقاً (م10).';
  end if;

  -- ركن القبول الثاني: توصيةُ الجهة المختصة مستلَمةٌ فعلاً.
  -- الطلب المسبّب (الركن الأول) قائمٌ بذات وجود الطلب في السجلّ.
  if _decision = 'study'
     and not exists (select 1 from recommendations r
                      where r.case_id = _case_id and r.received_at is not null) then
    raise exception
      'لا يُقبل الطلب في البرنامج قبل ورود توصية الجهة المختصة — أحِل الطلب لطلب التوصية أوّلاً.';
  end if;

  update protection_cases
     set status = _new, officer_id = coalesce(officer_id, _uid), updated_at = now()
   where id = _case_id;

  insert into triage_reviews (case_id, officer_id, formal_check, decision, reason, authority)
  values (_case_id, _uid, coalesce(_formal_check, '{}'::jsonb), _decision, _reason, _authority);

  -- عند الإحالة: توصيةٌ مستحقّة خلال 5 أيام عمل (م9) مربوطةٌ بوحدة الاستقبال
  -- بحسب النموذج التنظيمي للجهة — فبدون branch_id لا يراها أحدٌ (RLS):
  --   مركزية (لها وحدة is_hq): تُوجَّه للمركز مباشرةً أياً كانت المنطقة.
  --   مناطقية: وحدة المنطقة المختارة. ولا يُخترع فرعٌ غائب — يُرفض صراحةً
  --   (الوحدات الرسمية تُبذر بالهجرات لا بالإحالات).
  if _decision = 'refer' then
    _ent := case _entity_name
              when 'النيابة العامة'               then 'prosecution'::competent_entity
              when 'رئاسة أمن الدولة'             then 'state_security'::competent_entity
              when 'وزارة الداخلية'               then 'moi'::competent_entity
              when 'هيئة الرقابة ومكافحة الفساد'  then 'nazaha'::competent_entity
              when 'وزارة العدل'                  then 'moj'::competent_entity
              else null end;
    if _ent is null then
      raise exception 'جهة مختصة غير معروفة: %', coalesce(_entity_name, '—');
    end if;

    select id into _branch from branches
     where entity = _ent and is_hq and coalesce(active, true)
     limit 1;
    if _branch is null and _region is not null then
      select id into _branch from branches
       where entity = _ent and region = _region::region_code and coalesce(active, true)
       limit 1;
    end if;
    if _branch is null then
      raise exception 'لا وحدة استقبال مبذورة للجهة % — تُدار وحدات الجهات بالهجرات لا بالإحالات.', _entity_name;
    end if;

    insert into recommendations (case_id, source_body, raised_at, due_at, branch_id)
    values (_case_id, _authority, now(), now() + interval '5 days', _branch);
  end if;

  insert into audit_log (actor_id, action, target)
  values (_uid, 'triage_' || _decision, _ref);

  insert into notifications (case_id, type, title, body, target_tab, sent_at)
  values (_case_id, 'triage',
    case _decision when 'study' then 'انتقل طلبك إلى الدراسة'
                   when 'refer' then 'أُحيل طلبك إلى الجهة المختصة'
                   else 'حُفظ طلبك' end,
    case _decision when 'study' then 'اجتاز طلبك الفرز المبدئي وانتقل إلى مرحلة الدراسة والتقييم.'
                   when 'refer' then 'أُحيل طلبك إلى الجهة المختصة لرفع التوصية خلال 5 أيام عمل.'
                   else coalesce(_reason, 'حُفظ الطلب.') end,
    'requests', now());

  return query select _new;
end $$;

grant execute on function public.triage_decide(uuid, text, text, jsonb, text, text, text) to authenticated;
revoke execute on function public.triage_decide(uuid, text, text, jsonb, text, text, text) from public, anon;
