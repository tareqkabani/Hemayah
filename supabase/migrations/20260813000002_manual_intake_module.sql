-- ============================================================
--  وحدة الإدخال اليدوي للطلبات — سِجلّ الوارد ومسوّدات التفريغ
--  مرجع: حزمة تسليم «الإدخال اليدوي للطلبات» (13 أغسطس 2026).
--
--  ما تسدّه هذه المهاجرة من التسليم:
--    · قرار ٥ «قيد الورود واحدٌ لا يُعاد إدخاله» — يُسجَّل مرّةً في الواردة
--      (قناة + نوع مستند + تاريخ ورود + رقم قيد) ثم يُورَّث للنموذج مقفلاً.
--    · قرار ٦ «شاشتان»: الواردة = ما لم يُفرَّغ · المرسلة = ما فُرِّغ وأُرسل —
--      وكلتاهما وجهان لجدولٍ واحد (entered_case_id هو الفاصل).
--    · قرار ٤ «كل نموذج موثّق باسم مُدخِله» — entered_by على القضية وعلى
--      صفّ الوارد، مع اسم المُدخِل وصفته وقت الإدخال (سندٌ تدقيقيّ لا يتبدّل).
--    · قرار ٣ «الحضوري يدخل الفرز بلا محضر اتصال» — محضر المقابلة يُكتب
--      محضرَ تحقّقٍ بقناة inperson، فيستوفي شرط triage_decide بذاته دون
--      استثناءٍ يفتح ثغرةً في الحارس.
--    · فجوة الإنتاج ٢ «المسوّدات على الخادم» و٣ «الواردة على الخادم»
--      و٧ «تفرّد القيد» — الثلاث مسنودةٌ هنا (unique (channel, reg_no)).
--
--  انحرافٌ مقصود عن نصّ التسليم: أعمدة القناة/القيد/تاريخ الورود لا تُكرَّر
--  على protection_cases — موضعها سِجلّ الوحدة (intake_inbox) وسِجلّ الطلب
--  (protection_requests.details) الذي يكتبهما اليوم. تكرارها ثالثةً يصنع
--  كاتبَين لحقيقةٍ واحدة. ويبقى على القضية ما لا موضع له غيرها:
--  identity_verified (بوّابة م11 وم21) وentered_by/entered_at.
--
--  العزل: جدولان + دوالّهما + عمودان على القضية — حذف الوحدة لاحقاً
--  إسقاطُ هذين الجدولين ودوالّهما، ولا يمسّ بقية النظام.
-- ============================================================

-- ─────────────────────────── الأنواع ───────────────────────────
do $$ begin
  create type intake_channel as enum ('legacy', 'inperson', 'mail');
exception when duplicate_object then null; end $$;

do $$ begin
  create type intake_doc_kind as enum ('req', 'rec');
exception when duplicate_object then null; end $$;

comment on type intake_channel is
  'قنوات ورود المستند للوحدة: legacy = الموقع الإلكتروني (تقديم عبر نفاذ يُطبع ويُدخل يدوياً) · inperson = حضوري · mail = خطاب رسمي بالبريد';

-- ───────────────── سِجلّ الوحدة: الواردة والمرسلة معاً ─────────────────
-- صفٌّ واحد لكل مستندٍ وصل. ما لم يُفرَّغ (entered_case_id is null) هو
-- «الواردة»، وما فُرِّغ هو «المرسلة» — فلا طابوران يفترقان.
create table if not exists intake_inbox (
  id                uuid primary key default gen_random_uuid(),
  channel           intake_channel  not null,
  doc_kind          intake_doc_kind not null default 'req',
  reg_no            text not null,               -- رقم القيد الإداري / رقم الطلب في الموقع الإلكتروني
  arrived_on        date not null,               -- منه تُحسب المُهل (م10) لا من لحظة الإدخال
  entity            text,                        -- الجهة المُرسِلة (مسار البريد) — تُختم عند التفريغ
  -- الاستلام: من أخذ المستند للتفريغ (يمنع ازدواج العمل على الصفّ الواحد)
  claimed_by        uuid references auth.users(id),
  claimed_at        timestamptz,
  -- التفريغ: القضية التي وُلدت أو تلقّت التوصية + مُدخِلها باسمه وصفته وقتها
  entered_case_id   uuid references protection_cases(id) on delete set null,
  entered_by        uuid references auth.users(id),
  entered_by_name   text,
  entered_by_role   text,
  entered_at        timestamptz,
  registered_by     uuid references auth.users(id),
  created_at        timestamptz not null default now(),
  -- فجوة الإنتاج ٧: تفرّد القيد على الخادم لا في الواجهة
  unique (channel, reg_no)
);
create index if not exists intake_inbox_pending_idx on intake_inbox (arrived_on) where entered_case_id is null;

