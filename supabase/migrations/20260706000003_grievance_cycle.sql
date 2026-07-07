-- ============================================================
--  (هـ) دورة التظلّم كاملةً — من طالب الحماية إلى المكتب الفني والعودة إليه.
--  • طالب الحماية: يُقدّم تظلّماً على قضيّته (INSERT) ويتابع حالته (SELECT).
--  • المُشغّل القائم _notify_tech_grievance (INSERT) يُشعِر المكتب الفني.
--  • عند بتّ المكتب (status → upheld/dismissed): مُشغّلٌ يُشعِر طالبَ الحماية (إشعارٌ على مستوى القضيّة).
--  grievance_status: filed → tech_review → (pg_decision) → upheld | dismissed.
-- ============================================================

-- 1) RLS: طالب الحماية يُقدّم تظلّماً على قضيّته ويقرأ تظلّماته فقط.
drop policy if exists grievance_seeker_insert on grievances;
create policy grievance_seeker_insert on grievances for insert with check (
  exists (select 1 from protection_cases c where c.id = grievances.case_id and c.submitted_by = auth.uid()));
drop policy if exists grievance_seeker_read on grievances;
create policy grievance_seeker_read on grievances for select using (
  exists (select 1 from protection_cases c where c.id = grievances.case_id and c.submitted_by = auth.uid()));

-- 2) مُشغّل: إشعار طالب الحماية بنتيجة تظلّمه عند بتّ المكتب الفني.
create or replace function public._notify_seeker_grievance() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.status in ('upheld','dismissed') and new.status is distinct from old.status then
    insert into notifications (case_id, authority, type, title, body, target_tab, sent_at)
    values (new.case_id, null,
      case when new.status = 'upheld' then 'grievance_upheld' else 'grievance_dismissed' end,
      case when new.status = 'upheld' then 'قُبِل تظلّمك — أُعيد النظر في القرار'
           else 'صدر قرار التظلّم — القرار الأصلي مؤيَّد' end,
      coalesce(nullif(new.tech_opinion,''), 'أصدر المكتب الفني قراره في تظلّمك.'),
      null, now());
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_seeker_grievance on grievances;
create trigger trg_notify_seeker_grievance after update on grievances
  for each row execute function public._notify_seeker_grievance();

-- 3) بثٌّ حيٌّ لتغيّرات التظلّمات (كي تتحدّث بوّابتا الطرفين لحظيّاً).
do $$ begin
  if not exists (select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename='grievances') then
    alter publication supabase_realtime add table grievances;
  end if;
end $$;
alter table grievances replica identity full;
