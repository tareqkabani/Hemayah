import { createServerClient, createServiceClient } from "@hemaya/supabase";
import { CATEGORY, RISK_LEVEL } from "@hemaya/domain";

// ── تغذية بوابة القرار (CO-3) من الخطّ الحقيقي: protection_cases + council_* ──
// القراءة تحت RLS: القضايا عبر board_read/co_decision_read؛ الأصوات معزولة صفّياً
// (العضو يرى صوته فقط)؛ باب التصويت للعضو عبر council_vote_open دون كشف الحصيلة.

// خريطة المقاعد ↔ حسابات المجلس المبذورة (بريد نفاذ التجريبيّ).
const SEAT_BY_EMAIL: Record<string, string> = {
  "2000000006@nafath.local": "pp1",
  "2000000061@nafath.local": "pp2",
  "2000000062@nafath.local": "moi",
  "2000000063@nafath.local": "ssp",
  "2000000064@nafath.local": "nazaha",
  "2000000009@nafath.local": "deputy",
  "2000000008@nafath.local": "chair",
};

function fmt(ts: string | null): string {
  if (!ts) return "";
  try { return new Date(ts).toLocaleString("ar-SA-u-nu-latn", { dateStyle: "short", timeStyle: "short" }); }
  catch { return ts; }
}
const choiceAr = (c: string) => (c === "accept" ? "قبول" : c === "reject" ? "رفض" : c);
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

