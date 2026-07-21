// ============================================================
//  PortalConfig — «القشرة غبية والإعدادات ذكية»
//  القشرة (AppSidebar/AppTopbar/الإشعارات/المراسلات/اللوحة) هيكلٌ مشترك،
//  وكلّ بوابةٍ تُهيَّأ بإعداد دورٍ من هذا الملف — مصدره PORTAL-MATRIX.
//  لا تعمّم سلوك بوابةٍ على أخرى؛ ولا تفرّع بين الأدوار في كود القشرة.
// ============================================================

import type { AppRole } from "@hemaya/supabase";
import { grievanceNextAction } from "./grievance";

/** دورة الحياة النظامية الست — شريط «المرحلة N من M» في اللوحات. */
export const STAGE_FLOW = [
  "استلام الطلب",
  "الفرز المبدئي",
  "الإحالة للجهة",
  "الدراسة والتقييم",
  "قرار المركز",
  "تفعيل الحماية",
] as const;

export type PortalScreenId =
  | "dashboard"
  | "tasks"
  | "queue"
  | "messages"
  | "notifications"
  | "profile";

export interface NotifCategory {
  id: string;
  label: string;
}

/** سياسة المراسلة — من يبدأ ومع من وبأي عزل. */
export interface MessagingPolicy {
  /** initiator: الموظف يبدأ · reply-only: الرد فقط (طالب الحماية حصراً) · read-only: اطّلاع · none */
  mode: "initiator" | "reply-only" | "read-only" | "none";
  /** الأطراف المسموح مراسلتها */
  parties: { id: string; label: string }[];
  /** خيط معزول لكل طلب */
  perCaseThread: boolean;
  /** بدء المراسلة على الطلبات النشطة فقط (المكتمل لا يُفتح له خيط) */
  activeCasesOnly: boolean;
  /** إيصال التسليم المُذيَّل على رسائل المرسِل */
  deliveryReceipt: string;
  /** وسم الهوية في رأس الخيط */
  identityTag: string;
}

export interface OutputSla {
  /** معرّف القاعدة في مصفوفة SLA (sla.ts) */
  slaId: string;
  /** مهلة المخرَج بأيام العمل (الأحد–الخميس) */
  totalBusinessDays: number;
  /** المظلّة النظامية بالأيام */
  umbrellaDays: number;
  article: string;
  label: string;
}

export interface NextActionRecord {
  status: string;
  [k: string]: unknown;
}

export interface NextAction {
  t: string;
  icon: string;
}

/** نصوص العرض البارامترية — الفرق كلّه من الإعداد لا من الكود. */
export interface PortalStrings {
  /** المخرَج: «الدراسة» / «التقييم» */
  output: string;
  kind: string;
  short: string;
  brandSub: string;
  formTitle: string;
  formIcon: string;
  recLabel: string;
  signer: string;
  peers: string;
  peerOne: string;
}

export interface PortalConfig {
  /** معرّف البوابة = مسار الـzone (studier · evaluator …) */
  portal: string;
  roles: AppRole[];
  label: string;
  /** كل بوابةٍ تزوّد ما تستهلكه شاشاتها فقط */
  strings: Partial<PortalStrings>;
  defaultScreen: PortalScreenId;
  /** ترتيب القائمة الجانبية — «الملف الشخصي» آخرها دائماً */
  screens: PortalScreenId[];
  /** تسميات/أيقونات شاشاتٍ تخصّ البوابة — تطغى على افتراضيات القشرة */
  screenMeta?: Partial<Record<PortalScreenId, { t: string; icon: string }>>;
  /** زر الطوارئ — للطالب/الجهات/التنفيذ/الأمنية فقط */
  emergencyButton: boolean;
  /** كشف الهوية: رمز سري / اسم حقيقي / لا PII إطلاقاً (الأدمن) */
  identityMode: "secret-code" | "real-name" | "no-pii";
  /** مدة الكشف المؤقت للرمز السري قبل الإخفاء الآلي (ثوانٍ) — كل كشفٍ حدثُ تدقيق */
  identityRevealSeconds: number;
  messaging: MessagingPolicy;
  sla: { output: OutputSla };
  notifCategories: NotifCategory[];
  /** نطاق العزل: المُسنَد إليه فقط / قائمة مشتركة / منطقة / جهة+فرع / حالاته */
  isolationScope: "assigned" | "shared-queue" | "region" | "entity-branch" | "own-cases";
  /** موقع البوابة في دورة الحياة الست */
  stage: { index: number; total: number };
  /** الإجراء المطلوب — يُشتق من حالة السجل في مرحلة البوابة حصراً */
  nextAction(record: NextActionRecord): NextAction | null;
}

