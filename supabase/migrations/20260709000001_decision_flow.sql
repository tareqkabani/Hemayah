-- ============================================================
--  المسار الجديد لمرحلة «القرار والإشعار» (بطلب رئيس المركز)
--  مسارٌ منفصلٌ تماماً — لا يمسّ الجداول/الدوال/السياسات السابقة.
--  المعدّ هو المنطلق: يُنشئ الطلب (اسم + هوية) → يرفع كل المرفقات (طلب الحماية
--  حتى قرار المركز المُعَدّ) → إقرار الاكتمال → طرحٌ مباشرٌ للتصويت.
--  آلة الحالة: preparing → voting → issued  (بلا اعتماد مسبق).
--  المرفقات في Supabase Storage (دلو decision-docs). عزل RLS + سلسلة تدقيق.
-- ============================================================

-- ── تسلسلات الترميز (مستقلّة، بلا تعارض مع الرموز القائمة) ──
-- يبدأ بعد الرموز المبذورة (9101/9102) لتفادي التعارض
create sequence if not exists decision_flow_secret_seq start 9110;

-- ── الجداول ──────────────────────────────────────────────
-- طلب القرار (يُنشئه المعدّ من الصفر — مرجعٌ في النظام: اسم + هوية غير موثّقة).
create table if not exists decision_requests (
  id                   uuid primary key default gen_random_uuid(),
  secret_code          text unique not null,
  applicant_name       text not null,
  applicant_nid        text not null,
  category             text default '—',
  risk                 text default '—',
  preparer_id          uuid references auth.users(id),
  status               text not null default 'preparing',   -- preparing|voting|issued
  package_confirmed     boolean not null default false,
  package_confirmed_at timestamptz,
  voting_started_at    timestamptz,
  deadline_closed      boolean not null default false,
  issued_type          text,                                 -- accept|reject
  issued_reason        text,
  issued_at            timestamptz,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);
create index if not exists idx_decreq_status on decision_requests (status);
create index if not exists idx_decreq_prep   on decision_requests (preparer_id);

-- مرفقات القضية — كل مستند ملفٌّ يرفعه المعدّ (طلب الحماية … قرار المركز المُعَدّ).
create table if not exists decision_attachments (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid not null references decision_requests(id) on delete cascade,
  doc_id        text not null,                                -- req|erec|study|psych|decision|x<...>
  doc_group     text not null default 'other',
  label         text not null,
  required      boolean not null default false,
  file_name     text,
  storage_path  text,
  uploaded_by   uuid references auth.users(id),
  updated_at    timestamptz default now(),
  unique (request_id, doc_id)
);
create index if not exists idx_decatt_req on decision_attachments (request_id);

-- أصوات المجلس — صوتٌ واحد لكل عضوٍ على الطلب (عزلٌ صفّيّ صارم).
create table if not exists decision_votes (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references decision_requests(id) on delete cascade,
  voter_id    uuid not null references auth.users(id),
  choice      text not null,                                  -- accept|reject
  note        text,
  voted_at    timestamptz default now(),
  unique (request_id, voter_id)
);
create index if not exists idx_decvotes_req on decision_votes (request_id);

alter table decision_requests    enable row level security;
alter table decision_attachments enable row level security;
alter table decision_votes       enable row level security;

-- ── مساعدات (SECURITY DEFINER لتفادي تكرار RLS) ──────────
create or replace function public.is_council(_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_roles
    where user_id = _uid and role in ('board_member','board_chair','deputy_chair')
  );
$$;

-- هل يرى المستخدمُ هذا الطلب؟ المعدّ يرى طلبه؛ المجلس يرى المطروح/الصادر.
create or replace function public.dec_req_visible(_request_id uuid, _uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from decision_requests r
    where r.id = _request_id
      and (r.preparer_id = _uid
           or (is_council(_uid) and r.status in ('voting','issued')))
  );
$$;

-- ── العزل (RLS) — القراءة فقط للعملاء؛ الكتابة عبر RPCs ──
create policy decreq_read on decision_requests for select using (
  preparer_id = auth.uid()
  or (is_council(auth.uid()) and status in ('voting','issued'))
);
create policy decatt_read on decision_attachments for select using (
  dec_req_visible(request_id, auth.uid())
);
-- الأصوات: العضو يرى صوته فقط؛ القيادة (النائب/الرئيس) تطّلع على الحصيلة كاملةً.
create policy decvote_own on decision_votes for select using (
  voter_id = auth.uid()
  or has_role(auth.uid(),'board_chair') or has_role(auth.uid(),'deputy_chair')
);

