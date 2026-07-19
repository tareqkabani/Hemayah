-- ============================================================
--  بوابتا الدارس والمقيّم — الطبقة البيانية للقشرة الموحّدة
--  (PORTAL-MATRIX §4/§5 · HANDOFF-STUDY-EVAL)
--  1) الإسناد الآليّ بالعبء: صفوف مبدئية في studies/assessments عند دخول
--     الحالة under_study — «كلٌّ يرى المُسنَد إليه فقط» بدل الطابور المشترك.
--  2) إشعارات بالمستلِم (recipient_id) بفئات assign/deadline/output/msg
--     مع ثبات القراءة — تحلّ محلّ seNotifRead-* في نموذج التصميم.
--  3) مراسلات مع قيادة المركز (نائب/رئيس): خيط معزول لكل (طلب، مؤلّف، قائد).
--  4) تفضيلات مستخدم (user_prefs) — تحلّ محلّ seSb-* لطيّ الجانبية.
--  5) كشف الرمز السري = حدث تدقيق (record_secret_reveal).
-- ============================================================

-- ─────────────────── مساعدات عرضٍ عربية (ثابتة) ───────────────────
create or replace function public.category_ar(_c app_category) returns text
language sql immutable as $$
  select case _c
    when 'reporter' then 'مبلّغ'
    when 'witness'  then 'شاهد'
    when 'expert'   then 'خبير'
    when 'victim'   then 'ضحية'
    else 'ذو صلة' end
$$;

create or replace function public.source_ar(_s case_source) returns text
language sql immutable as $$
  select case _s when 'urgent' then 'عاجل' when 'foreign' then 'أجنبي' else 'عادي' end
$$;

-- ─────────────────── عزل «المُسنَد إليه فقط» ───────────────────
-- SECURITY DEFINER لتفادي تكرار RLS (درس fix_grievance_rls_recursion).
create or replace function public.is_assigned_study(_case_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from studies s where s.case_id = _case_id and s.studier_id = auth.uid());
$$;

create or replace function public.is_assigned_assessment(_case_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from assessments a where a.case_id = _case_id and a.evaluator_id = auth.uid());
$$;

-- كان: طابور مشترك (كل حالات under_study مرئية للدورين). صار: المُسنَد إليه فقط.
drop policy if exists studier_under_study on protection_cases;
drop policy if exists studier_req on protection_requests;

create policy study_eval_assigned_case on protection_cases for select using (
  is_assigned_study(id) or is_assigned_assessment(id));
create policy study_eval_assigned_req on protection_requests for select using (
  is_assigned_study(case_id) or is_assigned_assessment(case_id));
-- التوصية الكاملة من الجهة (هوية محجوبة) + بطاقة المسار الأجنبي (م6) للمُسنَد إليه
create policy study_eval_assigned_rec on recommendations for select using (
  is_assigned_study(case_id) or is_assigned_assessment(case_id));
create policy study_eval_assigned_foreign on foreign_requests for select using (
  case_id is not null and (is_assigned_study(case_id) or is_assigned_assessment(case_id)));

-- ─────────────────── الإسناد الآليّ بالعبء ───────────────────
-- عبء المؤلّف = مهامّه المفتوحة (صفوف بلا submitted_at). يُسنَد الطلب
-- لأقلّ المؤلّفين عبئاً من كل دور — صفوف مبدئية تُستكمل عند الاعتماد.
create or replace function public.assign_study_eval(_case_id uuid, _per_role int default 2)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into studies (case_id, studier_id)
  select _case_id, x.user_id from (
    select ur.user_id,
      (select count(*) from studies s where s.studier_id = ur.user_id and s.submitted_at is null) as load
    from user_roles ur where ur.role = 'studier'
    order by load asc, ur.user_id asc
    limit _per_role
  ) x
  on conflict (case_id, studier_id) do nothing;

  insert into assessments (case_id, evaluator_id)
  select _case_id, x.user_id from (
    select ur.user_id,
      (select count(*) from assessments a where a.evaluator_id = ur.user_id and a.submitted_at is null) as load
    from user_roles ur where ur.role = 'evaluator'
    order by load asc, ur.user_id asc
    limit _per_role
  ) x
  on conflict (case_id, evaluator_id) do nothing;