-- ───────────────── مسوّدات التفريغ (فجوة الإنتاج ٢) ─────────────────
-- كانت في localStorage فيضيع العمل بتغيير الجهاز؛ وهي هنا لكل قيدٍ ومُدخِل.
create table if not exists intake_drafts (
  id         uuid primary key default gen_random_uuid(),
  reg_no     text not null,
  clerk_id   uuid not null references auth.users(id) on delete cascade,
  payload    jsonb not null,
  updated_at timestamptz not null default now(),
  unique (reg_no, clerk_id)
);

-- ───────────────── ما لا موضع له إلا القضية ─────────────────
alter table protection_cases
  add column if not exists identity_verified boolean not null default false,
  add column if not exists entered_by        uuid references auth.users(id),
  add column if not exists entered_at        timestamptz;

comment on column protection_cases.identity_verified is
  'هوية موثّقة نفاذياً في المصدر (الموقع الإلكتروني) أو موروثة من طلبٍ قائم. غير الموثّقة تُفعَّل عبر نفاذ لاحقاً — شرطٌ للاتفاقية (م11) والتظلّم (م21).';

-- ─────────────────────── حارس الدور ───────────────────────
-- الفحص نصّيّ (role::text) لا بقيمة enum: فقيمة intake_clerk أُضيفت في
-- مهاجرةٍ سابقة، والفحص النصّيّ لا يتعلّق بترتيب المعاملات إطلاقاً.
create or replace function public.is_intake_staff(_user uuid)
returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (
    select 1 from user_roles
     where user_id = _user
       and role::text in ('case_officer', 'hotline_operator', 'intake_clerk'));
$$;
revoke execute on function public.is_intake_staff(uuid) from public, anon;
grant  execute on function public.is_intake_staff(uuid) to authenticated;

-- اسم المُدخِل وصفته وقت الإدخال — يُختمان على الصفّ فلا يتبدّلان بتغيّر الحساب.
create or replace function public._intake_actor(_user uuid)
returns table(actor_name text, actor_role text)
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(u.raw_user_meta_data->>'name', 'موظف الوحدة'),
         case
           when exists (select 1 from user_roles r
                         where r.user_id = _user and r.role::text = 'intake_clerk'
                           and r.attributes->>'level' = 'supervisor')
             then 'مشرف وحدة الإدخال اليدوي'
           when exists (select 1 from user_roles r
                         where r.user_id = _user and r.role::text = 'intake_clerk')
             then 'موظف الاستقبال والإدخال'
           when exists (select 1 from user_roles r
                         where r.user_id = _user and r.role::text = 'hotline_operator')
             then 'مشغّل الخط الساخن'
           else 'منسّق المركز'
         end
    from auth.users u where u.id = _user;
$$;
revoke execute on function public._intake_actor(uuid) from public, anon;

-- ─────────────────────────── RLS ───────────────────────────
-- الكتابة كلّها عبر الدوالّ الآمنة (لا insert/update مباشر)؛ القراءة لمنسوبي
-- الوحدة، والمسوّدة لصاحبها وحده — لا يقرأ مُدخِلٌ مسوّدة زميله.
alter table intake_inbox  enable row level security;
alter table intake_drafts enable row level security;

drop policy if exists intake_inbox_read on intake_inbox;
create policy intake_inbox_read on intake_inbox for select
  using (is_intake_staff(auth.uid()));

drop policy if exists intake_draft_own on intake_drafts;
create policy intake_draft_own on intake_drafts for select
  using (clerk_id = auth.uid());

grant select on intake_inbox  to authenticated;
grant select on intake_drafts to authenticated;

