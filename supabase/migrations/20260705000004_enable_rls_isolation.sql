-- ============================================================
--  إصلاح أمنيّ حرِج — تفعيل RLS على الجداول التي كانت مُعطّلةً فيه
--  خلل: notifications و protection_requests لهما سياسات عزل لكن RLS مُعطّل
--  ⇒ السياسات خامدة ⇒ كل مستخدمٍ موثَّق (بما فيهم طالب حماية) يرى صفوف الجميع.
--  الأثر: طالب حماية كان يرى إشعارات غيره. الإصلاح: تفعيل RLS ⇒ العزل بـsubmitted_by.
--  والجداول الأخرى المُعطّلة (0 سياسات) تُصبح deny-all للعملاء (وصولها عبر RPCs SECURITY DEFINER فقط).
-- ============================================================

-- الجداول المواجِهة لطالب الحماية (لها سياسات عزل submitted_by → تُفعَّل الآن)
alter table public.notifications        enable row level security;  -- seeker_notif_read/mark
alter table public.protection_requests  enable row level security;  -- seeker_req_read + سياسات الموظّفين

-- جداول حسّاسة يُوصَل إليها عبر RPCs مؤمّنة فقط (تفعيل RLS = منعٌ افتراضيّ للعملاء المباشرين)
alter table public.protection_documents  enable row level security;  -- وثائق موقّعة/عناوين
alter table public.measures              enable row level security;  -- تدابير الحماية م14
alter table public.obligations           enable row level security;
alter table public.periodic_reviews      enable row level security;
alter table public.execution_handoffs    enable row level security;
alter table public.imminent_protections  enable row level security;  -- التدبير العاجل م8
alter table public.related_persons       enable row level security;
alter table public.emergency_reports     enable row level security;  -- بلاغات طارئة
alter table public.consultation_sessions enable row level security;
alter table public.challenges            enable row level security;  -- محرّر التحديات (RPC/داخليّ فقط)
