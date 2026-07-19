-- ============================================================
--  تحديث مرحلة «القرار والإشعار» (معلم CO-3) — 15 يوليو 2026
--  المرجع الملزم: docs/handoff-decision-stage-2026-07-15.md
--
--  أُعيد اعتماد الاعتماد المسبق بصيغة النائب وحده (لا اعتماد للرئيس قبل الطرح):
--    preparing → pending_deputy → approved → voting → issued
--  ويُحذف كل أثر لمسار 8 يوليو المبسّط:
--    · الطرح المباشر للتصويت (council_submit → voting) وصمّام الإعادة أثناء التصويت.
--    · اعتماد الرئيس المسبق (pending_chair + chair_approved_at).
--    · منظومة «المرفقات فقط» المنفصلة (decision_requests/attachments/votes + dec_*
--      + package_confirmed + dec_submit_voting) — تُستبدل بمرفقات داعمة اختيارية
--      على القضية نفسها (council_attachments، دلو decision-docs يبقى).
--  كل انتقال يُفرَض server-side (SECURITY DEFINER: دور + حالة) ويُسجَّل في audit_log.
-- ============================================================

-- ── 1) council_decisions: الآلة الجديدة ─────────────────────
alter table council_decisions add column if not exists submitted_at timestamptz;

-- ترحيل البيانات قبل القيد: من كان بانتظار اعتماد الرئيس فقد اعتمده النائب → approved
update council_decisions set status = 'approved', updated_at = now() where status = 'pending_chair';

-- حذف أثر اعتماد الرئيس المسبق
alter table council_decisions drop column if exists chair_approved_at;

alter table council_decisions drop constraint if exists council_decisions_status_check;
alter table council_decisions add constraint council_decisions_status_check
  check (status in ('preparing','pending_deputy','approved','voting','issued'));

comment on table council_decisions is
  'قرار المركز (CO-3): preparing → pending_deputy → approved → voting → issued — اعتماد النائب وحده، الإصدار بيد الرئيس (15 يوليو 2026).';

-- ── 2) المعدّ: حفظ المسوّدة (يُثبّت المعدّ عند أول حفظ) ──────
create or replace function public.council_save(_case_id uuid, _types jsonb, _duration text, _reasoning text)
returns void language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid();
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid, 'case_officer') then raise exception 'forbidden: not preparer'; end if;
  update council_decisions
     set types = coalesce(_types, types), duration = _duration, reasoning = _reasoning,
         preparer_id = coalesce(preparer_id, _uid), updated_at = now()
   where case_id = _case_id and status = 'preparing'
     and (preparer_id is null or preparer_id = _uid);
  if not found then raise exception 'القرار ليس في الإعداد أو ليس مُسنَداً إليك.'; end if;
end $$;
grant execute on function public.council_save(uuid, jsonb, text, text) to authenticated;

-- ── 3) المعدّ: رفع القرار لاعتماد نائب رئيس المركز ──────────
--     (يستبدل الطرح المباشر لمسار 8 يوليو — التوقيع نفسه، الوجهة pending_deputy)
create or replace function public.council_submit(_case_id uuid, _types jsonb, _duration text, _reasoning text)
returns table(status text) language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _ref text;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid, 'case_officer') then raise exception 'forbidden: not preparer'; end if;
  if _types is null or jsonb_array_length(_types) = 0 then raise exception 'أنواع الحماية (م14) مطلوبة.'; end if;
  if _reasoning is null or btrim(_reasoning) = '' then raise exception 'حيثيات القرار مطلوبة.'; end if;
  select ref_no into _ref from protection_cases where id = _case_id;
  update council_decisions cd
     set types = _types, duration = _duration, reasoning = _reasoning,
         status = 'pending_deputy', submitted_at = now(),
         preparer_id = coalesce(cd.preparer_id, _uid),
         deputy_approved_at = null, updated_at = now()
   where cd.case_id = _case_id and cd.status = 'preparing'
     and (cd.preparer_id is null or cd.preparer_id = _uid);
  if not found then raise exception 'القرار ليس في الإعداد أو ليس مُسنَداً إليك.'; end if;
  insert into audit_log (actor_id, action, target) values (_uid, 'council_submit_for_approval', _ref);
  return query select 'pending_deputy'::text;
