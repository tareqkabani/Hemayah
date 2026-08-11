import { describe, it, expect } from "vitest";
import { normalizeFactors9 } from "./recommendation-view";

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
