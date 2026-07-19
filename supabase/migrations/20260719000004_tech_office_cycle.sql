-- ============================================================
--  بوابة المكتب الفني — دورة التظلّم الثنائية (م21) — 19 يوليو 2026
--  «المستشار يقرّر والمدير يعتمد»:
--  1) توسعة grievances: مرجع GRV-YYYY-NNNN · محل الاعتراض · أسباب المتظلّم ·
--     الإسناد لمستشار · قرار المستشار المستقلّ (jsonb) · اعتماد المكتب (jsonb) ·
--     سجلّ الإعادات. المهلة 10 أيام قائمة في decision_due (م21).
--  2) الإسناد الآليّ بالأقلّ عبئاً (نمط assign_study_eval) — مُشغّل قبل الإدراج.
--  3) عزل RLS متبادل: المستشار يرى المُسنَد إليه فقط؛ المدير يرى الكلّ؛
--     الكتابة عبر RPCs حصراً (SECURITY DEFINER — درس fix_grievance_rls_recursion).
--  4) ملف التظلّم المجمّع: قراءة القضية/التوصية/الدراسات/قرار المركز للمكتب
--     ضمن نطاق تظلّمٍ يخصّه — الهوية بالرمز السريّ حصراً (لا subjects ولا requests).
--  5) كل قرارٍ/اعتمادٍ/إعادةٍ/كشف رمزٍ = صفّ audit_log منسوبٌ لصاحبه (م15/16).
--  6) قبول التظلّم = سجلّ مشمول: القضية إلى 'accepted' فتظهر في «الوارِدون
--     للتنفيذ» (sign_agreement القائمة) — إغلاق الحلقة عبر Realtime المنشور.
-- ============================================================

-- ─────────────────── 1) توسعة الجدول ───────────────────
alter table grievances add column if not exists ref               text unique;
alter table grievances add column if not exists scope             text
  check (scope in ('reject','types'));
alter table grievances add column if not exists applicant_reason  text;
alter table grievances add column if not exists decision_ref      text;
alter table grievances add column if not exists assigned_to       uuid references auth.users(id);
alter table grievances add column if not exists assigned_at       timestamptz;
alter table grievances add column if not exists advisor_decision  jsonb;
alter table grievances add column if not exists office_decision   jsonb;
alter table grievances add column if not exists return_log        jsonb not null default '[]'::jsonb;
create index if not exists idx_grievances_assigned on grievances (assigned_to, filed_at desc);

-- مرجع تسلسليّ GRV-YYYY-NNNN
create sequence if not exists grv_ref_seq start 190;
create or replace function public._next_grv_ref() returns text
language sql volatile set search_path = public as $$
  select 'GRV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('grv_ref_seq')::text, 4, '0');
$$;

-- ─────────────────── 2) الإسناد الآليّ بالأقلّ عبئاً ───────────────────
-- العبء = التظلّمات المفتوحة المُسنَدة (لا اعتماد مكتبٍ بعد).
create or replace function public.pick_grievance_advisor() returns uuid
language sql stable security definer set search_path = public as $$
  select ur.user_id from user_roles ur
  where ur.role = 'advisor'
  order by (select count(*) from grievances g
            where g.assigned_to = ur.user_id and g.office_decision is null) asc,
           ur.user_id asc
  limit 1;
$$;

-- استيفاء صفّ التظلّم عند الورود: المرجع + المهلة (م21) + الإسناد.
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
  if new.assigned_to is null then
    new.assigned_to := pick_grievance_advisor();
    new.assigned_at := now();
  end if;
  return new;
end $$;
drop trigger if exists trg_grievance_intake on grievances;
create trigger trg_grievance_intake before insert on grievances
  for each row execute function public._grievance_intake();

-- استيفاء دفاعيّ للصفوف القائمة (إن وُجدت)
update grievances set ref = _next_grv_ref() where ref is null;
update grievances set scope = case when coalesce(against,'') like '%نوع%' then 'types' else 'reject' end
  where scope is null;
update grievances g set assigned_to = pick_grievance_advisor(), assigned_at = now()
  where g.assigned_to is null and g.status in ('filed','tech_review');

-- ─────────────────── 3) إشعارات الورود بالمستلِم ───────────────────
-- تحلّ محلّ بثّ authority='technical' العامّ: إشعارٌ للمستشار المُسنَد (+مهلة crit)
-- وإشعارٌ لكلّ مديرٍ بالورود — recipient_id (نمط بوابتَي الدارس/المقيّم).
create or replace function public._scope_ar(_scope text) returns text
language sql immutable as $$
  select case _scope when 'types' then 'الاعتراض على أنواع الحماية المقرّرة'
                     else 'الاعتراض على رفض الطلب' end;
$$;

