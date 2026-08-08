-- 20260808000001_notification_engine.sql — محرّك الإشعارات من القوالب (الأمر 4)
-- الإرسال يقرأ notification_templates بالمفتاح، يعبّئ المتغيّرات بصرامة
-- (متغيّر بلا قيمة = خطأ صريح، لا نصّ ناقص)، يحترم مفتاح التفعيل من بوابة
-- الأدمن (موقوف = لا إرسال بلا خطأ)، ويكتب صفاً في notifications + audit_log.
--
-- التغطية في هذه الدفعة (ما لا يتصادم مع PRs الفرز/التقديم المفتوحة):
--   إصدار القرار (n_dec_accept/n_dec_reject + دعوة التوقيع n_agreement + إشعار
--   الجهة n_dec_entity الجديد) · طرح التصويت n_voting (لم يكن منفَّذاً) ·
--   توقيع الاتفاقية n_signed · التظلّم (n_grv_received الجديد + n_grv_result) ·
--   مراقب مهلة توصية الجهة (n_ent_remind/n_ent_late — كانت المهلة تُكتب ولا
--   يقرؤها أحد). المؤجَّل: n_received/n_paper/n_triage_* (منطقة #62/#63)
--   وn_renew (يلزمها كيان دورة متابعة غير موجود بعد).
-- تُطبَّق بعد 20260807000003 (بذور طبقة المحتوى).

-- ══════════════════════════════ 1) التعبئة الصارمة ══════════════════════════════
-- المتغيّرات تُكتشف من النص وقت الإرسال (لا من عمود variables — قد يَقدُم
-- بعد تحرير القالب من بوابة الأدمن). {اسم_المتغير} → قيمة من _vars.
create or replace function public.render_template_text(_text text, _vars jsonb)
returns text language plpgsql immutable as $$
declare _out text := _text; _var text; _val text;
begin
  for _var in select distinct m[1] from regexp_matches(_text, '\{([^}]+)\}', 'g') as m loop
    _val := _vars ->> _var;
    if _val is null then
      raise exception 'متغيّر القالب بلا قيمة: {%} — لا يُرسَل نصٌّ ناقص', _var
        using errcode = '22023';
    end if;
    _out := replace(_out, '{' || _var || '}', _val);
  end loop;
  return _out;
end $$;

-- ══════════════════════════════ 2) الإرسال من القالب ══════════════════════════════
-- ترجع true إن أُرسل، وfalse إن كان القالب موقوفاً من بوابة الأدمن.
-- قالبٌ غير موجود = خطأ تهيئة صريح (لا تجاهل صامت).
-- _type يجب أن يوافق قيد notifications_type_check — يمرَّر صريحاً من كل موضع.
create or replace function public.notify_from_template(
  _template_key text,
  _vars         jsonb,
  _case_id      uuid default null,
  _type         text default null,
  _target_tab   text default null,
  _recipient_id uuid default null,
  _authority    referral_authority default null,
  _crit         boolean default false
) returns boolean
language plpgsql security definer set search_path = public as $$
declare _tpl notification_templates%rowtype; _subject text; _body text;
begin
  select * into _tpl from notification_templates where template_key = _template_key;
  if not found then
    raise exception 'قالب إشعار غير معرّف: %', _template_key using errcode = 'P0002';
  end if;
  if not _tpl.active then
    return false; -- موقوف من بوابة الأدمن — تعطيل الإرسال مقصود لا خطأ
  end if;

  _subject := render_template_text(_tpl.subject, coalesce(_vars, '{}'::jsonb));
  _body    := render_template_text(_tpl.body,    coalesce(_vars, '{}'::jsonb));

  insert into notifications (case_id, type, title, body, target_tab, recipient_id, authority, crit, sent_at)
  values (_case_id, _type, _subject, _body, _target_tab, _recipient_id, _authority, _crit, now());

  insert into audit_log (actor_id, action, target)
  values (auth.uid(), 'notify_' || _template_key, coalesce(_case_id::text, '—'));

  return true;
end $$;

comment on function public.notify_from_template is
  'محرّك الإشعارات: القالب من notification_templates، تعبئة صارمة، احترام مفتاح التفعيل، وأثر تدقيق لكل إرسال.';

