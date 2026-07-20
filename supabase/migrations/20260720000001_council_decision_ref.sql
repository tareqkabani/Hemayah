-- ============================================================
--  رقم قرار المركز D-YYYY-NNNN — 20 يوليو 2026
--  كان قرار المركز بلا رقمٍ ظاهر (فارقٌ موثَّق عن مرجع بوابة المكتب الفني).
--  1) council_decisions.ref يتولّد عند الإصدار (issued_at) بتسلسلٍ سنويّ.
--  2) استيفاء الصفوف الصادرة القائمة.
--  3) grievances.decision_ref (العمود القائم بلا مصدر) يُستوفى عند ورود
--     التظلّم من قرار قضيّته — فيظهر «رقم القرار محل التظلّم» بسندٍ فعلي.
-- ============================================================

alter table council_decisions add column if not exists ref text unique;

create sequence if not exists council_ref_seq start 470;
create or replace function public._next_decision_ref() returns text
language sql volatile set search_path = public as $$
  select 'D-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('council_ref_seq')::text, 4, '0');
$$;
revoke execute on function public._next_decision_ref() from public, anon, authenticated;

-- الرقم يُختم لحظة الإصدار — إدراجاً كان أو انتقالاً إليه
create or replace function public._council_decision_ref() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.issued_at is not null and new.ref is null then
    new.ref := _next_decision_ref();
  end if;
  return new;
end $$;
drop trigger if exists trg_council_decision_ref on council_decisions;
create trigger trg_council_decision_ref before insert or update on council_decisions
  for each row execute function public._council_decision_ref();

-- استيفاء الصادر القائم
update council_decisions set ref = _next_decision_ref() where issued_at is not null and ref is null;

-- التظلّم يحمل رقم القرار محل الاعتراض منذ وروده
create or replace function public._grievance_intake() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.ref is null then new.ref := _next_grv_ref(); end if;
  if new.filed_at is null then new.filed_at := now(); end if;
  if new.decision_due is null then new.decision_due := new.filed_at + interval '10 days'; end if;
  if new.scope is null then
    new.scope := case when coalesce(new.against,'') like '%نوع%' or coalesce(new.against,'') like 'types%'
                      then 'types' else 'reject' end;
  end if;
  if new.decision_ref is null then
    select cd.ref into new.decision_ref from council_decisions cd
    where cd.case_id = new.case_id and cd.issued_at is not null;
  end if;
  if new.assigned_to is null then
    new.assigned_to := pick_grievance_advisor();
    new.assigned_at := now();
  end if;
  return new;
end $$;

update grievances g set decision_ref = cd.ref
from council_decisions cd
where cd.case_id = g.case_id and cd.issued_at is not null and g.decision_ref is null;
