-- ============================================================
--  تقويم العطل الرسمية — المُهل تُحسب بأيام عملٍ حقيقية (فجوة الإنتاج ٤)
--
--  الحال قبل اليوم: حاسبتا أيام العمل — واحدة في القاعدة وواحدة في
--  الواجهة — تعرفان العطلة الأسبوعية وحدها:
--
--    business_days_between: extract(dow from d) not in (5,6)   ← الجمعة والسبت
--    isBusinessDay (sla.ts): !WEEKEND.has(d.getDay())          ← الجمعة والسبت
--
--  فكلّ يومٍ غير الجمعة والسبت يومُ عملٍ عندهما: العيدان واليوم الوطني
--  ويوم التأسيس. والأثر ليس تجميلياً:
--    · طلبٌ أُحيل لجهةٍ بمهلة ٥ أيام عمل قبل عطلةٍ رسمية يُوسم «متجاوزة
--      المهلة — مُصعَّدة للقيادة» والجهة لم تتأخّر يوماً.
--    · مؤشّرات التزام الجهات تُحتسب على أساسٍ خاطئ.
--    · ومتى عرف الموظفون أنّ «متجاوزة» تكذب أحياناً لم يصدّقوها دائماً.
--
--  الأثر يتعدّى وحدة الإدخال: الحاسبتان تُستهلكان في مُهل الدراسة
--  والتقييم، ومُقفِل الميعاد (م10)، وحارس التوقّف، وكلّ مؤقّتات SLA.
--
--  ⚠️ تغيّرٌ ظاهرٌ في الأرقام: إضافة العطل **تُطيل** المُهل، فقضايا
--  موسومةٌ اليوم «متجاوزة» قد تعود «ضمن المهلة». هذا هو الصواب، لكنّه
--  يُعلَن لا يُمرَّر بصمت.
-- ============================================================

create table if not exists holidays (
  day        date primary key,
  name       text not null,
  kind       text not null default 'other',   -- national | eid | other
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

comment on table holidays is
  'العطل الرسمية — تُستثنى من حساب أيام العمل في كل مؤقّتات المنصّة. تُدار من بوابة مدير النظام؛ والأعياد قمريّةٌ فتُدخَل بتواريخها المعتمدة سنوياً.';

alter table holidays enable row level security;

-- القراءة للجميع: حساب المهلة يخصّ كل بوابةٍ فيها مؤقّت.
drop policy if exists holidays_read on holidays;
create policy holidays_read on holidays for select to authenticated using (true);
grant select on holidays to authenticated;

-- ── يومُ عملٍ: ليس عطلةً أسبوعية ولا عطلةً رسمية ──
create or replace function public.is_business_day(_d date)
returns boolean
language sql stable
set search_path = public
as $$
  select extract(dow from _d) not in (5, 6)
     and not exists (select 1 from holidays h where h.day = _d);
$$;

-- ── إعادة كتابة الحاسبة: نفس العقد، والعطل الرسمية مستثناة ──
-- ⚠️ كانت immutable وهي تقرأ جدولاً الآن، فصارت stable — والقراءة تُفرض
-- بالفارق: immutable تُخبّئ النتيجة ولا ترى تغيّر الجدول.
create or replace function public.business_days_between(_from timestamptz, _to timestamptz)
returns int
language sql stable
set search_path = public
as $$
  select coalesce(count(*) filter (
           where extract(dow from d) not in (5, 6)
             and not exists (select 1 from holidays h where h.day = d::date)
         ), 0)::int
  from generate_series(date_trunc('day', _from) + interval '1 day',
                       date_trunc('day', _to), interval '1 day') d
$$;

-- ── إدارة التقويم — لمدير النظام وحده، ومسجَّلةٌ في التدقيق ──
create or replace function public.holiday_upsert(_day date, _name text, _kind text default 'other')
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid();
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid, 'sysadmin') then raise exception 'forbidden: not sysadmin'; end if;
  if _day is null then raise exception 'التاريخ مطلوب'; end if;
  if _name is null or btrim(_name) = '' then raise exception 'اسم العطلة مطلوب'; end if;
  if coalesce(_kind, 'other') not in ('national', 'eid', 'other') then
    raise exception 'نوع غير معروف: % (national | eid | other)', _kind;
  end if;

  insert into holidays (day, name, kind, created_by)
  values (_day, btrim(_name), coalesce(_kind, 'other'), _uid)
  on conflict (day) do update set name = excluded.name, kind = excluded.kind;

  insert into audit_log (actor_id, action, target)
  values (_uid, 'holiday_upsert', to_char(_day, 'YYYY-MM-DD') || ' · ' || btrim(_name));
end $$;
revoke execute on function public.holiday_upsert(date, text, text) from public, anon;
grant  execute on function public.holiday_upsert(date, text, text) to authenticated;

create or replace function public.holiday_remove(_day date)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid();
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid, 'sysadmin') then raise exception 'forbidden: not sysadmin'; end if;
  delete from holidays where day = _day;
  insert into audit_log (actor_id, action, target)
  values (_uid, 'holiday_remove', to_char(_day, 'YYYY-MM-DD'));
end $$;
revoke execute on function public.holiday_remove(date) from public, anon;
grant  execute on function public.holiday_remove(date) to authenticated;

-- ── بذرة: المؤكَّد وحده ──
-- يوم التأسيس (٢٢ فبراير) واليوم الوطني (٢٣ سبتمبر) تاريخان ميلاديّان
-- ثابتان بأمرٍ ملكيّ، فيُبذران بأمان.
--
-- والعيدان من **تقويم أم القرى الرسميّ** (ummulqura.org.sa، قُرئ 2026-08-15):
--   ١ شوال 1448 = 9 مارس 2027 · ٩ ذو الحجة 1448 (عرفة) = 15 مايو 2027،
--   فعيد الأضحى (١٠ ذو الحجة) = 16 مايو 2027.
--
-- ⚠️ تحفّظان لازمان — ولذلك يبقى التقويم قابلاً للتحرير من بوابة الأدمن:
--   ١) التقويم نفسه ينصّ: «قد تختلف يوماً واحداً بناءً على رؤية الهلال
--      الفعلية». فتُراجَع التواريخ عند إعلانها.
--   ٢) المبذور هو **يوم العيد نفسه** لا **مدّة العطلة الرسمية**: عطلة
--      الجهات الحكومية تمتدّ أياماً يحدّدها تعميمٌ سنويّ (وتبدأ في الأضحى
--      من يوم عرفة عادةً)، وتمديدُ اليوم الوطني حين يقع في نهاية الأسبوع
--      يُعلَن كذلك. لا تُخمَّن هنا — تُضاف بالتعميم المعتمد.
insert into holidays (day, name, kind) values
  ('2026-02-22', 'يوم التأسيس',   'national'),
  ('2026-09-23', 'اليوم الوطني',  'national'),
  ('2027-02-22', 'يوم التأسيس',   'national'),
  ('2027-09-23', 'اليوم الوطني',  'national'),
  ('2027-03-09', 'عيد الفطر (١ شوال 1448)',      'eid'),
  ('2027-05-16', 'عيد الأضحى (١٠ ذو الحجة 1448)', 'eid')
on conflict (day) do nothing;
