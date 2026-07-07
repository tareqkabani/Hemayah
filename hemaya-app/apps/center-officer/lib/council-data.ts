import { createServerClient } from "@hemaya/supabase";

const CAT_AR: Record<string, string> = { witness: "شاهد", reporter: "مبلّغ", expert: "خبير", victim: "ضحية", related: "ذو صلة" };
const RISK_AR: Record<string, string> = { low: "منخفض", medium: "متوسط", high: "عالٍ", critical: "حرج" };
const REC_TONE: Record<string, string> = { "قبول كلي": "success", "قبول جزئي": "warning", "رفض الحماية": "error" };

// يعيد بيانات مرحلة القرار من القاعدة بالشكل الذي يهضمه المخزن (HemayaDecision.hydrate).
export async function getCouncilData() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: cases } = await supabase
    .from("protection_cases")
    .select("id, secret_code, category, classification, source, status, protection_requests(details), studies(recommendation,notes,submitted_at), assessments(recommendation,notes,submitted_at), council_decisions(status,preparer_id,types,duration,reasoning,deputy_approved_at,chair_approved_at,deadline_closed,rejections,issued_type,issued_reason,issued_at)")
    .in("status", ["in_decision", "accepted", "rejected"]);

  const { data: voteRows } = await supabase
    .from("council_votes")
    .select("case_id, voter_id, choice, note");

  const queue: any[] = [];
  const decisions: Record<string, any> = {};
  const votes: Record<string, any> = {};
  const decided: any[] = [];
  const caseSecret: Record<string, string> = {};

  for (const c of cases ?? []) {
    const req: any = Array.isArray(c.protection_requests) ? c.protection_requests[0] : c.protection_requests;
    const d: any = (req?.details ?? {}) as Record<string, any>;
    const cd: any = Array.isArray(c.council_decisions) ? c.council_decisions[0] : c.council_decisions;
    const secret = c.secret_code;
    caseSecret[c.id] = secret;

    const recs: any[] = [];
    for (const s of (c.studies ?? []) as any[]) {
      if (!s.submitted_at) continue;
      recs.push({ who: "دراسة", spec: "قانوني", rec: s.recommendation || "—",
        tone: REC_TONE[s.recommendation] || "info", level: RISK_AR[c.classification] || "عالٍ",
        opinion: s.notes || "لا ملاحظات إضافية.", attachments: ["تقرير الدراسة"] });
    }
    for (const a of (c.assessments ?? []) as any[]) {
      if (!a.submitted_at) continue;
      recs.push({ who: "تقييم", spec: "نفسي/اجتماعي", rec: a.recommendation || "—",
        tone: REC_TONE[a.recommendation] || "info", level: RISK_AR[c.classification] || "عالٍ",
        opinion: a.notes || "لا ملاحظات إضافية.", attachments: ["تقرير التقييم"] });
    }

    queue.push({
      secret, caseId: c.id, real: true,
      cat: CAT_AR[c.category] || "شاهد",
      risk: RISK_AR[c.classification] || "عالٍ",
      studyDays: 1,
      preparer: "prep1",
      caseFile: {
        entity: d.entity || "—", caseNo: d.case_no || "—", crime: d.crime || "—",
        waqia: d.waqia || "—", threat: "—", extends: "—", adapt: "—",
        proposed: "—", duration: cd?.duration || "—",
      },
      recs,
    });

    decisions[secret] = {
      caseId: c.id,
      status: cd?.status || "preparing",
      preparer: "prep1",
      types: cd?.types || [],
      duration: cd?.duration || "",
      reasoning: cd?.reasoning || "",
      approvals: {
        deputy: cd?.deputy_approved_at ? { when: "معتمَد" } : null,
        chair: cd?.chair_approved_at ? { when: "معتمَد" } : null,
      },
      rejections: cd?.rejections || [],
      deadlineClosed: !!cd?.deadline_closed,
      issued: cd?.issued_at ? {
        type: cd.issued_type === "accept" ? "قبول" : "رفض",
        types: cd.types || [], duration: cd.duration || "",
        reason: cd.issued_reason || "", when: "صدر",
      } : null,
    };

    if (cd?.issued_at) decided.push({ secret, cat: CAT_AR[c.category] || "شاهد", type: cd.issued_type === "accept" ? "قبول" : "رفض", when: "صدر" });
  }

  for (const v of voteRows ?? []) {
    const secret = caseSecret[v.case_id];
    if (!secret) continue;
    if (!votes[secret]) votes[secret] = {};
    votes[secret][v.voter_id] = { choice: v.choice === "accept" ? "قبول" : "رفض", note: v.note || "", when: "مُسجّل", mine: v.voter_id === user?.id };
  }

  return { me: user?.id || "", queue, decisions, votes, decided };
}