// ─────────────── الدارس · المقيّم (PORTAL-MATRIX §4/§5) ───────────────
// معزولان تماماً: كلٌّ يرى المُسنَد إليه فقط، ولا اطّلاع بين الأقران على
// الطلب الواحد. التوزيع آليّ بالعبء فقط. لا مراسلة مع طالب الحماية.

const STUDY_EVAL_SHARED = {
  defaultScreen: "dashboard" as const,
  screens: ["dashboard", "tasks", "messages", "notifications", "profile"] as PortalScreenId[],
  // التسمية المعتمدة (تحديث 2026-07-21): «الطلبات الواردة» لا «المهام المُسندة»
  screenMeta: { tasks: { t: "الطلبات الواردة", icon: "assignment_ind" } },
  emergencyButton: false, // لا يستقبلان بلاغات خطر
  identityMode: "secret-code" as const,
  identityRevealSeconds: 6,
  messaging: {
    mode: "initiator" as const,
    parties: [
      { id: "deputy", label: "نائب رئيس المركز" },
      { id: "chair", label: "رئيس المركز" },
    ],
    perCaseThread: true,
    activeCasesOnly: true,
    deliveryReceipt: "سُلّمت — مسجّلة في التدقيق",
    identityTag: "بالهوية الوظيفية",
  },
  notifCategories: [
    { id: "assign", label: "الإسناد" },
    { id: "deadline", label: "المهل" },
    { id: "output", label: "المخرجات" },
    { id: "msg", label: "الرسائل" },
  ],
  isolationScope: "assigned" as const,
  stage: { index: 4, total: STAGE_FLOW.length },
};

function studyEvalNextAction(output: string, icon: string) {
  return (r: NextActionRecord): NextAction | null => {
    if (r.status !== "new") return null;
    return {
      t: `إعداد ${output} واعتماده وإرساله — يوم عمل ضمن مظلّة 3 أيام (م10)`,
      icon,
    };
  };
}

export const STUDIER_CONFIG: PortalConfig = {
  ...STUDY_EVAL_SHARED,
  portal: "studier",
  roles: ["studier"],
  label: "الدارس",
  strings: {
    output: "الدراسة",
    kind: "دراسة",
    short: "دارس",
    brandSub: "الدراسة",
    formTitle: "الدراسة والرأي",
    formIcon: "rate_review",
    recLabel: "توصية الدارس",
    signer: "مُعِدّ الدراسة",
    peers: "الدارسين",
    peerOne: "دارس",
  },
  sla: {
    output: {
      slaId: "study_intake",
      totalBusinessDays: 1,
      umbrellaDays: 3,
      article: "م10",
      label: "استقبال مخرَج الدراسة",
    },
  },
  nextAction: studyEvalNextAction("الدراسة", "rate_review"),
};

export const EVALUATOR_CONFIG: PortalConfig = {
  ...STUDY_EVAL_SHARED,
  portal: "evaluator",
  roles: ["evaluator"],
  label: "المقيّم",
  strings: {
    output: "التقييم",
    kind: "تقييم",
    short: "مقيّم",
    brandSub: "التقييم",
    formTitle: "التقييم والرأي",
    formIcon: "psychology",
    recLabel: "توصية المقيّم",
    signer: "مُعِدّ التقييم",
    peers: "المقيّمين",
    peerOne: "مقيّم",
  },
  sla: {
    output: {
      slaId: "study_intake",
      totalBusinessDays: 1,
      umbrellaDays: 3,
      article: "م10",
      label: "استقبال مخرَج التقييم",
    },
  },
  nextAction: studyEvalNextAction("التقييم", "psychology"),
};

// ─────────────── الفرز المبدئي (PORTAL-MATRIX §2) ───────────────
// قائمة واردة مشتركة: كل موظف فرزٍ يعالج أي طلبٍ وارد، وكل معالجةٍ
// مُسجَّلة بالتدقيق باسمه. القيادة (نائب/رئيس) اطّلاعٌ وإشراف viewOnly.
// العاجل/الطارئ لا يدخل الفرز (م8) — فلا زرّ طوارئ هنا.

