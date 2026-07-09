-- ============================================================
--  اختصار مسار القرار — الإرسال المباشر للتصويت (طلب رئيس المركز)
--  كان: preparing → pending_deputy → pending_chair → voting (بوابتا اعتماد).
--  صار: preparing → voting مباشرةً؛ يُرفق المعدّ الحزمة كاملةً وتُطرح للمجلس فوراً.
--  ما بعد التصويت (الحصيلة/الإصدار/التنفيذ/المتابعة) لا يُمَس.
--  استبدالٌ نظيف: council_approve تبقى معرَّفة (خاملة، دون حذف).
--  صمّام أمان: council_return يقبل الإعادة أثناء التصويت أيضاً (تُصفَّر الأصوات).
-- ============================================================

-- ── المعدّ: إرسال القرار مباشرةً للمجلس للتصويت (بدل الرفع للاعتماد) ──
create or replace function public.council_submit(_case_id uuid, _types jsonb, _duration text, _reasoning text)
returns table(status text) language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _ref text;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid, 'case_officer') then raise exception 'forbidden: not preparer'; end if;
  if _reasoning is null or btrim(_reasoning) = '' then raise exception 'حيثيات القرار مطلوبة.'; end if;
  select ref_no into _ref from protection_cases where id = _case_id;
  update council_decisions cd
     set types = _types, duration = _duration, reasoning = _reasoning,
         status = 'voting', voting_started_at = now(),
         deputy_approved_at = null, chair_approved_at = null, updated_at = now()
   where cd.case_id = _case_id and cd.status = 'preparing';
  if not found then raise exception 'القرار ليس في الإعداد.'; end if;
  insert into audit_log (actor_id, action, target) values (_uid, 'council_submit_to_voting', _ref);
  return query select 'voting'::text;
end $$;
grant execute on function public.council_submit(uuid, jsonb, text, text) to authenticated;

-- ── القيادة: إعادة القرار للمعدّ للتعديل (يقبل الآن الإعادة أثناء التصويت) ──
--   عند الإعادة من voting تُحذف أصوات القضية كي يُعاد التصويت من جديد بعد إعادة الرفع.
create or replace function public.council_return(_case_id uuid, _note text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _ref text;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not (has_role(_uid, 'deputy_chair') or has_role(_uid, 'board_chair')) then raise exception 'forbidden'; end if;
  if _note is null or btrim(_note) = '' then raise exception 'سبب الإعادة مطلوب.'; end if;
  select ref_no into _ref from protection_cases where id = _case_id;
  update council_decisions
     set status = 'preparing', deputy_approved_at = null, chair_approved_at = null,
         voting_started_at = null, deadline_closed = false,
         rejections = rejections || jsonb_build_object('by', _uid, 'note', _note, 'at', now()), updated_at = now()
   where case_id = _case_id and status in ('pending_deputy', 'pending_chair', 'voting');
  if not found then raise exception 'القرار ليس في مرحلة يمكن إعادته منها.'; end if;
  delete from council_votes where case_id = _case_id;  -- تصفير الأصوات لإعادة تصويتٍ نظيف
  insert into audit_log (actor_id, action, target) values (_uid, 'council_return', _ref);
end $$;
grant execute on function public.council_return(uuid, text) to authenticated;

-- ── قراءة توصية الجهة ضمن حزمة الاطّلاع (المعدّ + المجلس) ──
--   لا توجد اليوم سياسة تتيح للمجلس رؤية recommendations؛ نضيفها على نسق co_req_decision_read.
--   ملاحظة: سياسة protection_cases.staff_case_read تُشير إلى recommendations، فأيّ EXISTS مباشر
--   على protection_cases من سياسةٍ على recommendations يسبّب تكرار RLS لا نهائياً.
--   الحلّ (نمط المشروع): دالّة SECURITY DEFINER تتجاوز RLS لفحص حالة القضية.
create or replace function public.case_in_decision(_case_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from protection_cases c
                 where c.id = _case_id
                   and c.status in ('in_decision','accepted','rejected'));
$$;
grant execute on function public.case_in_decision(uuid) to authenticated;

drop policy if exists co_rec_decision_read on recommendations;
create policy co_rec_decision_read on recommendations for select using (
  (has_role(auth.uid(),'case_officer') or has_role(auth.uid(),'board_member')
   or has_role(auth.uid(),'board_chair') or has_role(auth.uid(),'deputy_chair'))
  and public.case_in_decision(recommendations.case_id));