-- تُستدعى من دوال SECURITY DEFINER فقط — لا تنفيذ مباشراً من العملاء
revoke execute on function public.notify_from_template(text, jsonb, uuid, text, text, uuid, referral_authority, boolean) from public, anon, authenticated;
revoke execute on function public.render_template_text(text, jsonb) from public, anon, authenticated;

-- ══════════════ 3) مواءمة نصوص القوالب مع المتغيّرات المتاحة فعلاً ══════════════
-- قرار «المعتمد ما في القاعدة»: لا رقم قرارٍ مستقلاً في النظام (المرجع رقم
-- الطلب)، ولا مهلة توقيعٍ مفروضة — فتُصاغ القوالب بما يملؤه النظام صدقاً.
update notification_templates set
  subject = 'صدر قرار قبول طلب الحماية {رقم_الطلب}',
  body = 'صدر قرار المركز بتاريخ {تاريخ_القرار} بقبول طلبكم {رقم_الطلب}. لاستكمال الإجراء يلزم توقيع اتفاقية الحماية (م11) عبر «نفاذ»، وتبدأ التدابير من تاريخ التوقيع.'
where template_key = 'n_dec_accept';

update notification_templates set
  subject = 'قرار بشأن طلب الحماية {رقم_الطلب}',
  body = 'صدر قرار المركز بتاريخ {تاريخ_القرار} برفض الطلب {رقم_الطلب} للأسباب الآتية: {أسباب_الرفض}. ولكم التظلّم على القرار خلال {مهلة_التظلم} من تاريخ الإشعار.'
where template_key = 'n_dec_reject';

update notification_templates set
  body = 'اتفاقية الحماية الخاصة بطلبكم {رقم_الطلب} جاهزة للتوقيع. اطّلعوا على الالتزامات كاملةً ثم وقّعوا عبر «نفاذ» — التدابير تبدأ من تاريخ التوقيع.'
where template_key = 'n_agreement';

update notification_templates set
  body = 'طُرح ملف الحالة {الرمز_السري} للتصويت بتاريخ {تاريخ_الطرح}. المستندات مرفقةٌ كاملة وأقرّ المعدّ باكتمالها — التصويت قبولٌ أو رفض، وتُغلق المهلة بعد يوم عمل.'
where template_key = 'n_voting';

-- قالب جديد: إشعار الجهة الموصية بصدور القرار (كان نصاً مضمّناً في council_issue)
insert into notification_templates (template_key, title, category, trigger_desc, recipient, channels, legal_ref, subject, body) values
('n_dec_entity','صدور القرار — إشعار الجهة الموصية','decision','عند إصدار القرار في قضية عليها توصية جهة','ضابط اتصال الجهة','{entity_portal}','م10',
 'صدر قرار المركز في قضيّة أوصيتم بشأنها',
 'أصدر رئيس المركز القرار في الطلب {الرمز_السري} — {نتيجة_القرار}. التوصية استشارية والقرار خالصٌ للمركز.')
on conflict (template_key) do nothing;

-- إعادة اشتقاق عمود المتغيّرات لما عُدّل
update notification_templates set variables = (
  select coalesce(array_agg(distinct m[1]), '{}')
  from regexp_matches(subject || ' ' || body, '\{([^}]+)\}', 'g') as m)
where template_key in ('n_dec_accept','n_dec_reject','n_agreement','n_voting','n_dec_entity');

