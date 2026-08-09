-- ============================================================
-- حجب هوية طالب الحماية عن الدارس والمقيّم — سدّ قناة القراءة المباشرة
--
-- المبدأ (م2 من النظام): لا يصل الدارس والمقيّم من هوية طالب الحماية
-- إلا الرمز السري. لكن سياسة study_eval_assigned_req كانت تفتح صفّ
-- protection_requests كاملاً — بما فيه details الحاوية للحالات الورقية
-- مفاتيح identity (الاسم/الهوية/الجوال غير الموثّقة) وemergency_contact
-- وon_behalf، وللإلكترونية onBehalf (هوية المشمول واسمه من نموذج seeker) —
-- فتنتقل للمتصفح في حمولة RSC وعبر supabase-js وإن لم تُعرض.
--
-- العلاج: دالة عرض مقيّدة بالإسناد تُرجع النموذج بعد بتر المفاتيح
-- الثلاثة، وتحلّ محلّ القراءة المباشرة التي تُقفل بإسقاط السياسة.
-- (جهة الاتصال تُكشف للتنفيذ فقط — بوابة الأمن لها مسارها الخاص.)
-- ============================================================

create or replace function public.study_eval_requests(_case_ids uuid[])
returns table (
  case_id        uuid,
  applicant_role text,
  channel        text,
  details        jsonb,
  submitted_at   timestamptz
)
language sql stable security definer set search_path = public as $$
  select r.case_id, r.applicant_role, r.channel,
         -- details قد تكون نصاً حراً (النمط القديم) لا كائناً — البتر للكائن فقط
         case when jsonb_typeof(r.details) = 'object'
              then r.details - array['identity','emergency_contact','on_behalf','onBehalf']
              else r.details
         end as details,
         r.submitted_at
  from protection_requests r
  where r.case_id = any(_case_ids)
    and (is_assigned_study(r.case_id) or is_assigned_assessment(r.case_id));
$$;

revoke execute on function public.study_eval_requests(uuid[]) from public, anon;
grant execute on function public.study_eval_requests(uuid[]) to authenticated;

-- إقفال القراءة المباشرة: الصفّ الكامل لم يعد يصل عميل الدارس/المقيّم أصلاً
drop policy if exists study_eval_assigned_req on protection_requests;
