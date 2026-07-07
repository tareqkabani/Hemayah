// ============================================================
//  الأنواع النطاقية + تسمياتها العربية (تُطابق أنواع القاعدة).
// ============================================================

export const CASE_STATUS = {
  submitted: "مُقدَّم",
  triage: "قيد الفرز",
  referred: "محال لجهة",
  under_study: "قيد الدراسة",
  classified: "مُصنَّف",
  in_decision: "قيد القرار",
  accepted: "مقبول",
  rejected: "مرفوض",
  signed: "مُوقَّعة الاتفاقية",
  active: "حماية فعّالة",
  under_review: "قيد المراجعة",
  terminating: "قيد الإنهاء",
  closed: "محفوظ",
} as const;
export type CaseStatus = keyof typeof CASE_STATUS;

export const CATEGORY = {
  reporter: "مبلّغ",
  witness: "شاهد",
  expert: "خبير",
  victim: "ضحية",
  related: "ذو صلة",
} as const;
export type Category = keyof typeof CATEGORY;

export const RISK_LEVEL = {
  low: "منخفض",
  medium: "متوسط",
  high: "مرتفع",
  critical: "حرِج",
} as const;
export type RiskLevel = keyof typeof RISK_LEVEL;

export const CASE_SOURCE = {
  local: "محليّ",
  foreign: "أجنبيّ (م6)",
  urgent: "عاجل (م8)",
} as const;
export type CaseSource = keyof typeof CASE_SOURCE;

export const APPLICANT_ROLE = ["أصيل", "وليّ", "وصيّ", "وكيل", "محامٍ"] as const;
export type ApplicantRole = (typeof APPLICANT_ROLE)[number];

/** أنواع تدابير الحماية (م14 + بنود اللائحة). */
export const PROTECTION_MEASURES = [
  { ref: "م14/1", label: "الحماية الشخصية والمرافقة" },
  { ref: "م14/2", label: "تأمين المسكن ومقرّ العمل" },
  { ref: "م14/3", label: "إخفاء الهوية وسريّتها" },
  { ref: "م14/4", label: "تغيير مكان الإقامة أو العمل" },
  { ref: "م14/5", label: "رقابة الاتصالات (بموافقة مكتوبة — م9/1)" },
  { ref: "م14/6", label: "الهوية المؤقّتة (م9/3)" },
  { ref: "لائحة/م5", label: "تدابير إضافية باللائحة" },
] as const;
