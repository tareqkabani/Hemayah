// سجلّ التظلّمات — استعلامٌ وخريطة تحويلٍ واحدة يستعملها الخادم (data.ts)
// والعميل (تحديث Realtime) على السواء، تحت RLS نفسها (عزل المستشار المتبادل).
// الملف المجمّع كلّه من صفوفٍ فعليّة: القضية · التوصية · الدراسات · قرار المركز.

export const GRIEVANCE_SELECT = `id, ref, case_id, scope, against, applicant_reason, decision_ref,
  status, filed_at, decision_due, assigned_to, assigned_at,
  advisor_decision, office_decision, return_log,
  protection_cases(id, ref_no, secret_code, category, status, classification, source, created_at,
    recommendations(source_body, decision, proposed_type, notes, raised_at, received_at),
    studies(recommendation, reject_reasons, proposed_type, proposed_duration, notes, partial_reason, submitted_at),
    assessments(recommendation, reject_reasons, proposed_type, proposed_duration, notes, partial_reason, submitted_at),
    council_decisions(ref, status, types, duration, reasoning, issued_type, issued_reason, issued_at))`;

const CAT_AR = { witness: "شاهد", reporter: "مبلّغ", expert: "خبير", victim: "ضحية", related: "ذو صلة" };
const RISK_AR = { low: "منخفض", medium: "متوسط", high: "مرتفع", critical: "حرج" };
export const SCOPE_AR = {
  reject: "الاعتراض على رفض الطلب",
  types: "الاعتراض على أنواع الحماية المقرّرة",
};

const DAY = 86400000;
const one = (v) => (Array.isArray(v) ? v[0] ?? null : v);
const many = (v) => (Array.isArray(v) ? v : v ? [v] : []);

export function fmtDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("ar-SA-u-nu-latn", { dateStyle: "medium" }); }
  catch { return iso; }
}

