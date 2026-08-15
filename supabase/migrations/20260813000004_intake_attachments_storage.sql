-- ============================================================
--  مرفقات الإدخال اليدوي — رفعٌ حقيقيّ بدل اسمٍ نصّيّ (فجوة الإنتاج ١)
--
--  الحال قبل اليوم: الموظف يختار ملفاً فيُخزَّن **اسمه** نصّاً في
--  protection_requests.details.attachments، والملف نفسه يبقى على جهازه.
--  فيظهر في الفرز والدراسة سطرٌ لا يُفتح: مرفقٌ بالاسم لا بالمضمون —
--  وسندُ التدقيق ناقص، وصورةُ الهوية اللازمة للاتفاقية (م11) لا وجود لها.
--  وشرطُ «المرفقات الإلزامية» كان يُفحص في المتصفح وحده فيُتجاوَز بسهولة.
--
--  ما هنا:
--    · دلوٌ خاصّ intake-docs (غير عامّ) بسياساتٍ بالدور — كلٌّ يكتب في
--      مجلّده وحده، فلا يدهس موظفٌ ملفَّ زميله ولا يقرأه بمسارٍ مخمَّن.
--    · جدول intake_attachments: سجلّ المرفق (المسار · الاسم · النوع ·
--      الحجم · مَن رفعه) مربوطاً بقيد الورود، ثمّ بالقضية عند التفريغ.
--    · قراءةٌ مقيَّدة بالدور والإسناد (intake_case_attachments) — لا
--      قراءة مباشرة على الجدول لغير منسوبي الوحدة.
--    · فحص المرفق الإلزامي **على الخادم**: خطاب الجهة نيابةً عن الشخص
--      لا يُسجَّل بلا مرفق. (كان في الواجهة وحدها.)
--
--  الرفع نفسه يقع من المتصفح إلى Storage تحت سياسات هذا الملف، ثمّ يُقيَّد
--  السجلّ بدالّة — فلا يمرّ الملفّ بخادم التطبيق ولا يُحمَّل في ذاكرته.
-- ============================================================

-- ── 1) الدلو ──
insert into storage.buckets (id, name, public)
values ('intake-docs', 'intake-docs', false)
on conflict (id) do nothing;

-- ── 2) سياسات التخزين ──
-- المسار: <uploader_uuid>/<random>.<ext> — أوّل مقطعٍ هو صاحب الملف،
-- فالكتابة والحذف محصورتان بمجلّد الرافع. والقراءة لمنسوبي الوحدة
-- ولموظف الفرز (يفحص المستند قبل قراره) — أمّا الدارس والمقيّم فيقرآن
-- عبر الرابط الموقَّع الذي تُصدره الدالّة المقيَّدة بالإسناد، لا مباشرةً.
drop policy if exists intakedocs_write  on storage.objects;
drop policy if exists intakedocs_update on storage.objects;
drop policy if exists intakedocs_delete on storage.objects;
drop policy if exists intakedocs_read   on storage.objects;

create policy intakedocs_write on storage.objects for insert to authenticated
  with check (
    bucket_id = 'intake-docs'
    and is_intake_staff(auth.uid())
    and (storage.foldername(name))[1] = auth.uid()::text);

create policy intakedocs_update on storage.objects for update to authenticated
  using (
    bucket_id = 'intake-docs'
    and is_intake_staff(auth.uid())
    and (storage.foldername(name))[1] = auth.uid()::text);

create policy intakedocs_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'intake-docs'
    and is_intake_staff(auth.uid())
    and (storage.foldername(name))[1] = auth.uid()::text);

create policy intakedocs_read on storage.objects for select to authenticated
  using (
    bucket_id = 'intake-docs'
    and (is_intake_staff(auth.uid()) or has_role(auth.uid(), 'case_officer')));