-- ══════════════ 4) إصدار القرار — من القوالب (كان نصاً مضمّناً) ══════════════
create or replace function public.council_issue(_case_id uuid, _reason text)
returns table(outcome text) language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _ref text; _t record; _st text; _newcase case_status; _sec text; _vars jsonb;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid, 'board_chair') then raise exception 'غير مصرَّح: الإصدار بيد رئيس المركز حصراً.'; end if;
  select cd.status into _st from council_decisions cd where cd.case_id = _case_id for update;
  if _st <> 'voting' then raise exception 'القرار ليس في التصويت (%).', _st; end if;
  select * into _t from public.council_tally(_case_id);
  if not _t.closed then raise exception 'لم يُغلق التصويت بعد (بلوغ 4/7 أو انتهاء المهلة).'; end if;
  if _t.outcome = 'reject' and (_reason is null or btrim(_reason) = '') then
    raise exception 'قرار الرفض يتطلّب تسبيباً مكتوباً (م21).';
  end if;
  select ref_no, secret_code into _ref, _sec from protection_cases where id = _case_id;

  update council_decisions
     set status = 'issued', issued_type = _t.outcome, issued_reason = _reason, issued_at = now(), updated_at = now()
   where case_id = _case_id;

  _newcase := case _t.outcome when 'accept' then 'accepted'::case_status else 'rejected'::case_status end;
  update protection_cases set status = _newcase, updated_at = now() where id = _case_id;

  insert into board_decisions (case_id, type, justification, decided_at)
  values (_case_id, case _t.outcome when 'accept' then 'accept'::decision_type else 'reject'::decision_type end,
          coalesce(_reason, 'قرار المجلس'), now());

  -- إشعار الطرف الأول: طالب الحماية (فوريّ — م10) — من notification_templates
  _vars := jsonb_build_object(
    'رقم_الطلب', coalesce(_ref, '—'),
    'تاريخ_القرار', to_char(now(), 'YYYY-MM-DD'),
    'أسباب_الرفض', coalesce(nullif(btrim(_reason), ''), '—'),
    'مهلة_التظلم', '10 أيام');
  perform notify_from_template(
    case _t.outcome when 'accept' then 'n_dec_accept' else 'n_dec_reject' end,
    _vars, _case_id, 'decision', 'requests');

  -- قرار القبول يستتبع دعوة توقيع الاتفاقية (م11)
  if _t.outcome = 'accept' then
    perform notify_from_template('n_agreement', _vars, _case_id, 'agreement', 'requests');
  end if;

  -- إشعار الطرف الثاني: الجهة المختصة الموصية (إن وُجدت توصية على القضية)
  if exists (select 1 from recommendations rc where rc.case_id = _case_id) then
    perform notify_from_template('n_dec_entity',
      jsonb_build_object('الرمز_السري', coalesce(_sec, ''),
        'نتيجة_القرار', case _t.outcome when 'accept' then 'قبول الحماية' else 'عدم القبول' end),
      _case_id, 'decision', 'incoming', null, 'competent'::referral_authority);
  end if;

  insert into audit_log (actor_id, action, target) values (_uid, 'council_issue_' || _t.outcome, _ref);
  return query select _t.outcome;
end $$;

-- ══════════════ 5) طرح التصويت — إشعار المقاعد السبعة (لم يكن منفَّذاً) ══════════════
create or replace function public.council_open_voting(_case_id uuid)
returns table(status text) language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _st text; _prep uuid; _ref text; _sec text;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid, 'case_officer') then raise exception 'forbidden: not preparer'; end if;
  select cd.status, cd.preparer_id into _st, _prep from council_decisions cd where cd.case_id = _case_id for update;
  if _st is null then raise exception 'لا قرار لهذه القضية.'; end if;
  if _prep is not null and _prep <> _uid then raise exception 'الطرح لمعدّ هذا القرار حصراً.'; end if;
  if _st is distinct from 'approved' then raise exception 'لا طرح قبل اعتماد النائب والرئيس (الحالة %).', _st; end if;
  select ref_no, secret_code into _ref, _sec from protection_cases where id = _case_id;
  update council_decisions set status = 'voting', voting_started_at = now(), deadline_closed = false, updated_at = now()
   where case_id = _case_id;

  -- n_voting لكل مقعد مصوّت (الأعضاء + النائب + الرئيس) — كلٌّ بصفّه
  perform notify_from_template('n_voting',
    jsonb_build_object('الرمز_السري', coalesce(_sec, ''), 'تاريخ_الطرح', to_char(now(), 'YYYY-MM-DD')),
    _case_id, 'incoming', 'notifications', ur.user_id)
  from user_roles ur where ur.role in ('board_member', 'deputy_chair', 'board_chair');

  insert into audit_log (actor_id, action, target) values (_uid, 'council_open_voting', _ref);
  return query select 'voting'::text;
end $$;

