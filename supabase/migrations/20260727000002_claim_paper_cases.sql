-- ============================================================
-- إصلاح: الحالة الورقية تُدخل بهوية غير موثّقة و submitted_by فارغ،
-- ولا خطوة تربطها بصاحبها عند أول دخول نفاذ — فتظهر بوابته فارغة
-- ولا يستطيع رؤية القرار ولا توقيع الاتفاقية (م11) ولا التظلّم (م21)
-- رغم أن شاشة الاستقبال تعد بأن الهوية «تُفعَّل عبر نفاذ لاحقاً».
--
-- الحل: دالة يستدعيها جسر نفاذ (بمفتاح الخدمة حصراً) بعد توثيق الهوية،
-- فتضمّ إلى الحساب كلَّ حالةٍ ورقيةٍ غير مملوكة تحمل رقم هويته،
-- وتَسِمُ الهوية موثّقةً وتقيّد ذلك في التدقيق وتُشعر صاحبها.
-- ============================================================

create or replace function public.claim_paper_cases(_user_id uuid, _nid text)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _n integer := 0;
  r record;
begin
  -- استدعاء الجسر عبر service_role فقط — الربط يقع بعد توثيق نفاذ لا بادعاء المستخدم
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'forbidden: service bridge only';
  end if;
  if _user_id is null or _nid is null or btrim(_nid) = '' then
    raise exception 'user and national id are required';
  end if;

  for r in
    select pc.id, pc.ref_no
      from protection_cases pc
      join protection_requests pr on pr.case_id = pc.id
     where pc.submitted_by is null
       and pr.channel = 'paper'
       and pr.details->'identity'->>'nid' = _nid
       for update of pc
  loop
    update protection_cases
       set submitted_by = _user_id, updated_at = now()
     where id = r.id;

    update protection_requests
       set details = jsonb_set(
                       jsonb_set(details, '{verified}', 'true'::jsonb),
                       '{identity,verified}', 'true'::jsonb)
     where case_id = r.id;

    insert into audit_log (actor_id, action, target)
    values (_user_id, 'claim_paper_case_nafath', r.ref_no);

    insert into notifications (case_id, type, title, body, target_tab, sent_at)
    values (r.id, 'identity_verified', 'فُعّلت هويتك على طلبك الورقيّ',
            'وُثّقت هويتك عبر نفاذ ورُبط طلبك الورقيّ بحسابك — يمكنك الآن متابعته وتوقيع الاتفاقية والتظلّم من بوابتك.',
            'requests', now());

    _n := _n + 1;
  end loop;

  return _n;
end $$;

revoke execute on function public.claim_paper_cases(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_paper_cases(uuid, text) to service_role;