-- ── 3) سجلّ المرفقات ──
create table if not exists intake_attachments (
  id          uuid primary key default gen_random_uuid(),
  path        text not null unique,          -- مسار الكائن في الدلو
  file_name   text not null,                 -- الاسم كما رفعه الموظف (للعرض)
  mime        text,
  size_bytes  bigint,
  reg_no      text,                          -- التجميع قبل وجود القضية
  case_id     uuid references protection_cases(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id),
  created_at  timestamptz not null default now()
);
create index if not exists intake_attachments_case_idx on intake_attachments (case_id);
create index if not exists intake_attachments_reg_idx  on intake_attachments (reg_no) where case_id is null;

alter table intake_attachments enable row level security;

-- الكتابة كلّها بالدوالّ؛ والقراءة المباشرة لمنسوبي الوحدة (شاشة التفريغ).
drop policy if exists intake_att_read on intake_attachments;
create policy intake_att_read on intake_attachments for select
  using (is_intake_staff(auth.uid()));
grant select on intake_attachments to authenticated;

-- ── 4) تقييد المرفوع ──
create or replace function public.intake_attach_record(
  _path text, _file_name text, _mime text, _size bigint, _reg_no text
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _id uuid;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not is_intake_staff(_uid) then raise exception 'forbidden: not intake staff'; end if;
  if _path is null or btrim(_path) = '' then raise exception 'مسار الملف مطلوب'; end if;
  -- المسار يقع في مجلّد الرافع — نفس شرط سياسة التخزين، مؤكَّداً هنا أيضاً
  -- كي لا يُقيَّد سجلٌّ لمسارٍ لا يملكه صاحبه.
  if split_part(_path, '/', 1) <> _uid::text then
    raise exception 'مسار الملف خارج مجلّدك';
  end if;

  insert into intake_attachments (path, file_name, mime, size_bytes, reg_no, uploaded_by)
  values (btrim(_path), coalesce(nullif(btrim(_file_name), ''), 'مستند'),
          nullif(btrim(_mime), ''), _size, nullif(btrim(_reg_no), ''), _uid)
  returning id into _id;

  return _id;
end $$;
revoke execute on function public.intake_attach_record(text, text, text, bigint, text) from public, anon;
grant  execute on function public.intake_attach_record(text, text, text, bigint, text) to authenticated;

-- ── 5) حذف مرفقٍ قبل الإرسال (صاحبه وحده، وما لم يُربط بقضية) ──
create or replace function public.intake_attach_remove(_id uuid)
returns text
language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _path text; _case uuid; _owner uuid;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  select path, case_id, uploaded_by into _path, _case, _owner
    from intake_attachments where id = _id;
  if _path is null then raise exception 'المرفق غير موجود'; end if;
  if _owner <> _uid then raise exception 'ليس مرفقك'; end if;
  -- بعد الربط بالقضية يصير المرفق سنداً تدقيقياً — لا يُحذف من الواجهة.
  if _case is not null then raise exception 'المرفق مربوطٌ بطلبٍ مُسجَّل — لا يُحذف'; end if;

  delete from intake_attachments where id = _id;
  return _path;   -- تحذف الواجهة الكائن من الدلو بهذا المسار
end $$;
revoke execute on function public.intake_attach_remove(uuid) from public, anon;
grant  execute on function public.intake_attach_remove(uuid) to authenticated;

-- ── 6) ربط مرفقات القيد بالقضية عند التفريغ (مساعدٌ داخليّ) ──
create or replace function public._intake_attach_bind(_reg_no text, _case_id uuid, _uid uuid)
returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare _n integer := 0;
begin
  if _reg_no is null or btrim(_reg_no) = '' or _case_id is null then return 0; end if;
  update intake_attachments
     set case_id = _case_id
   where reg_no = btrim(_reg_no) and case_id is null and uploaded_by = _uid;
  get diagnostics _n = row_count;
  return _n;
end $$;
revoke execute on function public._intake_attach_bind(text, uuid, uuid) from public, anon;

