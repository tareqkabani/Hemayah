-- ============================================================
--  إصلاحات مجلس مراجعة السلسلة (2026-07-22) — ثلاث ثغرات مؤكّدة:
--  1) «لا سحب بلا بديل»: الحارس المُجدوَل كان يوسم المهمة المتعثرة حتى
--     حين لا بديل، فتُشلّ القضية نهائياً (صفر صفوف نشطة، الإسناد يصطدم
--     بالقيد الفريد، وحارس الإحياء يصدّ صاحبها) — الآن: بلا بديلٍ يبقى
--     الصف نشطاً ويُكتفى بإنذار عجزٍ للقيادة (مرة يومياً لكل قضية).
--  2) «قفل الكتابة»: حارس الإحياء كان يُتجاوز بكتابة PostgREST مباشرة
--     (سياسة المؤلّف FOR ALL بلا قيد على superseded_at) — الآن الكتابة
--     على studies/assessments محصورة في دوالّ SECURITY DEFINER حصراً.
--  3) «البثّ الحي للإسناد»: جدولا studies/assessments يُنشران في
--     supabase_realtime كي تلتقط بوابتا الدارس/المقيّم الإسنادَ الجديد
--     وإعادة الإسناد لحظياً دون إعادة تحميل.
-- ============================================================

-- ─────────────────── 1) لا سحب بلا بديل + إنذار غير مُغرِق ───────────────────
create or replace function public._notify_deputies_once_daily(_case_id uuid, _title text, _body text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from notifications n
             where n.case_id = _case_id and n.title = _title
               and n.sent_at > now() - interval '1 day') then
    return; -- أُنذروا خلال اليوم — لا إغراق كل نصف ساعة
  end if;
  perform _notify_deputies(_case_id, _title, _body);
end $$;
revoke execute on function public._notify_deputies_once_daily(uuid, text, text) from public, anon, authenticated;

