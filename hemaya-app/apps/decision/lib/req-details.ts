// تطبيع تفاصيل طلب الحماية للعرض النصّي في حزمة الاطّلاع —
// details قد تكون نصاً (النمط القديم) أو كائنَ نموذج الطالب (jsonb):
// يُقدَّم نصّ المسوّغات (reason) ثم الجريمة/الجهة/القضية إن وُجدت.
export function normalizeReqDetails(d: unknown): string {
  if (!d) return "";
  if (typeof d === "string") return d;
  const o = d as Record<string, unknown>;
  return [
    o.reason,
    o.crime && `الجريمة: ${o.crime}`,
    o.entity && `الجهة المختصة: ${o.entity}`,
    o.case_no && `القضية: ${o.case_no}`,
  ]
    .filter(Boolean)
    .join(" — ");
}
