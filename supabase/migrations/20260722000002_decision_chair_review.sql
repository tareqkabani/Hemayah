-- ============================================================
--  حلقة مراجعة الرئيس قبل الطرح — قاعدة ملزمة من صاحب المنصة (2026-07-22):
--  «كل الدراسات والتقييمات تذهب لمعدّ قرار المركز الذي يعرضها ويراجعها
--   على نائب رئيس المركز ورئيس مركز الحماية قبل طرحها للتصويت من قِبل
--   أعضاء المجلس بمن فيهم النائب والرئيس».
--  الدورة تصير سداسية:
--    preparing → pending_deputy → pending_chair → approved → voting → issued
--  (التصويت كان أصلاً بسبعة مقاعد تشمل النائب والرئيس — لا تغيير فيه.)
-- ============================================================

alter table council_decisions add column if not exists chair_approved_at timestamptz;

alter table council_decisions drop constraint if exists council_decisions_status_check;
alter table council_decisions add constraint council_decisions_status_check
  check (status in ('preparing','pending_deputy','pending_chair','approved','voting','issued'));

comment on table council_decisions is
  'قرار المركز (CO-3): preparing → pending_deputy → pending_chair → approved → voting → issued — مراجعة النائب ثم الرئيس قبل الطرح، والإصدار بيد الرئيس (قاعدة 22 يوليو 2026).';

-- ── اعتماد النائب: يمرّر إلى مراجعة الرئيس (لا إلى الطرح مباشرة) ──
create or replace function public.council_approve(_case_id uuid)
returns table(status text) language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _st text; _ref text;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid, 'deputy_chair') then raise exception 'غير مصرَّح: هذا الاعتماد لنائب رئيس المركز حصراً.'; end if;
  select cd.status into _st from council_decisions cd where cd.case_id = _case_id for update;
  if _st is distinct from 'pending_deputy' then raise exception 'القرار ليس بانتظار اعتماد النائب (%).', _st; end if;
  select ref_no into _ref from protection_cases where id = _case_id;
  update council_decisions set deputy_approved_at = now(), status = 'pending_chair', updated_at = now()
   where case_id = _case_id;
  insert into audit_log (actor_id, action, target) values (_uid, 'council_approve_deputy', _ref);
  return query select 'pending_chair'::text;
end $$;

-- ── اعتماد الرئيس: الحلقة الثانية — بعدها يعود للمعدّ للطرح ──
create or replace function public.council_approve_chair(_case_id uuid)
returns table(status text) language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _st text; _ref text;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid, 'board_chair') then raise exception 'غير مصرَّح: هذا الاعتماد لرئيس المركز حصراً.'; end if;
  select cd.status into _st from council_decisions cd where cd.case_id = _case_id for update;
  if _st is distinct from 'pending_chair' then raise exception 'القرار ليس بانتظار اعتماد الرئيس (%).', _st; end if;
  select ref_no into _ref from protection_cases where id = _case_id;
  update council_decisions set chair_approved_at = now(), status = 'approved', updated_at = now()
   where case_id = _case_id;
  insert into audit_log (actor_id, action, target) values (_uid, 'council_approve_chair', _ref);
  return query select 'approved'::text;
end $$;
grant execute on function public.council_approve_chair(uuid) to authenticated;

-- ── الإعادة للمعدّ بملاحظة إلزامية — كلٌّ من حلقته: النائب من حلقته والرئيس من حلقته ──
create or replace function public.council_return(_case_id uuid, _note text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _ref text; _from text;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if _note is null or btrim(_note) = '' then raise exception 'ملاحظة الإعادة إلزامية.'; end if;
  if has_role(_uid, 'deputy_chair') then _from := 'pending_deputy';
  elsif has_role(_uid, 'board_chair') then _from := 'pending_chair';
  else raise exception 'غير مصرَّح: الإعادة لنائب الرئيس أو الرئيس حصراً.'; end if;
  select ref_no into _ref from protection_cases where id = _case_id;
  update council_decisions
     set status = 'preparing', deputy_approved_at = null, chair_approved_at = null, submitted_at = null,
         rejections = rejections || jsonb_build_object('by', _uid, 'note', _note, 'at', now()), updated_at = now()
   where case_id = _case_id and status = _from;
  if not found then raise exception 'القرار ليس في حلقة اعتمادك.'; end if;
  insert into audit_log (actor_id, action, target) values (_uid, 'council_return', _ref);
end $$;

-- ── الطرح: يبقى مشروطاً بـ approved — أي بعد الحلقتين معاً ──
create or replace function public.council_open_voting(_case_id uuid)
returns table(status text) language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _st text; _prep uuid; _ref text;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid, 'case_officer') then raise exception 'forbidden: not preparer'; end if;
  select cd.status, cd.preparer_id into _st, _prep from council_decisions cd where cd.case_id = _case_id for update;
  if _st is null then raise exception 'لا قرار لهذه القضية.'; end if;
  if _prep is not null and _prep <> _uid then raise exception 'الطرح لمعدّ هذا القرار حصراً.'; end if;
  if _st is distinct from 'approved' then raise exception 'لا طرح قبل اعتماد النائب والرئيس (الحالة %).', _st; end if;
  select ref_no into _ref from protection_cases where id = _case_id;
  update council_decisions set status = 'voting', voting_started_at = now(), deadline_closed = false, updated_at = now()
   where case_id = _case_id;
  insert into audit_log (actor_id, action, target) values (_uid, 'council_open_voting', _ref);
  return query select 'voting'::text;
end $$;

-- ── تعبئة رجعية: المعتمَد بلا مراجعة رئيس يعود لحلقة الرئيس (تطبيقاً للقاعدة) ──
update council_decisions set status = 'pending_chair', updated_at = now()
 where status = 'approved' and chair_approved_at is null;
