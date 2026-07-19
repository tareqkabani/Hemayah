// ============================================================
//  PortalConfig — «القشرة غبية والإعدادات ذكية»
//  القشرة (AppSidebar/AppTopbar/الإشعارات/المراسلات/اللوحة) هيكلٌ مشترك،
//  وكلّ بوابةٍ تُهيَّأ بإعداد دورٍ من هذا الملف — مصدره PORTAL-MATRIX.
//  لا تعمّم سلوك بوابةٍ على أخرى؛ ولا تفرّع بين الأدوار في كود القشرة.
// ============================================================

import type { AppRole } from "@hemaya/supabase";

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
  strings: PortalStrings;
  defaultScreen: PortalScreenId;
  /** ترتيب القائمة الجانبية — «الملف الشخصي» آخرها دائماً */
  screens: PortalScreenId[];
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

/** سجلّ الإعدادات — تُضاف بقية البوابات الست عشرة هنا حرفياً من PORTAL-MATRIX. */
export const PORTAL_CONFIGS: Record<string, PortalConfig> = {
  studier: STUDIER_CONFIG,
  evaluator: EVALUATOR_CONFIG,
};
