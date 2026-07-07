-- ============================================================
--  إشعارات الداخلية (moi) على Supabase — من دورة الطلب الأجنبيّ.
--  مُشغّلٌ يولّد إشعار موظّفٍ حقيقيّاً (authority='moi') عند ورود طلبٍ أجنبيّ
--  وعند بتّ النائب العام؛ يقرأها الموظّف عبر staff_notif_read (has_authority).
-- ============================================================

create or replace function public._notify_moi_foreign() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if tg_op = 'INSERT' then
    insert into notifications (case_id, authority, type, title, body, target_tab, sent_at)
    values (new.case_id, 'moi', 'foreign_in', 'طلبٌ أجنبيٌّ جديد وارد',
      'المرجع ' || coalesce(new.ref,'') || ' — ' || coalesce(new.country,'') || '. يلزم التسجيل والإحالة.',
      'incoming', now());
  elsif tg_op = 'UPDATE' and coalesce(new.pg_decision,'') is distinct from coalesce(old.pg_decision,'')
        and coalesce(new.pg_decision,'') <> '' then
    insert into notifications (case_id, authority, type, title, body, target_tab, sent_at)
    values (new.case_id, 'moi',
      case when new.pg_decision = 'approved' then 'foreign_ok' else 'foreign_no' end,
      'قرار النائب العام — ' || case when new.pg_decision = 'approved' then 'موافقة' else 'اعتذار مسبّب' end,
      'المرجع ' || coalesce(new.ref,'') || ' (' || coalesce(new.country,'') || '). يلزم تبليغ السلطة الأجنبية.',
      'incoming', now());
  end if;
  return new;
end $$;

drop trigger if exists trg_notify_moi_foreign_ins on foreign_requests;
create trigger trg_notify_moi_foreign_ins after insert on foreign_requests
  for each row execute function public._notify_moi_foreign();
drop trigger if exists trg_notify_moi_foreign_upd on foreign_requests;
create trigger trg_notify_moi_foreign_upd after update on foreign_requests
  for each row execute function public._notify_moi_foreign();

-- تعبئةٌ أوّليّة: إشعارٌ لكلّ طلبٍ أجنبيٍّ قائمٍ لا إشعار له (لتظهر البوّابة بمحتوى حقيقيّ).
insert into notifications (case_id, authority, type, title, body, target_tab, sent_at, created_at)
select fr.case_id, 'moi', 'foreign_in', 'طلبٌ أجنبيٌّ وارد',
  'المرجع ' || coalesce(fr.ref,'') || ' — ' || coalesce(fr.country,'') || '.', 'incoming', fr.created_at, fr.created_at
from foreign_requests fr
where not exists (select 1 from notifications n where n.case_id = fr.case_id and n.authority = 'moi');

-- الداخلية (moi): قراءة/كتابة قضايا ورسائل طلباتها الأجنبيّة (لا referrals لها).
drop policy if exists staff_case_read on protection_cases;
create policy staff_case_read on protection_cases for select using (
  exists (select 1 from referrals r where r.case_id = protection_cases.id and has_authority(r.authority))
  or (has_authority('moi') and exists (select 1 from foreign_requests f where f.case_id = protection_cases.id)));
drop policy if exists staff_msg_read on messages;
create policy staff_msg_read on messages for select using (
  exists (select 1 from referrals r where r.case_id = messages.case_id and has_authority(r.authority))
  or (has_authority('moi') and exists (select 1 from foreign_requests f where f.case_id = messages.case_id)));
drop policy if exists staff_msg_write on messages;
create policy staff_msg_write on messages for insert with check (
  thread = 'body' and (
    exists (select 1 from referrals r where r.case_id = messages.case_id and has_authority(r.authority))
    or (has_authority('moi') and exists (select 1 from foreign_requests f where f.case_id = messages.case_id))));