grant select on decision_requests, decision_attachments, decision_votes to authenticated;

-- ── دلو التخزين + سياساته ────────────────────────────────
insert into storage.buckets (id, name, public)
values ('decision-docs', 'decision-docs', false)
on conflict (id) do nothing;

-- المعدّ (case_officer) يرفع/يستبدل/يحذف مرفقات؛ المعدّ والمجلس يقرؤون.
drop policy if exists decdocs_write  on storage.objects;
drop policy if exists decdocs_update on storage.objects;
drop policy if exists decdocs_delete on storage.objects;
drop policy if exists decdocs_read   on storage.objects;
create policy decdocs_write on storage.objects for insert to authenticated
  with check (bucket_id = 'decision-docs' and has_role(auth.uid(),'case_officer'));
create policy decdocs_update on storage.objects for update to authenticated
  using (bucket_id = 'decision-docs' and has_role(auth.uid(),'case_officer'));
create policy decdocs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'decision-docs' and has_role(auth.uid(),'case_officer'));
create policy decdocs_read on storage.objects for select to authenticated
  using (bucket_id = 'decision-docs' and (has_role(auth.uid(),'case_officer') or is_council(auth.uid())));

-- ── حصيلة التصويت (أغلبية 4/7؛ العدد فردي فلا تعادل عند اكتمال النصاب) ──
create or replace function public.dec_tally(_request_id uuid)
returns table(accept int, reject int, cast_n int, pending int, closed boolean, outcome text)
language plpgsql stable security definer set search_path = public as $$
declare
  _acc int; _rej int; _cast int; _dl boolean; _majority int := 4; _seats int := 7;
begin
  select
    count(*) filter (where v.choice = 'accept'),
    count(*) filter (where v.choice = 'reject'),
    count(*)
  into _acc, _rej, _cast
  from decision_votes v where v.request_id = _request_id;
  select r.deadline_closed into _dl from decision_requests r where r.id = _request_id;

  accept := _acc; reject := _rej; cast_n := _cast; pending := _seats - _cast;
  if _acc >= _majority then closed := true; outcome := 'accept';
  elsif _rej >= _majority then closed := true; outcome := 'reject';
  elsif _cast >= _seats then closed := true; outcome := case when _acc >= _rej then 'accept' else 'reject' end;
  elsif coalesce(_dl,false) and _cast > 0 then closed := true; outcome := case when _acc >= _rej then 'accept' else 'reject' end;
  else closed := false; outcome := null; end if;
  return next;
end $$;

-- ============================================================
--  الأفعال (SECURITY DEFINER) — تفرض الدور وآلة الحالة ذرّياً
-- ============================================================

-- المعدّ يُنشئ طلباً جديداً (المنطلق) — يعيد المعرّف والرمز السري.
create or replace function public.dec_create_request(_name text, _nid text)
returns table(id uuid, secret_code text)
language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _sec text; _id uuid; _yr text := '2026';
begin
  if not has_role(_uid,'case_officer') then raise exception 'غير مصرَّح: معدّ القرار فقط.'; end if;
  if length(coalesce(trim(_name),'')) < 3 then raise exception 'اسم طالب الحماية غير صالح.'; end if;
  if _nid !~ '^[0-9]{10}$' then raise exception 'رقم الهوية يجب أن يكون 10 أرقام.'; end if;
  _sec := 'C-' || _yr || '-' || nextval('decision_flow_secret_seq')::text;
  insert into decision_requests (secret_code, applicant_name, applicant_nid, preparer_id, status)
    values (_sec, trim(_name), trim(_nid), _uid, 'preparing')
    returning decision_requests.id into _id;
  insert into audit_log (actor_id, action, target) values (_uid, 'dec_create_request', _sec);
  id := _id; secret_code := _sec; return next;
end $$;

-- المعدّ يرفع/يحدّث مرفقاً (upsert). للمرفق المخصّص: doc_id جديد + group='other'.
create or replace function public.dec_set_attachment(
  _request_id uuid, _doc_id text, _group text, _label text, _required boolean,
  _file_name text, _storage_path text)