end $$;
grant execute on function public.council_submit(uuid, jsonb, text, text) to authenticated;

-- ── 4) النائب حصراً: الاعتماد → approved (يعود للمعدّ للطرح) ──
create or replace function public.council_approve(_case_id uuid)
returns table(status text) language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _st text; _ref text;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid, 'deputy_chair') then raise exception 'غير مصرَّح: الاعتماد لنائب رئيس المركز حصراً.'; end if;
  select cd.status into _st from council_decisions cd where cd.case_id = _case_id for update;
  if _st is distinct from 'pending_deputy' then raise exception 'القرار ليس بانتظار اعتماد النائب (%).', _st; end if;
  select ref_no into _ref from protection_cases where id = _case_id;
  update council_decisions set deputy_approved_at = now(), status = 'approved', updated_at = now()
   where case_id = _case_id;
  insert into audit_log (actor_id, action, target) values (_uid, 'council_approve_deputy', _ref);
  return query select 'approved'::text;
end $$;
grant execute on function public.council_approve(uuid) to authenticated;

-- ── 5) النائب حصراً: الإعادة للمعدّ بملاحظة إلزامية (من pending_deputy فقط) ──
create or replace function public.council_return(_case_id uuid, _note text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _ref text;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid, 'deputy_chair') then raise exception 'غير مصرَّح: الإعادة لنائب رئيس المركز حصراً.'; end if;
  if _note is null or btrim(_note) = '' then raise exception 'ملاحظة الإعادة إلزامية.'; end if;
  select ref_no into _ref from protection_cases where id = _case_id;
  update council_decisions
     set status = 'preparing', deputy_approved_at = null, submitted_at = null,
         rejections = rejections || jsonb_build_object('by', _uid, 'note', _note, 'at', now()), updated_at = now()
   where case_id = _case_id and status = 'pending_deputy';
  if not found then raise exception 'القرار ليس بانتظار اعتماد النائب.'; end if;
  insert into audit_log (actor_id, action, target) values (_uid, 'council_return', _ref);
end $$;
grant execute on function public.council_return(uuid, text) to authenticated;

-- ── 6) المعدّ: طرح القرار المعتمَد على المجلس للتصويت ────────
create or replace function public.council_open_voting(_case_id uuid)
returns table(status text) language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _st text; _prep uuid; _ref text;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid, 'case_officer') then raise exception 'forbidden: not preparer'; end if;
  select cd.status, cd.preparer_id into _st, _prep from council_decisions cd where cd.case_id = _case_id for update;
  if _st is null then raise exception 'لا قرار لهذه القضية.'; end if;
  if _prep is not null and _prep <> _uid then raise exception 'الطرح لمعدّ هذا القرار حصراً.'; end if;
  if _st is distinct from 'approved' then raise exception 'لا طرح قبل اعتماد النائب (الحالة %).', _st; end if;
  select ref_no into _ref from protection_cases where id = _case_id;
  update council_decisions set status = 'voting', voting_started_at = now(), deadline_closed = false, updated_at = now()
   where case_id = _case_id;
  insert into audit_log (actor_id, action, target) values (_uid, 'council_open_voting', _ref);
  return query select 'voting'::text;
end $$;
grant execute on function public.council_open_voting(uuid) to authenticated;

