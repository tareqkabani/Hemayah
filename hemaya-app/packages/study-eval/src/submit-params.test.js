// buildSubmitParams — بناء معاملات submit_study/submit_assessment من حالة النموذج
import { describe, it, expect } from "vitest";
import { buildSubmitParams } from "./submit-params";
import { PROTECTION_TYPES, REJECT_REASONS } from "./lookups";

const TASK = { caseId: "case-1", secret: "C-2026-0001" };
const BASE = {
  recExists: "", reqExists: "",
  kama: "", rec: "", partial: "", rej: {}, rejNote: {}, dur: "", durText: "",
  types: {}, subdur: {}, otherText: "",
};

describe("اسم الدالة بحسب الدور", () => {
  it("الدارس → submit_study والمقيّم → submit_assessment", () => {
    expect(buildSubmitParams("studier", TASK, { ...BASE, rec: "قبول كلي" }).fn).toBe("submit_study");
    expect(buildSubmitParams("evaluator", TASK, { ...BASE, rec: "قبول كلي" }).fn).toBe("submit_assessment");
  });
});

describe("رفض الحماية", () => {
  const f = {
    ...BASE,
    rec: "رفض الحماية",
    rej: { r1: true, r3: true, r2: false },
    rejNote: { r3: "لا مؤشرات خطر موثّقة" },
  };
  const { params } = buildSubmitParams("studier", TASK, f);

  it("أسباب الرفض المختارة فقط، بمسمّياتها المرجعية وملاحظاتها", () => {
    expect(params._reject_reasons).toEqual([
      { k: "r1", t: REJECT_REASONS[0].t, note: null },
      { k: "r3", t: REJECT_REASONS[2].t, note: "لا مؤشرات خطر موثّقة" },
    ]);
  });
  it("لا أنواع ولا سبب جزئي مع الرفض", () => {
    expect(params._proposed_type).toBeNull();
    expect(params._partial_reason).toBeNull();
  });
});

describe("القبول (كلي/جزئي) والأنواع والمدة", () => {
  it("أنواع م14 بمسمّياتها + النطاق الزمني للأنواع ذات المدة + بند «أخرى»", () => {
    const f = {
      ...BASE,
      rec: "قبول كلي",
      types: { t0: true, t2: true, other: true },
      subdur: { t2: "مؤقت" },
      otherText: "مراقبة دورية",
    };
    const { params } = buildSubmitParams("studier", TASK, f);
    expect(params._proposed_type).toEqual([
      PROTECTION_TYPES[0].t,
      `${PROTECTION_TYPES[2].t} (مؤقت)`,
      "أخرى: مراقبة دورية",
    ]);
  });

  it("«أخرى» بلا نصّ لا تدخل القائمة", () => {
    const f = { ...BASE, rec: "قبول كلي", types: { other: true }, otherText: "" };
    expect(buildSubmitParams("studier", TASK, f).params._proposed_type).toEqual([]);
  });

  it("«ثلاثون يوماً» → 30 days، و«مدة محدّدة» → مدة null ونصّها في الملاحظات", () => {
    const p1 = buildSubmitParams("studier", TASK, { ...BASE, rec: "قبول كلي", dur: "ثلاثون يوماً" }).params;
    expect(p1._proposed_duration).toBe("30 days");

    const p2 = buildSubmitParams("studier", TASK, {
      ...BASE, rec: "قبول كلي", dur: "مدة محدّدة", durText: "ستة أشهر", kama: "ملاحظة",
    }).params;
    expect(p2._proposed_duration).toBeNull();
    expect(p2._notes).toBe("المدة المقترحة: ستة أشهر — ملاحظة");
  });

  it("«إلى حين انتهاء القضية» تُسجَّل صراحةً في الملاحظات (لا تضيع بصمت)", () => {
    const p = buildSubmitParams("studier", TASK, {
      ...BASE, rec: "قبول كلي", dur: "إلى حين انتهاء القضية", kama: "ملاحظة",
    }).params;
    expect(p._proposed_duration).toBeNull();
    expect(p._notes).toBe("المدة المقترحة: إلى حين انتهاء القضية — ملاحظة");
  });

  it("القبول الجزئي يمرّر سببه", () => {
    const p = buildSubmitParams("studier", TASK, { ...BASE, rec: "قبول جزئي", partial: "يُستثنى تغيير الإقامة" }).params;
    expect(p._partial_reason).toBe("يُستثنى تغيير الإقامة");
  });
});

describe("بندا الاطّلاع (تحديث 2026-07-21)", () => {
  it("يوجد → true · لا يوجد → false · غير محدّد → null", () => {
    const p1 = buildSubmitParams("studier", TASK, { ...BASE, rec: "قبول كلي", recExists: "يوجد", reqExists: "لا يوجد" }).params;
    expect(p1._found_recommendation).toBe(true);
    expect(p1._found_request).toBe(false);

    const p2 = buildSubmitParams("studier", TASK, { ...BASE, rec: "قبول كلي" }).params;
    expect(p2._found_recommendation).toBeNull();
    expect(p2._found_request).toBeNull();
  });
});

describe("الثوابت العامة", () => {
  it("يمرّر معرّف الحالة والرأي، والملاحظات الفارغة null", () => {
    const p = buildSubmitParams("studier", TASK, { ...BASE, rec: "قبول كلي" }).params;
    expect(p._case_id).toBe("case-1");
    expect(p._recommendation).toBe("قبول كلي");
    expect(p._notes).toBeNull();
  });
});
