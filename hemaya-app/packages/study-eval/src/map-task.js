// تحويل صف RPC (my_study_tasks / my_assessment_tasks) إلى نموذج العرض —
// منطق المهلة: يوم عمل لاستقبال المخرَج ضمن مظلّة 3 أيام (م10).
import { businessDaysBetween } from "@hemaya/domain";

export const TRACK_AR = { local: "عادي", urgent: "عاجل", foreign: "أجنبي" };
export const CAT_AR = { reporter: "مبلّغ", witness: "شاهد", expert: "خبير", victim: "ضحية", related: "ذو صلة" };

export function mapTask(row, now) {
  const elapsed = businessDaysBetween(new Date(row.assigned_at), now);
  const status = row.submitted_at ? "done" : "new";
  const remainingUmb = 3 - elapsed;
  const due =
    status === "done"
      ? "مكتملة"
      : elapsed < 1
        ? "متبقٍّ يوم عمل"
        : remainingUmb === 2
          ? "متبقٍّ يومان"
          : remainingUmb === 1
            ? "متبقٍّ يوم"
            : remainingUmb <= 0
              ? "متجاوز المهلة"
              : `متبقٍّ ${remainingUmb} أيام`;
  const timer =
    elapsed < 1
      ? { total: 1, elapsed: 0, ref: "يوم عمل · م10" }
      : { total: 3, elapsed, ref: "مظلّة 3 أيام · م10" };
  return {
    caseId: row.case_id,
    secret: row.secret_code,
    refNo: row.ref_no,
    cat: CAT_AR[row.category] || row.category,
    track: TRACK_AR[row.source] || "عادي",
    foreign: row.foreign_info || null,
    peers: Number(row.peers) || 1,
    status,
    due,
    timer,
    assignedAt: row.assigned_at,
    createdAt: row.assigned_at,
    submittedAt: row.submitted_at,
  };
}