-- ═══════════════ ١) تسجيل وصول مستند في الواردة ═══════════════
create or replace function public.intake_inbox_register(
  _channel    text,
  _doc_kind   text,
  _reg_no     text,
  _arrived_on date
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _id uuid;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not is_intake_staff(_uid) then raise exception 'forbidden: not intake staff'; end if;
  if _reg_no is null or btrim(_reg_no) = '' then
    raise exception 'رقم القيد مطلوب';
  end if;
  if _arrived_on is null then raise exception 'تاريخ الورود مطلوب'; end if;
  if _arrived_on > current_date then
    raise exception 'تاريخ الورود لا يكون مستقبلاً';
  end if;
  if _arrived_on < current_date - 365 then
    raise exception 'تاريخ الورود أقدم من سنة — تحقّق من المستند';
  end if;

  begin
    insert into intake_inbox (channel, doc_kind, reg_no, arrived_on, registered_by)
    values (_channel::intake_channel,
            case when _channel = 'mail' then coalesce(_doc_kind, 'req')::intake_doc_kind
                 else 'req'::intake_doc_kind end,
            btrim(_reg_no), _arrived_on, _uid)
    returning id into _id;
  exception when unique_violation then
    raise exception 'رقم القيد «%» مسجَّلٌ من قبل على هذه القناة — راجع الواردة والمرسلة.', btrim(_reg_no);
  end;

  insert into audit_log (actor_id, action, target)
  values (_uid, 'intake_inbox_register_' || _channel, btrim(_reg_no));

  return _id;
end $$;
revoke execute on function public.intake_inbox_register(text, text, text, date) from public, anon;
grant  execute on function public.intake_inbox_register(text, text, text, date) to authenticated;

-- ═══════════════ ٢) استلام صفٍّ للتفريغ ═══════════════
create or replace function public.intake_inbox_claim(_id uuid)
returns table(claimed_by uuid, claimed_by_name text)
language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _cur uuid; _reg text;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not is_intake_staff(_uid) then raise exception 'forbidden: not intake staff'; end if;

  select i.claimed_by, i.reg_no into _cur, _reg
    from intake_inbox i where i.id = _id for update;
  if _reg is null then raise exception 'صفّ الوارد غير موجود'; end if;
  if _cur is not null and _cur <> _uid then
    raise exception 'استلمه زميلٌ آخر — حدّث الواردة.';
  end if;

  update intake_inbox
     set claimed_by = _uid, claimed_at = coalesce(claimed_at, now())
   where id = _id;

  insert into audit_log (actor_id, action, target) values (_uid, 'intake_inbox_claim', _reg);

  return query
    select _uid, (select actor_name from public._intake_actor(_uid));
end $$;
revoke execute on function public.intake_inbox_claim(uuid) from public, anon;
grant  execute on function public.intake_inbox_claim(uuid) to authenticated;

-- ═══════════════ ٣) قراءة الواردة والمرسلة ═══════════════
-- SECURITY DEFINER لأنّ الصفّ يحتاج secret_code وidentity_verified من
-- protection_cases، وسياساتها موجَّهة بالحالة فلا يراها منسوب الوحدة مباشرةً.
create or replace function public.intake_inbox_list()
returns table(
  id            uuid,
  channel       text,
  doc_kind      text,
  reg_no        text,
  arrived_on    date,
  claimed_by    uuid,
  claimed_name  text,
  created_at    timestamptz
)
language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid();
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not is_intake_staff(_uid) then raise exception 'forbidden: not intake staff'; end if;

  return query
  select i.id, i.channel::text, i.doc_kind::text, i.reg_no, i.arrived_on,
         i.claimed_by,
         coalesce(u.raw_user_meta_data->>'name', '') as claimed_name,
         i.created_at
    from intake_inbox i
    left join auth.users u on u.id = i.claimed_by
   where i.entered_case_id is null
   order by i.arrived_on, i.created_at;
end $$;
revoke execute on function public.intake_inbox_list() from public, anon;
grant  execute on function public.intake_inbox_list() to authenticated;