create or replace function public._notify_grievance_intake() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare _c record;
begin
  select secret_code, category into _c from protection_cases where id = new.case_id;

  if new.assigned_to is not null then
    insert into notifications (case_id, recipient_id, type, title, body, target_tab, sent_at)
    values (new.case_id, new.assigned_to, 'assign',
      'تظلّم مُسنَد إليك — ' || new.ref,
      coalesce(_c.secret_code,'') || ' — ' || category_ar(_c.category) || ' · ' || _scope_ar(new.scope)
        || '. أُسنِد إليك آلياً حسب العبء — بانتظار قرارك المستقلّ.',
      'cases', now());
    insert into notifications (case_id, recipient_id, type, title, body, target_tab, crit, sent_at)
    values (new.case_id, new.assigned_to, 'deadline',
      'مهلة البتّ الجارية — ' || new.ref,
      'يُبتّ في التظلّم خلال (10) أيام من رفعه (م21) — أصدر قرارك المستقلّ قبل انقضائها.',
      'cases', true, now());
  end if;

  insert into notifications (case_id, recipient_id, type, title, body, target_tab, sent_at)
  select new.case_id, ur.user_id, 'incoming',
    'تظلّم وارد جديد — ' || new.ref,
    coalesce(_c.secret_code,'') || ' — ' || category_ar(_c.category) || ' · ' || _scope_ar(new.scope)
      || '. أُسنِد آلياً حسب العبء؛ تجري مهلة (10) أيام (م21).',
    'cases', now()
  from user_roles ur where ur.role = 'tech_manager';
  return new;
end $$;
drop trigger if exists trg_notify_tech_grievance on grievances;
drop trigger if exists trg_notify_grievance_intake on grievances;
create trigger trg_notify_grievance_intake after insert on grievances
  for each row execute function public._notify_grievance_intake();

-- ─────────────────── 4) عزل RLS المتبادل ───────────────────
-- مساعد SECURITY DEFINER: هل للمستخدم تظلّمٌ مُسنَدٌ على هذه القضية؟
create or replace function public.is_assigned_grievance(_case_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from grievances g
    where g.case_id = _case_id and g.assigned_to = auth.uid());
$$;

-- كانت القراءة/الكتابة مفتوحةً للمكتب كلّه (has_authority('technical')) — تُستبدل:
drop policy if exists grievance_tech_read on grievances;
drop policy if exists grievance_tech_write on grievances;

create policy grievance_advisor_read on grievances for select
  using (assigned_to = auth.uid());
create policy grievance_head_read on grievances for select
  using (has_role(auth.uid(), 'tech_manager'));
-- (تبقى: grievance_ag_read اطّلاعاً · سياسات طالب الحماية insert/select ·
--  ولا سياسة تحديثٍ مباشرةً — القرارات عبر RPCs أدناه حصراً.)

-- القضية المرتبطة: المستشار ضمن المُسنَد إليه فقط، والمدير/النائب بوجود تظلّم.
drop policy if exists staff_case_read on protection_cases;
create policy staff_case_read on protection_cases for select using (
  exists (select 1 from referrals r where r.case_id = protection_cases.id and has_authority(r.authority))
  or (has_authority('moi') and exists (select 1 from foreign_requests f where f.case_id = protection_cases.id))
  or (has_authority('competent') and exists (select 1 from recommendations rc where rc.case_id = protection_cases.id))
  or ((has_role(auth.uid(), 'tech_manager') or has_authority('ag')) and case_has_grievance(protection_cases.id))
  or is_assigned_grievance(protection_cases.id));

-- ملف التظلّم المجمّع: التوصية والدراسات والتقييمات وقرار المركز — ضمن النطاق ذاته.
drop policy if exists tech_grv_rec_read on recommendations;
create policy tech_grv_rec_read on recommendations for select using (
  is_assigned_grievance(case_id)
  or (has_role(auth.uid(), 'tech_manager') and case_has_grievance(case_id)));
drop policy if exists tech_grv_study_read on studies;
create policy tech_grv_study_read on studies for select using (
  is_assigned_grievance(case_id)
  or (has_role(auth.uid(), 'tech_manager') and case_has_grievance(case_id)));
drop policy if exists tech_grv_assessment_read on assessments;
create policy tech_grv_assessment_read on assessments for select using (
  is_assigned_grievance(case_id)
  or (has_role(auth.uid(), 'tech_manager') and case_has_grievance(case_id)));
drop policy if exists tech_grv_decision_read on council_decisions;
create policy tech_grv_decision_read on council_decisions for select using (
  is_assigned_grievance(case_id)
  or (has_role(auth.uid(), 'tech_manager') and case_has_grievance(case_id)));

