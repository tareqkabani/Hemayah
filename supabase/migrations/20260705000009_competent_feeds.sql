-- ============================================================
--  إشعارات الجهات المختصة (competent) على Supabase — من دورة التوصية.
--  ملاحظة: القيمة 'competent' تُضاف لـenum referral_authority يدويّاً قبل هذه الهجرة
--  (alter type ... add value لا يصحّ داخل معاملة supabase db reset — يُدار منفصلاً).
--  triage عند 'refer' يُنشئ صفّ recommendations → مُشغّلٌ يولّد إشعار الجهة.
-- ============================================================

-- الجهة المختصة تقرأ قضايا توصياتها (الرمز/الفئة) — لعرض StaffNotifications/Messages.
drop policy if exists staff_case_read on protection_cases;
create policy staff_case_read on protection_cases for select using (
  exists (select 1 from referrals r where r.case_id = protection_cases.id and has_authority(r.authority))
  or (has_authority('moi') and exists (select 1 from foreign_requests f where f.case_id = protection_cases.id))
  or (has_authority('competent') and exists (select 1 from recommendations rc where rc.case_id = protection_cases.id)));

create or replace function public._notify_competent_new_rec() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare _sec text;
begin
  select secret_code into _sec from protection_cases where id = new.case_id;
  insert into notifications (case_id, authority, type, title, body, target_tab, sent_at)
  values (new.case_id, 'competent', 'rec_in', 'قضيّةٌ جديدة بانتظار توصيتك',
    'أُحيل الطلب ' || coalesce(_sec,'') || ' للجهة المختصة — ابدأ نموذج التوصية خلال 5 أيام (م6 لائحة).',
    'incoming', now());
  return new;
end $$;
drop trigger if exists trg_notify_competent_new_rec on recommendations;
create trigger trg_notify_competent_new_rec after insert on recommendations
  for each row execute function public._notify_competent_new_rec();

-- تعبئةٌ أوّليّة لتوصياتٍ قائمةٍ بلا إشعار.
insert into notifications (case_id, authority, type, title, body, target_tab, sent_at, created_at)
select rc.case_id, 'competent', 'rec_in', 'قضيّةٌ بانتظار توصيتك',
  'الطلب ' || coalesce(c.secret_code,'') || ' مُحالٌ للجهة المختصة — نموذج التوصية.', 'incoming', rc.created_at, rc.created_at
from recommendations rc join protection_cases c on c.id = rc.case_id
where not exists (select 1 from notifications n where n.case_id = rc.case_id and n.authority = 'competent');

-- سمة السلطة للمستخدم التجريبيّ للجهات المختصة.
update user_roles set attributes = coalesce(attributes,'{}'::jsonb) || '{"authority":"competent"}'::jsonb
where role = 'competent_body'
  and user_id = (select id from auth.users where email = '3000000001@nafath.local');
