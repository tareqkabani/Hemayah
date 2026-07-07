-- ============================================================
--  بوابة موظف المركز — القرار والإشعار (ربط قاعدة)
--  المرحلة الأخطر: إصدار قرار الحماية. آلة الحالة مفروضة ذرّياً (SECURITY DEFINER)،
--  عزل الأصوات RLS (العضو يرى صوته فقط)، سلسلة تدقيق، إشعار الطرفين.
--  المسار: under_study → in_decision → (preparing→pending_deputy→pending_chair→voting) → accepted/rejected
-- ============================================================

-- ── الجداول ──────────────────────────────────────────────
-- قرار المركز المُعَدّ + حالة سير العمل (صفٌّ واحد لكل قضية).
create table if not exists council_decisions (
  id                 uuid primary key default gen_random_uuid(),
  case_id            uuid not null unique references protection_cases(id) on delete cascade,
  preparer_id        uuid references auth.users(id),
  status             text not null default 'preparing',  -- preparing|pending_deputy|pending_chair|voting|issued
  types              jsonb not null default '[]'::jsonb,  -- أنواع الحماية المقترحة (م14)
  duration           text,
  reasoning          text,
  deputy_approved_at timestamptz,
  chair_approved_at  timestamptz,
  voting_started_at  timestamptz,
  deadline_closed    boolean not null default false,
  rejections         jsonb not null default '[]'::jsonb,  -- إعادات القيادة للمعدّ
  issued_type        text,                                 -- accept|reject
  issued_reason      text,
  issued_at          timestamptz,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);
create index if not exists idx_council_dec_status on council_decisions (status);

-- أصوات المجلس — صوتٌ واحد لكل عضوٍ على القضية (عزلٌ صفّيّ صارم).
create table if not exists council_votes (
  id        uuid primary key default gen_random_uuid(),
  case_id   uuid not null references protection_cases(id) on delete cascade,
  voter_id  uuid not null references auth.users(id),
  choice    text not null,                                 -- accept|reject
  note      text,
  voted_at  timestamptz default now(),
  unique (case_id, voter_id)
);
create index if not exists idx_council_votes_case on council_votes (case_id);

alter table council_decisions enable row level security;
alter table council_votes     enable row level security;

-- ── العزل (RLS) ──────────────────────────────────────────
-- القرار المُعَدّ: تراه القيادة والأعضاء والمعدّ (المحتوى، لا الأصوات).
create policy council_dec_read on council_decisions for select using (
  has_role(auth.uid(),'board_chair') or has_role(auth.uid(),'deputy_chair')
  or has_role(auth.uid(),'board_member') or has_role(auth.uid(),'case_officer'));
-- الأصوات: العضو يرى صوته فقط؛ القيادة (النائب/الرئيس) تطّلع على الحصيلة كاملةً.
create policy council_vote_own on council_votes for select using (
  voter_id = auth.uid()
  or has_role(auth.uid(),'board_chair') or has_role(auth.uid(),'deputy_chair'));

grant select on council_decisions to authenticated;
grant select on council_votes     to authenticated;

-- ── حصيلة التصويت (إغلاق 4/7؛ العدد فردي فلا تعادل عند اكتمال النصاب) ──
create or replace function public.council_tally(_case_id uuid)
returns table(accept int, reject int, cast_n int, closed boolean, outcome text)
language plpgsql security definer set search_path = public as $$
declare _a int; _r int; _c int; _dl boolean;
begin
  select count(*) filter (where choice = 'accept'),
         count(*) filter (where choice = 'reject'),
         count(*)
    into _a, _r, _c
  from council_votes where case_id = _case_id;
  select coalesce(deadline_closed, false) into _dl from council_decisions where case_id = _case_id;
  accept := _a; reject := _r; cast_n := _c;
  if _a >= 4 then closed := true; outcome := 'accept';
  elsif _r >= 4 then closed := true; outcome := 'reject';
  elsif _c >= 7 then closed := true; outcome := case when _a > _r then 'accept' else 'reject' end;
  elsif _dl then closed := true; outcome := case when _a >= _r then 'accept' else 'reject' end;
  else closed := false; outcome := null; end if;
  return next;
end $$;
grant execute on function public.council_tally(uuid) to authenticated;