returns void language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _st text; _sec text;
begin
  select status, secret_code into _st, _sec from decision_requests where id = _request_id;
  if _sec is null then raise exception 'طلب غير موجود.'; end if;
  if not (has_role(_uid,'case_officer') and exists (select 1 from decision_requests where id = _request_id and preparer_id = _uid))
    then raise exception 'غير مصرَّح: معدّ الطلب فقط.'; end if;
  if _st <> 'preparing' then raise exception 'لا تعديل على المرفقات بعد الطرح للتصويت.'; end if;
  insert into decision_attachments (request_id, doc_id, doc_group, label, required, file_name, storage_path, uploaded_by, updated_at)
    values (_request_id, _doc_id, coalesce(_group,'other'), _label, coalesce(_required,false), _file_name, _storage_path, _uid, now())
  on conflict (request_id, doc_id) do update
    set label = excluded.label, doc_group = excluded.doc_group, required = excluded.required,
        file_name = excluded.file_name, storage_path = excluded.storage_path, uploaded_by = _uid, updated_at = now();
  insert into audit_log (actor_id, action, target) values (_uid, 'dec_set_attachment', _sec || '/' || _doc_id);
end $$;

-- المعدّ يزيل مرفقاً (يفرّغ الملف؛ يُبقي القالب الافتراضي، ويحذف المخصّص).
create or replace function public.dec_remove_attachment(_request_id uuid, _doc_id text)
returns void language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _st text; _sec text;
begin
  select status, secret_code into _st, _sec from decision_requests where id = _request_id;
  if not (has_role(_uid,'case_officer') and exists (select 1 from decision_requests where id = _request_id and preparer_id = _uid))
    then raise exception 'غير مصرَّح.'; end if;
  if _st <> 'preparing' then raise exception 'لا تعديل بعد الطرح للتصويت.'; end if;
  update decision_attachments set file_name = null, storage_path = null, updated_at = now()
    where request_id = _request_id and doc_id = _doc_id;
  insert into audit_log (actor_id, action, target) values (_uid, 'dec_remove_attachment', _sec || '/' || _doc_id);
end $$;

