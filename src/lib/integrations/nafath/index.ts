import type { NafathAdapter, IntgMode } from "./types";
import { createMockNafath } from "./mock";

export type { NafathAdapter, NafathIdentity, NafathLoginChallenge } from "./types";

/**
 * مصنع مُحوِّل نفاذ — يختار المزوّد بمفتاح إعداد واحد (NAFATH_MODE).
 * الافتراضيّ mock للتطوير؛ عند توفّر الناقل الحكوميّ يُضاف مزوّد live هنا.
 */
export function getNafath(): NafathAdapter {
  const mode = (process.env.NAFATH_MODE as IntgMode) ?? "mock";
  switch (mode) {
    case "live":
      // TODO(M2-live): نفّذ createLiveNafath() مقابل الناقل الحكوميّ الداخليّ.
      throw new Error("مزوّد نفاذ الحيّ غير مُنفَّذ بعد — اضبط NAFATH_MODE=mock.");
    case "mock":
    default:
      return createMockNafath();
  }
}
