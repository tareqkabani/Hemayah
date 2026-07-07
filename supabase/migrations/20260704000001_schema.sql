-- ============================================================
--  منصّة «حماية» — مخطّط قاعدة البيانات (PostgreSQL / Supabase)
--  مرجع: النظام (م/148) + اللائحة (892) + SRS §5.
--  جاهزٌ للتشغيل على Supabase. الأسماء بالإنجليزية، التعليقات بالعربية.
--  مبادئ: فصل تخزيني للهوية · RLS على كل جدول · تدقيق غير قابل للتعديل
--          · أقل امتياز · الأدوار في جدول منفصل.
-- ============================================================

create extension if not exists pgcrypto;     -- gen_random_uuid + digest/تشفير

-- ─────────────────────────── الأنواع (enums) ───────────────────────────
create type app_role as enum (
  'prosecutor_general','board_chair','deputy_chair','board_member','case_officer',
  'security_officer','security_manager','studier','evaluator','advisor','tech_manager',
  'hotline_operator','ciso','sysadmin','competent_body',
  'moi_officer','moh_specialist','moh_manager','hr_specialist','hr_manager','subject');

create type app_category   as enum ('reporter','witness','expert','victim','related');
create type case_status    as enum (
  'submitted','triage','referred','under_study','classified','in_decision',
  'accepted','rejected','signed','active','under_review','terminating','closed');
create type risk_level     as enum ('low','medium','high','critical');
create type case_source    as enum ('local','foreign','urgent');
create type decision_type  as enum ('accept','reject','continue','modify','terminate');
create type referral_status as enum ('new','assigned','progress','review','done');
create type referral_authority as enum ('hr','health','legal','security','moi');
create type grievance_status as enum ('filed','tech_review','pg_decision','upheld','dismissed');
create type review_status   as enum ('raised','decided');
create type review_outcome  as enum ('continue','modify','close');
create type sensitivity     as enum ('top_secret','secret','secret_financial','internal');

-- ─────────────────────── الأدوار (منفصلة عن الحساب) ───────────────────────
-- ملاحظة أمنية: لا عمود role على المستخدم — يمنع تصعيد الصلاحية.
create table user_roles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        app_role not null,
  attributes  jsonb default '{}'::jsonb,        -- ABAC: نطاق/جهة/محفظة
  created_at  timestamptz default now(),
  unique (user_id, role)
);

