-- ============================================================
-- إصلاح: إحالة الفرز لطلب توصية كانت تُنشئ التوصية بلا branch_id،
-- فتحجبها سياسات RLS الموجَّهة بالفرع (rec_branch_rw / rec_hq_read)
-- عن كل مستخدمي الجهة المختصة — البوابة تعرض قائمة فارغة دائماً.
--
-- الحل: تستقبل triage_decide الجهةَ والمنطقة صراحةً من واجهة الفرز
-- (التي تعرضهما أصلاً للموظف)، فتحلّ الفرع من جدول branches أو
-- تُنشئه إن لم يكن مزروعاً، وتربط التوصية به.
-- ============================================================

-- الإسقاط أولاً: بقاء الصيغة الخماسية مع السباعية ذات القيم الافتراضية
-- يجعل نداء الخمس وسائط غامضاً (ambiguous) على PostgREST.
drop function if exists public.triage_decide(uuid, text, text, jsonb, text);

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

  update protection_cases
     set status = _new, officer_id = coalesce(officer_id, _uid), updated_at = now()
   where id = _case_id;

  insert into triage_reviews (case_id, officer_id, formal_check, decision, reason, authority)
  values (_case_id, _uid, coalesce(_formal_check, '{}'::jsonb), _decision, _reason, _authority);

  -- عند الإحالة: أنشئ توصيةً مستحقّة خلال 5 أيام عمل (م9) مربوطةً بالفرع
  -- المختص مكانياً — فبدون branch_id لا يراها أحد في بوابة الجهة (RLS).
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

  -- إشعار المستفيد بتقدّم الحالة.
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

-- سدّ الفجوة بأثر رجعي: توصيات مُحالة سابقاً بلا فرع تُربط بفرع جهتها
-- المطابق اسماً إن وُجد (لا تخمين مناطق — الاسم الكامل فقط).
update recommendations r
   set branch_id = b.id
  from branches b
 where r.branch_id is null
   and b.name = r.source_body;