-- ══════════════ 6) توقيع الاتفاقية — n_signed بأنواع الحماية الفعلية ══════════════
create or replace function public.seeker_sign_agreement(_case_id uuid)
returns table(status case_status)
language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _cur case_status; _ref text; _types text;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;

  -- صاحب القضية فقط يوقّع اتفاقيّته
  select c.status, c.ref_no into _cur, _ref
  from protection_cases c
  where c.id = _case_id and c.submitted_by = _uid
  for update;
  if _cur is null then raise exception 'القضية غير موجودة أو ليست لك'; end if;
  if _cur not in ('accepted','signed') then
    raise exception 'لا يمكن التوقيع: حالة الطلب ليست «مقبولاً» (%).', _cur;
  end if;

  update protection_cases set status = 'active', updated_at = now() where id = _case_id;

  insert into protection_documents (case_id, signed_at) values (_case_id, now());

  select string_agg(x, '، ') into _types
  from council_decisions cd, jsonb_array_elements_text(coalesce(cd.types, '[]'::jsonb)) x
  where cd.case_id = _case_id;
  perform notify_from_template('n_signed',
    jsonb_build_object('تاريخ_التوقيع', to_char(now(), 'YYYY-MM-DD'),
      'أنواع_الحماية', coalesce(_types, 'التدابير المقرّرة في القرار')),
    _case_id, 'agreement', 'requests');

  insert into audit_log (actor_id, action, target) values (_uid, 'seeker_sign_agreement', _ref);

  return query select 'active'::case_status;
end $$;

create or replace function public.sign_agreement(_case_id uuid)
returns table(status case_status)
language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _cur case_status; _ref text; _types text;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid, 'case_officer') then raise exception 'forbidden: not case_officer'; end if;
  select c.status, c.ref_no into _cur, _ref from protection_cases c where c.id = _case_id for update;
  if _cur is null then raise exception 'case not found'; end if;
  if _cur not in ('accepted','signed') then raise exception 'الحالة ليست مقبولةً بعدُ (%).', _cur; end if;

  update protection_cases set status = 'active', updated_at = now() where id = _case_id;

  insert into protection_documents (case_id, signed_at)
  values (_case_id, now());

  select string_agg(x, '، ') into _types
  from council_decisions cd, jsonb_array_elements_text(coalesce(cd.types, '[]'::jsonb)) x
  where cd.case_id = _case_id;
  perform notify_from_template('n_signed',
    jsonb_build_object('تاريخ_التوقيع', to_char(now(), 'YYYY-MM-DD'),
      'أنواع_الحماية', coalesce(_types, 'التدابير المقرّرة في القرار')),
    _case_id, 'agreement', 'requests');

  insert into audit_log (actor_id, action, target) values (_uid, 'sign_agreement', _ref);
  return query select 'active'::case_status;
end $$;

-- ══════════════ 7) التظلّم: استلامٌ للمتظلّم (جديد) + نتيجةٌ من القالب ══════════════
create or replace function public._notify_grievance_intake() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare _c record;
begin
  select secret_code, category into _c from protection_cases where id = new.case_id;

  if new.assigned_to is not null then
    insert into notifications (case_id, recipient_id, type, title, body, target_tab, sent_at)
    values (new.case_id, new.assigned_to, 'assign',
      'تظلّم مُسنَد إليك — ' || new.ref,
      coalesce(_c.secret_code,'') || ' — ' || category_ar(_c.category) || ' · ' || _scope_ar(new.scope)
        || '. أُسنِد إليك آلياً حسب العبء — بانتظار قرارك المستقلّ.',
      'cases', now());
    insert into notifications (case_id, recipient_id, type, title, body, target_tab, crit, sent_at)
    values (new.case_id, new.assigned_to, 'deadline',
      'مهلة البتّ الجارية — ' || new.ref,
      'يُبتّ في التظلّم خلال (10) أيام من رفعه (م21) — أصدر قرارك المستقلّ قبل انقضائها.',
      'cases', true, now());
  end if;

  insert into notifications (case_id, recipient_id, type, title, body, target_tab, sent_at)
  select new.case_id, ur.user_id, 'incoming',
    'تظلّم وارد جديد — ' || new.ref,
    coalesce(_c.secret_code,'') || ' — ' || category_ar(_c.category) || ' · ' || _scope_ar(new.scope)
      || '. أُسنِد آلياً حسب العبء؛ تجري مهلة (10) أيام (م21).',
    'cases', now()
  from user_roles ur where ur.role = 'tech_manager';

  -- الجديد: إفادة المتظلّم بالاستلام (n_grv_received — كانت في الكتالوج بلا تنفيذ)
  perform notify_from_template('n_grv_received',
    jsonb_build_object('رقم_التظلم', new.ref, 'تاريخ_التقديم', to_char(now(), 'YYYY-MM-DD')),
    new.case_id, 'grievance_in', 'requests');

  return new;
