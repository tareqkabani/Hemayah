// ============================================================
//  مدة الحماية المقترحة — الصياغة الموحّدة المعتمدة
//  («سجل القوائم المنسدلة» في مشروع التصميم — وُحِّدت في الإدخال
//  اليدوي ثم في توصية الجهات). السجلّات المخزّنة قبل التوحيد قد
//  تحمل المسمّيين القديمين؛ تُعرض كما خُزِّنت ولا تُعاد كتابتها،
//  والعوْنيّتان أدناه تفهمان الصياغتين معاً.
// ============================================================

export const DURATIONS = ["ثلاثون يوماً", "إلى حين انتهاء القضية", "مدة محدّدة"] as const;
export type Duration = (typeof DURATIONS)[number];

/** المسمّيان القديمان قبل التوحيد — لقراءة السجلّات المخزّنة فقط. */
export const LEGACY_DURATION_30 = "30 يوماً";
export const LEGACY_DURATION_OTHER = "مدة أخرى";

/** مدةٌ تتطلّب تحديداً حرّاً (خانة «حدّد المدة») — بالصياغتين. */
export function isCustomDuration(d: string | null | undefined): boolean {
  return d === "مدة محدّدة" || d === LEGACY_DURATION_OTHER;
}

/** الترجمة الرقمية للمدة المقترحة (durationDays في التوصية) — بالصياغتين. */
export function durationDays(d: string | null | undefined): number | null {
  return d === "ثلاثون يوماً" || d === LEGACY_DURATION_30 ? 30 : null;
}
