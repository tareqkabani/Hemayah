import type { CaseStatus } from "./enums";

// ============================================================
//  آلة حالة القضية — تُفرَض server-side (لا تُشتقّ في العميل فقط).
//  المسار الأساسيّ + تفرّعات القرار (قبول/رفض) والمراجعة والإنهاء.
// ============================================================

export const CASE_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  submitted: ["triage"],
  triage: ["referred", "under_study", "closed"],       // إحالة لجهة · قبول للدراسة · حفظ
  referred: ["under_study", "closed"],
  under_study: ["classified"],
  classified: ["in_decision"],
  in_decision: ["accepted", "rejected"],
  accepted: ["signed"],
  rejected: ["closed"],                                 // مع حقّ التظلّم (م21) بمسارٍ موازٍ
  signed: ["active"],
  active: ["under_review", "terminating"],
  under_review: ["active", "terminating"],
  terminating: ["closed"],
  closed: [],
};

export function canTransition(from: CaseStatus, to: CaseStatus): boolean {
  return CASE_TRANSITIONS[from]?.includes(to) ?? false;
}

/** المسارات الخاصّة المتوازية مع المسار الأساسيّ. */
export const SPECIAL_TRACKS = {
  urgent: "العاجل (م8) — يُرفع من الجهة للنائب العام، تدبيرٌ فوريّ ثم عرضٌ على المجلس خلال 30 يوماً.",
  foreign: "الأجنبيّ (م6) — لجنة الداخلية ترفع، يُدرَس ويُصوَّت، ثم يبتّ النائب العام نهائياً.",
  grievance: "التظلّم (م21) — خلال 10 أيام من الإشعار بالرفض، يبتّه المكتب الفني نيابةً عن النائب العام.",
} as const;
