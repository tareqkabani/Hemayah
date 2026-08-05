// ============================================================
//  مرحلة التظلّمات — المكتب الفني (م10، م21)
//  دالة nextAction واحدة تغذّي الوسوم والعدّادات والبطاقة الأبرز
//  (لا أرقام ثابتة ولا تفرّع في الشاشات)، ومراحل م21 لشريط «المرحلة N من M».
//  أنواع الحماية الـ13 (م14) في enums.ts — القائمة القانونية الواحدة.
// ============================================================

/** مراحل التظلّم النظامية (م21) — لشريط «المرحلة N من 4». */
export const GRIEVANCE_STAGES = [
  "رفع التظلّم وإسناده",
  "دراسة المستشار المستقلّة",
  "اعتماد المكتب — البتّ",
  "إشعار المتقدّم والمركز",
] as const;

/** مهلة البتّ في التظلّم بالأيام (م21) — قرار المكتب نهائي غير قابل للطعن. */
export const GRIEVANCE_SLA_DAYS = 10;

export interface GrievanceRecord {
  advisorDecision?: unknown | null;
  officeDecision?: unknown | null;
  [k: string]: unknown;
}

/** موقع التظلّم في مراحل م21 (صفريّ الأساس — عدد المراحل المُنجزة). */
export function grievanceStageIndex(g: GrievanceRecord): number {
  if (g.officeDecision) return 3;
  if (g.advisorDecision) return 2;
  return 1;
}

/**
 * الإجراء المطلوب — دالة واحدة للدورين:
 * المستشار يقرّر مستقلّاً (ما لم يقرّر)، والمدير يعتمد بعد قرار المستشار،
 * ولا إجراء بعد بتّ المكتب (نهائي — م21).
 */
export function grievanceNextAction(
  g: GrievanceRecord,
  role: "advisor" | "head",
): { t: string; icon: string } | null {
  if (g.officeDecision) return null;
  if (role === "advisor")
    return g.advisorDecision ? null : { t: "دراسة التظلّم وإصدار قرارك المستقلّ", icon: "how_to_reg" };
  return g.advisorDecision ? { t: "مراجعة قرار المستشار واعتماد بتّ المكتب", icon: "verified" } : null;
}