-- ── 6ب) التصويت: يُغلَق ببلوغ الأغلبية 4/7 أو المهلة — يُفرَض هنا لا في الواجهة ──
create or replace function public.council_vote(_case_id uuid, _choice text, _note text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _st text; _ref text; _t record;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not (has_role(_uid, 'board_member') or has_role(_uid, 'deputy_chair') or has_role(_uid, 'board_chair')) then
    raise exception 'forbidden: not a voting member';
  end if;
  if _choice not in ('accept', 'reject') then raise exception 'خيار غير معروف: %', _choice; end if;
  if _choice = 'reject' and (_note is null or btrim(_note) = '') then raise exception 'سبب الرفض إلزامي.'; end if;
  select cd.status into _st from council_decisions cd where cd.case_id = _case_id for update;
  if _st <> 'voting' then raise exception 'القرار ليس مطروحاً للتصويت (%).', _st; end if;
  select * into _t from public.council_tally(_case_id);
  if _t.closed then raise exception 'أُغلق التصويت (بلوغ الأغلبية أو انتهاء المهلة).'; end if;
  select ref_no into _ref from protection_cases where id = _case_id;
  insert into council_votes (case_id, voter_id, choice, note)
  values (_case_id, _uid, _choice, _note)
  on conflict (case_id, voter_id) do update set choice = excluded.choice, note = excluded.note, voted_at = now();
  insert into audit_log (actor_id, action, target) values (_uid, 'council_vote', _ref);
end $$;
grant execute on function public.council_vote(uuid, text, text) to authenticated;

-- هل باب التصويت مفتوح؟ (للعضو — دون كشف الحصيلة)
create or replace function public.council_vote_open(_case_id uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare _st text; _t record;
begin
  if not (is_council(auth.uid()) or has_role(auth.uid(),'case_officer')) then return false; end if;
  select cd.status into _st from council_decisions cd where cd.case_id = _case_id;
  if _st is distinct from 'voting' then return false; end if;
  select * into _t from public.council_tally(_case_id);
  return not _t.closed;
end $$;
grant execute on function public.council_vote_open(uuid) to authenticated;

-- سدّ ثغرة: الحصيلة كانت مكشوفة لكل المصادقين عبر council_tally مباشرةً —
-- العضو لا يرى الحصيلة (القيادة تحسبها من council_votes المتاحة لها تحت RLS).
revoke execute on function public.council_tally(uuid) from authenticated, anon, public;

-- (council_close كما هي — القيادة تُغلق بانتهاء يوم العمل)

-- ── 7) الإصدار بيد رئيس المركز وحده + إشعار الطرفين فوراً (م10) ──
create or replace function public.council_issue(_case_id uuid, _reason text)
returns table(outcome text) language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _ref text; _t record; _st text; _newcase case_status; _sec text;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid, 'board_chair') then raise exception 'غير مصرَّح: الإصدار بيد رئيس المركز حصراً.'; end if;
  select cd.status into _st from council_decisions cd where cd.case_id = _case_id for update;
  if _st <> 'voting' then raise exception 'القرار ليس في التصويت (%).', _st; end if;
  select * into _t from public.council_tally(_case_id);
  if not _t.closed then raise exception 'لم يُغلق التصويت بعد (بلوغ 4/7 أو انتهاء المهلة).'; end if;
  if _t.outcome = 'reject' and (_reason is null or btrim(_reason) = '') then
    raise exception 'قرار الرفض يتطلّب تسبيباً مكتوباً (م21).';
  end if;
  select ref_no, secret_code into _ref, _sec from protection_cases where id = _case_id;

  update council_decisions
     set status = 'issued', issued_type = _t.outcome, issued_reason = _reason, issued_at = now(), updated_at = now()
   where case_id = _case_id;

  _newcase := case _t.outcome when 'accept' then 'accepted'::case_status else 'rejected'::case_status end;
  update protection_cases set status = _newcase, updated_at = now() where id = _case_id;

  insert into board_decisions (case_id, type, justification, decided_at)
  values (_case_id, case _t.outcome when 'accept' then 'accept'::decision_type else 'reject'::decision_type end,
          coalesce(_reason, 'قرار المجلس'), now());

  -- إشعار الطرف الأول: طالب الحماية (فوريّ — م10)
  insert into notifications (case_id, type, title, body, target_tab, sent_at)
  values (_case_id, 'decision',
    case _t.outcome when 'accept' then 'صدر قرار قبول طلب الحماية' else 'صدر قرار بشأن طلب الحماية' end,
    case _t.outcome when 'accept' then 'أصدر المجلس قراره بقبول طلبك؛ سيُتواصل معك لتوقيع اتفاقية الحماية (م11).'
                    else 'أصدر المجلس قراره بشأن طلبك. لك حقّ التظلّم خلال 10 أيام (م21).' end,
    'requests', now());

  -- إشعار الطرف الثاني: الجهة المختصة الموصية (إن وُجدت توصية على القضية)
  if exists (select 1 from recommendations rc where rc.case_id = _case_id) then
    insert into notifications (case_id, authority, type, title, body, target_tab, sent_at)
    values (_case_id, 'competent', 'decision',
      'صدر قرار المركز في قضيّة أوصيتم بشأنها',
      'أصدر رئيس المركز القرار في الطلب ' || coalesce(_sec,'') ||
      case _t.outcome when 'accept' then ' (قبول الحماية).' else ' (عدم القبول).' end,
      'incoming', now());
  end if;

  insert into audit_log (actor_id, action, target) values (_uid, 'council_issue_' || _t.outcome, _ref);
  return query select _t.outcome;