/** صفوف Supabase → صيغة شاشات المكتب الفني. */
export function mapGrievances(rows, now = new Date()) {
  return (rows || []).map((g) => {
    const c = one(g.protection_cases) || {};
    const rec = many(c.recommendations).sort((a, b) => ((a.raised_at || "") < (b.raised_at || "") ? 1 : -1))[0] || null;
    const cd = one(c.council_decisions) || null;
    const outputs = [
      ...many(c.studies).map((s) => ({ ...s, who: "الدراسة القانونية", icon: "rate_review" })),
      ...many(c.assessments).map((s) => ({ ...s, who: "التقييم النفسي/الاجتماعي", icon: "psychology" })),
    ].filter((s) => s.submitted_at);

    const filed = g.filed_at ? new Date(g.filed_at).getTime() : now.getTime();
    const daysElapsed = Math.max(0, Math.floor((now.getTime() - filed) / DAY));

    // قرار المركز محل التظلّم — من صفّ council_decisions الفعلي
    const decision = cd && cd.issued_at
      ? {
          no: cd.ref || g.decision_ref || null,
          outcome: cd.issued_type === "accept" ? "accept" : "reject",
          date: fmtDate(cd.issued_at),
          issuedAt: cd.issued_at,
          reasons: [cd.issued_reason, cd.reasoning].filter(Boolean),
          types: Array.isArray(cd.types) ? cd.types : [],
          duration: cd.duration || null,
        }
      : null;

    // الدراسات والتقييمات مجمّعة — عناصرها الفعلية فقط
    const studies = outputs.map((s) => ({
      who: s.who,
      icon: s.icon,
      recommendation: s.recommendation || "—",
      factors: [
        ["التوصية", s.recommendation || "—"],
        ...(Array.isArray(s.proposed_type) && s.proposed_type.length
          ? [["الأنواع المقترحة", s.proposed_type.join(" · ")]]
          : []),
        ...(s.partial_reason ? [["سبب القبول الجزئي", s.partial_reason]] : []),
      ],
      opinion: s.notes || "—",
      when: fmtDate(s.submitted_at),
    }));

    // الخط الزمني من الوقائع الفعلية بطوابعها — لا نصوص مُلفّقة
    const timeline = [];
    if (c.created_at)
      timeline.push({ ts: c.created_at, kind: "ok", icon: "inbox", t: "تقديم الطلب", m: (c.ref_no || "") + " — عبر بوابة طالب الحماية موثّقاً بنفاذ، وأُسند الرمز السري." });
    if (rec && rec.received_at)
      timeline.push({ ts: rec.received_at, kind: "ok", icon: "mark_email_read", t: "توصية الجهة المختصة", m: (rec.source_body || "الجهة المختصة") + " — " + (rec.decision === "توفير" ? "توجد قضية قائمة" : rec.decision || "—") + "." });
    for (const s of outputs)
      timeline.push({ ts: s.submitted_at, kind: "ok", icon: "analytics", t: "استُقبل مخرَج " + s.who, m: s.recommendation || "—" });
    if (decision)
      timeline.push({ ts: decision.issuedAt, kind: decision.outcome === "reject" ? "rej" : "ok", icon: "gavel", t: "قرار المركز — " + (decision.outcome === "reject" ? "رفض" : "قبول"), m: decision.reasons[0] || "قرار المجلس" });
    if (g.filed_at)
      timeline.push({ ts: g.filed_at, kind: "grv", icon: "gavel", t: "رفع التظلّم", m: (g.ref || "") + " — " + (SCOPE_AR[g.scope] || g.against || "") + " أمام النائب العام عبر المكتب الفني خلال مهلة (10) أيام (م21)." });
    for (const r of many(g.return_log))
      timeline.push({ ts: r.at, kind: "grv", icon: "undo", t: "إعادة المدير للمستشار", m: r.note || "—" });
    if (g.advisor_decision && g.advisor_decision.on)
      timeline.push({ ts: g.advisor_decision.on, kind: "ok", icon: "how_to_reg", t: "قرار المستشار المستقلّ", m: g.advisor_decision.decision === "support" ? "تأييد التظلّم" : "تأييد قرار المركز" });
    if (g.office_decision && g.office_decision.on)
      timeline.push({ ts: g.office_decision.on, kind: g.office_decision.outcome === "accept" ? "ok" : "rej", icon: "verified", t: "بتّ المكتب الفني — نهائي", m: g.office_decision.outcome === "accept" ? "قبول التظلّم — يُشمل المتقدّم مباشرةً" : "رفض التظلّم — قرار المركز مؤيَّد" });
    timeline.sort((a, b) => ((a.ts || "") > (b.ts || "") ? 1 : -1));

    return {
      id: g.id,
      caseId: g.case_id,
      ref: g.ref || "—",
      secret: c.secret_code || "—",
      caseRef: c.ref_no || "—",
      cat: CAT_AR[c.category] || "—",
      scope: g.scope,
      scopeLabel: SCOPE_AR[g.scope] || g.against || "—",
      applicantReason: g.applicant_reason || g.against || "—",
      status: g.status,
      filedAt: g.filed_at,
      filedOn: fmtDate(g.filed_at),
      daysElapsed,
      daysLeft: Math.max(0, 10 - daysElapsed),
      assignedTo: g.assigned_to,
      advisorDecision: g.advisor_decision || null,
      officeDecision: g.office_decision || null,
      returnLog: many(g.return_log),
      decision,
      caseFile: {
        entity: (rec && rec.source_body) || "—",
        recDecision: (rec && rec.decision) || "—",
        threat: RISK_AR[c.classification] || "—",
        source: c.source === "foreign" ? "أجنبي (م6)" : c.source === "urgent" ? "عاجل (م8)" : "محلي",
        caseStatus: c.status,
      },
      studies,
      timeline,
    };
  });
}

export async function fetchGrievances(supabase) {
  const { data, error } = await supabase
    .from("grievances")
    .select(GRIEVANCE_SELECT)
    .order("filed_at", { ascending: false });
  if (error) return [];
  return mapGrievances(data);
}
