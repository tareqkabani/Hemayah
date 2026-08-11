-- ============================================================
-- سدّ ثغرة مراسلة القيادة للموظف الموسوم صفُّه (superseded)
--
-- الخلل: send_leader_message كانت تحسب _existing بـ count(*) على
-- studies/assessments دون فلتر superseded_at is null، فالدارس أو
-- المقيّم الذي سُحب اطّلاعه (وُسم صفّه بإقفال الميعاد — مهاجرة
-- 20260810000004 — أو بإعادة الإسناد) بقي صفُّه محسوباً، بل ويُحسب
-- «نشطاً» لأن submitted_at فيه null، فيستطيع فتح خيط مراسلة قيادة
-- جديد على قضيةٍ لم يعد مطّلعاً عليها — بينما بقية دوال الاطّلاع
-- (is_assigned_study / my_study_tasks / record_attachment_open)
-- تستثني الموسومين جميعاً.
--
-- العلاج: فلتر superseded_at is null على حساب _active/_existing في
-- الفرعين، فيُعامل الموسوم كغير المُسنَد أصلاً («الطلب غير مُسنَدٍ
-- إليك») — حتى لو كان له خيط قائم من قبل السحب، اتساقاً مع سحب
-- الاطّلاع الكامل. جواز الردّ في خيطٍ قائم يبقى كما هو لمن سلّم
-- عمله دون وسم (submitted_at مثبَت وsuperseded_at فارغ).
--
-- (إعادة التعريف على أحدث نسخة كاملة من القاعدة — التعريف الوحيد
-- السابق في 20260716000001 ومطابق لما في القاعدة الحيّة.)
-- ============================================================

create or replace function public.send_leader_message(_case_id uuid, _leader text, _body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _role app_role; _ref text; _active boolean; _existing boolean; _id uuid;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if _leader not in ('deputy','chair') then raise exception 'قائد غير معروف'; end if;
  if coalesce(btrim(_body),'') = '' then raise exception 'رسالة فارغة'; end if;

  if has_role(_uid,'studier') then
    _role := 'studier';
    select bool_or(s.submitted_at is null), count(*) > 0 into _active, _existing
      from studies s where s.case_id = _case_id and s.studier_id = _uid
        and s.superseded_at is null;
  elsif has_role(_uid,'evaluator') then
    _role := 'evaluator';
    select bool_or(a.submitted_at is null), count(*) > 0 into _active, _existing
      from assessments a where a.case_id = _case_id and a.evaluator_id = _uid
        and a.superseded_at is null;
  else
    raise exception 'forbidden: not studier/evaluator';
  end if;

  if not coalesce(_existing,false) then raise exception 'الطلب غير مُسنَدٍ إليك'; end if;
  -- بدء خيطٍ جديد على طلبٍ نشطٍ فقط؛ الردّ في خيطٍ قائمٍ جائز
  if not coalesce(_active,false) and not exists (
    select 1 from leadership_messages m
    where m.case_id = _case_id and m.author_id = _uid and m.leader = _leader
  ) then
    raise exception 'المكتمل لا يُفتح له خيط مراسلة';
  end if;

  insert into leadership_messages (case_id, author_id, author_role, leader, direction, body)
  values (_case_id, _uid, _role, _leader, 'out', _body)
  returning id into _id;

  select ref_no into _ref from protection_cases where id = _case_id;
  insert into audit_log (actor_id, action, target) values (_uid, 'leader_message', _ref);
  return _id;
end $$;
