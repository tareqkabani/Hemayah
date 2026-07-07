-- ============================================================
--  بوابة موظف المركز — الفرز المبدئي (CO-1)
--  محاضر الاتصال + مراجعات الفرز + سياسات المنسّق (وارد مشترك) + دالة القرار.
-- ============================================================

-- محاضر الاتصال (محضرٌ واحد شرطٌ لأيّ قرار فرز).
create table contact_logs (
  id         uuid primary key default gen_random_uuid(),
  case_id    uuid not null references protection_cases(id) on delete cascade,
  officer_id uuid references auth.users(id),
  channel    text not null default 'phone',       -- phone | email | in_person | other
  summary    text not null,
  created_at timestamptz default now()
);
create index on contact_logs (case_id, created_at);

-- مراجعة الفرز: الفحص الشكليّ (5 بنود) + القرار + السبب.
create table triage_reviews (
  id           uuid primary key default gen_random_uuid(),
  case_id      uuid not null references protection_cases(id) on delete cascade,
  officer_id   uuid references auth.users(id),
  formal_check jsonb not null default '{}'::jsonb, -- {identity, jurisdiction, crime_covered, applicant_capacity, no_duplicate}
  decision     text not null,                      -- study | refer | close
  reason       text,
  authority    text,                               -- عند الإحالة
  created_at   timestamptz default now()
);
create index on triage_reviews (case_id);

alter table contact_logs   enable row level security;
alter table triage_reviews enable row level security;

-- ── سياسات المنسّق (case_officer) ──
-- الوارد المشترك: يرى كل الحالات في حالة الفرز.
create policy co_triage_inbox on protection_cases for select using (
  has_role(auth.uid(), 'case_officer') and status = 'triage');
-- يقرأ تفاصيل الطلب لحالات الفرز.
create policy co_triage_req on protection_requests for select using (
  has_role(auth.uid(), 'case_officer')
  and exists (select 1 from protection_cases c where c.id = protection_requests.case_id and c.status = 'triage'));
-- محاضر الاتصال: يقرأ ويكتب لحالاته.
create policy co_contact_rw on contact_logs for all using (
  has_role(auth.uid(), 'case_officer'))
  with check (has_role(auth.uid(), 'case_officer') and officer_id = auth.uid());
-- مراجعات الفرز: قراءة (الكتابة عبر الدالة الآمنة).
create policy co_review_read on triage_reviews for select using (has_role(auth.uid(), 'case_officer'));

grant select, insert, update, delete on contact_logs to authenticated;
grant select, insert, update, delete on triage_reviews to authenticated;

-- ── دالة قرار الفرز (SECURITY DEFINER) — تفرض القواعد ذرّياً ──
create or replace function public.triage_decide(
  _case_id uuid, _decision text, _reason text,
  _formal_check jsonb default '{}'::jsonb, _authority text default null
) returns table(status case_status)
language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _cur case_status; _new case_status; _ref text;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid, 'case_officer') then raise exception 'forbidden: not case_officer'; end if;

  select c.status, c.ref_no into _cur, _ref from protection_cases c where c.id = _case_id for update;
  if _cur is null then raise exception 'case not found'; end if;
  if _cur <> 'triage' then raise exception 'case not in triage (%).', _cur; end if;

  -- شرط: محضر اتصالٍ واحد على الأقل قبل أي قرار (م — الفرز).
  if not exists (select 1 from contact_logs where case_id = _case_id) then
    raise exception 'محضر اتصالٍ واحد شرطٌ قبل القرار.';
  end if;

  _new := case _decision
            when 'study' then 'under_study'::case_status
            when 'refer' then 'referred'::case_status
            when 'close' then 'closed'::case_status
            else null end;
  if _new is null then raise exception 'قرار غير معروف: %', _decision; end if;
  if _decision = 'close' and (_reason is null or btrim(_reason) = '') then
    raise exception 'الحفظ يتطلّب سبباً موثّقاً (م10).';
  end if;

  update protection_cases
     set status = _new, officer_id = coalesce(officer_id, _uid), updated_at = now()
   where id = _case_id;

  insert into triage_reviews (case_id, officer_id, formal_check, decision, reason, authority)
  values (_case_id, _uid, coalesce(_formal_check, '{}'::jsonb), _decision, _reason, _authority);

  -- عند الإحالة: أنشئ توصيةً مستحقّة خلال 5 أيام عمل (م9).
  if _decision = 'refer' then
    insert into recommendations (case_id, source_body, raised_at, due_at)
    values (_case_id, _authority, now(), now() + interval '5 days');
  end if;

  insert into audit_log (actor_id, action, target)
  values (_uid, 'triage_' || _decision, _ref);

  -- إشعار المستفيد بتقدّم الحالة.
  insert into notifications (case_id, type, title, body, target_tab, sent_at)
  values (_case_id, 'triage',
    case _decision when 'study' then 'انتقل طلبك إلى الدراسة'
                   when 'refer' then 'أُحيل طلبك إلى الجهة المختصة'
                   else 'حُفظ طلبك' end,
    case _decision when 'study' then 'اجتاز طلبك الفرز المبدئي وانتقل إلى مرحلة الدراسة والتقييم.'
                   when 'refer' then 'أُحيل طلبك إلى الجهة المختصة لرفع التوصية خلال 5 أيام عمل.'
                   else coalesce(_reason, 'حُفظ الطلب.') end,
    'requests', now());

  return query select _new;
end $$;

grant execute on function public.triage_decide(uuid, text, text, jsonb, text) to authenticated;
