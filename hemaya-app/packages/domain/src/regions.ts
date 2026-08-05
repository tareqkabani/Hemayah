import type { RegionCode } from "@hemaya/supabase";

// ============================================================
//  مناطق المملكة الثلاث عشرة — التسميات العربية لنوع region_code
//  في القاعدة (المصدر الواحد — كانت منسوخة في ست بوابات).
// ============================================================

export const REGION_LABEL: Record<RegionCode, string> = {
  RUH: "الرياض",
  MAK: "مكة المكرمة",
  MED: "المدينة المنورة",
  QAS: "القصيم",
  EAS: "المنطقة الشرقية",
  ASR: "عسير",
  TAB: "تبوك",
  HAI: "حائل",
  NOR: "الحدود الشمالية",
  JAZ: "جازان",
  NAJ: "نجران",
  BAH: "الباحة",
  JOF: "الجوف",
};

/** «منطقة فلان» — بلا سابقة لما يبدأ بأداة التعريف (الرياض، المنطقة الشرقية…). */
export function regionDisp(code: string): string {
  const n = (REGION_LABEL as Record<string, string>)[code] || code;
  return n.startsWith("ال") ? n : "منطقة " + n;
}