create or replace function public.intake_sent_list()
returns table(
  id                uuid,
  secret_code       text,
  channel           text,
  doc_kind          text,
  reg_no            text,
  arrived_on        date,
  entity            text,
  entered_by_name   text,
  entered_by_role   text,
  entered_at        timestamptz,
  identity_verified boolean,
  case_status       text
)
language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid();
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not is_intake_staff(_uid) then raise exception 'forbidden: not intake staff'; end if;

  return query
  select i.id, c.secret_code, i.channel::text, i.doc_kind::text, i.reg_no, i.arrived_on,
         i.entity, i.entered_by_name, i.entered_by_role, i.entered_at,
         c.identity_verified, c.status::text
    from intake_inbox i
    join protection_cases c on c.id = i.entered_case_id
   where i.entered_case_id is not null
   order by i.entered_at desc;
end $$;
revoke execute on function public.intake_sent_list() from public, anon;
grant  execute on function public.intake_sent_list() to authenticated;

-- ═══════════════ ٤) مسوّدات التفريغ ═══════════════
create or replace function public.intake_draft_save(_reg_no text, _payload jsonb)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid();
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not is_intake_staff(_uid) then raise exception 'forbidden: not intake staff'; end if;
  if _reg_no is null or btrim(_reg_no) = '' then return; end if;

  insert into intake_drafts (reg_no, clerk_id, payload, updated_at)
  values (btrim(_reg_no), _uid, coalesce(_payload, '{}'::jsonb), now())
  on conflict (reg_no, clerk_id)
    do update set payload = excluded.payload, updated_at = now();
end $$;
revoke execute on function public.intake_draft_save(text, jsonb) from public, anon;
grant  execute on function public.intake_draft_save(text, jsonb) to authenticated;

create or replace function public.intake_draft_load(_reg_no text)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _p jsonb;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not is_intake_staff(_uid) then raise exception 'forbidden: not intake staff'; end if;
  select payload into _p from intake_drafts
   where reg_no = btrim(_reg_no) and clerk_id = _uid;
  return _p;
end $$;
revoke execute on function public.intake_draft_load(text) from public, anon;
grant  execute on function public.intake_draft_load(text) to authenticated;

create or replace function public.intake_draft_clear(_reg_no text)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid();
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  delete from intake_drafts where reg_no = btrim(_reg_no) and clerk_id = _uid;
end $$;
revoke execute on function public.intake_draft_clear(text) from public, anon;
grant  execute on function public.intake_draft_clear(text) to authenticated;

-- ═══════════ ٥) ختم صفّ الوارد عند التفريغ (مساعدٌ داخليّ) ═══════════
-- يُستدعى من دالّتي التفريغ. يقبل صفّاً قائماً (فُتح من الواردة) أو يُنشئه
-- عند «التفريغ المباشر بلا قيد مُسبق» — فسِجلّ الوحدة يبقى كاملاً في الحالين.
create or replace function public._intake_stamp(
  _inbox_id uuid, _case_id uuid, _channel text, _doc_kind text,
  _reg_no text, _arrived_on date, _entity text, _uid uuid
) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare _name text; _role text;
begin
  select actor_name, actor_role into _name, _role from public._intake_actor(_uid);

  if _inbox_id is not null then
    update intake_inbox
       set entered_case_id = _case_id, entered_by = _uid, entered_at = now(),
           entered_by_name = _name, entered_by_role = _role,
           entity = coalesce(_entity, entity),
           claimed_by = coalesce(claimed_by, _uid),
           claimed_at = coalesce(claimed_at, now())
     where id = _inbox_id and entered_case_id is null;
    if found then return; end if;
    -- الصفّ فُرِّغ بين الفتح والإرسال — لا يُدهس، ويُقيَّد التفريغ صفّاً مستقلاً.
  end if;

  if _reg_no is null or btrim(_reg_no) = '' then return; end if;

  insert into intake_inbox (channel, doc_kind, reg_no, arrived_on, entity,
                            registered_by, claimed_by, claimed_at,
                            entered_case_id, entered_by, entered_by_name,
                            entered_by_role, entered_at)
  values (_channel::intake_channel, coalesce(_doc_kind, 'req')::intake_doc_kind,
          btrim(_reg_no), coalesce(_arrived_on, current_date), _entity,
          _uid, _uid, now(), _case_id, _uid, _name, _role, now())
  on conflict (channel, reg_no) do update
     set entered_case_id = excluded.entered_case_id,
         entered_by      = excluded.entered_by,
         entered_by_name = excluded.entered_by_name,
         entered_by_role = excluded.entered_by_role,
         entered_at      = excluded.entered_at,
         entity          = coalesce(excluded.entity, intake_inbox.entity)
   where intake_inbox.entered_case_id is null;
