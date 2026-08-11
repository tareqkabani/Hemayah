// آلة حالة القرار السباعية — يفتتحها طور التجميع (المخرجات ترد تباعاً فيطّلع
// عليها المعدّ)، ثم قاعدة صاحب المنصة: النائب ثم الرئيس قبل الطرح،
// والتصويت بسبعة مقاعد تشملهما، والإصدار الختامي بيد الرئيس.
import { describe, it, expect } from "vitest";
import {
  DECISION_STATUS,
  DECISION_TRANSITIONS,
  DECISION_STAGES,
  DECISION_VOTING_SEATS,
  DECISION_MAJORITY,
  canDecisionTransition,
  decisionStageOf,
  nextDecisionAction,
} from "./decision-state";

describe("سلسلة الاعتماد الملزمة", () => {
  it("الدورة سباعية: تجميع ← إعداد ← النائب ← الرئيس ← الطرح ← التصويت ← الإصدار", () => {
    expect(Object.keys(DECISION_STATUS)).toEqual([
      "collecting", "preparing", "pending_deputy", "pending_chair", "approved", "voting", "issued",
    ]);
    expect(DECISION_STAGES).toHaveLength(7);
    expect(DECISION_STAGES[0]).toBe("تجميع الدراسات والتقييمات");
    expect(DECISION_STAGES[2]).toBe("اعتماد نائب الرئيس");
    expect(DECISION_STAGES[3]).toBe("اعتماد رئيس المركز");
  });

  it("التجميع يسبق الإعداد ولا يقفز إليه ما بعده", () => {
    expect(canDecisionTransition("collecting", "preparing")).toBe(true);
    expect(canDecisionTransition("collecting", "pending_deputy")).toBe(false);
    expect(canDecisionTransition("collecting", "voting")).toBe(false);
  });

  it("لا طريق للطرح إلا عبر الحلقتين معاً", () => {
    expect(canDecisionTransition("pending_deputy", "pending_chair")).toBe(true);
    expect(canDecisionTransition("pending_chair", "approved")).toBe(true);
    expect(canDecisionTransition("pending_deputy", "approved")).toBe(false);
    expect(canDecisionTransition("pending_deputy", "voting")).toBe(false);
    expect(canDecisionTransition("pending_chair", "voting")).toBe(false);
    expect(canDecisionTransition("approved", "voting")).toBe(true);
  });

  it("كلٌّ من القيادة يعيد للمعدّ من حلقته", () => {
    expect(DECISION_TRANSITIONS.pending_deputy).toContain("preparing");
    expect(DECISION_TRANSITIONS.pending_chair).toContain("preparing");
  });

  it("التصويت بسبعة مقاعد (الأعضاء + النائب + الرئيس) بأغلبية أربعة", () => {
    expect(DECISION_VOTING_SEATS).toBe(7);
    expect(DECISION_MAJORITY).toBe(4);
  });

  it("فهرس المراحل يبدأ بالتجميع ويشمل حلقة الرئيس", () => {
    expect(decisionStageOf("collecting")).toBe(0);
    expect(decisionStageOf("preparing")).toBe(1);
    expect(decisionStageOf("pending_deputy")).toBe(2);
    expect(decisionStageOf("pending_chair")).toBe(3);
    expect(decisionStageOf("approved")).toBe(4);
    expect(decisionStageOf("issued")).toBe(7);
  });
});

describe("الإجراء المطلوب لكل مقعد", () => {
  it("النائب يُطالَب في حلقته فقط، والرئيس في حلقته فقط", () => {
    expect(nextDecisionAction("leadership", { status: "pending_deputy", leadSeat: "deputy" })).toMatch(/اعتماده/);
    expect(nextDecisionAction("leadership", { status: "pending_deputy", leadSeat: "chair" })).toBeNull();
    expect(nextDecisionAction("leadership", { status: "pending_chair", leadSeat: "chair" })).toMatch(/بعد اعتماد النائب/);
    expect(nextDecisionAction("leadership", { status: "pending_chair", leadSeat: "deputy" })).toBeNull();
  });

  it("المعدّ: لا إجراء له في التجميع ولا أثناء الحلقتين، ويعود دوره عند approved", () => {
    expect(nextDecisionAction("preparer", { status: "collecting", mine: true })).toBeNull();
    expect(nextDecisionAction("preparer", { status: "pending_deputy", mine: true })).toBeNull();
    expect(nextDecisionAction("preparer", { status: "pending_chair", mine: true })).toBeNull();
    expect(nextDecisionAction("preparer", { status: "approved", mine: true })).toMatch(/طرح/);
  });

  it("القيادة تصوّت كالأعضاء عند الطرح، والرئيس يُصدر بعد الإغلاق", () => {
    expect(nextDecisionAction("leadership", { status: "voting", leadSeat: "deputy" })).toMatch(/بصوتك/);
    expect(nextDecisionAction("leadership", { status: "voting", leadSeat: "chair", closed: true })).toMatch(/إصدار/);
  });
});