end $$;

-- يُطلَق عند انتقال الحالة إلى under_study (قرار الفرز «study») — تحديثاً لا إدراجاً،
-- فالمسار النظاميّ يمرّ بالفرز دائماً؛ والبذور تُسنِد يدوياً حسب سيناريو العرض.
create or replace function public._assign_on_under_study() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'under_study' and old.status is distinct from new.status then
    perform assign_study_eval(new.id);
  end if;
  return new;
end $$;

drop trigger if exists trg_assign_study_eval on protection_cases;
create trigger trg_assign_study_eval after update of status on protection_cases
  for each row execute function _assign_on_under_study();

-- ─────────────────── إشعارات بالمستلِم ───────────────────
alter table notifications add column if not exists recipient_id uuid references auth.users(id) on delete cascade;
alter table notifications add column if not exists crit boolean not null default false;
create index if not exists idx_notif_recipient on notifications (recipient_id, created_at desc);

create policy notif_recipient_read on notifications for select using (recipient_id = auth.uid());
create policy notif_recipient_mark on notifications for update
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- إسنادٌ جديد → إشعار «assign»؛ والمسار العاجل معه إشعار مهلة crit مثبّت بمؤقّت.
create or replace function public._notify_study_eval_assign() returns trigger
language plpgsql security definer set search_path = public as $$
declare _c record; _recipient uuid; _output text;
begin
  if new.submitted_at is not null then return new; end if; -- مخرَجٌ مباشر لا إسناد
  select ref_no, secret_code, category, source into _c from protection_cases where id = new.case_id;
  if tg_table_name = 'studies' then _recipient := new.studier_id; _output := 'الدراسة';
  else _recipient := new.evaluator_id; _output := 'التقييم'; end if;

  insert into notifications (case_id, recipient_id, type, title, body, target_tab, sent_at)
  values (new.case_id, _recipient, 'assign',
    'طلب جديد أُسند إليك' || case when _c.source = 'foreign' then ' (أجنبي · م6)' else '' end,
    _c.secret_code || ' — ' || category_ar(_c.category) || ' · مسار ' || source_ar(_c.source)
      || case when _c.source = 'foreign' then ' · يُدرس كأي طلب بمبدأ المعاملة بالمثل ثم يبتّ فيه النائب العام.' else '.' end,
    'tasks', now());

  if _c.source = 'urgent' then
    insert into notifications (case_id, recipient_id, type, title, body, target_tab, crit, sent_at)
    values (new.case_id, _recipient, 'deadline',
      'اقتراب الميعاد النظامي — مسار عاجل',
      _c.secret_code || ' — ' || category_ar(_c.category) || ' · مسار عاجل. الإجراء المطلوب منك: إعداد '
        || _output || ' واعتماده اليوم (يوم عمل · م10).',
      'tasks', true, now());
  end if;
  return new;
end $$;

drop trigger if exists trg_notify_study_assign on studies;
create trigger trg_notify_study_assign after insert on studies
  for each row execute function _notify_study_eval_assign();
drop trigger if exists trg_notify_assessment_assign on assessments;
create trigger trg_notify_assessment_assign after insert on assessments
  for each row execute function _notify_study_eval_assign();

-- اعتماد المخرَج → إشعار «output» (استُقبل مخرَجك — التجميع الآليّ للمجلس).
create or replace function public._notify_study_eval_output() returns trigger
language plpgsql security definer set search_path = public as $$
declare _c record; _recipient uuid; _output text;
begin
  if old.submitted_at is not null or new.submitted_at is null then return new; end if;
  select ref_no, secret_code into _c from protection_cases where id = new.case_id;
  if tg_table_name = 'studies' then _recipient := new.studier_id; _output := 'دراستك';
  else _recipient := new.evaluator_id; _output := 'تقييمك'; end if;

  insert into notifications (case_id, recipient_id, type, title, body, target_tab, sent_at)
  values (new.case_id, _recipient, 'output', 'استُقبل مخرَجك',
    _c.secret_code || ' — أُرسل ' || _output || ' للتجميع الآلي تمهيداً لعرضه على المجلس.',
    'tasks', now());
  return new;