const TRIAGE_SHARED = {
  defaultScreen: "dashboard" as const,
  screens: ["dashboard", "queue", "messages", "notifications", "profile"] as PortalScreenId[],
  emergencyButton: false, // موظف الفرز لا يستقبل بلاغات خطر مباشرة (م8)
  identityMode: "secret-code" as const,
  identityRevealSeconds: 6,
  isolationScope: "shared-queue" as const,
  stage: { index: 2, total: STAGE_FLOW.length },
  sla: {
    output: {
      slaId: "recommendation",
      totalBusinessDays: 5,
      umbrellaDays: 5,
      article: "م5/4",
      label: "توصية الجهة المختصة",
    },
  },
};

/** حقول مهلة الجهة على سجلّ الفرز (تُشتق من referral الفعلي). */
function triageSlaOf(r: NextActionRecord): { totalDays: number; daysElapsed: number } | null {
  const sla = r.sla as { totalDays?: number; daysElapsed?: number } | undefined;
  if (!sla || typeof sla.totalDays !== "number" || typeof sla.daysElapsed !== "number") return null;
  return { totalDays: sla.totalDays, daysElapsed: sla.daysElapsed };
}

export const TRIAGE_CONFIG: PortalConfig = {
  ...TRIAGE_SHARED,
  portal: "triage",
  roles: ["case_officer"],
  label: "موظف الفرز",
  strings: { brandSub: "بوابة الفرز المبدئي — موظفو المركز" },
  screenMeta: { queue: { t: "الطلبات الواردة", icon: "inbox" } },
  messaging: {
    mode: "initiator", // الموظفون يبدأون — قاعدة «الرد فقط» خاصة ببوابة طالب الحماية
    parties: [
      { id: "seeker", label: "طالب الحماية (بالرمز السري)" },
      { id: "entity", label: "الجهة المختصة (ضابط الاتصال المعتمد)" },
    ],
    perCaseThread: true,
    activeCasesOnly: true,
    deliveryReceipt: "سُلّمت — مسجّلة في التدقيق",
    identityTag: "بالرمز السري",
  },
  notifCategories: [
    { id: "incoming", label: "الوارد" },
    { id: "reco", label: "التوصيات والإحالات" },
    { id: "deadline", label: "المهل" },
    { id: "msg", label: "الرسائل" },
  ],
  // أولوية الفرز: توصية واردة ← وارد جديد؛ «بانتظار الجهة» ليس إجراءً على الموظف
  nextAction(r: NextActionRecord): NextAction | null {
    if (r.status === "replied") return { t: "وردت توصية الجهة — اتخاذ قرار الفرز (م10)", icon: "gavel" };
    if (r.status === "triage")
      return {
        t: r.paper
          ? "ورود ورقيّ (هوية غير موثّقة) — محضر اتصال ثم الفحص الشكلي (م7)"
          : "محضر اتصال موثّق ثم الفحص الشكلي فقرار الفرز (م7)",
        icon: "fact_check",
      };
    return null;
  },
};

export const TRIAGE_LEAD_CONFIG: PortalConfig = {
  ...TRIAGE_SHARED,
  portal: "triage",
  roles: ["deputy_chair", "board_chair"],
  label: "قيادة المركز",
  strings: { brandSub: "الفرز المبدئي — إشراف القيادة" },
  screenMeta: { queue: { t: "سجلّ الفرز", icon: "inbox" } },
  messaging: {
    mode: "read-only", // القيادة لا تراسل نيابةً عن الموظف
    parties: [
      { id: "seeker", label: "طالب الحماية (بالرمز السري)" },
      { id: "entity", label: "الجهة المختصة (ضابط الاتصال المعتمد)" },
    ],
    perCaseThread: true,
    activeCasesOnly: true,
    deliveryReceipt: "سُلّمت — مسجّلة في التدقيق",
    identityTag: "بالرمز السري",
  },
  notifCategories: [
    { id: "incoming", label: "الوارد" },
    { id: "decision", label: "قرارات الفرز" },
    { id: "deadline", label: "المهل" },
  ],
  // إشرافٌ لا معالجة: لا إجراء إلا تصعيد تجاوز مهلة الجهة
  nextAction(r: NextActionRecord): NextAction | null {
    const sla = triageSlaOf(r);
    if (r.status === "pending" && sla && sla.daysElapsed >= sla.totalDays)
      return { t: "تجاوزت الجهة مهلة التوصية — راجع التصعيد وقرِّر إعادة الإسناد أو الاستمرار", icon: "priority_high" };
    return null;
  },
};