end $$;
grant execute on function public.council_issue(uuid, text) to authenticated;

-- ── 8) مرفقات داعمة اختيارية على القضية (تَخلُف حزمة المرفقات الملغاة) ──
--     لا بوّابة «5 مرفقات إلزامية» — القرار يصدر بمحتواه (types/duration/reasoning).
create table if not exists council_attachments (
  id            uuid primary key default gen_random_uuid(),
  case_id       uuid not null references protection_cases(id) on delete cascade,
  doc_id        text not null,
  doc_group     text not null default 'other',
  label         text not null,
  file_name     text,
  storage_path  text,
  uploaded_by   uuid references auth.users(id),
  updated_at    timestamptz default now(),
  unique (case_id, doc_id)
);
create index if not exists idx_council_att_case on council_attachments (case_id);
alter table council_attachments enable row level security;

-- القراءة: المعدّ والمجلس على قضايا مرحلة القرار (case_in_decision يتفادى تكرار RLS)
drop policy if exists council_att_read on council_attachments;
create policy council_att_read on council_attachments for select using (
  (has_role(auth.uid(),'case_officer') or is_council(auth.uid()))
  and public.case_in_decision(council_attachments.case_id));
grant select on council_attachments to authenticated;

create or replace function public.council_set_attachment(
  _case_id uuid, _doc_id text, _group text, _label text, _file_name text, _storage_path text)
returns void language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _st text; _ref text;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid,'case_officer') then raise exception 'forbidden: not preparer'; end if;
  select cd.status into _st from council_decisions cd where cd.case_id = _case_id;
  if _st is null then raise exception 'لا قرار لهذه القضية.'; end if;
  if _st not in ('preparing') then raise exception 'لا تعديل على المرفقات بعد رفع القرار للاعتماد.'; end if;
  select ref_no into _ref from protection_cases where id = _case_id;
  insert into council_attachments (case_id, doc_id, doc_group, label, file_name, storage_path, uploaded_by, updated_at)
    values (_case_id, _doc_id, coalesce(_group,'other'), _label, _file_name, _storage_path, _uid, now())
  on conflict (case_id, doc_id) do update
    set label = excluded.label, doc_group = excluded.doc_group,
        file_name = excluded.file_name, storage_path = excluded.storage_path, uploaded_by = _uid, updated_at = now();
  insert into audit_log (actor_id, action, target) values (_uid, 'council_set_attachment', _ref || '/' || _doc_id);
end $$;
grant execute on function public.council_set_attachment(uuid,text,text,text,text,text) to authenticated;

create or replace function public.council_remove_attachment(_case_id uuid, _doc_id text)
returns void language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _st text; _ref text;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid,'case_officer') then raise exception 'forbidden: not preparer'; end if;
  select cd.status into _st from council_decisions cd where cd.case_id = _case_id;
  if _st not in ('preparing') then raise exception 'لا تعديل على المرفقات بعد رفع القرار للاعتماد.'; end if;
  select ref_no into _ref from protection_cases where id = _case_id;
  delete from council_attachments where case_id = _case_id and doc_id = _doc_id;
  insert into audit_log (actor_id, action, target) values (_uid, 'council_remove_attachment', _ref || '/' || _doc_id);
