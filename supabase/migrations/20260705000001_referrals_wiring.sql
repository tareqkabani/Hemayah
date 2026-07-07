-- ============================================================
--  ربط بوابات الوزارات المنفّذة (الصحة/الموارد/الأمنية) بقاعدة حقيقية
--  تدابير م14 تُحال من المركز → السلطة المنفّذة عبر جدول referrals،
--  والعزل بالسلطة عبر user_roles.attributes->>'authority' (سياسة referral_authority_rw).
--  آلة حالة مفروضة: new→assigned→progress→review→done (+ إعادة review→progress).
-- ============================================================

-- عمود ملخّص الطلب (نصّ توضيحيّ من المركز) — الباقي يُشتقّ من القضية.
alter table public.referrals add column if not exists summary text;

-- ── هل يملك المستدعي سلطةً منفّذة بعينها؟ (من سمة الدور) ──
create or replace function public.has_authority(_authority referral_authority)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_roles ur
    where ur.user_id = auth.uid()
      and (ur.attributes->>'authority') = _authority::text);
$$;
grant execute on function public.has_authority(referral_authority) to authenticated;

-- ── تحديث إحالة (استلام/جدولة/رفع/اعتماد/إعادة) — يفرض آلة الحالة والعزل ──
create or replace function public.referral_update(
  _id uuid, _status referral_status, _assignee text, _result jsonb, _note text)
returns referrals
language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _row referrals; _cur referral_status; _ref text; _by text;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  select * into _row from referrals where id = _id for update;
  if _row.id is null then raise exception 'referral not found'; end if;
  if not has_authority(_row.authority) then raise exception 'forbidden: not this authority'; end if;
  _cur := _row.status;

  -- آلة الحالة (تسمح بتحديث النتيجة دون تغيّر الحالة، والتقدّم الأماميّ، وإعادة المدير)
  if not (
       _cur = _status
    or (_cur = 'new'      and _status in ('assigned','progress'))
    or (_cur = 'assigned' and _status in ('progress','review'))
    or (_cur = 'progress' and _status in ('review','done'))
    or (_cur = 'review'   and _status in ('done','progress'))
  ) then
    raise exception 'انتقال غير مسموح: % → %', _cur, _status;
  end if;

  select ref_no into _ref from protection_cases where id = _row.case_id;
  _by := coalesce(nullif(_result->>'_by',''), 'الجهة المنفّذة');

  update referrals set
    status   = _status,
    assignee = coalesce(_assignee, assignee),
    result   = coalesce(_result, result),
    history  = coalesce(history,'[]'::jsonb) || jsonb_build_object(
                 'at', now(), 'by', _by, 'note', coalesce(_note,'تحديث الإحالة'), 'status', _status),
    updated_at = now()
  where id = _id
  returning * into _row;

  -- عند الاعتماد النهائيّ: إشعار المركز (يُسجَّل في ملف المشمول).
  if _status = 'done' then
    insert into notifications (case_id, type, title, body, target_tab, sent_at)
    values (_row.case_id, 'referral',
      'اكتمل تدبير الحماية (م14)',
      'نفّذت الجهة المنفّذة التدبير واعتمدته: ' || coalesce(_note,'') , 'requests', now());
  end if;

  insert into audit_log (actor_id, action, target)
  values (_uid, 'referral_'||_status::text||'_'||_row.authority::text, coalesce(_ref, _id::text));
  return _row;
end $$;
grant execute on function public.referral_update(uuid, referral_status, text, jsonb, text) to authenticated;

-- ============================================================
--  بذور: قضايا مشمولين نشطة + إحالاتها للجهات المنفّذة (توضيحيّة — تُحاكي إصدار المركز م14)
-- ============================================================
-- مساعد بذر مؤقّت: يبحث عن القضية بالرمز السريّ ويُنشئ إحالةً إن لم توجد.
create or replace function public._seed_ref(
  _sec text, _service text, _authority referral_authority, _status referral_status,
  _assignee text, _summary text)
returns void language plpgsql as $$
declare _cid uuid;
begin
  select id into _cid from protection_cases where secret_code = _sec;
  if _cid is null then return; end if;
  if exists (select 1 from referrals where case_id=_cid and authority=_authority and service=_service) then return; end if;
  insert into referrals (case_id, service, authority, ref, status, assignee, summary, history)
  values (_cid, _service, _authority,
    'REF-'||upper(substr(_authority::text,1,3))||'-'||substr(_sec,3), _status, _assignee, _summary,
    jsonb_build_array(jsonb_build_object('at', now(), 'by','مركز الحماية','note','إصدار الإحالة وتوجيهها للجهة','status','new')));
end $$;