end $$;
revoke execute on function public._intake_stamp(uuid, uuid, text, text, text, date, text, uuid) from public, anon;

-- ═══════════ ٦) التفريغ — طلب حماية (الموقع الإلكتروني / حضوري / نيابةً) ═══════════
-- إعادة كتابة نسخة 20260810000003 كاملةً (درس «آخر نسخة دالة») بثلاث زياداتٍ:
--   · _inbox_id يربط التفريغ بصفّه في الواردة فيخرج من الطابور فوراً.
--   · identity_verified وentered_by/entered_at تُختمان على القضية.
--   · الحضوري: محضر المقابلة يُكتب محضرَ تحقّقٍ بقناة inperson — فيستوفي
--     شرط محضر الاتصال في triage_decide بذاته، بلا استثناءٍ في الحارس.
-- الصيغة القديمة تُسقط أولاً: بقاؤها مع الجديدة يجعل النداء غامضاً على
-- PostgREST (درس triage_decide المتكرر).
drop function if exists public.submit_paper_intake(
  text, text, app_category, text, text, text, boolean, text, jsonb, date, text);

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
  _received_date  date  default null,   -- تاريخ الورود الفعلي — منه تُحسب المُهل (م10)
  _reg_no         text  default null,   -- رقم القيد الإداري / مرجع الموقع الإلكتروني
  _inbox_id       uuid  default null    -- صفّ الواردة الذي يُفرَّغ (إن فُتح منها)
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

  -- جهة الطوارئ والهوية لا تسكنان details نصّاً صريحاً — تُعترضان إلى جدوليهما.
  _ec      := _details->'emergency_contact';
  _id      := _details->'identity';
  _details := coalesce(_details, '{}'::jsonb) - 'emergency_contact' - 'identity';

  -- الموقع الإلكتروني وحده موثّقٌ نفاذياً في المصدر؛ الحضوريّ والبريديّ لا.
  _verified := coalesce(_id->>'source_verified', 'false') = 'true';

  _ref := 'REF-' || _yr || '-' || nextval('paper_ref_seq')::text;
  _sec := 'C-'  || _yr || '-' || lpad(nextval('paper_secret_seq')::text, 4, '0');

  -- قضية في طابور الفرز، مؤرَّخة بتاريخ الورود الفعليّ — منه تبدأ المُهل
  -- والمؤقّتات في سجلّ الفرز، لا من لحظة الإدخال.
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

  -- محضر المقابلة الحضورية = محضر التحقّق. يُكتب هنا لا في الفرز، فيمرّ
  -- حارس triage_decide كما هو ولا يُستثنى منه صنفٌ من الطلبات.
  if _ch = 'inperson' then
    insert into contact_logs (case_id, officer_id, channel, summary, created_at)
    values (_cid, _uid, 'inperson',
            btrim(_iv->>'note'),
            coalesce((_iv->>'date')::date::timestamptz, _received));
  end if;

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

-- ═══════════ ٧) التفريغ — توصية جهةٍ على طلبٍ مُحال ═══════════
-- إعادة كتابة نسخة 20260811000003 كاملةً بزيادتين: حارس الدور صار
-- is_intake_staff، و_inbox_id يختم صفّ الوارد فيخرج من الطابور.
drop function if exists public.record_recommendation(
  uuid, text, text, jsonb, jsonb, interval, text, date, text, text, date, text);