create or replace function public.study_eval_watchdog()
returns table (reassigned int, exhausted int)
language plpgsql security definer set search_path = public as $$
declare r record; _next uuid; _ref text; _secret text; _re int := 0; _ex int := 0; _hit int;
begin
  if coalesce(current_setting('app.settings.watchdog', true), 'off') <> 'on' then
    return query select 0, 0; return;
  end if;

  for r in
    select 'study' as kind, s.id, s.case_id, s.studier_id as author_id, c.ref_no, c.secret_code
      from studies s join protection_cases c on c.id = s.case_id
     where c.status = 'under_study' and s.submitted_at is null and s.superseded_at is null
       and business_days_between(s.created_at, now()) >= 1
    union all
    select 'assessment', a.id, a.case_id, a.evaluator_id, c.ref_no, c.secret_code
      from assessments a join protection_cases c on c.id = a.case_id
     where c.status = 'under_study' and a.submitted_at is null and a.superseded_at is null
       and business_days_between(a.created_at, now()) >= 1
  loop
    _ref := r.ref_no; _secret := r.secret_code;

    if r.kind = 'study' then
      select ur.user_id into _next
        from user_roles ur
       where ur.role = 'studier'
         and not exists (select 1 from studies s2 where s2.case_id = r.case_id and s2.studier_id = ur.user_id)
       order by (select count(*) from studies s3 where s3.studier_id = ur.user_id
                   and s3.submitted_at is null and s3.superseded_at is null) asc, ur.user_id asc
       limit 1;

      if _next is null then
        -- لا بديل: تبقى المهمة نشطة بيد صاحبها (أهون الشرّين) ويُنذَر النائب
        _ex := _ex + 1;
        perform _notify_deputies_once_daily(r.case_id, 'عجز طاقم الدراسة',
          _secret || ' — تجاوزت مهمة الدراسة مهلتها ولا دارس متاحاً بلا صفٍّ على القضية؛ بقيت بيد صاحبها. يلزم تدخّل القيادة.');
        insert into audit_log (actor_id, action, target) values (null, 'study_pool_exhausted', _ref);
        continue;
      end if;

      update studies set superseded_at = now(),
        superseded_reason = 'تجاوز يوم العمل (م10) — أُعيد الإسناد'
        where id = r.id and submitted_at is null and superseded_at is null;
      get diagnostics _hit = row_count;
      if _hit = 0 then continue; end if; -- اعتُمد في اللحظة الأخيرة — لا سحب

      insert into studies (case_id, studier_id) values (r.case_id, _next);
      _re := _re + 1;
      perform _notify_deputies(r.case_id, 'إعادة إسناد آلية — دراسة',
        _secret || ' — مهمة دراسة تجاوزت يوم العمل (م10) فأُعيد إسنادها آلياً للأقل عبئاً.');
      insert into audit_log (actor_id, action, target) values (null, 'reassign_study', _ref);

    else
      select ur.user_id into _next
        from user_roles ur
       where ur.role = 'evaluator'
         and not exists (select 1 from assessments a2 where a2.case_id = r.case_id and a2.evaluator_id = ur.user_id)
       order by (select count(*) from assessments a3 where a3.evaluator_id = ur.user_id
                   and a3.submitted_at is null and a3.superseded_at is null) asc, ur.user_id asc
       limit 1;

      if _next is null then
        _ex := _ex + 1;
        perform _notify_deputies_once_daily(r.case_id, 'عجز طاقم التقييم',
          _secret || ' — تجاوزت مهمة التقييم مهلتها ولا مقيّم متاحاً بلا صفٍّ على القضية؛ بقيت بيد صاحبها. يلزم تدخّل القيادة.');
        insert into audit_log (actor_id, action, target) values (null, 'assessment_pool_exhausted', _ref);
        continue;
      end if;

      update assessments set superseded_at = now(),
        superseded_reason = 'تجاوز يوم العمل (م10) — أُعيد الإسناد'
        where id = r.id and submitted_at is null and superseded_at is null;
      get diagnostics _hit = row_count;
      if _hit = 0 then continue; end if;

      insert into assessments (case_id, evaluator_id) values (r.case_id, _next);
      _re := _re + 1;
      perform _notify_deputies(r.case_id, 'إعادة إسناد آلية — تقييم',
        _secret || ' — مهمة تقييم تجاوزت يوم العمل (م10) فأُعيد إسنادها آلياً للأقل عبئاً.');
      insert into audit_log (actor_id, action, target) values (null, 'reassign_assessment', _ref);
    end if;
  end loop;

  return query select _re, _ex;
end $$;
revoke execute on function public.study_eval_watchdog() from public, anon, authenticated;

-- ─────────────────── 2) قفل الكتابة: الدوالّ المدقَّقة هي الباب الوحيد ───────────────────
-- كل كتابات المنتج تمرّ عبر SECURITY DEFINER (submit_* · الإسناد · الحارس ·
-- المشغّلات) — الكتابة المباشرة من العملاء لم تعد ممكنة فلا تجاوز للحرّاس.
revoke insert, update, delete on table studies from anon, authenticated;
revoke insert, update, delete on table assessments from anon, authenticated;

-- إثبات ذاتي
do $$
begin
  if has_table_privilege('authenticated', 'public.studies', 'UPDATE')
     or has_table_privilege('authenticated', 'public.assessments', 'UPDATE')
     or has_table_privilege('authenticated', 'public.studies', 'INSERT') then
    raise exception 'قفل كتابة studies/assessments لم يكتمل';
  end if;
end $$;

-- ─────────────────── 3) بثّ الإسناد الحي ───────────────────
do $$
begin
  if not exists (select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='studies') then
    alter publication supabase_realtime add table studies;
  end if;
  if not exists (select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='assessments') then
    alter publication supabase_realtime add table assessments;
  end if;
end $$;
