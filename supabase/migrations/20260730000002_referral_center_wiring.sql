-- ============================================================
--  ربط ناقل إحالات م14 بالمركز: الإصدار والإقفال من القاعدة لا من localStorage.
--
--  الحلقة المقطوعة: بوابتا الصحة والموارد تقرآن جدول referrals الحقيقي،
--  بينما المركز يُصدر الإحالات محليّاً فلا تصل الجهةَ أصلاً. هذه الهجرة تمنح
--  المركز: (١) قراءة كل الإحالات (هو مُصدرها ومتابعها)، (٢) دالة إصدارٍ
--  referral_create، (٣) دالة إقفالٍ referral_close (done→closed حصراً —
--  دورة «متابعة التنفيذ»)، (٤) تحصين referral_update ضد الحالة المقفلة،
--  (٥) تمكين القسم القانوني الداخلي (سلطة legal تُعالَج داخل المركز نفسه).
--
--  تعتمد على 20260730000001 (قيمة التعداد 'closed').
-- ============================================================

-- ── (١) موظف المركز يقرأ كل الإحالات — الكتابة عبر الدوال المفروضة حصراً ──
drop policy if exists referral_center_read on referrals;
create policy referral_center_read on referrals for select using (
  has_role(auth.uid(),'case_officer'));

-- ── (٥) القسم القانوني قسمٌ داخليّ بالمركز: موظف المركز يحمل سلطة legal ──
--  (سمة الدور هي مفتاح has_authority وسياسة referral_authority_rw —
--   فتمرّ دورة المستشار/المدير عبر referral_update المفروضة نفسها.)
update user_roles
   set attributes = jsonb_set(coalesce(attributes,'{}'::jsonb), '{authority}', '"legal"')
 where role = 'case_officer';

-- ── (٢) إصدار إحالة م14 من المركز → الجهة المنفّذة ──
create or replace function public.referral_create(
  _secret text, _service text, _authority referral_authority, _summary text)
returns referrals
language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _cid uuid; _ref_no text; _row referrals;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid,'case_officer') then raise exception 'forbidden: case_officer only'; end if;

  -- الإحالة لمشمولٍ نشطٍ فقط (تُفتح التدابير بعد توقيع الاتفاقية والتفعيل)
  select id into _cid from protection_cases where secret_code = _secret and status = 'active';
  if _cid is null then raise exception 'لا قضية نشطة بهذا الرمز السري'; end if;

  -- لا ازدواج: إحالةٌ واحدة حيّة لكل تدبيرٍ في القضية (يُعاد الإصدار بعد الإقفال)
  if exists (select 1 from referrals where case_id = _cid and service = _service and status <> 'closed') then
    raise exception 'إحالة قائمة لهذا التدبير — أقفِلها قبل إعادة الإصدار';
  end if;

  _ref_no := 'REF-'||upper(substr(_authority::text,1,3))||'-'||upper(substr(md5(gen_random_uuid()::text),1,6));
  insert into referrals (case_id, service, authority, ref, status, summary, history)
  values (_cid, _service, _authority, _ref_no, 'new', nullif(trim(_summary),''),
    jsonb_build_array(jsonb_build_object(
      'at', now(), 'by', 'مركز الحماية', 'note', 'إصدار الإحالة وتوجيهها للجهة', 'status', 'new')))
  returning * into _row;

  insert into audit_log (actor_id, action, target)
  values (_uid, 'referral_create_'||_authority::text, _ref_no);
  return _row;
end $$;
revoke execute on function public.referral_create(text, text, referral_authority, text) from public, anon;
grant  execute on function public.referral_create(text, text, referral_authority, text) to authenticated;

-- ── (٣) إقفال الإحالة من المركز: اطّلاعٌ على النتيجة وإدراجها في الملف ──
--  done → closed حصراً، ولموظف المركز حصراً (الجهة تقف عند اعتماد مديرها).
create or replace function public.referral_close(_id uuid, _note text)
returns referrals
language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _row referrals; _case_ref text;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid,'case_officer') then raise exception 'forbidden: case_officer only'; end if;

  select * into _row from referrals where id = _id for update;
  if _row.id is null then raise exception 'referral not found'; end if;
  if _row.status <> 'done' then
    raise exception 'انتقال غير مسموح: % → closed (الإقفال بعد اعتماد الجهة فقط)', _row.status;
  end if;

  update referrals set
    status  = 'closed',
    history = coalesce(history,'[]'::jsonb) || jsonb_build_object(
                'at', now(), 'by', 'مركز الحماية',
                'note', coalesce(nullif(trim(_note),''), 'اطّلع المركز على النتيجة وأدرجها في الملف'),
                'status', 'closed'),
    updated_at = now()
  where id = _id
  returning * into _row;

  select ref_no into _case_ref from protection_cases where id = _row.case_id;
  insert into audit_log (actor_id, action, target)
  values (_uid, 'referral_closed_'||_row.authority::text, coalesce(_case_ref, _id::text));
  return _row;
end $$;
revoke execute on function public.referral_close(uuid, text) from public, anon;
grant  execute on function public.referral_close(uuid, text) to authenticated;

-- ── (٤) تحصين referral_update: المقفلة نهائيّة — لا تعديل بعد الإقفال ──
--  (إعادة تعريفٍ كاملة لنسخة 20260705000001 مع حارس الحالة المقفلة؛
--   دون الحارس يمرّ فرعُ «_cur = _status» فيُعدَّل سجلُّ إحالةٍ مقفلة.)
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

  if _cur = 'closed' or _status = 'closed' then
    raise exception 'الإحالة مُقفلة — الإقفال ورفعُه ليسا من صلاحية الجهة (referral_close للمركز)';
  end if;

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
revoke execute on function public.referral_update(uuid, referral_status, text, jsonb, text) from public, anon;
grant  execute on function public.referral_update(uuid, referral_status, text, jsonb, text) to authenticated;
