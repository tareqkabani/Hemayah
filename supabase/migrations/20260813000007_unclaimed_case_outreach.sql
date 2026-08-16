-- ============================================================
--  الحالات الورقية بلا حساب — قائمة عملٍ وتسجيل تواصل (فجوة التسليم ٦)
--
--  العطب: القضية المُدخَلة ورقياً لا مالك لها حتى يدخل صاحبها بنفاذ مرّةً
--  واحدة، فيضمّها claim_paper_cases. والآلية سليمة — لكلّ صفٍّ تجزئةُ هويةٍ
--  حتميّة تُمكّن المطابقة — والمفقود **الزناد**: لا أحد يعلم مَن ينتظر.
--
--    · لا شاشة ولا دالّة تعرض غير المضمومة (المسح على submitted_by is null
--      لا يجد إلا claim_paper_cases نفسها).
--    · ولا إشعارَ دعوةٍ في مسار الإدخال (الوحيد فيه rec_received: ورود توصية).
--
--  والأثر حبسٌ صامت: صاحبها لا يرى قراره، ولا يوقّع الاتفاقية (م11)، ولا
--  يتظلّم (م21) — لأنّ owns_case وseeker_sign_agreement يشترطان الملكية.
--
--  ⚠️ لماذا جدولٌ جديد لا contact_logs — قِيس قبل الكتابة:
--     حارس triage_decide هو `exists (select 1 from contact_logs
--     where case_id = _case_id)` — **أيّ صفّ، أيّ قناة**. فتسجيل «حاولتُ
--     الاتصال به ليُفعّل حسابه» في contact_logs يستوفي محضر التحقّق (م7)
--     ويفتح قرار الفرز بلا محضرٍ حقيقيّ. محاولةُ التواصل الإداريّة ليست
--     محضر تحقّق، فلها سجلّها.
--
--  ⚠️ وما لا تَعِد به هذه الحزمة: «إرسال دعوة» آليّاً. القياس على الحالات
--  القائمة: نصفها بلا أيّ وسيلة اتصالٍ مخزَّنة (لا هاتف صاحبها ولا جهة
--  طوارئ) — والقادمة من الموقع الإلكتروني رجعتها عبر رقم طلبها هناك،
--  والقادمة بخطاب جهةٍ عبر الجهة المُرسِلة. فالقائمة تقول للموظف أهناك
--  وسيلةٌ أم لا، ولا تُرسل ما لا تملك عنواناً له.
-- ============================================================

-- ───────────────── سجلّ محاولات التواصل الإداريّة ─────────────────
create table if not exists public.case_outreach_log (
  id         uuid primary key default gen_random_uuid(),
  case_id    uuid not null references public.protection_cases(id) on delete cascade,
  officer_id uuid not null references auth.users(id),
  channel    text not null check (channel in ('phone', 'entity', 'website', 'other')),
  note       text not null,
  created_at timestamptz not null default now()
);

comment on table public.case_outreach_log is
  'محاولات تواصلٍ إداريّة لدعوة صاحب حالةٍ ورقيّة إلى الدخول بنفاذ فتُضمّ حالته. '
  'منفصلٌ عن contact_logs عمداً: ذاك محضر التحقّق (م7) وحارس triage_decide يقبل '
  'أيّ صفٍّ فيه، فخلطُهما يفتح قرار الفرز بمحاولةٍ إدارية لا بتحقّقٍ حقيقيّ.';

create index if not exists case_outreach_log_case_idx
  on public.case_outreach_log (case_id, created_at desc);

alter table public.case_outreach_log enable row level security;

-- القراءة لمنسوبي الوحدة؛ والكتابة عبر الدالّة وحدها (لا سياسة insert).
drop policy if exists case_outreach_read on public.case_outreach_log;
create policy case_outreach_read on public.case_outreach_log
  for select using (public.is_intake_staff(auth.uid()));

-- ───────────────── قائمة العمل ─────────────────
--  بلا بيانات شخصية: has_contact رايةٌ لا رقم. والكشف عن الرقم نداءٌ
--  مستقلٌّ مقيَّدٌ في التدقيق (intake_reveal_subject_contact أدناه).
create or replace function public.intake_unclaimed_cases()
returns table(
  case_id           uuid,
  secret_code       text,
  ref_no            text,
  channel           text,
  reg_no            text,
  arrived_on        date,
  days_waiting      int,
  identity_verified boolean,
  has_contact       boolean,
  outreach_count    int,
  last_outreach_at  timestamptz
)
language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid();
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not public.is_intake_staff(_uid) then
    raise exception 'forbidden: not intake officer';
  end if;

  return query
  select c.id,
         c.secret_code,
         c.ref_no,
         coalesce(i.channel::text, ''),
         coalesce(i.reg_no, ''),
         coalesce(i.arrived_on, c.created_at::date),
         greatest(0, public.business_days_between(
                       coalesce(i.arrived_on::timestamptz, c.created_at), now())),
         c.identity_verified,
         (s.contact_enc is not null),
         coalesce(o.cnt, 0)::int,
         o.last_at
    from public.protection_cases c
    left join public.intake_inbox i
           on i.entered_case_id = c.id
    left join public.subjects s
           on s.case_id = c.id and s.subject_type = 'principal'
    left join lateral (
      select count(*) as cnt, max(l.created_at) as last_at
        from public.case_outreach_log l
       where l.case_id = c.id
    ) o on true
   -- الورقيّ وحده: entered_by يميّزه، وsubmitted_by الفارغ يعني لا حساب بعد.
   where c.submitted_by is null
     and c.entered_by is not null
     -- المنتهية لا تُطارَد: لا اتفاقية ولا تظلّم بعدها.
     and c.status not in ('closed', 'rejected')
   order by coalesce(i.arrived_on, c.created_at::date);
