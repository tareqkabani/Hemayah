-- ============================================================
-- إنفاذ نصّ النظام: لا قبول في البرنامج إلا باجتماع أمرين.
--
--   «لا يُقبل المبلّغ أو الشاهد أو الخبير أو الضحية في البرنامج ما لم
--    يُبنَ القبول على ما يأتي:
--      1- طلبٌ مسبّبٌ من أيٍّ منهم بتوفير الحماية.
--      2- توصيةٌ من الجهة الرقابية أو جهة الضبط أو جهة الاستدلال أو
--         جهة التحقيق أو المحكمة بناءً على المعلومات المتوافرة حول
--         مسوّغات توفير الحماية.»
--
-- فالتوصية **ركنٌ في القبول** لا خطوةٌ اختيارية. وكان الفرز يسمح بقرار
-- «قبول وإسناد للدراسة» ابتداءً دون أيّ إحالة، فيدخل الطلبُ الدراسةَ
-- بركنٍ ناقص. المقيس على القاعدة الحالية: 31 من 35 قضيةً أُسندت للدراسة
-- بلا توصيةٍ مستلَمة — أي أنّ المخالفة كانت هي القاعدة لا الاستثناء.
--
-- المسار الصحيح بعد هذه الهجرة:
--   الفرز → إحالة لجهة مختصة → استلام التوصية → قرارٌ ثانٍ في الفرز
--          → قبولٌ وإسنادٌ للدراسة (أو حفظٌ إن لم تقم قضية).
--
-- ملاحظة على النطاق: لا تُمسّ القضايا القائمة. الحارس يسري على القرارات
-- الجديدة فحسب؛ ومعالجة الـ31 السابقة قرارٌ تشغيليّ يُتّخذ على حدة.
-- ============================================================

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

  -- عند الإحالة: توصيةٌ مستحقّة خلال 5 أيام عمل (م9) مربوطةٌ بالفرع المختص
  -- مكانياً — فبدون branch_id لا يراها أحدٌ في بوابة الجهة (RLS).
  if _decision = 'refer' then
    _ent := case _entity_name
              when 'النيابة العامة'               then 'prosecution'::competent_entity
              when 'رئاسة أمن الدولة'             then 'state_security'::competent_entity
              when 'وزارة الداخلية'               then 'moi'::competent_entity
              when 'هيئة الرقابة ومكافحة الفساد'  then 'nazaha'::competent_entity
              when 'وزارة العدل'                  then 'moj'::competent_entity
              else null end;
    if _ent is not null and _region is not null then
      select id into _branch from branches
       where entity = _ent and region = _region::region_code and coalesce(active, true)
       limit 1;
      if _branch is null then
        insert into branches (entity, region, name)
        values (_ent, _region::region_code, coalesce(_authority, _entity_name))
        returning id into _branch;
      end if;
    end if;
    if _branch is null then
      raise exception 'تعذّر تحديد فرع الجهة المختصة — الإحالة تتطلّب جهةً ومنطقةً صحيحتين.';
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