end $$;

drop trigger if exists trg_notify_study_output on studies;
create trigger trg_notify_study_output after update on studies
  for each row execute function _notify_study_eval_output();
drop trigger if exists trg_notify_assessment_output on assessments;
create trigger trg_notify_assessment_output after update on assessments
  for each row execute function _notify_study_eval_output();

-- ─────────────────── مراسلات قيادة المركز ───────────────────
-- خيط معزول لكل (طلب، مؤلّف، قائد) — الموظف يبدأ (لا «الرد فقط»)،
-- بالهوية الوظيفية، وكل رسالةٍ مسجّلة في التدقيق.
create table if not exists leadership_messages (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references protection_cases(id) on delete cascade,
  author_id   uuid not null references auth.users(id) on delete cascade,
  author_role app_role not null,
  leader      text not null check (leader in ('deputy','chair')),
  direction   text not null check (direction in ('out','in')), -- out: من الموظف · in: من القيادة
  body        text not null,
  read_at     timestamptz,                                      -- قراءة الموظف لرسائل القيادة
  created_at  timestamptz not null default now()
);
create index if not exists idx_leadership_msgs_thread
  on leadership_messages (author_id, case_id, leader, created_at);
alter table leadership_messages enable row level security;

create or replace function public.is_center_leader() returns boolean
language sql stable security definer set search_path = public as $$
  select has_role(auth.uid(),'board_chair') or has_role(auth.uid(),'deputy_chair');
$$;

-- الموظف: خيوطه فقط · القيادة: اطّلاع كامل وردٌّ وارد
create policy lm_author_read on leadership_messages for select using (author_id = auth.uid());
create policy lm_leader_read on leadership_messages for select using (is_center_leader());
create policy lm_leader_write on leadership_messages for insert
  with check (is_center_leader() and direction = 'in');

