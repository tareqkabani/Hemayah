-- ============================================================
--  منصّة «حماية» — المراسلات والإشعارات + Realtime (M5/M7)
--  جدول messages · حقول عرض notifications · سياسات المستفيد · نشر Realtime.
-- ============================================================

-- ── المراسلات ──
create type msg_thread as enum ('center', 'body');   -- خيط المركز / الجهة المختصة
create type msg_dir    as enum ('in', 'out', 'note'); -- وارد / صادر / محضر هاتفيّ

create table messages (
  id           uuid primary key default gen_random_uuid(),
  case_id      uuid not null references protection_cases(id) on delete cascade,
  thread       msg_thread not null default 'center',
  direction    msg_dir    not null,
  body         text not null,
  sender_label text,
  created_at   timestamptz default now()
);
create index on messages (case_id, thread, created_at);
alter table messages enable row level security;

-- ── حقول عرض الإشعارات ──
alter table notifications add column if not exists title      text;
alter table notifications add column if not exists body       text;
alter table notifications add column if not exists read       boolean default false;
alter table notifications add column if not exists target_tab text;

-- ── سياسات المستفيد ──
create policy seeker_msg_read on messages for select using (
  exists (select 1 from protection_cases c where c.id = messages.case_id and c.submitted_by = auth.uid()));
-- المستفيد يردّ فقط (صادر) على قضاياه
create policy seeker_msg_reply on messages for insert with check (
  direction = 'out' and exists (select 1 from protection_cases c where c.id = case_id and c.submitted_by = auth.uid()));

create policy seeker_notif_read on notifications for select using (
  exists (select 1 from protection_cases c where c.id = notifications.case_id and c.submitted_by = auth.uid()));
create policy seeker_notif_mark on notifications for update using (
  exists (select 1 from protection_cases c where c.id = notifications.case_id and c.submitted_by = auth.uid()))
  with check (true);

-- ── Realtime: انشر الجداول واضبط هوية النسخة لالتقاط التحديثات ──
alter table protection_cases replica identity full;
alter table messages         replica identity full;
alter table notifications    replica identity full;
alter publication supabase_realtime add table protection_cases;
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table notifications;

-- ── توسعة دالة التقديم: رسالة مركز أوّليّة + إشعار استلام ──
create or replace function public.submit_protection_request(
  _applicant_role text, _category app_category, _entity text,
  _crime text, _reason text, _prior_submit boolean, _case_no text,
  _details jsonb default '{}'::jsonb
) returns table(case_id uuid, ref_no text, secret_code text)
language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _cid uuid; _ref text; _sec text; _yr text := extract(year from now())::text;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if _crime is null or btrim(_crime) = '' or _reason is null or btrim(_reason) = '' then
    raise exception 'الجريمة والمسوّغات مطلوبة';
  end if;
  _ref := 'REF-' || _yr || '-' || nextval('seeker_ref_seq')::text;
  _sec := 'C-'  || _yr || '-' || lpad(nextval('seeker_secret_seq')::text, 4, '0');

  insert into protection_cases (ref_no, secret_code, category, status, source, submitted_by)
  values (_ref, _sec, _category, 'triage', 'local', _uid) returning id into _cid;

  insert into protection_requests (case_id, applicant_role, channel, details)
  values (_cid, _applicant_role, 'seeker',
          coalesce(_details, '{}'::jsonb) || jsonb_build_object('entity', _entity, 'crime', _crime,
            'reason', _reason, 'prior_submit', _prior_submit, 'case_no', _case_no));

  insert into messages (case_id, thread, direction, body, sender_label)
  values (_cid, 'center', 'in',
          'مرحباً، تسلّمنا طلبك ونراجع بياناته في مرحلة الفرز المبدئي. سنتواصل معك إن لزم استيفاء.',
          'منسّق الحماية');

  insert into notifications (case_id, type, title, body, target_tab, sent_at)
  values (_cid, 'submission', 'تم استلام طلبك',
          'سُجِّل طلبك ' || _ref || ' وأُسند له رمز سري (' || _sec || '). سيُحال إلى الجهة المختصة لرفع التوصية خلال 5 أيام.',
          'requests', now());

  insert into audit_log (actor_id, action, target) values (_uid, 'submit_protection_request', _ref);
  return query select _cid, _ref, _sec;
end $$;