do $$
declare
  _cases jsonb := jsonb_build_array(
    jsonb_build_object('sec','C-2026-0481','ref','REF-2026-8101','cat','witness','risk','high',  'reg','RUH'),
    jsonb_build_object('sec','C-2026-0466','ref','REF-2026-8102','cat','victim', 'risk','medium','reg','RUH'),
    jsonb_build_object('sec','C-2026-0452','ref','REF-2026-8103','cat','reporter','risk','medium','reg','EAS'),
    jsonb_build_object('sec','C-2026-0440','ref','REF-2026-8104','cat','witness','risk','high',  'reg','MAK'),
    jsonb_build_object('sec','C-2026-0419','ref','REF-2026-8105','cat','expert', 'risk','low',   'reg','RUH')
  );
  _c jsonb; _cid uuid;
begin
  for _c in select * from jsonb_array_elements(_cases) loop
    insert into protection_cases (ref_no, secret_code, category, status, classification, source, case_region)
    values (_c->>'ref', _c->>'sec', (_c->>'cat')::app_category, 'active',
            (_c->>'risk')::risk_level, 'local', (_c->>'reg')::region_code)
    on conflict (secret_code) do nothing;
  end loop;

  -- إحالات الصحة (م14/5 · م9/1)
  perform _seed_ref('C-2026-0481','psych','health','new',      null, 'مشمول بحماية أمنية يعاني قلقاً واضطراب نوم بعد تهديد مباشر؛ جلسات إرشاد نفسي عاجلة.');
  perform _seed_ref('C-2026-0466','assess','health','assigned','s1', 'تقييم نفسي ضمن دراسة الحالة لاحتساب عامل المناسبة قبل القرار.');
  perform _seed_ref('C-2026-0452','social','health','progress','s2', 'دعم اجتماعي وأسري للمشمول بعد النقل من مكان العمل.');
  perform _seed_ref('C-2026-0440','medical','health','review', 's3', 'رعاية طبية لإصابة ناتجة عن اعتداء مرتبط بالشهادة.');
  perform _seed_ref('C-2026-0419','psych','health','done',    's1', 'سلسلة جلسات إرشاد نفسي — اكتملت وأُبلِغ المركز.');

  -- إحالات الموارد البشرية (م13/م14)
  perform _seed_ref('C-2026-0481','transfer','hr','new',      null, 'كُشف مقرّ العمل للجهة المهدِّدة؛ نقل عاجل لفرع آخر حفاظاً على السرّية.');
  perform _seed_ref('C-2026-0466','dismissal','hr','assigned','s1', 'مبلّغة فُصلت بعد بلاغها؛ مراجعة الفصل التعسفي وإعادتها للعمل.');
  perform _seed_ref('C-2026-0452','alt','hr','progress',      's1', 'تعذّر بقاء المشمول في عمله؛ توفير وظيفة بديلة مناسبة.');
  perform _seed_ref('C-2026-0440','housing','hr','review',    's2', 'كُشف المسكن؛ سكن بديل عاجل ثم إعادة توطين.');
  perform _seed_ref('C-2026-0419','finance','hr','done',      's3', 'تعطّل الاكتساب بسبب الحماية؛ دعم ماليّ مؤقّت.');

  -- إحالات الإدارة الأمنية (م12/م14/1-2-9)
  perform _seed_ref('C-2026-0481','guard','security','progress', null, 'حماية شخصية ومرافقة أمنية لمشمول عالي الخطورة.');
  perform _seed_ref('C-2026-0440','secure','security','new',     null, 'تأمين وحراسة مسكن المشمول بعد كشفه.');
  perform _seed_ref('C-2026-0419','testify','security','review', null, 'تدابير الإدلاء بالشهادة (إخفاء الصوت/الوجه).');
end $$;

drop function public._seed_ref(text, text, referral_authority, referral_status, text, text);

-- ── ضبط سمة السلطة على أدوار المستخدم الاختباريّ (العزل يعتمد attributes.authority) ──
update user_roles set attributes = jsonb_set(coalesce(attributes,'{}'::jsonb), '{authority}', '"health"')   where role = 'moh_specialist';
update user_roles set attributes = jsonb_set(coalesce(attributes,'{}'::jsonb), '{authority}', '"health"')   where role = 'moh_manager';
update user_roles set attributes = jsonb_set(coalesce(attributes,'{}'::jsonb), '{authority}', '"hr"')       where role = 'hr_specialist';
update user_roles set attributes = jsonb_set(coalesce(attributes,'{}'::jsonb), '{authority}', '"hr"')       where role = 'hr_manager';
update user_roles set attributes = jsonb_set(coalesce(attributes,'{}'::jsonb), '{authority}', '"security"') where role = 'security_manager';
update user_roles set attributes = jsonb_set(coalesce(attributes,'{}'::jsonb), '{authority}', '"security"') where role = 'security_officer';
update user_roles set attributes = jsonb_set(coalesce(attributes,'{}'::jsonb), '{authority}', '"moi"')      where role = 'moi_officer';