-- إرسال الموظف عبر دالة: تتحقّق من الإسناد والطلب النشط وتسجّل في التدقيق.
create or replace function public.send_leader_message(_case_id uuid, _leader text, _body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _role app_role; _ref text; _active boolean; _existing boolean; _id uuid;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if _leader not in ('deputy','chair') then raise exception 'قائد غير معروف'; end if;
  if coalesce(btrim(_body),'') = '' then raise exception 'رسالة فارغة'; end if;

  if has_role(_uid,'studier') then
    _role := 'studier';
    select bool_or(s.submitted_at is null), count(*) > 0 into _active, _existing
      from studies s where s.case_id = _case_id and s.studier_id = _uid;
  elsif has_role(_uid,'evaluator') then
    _role := 'evaluator';
    select bool_or(a.submitted_at is null), count(*) > 0 into _active, _existing
      from assessments a where a.case_id = _case_id and a.evaluator_id = _uid;
  else
    raise exception 'forbidden: not studier/evaluator';
  end if;

  if not coalesce(_existing,false) then raise exception 'الطلب غير مُسنَدٍ إليك'; end if;
  -- بدء خيطٍ جديد على طلبٍ نشطٍ فقط؛ الردّ في خيطٍ قائمٍ جائز
  if not coalesce(_active,false) and not exists (
    select 1 from leadership_messages m
    where m.case_id = _case_id and m.author_id = _uid and m.leader = _leader
  ) then
    raise exception 'المكتمل لا يُفتح له خيط مراسلة';
  end if;

  insert into leadership_messages (case_id, author_id, author_role, leader, direction, body)
  values (_case_id, _uid, _role, _leader, 'out', _body)
  returning id into _id;

  select ref_no into _ref from protection_cases where id = _case_id;
  insert into audit_log (actor_id, action, target) values (_uid, 'leader_message', _ref);
  return _id;
end $$;

-- فتح الخيط يصفّر عدّاده — ثبات القراءة في القاعدة لا الواجهة.
create or replace function public.mark_leader_thread_read(_case_id uuid, _leader text)
returns void language sql security definer set search_path = public as $$
  update leadership_messages set read_at = now()
  where case_id = _case_id and leader = _leader and author_id = auth.uid()
    and direction = 'in' and read_at is null;
$$;

-- رسالة قيادةٍ واردة → إشعار «msg».
create or replace function public._notify_leader_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare _secret text;
begin
  if new.direction <> 'in' then return new; end if;
  select secret_code into _secret from protection_cases where id = new.case_id;
  insert into notifications (case_id, recipient_id, type, title, body, target_tab, sent_at)
  values (new.case_id, new.author_id, 'msg',
    'رسالة من ' || case when new.leader = 'chair' then 'رئيس المركز' else 'نائب رئيس المركز' end,
    left(new.body, 140) || case when length(new.body) > 140 then '…' else '' end
      || ' — بشأن الطلب ' || _secret || '.',
    'messages', now());
  return new;
end $$;

drop trigger if exists trg_notify_leader_message on leadership_messages;
create trigger trg_notify_leader_message after insert on leadership_messages
  for each row execute function _notify_leader_message();

-- ─────────────────── تفضيلات المستخدم (بدل seSb-*) ───────────────────
create table if not exists user_prefs (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  prefs      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table user_prefs enable row level security;
create policy user_prefs_self on user_prefs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─────────────────── كشف الرمز السري = حدث تدقيق ───────────────────
create or replace function public.record_secret_reveal(_case_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _ref text;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not (is_assigned_study(_case_id) or is_assigned_assessment(_case_id)) then
    raise exception 'forbidden: not assigned';
  end if;
  select ref_no into _ref from protection_cases where id = _case_id;
  insert into audit_log (actor_id, action, target) values (_uid, 'secret_reveal', _ref);
end $$;

-- ─────────────────── مهامّي (عدّاد الأقران عبر definer) ───────────────────
-- الأقران على الطلب الواحد يظهرون عدداً فقط — دون هوياتٍ أو أعمال.
create or replace function public.my_study_tasks()
returns table (
  case_id uuid, secret_code text, ref_no text, category app_category,
  source case_source, foreign_info jsonb, peers bigint,
  assigned_at timestamptz, submitted_at timestamptz
) language sql stable security definer set search_path = public as $$
  select c.id, c.secret_code, c.ref_no, c.category, c.source,
    (select to_jsonb(f.*) from foreign_requests f where f.case_id = c.id limit 1),
    (select count(*) from studies s2 where s2.case_id = c.id),
    s.created_at, s.submitted_at
  from studies s
  join protection_cases c on c.id = s.case_id
  where has_role(auth.uid(),'studier') and s.studier_id = auth.uid()
  order by (s.submitted_at is null) desc, s.created_at desc;
$$;

create or replace function public.my_assessment_tasks()
returns table (
  case_id uuid, secret_code text, ref_no text, category app_category,
  source case_source, foreign_info jsonb, peers bigint,
  assigned_at timestamptz, submitted_at timestamptz
) language sql stable security definer set search_path = public as $$
  select c.id, c.secret_code, c.ref_no, c.category, c.source,
    (select to_jsonb(f.*) from foreign_requests f where f.case_id = c.id limit 1),
    (select count(*) from assessments a2 where a2.case_id = c.id),
    a.created_at, a.submitted_at
  from assessments a
  join protection_cases c on c.id = a.case_id
  where has_role(auth.uid(),'evaluator') and a.evaluator_id = auth.uid()
  order by (a.submitted_at is null) desc, a.created_at desc;
$$;

-- ─────────────────── القبول الجزئي في دالتي التقديم ───────────────────
-- الاستمارة تفرّق «قبول جزئي» بأسبابه؛ العمود موجود والدالتان لم تكونا تكتبانه.
drop function if exists public.submit_study(uuid, text, jsonb, jsonb, interval, text);
create or replace function public.submit_study(
  _case_id uuid, _recommendation text, _reject_reasons jsonb,
  _proposed_type jsonb, _proposed_duration interval, _notes text,
  _partial_reason text default null
) returns table(id uuid)
language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _sid uuid; _ref text; _st case_status;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid, 'studier') then raise exception 'forbidden: not studier'; end if;
  select pc.status, pc.ref_no into _st, _ref from protection_cases pc where pc.id = _case_id;
  if _st <> 'under_study' then raise exception 'الحالة ليست في الدراسة (%).', _st; end if;

  insert into studies (case_id, studier_id, recommendation, reject_reasons, proposed_type, proposed_duration, notes, partial_reason, submitted_at)
  values (_case_id, _uid, _recommendation, _reject_reasons, _proposed_type, _proposed_duration, _notes, _partial_reason, now())
  on conflict (case_id, studier_id) do update
    set recommendation = excluded.recommendation, reject_reasons = excluded.reject_reasons,
        proposed_type = excluded.proposed_type, proposed_duration = excluded.proposed_duration,
        notes = excluded.notes, partial_reason = excluded.partial_reason, submitted_at = now()
  returning studies.id into _sid;

  insert into audit_log (actor_id, action, target) values (_uid, 'submit_study', _ref);
  return query select _sid;
end $$;

drop function if exists public.submit_assessment(uuid, text, jsonb, jsonb, interval, text);
create or replace function public.submit_assessment(
  _case_id uuid, _recommendation text, _reject_reasons jsonb,
  _proposed_type jsonb, _proposed_duration interval, _notes text,
  _partial_reason text default null
) returns table(id uuid)
language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _aid uuid; _ref text; _st case_status;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid, 'evaluator') then raise exception 'forbidden: not evaluator'; end if;
  select pc.status, pc.ref_no into _st, _ref from protection_cases pc where pc.id = _case_id;
  if _st <> 'under_study' then raise exception 'الحالة ليست في الدراسة (%).', _st; end if;

  insert into assessments (case_id, evaluator_id, recommendation, reject_reasons, proposed_type, proposed_duration, notes, partial_reason, submitted_at)
  values (_case_id, _uid, _recommendation, _reject_reasons, _proposed_type, _proposed_duration, _notes, _partial_reason, now())
  on conflict (case_id, evaluator_id) do update
    set recommendation = excluded.recommendation, reject_reasons = excluded.reject_reasons,
        proposed_type = excluded.proposed_type, proposed_duration = excluded.proposed_duration,
        notes = excluded.notes, partial_reason = excluded.partial_reason, submitted_at = now()
  returning assessments.id into _aid;

  insert into audit_log (actor_id, action, target) values (_uid, 'submit_assessment', _ref);
  return query select _aid;
end $$;

-- ─────────────────── الصلاحيات والريل-تايم ───────────────────
-- الإسناد يُطلقه المشغّل/البذر حصراً — لا استدعاء مباشراً من المستخدمين
revoke execute on function public.assign_study_eval(uuid, int) from public, anon, authenticated;
grant execute on function public.send_leader_message(uuid, text, text) to authenticated;
grant execute on function public.mark_leader_thread_read(uuid, text) to authenticated;
grant execute on function public.record_secret_reveal(uuid) to authenticated;
grant execute on function public.my_study_tasks() to authenticated;
grant execute on function public.my_assessment_tasks() to authenticated;
grant execute on function public.submit_study(uuid, text, jsonb, jsonb, interval, text, text) to authenticated;
grant execute on function public.submit_assessment(uuid, text, jsonb, jsonb, interval, text, text) to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'leadership_messages') then
    alter publication supabase_realtime add table leadership_messages;
  end if;
end $$;
