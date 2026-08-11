-- ============================================================
--  حزمة القرار بلا مفتاح خدمة — دالّتا قراءةٍ مقيَّدتان بدل service role
--
--  الفجوة: apps/decision/lib/dec-data.ts يفتح عميلَ خدمة (service role) داخل
--  عرض صفحةٍ خادميّة لثلاث قراءات:
--    1) auth.admin.listUsers({perPage:200}) لحلّ معرّفات المصوّتين إلى مقاعد،
--    2) subjects (الأعمدة غير المعرِّفة) لبطاقة «بيانات طالب الحماية»،
--    3) emergency_contacts.relationship لعلم حضور جهة الطوارئ.
--  ومفتاح الخدمة يتجاوز RLS كلياً: فالضمانة الوحيدة اليوم هي انضباط نصّ
--  الاستعلام نفسه — أيّ توسعةٍ سهوية لقائمة الأعمدة (full_name_enc مثلاً)
--  تنجح صامتةً بلا حارس. وlistUsers خاصةً تسحب **كل** المستخدمين — ومنهم
--  طالبو الحماية — إلى ذاكرة الصفحة لحاجةٍ لا تتجاوز سبعة مقاعد.
--
--  المعالجة على نمط execution_emergency_contact المعتمد (م15/16): دالّتا
--  SECURITY DEFINER تفحصان الأهلية وتُرجعان غير المعرِّف حصراً — فالحدّ
--  مفروضٌ في القاعدة لا في انضباط الشيفرة، ولا يبقى لمفتاح الخدمة موضع.
--
--  الأهلية: مقاعد المجلس (is_council) أو معدّ القرار (case_officer)، والقضية
--  في أطوار القرار وما بعدها (case_in_decision) — نظير co_decision_read.
-- ============================================================

-- ── 1) أطراف القضية غير المعرِّفة (بطاقة بيانات طالب الحماية) ──
--  لا عمود *_enc يغادر القاعدة: الاسم والهوية والتواصل وهاتف الطوارئ لا
--  تُذكر في قائمة الأعمدة أصلاً، فلا تُكشف ولو تغيّرت الشيفرة المستهلِكة.
create or replace function public.decision_case_parties(_case_ids uuid[])
returns table (
  case_id                uuid,
  subject_type           text,
  gender                 text,
  nationality            text,
  birth_date             date,
  marital_status         text,
  national_address       jsonb,
  employer               text,
  job_title              text,
  education_level        text,
  source_flags           jsonb,
  emergency_registered   boolean,
  emergency_relationship text
)
language plpgsql stable security definer set search_path = public as $$
declare _uid uuid := auth.uid();
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not (is_council(_uid) or has_role(_uid, 'case_officer')) then
    raise exception 'forbidden: not a decision-stage party';
  end if;

  return query
  select c.id,
         s.subject_type, s.gender, s.nationality, s.birth_date, s.marital_status,
         s.national_address, s.employer, s.job_title, s.education_level, s.source_flags,
         (e.id is not null) as emergency_registered,
         e.relationship
    from protection_cases c
    left join lateral (
      select * from subjects s2
       where s2.case_id = c.id and s2.subject_type = 'principal'
       order by s2.created_at limit 1) s on true
    left join lateral (
      select * from emergency_contacts e2
       where e2.case_id = c.id order by e2.created_at desc limit 1) e on true
   where c.id = any(_case_ids)
     and case_in_decision(c.id);
end $$;
revoke execute on function public.decision_case_parties(uuid[]) from public, anon;
grant execute on function public.decision_case_parties(uuid[]) to authenticated;

comment on function public.decision_case_parties(uuid[]) is
  'أطراف القضية غير المعرِّفة لحزمة القرار — الأعمدة المشفّرة لا تغادر القاعدة، والأهلية مقاعد المجلس أو معدّ القرار وقضيةٌ في أطوار القرار.';

-- ── 2) خريطة مقاعد المجلس (بدل auth.admin.listUsers) ──
--  تُرجع أصحاب أدوار المجلس والإعداد حصراً — لا طالبي حماية ولا سواهم.
create or replace function public.council_seat_map()
returns table (user_id uuid, email text)
language plpgsql stable security definer set search_path = public, auth as $$
declare _uid uuid := auth.uid();
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not (is_council(_uid) or has_role(_uid, 'case_officer')) then
    raise exception 'forbidden: not a decision-stage party';
  end if;

  return query
  select distinct u.id, u.email::text
    from auth.users u
    join user_roles ur on ur.user_id = u.id
   where ur.role in ('board_member', 'board_chair', 'deputy_chair');
end $$;
revoke execute on function public.council_seat_map() from public, anon;
grant execute on function public.council_seat_map() to authenticated;

comment on function public.council_seat_map() is
  'معرّفات وبُرد مقاعد المجلس لحلّ الأصوات والرسائل إلى مقاعدها — بديل listUsers التي كانت تسحب كل المستخدمين ومنهم طالبو الحماية.';
