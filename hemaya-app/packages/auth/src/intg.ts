import type { IntgMode } from "./adapters/types";

/** حالة الربط لكل مصدرٍ وطنيّ (تحسين تدريجيّ live↔manual). */
export interface IntgCtx { nafath: IntgMode; spl: IntgMode; hrdf: IntgMode; }

export interface FieldSourceState {
  mode: IntgMode;
  locked: boolean;   // live → مقفل (مجلوب)
  badge: string;     // نصّ الشارة
}

/** يحوّل وضع المصدر إلى حالة عرض الحقل. */
export function fieldSource(source: string, mode: IntgMode): FieldSourceState {
  return mode === "live"
    ? { mode, locked: true, badge: `مجلوب من ${source}` }
    : { mode, locked: false, badge: `ربط ${source} قيد التفعيل — إدخال يدوي` };
}