end $$;
grant execute on function public.council_remove_attachment(uuid,text) to authenticated;

-- ── 8ب) مراسلات المجلس — خيوط معزولة بالمقعد (معدّ/عضو ↔ قيادة) ──
--     المعدّ/العضو يبدأ الخيط؛ القيادة تردّ وتطّلع على الجميع؛ كل رسالة في التدقيق.
create table if not exists council_messages (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references protection_cases(id) on delete cascade,
  party       text not null check (party in ('preparer','member')),
  party_uid   uuid not null references auth.users(id),   -- صاحب الخيط (المعدّ أو العضو)
  with_seat   text not null check (with_seat in ('deputy','chair')),
  sender_uid  uuid not null references auth.users(id),
  body        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_council_msg_thread on council_messages (case_id, party, party_uid, with_seat);
alter table council_messages enable row level security;

drop policy if exists council_msg_read on council_messages;
create policy council_msg_read on council_messages for select using (
  party_uid = auth.uid() or has_role(auth.uid(),'deputy_chair') or has_role(auth.uid(),'board_chair'));
grant select on council_messages to authenticated;

create or replace function public.council_send_message(
  _case_id uuid, _party text, _party_uid uuid, _with_seat text, _body text)
returns void language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _ref text; _lead boolean;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if _body is null or btrim(_body) = '' then raise exception 'نصّ الرسالة مطلوب.'; end if;
  if _party not in ('preparer','member') or _with_seat not in ('deputy','chair') then raise exception 'خيط غير صالح.'; end if;
  _lead := has_role(_uid,'deputy_chair') or has_role(_uid,'board_chair');
  if not _lead then
    -- غير القيادة لا يكتب إلا في خيطه هو، وبالدور المطابق للطرف
    if _party_uid <> _uid then raise exception 'غير مصرَّح: الخيط ليس لك.'; end if;
    if _party = 'preparer' and not has_role(_uid,'case_officer') then raise exception 'غير مصرَّح.'; end if;
    if _party = 'member'   and not has_role(_uid,'board_member') then raise exception 'غير مصرَّح.'; end if;
  end if;
  select ref_no into _ref from protection_cases where id = _case_id;
  if _ref is null then raise exception 'قضية غير موجودة.'; end if;
  insert into council_messages (case_id, party, party_uid, with_seat, sender_uid, body)
  values (_case_id, _party, _party_uid, _with_seat, _uid, btrim(_body));
  insert into audit_log (actor_id, action, target) values (_uid, 'council_message', _ref);
end $$;
grant execute on function public.council_send_message(uuid,text,uuid,text,text) to authenticated;

do $$ begin
  if not exists (select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename='council_messages') then
    alter publication supabase_realtime add table council_messages;
  end if;
end $$;
alter table council_messages replica identity full;

-- ── 9) اطّلاع المجلس على حزمة القرار (دراسات/تقييمات) لقضايا المرحلة ──
--     (التوصيات مغطّاة بسياسة co_rec_decision_read القائمة على النسق نفسه)
drop policy if exists council_study_read on studies;
create policy council_study_read on studies for select using (
  is_council(auth.uid()) and public.case_in_decision(studies.case_id));
drop policy if exists council_assess_read on assessments;
create policy council_assess_read on assessments for select using (
  is_council(auth.uid()) and public.case_in_decision(assessments.case_id));