-- المعدّ يطرح الحزمة للتصويت مباشرةً (يشترط رفع المرفقات الخمسة المطلوبة).
create or replace function public.dec_submit_voting(_request_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _st text; _sec text; _req_ok int;
begin
  select status, secret_code into _st, _sec from decision_requests where id = _request_id;
  if not (has_role(_uid,'case_officer') and exists (select 1 from decision_requests where id = _request_id and preparer_id = _uid))
    then raise exception 'غير مصرَّح: معدّ الطلب فقط.'; end if;
  if _st <> 'preparing' then raise exception 'الطلب مطروحٌ للتصويت أو صدر بالفعل.'; end if;
  select count(*) into _req_ok from decision_attachments
    where request_id = _request_id and doc_id in ('req','erec','study','psych','decision') and file_name is not null;
  if _req_ok < 5 then raise exception 'يجب إرفاق كل المستندات المطلوبة قبل الطرح للتصويت.'; end if;
  update decision_requests
    set status = 'voting', package_confirmed = true, package_confirmed_at = now(),
        voting_started_at = now(), updated_at = now()
    where id = _request_id;
  insert into audit_log (actor_id, action, target) values (_uid, 'dec_submit_voting', _sec);
end $$;

-- عضو المجلس/القيادة يصوّت (قبول/رفض؛ الرفض بتسبيب). عزلٌ صفّيّ عبر voter_id.
create or replace function public.dec_cast_vote(_request_id uuid, _choice text, _note text)
returns void language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _st text; _sec text;
begin
  select status, secret_code into _st, _sec from decision_requests where id = _request_id;
  if _sec is null then raise exception 'طلب غير موجود.'; end if;
  if not is_council(_uid) then raise exception 'غير مصرَّح: أعضاء المجلس فقط.'; end if;
  if _st <> 'voting' then raise exception 'التصويت غير مفتوح على هذا الطلب.'; end if;
  if _choice not in ('accept','reject') then raise exception 'خيار تصويت غير صالح.'; end if;
  if _choice = 'reject' and length(coalesce(trim(_note),'')) = 0 then raise exception 'الرفض يتطلّب تسبيباً.'; end if;
  insert into decision_votes (request_id, voter_id, choice, note)
    values (_request_id, _uid, _choice, nullif(trim(_note),''))
  on conflict (request_id, voter_id) do update set choice = excluded.choice, note = excluded.note, voted_at = now();
  insert into audit_log (actor_id, action, target) values (_uid, 'dec_cast_vote', _sec);
end $$;

-- القيادة تُغلق التصويت بانتهاء يوم العمل (يُحسم بأغلبية المصوّتين).
create or replace function public.dec_close_deadline(_request_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _sec text;
begin
  select secret_code into _sec from decision_requests where id = _request_id;
  if not (has_role(_uid,'board_chair') or has_role(_uid,'deputy_chair')) then raise exception 'غير مصرَّح: القيادة فقط.'; end if;
  update decision_requests set deadline_closed = true, updated_at = now() where id = _request_id and status = 'voting';
  insert into audit_log (actor_id, action, target) values (_uid, 'dec_close_deadline', _sec);
end $$;

-- رئيس المركز يُصدر القرار بعد إغلاق التصويت → إشعار (تدقيق).
create or replace function public.dec_issue(_request_id uuid, _type text, _reason text)
returns void language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _st text; _sec text; _t record;
begin
  select status, secret_code into _st, _sec from decision_requests where id = _request_id;
  if not has_role(_uid,'board_chair') then raise exception 'غير مصرَّح: الإصدار بيد رئيس المركز فقط.'; end if;
  if _st <> 'voting' then raise exception 'لا يُصدَر إلا طلبٌ مطروحٌ للتصويت.'; end if;
  select * into _t from dec_tally(_request_id);
  if not _t.closed then raise exception 'لم يُغلق التصويت بعد (لم تُبلَغ الأغلبية ولم تنتهِ المهلة).'; end if;
  if _type not in ('accept','reject') then raise exception 'نوع إصدار غير صالح.'; end if;
  if _type = 'reject' and length(coalesce(trim(_reason),'')) = 0 then raise exception 'قرار الرفض يتطلّب تسبيباً.'; end if;
  update decision_requests
    set status = 'issued', issued_type = _type, issued_reason = nullif(trim(_reason),''), issued_at = now(), updated_at = now()
    where id = _request_id;
  insert into audit_log (actor_id, action, target) values (_uid, 'dec_issue_' || _type, _sec);
end $$;

grant execute on function public.dec_create_request(text,text) to authenticated;
grant execute on function public.dec_set_attachment(uuid,text,text,text,boolean,text,text) to authenticated;
grant execute on function public.dec_remove_attachment(uuid,text) to authenticated;
grant execute on function public.dec_submit_voting(uuid) to authenticated;
grant execute on function public.dec_cast_vote(uuid,text,text) to authenticated;
grant execute on function public.dec_close_deadline(uuid) to authenticated;
grant execute on function public.dec_issue(uuid,text,text) to authenticated;
grant execute on function public.dec_tally(uuid) to authenticated;

-- ── بذرة تجريبية (طلبٌ مطروحٌ للتصويت للأعضاء/القيادة + طلبٌ قيد الإعداد للمعدّ) ──
do $$
declare _prep uuid; _m1 uuid; _m2 uuid; _r1 uuid; _r2 uuid;
begin
  select id into _prep from auth.users where email = '2000000005@nafath.local';
  select id into _m1   from auth.users where email = '2000000061@nafath.local';
  select id into _m2   from auth.users where email = '2000000062@nafath.local';
  if _prep is null then return; end if;

  if not exists (select 1 from decision_requests where secret_code = 'C-2026-9101') then
    insert into decision_requests (secret_code, applicant_name, applicant_nid, category, risk, preparer_id,
      status, package_confirmed, package_confirmed_at, voting_started_at)
    values ('C-2026-9101','محمد عبدالله القحطاني','1098234567','شاهد','عالٍ', _prep,
      'voting', true, now(), now())
    returning id into _r1;
    insert into decision_attachments (request_id, doc_id, doc_group, label, required, file_name, uploaded_by) values
      (_r1,'req','request','طلب الحماية',true,'طلب-الحماية-C-9101.pdf',_prep),
      (_r1,'erec','entityRec','توصية الجهة المختصة',true,'توصية-النيابة-العامة.pdf',_prep),
      (_r1,'study','study','جميع الدراسات الخاصة بالطلب',true,'الدراسات-القانونية.pdf',_prep),
      (_r1,'psych','assessment','جميع التقييمات الخاصة بالطلب',true,'التقييمات.pdf',_prep),
      (_r1,'decision','decision','قرار المركز المُعَدّ',true,'قرار-المركز-المُعَدّ.pdf',_prep);
    if _m1 is not null then insert into decision_votes (request_id, voter_id, choice) values (_r1,_m1,'accept'); end if;
    if _m2 is not null then insert into decision_votes (request_id, voter_id, choice) values (_r1,_m2,'accept'); end if;
  end if;

  if not exists (select 1 from decision_requests where secret_code = 'C-2026-9102') then
    insert into decision_requests (secret_code, applicant_name, applicant_nid, category, risk, preparer_id, status)
    values ('C-2026-9102','سارة أحمد الدوسري','1076551220','—','—', _prep, 'preparing')
    returning id into _r2;
  end if;
end $$;
