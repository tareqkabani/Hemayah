// بنود الفحص الشكليّ في الفرز المبدئي — المصدر الواحد: تعرضها بوابة الفرز
// للتقرير، وتقرؤها بوابتا الدارس والمقيّم لعرض نتيجة الفحص في الملف الكامل
// الوارد من الفرز (تُخزَّن الإجابات بمفاتيح البنود في triage_reviews.formal_check).
export interface TriageCheckItem {
  id: string;
  label: string;
  ref: string;
}

export const TRIAGE_CHECK_ITEMS: TriageCheckItem[] = [
  { id: "complete", label: "اكتمال بيانات الطلب ومستنداته", ref: "م7/1، م5/1" },
  { id: "juris", label: "وقوع الطلب ضمن اختصاص المركز وصفة مشمولة", ref: "المادة 1" },
  { id: "case", label: "وجود قضية/بلاغ قائم أو صفة موجِبة للحماية", ref: "م1، م5" },
  { id: "noprior", label: "لا يوجد طلب سابق أو قرار سابق بشأن الشخص", ref: "إجرائي" },
  { id: "verified", label: "تم التحقق من الطالب عبر محضر اتصال موثّق", ref: "م7" },
];
