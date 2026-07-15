// ============================================================
//  مصفوفة المدد النظامية (SLA) — مصدرٌ واحد.
//  تُنفَّذ كحقول تواريخ + مؤقّتات server-side مع تذكير وتصعيد.
//  «أيام العمل» ≠ الأيام التقويمية — طبّق تقويم عطل الجهة.
// ============================================================

export interface SlaRule {
  id: string;
  stage: string;
  days: number;
  businessDays: boolean;
  article: string;
  note: string;
}

export const SLA: SlaRule[] = [
  { id: "recommendation", stage: "رفع توصية الجهة المختصة", days: 5, businessDays: true, article: "م9 / م5/3",
    note: "عند التجاوز: تذكير + تصعيد للقيادة، لا حفظ تلقائيّ." },
  { id: "study_intake", stage: "استقبال مخرَج الدراسة/التقييم", days: 1, businessDays: true, article: "م10",
    note: "نافذة استقبالٍ ضمن سقف 3 أيام." },
  { id: "decision_notice", stage: "الإشعار بالقرار", days: 3, businessDays: false, article: "م10",
    note: "إشعار المستفيد والجهة فور الإصدار." },
  { id: "grievance", stage: "بتّ التظلّم", days: 10, businessDays: false, article: "م21",
    note: "يبدأ من تاريخ الإشعار بالقرار؛ يبتّه المكتب الفني." },
  { id: "urgent_measure", stage: "التدبير العاجل قبل عرضه على المجلس", days: 30, businessDays: false, article: "م8",
    note: "مؤقّت عرض العاجل على المجلس." },
  { id: "foreign_decision", stage: "البتّ في الطلب الأجنبيّ", days: 3, businessDays: false, article: "م6",
    note: "بعد التصويت — يبتّ النائب العام نهائياً." },
  { id: "termination_notice", stage: "إخطار الإنهاء المسبق", days: 15, businessDays: false, article: "م21",
    note: "قبل الإنهاء بمدّة." },
  { id: "renewal", stage: "دورة التجديد/المتابعة", days: 30, businessDays: false, article: "—",
    note: "تُراجَع كل 30 يوماً." },
  { id: "periodic_review", stage: "التقرير الدوري", days: 90, businessDays: false, article: "م4/9/ت",
    note: "ربع سنويّ — يُعِدّه رئيس المركز ويُرفع للنائب العام." },
];

export function slaById(id: string): SlaRule | undefined {
  return SLA.find((s) => s.id === id);
}

/** يحسب تاريخ الاستحقاق (تقويميّاً — استبدله بحساب أيام عملٍ للإنتاج). */
export function dueDate(from: Date, rule: SlaRule): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + rule.days);
  return d;
}

// ─────────────── أيام العمل: الأحد–الخميس (الجمعة والسبت عطلة) ───────────────

const WEEKEND = new Set([5, 6]); // getDay(): 5 = الجمعة، 6 = السبت

export function isBusinessDay(d: Date): boolean {
  return !WEEKEND.has(d.getDay());
}

/** يضيف أيام عملٍ على تاريخ — يتجاوز الجمعة والسبت. */
export function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (isBusinessDay(d)) left -= 1;
  }
  return d;
}

/** عدد أيام العمل المنقضية بين تاريخين (يتجاهل الجمعة والسبت). */
export function businessDaysBetween(from: Date, to: Date): number {
  if (to <= from) return 0;
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  let n = 0;
  while (d < end) {
    d.setDate(d.getDate() + 1);
    if (isBusinessDay(d)) n += 1;
  }
  return n;
}

/** تاريخ الاستحقاق مع مراعاة businessDays في القاعدة. */
export function dueDateFor(from: Date, rule: SlaRule): Date {
  return rule.businessDays ? addBusinessDays(from, rule.days) : dueDate(from, rule);
}