-- ─────────────────── 5) قرار المستشار المستقلّ ───────────────────
create or replace function public._actor_name(_uid uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(u.raw_user_meta_data->>'name', u.email, 'موظف المكتب الفني')
  from auth.users u where u.id = _uid;
$$;

create or replace function public.advisor_decide_grievance(
  _grievance_id uuid, _decision text, _types jsonb, _reason text
) returns void language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _g record;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid, 'advisor') then raise exception 'forbidden: not advisor'; end if;
  if _decision not in ('support','reject_grievance') then raise exception 'قرار غير معروف'; end if;
  if coalesce(btrim(_reason),'') = '' then raise exception 'التسبيب إلزاميّ'; end if;
  if _decision = 'support' and jsonb_array_length(coalesce(_types,'[]'::jsonb)) = 0 then
    raise exception 'حدّد أنواع الحماية المقترحة (م14) عند تأييد التظلّم';
  end if;

  select * into _g from grievances where id = _grievance_id for update;
  if _g.id is null then raise exception 'تظلّم غير موجود'; end if;
  if _g.assigned_to is distinct from _uid then raise exception 'forbidden: not assigned'; end if;
  if _g.office_decision is not null then raise exception 'بتّ المكتب صدر — لا تعديل بعده'; end if;
  if _g.advisor_decision is not null then raise exception 'قرارك مُدلًى به — بانتظار اعتماد المكتب'; end if;

  update grievances set
    advisor_decision = jsonb_build_object(
      'decision', _decision, 'types', coalesce(_types,'[]'::jsonb),
      'reason', btrim(_reason), 'by', _actor_name(_uid), 'by_id', _uid, 'on', now()),
    status = 'tech_review'
  where id = _grievance_id;

  insert into audit_log (actor_id, action, target)
  values (_uid, 'grievance_advisor_decision', _g.ref);

  insert into notifications (case_id, recipient_id, type, title, body, target_tab, sent_at)
  select _g.case_id, ur.user_id, 'decision',
    'قرّر المستشار — بانتظار اعتمادك',
    'أدلى ' || _actor_name(_uid) || ' بقراره المستقلّ في التظلّم ' || _g.ref
      || ' (' || case _decision when 'support' then 'تأييد التظلّم' else 'تأييد قرار المركز' end
      || ') — راجِعه واعتمد بتّ المكتب.',
    'cases', now()
  from user_roles ur where ur.role = 'tech_manager';
end $$;

-- ─────────────────── 6) إعادة المدير للمستشار ───────────────────
-- المدير لا يعدّل قرار المستشار — يعتمده أو يعيده مسبَّباً؛ الإعادة تؤرشف القرار.
create or replace function public.office_return_grievance(_grievance_id uuid, _note text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _g record;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid, 'tech_manager') then raise exception 'forbidden: not tech_manager'; end if;
  if coalesce(btrim(_note),'') = '' then raise exception 'سبب الإعادة إلزاميّ'; end if;

  select * into _g from grievances where id = _grievance_id for update;
  if _g.id is null then raise exception 'تظلّم غير موجود'; end if;
  if _g.office_decision is not null then raise exception 'بتّ المكتب صدر'; end if;
  if _g.advisor_decision is null then raise exception 'لا قرار مستشارٍ يُعاد'; end if;

  update grievances set
    return_log = return_log || jsonb_build_object(
      'advisor_decision', advisor_decision, 'note', btrim(_note),
      'by', _actor_name(_uid), 'by_id', _uid, 'at', now()),
    advisor_decision = null,
    status = 'filed'
  where id = _grievance_id;

  insert into audit_log (actor_id, action, target) values (_uid, 'grievance_return', _g.ref);

  insert into notifications (case_id, recipient_id, type, title, body, target_tab, sent_at)
  values (_g.case_id, _g.assigned_to, 'return',
    'أعاد المدير التظلّم ' || _g.ref || ' لدراستك',
    'سبب الإعادة: ' || btrim(_note) || ' — أعد الدراسة وأصدر قرارك ضمن المهلة الجارية (م21).',
    'cases', now());
end $$;

