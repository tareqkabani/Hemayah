// mapTask — تحويل صف RPC إلى نموذج العرض ومنطق مهلة م10.
// المدد تُحسب بأيام العمل (businessDaysBetween من @hemaya/domain) — الاختبار
// يشتق «المنقضي» بالدالة نفسها كي يبقى صامداً أمام عطلات نهاية الأسبوع.
import { describe, it, expect } from "vitest";
import { businessDaysBetween } from "@hemaya/domain";
import { mapTask, TRACK_AR, CAT_AR } from "./map-task";

const NOW = new Date("2026-07-21T12:00:00Z");
const row = (over = {}) => ({
  case_id: "c1",
  secret_code: "C-2026-0001",
  ref_no: "REF-2026-0001",
  category: "witness",
  source: "urgent",
  foreign_info: null,
  peers: "3",
  assigned_at: NOW.toISOString(),
  submitted_at: null,
  ...over,
});

// يرجع تاريخ إسنادٍ يجعل المنقضي بأيام العمل مساوياً للمطلوب بالضبط
function assignedWithElapsed(target) {
  const d = new Date(NOW);
  for (let i = 0; i < 30; i++) {
    if (businessDaysBetween(d, NOW) === target) return d;
    d.setDate(d.getDate() - 1);
  }
  throw new Error("لم يوجد تاريخ مناسب");
}

describe("الحالة والتعريب", () => {
  it("صف بلا submitted_at = جديد، ومعه = مكتملة", () => {
    expect(mapTask(row(), NOW).status).toBe("new");
    const done = mapTask(row({ submitted_at: NOW.toISOString() }), NOW);
    expect(done.status).toBe("done");
    expect(done.due).toBe("مكتملة");
  });

  it("تعريب الفئة والمسار، والمجهول يسقط للافتراضي", () => {
    const t = mapTask(row(), NOW);
    expect(t.cat).toBe(CAT_AR.witness);
    expect(t.track).toBe(TRACK_AR.urgent);
    const unk = mapTask(row({ category: "x", source: "y" }), NOW);
    expect(unk.cat).toBe("x");
    expect(unk.track).toBe("عادي");
  });

  it("يمرّر بيانات المسار الأجنبي وعدد الأقران رقماً", () => {
    const f = { country: "الأردن" };
    const t = mapTask(row({ foreign_info: f }), NOW);
    expect(t.foreign).toEqual(f);
    expect(t.peers).toBe(3);
    expect(mapTask(row({ peers: null }), NOW).peers).toBe(1);
  });
});

describe("مهلة م10 — يوم عمل ضمن مظلّة 3 أيام", () => {
  it("قبل انقضاء يوم عمل: «متبقٍّ يوم عمل» ومؤقّت يوم واحد", () => {
    const t = mapTask(row({ assigned_at: assignedWithElapsed(0).toISOString() }), NOW);
    expect(t.due).toBe("متبقٍّ يوم عمل");
    expect(t.timer).toEqual({ total: 1, elapsed: 0, ref: "يوم عمل · م10" });
  });

  it("بعد يوم عمل: «متبقٍّ يومان» ومؤقّت المظلّة", () => {
    const t = mapTask(row({ assigned_at: assignedWithElapsed(1).toISOString() }), NOW);
    expect(t.due).toBe("متبقٍّ يومان");
    expect(t.timer).toEqual({ total: 3, elapsed: 1, ref: "مظلّة 3 أيام · م10" });
  });

  it("بعد يومي عمل: «متبقٍّ يوم»", () => {
    const t = mapTask(row({ assigned_at: assignedWithElapsed(2).toISOString() }), NOW);
    expect(t.due).toBe("متبقٍّ يوم");
  });

  it("بعد ثلاثة أيام عمل فأكثر: «متجاوز المهلة»", () => {
    expect(mapTask(row({ assigned_at: assignedWithElapsed(3).toISOString() }), NOW).due).toBe("متجاوز المهلة");
    expect(mapTask(row({ assigned_at: assignedWithElapsed(5).toISOString() }), NOW).due).toBe("متجاوز المهلة");
  });
});
