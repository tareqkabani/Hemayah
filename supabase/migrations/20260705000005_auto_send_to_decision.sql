-- ============================================================
--  إصلاح فجوة خطّ الأنابيب — التجميع الآليّ للمجلس (م4/8)
--  كان: بعد اعتماد الدراسة والتقييم لا يوجد مُطلِقٌ لـsend_to_decision في الواجهة،
--  فتعلق القضية في under_study ولا تصل لمعدّ القرار. التصميم ينصّ على تجميعٍ آليّ.
--  الإصلاح: مُشغِّل (trigger) على studies/assessments ينقل للقرار آلياً متى اكتمل الاثنان.
-- ============================================================

create or replace function public._auto_send_to_decision()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare _ns int; _na int; _cur case_status; _ref text;
begin
  select status, ref_no into _cur, _ref from protection_cases where id = NEW.case_id;
  if _cur is distinct from 'under_study' then return NEW; end if;
  select count(*) into _ns from studies     where case_id = NEW.case_id and submitted_at is not null;
  select count(*) into _na from assessments where case_id = NEW.case_id and submitted_at is not null;
  if _ns >= 1 and _na >= 1 then
    update protection_cases set status = 'in_decision', updated_at = now() where id = NEW.case_id;
    insert into council_decisions (case_id, status) values (NEW.case_id, 'preparing')
      on conflict (case_id) do nothing;
    insert into audit_log (actor_id, action, target)
      values (auth.uid(), 'auto_send_to_decision', _ref);
  end if;
  return NEW;
end $$;

drop trigger if exists trg_study_to_decision on studies;
create trigger trg_study_to_decision after insert or update on studies
  for each row execute function _auto_send_to_decision();

drop trigger if exists trg_assessment_to_decision on assessments;
create trigger trg_assessment_to_decision after insert or update on assessments
  for each row execute function _auto_send_to_decision();

-- ── تعبئة رجعيّة: قضايا under_study لها دراسةٌ وتقييمٌ مُعتمَدان → in_decision ──
insert into council_decisions (case_id, status)
  select pc.id, 'preparing' from protection_cases pc
  where pc.status = 'under_study'
    and exists (select 1 from studies s     where s.case_id = pc.id and s.submitted_at is not null)
    and exists (select 1 from assessments a where a.case_id = pc.id and a.submitted_at is not null)
  on conflict (case_id) do nothing;

update protection_cases pc set status = 'in_decision', updated_at = now()
  where pc.status = 'under_study'
    and exists (select 1 from studies s     where s.case_id = pc.id and s.submitted_at is not null)
    and exists (select 1 from assessments a where a.case_id = pc.id and a.submitted_at is not null);