-- ─────────────────── 7) اعتماد المكتب — البتّ النهائي ───────────────────
create or replace function public.office_adopt_grievance(
  _grievance_id uuid, _outcome text, _types jsonb, _reason text
) returns void language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _g record; _sec text;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid, 'tech_manager') then raise exception 'forbidden: not tech_manager'; end if;
  if _outcome not in ('accept','reject') then raise exception 'بتّ غير معروف'; end if;
  if coalesce(btrim(_reason),'') = '' then raise exception 'حيثيات الاعتماد إلزاميّة'; end if;
  if _outcome = 'accept' and jsonb_array_length(coalesce(_types,'[]'::jsonb)) = 0 then
    raise exception 'حدّد أنواع الحماية المقرّرة (م14) عند قبول التظلّم';
  end if;

  select * into _g from grievances where id = _grievance_id for update;
  if _g.id is null then raise exception 'تظلّم غير موجود'; end if;
  if _g.office_decision is not null then raise exception 'بتّ المكتب صدر — نهائيٌّ غير قابلٍ للطعن (م21)'; end if;
  if _g.advisor_decision is null then raise exception 'يُعتمد البتّ بعد ورود قرار المستشار المستقلّ'; end if;

  update grievances set
    office_decision = jsonb_build_object(
      'outcome', _outcome, 'types', coalesce(_types,'[]'::jsonb),
      'reason', btrim(_reason), 'by', _actor_name(_uid), 'by_id', _uid, 'on', now()),
    status = case _outcome when 'accept' then 'upheld'::grievance_status else 'dismissed'::grievance_status end,
    outcome = _outcome,
    tech_opinion = btrim(_reason)
  where id = _grievance_id;
  -- (تحديث status يُشعِل مُشغّل إشعار المتظلّم القائم _notify_seeker_grievance فوراً)

  insert into audit_log (actor_id, action, target)
  values (_uid, 'grievance_office_decision', _g.ref);

  -- إشعار المستشار المُسنَد باعتماد بتّ مكتبه
  if _g.assigned_to is not null then
    insert into notifications (case_id, recipient_id, type, title, body, target_tab, sent_at)
    values (_g.case_id, _g.assigned_to, 'status',
      'اعتُمد بتّ المكتب في ' || _g.ref,
      case _outcome when 'accept' then 'اعتمد المكتب قبول التظلّم — يُشمل المتقدّم مباشرةً دون العودة للدراسة (م21).'
                    else 'اعتمد المكتب رفض التظلّم — القرار نهائي وأُشعِر أطرافه.' end,
      'cases', now());
  end if;

  -- إشعار المركز (منسّقو التظلّمات) بقرار المكتب النهائي
  select secret_code into _sec from protection_cases where id = _g.case_id;
  insert into notifications (case_id, recipient_id, type, title, body, target_tab, sent_at)
  select _g.case_id, ur.user_id, 'grievance_office',
    'بتّ المكتب الفني في التظلّم ' || _g.ref,
    coalesce(_sec,'') || ' — ' ||
      case _outcome when 'accept' then 'قُبِل التظلّم: يُشمل المتقدّم بالبرنامج مباشرةً ويؤول للتنفيذ.'
                    else 'رُفِض التظلّم: قرار المركز مؤيَّد، والقرار نهائي (م21).' end,
    'cases', now()
  from user_roles ur where ur.role = 'case_officer';

  -- قبول التظلّم = سجلّ مشمول: كإصدار قرار قبولٍ — القضية إلى 'accepted'
  -- فتدخل «الوارِدين للتنفيذ» وتُوقَّع اتفاقيتها عبر sign_agreement القائمة.
  if _outcome = 'accept' then
    insert into board_decisions (case_id, type, justification, decided_at)
    values (_g.case_id, 'accept', 'قبول التظلّم (م21) — بتّ المكتب الفني نيابةً عن النائب العام: ' || btrim(_reason), now());
    update protection_cases set status = 'accepted', updated_at = now() where id = _g.case_id;
  end if;
end $$;

-- ─────────────────── 8) كشف الرمز = حدث تدقيق (توسعة) ───────────────────
-- إضافة المكتب الفني: المستشار ضمن المُسنَد إليه، والمدير بوجود تظلّم.
create or replace function public.record_secret_reveal(_case_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _ref text;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not (
    is_assigned_study(_case_id) or is_assigned_assessment(_case_id)
    or has_role(_uid, 'case_officer')
    or has_role(_uid, 'deputy_chair') or has_role(_uid, 'board_chair')
    or is_assigned_grievance(_case_id)
    or (has_role(_uid, 'tech_manager') and case_has_grievance(_case_id))
  ) then
    raise exception 'forbidden: not assigned';
  end if;
  select ref_no into _ref from protection_cases where id = _case_id;
  if _ref is null then raise exception 'قضية غير موجودة.'; end if;
  insert into audit_log (actor_id, action, target) values (_uid, 'secret_reveal', _ref);
end $$;

-- ─────────────────── 9) الصلاحيات ───────────────────
grant execute on function public.advisor_decide_grievance(uuid, text, jsonb, text) to authenticated;
grant execute on function public.office_return_grievance(uuid, text) to authenticated;
grant execute on function public.office_adopt_grievance(uuid, text, jsonb, text) to authenticated;
grant execute on function public.record_secret_reveal(uuid) to authenticated;
-- الإسناد يُطلقه المُشغّل حصراً
revoke execute on function public.pick_grievance_advisor() from public, anon, authenticated;
revoke execute on function public._next_grv_ref() from public, anon, authenticated;
