// ثوابت النموذج — مطابقة «سجل القوائم المنسدلة» المرجعي (القيم المعتمدة)
import { describe, it, expect } from "vitest";
import { PROTECTION_TYPES, REJECT_REASONS, DURATIONS } from "./lookups";

describe("أنواع الحماية — المادة 14", () => {
  it("ثلاثة عشر نوعاً بلا بند «أخرى» (له خانة مستقلة في النموذج)", () => {
    expect(PROTECTION_TYPES).toHaveLength(13);
    expect(PROTECTION_TYPES.some((p) => p.t.includes("أخرى"))).toBe(false);
  });

  it("النقل من مكان العمل وتغيير محل الإقامة وحدهما يتطلبان نطاقاً زمنياً", () => {
    const withDur = PROTECTION_TYPES.filter((p) => p.dur).map((p) => p.t);
    expect(withDur).toEqual(["النقل من مكان العمل", "تغيير محل الإقامة"]);
  });

  it("الأنواع الجوهرية حاضرة بصياغتها المرجعية", () => {
    const ts = PROTECTION_TYPES.map((p) => p.t);
    expect(ts).toContain("الحماية الأمنية");
    expect(ts).toContain("إخفاء البيانات الشخصية وما يدل على الهوية");
    expect(ts).toContain("الإدلاء بالأقوال عبر وسائط إلكترونية (تغيير الصوت وإخفاء الوجه)");
  });
});

describe("أسباب رفض الحماية", () => {
  it("خمسة أسباب بمفاتيح r1..r5", () => {
    expect(REJECT_REASONS.map((r) => r.k)).toEqual(["r1", "r2", "r3", "r4", "r5"]);
  });

  it("الأسباب r3 وr4 وr5 وحدها تتطلب إيضاحاً", () => {
    expect(REJECT_REASONS.filter((r) => r.note).map((r) => r.k)).toEqual(["r3", "r4", "r5"]);
  });
});

describe("مدد الحماية", () => {
  it("الخيارات الثلاثة المعتمدة بترتيبها", () => {
    expect(DURATIONS).toEqual(["ثلاثون يوماً", "إلى حين انتهاء القضية", "مدة محدّدة"]);
  });
});
