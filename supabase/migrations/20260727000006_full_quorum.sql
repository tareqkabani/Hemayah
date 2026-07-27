-- ============================================================
-- تصحيح النصاب: تتقدّم القضية للقرار بعد ورود مخرجات **كل** المُسنَدين.
--
-- السيناريو المعتمد: «قد يُسنَد الطلب الواحد إلى عدّة دارسين وعدّة مقيّمين،
-- يعمل كلٌّ منهم بمعزل عن الآخرين… تُجمَّع كل المخرجات آلياً وتُعرض على
-- معدّ القرار» — فالغاية تعدّد الآراء المستقلّة، لا مجرّد بلوغ رأيٍ واحد.
--
-- وكان المُشغِّل يكتفي بدراسةٍ واحدة وتقييمٍ واحد ثمّ يُلغي بقية المهامّ
-- بوسم «اكتُفي بالنصاب». أثر ذلك المقيس على 53 قضيةً بلغت القرار:
--   • صفر قضية وصلت برأيَي تقييم — 48 منها برأيٍ واحد فقط.
--   • 37 وصلت برأيَي دراسة، وذلك بمحض ترتيب التنفيذ لا بالتصميم:
--     الدارسان يفرغان قبل وصول أوّل تقييم، فأوّل تقييمٍ يُغلق النصاب.
-- أي أنّ وعد «تُجمَّع كل المخرجات» لم يكن يتحقّق على جانب التقييم قطّ،
-- ومعدّ القرار يقرأ «التقييمات (1)» فيحسبها كلَّ ما وُجد، وهي كلُّ ما نجا.
--
-- ⚠️ اقتران لازم: بهذا التغيير يصير الحارس (study_eval_watchdog) شرطاً
-- لا خياراً — فمهمّةٌ لا تُسلَّم كانت تُلغى بالنصاب، وصارت تحجز القضية
-- حتى يُعيد الحارس إسنادها. لذلك يُفعَّل مفتاحه هنا صراحةً بدل تركه
-- لكل بيئة (المهمّة مجدولة أصلاً في cron كل 30 دقيقة).
-- ============================================================

create or replace function public._auto_send_to_decision()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare _ns int; _na int; _pending int; _cur case_status; _ref text;
begin
  select status, ref_no into _cur, _ref from protection_cases where id = NEW.case_id;
  if _cur is distinct from 'under_study' then return NEW; end if;

  -- المخرجات الواردة فعلاً (غير المُلغاة)
  select count(*) into _ns from studies
    where case_id = NEW.case_id and submitted_at is not null and superseded_at is null;
  select count(*) into _na from assessments
    where case_id = NEW.case_id and submitted_at is not null and superseded_at is null;

  -- مهامّ حيّة لم تُسلَّم بعد: تحجز القضية حتى تُسلَّم أو يُعيد الحارس إسنادها
  select (select count(*) from studies
            where case_id = NEW.case_id and submitted_at is null and superseded_at is null)
       + (select count(*) from assessments
            where case_id = NEW.case_id and submitted_at is null and superseded_at is null)
    into _pending;

  -- الشرط: رأيٌ واحدٌ على الأقلّ من كلّ دور، **ولا مهمّة معلّقة**.
  if _ns >= 1 and _na >= 1 and _pending = 0 then
    update protection_cases set status = 'in_decision', updated_at = now() where id = NEW.case_id;
    insert into council_decisions (case_id, status) values (NEW.case_id, 'preparing')
      on conflict (case_id) do nothing;

    insert into audit_log (actor_id, action, target)
      values (auth.uid(), 'auto_send_to_decision', _ref);
  end if;
  return NEW;
end $$;

-- تفعيل الحارس: لم يعد اختيارياً بعد ربط التقدّم باكتمال المهامّ.
do $$
begin
  execute format('alter database %I set app.settings.watchdog = %L', current_database(), 'on');
exception when insufficient_privilege then
  raise warning 'تعذّر تفعيل الحارس آلياً — فعّله يدوياً: alter database <db> set app.settings.watchdog = ''on'';';
end $$;
