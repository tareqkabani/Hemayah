-- ============================================================
--  منصّة «حماية» — عرضٌ موحّد لتفصيل قضيّة المستفيد (للتطبيق/الـAPI)
--  الجذر: قرار المجلس (council_decisions) محجوبٌ عن المستفيد بـ RLS
--  (مقصورٌ على المجلس/الموظفين)، فلا يستطيع التطبيق عرض «القبول/الرفض
--  والأنواع والمدّة» إلا محاكاةً. هذه الدالة SECURITY DEFINER تتحقّق من
--  مِلكيّة القضية (owns_case) وتُرجِع — في استدعاءٍ واحد — القضيّةَ وقرارها
--  المُصدَر (فقط بعد الإصدار) وآخر تظلّمٍ لها، دون كشف مداولات المجلس.
-- ============================================================

create or replace function public.seeker_case_view(_ref text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _cid  uuid;
  _case jsonb;
  _dec  jsonb;
  _grv  jsonb;
begin
  -- مِلكيّة القضية شرطٌ صريح (الدالة تتجاوز RLS، فنفرضها هنا).
  select id into _cid
  from protection_cases
  where ref_no = _ref and submitted_by = auth.uid();
  if _cid is null then
    return null;  -- غير موجودة أو ليست للمستفيد → تُترجَم 404 في الـAPI
  end if;

  select to_jsonb(x) into _case from (
    select ref_no, secret_code, status::text as status, category::text as category,
           classification, created_at, updated_at
    from protection_cases where id = _cid
  ) x;

  -- القرار يُكشَف للمستفيد فقط بعد الإصدار (لا مداولات ولا أصوات).
  select to_jsonb(d) into _dec from (
    select issued_type, issued_reason, issued_at, types, duration
    from council_decisions
    where case_id = _cid and issued_at is not null
    order by issued_at desc
    limit 1
  ) d;

  -- آخر تظلّمٍ للقضية (حالته ونتيجته) — بيانات المستفيد نفسه.
  select to_jsonb(g) into _grv from (
    select status::text as status, outcome, against, filed_at, decision_due, tech_opinion
    from grievances
    where case_id = _cid
    order by filed_at desc
    limit 1
  ) g;

  return jsonb_build_object('case', _case, 'decision', _dec, 'grievance', _grv);
end $$;

grant execute on function public.seeker_case_view(text) to authenticated;