create or replace function public.record_recommendation(
  _case_id           uuid,
  _decision          text,                         -- 'توفير' | 'عدم توفير'
  _channel           text,                         -- 'electronic' | 'paper'
  _factors9          jsonb    default '{}'::jsonb, -- عوامل المادة 9
  _proposed_type     jsonb    default '[]'::jsonb, -- أنواع مقترحة (اقتراح)
  _proposed_duration interval default null,
  _notes             text     default null,
  _received_date     date     default null,        -- تاريخ الورود الفعلي للخطاب
  _reg_no            text     default null,        -- رقم القيد الإداري (سجلّ الوارد)
  _letter_no         text     default null,        -- رقم خطاب الجهة الوارد بالبريد
  _letter_date       date     default null,        -- تاريخ الخطاب
  _letter_by         text     default null,        -- مُعِدّ التوصية في الجهة
  _inbox_id          uuid     default null         -- صفّ الواردة الذي يُفرَّغ
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

  -- الصلاحية بحسب القناة: ورقيّ = منسوب الوحدة نيابةً؛ إلكترونيّ = عبر السلسلة.
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

  -- شرط: الحالة محالةٌ للجهة فقط (لا محضر اتصالٍ مطلوب — استلامٌ لا اتصال).
  select c.status, c.ref_no into _cur, _ref from protection_cases c where c.id = _case_id for update;
  if _cur is null then raise exception 'case not found'; end if;
  if _cur <> 'referred' then raise exception 'الحالة ليست محالةً للجهة (%).', _cur; end if;

  -- التوصية المُعلّقة لهذه الحالة (المُنشأة عند الإحالة، لم تُستلم بعد).
  select id, raised_at into _rid, _raised from recommendations
   where recommendations.case_id = _case_id and received_at is null
   order by created_at desc limit 1;
  if _rid is null then raise exception 'لا توجد توصيةٌ مُعلّقةٌ لهذه الحالة.'; end if;

  -- تاريخ الورود الفعلي (ورقيّ): لا يسبق الإحالة ولا يكون مستقبلاً.
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

  -- الجهة المُرسِلة — تُختم على صفّ الوارد ليقرأها عمود «المرسلة».
  select b.entity::text into _ent
    from recommendations r join branches b on b.id = r.branch_id where r.id = _rid;

  -- إحالةٌ مباشرةٌ للدراسة والتقييم — المحفّز trg_assign_study_eval يُسند آلياً.
  _next := 'under_study';
  update protection_cases
     set status = _next, updated_at = now(),
         entered_by = coalesce(entered_by, _uid),
         entered_at = coalesce(entered_at, now())
   where id = _case_id;

  perform public._intake_stamp(_inbox_id, _case_id, 'mail', 'rec', _reg_no,
                               _received_date, _ent, _uid);

  insert into audit_log (actor_id, action, target)
  values (_uid, 'record_recommendation_' || _channel, _ref);

  -- إشعارٌ محايدٌ للمستفيد (لا يكشف مضمون التوصية).
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

-- ═══════════ ٨) خطوة الربط — الحارس يقبل منسوب الوحدة ═══════════
-- التعريف نفسه (20260805000001) بتغييرٍ واحد: is_intake_staff بدل الدورين.
create or replace function public.list_referred_for_entity(_entity text)
returns table(
  case_id     uuid,
  secret_code text,
  category    app_category,
  case_no     text,
  city        text,
  region      text,
  referred_at timestamptz,
  due_at      timestamptz
)
language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid();
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not is_intake_staff(_uid) then raise exception 'forbidden: not intake officer'; end if;

  return query
  select c.id, c.secret_code, c.category,
         coalesce(d.details->>'case_no', ''),
         coalesce(d.details->>'city', ''),
         b.region::text,
         r.raised_at, r.due_at
    from recommendations r
    join protection_cases c on c.id = r.case_id
    join branches b on b.id = r.branch_id
    left join lateral (
      select pr.details from protection_requests pr
       where pr.case_id = c.id order by pr.submitted_at desc limit 1
    ) d on true
   where b.entity = _entity::competent_entity
     and r.received_at is null
     and c.status = 'referred'
   order by r.raised_at;
end $$;
revoke execute on function public.list_referred_for_entity(text) from public, anon;
grant  execute on function public.list_referred_for_entity(text) to authenticated;

-- ═══════════ ٩) طبقة المحتوى — قناة المحضر الحضوريّ ═══════════
-- محضر المقابلة يظهر في الفرز بمسمّاه لا برمزه.
insert into reference_items (list_key, item_key, label, sort_order, meta) values
  ('call_channel', 'inperson', 'حضوري — مقابلة', 3, '{}'::jsonb)
on conflict (list_key, item_key) do nothing;