-- ── 7) قراءةٌ مقيَّدة: من يقرأ مرفقات قضيةٍ بعينها ──
-- منسوب الوحدة (أدخلها) · موظف الفرز (يفحصها) · الدارس والمقيّم المُسنَدان
-- (يبنيان رأيهما عليها). ما عداهم لا يرى شيئاً — ولا مسارَ يُخمَّن.
create or replace function public.intake_case_attachments(_case_id uuid)
returns table(id uuid, path text, file_name text, mime text, size_bytes bigint, created_at timestamptz)
language plpgsql stable security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid();
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not (
       is_intake_staff(_uid)
    or has_role(_uid, 'case_officer')
    or is_assigned_study(_case_id)
    or is_assigned_assessment(_case_id)
  ) then
    raise exception 'forbidden: not authorized for this case';
  end if;

  return query
  select a.id, a.path, a.file_name, a.mime, a.size_bytes, a.created_at
    from intake_attachments a
   where a.case_id = _case_id
   order by a.created_at;
end $$;
revoke execute on function public.intake_case_attachments(uuid) from public, anon;
grant  execute on function public.intake_case_attachments(uuid) to authenticated;

-- ═══════════ 8) التفريغ — ربط المرفقات وفحص الإلزاميّ على الخادم ═══════════
-- إعادة كتابة نسخة 20260813000002 كاملةً (درس «آخر نسخة دالة») بزيادتين:
--   · _intake_attach_bind يربط مرفقات القيد بالقضية المُنشأة.
--   · خطاب الجهة «نيابةً عن الشخص» يُرفض بلا مرفقٍ واحد على الأقل —
--     الشرط كان في الواجهة وحدها، ومن يتجاوزها يُنشئ طلباً بلا سند.
drop function if exists public.submit_paper_intake(
  text, text, app_category, text, text, text, boolean, text, jsonb, date, text, uuid);

