// تطبيع تفاصيل طلب الحماية — يحمي حزمة الاطّلاع من انهيار «كائن كطفل React»
import { describe, it, expect } from "vitest";
import { normalizeReqDetails } from "./req-details";

describe("normalizeReqDetails", () => {
  it("الفراغ/null يرجعان نصاً فارغاً", () => {
    expect(normalizeReqDetails(null)).toBe("");
    expect(normalizeReqDetails(undefined)).toBe("");
    expect(normalizeReqDetails("")).toBe("");
  });

  it("النص القديم يمرّ كما هو", () => {
    expect(normalizeReqDetails("تفاصيل حرّة قديمة.")).toBe("تفاصيل حرّة قديمة.");
  });

  it("كائن نموذج الطالب يُطبَّع: المسوّغات ثم الجريمة فالجهة فالقضية", () => {
    const out = normalizeReqDetails({
      reason: "تلقيّت تهديدات مباشرة.",
      crime: "التستّر على جريمة اتّجار",
      entity: "النيابة العامة بالرياض",
      case_no: "9001/2026",
      files: ["مرفق"],
    });
    expect(out).toBe(
      "تلقيّت تهديدات مباشرة. — الجريمة: التستّر على جريمة اتّجار — الجهة المختصة: النيابة العامة بالرياض — القضية: 9001/2026"
    );
  });

  it("الحقول الغائبة تسقط بلا فواصل يتيمة", () => {
    expect(normalizeReqDetails({ crime: "رشوة" })).toBe("الجريمة: رشوة");
    expect(normalizeReqDetails({ waqia: "غير معروف للمطبّع" })).toBe("");
  });
});