// ─────────────── المكتب الفني — التظلّمات (م10، م21) ───────────────
// دوران على قشرةٍ واحدة: المستشار (قرار مستقلّ في المُسنَد إليه حصراً —
// عزل متبادل، توزيع آليّ بالعبء) والمدير (يرى الكلّ ويعتمد البتّ أو يعيده —
// لا يقرّر ابتداءً ولا يعدّل قرار المستشار). قرار المكتب نهائي (م21).

const TECH_OFFICE_SHARED = {
  portal: "technical",
  defaultScreen: "dashboard" as const,
  emergencyButton: false, // المكتب الفني لا يستقبل بلاغات خطر
  identityMode: "secret-code" as const,
  identityRevealSeconds: 6,
  stage: { index: 5, total: STAGE_FLOW.length },
  sla: {
    output: {
      slaId: "grievance_decision",
      totalBusinessDays: 10,
      umbrellaDays: 10,
      article: "م21",
      label: "البتّ في التظلّم",
    },
  },
};

export const TECH_ADVISOR_CONFIG: PortalConfig = {
  ...TECH_OFFICE_SHARED,
  roles: ["advisor"],
  label: "مستشار المكتب الفني",
  strings: { brandSub: "بوابة المستشارين — المكتب الفني" },
  screens: ["dashboard", "queue", "messages", "notifications", "profile"],
  screenMeta: { queue: { t: "التظلّمات", icon: "gavel" } },
  messaging: {
    mode: "initiator", // الموظفون يبدأون — «الرد فقط» خاصة ببوابة طالب الحماية
    parties: [
      { id: "head", label: "مدير المكتب الفني" },
      { id: "center", label: "مركز الحماية — منسّق التظلّمات" },
      { id: "seeker", label: "المتظلّم (بالرمز السري)" },
    ],
    perCaseThread: true,
    activeCasesOnly: true,
    deliveryReceipt: "سُلّمت — مسجّلة في التدقيق",
    identityTag: "الهوية بالرمز السري",
  },
  notifCategories: [
    { id: "assign", label: "الإسناد" },
    { id: "deadline", label: "المهل" },
    { id: "msg", label: "الرسائل" },
    { id: "status", label: "الحالة" },
  ],
  isolationScope: "assigned",
  nextAction: (r) => grievanceNextAction(r, "advisor"),
};

export const TECH_HEAD_CONFIG: PortalConfig = {
  ...TECH_OFFICE_SHARED,
  roles: ["tech_manager"],
  label: "مدير المكتب الفني",
  strings: { brandSub: "مدير المكتب الفني" },
  screens: ["dashboard", "queue", "tasks", "messages", "notifications", "profile"],
  screenMeta: {
    queue: { t: "التظلّمات", icon: "gavel" },
    tasks: { t: "المستشارون", icon: "groups" },
  },
  messaging: {
    mode: "initiator",
    parties: [
      { id: "advisor", label: "المستشار المُسنَد" },
      { id: "center", label: "مركز الحماية — منسّق التظلّمات" },
      { id: "ag", label: "مكتب النائب العام (إحاطة)" },
    ],
    perCaseThread: true,
    activeCasesOnly: true,
    deliveryReceipt: "سُلّمت — مسجّلة في التدقيق",
    identityTag: "الهوية بالرمز السري",
  },
  notifCategories: [
    { id: "decision", label: "قرارات المستشارين" },
    { id: "incoming", label: "الوارد" },
    { id: "deadline", label: "المهل" },
    { id: "msg", label: "الرسائل" },
  ],
  isolationScope: "shared-queue",
  nextAction: (r) => grievanceNextAction(r, "head"),
};

/** سجلّ الإعدادات — تُضاف بقية البوابات الست عشرة هنا حرفياً من PORTAL-MATRIX. */
export const PORTAL_CONFIGS: Record<string, PortalConfig> = {
  studier: STUDIER_CONFIG,
  evaluator: EVALUATOR_CONFIG,
  triage: TRIAGE_CONFIG,
  "triage-lead": TRIAGE_LEAD_CONFIG,
  "tech-advisor": TECH_ADVISOR_CONFIG,
  "tech-head": TECH_HEAD_CONFIG,
};
