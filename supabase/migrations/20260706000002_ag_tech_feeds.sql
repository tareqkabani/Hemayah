-- ============================================================
--  (د) تغذية بوّابتَي الإشراف الأعلى من البيانات الحقيقيّة:
--  • النائب العام (authority='ag'): يقرأ/يبتّ الطلبات الأجنبيّة (foreign_requests.pg_decision)
--    — وبتّه يُشعِل مُشغّل الداخلية القائم (تبليغ moi) فيصير تدفّقاً حيّاً بين البوّابتين.
--  • المكتب الفني (authority='technical'): يقرأ/يبتّ التظلّمات (grievances) — تُعرَض بصدقٍ فارغةً
--    حتى يوجد مصدرٌ يولّدها (لا بيانات مُلفّقة).
--  الإشعارات موسومةٌ بالسلطة وتُقرأ عبر staff_notif_read العامّة (has_authority).
-- ============================================================

-- 1) وسم مستخدمي الإشراف الأعلى بسلطتهم (كي يعمل عزل RLS والإشعارات).
update user_roles set attributes = coalesce(attributes,'{}'::jsonb) || '{"authority":"ag"}'::jsonb
  where role = 'prosecutor_general';
update user_roles set attributes = coalesce(attributes,'{}'::jsonb) || '{"authority":"technical"}'::jsonb
  where role in ('tech_manager','advisor');

-- 2) RLS: النائب العام يقرأ الطلبات الأجنبيّة ويبتّ فيها (pg_decision).
drop policy if exists foreign_ag_read on foreign_requests;
create policy foreign_ag_read on foreign_requests for select using (has_authority('ag'));
drop policy if exists foreign_ag_update on foreign_requests;
create policy foreign_ag_update on foreign_requests for update
  using (has_authority('ag')) with check (has_authority('ag'));

-- 3) RLS التظلّمات: المكتب الفني يقرأ/يبتّ؛ النائب العام يطّلع (تقارير فقط).
drop policy if exists grievance_tech_read on grievances;
create policy grievance_tech_read on grievances for select using (has_authority('technical'));
drop policy if exists grievance_tech_write on grievances;
create policy grievance_tech_write on grievances for update
  using (has_authority('technical')) with check (has_authority('technical'));
drop policy if exists grievance_ag_read on grievances;
create policy grievance_ag_read on grievances for select using (has_authority('ag'));

-- تحدّيات المركز (challenges): يكتبها المركز، ويقرؤها النائب العام في تقريره.
drop policy if exists challenge_ag_read on challenges;
create policy challenge_ag_read on challenges for select using (has_authority('ag'));

-- 4) مُشغّل: إشعار النائب العام حقيقيّاً عند إحالة طلبٍ أجنبيٍّ إليه للبتّ (status='sent').
create or replace function public._notify_ag_foreign() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.status = 'sent' and coalesce(new.pg_decision,'') = ''
     and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    insert into notifications (case_id, authority, type, title, body, target_tab, sent_at)
    values (new.case_id, 'ag', 'foreign_pg', 'طلبٌ أجنبيٌّ بانتظار بتّكم النهائي',
      'المرجع ' || coalesce(new.ref,'') || ' (' || coalesce(new.country,'') ||
      ') — رُفعت توصية المجلس؛ يلزم بتّكم وفق المعاملة بالمثل (م6).', 'foreign', now());
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_ag_foreign_ins on foreign_requests;
create trigger trg_notify_ag_foreign_ins after insert on foreign_requests
  for each row execute function public._notify_ag_foreign();
drop trigger if exists trg_notify_ag_foreign_upd on foreign_requests;
create trigger trg_notify_ag_foreign_upd after update on foreign_requests
  for each row execute function public._notify_ag_foreign();

-- 5) مُشغّل: إشعار المكتب الفني عند ورود تظلّمٍ جديد (حين يوجد مصدرٌ يولّدها).
create or replace function public._notify_tech_grievance() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  insert into notifications (case_id, authority, type, title, body, target_tab, sent_at)
  values (new.case_id, 'technical', 'grievance_in', 'تظلّمٌ جديد بانتظار البتّ',
    'وصل تظلّمٌ على ' || coalesce(new.against,'') || ' — راجِعه وأصدِر رأي المكتب الفني.',
    'reports', now());
  return new;
end $$;
drop trigger if exists trg_notify_tech_grievance on grievances;
create trigger trg_notify_tech_grievance after insert on grievances
  for each row execute function public._notify_tech_grievance();

-- 6) تعبئةٌ أوّليّة: إشعار النائب العام بكلّ طلبٍ أجنبيٍّ قائمٍ ينتظر بتّه (status='sent', لا قرار).
insert into notifications (case_id, authority, type, title, body, target_tab, sent_at, created_at)
select fr.case_id, 'ag', 'foreign_pg', 'طلبٌ أجنبيٌّ بانتظار بتّكم النهائي',
  'المرجع ' || coalesce(fr.ref,'') || ' (' || coalesce(fr.country,'') || '). يلزم البتّ النهائي.',
  'foreign', fr.created_at, fr.created_at
from foreign_requests fr
where fr.status = 'sent' and coalesce(fr.pg_decision,'') = ''
  and not exists (select 1 from notifications n where n.case_id = fr.case_id and n.authority = 'ag');

-- 7) بثٌّ حيٌّ لتغيّرات الطلبات الأجنبيّة (كي تتحدّث بوّابة النائب لحظيّاً).
do $$ begin
  if not exists (select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename='foreign_requests') then
    alter publication supabase_realtime add table foreign_requests;
  end if;
end $$;
alter table foreign_requests replica identity full;
