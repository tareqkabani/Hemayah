-- ============================================================
--  (ز) دورة الحماية العاجلة (المادة الثامنة) — حقيقيّةٌ كاملة.
--  المُنتِج: الإدارة الأمنية ترفع بلاغاً عاجلاً على قضيّةٍ تخصّها (raise_urgent)
--    → مُشغّلٌ يُشعِر النائب العام → يبتّ (approve_urgent):
--       قبول: حمايةٌ مؤقّتة (imminent_protections) + القضيّة تصير active (تتدفّق للتنفيذ حيّاً)
--             + إشعار طالب الحماية والمركز؛ رفض: إشعارٌ بالاعتذار.
--  التفاصيل الغنيّة تُخزَّن في emergency_reports.escalation (jsonb) — يملؤها المُنتِج، لا تلفيق.
-- ============================================================

alter table emergency_reports enable row level security;
alter table imminent_protections enable row level security;

-- ── RLS ──
-- الإدارة الأمنية: تقرأ بلاغاتها (قضايا لها إحالةٌ أمنيّة). النائب العام: يقرأ الكل.
drop policy if exists emergency_security_read on emergency_reports;
create policy emergency_security_read on emergency_reports for select using (
  has_authority('security') and exists (select 1 from referrals r where r.case_id = emergency_reports.case_id and r.authority = 'security'));
drop policy if exists emergency_ag_read on emergency_reports;
create policy emergency_ag_read on emergency_reports for select using (has_authority('ag'));
-- الكتابة تتمّ حصراً عبر دوالّ SECURITY DEFINER أدناه (لا insert/update مباشر).

drop policy if exists imminent_ag_read on imminent_protections;
create policy imminent_ag_read on imminent_protections for select using (has_authority('ag'));
drop policy if exists imminent_center_read on imminent_protections;
create policy imminent_center_read on imminent_protections for select using (
  exists (select 1 from user_roles ur where ur.user_id = auth.uid()
    and ur.role in ('case_officer','board_chair','deputy_chair','board_member')));

-- ── مُنتِج: الإدارة الأمنية ترفع بلاغاً عاجلاً على قضيّةٍ تخصّها ──
create or replace function public.raise_urgent(_case_id uuid, _escalation jsonb) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare _id uuid;
begin
  if not (has_authority('security') and exists (select 1 from referrals r where r.case_id = _case_id and r.authority = 'security')) then
    raise exception 'not authorized to raise urgent for this case';
  end if;
  insert into emergency_reports (case_id, reported_at, status, escalation)
    values (_case_id, now(), 'pending', coalesce(_escalation,'{}'::jsonb))
    returning id into _id;
  return _id;
end $$;

-- مُشغّل: إشعار النائب العام حقيقيّاً عند ورود بلاغٍ عاجل.
create or replace function public._notify_ag_urgent() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  insert into notifications (case_id, authority, type, title, body, target_tab, sent_at)
  values (new.case_id, 'ag', 'urgent_in', 'طلبٌ عاجلٌ بانتظار بتّكم الفوري',
    'بلاغٌ عاجلٌ (م8) — ' || coalesce(new.escalation->>'danger','خطرٌ وشيكٌ على الحياة') || ' يستوجب بتّاً فوريّاً.',
    'urgent', now());
  return new;
end $$;
drop trigger if exists trg_notify_ag_urgent on emergency_reports;
create trigger trg_notify_ag_urgent after insert on emergency_reports
  for each row execute function public._notify_ag_urgent();

-- ── النائب العام يبتّ في البلاغ العاجل ──
create or replace function public.approve_urgent(_emergency_id uuid, _approve boolean, _types text[], _days int, _reason text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare _case uuid;
begin
  if not has_authority('ag') then raise exception 'not authorized'; end if;
  select case_id into _case from emergency_reports where id = _emergency_id;
  if _case is null then raise exception 'emergency not found'; end if;

  if _approve then
    insert into imminent_protections (case_id, approver_id, max_duration, extended)
      values (_case, auth.uid(), make_interval(days => greatest(1, least(30, coalesce(_days,30)))), false);
    update protection_cases set status = 'active', updated_at = now() where id = _case;
    update emergency_reports set status = 'approved',
      escalation = coalesce(escalation,'{}'::jsonb) || jsonb_build_object('ruling',
        jsonb_build_object('outcome','approve','types', to_jsonb(_types),'days', _days,'reason', _reason))
      where id = _emergency_id;
    insert into notifications (case_id, authority, type, title, body, target_tab, sent_at)
      values (_case, null, 'urgent_approved', 'صدرت حمايةٌ عاجلةٌ لك',
        'وافق النائب العام على حمايتك المؤقّتة الفوريّة (م8)، وأُحيلت للمركز للتنفيذ.', null, now());
  else
    update emergency_reports set status = 'rejected',
      escalation = coalesce(escalation,'{}'::jsonb) || jsonb_build_object('ruling',
        jsonb_build_object('outcome','reject','reason', _reason))
      where id = _emergency_id;
    insert into notifications (case_id, authority, type, title, body, target_tab, sent_at)
      values (_case, null, 'urgent_rejected', 'قرارٌ في طلبك العاجل',
        'اعتُذر عن الطلب العاجل؛ يبقى المسار العادي متاحاً بتقديم طلبٍ وفق الإجراءات.', null, now());
  end if;
end $$;

-- ── Realtime ──
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='emergency_reports') then
    alter publication supabase_realtime add table emergency_reports;
  end if;
end $$;
alter table emergency_reports replica identity full;