-- ── انتقال: under_study → in_decision (يلزم دراسةٌ وتقييمٌ مُعتمَدان) ──
create or replace function public.send_to_decision(_case_id uuid)
returns table(status case_status)
language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _cur case_status; _ref text; _ns int; _na int;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid, 'case_officer') then raise exception 'forbidden: not case_officer'; end if;
  select c.status, c.ref_no into _cur, _ref from protection_cases c where c.id = _case_id for update;
  if _cur is null then raise exception 'case not found'; end if;
  if _cur <> 'under_study' then raise exception 'الحالة ليست في الدراسة (%).', _cur; end if;
  select count(*) into _ns from studies     where case_id = _case_id and submitted_at is not null;
  select count(*) into _na from assessments where case_id = _case_id and submitted_at is not null;
  if _ns < 1 or _na < 1 then raise exception 'يلزم دراسةٌ وتقييمٌ مُعتمَدان قبل الإحالة للقرار.'; end if;

  update protection_cases set status = 'in_decision', updated_at = now() where id = _case_id;
  insert into council_decisions (case_id, preparer_id, status)
  values (_case_id, _uid, 'preparing')
  on conflict (case_id) do nothing;
  insert into audit_log (actor_id, action, target) values (_uid, 'send_to_decision', _ref);
  return query select 'in_decision'::case_status;
end $$;
grant execute on function public.send_to_decision(uuid) to authenticated;

-- ── المعدّ: حفظ مسوّدة القرار ──
create or replace function public.council_save(_case_id uuid, _types jsonb, _duration text, _reasoning text)
returns void language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid();
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid, 'case_officer') then raise exception 'forbidden: not preparer'; end if;
  update council_decisions
     set types = coalesce(_types, types), duration = _duration, reasoning = _reasoning, updated_at = now()
   where case_id = _case_id and status = 'preparing';
  if not found then raise exception 'القرار ليس في الإعداد.'; end if;
end $$;
grant execute on function public.council_save(uuid, jsonb, text, text) to authenticated;

-- ── المعدّ: رفع القرار لاعتماد القيادة ──
create or replace function public.council_submit(_case_id uuid, _types jsonb, _duration text, _reasoning text)
returns table(status text) language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _ref text;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid, 'case_officer') then raise exception 'forbidden: not preparer'; end if;
  if _reasoning is null or btrim(_reasoning) = '' then raise exception 'حيثيات القرار مطلوبة.'; end if;
  select ref_no into _ref from protection_cases where id = _case_id;
  update council_decisions cd
     set types = _types, duration = _duration, reasoning = _reasoning,
         status = 'pending_deputy', deputy_approved_at = null, chair_approved_at = null, updated_at = now()
   where cd.case_id = _case_id and cd.status = 'preparing';
  if not found then raise exception 'القرار ليس في الإعداد.'; end if;
  insert into audit_log (actor_id, action, target) values (_uid, 'council_submit', _ref);
  return query select 'pending_deputy'::text;
end $$;
grant execute on function public.council_submit(uuid, jsonb, text, text) to authenticated;

-- ── القيادة: اعتماد (النائب ثم الرئيس) ──
create or replace function public.council_approve(_case_id uuid)
returns table(status text) language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _st text; _ref text; _new text;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  select cd.status into _st from council_decisions cd where cd.case_id = _case_id for update;
  select ref_no into _ref from protection_cases where id = _case_id;
  if _st = 'pending_deputy' and has_role(_uid, 'deputy_chair') then
    update council_decisions set deputy_approved_at = now(), status = 'pending_chair', updated_at = now() where case_id = _case_id;
    _new := 'pending_chair';
  elsif _st = 'pending_chair' and has_role(_uid, 'board_chair') then
    update council_decisions set chair_approved_at = now(), status = 'voting', voting_started_at = now(), updated_at = now() where case_id = _case_id;
    _new := 'voting';
  else
    raise exception 'ليس دورك للاعتماد (الحالة %).', _st;
  end if;
  insert into audit_log (actor_id, action, target) values (_uid, 'council_approve_' || _new, _ref);
  return query select _new;
end $$;
grant execute on function public.council_approve(uuid) to authenticated;

