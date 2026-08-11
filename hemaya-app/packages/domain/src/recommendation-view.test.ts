import { describe, it, expect } from "vitest";
import { normalizeFactors9, buildFactors9 } from "./recommendation-view";

describe("normalizeFactors9 — توحيد لهجتَي factors9", () => {
  it("لهجة الإدخال الورقي (camelCase) تُطبَّع كاملة", () => {
    const f = normalizeFactors9({
      health: "سليم", healthNote: "لا ملاحظات",
      criminal: "لا سوابق", criminalNote: "",
      psych: "مستقر", psychHistory: "لا يوجد", reveal: "لا يمانع",
      crimeType: "ابتزاز", waqia: ["تهديد", "", "تشهير"], crimeDesc: "وصف",
      hidden2: "نعم", threatExists: "يوجد", threatType: "جسدي",
      riskLevel: "مرتفع", harmExists: "يوجد", harmType: "نفسي",
      extends: "نعم", extendsWho: "الأسرة", adapt: "منطبق",
      attachFiles: ["خطاب.pdf"], caseSummary: "ملخص", caseStage: "التحقيق",
      applicantRoleDesc: "شاهد رئيسي", contacted: "نعم", contactKind: "هاتفي",
      reasons: ["سبب أول", "سبب ثانٍ"], alternatives: "لا توجد",
      duration: "ثلاثون يوماً", durationNote: "",
    });
    expect(f).toMatchObject({
      health: "سليم", crimeType: "ابتزاز", hideIdentity: "نعم",
      threatExists: "يوجد", riskLevel: "مرتفع", extendsOthers: "نعم",
      extendsWho: "الأسرة", roleDesc: "شاهد رئيسي", contactKind: "هاتفي",
      alternatives: "لا توجد", duration: "ثلاثون يوماً",
    });
    expect(f?.waqia).toEqual(["تهديد", "تشهير"]);
    expect(f?.attachments).toEqual(["خطاب.pdf"]);
    expect(f?.reasons).toHaveLength(2);
  });

  it("لهجة بوابة الجهة الإلكترونية (snake_case) تُطبَّع إلى المفاتيح ذاتها", () => {
    const f = normalizeFactors9({
      contacted: "نعم", contact_kind: "كتابي", crime_type: "رشوة",
      waqia: ["إفشاء"], hidden_m2: "لا", threat: "يوجد",
      risk_level: "متوسط", harm: "محتمل", harm_type: "وظيفي",
      extends_others: "لا يمتدّ", extends_who: "", adapt: "منطبق",
      psych: "مستقر", psych_history: "لا يوجد",
      attach_files: ["محضر.pdf"],
    });
    expect(f).toMatchObject({
      contactKind: "كتابي", crimeType: "رشوة", hideIdentity: "لا",
      threatExists: "يوجد", riskLevel: "متوسط", harmExists: "محتمل",
      harmType: "وظيفي", extendsOthers: "لا يمتدّ", psychHistory: "لا يوجد",
    });
    expect(f?.attachments).toEqual(["محضر.pdf"]);
    // ما لا يكتبه هذا المسار يعود سلسلة خاوية لا undefined — الشاشات تعتمد ذلك
    expect(f?.health).toBe("");
    expect(f?.caseSummary).toBe("");
  });

  it("حمولة غير كائنية تعيد null (توصيات بلا عوامل)", () => {
    expect(normalizeFactors9(null)).toBeNull();
    expect(normalizeFactors9(undefined)).toBeNull();
    expect(normalizeFactors9("نص")).toBeNull();
    expect(normalizeFactors9([1, 2])).toBeNull();
  });
});

describe("buildFactors9 — الكتابة بعقدٍ واحد", () => {
  it("يبني اللهجة القانونية ويُسقط الخاوي", () => {
    const out = buildFactors9({
      crimeType: "ابتزاز", riskLevel: "مرتفع", threatExists: "يوجد",
      health: "", healthNote: "   ", waqia: ["تهديد", "", null as any],
      attachments: ["خطاب.pdf", ""], reasons: [], contacted: "نعم",
    });
    expect(out).toEqual({
      crimeType: "ابتزاز", waqia: ["تهديد"], threatExists: "يوجد",
      riskLevel: "مرتفع", contacted: "نعم", attachments: ["خطاب.pdf"],
    });
    // الخاوي لا يُخزَّن مفتاحاً
    expect("health" in out).toBe(false);
    expect("reasons" in out).toBe(false);
  });

  it("رحلة ذهابٍ وعودة: ما يُكتب يُقرأ كما هو", () => {
    const input = {
      health: "سليم", criminal: "لا سوابق", psych: "مستقر", psychHistory: "لا يوجد",
      reveal: "لا يمانع", crimeType: "رشوة", waqia: ["إفشاء"], crimeDesc: "وصف",
      hideIdentity: "نعم", threatExists: "يوجد", riskLevel: "حرِج", threatType: "بالقتل",
      harmExists: "يوجد", harmType: "جسدي", extendsOthers: "نعم", extendsWho: "الأسرة",
      adapt: "منطبق", caseSummary: "ملخص", caseStage: "التحقيق", roleDesc: "شاهد رئيسي",
      contacted: "نعم", contactKind: "حضوري", reasons: ["سبب"], alternatives: "لا توجد",
      duration: "ثلاثون يوماً", durationNote: "—", attachments: ["م.pdf"],
    };
    const back = normalizeFactors9(buildFactors9(input));
    for (const [k, v] of Object.entries(input)) {
      expect(back![k as keyof typeof back]).toEqual(v);
    }
  });

  it("الصفوف القديمة (snake_case) ما زالت مقروءةً بعد توحيد الكتابة", () => {
    const legacy = normalizeFactors9({
      crime_type: "رشوة", risk_level: "متوسط", threat: "يوجد",
      extends_others: "لا", psych_history: "لا يوجد", attach_files: ["م.pdf"],
      hidden_m2: "لا", contact_kind: "كتابي", harm: "محتمل",
    });
    expect(legacy).toMatchObject({
      crimeType: "رشوة", riskLevel: "متوسط", threatExists: "يوجد",
      extendsOthers: "لا", psychHistory: "لا يوجد", hideIdentity: "لا",
      contactKind: "كتابي", harmExists: "محتمل",
    });
    expect(legacy?.attachments).toEqual(["م.pdf"]);
  });

  it("مدخلات غير كائنية تعيد حمولةً خاوية لا تنهار", () => {
    expect(buildFactors9(null)).toEqual({});
    expect(buildFactors9(undefined)).toEqual({});
  });
});
