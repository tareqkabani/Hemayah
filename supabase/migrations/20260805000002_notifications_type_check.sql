-- ============================================================
--  قيد CHECK على notifications.type — كان نصّاً حرّاً بتعليقٍ فقط
--  (decision | terminate | reminder) في هجرة الأساس، بينما نمت القيم
--  الفعليّة إلى ثمانٍ وعشرين قيمةً عبر الدوالّ والمشغّلات والبذور.
--
--  القائمة مستقرأةٌ من كلّ «insert into notifications» في الهجرات
--  والبذور (كود الواجهات يقرأ ويُحدّث read فقط — لا يُدرج).
--  «terminate» و«reminder» الموثّقتان في تعليق الأساس لم تُستعملا
--  قطّ، فلم تُدرَجا — إضافة قيمةٍ جديدة تكون بهجرةٍ تعدّل القيد.
--
--  العمود يبقى قابلاً لـNULL كما في الأساس (القيد يمرّر NULL بطبيعته).
--  الهجرة تُعاد بلا ضرر، وتفحص البيانات القائمة أوّلاً برسالةٍ واضحة —
--  درس «قاعدة Docker المتأخّرة»: قاعدةٌ منحرفةٌ قد تحمل قيماً قديمة.
-- ============================================================

do $$
declare
  _bad text;
begin
  select string_agg(distinct type, '، ') into _bad
  from notifications
  where type is not null and type not in (
    -- رحلة الطلب الأساسية
    'submission', 'triage', 'decision', 'agreement', 'lifecycle', 'identity_verified',
    -- الدراسة والتقييم والمكتب الفني (الإسناد والمخرجات والمُهل)
    'assign', 'output', 'deadline', 'msg', 'incoming', 'return', 'status',
    -- الإحالات وتوصيات الجهات المختصة
    'referral', 'referral_in', 'rec_in', 'rec_received',
    -- الطلبات الأجنبية (الداخلية والنائب العام)
    'foreign_in', 'foreign_ok', 'foreign_no', 'foreign_pg',
    -- دورة التظلّم
    'grievance_in', 'grievance_office', 'grievance_upheld', 'grievance_dismissed',
    -- المسار العاجل
    'urgent_in', 'urgent_approved', 'urgent_rejected');
  if _bad is not null then
    raise exception 'قيمٌ في notifications.type خارج القائمة المحصورة: % — '
      'نظّف هذه الصفوف (أو أضف القيمة للقيد إن كانت مشروعة) قبل التطبيق.', _bad;
  end if;
end $$;

alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check check (type in (
  'submission', 'triage', 'decision', 'agreement', 'lifecycle', 'identity_verified',
  'assign', 'output', 'deadline', 'msg', 'incoming', 'return', 'status',
  'referral', 'referral_in', 'rec_in', 'rec_received',
  'foreign_in', 'foreign_ok', 'foreign_no', 'foreign_pg',
  'grievance_in', 'grievance_office', 'grievance_upheld', 'grievance_dismissed',
  'urgent_in', 'urgent_approved', 'urgent_rejected'));

comment on column notifications.type is
  'فئة الإشعار — محصورةٌ بقيد notifications_type_check؛ القيمة الجديدة تُضاف بهجرةٍ تعدّل القيد.';