create or replace function public.submit_paper_intake(
  _source         text,          -- 'seeker' | 'entity'
  _applicant_role text,
  _category       app_category,
  _entity         text,
  _crime          text,
  _reason         text,
  _prior_submit   boolean,
  _case_no        text,
  _details        jsonb default '{}'::jsonb,
  _received_date  date  default null,
  _reg_no         text  default null,
  _inbox_id       uuid  default null
) returns table(case_id uuid, ref_no text, secret_code text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  _uid uuid := auth.uid();
  _cid uuid;
  _ref text;
  _sec text;
  _yr  text := extract(year from now())::text;
  _received timestamptz := coalesce(_received_date::timestamptz, now());
  _ec  jsonb;
  _id  jsonb;
  _ch  text;
  _verified boolean;
  _iv  jsonb;
  _att integer;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not is_intake_staff(_uid) then raise exception 'forbidden: not intake officer'; end if;
  if _crime is null or btrim(_crime) = '' or _reason is null or btrim(_reason) = '' then
    raise exception 'الجريمة والمسوّغات مطلوبة';
  end if;
  if _received_date is not null and _received_date > current_date then
    raise exception 'تاريخ الورود لا يكون مستقبلاً';
  end if;
  if _received_date is not null and _received_date < current_date - 365 then
    raise exception 'تاريخ الورود أقدم من سنة — تحقّق من المستند';
  end if;

  _ch := coalesce(_details->>'channel', case when _source = 'entity' then 'mail' else 'legacy' end);
  if _ch not in ('legacy', 'inperson', 'mail') then
    raise exception 'قناة ورودٍ غير معروفة: %', _ch;
  end if;

  -- الحضوري يوجب محضر مقابلة — هو محضر التحقّق (م7) الذي يقوم مقام الاتصال.
  _iv := _details->'interview';
  if _ch = 'inperson' and coalesce(btrim(_iv->>'note'), '') = '' then
    raise exception 'محضر مقابلة طالب الحماية إلزاميّ في التقديم الحضوري (م7).';
  end if;

  -- خطاب الجهة نيابةً عن الشخص: النموذج الورقيّ وصورة الهوية مرفقان
  -- إلزاميّان — الفحص هنا لا في المتصفح وحده.
  if _source = 'entity' then
    -- التأهيل بالاسم المستعار مقصود: للدالّة معامل إخراجٍ اسمه case_id،
    -- فالإشارة غير المؤهَّلة ملتبسةٌ وتُسقط النداء كلَّه.
    select count(*) into _att from intake_attachments a
     where a.reg_no = btrim(coalesce(_reg_no, '')) and a.case_id is null and a.uploaded_by = _uid;
    if coalesce(_att, 0) = 0 then
      raise exception 'خطاب الجهة يلزمه مرفقٌ واحد على الأقل (صورة الخطاب والنموذج الورقيّ).';
    end if;
  end if;

  -- جهة الطوارئ والهوية لا تسكنان details نصّاً صريحاً — تُعترضان إلى جدوليهما.
  _ec      := _details->'emergency_contact';
  _id      := _details->'identity';
  _details := coalesce(_details, '{}'::jsonb) - 'emergency_contact' - 'identity';

  -- الموقع الإلكتروني وحده موثّقٌ نفاذياً في المصدر؛ الحضوريّ والبريديّ لا.
  _verified := coalesce(_id->>'source_verified', 'false') = 'true';

  _ref := 'REF-' || _yr || '-' || nextval('paper_ref_seq')::text;
  _sec := 'C-'  || _yr || '-' || lpad(nextval('paper_secret_seq')::text, 4, '0');

  insert into protection_cases (ref_no, secret_code, category, status, source, created_at,
                                identity_verified, entered_by, entered_at)
  values (_ref, _sec, _category, 'triage', 'local', _received,
          _verified, _uid, now())
  returning id into _cid;

  insert into protection_requests (case_id, applicant_role, channel, submitted_at, details)
  values (_cid, _applicant_role, 'paper', _received,
          _details
            || jsonb_build_object('entity', _entity, 'crime', _crime,
                                  'reason', _reason, 'prior_submit', _prior_submit,
                                  'case_no', _case_no, 'paper_source', _source,
                                  'intake_by', _uid, 'verified', false)
            || jsonb_strip_nulls(jsonb_build_object(
                 'received_date', _received_date, 'reg_no', _reg_no)));

  perform public._store_emergency_contact(_cid, _ec);
  perform public._store_subject(_cid, _id, case when _verified then 'live' else 'manual' end);

  -- محضر المقابلة الحضورية = محضر التحقّق (يستوفي حارس triage_decide).
  if _ch = 'inperson' then
    insert into contact_logs (case_id, officer_id, channel, summary, created_at)
    values (_cid, _uid, 'inperson', btrim(_iv->>'note'),
            coalesce((_iv->>'date')::date::timestamptz, _received));
  end if;

  -- المرفقات المرفوعة على هذا القيد تصير مرفقات القضية.
  perform public._intake_attach_bind(_reg_no, _cid, _uid);

  perform public._intake_stamp(_inbox_id, _cid, _ch, 'req', _reg_no,
                               _received_date, nullif(_entity, ''), _uid);

  insert into audit_log (actor_id, action, target)
  values (_uid, 'submit_paper_intake_' || _source, _ref);

  return query select _cid, _ref, _sec;
end $$;
revoke execute on function public.submit_paper_intake(
  text, text, app_category, text, text, text, boolean, text, jsonb, date, text, uuid) from public, anon;
grant  execute on function public.submit_paper_intake(
  text, text, app_category, text, text, text, boolean, text, jsonb, date, text, uuid) to authenticated;

-- ── 9) التوصية المربوطة تربط مرفقاتها كذلك ──
-- التعريف نفسه (20260813000002) بسطرٍ واحدٍ زائد: ربط المرفقات بالقضية.
create or replace function public.record_recommendation(
  _case_id           uuid,
  _decision          text,
  _channel           text,
  _factors9          jsonb    default '{}'::jsonb,
  _proposed_type     jsonb    default '[]'::jsonb,
  _proposed_duration interval default null,
  _notes             text     default null,
  _received_date     date     default null,
  _reg_no            text     default null,
  _letter_no         text     default null,
  _letter_date       date     default null,
  _letter_by         text     default null,
  _inbox_id          uuid     default null
) returns table(status case_status)
language plpgsql security definer set search_path = public, extensions as $$
declare
  _uid uuid := auth.uid();
  _cur case_status;
  _ref text;
  _rid uuid;
  _raised timestamptz;
  _received timestamptz;
  _next case_status;
  _ent text;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;

  if _channel = 'paper' then
    if not is_intake_staff(_uid) then
      raise exception 'forbidden: not intake officer';
    end if;
  elsif _channel = 'electronic' then
    raise exception 'القناة الإلكترونية تمرّ بسلسلة اعتماد رئيس الفرع: استخدم submit_recommendation_for_approval ثم decide_recommendation_approval.';
  else
    raise exception 'قناة غير معروفة: %', _channel;
  end if;

  if _decision is null or _decision not in ('توفير', 'عدم توفير') then
    raise exception 'قرار التوصية مطلوب (توفير | عدم توفير).';
  end if;

  select c.status, c.ref_no into _cur, _ref from protection_cases c where c.id = _case_id for update;
  if _cur is null then raise exception 'case not found'; end if;
  if _cur <> 'referred' then raise exception 'الحالة ليست محالةً للجهة (%).', _cur; end if;

  select id, raised_at into _rid, _raised from recommendations
   where recommendations.case_id = _case_id and received_at is null
   order by created_at desc limit 1;
  if _rid is null then raise exception 'لا توجد توصيةٌ مُعلّقةٌ لهذه الحالة.'; end if;

  if _received_date is not null then
    if _received_date > current_date then
      raise exception 'تاريخ الورود لا يكون مستقبلاً';
    end if;
    if _raised is not null and _received_date < _raised::date then
      raise exception 'تاريخ ورود التوصية يسبق تاريخ الإحالة (%)', _raised::date;
    end if;
    _received := _received_date::timestamptz;
  else
    _received := now();
  end if;

  update recommendations
     set decision          = _decision,
         factors9          = coalesce(_factors9, factors9),
         proposed_type     = coalesce(_proposed_type, proposed_type),
         proposed_duration = coalesce(_proposed_duration, proposed_duration),
         received_at       = _received,
         channel           = _channel,
         recorded_by       = _uid,
         notes             = _notes,
         receipt_meta      = nullif(jsonb_strip_nulls(jsonb_build_object(
                               'received_date', _received_date, 'reg_no', _reg_no,
                               'letter_no', _letter_no, 'letter_date', _letter_date,
                               'letter_by', _letter_by)), '{}'::jsonb)
   where id = _rid;

  select b.entity::text into _ent
    from recommendations r join branches b on b.id = r.branch_id where r.id = _rid;

  _next := 'under_study';
  update protection_cases
     set status = _next, updated_at = now(),
         entered_by = coalesce(entered_by, _uid),
         entered_at = coalesce(entered_at, now())
   where id = _case_id;

  -- صورة الخطاب الوارد تُربط بالقضية فيراها الدارس والمقيّم.
  perform public._intake_attach_bind(_reg_no, _case_id, _uid);

  perform public._intake_stamp(_inbox_id, _case_id, 'mail', 'rec', _reg_no,
                               _received_date, _ent, _uid);

  insert into audit_log (actor_id, action, target)
  values (_uid, 'record_recommendation_' || _channel, _ref);

  insert into notifications (case_id, type, title, body, target_tab, sent_at)
  values (_case_id, 'rec_received', 'وردت توصية الجهة المختصة',
    'استُلمت توصية الجهة المختصة بشأن طلبك، وهو الآن قيد الدراسة والتقييم.',
    'requests', now());

  return query select _next;
end $$;
revoke execute on function public.record_recommendation(
  uuid, text, text, jsonb, jsonb, interval, text, date, text, text, date, text, uuid) from public, anon;
grant  execute on function public.record_recommendation(
  uuid, text, text, jsonb, jsonb, interval, text, date, text, text, date, text, uuid) to authenticated;