-- ── القيادة: إعادة القرار للمعدّ للتعديل ──
create or replace function public.council_return(_case_id uuid, _note text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _ref text;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not (has_role(_uid, 'deputy_chair') or has_role(_uid, 'board_chair')) then raise exception 'forbidden'; end if;
  if _note is null or btrim(_note) = '' then raise exception 'سبب الإعادة مطلوب.'; end if;
  select ref_no into _ref from protection_cases where id = _case_id;
  update council_decisions
     set status = 'preparing', deputy_approved_at = null, chair_approved_at = null,
         rejections = rejections || jsonb_build_object('by', _uid, 'note', _note, 'at', now()), updated_at = now()
   where case_id = _case_id and status in ('pending_deputy', 'pending_chair');
  if not found then raise exception 'القرار ليس في مرحلة الاعتماد.'; end if;
  insert into audit_log (actor_id, action, target) values (_uid, 'council_return', _ref);
end $$;
grant execute on function public.council_return(uuid, text) to authenticated;

-- ── التصويت (عضو/نائب/رئيس) — صوتٌ مستقلّ، الرفض بتسبيب ──
create or replace function public.council_vote(_case_id uuid, _choice text, _note text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _st text; _ref text;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not (has_role(_uid, 'board_member') or has_role(_uid, 'deputy_chair') or has_role(_uid, 'board_chair')) then
    raise exception 'forbidden: not a voting member';
  end if;
  if _choice not in ('accept', 'reject') then raise exception 'خيار غير معروف: %', _choice; end if;
  if _choice = 'reject' and (_note is null or btrim(_note) = '') then raise exception 'سبب الرفض إلزامي.'; end if;
  select cd.status into _st from council_decisions cd where cd.case_id = _case_id;
  if _st <> 'voting' then raise exception 'القرار ليس مطروحاً للتصويت (%).', _st; end if;
  select ref_no into _ref from protection_cases where id = _case_id;
  insert into council_votes (case_id, voter_id, choice, note)
  values (_case_id, _uid, _choice, _note)
  on conflict (case_id, voter_id) do update set choice = excluded.choice, note = excluded.note, voted_at = now();
  insert into audit_log (actor_id, action, target) values (_uid, 'council_vote', _ref);
end $$;
grant execute on function public.council_vote(uuid, text, text) to authenticated;

-- ── القيادة: إغلاق التصويت بانتهاء المهلة ──
create or replace function public.council_close(_case_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _ref text;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not (has_role(_uid, 'deputy_chair') or has_role(_uid, 'board_chair')) then raise exception 'forbidden'; end if;
  select ref_no into _ref from protection_cases where id = _case_id;
  update council_decisions set deadline_closed = true, updated_at = now() where case_id = _case_id and status = 'voting';
  if not found then raise exception 'القرار ليس مطروحاً للتصويت.'; end if;
  insert into audit_log (actor_id, action, target) values (_uid, 'council_close', _ref);
end $$;
grant execute on function public.council_close(uuid) to authenticated;

-- ── القيادة: إصدار القرار (يلزم إغلاق التصويت) → حالة القضية + إشعار الطرفين ──
create or replace function public.council_issue(_case_id uuid, _reason text)
returns table(outcome text) language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _ref text; _t record; _st text; _newcase case_status;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not (has_role(_uid, 'deputy_chair') or has_role(_uid, 'board_chair')) then raise exception 'forbidden'; end if;
  select cd.status into _st from council_decisions cd where cd.case_id = _case_id for update;
  if _st <> 'voting' then raise exception 'القرار ليس في التصويت (%).', _st; end if;
  select * into _t from public.council_tally(_case_id);
  if not _t.closed then raise exception 'لم يُغلق التصويت بعد (بلوغ 4/7 أو انتهاء المهلة).'; end if;
  if _t.outcome = 'reject' and (_reason is null or btrim(_reason) = '') then
    raise exception 'قرار الرفض يتطلّب تسبيباً مكتوباً (م21).';
  end if;
  select ref_no into _ref from protection_cases where id = _case_id;

  update council_decisions
     set status = 'issued', issued_type = _t.outcome, issued_reason = _reason, issued_at = now(), updated_at = now()
   where case_id = _case_id;

  _newcase := case _t.outcome when 'accept' then 'accepted'::case_status else 'rejected'::case_status end;
  update protection_cases set status = _newcase, updated_at = now() where id = _case_id;

  insert into board_decisions (case_id, type, justification, decided_at)
  values (_case_id, case _t.outcome when 'accept' then 'accept'::decision_type else 'reject'::decision_type end,
          coalesce(_reason, 'قرار المجلس'), now());

  insert into notifications (case_id, type, title, body, target_tab, sent_at)
  values (_case_id, 'decision',
    case _t.outcome when 'accept' then 'صدر قرار قبول طلب الحماية' else 'صدر قرار بشأن طلب الحماية' end,
    case _t.outcome when 'accept' then 'أصدر المجلس قراره بقبول طلبك؛ سيُتواصل معك لتوقيع اتفاقية الحماية (م11).'
                    else 'أصدر المجلس قراره بشأن طلبك. لك حقّ التظلّم خلال 10 أيام (م21).' end,
    'requests', now());

  insert into audit_log (actor_id, action, target) values (_uid, 'council_issue_' || _t.outcome, _ref);
  return query select _t.outcome;
end $$;
grant execute on function public.council_issue(uuid, text) to authenticated;

-- ── سياسات قراءة مرحلة القرار (المعدّ case_officer + المجلس يقرؤون الحزمة) ──
create policy co_decision_read on protection_cases for select using (
  has_role(auth.uid(),'case_officer') and status in ('in_decision','accepted','rejected'));
create policy co_req_decision_read on protection_requests for select using (
  (has_role(auth.uid(),'case_officer') or has_role(auth.uid(),'board_member')
   or has_role(auth.uid(),'board_chair') or has_role(auth.uid(),'deputy_chair'))
  and exists (select 1 from protection_cases c where c.id = protection_requests.case_id
              and c.status in ('in_decision','accepted','rejected')));
create policy co_study_read  on studies     for select using (has_role(auth.uid(),'case_officer'));
create policy co_assess_read on assessments for select using (has_role(auth.uid(),'case_officer'));