end $$;

revoke execute on function public.intake_unclaimed_cases() from public, anon;
grant  execute on function public.intake_unclaimed_cases() to authenticated;

comment on function public.intake_unclaimed_cases() is
  'الحالات الورقية التي لم تُضمّ لحساب صاحبها بعد — قائمة عملٍ لمنسوبي وحدة '
  'الإدخال. بلا بيانات شخصية: has_contact رايةٌ لا رقم.';

-- ───────────────── كشف وسيلة الاتصال — مقيَّدٌ في التدقيق ─────────────────
--  على سابقة execution_emergency_contact: كلّ اطّلاعٍ على رقمٍ مُحاسَبٌ عليه.
create or replace function public.intake_reveal_subject_contact(_case_id uuid)
returns table(full_name text, contact text)
language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _key text; _ref text;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not public.is_intake_staff(_uid) then
    raise exception 'forbidden: not intake officer';
  end if;

  -- الكشف مقصورٌ على ما هذه الحزمة بصددها: حالةٌ ورقيّةٌ لم تُضمّ بعد.
  select c.ref_no into _ref
    from public.protection_cases c
   where c.id = _case_id
     and c.submitted_by is null
     and c.entered_by is not null;
  if _ref is null then
    raise exception 'القضية غير موجودة أو مضمومةٌ لحساب صاحبها — لا كشف هنا';
  end if;

  if not exists (select 1 from public.subjects s
                  where s.case_id = _case_id and s.subject_type = 'principal') then
    return;  -- لا صفّ هوية — ولا يُقيَّد كشفٌ لم يقع
  end if;

  _key := public._subject_identity_key();
  if _key is null then
    raise exception 'مفتاح تشفير الهوية غير مهيّأ في Vault';
  end if;

  insert into public.audit_log (actor_id, action, target)
  values (_uid, 'reveal_subject_contact', _ref);

  return query
  select case when s.full_name_enc is null then null
              else pgp_sym_decrypt(s.full_name_enc, _key) end,
         case when s.contact_enc is null then null
              else pgp_sym_decrypt(s.contact_enc, _key) end
    from public.subjects s
   where s.case_id = _case_id and s.subject_type = 'principal'
   limit 1;
end $$;

revoke execute on function public.intake_reveal_subject_contact(uuid) from public, anon;
grant  execute on function public.intake_reveal_subject_contact(uuid) to authenticated;

comment on function public.intake_reveal_subject_contact(uuid) is
  'كشف اسم صاحب الحالة الورقية ووسيلة اتصاله لدعوته إلى الضمّ — مقصورٌ على '
  'غير المضمومة، ويُقيَّد كلّ كشفٍ في audit_log.';

-- ───────────────── تسجيل محاولة التواصل ─────────────────
create or replace function public.intake_log_outreach(
  _case_id uuid, _channel text, _note text)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _ref text;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not public.is_intake_staff(_uid) then
    raise exception 'forbidden: not intake officer';
  end if;
  if _note is null or btrim(_note) = '' then
    raise exception 'وصف المحاولة مطلوب — السجلّ أثرٌ لا خانةٌ تُملأ';
  end if;
  if _channel not in ('phone', 'entity', 'website', 'other') then
    raise exception 'قناة تواصلٍ غير معروفة: %', _channel;
  end if;

  -- المضمومة لا تُطارَد: صاحبها يرى حالته بنفسه.
  select c.ref_no into _ref
    from public.protection_cases c
   where c.id = _case_id
     and c.submitted_by is null
     and c.entered_by is not null;
  if _ref is null then
    raise exception 'القضية غير موجودة أو مضمومةٌ لحساب صاحبها';
  end if;

  insert into public.case_outreach_log (case_id, officer_id, channel, note)
  values (_case_id, _uid, _channel, btrim(_note));

  insert into public.audit_log (actor_id, action, target)
  values (_uid, 'intake_log_outreach_' || _channel, _ref);
end $$;

revoke execute on function public.intake_log_outreach(uuid, text, text) from public, anon;
grant  execute on function public.intake_log_outreach(uuid, text, text) to authenticated;

comment on function public.intake_log_outreach(uuid, text, text) is
  'تسجيل محاولة تواصلٍ إدارية لدعوة صاحب حالةٍ ورقيّة إلى الدخول بنفاذ. '
  'لا تُكتب في contact_logs عمداً — ذاك محضر التحقّق (م7) وحارس الفرز يقبل أيّ صفٍّ فيه.';