-- ── 10) حذف منظومة 8 يوليو المنفصلة بالكامل (dec_* + جداولها) ──
drop table if exists decision_votes;
drop table if exists decision_attachments;
drop table if exists decision_requests;
drop function if exists public.dec_create_request(text,text);
drop function if exists public.dec_set_attachment(uuid,text,text,text,boolean,text,text);
drop function if exists public.dec_remove_attachment(uuid,text);
drop function if exists public.dec_submit_voting(uuid);
drop function if exists public.dec_cast_vote(uuid,text,text);
drop function if exists public.dec_close_deadline(uuid);
drop function if exists public.dec_issue(uuid,text,text);
drop function if exists public.dec_tally(uuid);
drop function if exists public.dec_req_visible(uuid,uuid);   -- (is_council تبقى — تستخدمها سياسات أخرى)
drop sequence if exists decision_flow_secret_seq;
-- دلو decision-docs وسياساته تبقى لخدمة council_attachments (المفاتيح ASCII فقط).

-- ── 11) بذرة المرحلة (تحاكي بذرة التصميم v9 على الخطّ الحقيقي) ──
--  C-2026-0488 قيد الإعداد · C-2026-0493 بانتظار اعتماد النائب · C-2026-0495 مطروح للتصويت بعد الاعتماد.
--  تُنشأ القضايا عبر مسار الدراسة الحقيقي (المُشغّل الآليّ ينقلها إلى in_decision).
do $$
declare
  _prep uuid; _studier uuid; _eval uuid; _dep uuid;
  _c uuid; _codes text[] := array['C-2026-0488','C-2026-0493','C-2026-0495'];
  _refs  text[] := array['REF-2026-9488','REF-2026-9493','REF-2026-9495'];
  _i int;
begin
  select id into _prep from auth.users where email = '2000000005@nafath.local';
  select ur.user_id into _studier from user_roles ur where ur.role = 'studier'   limit 1;
  select ur.user_id into _eval    from user_roles ur where ur.role = 'evaluator' limit 1;
  select ur.user_id into _dep     from user_roles ur where ur.role = 'deputy_chair' limit 1;
  if _prep is null or _studier is null or _eval is null then return; end if;

  for _i in 1..3 loop
    if exists (select 1 from protection_cases where secret_code = _codes[_i]) then continue; end if;
    insert into protection_cases (ref_no, secret_code, category, status, classification, source)
      values (_refs[_i], _codes[_i], 'witness', 'under_study', 'high', 'local')
      returning id into _c;
    -- دراسة وتقييم مُعتمَدان → المُشغّل ينقل القضية إلى in_decision ويُنشئ صفّ القرار
    insert into studies (case_id, studier_id, recommendation, proposed_type, notes, submitted_at)
      values (_c, _studier, 'قبول كلي', '["الحماية الشخصية والمرافقة"]'::jsonb,
              'دراسة قانونية مكتملة — بذرة مرحلة القرار.', now());
    insert into assessments (case_id, evaluator_id, recommendation, notes, submitted_at)
      values (_c, _eval, 'قبول كلي', 'تقييم مخاطر مكتمل — بذرة مرحلة القرار.', now());

    if _codes[_i] = 'C-2026-0493' then
      update council_decisions
         set preparer_id = _prep, status = 'pending_deputy', submitted_at = now(),
             types = '["الحماية الشخصية والمرافقة","إخفاء الهوية وسريّتها"]'::jsonb,
             duration = '6 أشهر', reasoning = 'استناداً إلى مخرَجي الدراسة والتقييم وثبوت جدّية التهديد (م14).',
             updated_at = now()
       where case_id = _c;
    elsif _codes[_i] = 'C-2026-0495' then
      update council_decisions
         set preparer_id = _prep, status = 'voting', submitted_at = now() - interval '1 hour',
             deputy_approved_at = now() - interval '30 minutes', voting_started_at = now(),
             types = '["الحماية الشخصية والمرافقة","تأمين المسكن ومقرّ العمل"]'::jsonb,
             duration = 'سنة واحدة', reasoning = 'خطورة مرتفعة موثّقة؛ التدبيران متلازمان لدرء التهديد (م14).',
             updated_at = now()
       where case_id = _c;
    else
      update council_decisions set preparer_id = _prep, updated_at = now() where case_id = _c;
    end if;
  end loop;
end $$;
