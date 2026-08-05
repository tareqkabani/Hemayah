// ============================================================
//  مناطق المملكة الـ13 — التسميات العربية لرموز region_code القاعدية.
// ============================================================
import type { Enums } from "@hemaya/supabase";

/** التسمية العربية لكل رمز منطقة — يحرسها label-coverage ضد درِفت القاعدة. */
export const REGIONS: Record<Enums<"region_code">, string> = {
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
} as const;

/** «منطقة نجران» لكن «المنطقة الشرقية» تكتفي بنفسها — المعرَّف بـ«ال» لا يسبقه «منطقة». */
export const regionDisp = (code: string): string => {
  const n = REGIONS[code as Enums<"region_code">] ?? code;
  return n.startsWith("ال") ? n : "منطقة " + n;
};