end $$;

create or replace function public._notify_seeker_grievance() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.status in ('upheld','dismissed') and new.status is distinct from old.status then
    perform notify_from_template('n_grv_result',
      jsonb_build_object(
        'رقم_التظلم', new.ref,
        'تاريخ_البت', to_char(now(), 'YYYY-MM-DD'),
        'نتيجة_التظلم', case when new.status = 'upheld'
          then 'قبول التظلّم وإعادة النظر في القرار' else 'رفض التظلّم وتأييد القرار' end,
        'الأسباب', coalesce(nullif(new.tech_opinion, ''), '—')),
      new.case_id,
      case when new.status = 'upheld' then 'grievance_upheld' else 'grievance_dismissed' end,
      'requests');
  end if;
  return new;
end $$;

-- ══════════ 8) مراقب مهلة توصية الجهة — كانت due_at تُكتب ولا يقرؤها أحد ══════════
-- تذكيرٌ قبل يوم من الاستحقاق (n_ent_remind) وتصعيدٌ يومي بعد التجاوز
-- (n_ent_late للجهة وللقيادة) — بلا إغلاق تلقائي (م9).
create or replace function public.recommendations_watchdog() returns void
language plpgsql security definer set search_path = public, extensions as $$
declare r record; _sec text;
begin
  if not watchdog_enabled() then return; end if;

  for r in
    select rc.case_id, rc.due_at
    from recommendations rc
    where rc.decision is null and rc.due_at is not null
  loop
    select secret_code into _sec from protection_cases where id = r.case_id;

    if now() >= r.due_at then
      -- تصعيد التجاوز — مرة كل يوم لكل قضية
      if not exists (select 1 from notifications n
                     where n.case_id = r.case_id and n.title like 'تجاوز مهلة التوصية%'
                       and n.created_at > now() - interval '1 day') then
        perform notify_from_template('n_ent_late',
          jsonb_build_object('الرمز_السري', coalesce(_sec, ''),
            'التجاوز', greatest(1, extract(day from now() - r.due_at)::int) || ' يوم'),
          r.case_id, 'deadline', 'incoming', null, 'competent'::referral_authority, true);
        perform notify_from_template('n_ent_late',
          jsonb_build_object('الرمز_السري', coalesce(_sec, ''),
            'التجاوز', greatest(1, extract(day from now() - r.due_at)::int) || ' يوم'),
          r.case_id, 'deadline', 'tasks', ur.user_id, null, true)
        from user_roles ur where ur.role in ('deputy_chair', 'board_chair');
      end if;
    elsif now() >= r.due_at - interval '1 day' then
      -- تذكير قبل يوم العمل الأخير — مرة واحدة
      if not exists (select 1 from notifications n
                     where n.case_id = r.case_id and n.title like 'تذكير: تبقّى%') then
        perform notify_from_template('n_ent_remind',
          jsonb_build_object('الرمز_السري', coalesce(_sec, ''),
            'المتبقي', 'يوم عمل', 'تاريخ_الاستحقاق', to_char(r.due_at, 'YYYY-MM-DD')),
          r.case_id, 'deadline', 'incoming', null, 'competent'::referral_authority);
      end if;
    end if;
  end loop;
end $$;

revoke execute on function public.recommendations_watchdog() from public, anon, authenticated;

-- الجدولة كل نصف ساعة — النمط نفسه المعتمد لمراقب الدراسة والتقييم
select cron.schedule('recommendations-watchdog', '*/30 * * * *', $$select public.recommendations_watchdog()$$);