export async function getDecisionData() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email || "";
  const meSeat = SEAT_BY_EMAIL[email] || "prep1";
  const meUid = user?.id || null;

  const caseResp = await supabase
    .from("protection_cases")
    .select(`id, ref_no, secret_code, category, status, classification, source, created_at,
      council_decisions(status, preparer_id, types, duration, reasoning, submitted_at, deputy_approved_at,
        voting_started_at, deadline_closed, rejections, issued_type, issued_reason, issued_at, updated_at),
      protection_requests(details, channel, submitted_at),
      studies(recommendation, partial_reason, proposed_type, proposed_duration, notes, submitted_at),
      assessments(recommendation, partial_reason, notes, submitted_at),
      recommendations(source_body, decision, proposed_type, proposed_duration, factors9, received_at, channel, notes)`)
    // تشمل ما بعد الإصدار (وقّع/فعّل/…) كي يبقى سجلّ القرارات كاملاً — RLS تحسم الرؤية
    .in("status", ["in_decision", "accepted", "rejected", "signed", "active", "under_review", "terminating", "closed"])
    .order("created_at", { ascending: false });
  const cases = (caseResp.data ?? []) as any[];
  const withDecision = cases.filter((c) => one(c.council_decisions));

  const ids = withDecision.map((c) => c.id);
  const votes = (ids.length
    ? (await supabase.from("council_votes").select("case_id, voter_id, choice, note, voted_at").in("case_id", ids)).data
    : []) as any[] || [];
  const atts = (ids.length
    ? (await supabase.from("council_attachments").select("case_id, doc_id, doc_group, label, file_name, storage_path, updated_at").in("case_id", ids)).data
    : []) as any[] || [];
  const msgs = (ids.length
    ? (await supabase.from("council_messages").select("id, case_id, party, party_uid, with_seat, sender_uid, body, created_at").in("case_id", ids).order("created_at", { ascending: true })).data
    : []) as any[] || [];

  // خريطة voter_id → seat (لا تكشف مضمون الأصوات — تحلّ المعرّفات فقط)
  const idToSeat: Record<string, string> = {};
  try {
    const admin = createServiceClient();
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    for (const u of list?.users ?? []) { const s = SEAT_BY_EMAIL[u.email || ""]; if (s) idToSeat[u.id] = s; }
  } catch { /* تحلّ إلى لا شيء — تُعرض المقاعد المعروفة فقط */ }

  const requests: any[] = [];
  const decisions: Record<string, any> = {};
  const packages: Record<string, any> = {};
  const attachments: Record<string, any[]> = {};
  const votesOut: Record<string, any> = {};
  const messagesOut: any[] = [];
  const secretById: Record<string, string> = {};

  // باب التصويت للمطروح (دون كشف الحصيلة للعضو)
  const voteOpenById: Record<string, boolean> = {};
  await Promise.all(withDecision
    .filter((c) => one(c.council_decisions)?.status === "voting")
    .map(async (c) => {
      const { data } = await (supabase.rpc as any)("council_vote_open", { _case_id: c.id });
      voteOpenById[c.id] = !!data;
    }));

  for (const c of withDecision) {
    const cd: any = one(c.council_decisions);
    const secret = c.secret_code;
    secretById[c.id] = secret;

    requests.push({
      secret, id: c.id, ref: c.ref_no,
      cat: (CATEGORY as any)[c.category] || c.category || "—",
      risk: (RISK_LEVEL as any)[c.classification] || c.classification || "—",
      foreign: c.source === "foreign",
      preparerUid: cd.preparer_id || null,
    });

    decisions[secret] = {
      status: cd.status,
      mine: !!meUid && cd.preparer_id === meUid,
      unclaimed: !cd.preparer_id,
      types: Array.isArray(cd.types) ? cd.types : [],
      duration: cd.duration || "",
      reasoning: cd.reasoning || "",
      submittedAt: fmt(cd.submitted_at),
      submittedAtTs: cd.submitted_at || null,
      approvals: { deputy: cd.deputy_approved_at ? { when: fmt(cd.deputy_approved_at), whenTs: cd.deputy_approved_at } : null },
      rejections: (Array.isArray(cd.rejections) ? cd.rejections : []).map((r: any) => ({ note: r.note || "", when: fmt(r.at || null) || "—", whenTs: r.at || null })),
      votingStartedAt: fmt(cd.voting_started_at),
      votingStartedAtTs: cd.voting_started_at || null,
      deadlineClosed: !!cd.deadline_closed,
      voteOpen: cd.status === "voting" ? !!voteOpenById[c.id] : false,
      issued: cd.issued_type ? { type: choiceAr(cd.issued_type), reason: cd.issued_reason || "", when: fmt(cd.issued_at), whenTs: cd.issued_at || null } : null,
    };

    // حزمة الاطّلاع الحقيقية: الطلب + الدراسات + التقييمات + توصية الجهة
    const req = one(c.protection_requests) as any;
    const rec = one(c.recommendations) as any;
    packages[secret] = {
      request: req ? { details: req.details || "", channel: req.channel || "", when: fmt(req.submitted_at) } : null,
      studies: ((c.studies as any[]) || []).filter((s) => s.submitted_at).map((s) => ({
        rec: s.recommendation || "—", partial: s.partial_reason || "", notes: s.notes || "",
        proposed: Array.isArray(s.proposed_type) ? s.proposed_type : [], duration: s.proposed_duration || "", when: fmt(s.submitted_at),
      })),
      assessments: ((c.assessments as any[]) || []).filter((a) => a.submitted_at).map((a) => ({
        rec: a.recommendation || "—", partial: a.partial_reason || "", notes: a.notes || "", when: fmt(a.submitted_at),
      })),
      recommendation: rec ? {
        entity: rec.source_body || "الجهة المختصة", decision: rec.decision || "—",
        proposed: Array.isArray(rec.proposed_type) ? rec.proposed_type : [], duration: rec.proposed_duration || "",
        factors: rec.factors9 || null, notes: rec.notes || "", when: fmt(rec.received_at), channel: rec.channel || "",
      } : null,
    };
  }

  for (const a of atts) {
    const secret = secretById[a.case_id]; if (!secret) continue;
    (attachments[secret] ||= []).push({ id: a.doc_id, group: a.doc_group || "other", label: a.label, fileName: a.file_name || null, storagePath: a.storage_path || null, when: fmt(a.updated_at) });
  }

  for (const v of votes) {
    const secret = secretById[v.case_id]; if (!secret) continue;
    const seat = idToSeat[v.voter_id] || v.voter_id;
    (votesOut[secret] ||= {})[seat] = { choice: choiceAr(v.choice), note: v.note || "", when: fmt(v.voted_at) };
  }

  for (const m of msgs) {
    const secret = secretById[m.case_id]; if (!secret) continue;
    messagesOut.push({
      id: m.id, secret, caseId: m.case_id, party: m.party, partyUid: m.party_uid,
      withSeat: m.with_seat, fromSeat: idToSeat[m.sender_uid] || (m.sender_uid === m.party_uid ? m.party : m.with_seat),
      fromMe: !!meUid && m.sender_uid === meUid, body: m.body, when: fmt(m.created_at), whenTs: m.created_at || null,
    });
  }

  return { me: { seat: meSeat, uid: meUid }, requests, decisions, packages, attachments, votes: votesOut, messages: messagesOut };
}