-- ─────────────────────── الحالة المحورية + الهوية المعزولة ───────────────────────
create table protection_cases (
  id             uuid primary key default gen_random_uuid(),
  ref_no         text unique not null,                 -- رقم مرجعي
  secret_code    text unique not null,                 -- الرمز السري الظاهر بدل الاسم
  category       app_category not null,
  status         case_status  not null default 'submitted',
  classification risk_level,                            -- آخر تصنيف
  source         case_source  not null default 'local',
  officer_id     uuid references auth.users(id),        -- منسّق المحفظة (ABAC)
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- بيانات الهوية في جدول معزول ومشفّر (سري للغاية)
create table subjects (
  id              uuid primary key default gen_random_uuid(),
  case_id         uuid not null references protection_cases(id) on delete cascade,
  full_name_enc   bytea,        -- pgp_sym_encrypt(...) — مفتاح في KMS/Vault
  national_id_enc bytea,
  contact_enc     bytea,
  subject_type    text default 'principal',  -- principal | related
  created_at      timestamptz default now()
);

create table related_persons (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references protection_cases(id) on delete cascade,
  relationship text,
  risk_flag   boolean default false,
  continued_protection boolean default false
);

create table protection_requests (
  id            uuid primary key default gen_random_uuid(),
  case_id       uuid not null references protection_cases(id) on delete cascade,
  applicant_role text,                 -- أصيل/ولي/وصي/وكيل/محامٍ
  channel       text,                  -- seeker | body
  submitted_at  timestamptz default now()
);

-- ─────────────────────── التوصية · الدراسة · التصنيف ───────────────────────
create table recommendations (
  id              uuid primary key default gen_random_uuid(),
  case_id         uuid not null references protection_cases(id) on delete cascade,
  source_body     text,
  factors9        jsonb,                -- عوامل المادة 9
  decision        text,                 -- توفير | عدم توفير
  proposed_type   jsonb,
  proposed_duration interval,
  raised_at       timestamptz,
  due_at          timestamptz,          -- استلام + 5 أيام (م5/3)
  created_at      timestamptz default now()
);

-- نسخة تاريخية غير قابلة للتعديل
create table risk_classifications (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references protection_cases(id) on delete cascade,
  factors     jsonb not null,           -- م9 + لائحة م5/م6
  level       risk_level not null,       -- محسوب آلياً
  rationale   text,
  assessor_id uuid references auth.users(id),
  created_at  timestamptz default now()
);

-- ────── الدراسة والتقييم — دوران مستقلّان، عدّة مؤلّفين لكل حالة، عزل صفّي ──────
-- كل صفّ = مخرَج مؤلّف واحد (دارس/مقيّم) على الحالة. تُسنَد آلياً بالعبء (دون تخصّص حالياً).
create table studies (
  id             uuid primary key default gen_random_uuid(),
  case_id        uuid not null references protection_cases(id) on delete cascade,
  studier_id     uuid not null references auth.users(id),   -- المؤلّف (الدارس)
  recommendation text,                 -- قبول كلي | قبول جزئي | رفض الحماية
  partial_reason text,
  reject_reasons jsonb,                -- أسباب الرفض
  proposed_type  jsonb,                -- أنواع مقترحة (م14) — اقتراح للمجلس فقط
  proposed_duration interval,
  notes          text,
  submitted_at   timestamptz,          -- اعتماد وإرسال (نفاذ + ختم زمني)
  created_at     timestamptz default now(),
  unique (case_id, studier_id)         -- دراسة واحدة لكل دارس على الحالة
);

create table assessments (
  id             uuid primary key default gen_random_uuid(),
  case_id        uuid not null references protection_cases(id) on delete cascade,
  evaluator_id   uuid not null references auth.users(id),   -- المؤلّف (المقيّم)
  recommendation text,
  partial_reason text,
  reject_reasons jsonb,
  proposed_type  jsonb,
  proposed_duration interval,
  notes          text,
  submitted_at   timestamptz,
  created_at     timestamptz default now(),
  unique (case_id, evaluator_id)       -- تقييم واحد لكل مقيّم على الحالة
);

-- ─────────────────────── القرار · الإشعار · الوثيقة ───────────────────────
create table board_decisions (
  id            uuid primary key default gen_random_uuid(),
  case_id       uuid not null references protection_cases(id) on delete cascade,
  type          decision_type not null,
  votes         jsonb,                  -- أصوات الأعضاء السبعة
  tie_break     boolean default false,  -- ترجيح الرئيس
  justification text not null,          -- مكتوب ومسبَّب
  duration      interval,
  decided_at    timestamptz default now()
);

create table notifications (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid references protection_cases(id) on delete cascade,
  type        text,                     -- decision | terminate | reminder
  channel     text,
  due_at      timestamptz,              -- 3 أيام (م10) / قبل 15 يوماً (م21)
  sent_at     timestamptz,
  created_at  timestamptz default now()
);

create table protection_documents (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references protection_cases(id) on delete cascade,
  rights      jsonb,
  terms       jsonb,
  signed_at   timestamptz,
  signature   text
);

create table obligations (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references protection_cases(id) on delete cascade,
  text        text,                     -- التزامات م11
  acknowledged boolean default false
);

-- ─────────────────────── التدابير · ناقل الإحالات ───────────────────────
create table measures (
  id            uuid primary key default gen_random_uuid(),
  case_id       uuid not null references protection_cases(id) on delete cascade,
  type_ref      text,                   -- م14/* أو م9 لائحة
  assignee_org  text,
  written_consent boolean,              -- رقابة الاتصالات (م9/1)
  temp_id_controls jsonb,               -- الهوية المؤقتة (م9/3)
  status        text default 'planned'
);

-- الإحالة من المركز إلى الجهة المنفّذة (يقابل HemayaBus في النموذج)
create table referrals (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references protection_cases(id) on delete cascade,
  service     text not null,            -- transfer/alt/psych/guard/...
  authority   referral_authority not null,
  ref         text,                     -- المرجع النظامي
  status      referral_status not null default 'new',
  assignee    text,
  sched       timestamptz,
  result      jsonb,
  history     jsonb default '[]'::jsonb,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ─────────────────────── العاجل · الأجنبي · التظلّم · المراجعة ───────────────────────
create table emergency_reports (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid references protection_cases(id) on delete set null,
  reported_at timestamptz default now(),
  status      text default 'open',
  escalation  jsonb default '[]'::jsonb
);

create table imminent_protections (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references protection_cases(id) on delete cascade,
  approver_id uuid references auth.users(id),
  max_duration interval default '30 days',   -- م8
  extended    boolean default false,
  created_at  timestamptz default now()
);

create table foreign_requests (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid references protection_cases(id) on delete cascade,
  country     text,
  reciprocity boolean,                  -- المعاملة بالمثل (م6)
  pg_decision text,
  created_at  timestamptz default now()
);

create table grievances (
  id            uuid primary key default gen_random_uuid(),
  case_id       uuid not null references protection_cases(id) on delete cascade,
  against       text,                   -- reject | terminate | modify
  filed_at      timestamptz,            -- ≤ 10 أيام (م10)
  decision_due  timestamptz,            -- + 10 أيام
  status        grievance_status default 'filed',
  tech_opinion  text,                   -- رأي المكتب الفني
  outcome       text                    -- نهائي غير قابل للطعن
);

-- التحديات والحلول (القسم النوعيّ من التقرير الربع سنوي — م4/9/ت)
create table challenges (
  id              uuid primary key default gen_random_uuid(),
  period          text not null,
  challenge       text not null,
  solution        text,
  evidence_metric text,
  authored_by     uuid references auth.users(id),
  created_at      timestamptz default now()
);

-- التسليم للتنفيذ: كل قبولٍ (عاجل م8 / أجنبي م6 / تظلّم م21) يُنشئ سجلّ مشمول
create table execution_handoffs (
  id               uuid primary key default gen_random_uuid(),
  case_id          uuid not null references protection_cases(id) on delete cascade,
  track            text not null,
  status           text not null default 'await-agreement',
  types            text[],
  board_review_due date,
  decided_by       uuid references auth.users(id),
  created_at       timestamptz default now()
);

-- توصية دورة الحياة من الإدارة الأمنية → بتّ المجلس
create table lifecycle_reviews (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references protection_cases(id) on delete cascade,
  officer_id  uuid references auth.users(id),
  proposal    review_outcome,
  rationale   text,
  status      review_status default 'raised',
  decision    jsonb,
  created_at  timestamptz default now(),
  decided_at  timestamptz
);

create table periodic_reviews (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references protection_cases(id) on delete cascade,
  due_date    timestamptz,
  outcome     text
);

create table consultation_sessions (
  id          uuid primary key default gen_random_uuid(),
  referral_id uuid references referrals(id) on delete cascade,
  kind        text,                     -- legal | psych | social | medical
  scheduled_at timestamptz,
  notes       text
);

-- ─────────────────────── الإفصاح · التدقيق ───────────────────────
create table disclosure_events (
  id              uuid primary key default gen_random_uuid(),
  case_id         uuid not null references protection_cases(id) on delete cascade,
  basis           text not null,        -- 16/2-a | 16/2-b | 16/2-c
  scope           text,                 -- أضيق نطاق
  subject_notified boolean default false,-- م16/3
  actor_id        uuid references auth.users(id),
  created_at      timestamptz default now()
);

-- سجل تدقيق: إدراج فقط + سلسلة hash (لا UPDATE/DELETE)
create table audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid,
  action      text not null,
  target      text,
  device      text,
  ip          inet,
  created_at  timestamptz default now(),
  prev_hash   text,
  hash        text
);

-- ============================================================
--  الدوال والسياسات (RLS)
-- ============================================================

-- دالة الصلاحية — SECURITY DEFINER لتفادي الإحالة الدائرية في RLS
create or replace function public.has_role(_user uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = _user and role = _role);
$$;

-- محفظة المنسّق (ABAC) — الحالات المُسندة إليه
create or replace function public.current_officer_caseids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select id from protection_cases where officer_id = auth.uid();
$$;

-- سلسلة hash لسجل التدقيق
create or replace function audit_chain() returns trigger language plpgsql as $$
declare prev text;
begin
  select hash into prev from audit_log order by id desc limit 1;
  new.prev_hash := coalesce(prev,'GENESIS');
  new.hash := encode(digest(new.prev_hash || coalesce(new.actor_id::text,'') ||
              new.action || coalesce(new.target,'') || new.created_at::text,'sha256'),'hex');
  return new;
end; $$;
create trigger trg_audit_chain before insert on audit_log
  for each row execute function audit_chain();

-- تفعيل RLS على كل الجداول الحسّاسة
alter table user_roles            enable row level security;
alter table protection_cases      enable row level security;
alter table subjects              enable row level security;
alter table recommendations       enable row level security;
alter table risk_classifications  enable row level security;
alter table studies               enable row level security;
alter table assessments           enable row level security;
alter table board_decisions       enable row level security;
alter table grievances            enable row level security;
alter table referrals             enable row level security;
alter table disclosure_events     enable row level security;
alter table audit_log             enable row level security;

-- ── سياسات نموذجية ──
-- المنسّق يرى حالات محفظته فقط
create policy case_officer_read on protection_cases for select using (
  has_role(auth.uid(),'case_officer') and id in (select current_officer_caseids()));

-- الإدارة تطّلع على كل الحالات للقرار
create policy board_read on protection_cases for select using (
  has_role(auth.uid(),'board_chair') or has_role(auth.uid(),'deputy_chair')
  or has_role(auth.uid(),'board_member'));

-- مدير النظام لا يصل لبيانات الهوية إطلاقاً
create policy sysadmin_no_pii on subjects for all using (false);

-- التصنيف والتدقيق: لا تعديل ولا حذف (نُسخ تاريخية)
create policy rc_insert on risk_classifications for insert with check (true);
create policy rc_select on risk_classifications for select using (
  has_role(auth.uid(),'case_officer') or has_role(auth.uid(),'board_member'));
revoke update, delete on risk_classifications from authenticated;
revoke update, delete on audit_log from authenticated, anon;

-- الدراسة والتقييم: عزل صفّي تامّ — كل مؤلّف يرى صفّه فقط (لا اطّلاع أفقي بين الأقران)
create policy study_author_rw on studies for all using (
  has_role(auth.uid(),'studier') and studier_id = auth.uid())
  with check (has_role(auth.uid(),'studier') and studier_id = auth.uid());
create policy assess_author_rw on assessments for all using (
  has_role(auth.uid(),'evaluator') and evaluator_id = auth.uid())
  with check (has_role(auth.uid(),'evaluator') and evaluator_id = auth.uid());
-- المجلس (والتجميع الآلي): اطّلاع كامل على كل الدراسات والتقييمات للتصويت — قراءة فقط
create policy study_board_read on studies for select using (
  has_role(auth.uid(),'board_chair') or has_role(auth.uid(),'deputy_chair') or has_role(auth.uid(),'board_member'));
create policy assess_board_read on assessments for select using (
  has_role(auth.uid(),'board_chair') or has_role(auth.uid(),'deputy_chair') or has_role(auth.uid(),'board_member'));

-- الإحالة: الجهة المنفّذة ترى/تحدّث طابورها فقط (ABAC عبر attributes.authority)
create policy referral_authority_rw on referrals for all using (
  exists (select 1 from user_roles ur where ur.user_id = auth.uid()
          and ur.attributes->>'authority' = referrals.authority::text));

-- الإفصاح المضبوط (م16): أساس صحيح + إخطار المشمول في (ب) و(ج)
create policy disclosure_insert on disclosure_events for insert with check (
  has_role(auth.uid(),'ciso') and basis in ('16/2-a','16/2-b','16/2-c')
  and (basis = '16/2-a' or subject_notified = true));   -- م16/3

-- ============================================================
--  فهارس مساعدة
-- ============================================================
create index on protection_cases (status);
create index on protection_cases (officer_id);
create index on referrals (authority, status);
create index on recommendations (due_at);
create index on grievances (decision_due);
create index on audit_log (actor_id, created_at);

-- ============================================================
--  طبقة الفروع والمناطق + سلسلة الاعتماد (تجميد نموذج بوابة الجهات)
--  كل جهة مختصة موزّعة على فروع بالمناطق (اختصاص القضية المكاني).
--  العزل يمتد لـ(جهة، فرع) عبر ABAC؛ المقر يشرف (تجاوز داخل جهته) ولا يعتمد.
--  الاعتماد بدرجة واحدة الآن (رئيس الفرع — صاحب الصلاحية، حتى العاجل)،
--  وقابل للتوسّع 1..ن لكل جهة عبر approval_chains دون إعادة تصميم.
-- ============================================================
create type competent_entity as enum ('prosecution','state_security','moi','nazaha','moj');
create type region_code as enum ('RUH','MAK','MED','QAS','EAS','ASR','TAB','HAI','NOR','JAZ','NAJ','BAH','JOF');

-- فروع الجهات المختصة (المقر + فروع المناطق الثلاث عشرة)
create table branches (
  id              uuid primary key default gen_random_uuid(),
  entity          competent_entity not null,
  region          region_code not null,
  name            text not null,                 -- «نيابة منطقة الرياض» / «فرع المنطقة الشرقية» …
  liaison_officer text,                           -- ضابط الاتصال المعتمد للفرع
  is_hq           boolean default false,          -- المقر / الإدارة العامة للجهة
  active          boolean default true,
  created_at      timestamptz default now(),
  unique (entity, region)
);

-- سلسلة الاعتماد القابلة للضبط لكل جهة (1..ن)
-- الدرجة 1 = رئيس الفرع المباشر (إلزامية دائماً)؛ درجات إضافية اختيارية لكل جهة.
create table approval_chains (
  id          uuid primary key default gen_random_uuid(),
  entity      competent_entity not null,
  step_no     smallint not null,                  -- ترتيب الدرجة
  approver    text not null,                      -- 'branch_head' | 'entity_hq' | …
  sla         interval default '1 day',           -- مهلة فرعية ضمن مظلّة 5 أيام (م7)
  active      boolean default true,
  unique (entity, step_no)
);

-- ربط الحالة والتوصية بالفرع المختص (اختصاص القضية المكاني)
alter table protection_cases add column if not exists case_region region_code;
alter table protection_cases add column if not exists branch_id  uuid references branches(id);
alter table recommendations  add column if not exists branch_id  uuid references branches(id);
alter table recommendations  add column if not exists approval_status text default 'preparing'; -- preparing|pending_head|approved|returned

-- أحداث الاعتماد على التوصية (درجة واحدة الآن، والبنية تدعم أكثر)
create table recommendation_approvals (
  id                uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references recommendations(id) on delete cascade,
  branch_id         uuid references branches(id),
  step_no           smallint not null default 1,  -- 1 = الرئيس المباشر
  approver          text not null default 'branch_head',
  approver_id       uuid references auth.users(id),
  decision          text,                          -- approved | returned
  note              text,
  due_at            timestamptz,                   -- مهلة الدرجة (تفويض/تصعيد عند التجاوز)
  decided_at        timestamptz,
  created_at        timestamptz default now()
);

-- ── دوال ABAC للفرع ──
-- منسوبو الجهة المختصة يحملون الدور competent_body، ويتمايزون بسمة level:
--   'clerk' موظف الفرع · 'head' رئيس الفرع (يعتمد) · 'hq' المقر (يشرف).
-- السمات: { entity, branch_id, region, level }.
create or replace function public.cb_entity()
returns competent_entity language sql stable security definer set search_path=public as $$
  select (attributes->>'entity')::competent_entity from user_roles
   where user_id = auth.uid() and role = 'competent_body' and attributes ? 'entity' limit 1;
$$;
create or replace function public.cb_branch()
returns uuid language sql stable security definer set search_path=public as $$
  select (attributes->>'branch_id')::uuid from user_roles
   where user_id = auth.uid() and role = 'competent_body' and attributes ? 'branch_id' limit 1;
$$;
create or replace function public.cb_level()
returns text language sql stable security definer set search_path=public as $$
  select attributes->>'level' from user_roles
   where user_id = auth.uid() and role = 'competent_body' limit 1;
$$;
-- فروع جهة المستخدم (لتجاوز المقر داخل جهته فقط)
create or replace function public.cb_entity_branches()
returns setof uuid language sql stable security definer set search_path=public as $$
  select id from branches where entity = public.cb_entity();
$$;

alter table branches                 enable row level security;
alter table approval_chains          enable row level security;
alter table recommendation_approvals enable row level security;

-- الفروع وسلسلة الاعتماد: يطّلع عليها منسوبو الجهة نفسها فقط
create policy branch_entity_read on branches for select using (entity = cb_entity());
create policy chain_entity_read  on approval_chains for select using (entity = cb_entity());

-- التوصيات: عزل بالفرع — الموظف ورئيس الفرع يريان توصيات فرعهما فقط
create policy rec_branch_rw on recommendations for all using (
  has_role(auth.uid(),'competent_body') and cb_level() in ('clerk','head') and branch_id = cb_branch())
  with check (
  has_role(auth.uid(),'competent_body') and cb_level() in ('clerk','head') and branch_id = cb_branch());
-- المقر: اطّلاع تجميعي على كل فروع جهته (إشراف) — قراءة فقط، لا اعتماد
create policy rec_hq_read on recommendations for select using (
  has_role(auth.uid(),'competent_body') and cb_level() = 'hq' and branch_id in (select cb_entity_branches()));

-- الاعتماد: رئيس الفرع وحده يعتمد توصيات فرعه (صاحب الصلاحية)
create policy rec_appr_head on recommendation_approvals for all using (
  has_role(auth.uid(),'competent_body') and cb_level() = 'head' and branch_id = cb_branch())
  with check (
  has_role(auth.uid(),'competent_body') and cb_level() = 'head' and branch_id = cb_branch());
-- الموظف والمقر يطّلعان على أثر الاعتماد (قراءة فقط)
create policy rec_appr_read on recommendation_approvals for select using (
  has_role(auth.uid(),'competent_body') and (branch_id = cb_branch()
    or (cb_level() = 'hq' and branch_id in (select cb_entity_branches()))));

-- الحالات: عزل بالفرع + تجاوز المقر داخل جهته
create policy case_branch_read on protection_cases for select using (
  has_role(auth.uid(),'competent_body') and (
    branch_id = cb_branch()
    or (cb_level() = 'hq' and branch_id in (select cb_entity_branches()))));

-- فهارس طبقة الفروع
create index on branches (entity, region);
create index on recommendations (branch_id);
create index on recommendation_approvals (recommendation_id);
create index on protection_cases (branch_id);

-- نهاية المخطّط.
