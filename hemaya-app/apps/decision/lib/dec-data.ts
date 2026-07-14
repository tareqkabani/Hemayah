import { createServerClient, createServiceClient } from "@hemaya/supabase";

// ── تغذية بوابة القرار (المسار الجديد) من Supabase الحقيقيّ ──
// القراءة تحت RLS: المعدّ يرى طلباته؛ العضو يرى المطروح وصوته فقط؛ القيادة ترى الحصيلة.

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

const DEFAULT_SLOTS = [
  { id: "req", group: "request", label: "طلب الحماية" },
  { id: "erec", group: "entityRec", label: "توصية الجهة المختصة" },
  { id: "study", group: "study", label: "جميع الدراسات الخاصة بالطلب" },
  { id: "psych", group: "assessment", label: "جميع التقييمات الخاصة بالطلب" },
  { id: "decision", group: "decision", label: "قرار المركز المُعَدّ" },
];

function fmt(ts: string | null): string {
  if (!ts) return "";
  try { return new Date(ts).toLocaleString("ar-SA-u-nu-latn", { dateStyle: "short", timeStyle: "short" }); }
  catch { return ts; }
}
const choiceAr = (c: string) => (c === "accept" ? "قبول" : c === "reject" ? "رفض" : c);

export async function getDecisionData() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email || "";
  const meSeat = SEAT_BY_EMAIL[email] || "prep1";

  const reqResp = await supabase
    .from("decision_requests")
    .select("id, secret_code, applicant_name, applicant_nid, category, risk, status, package_confirmed, package_confirmed_at, voting_started_at, deadline_closed, issued_type, issued_reason, issued_at")
    .order("created_at", { ascending: false });
  const reqs = (reqResp.data ?? []) as any[];

  const ids = reqs.map((r: any) => r.id);
  const atts = (ids.length
    ? (await supabase.from("decision_attachments").select("request_id, doc_id, doc_group, label, required, file_name, storage_path").in("request_id", ids)).data
    : []) as any[] || [];
  const votes = (ids.length
    ? (await supabase.from("decision_votes").select("request_id, voter_id, choice, note, voted_at").in("request_id", ids)).data
    : []) as any[] || [];

  // خريطة voter_id → seat (لا تكشف مضمون الأصوات — تحلّ المعرّفات فقط)
  const idToSeat: Record<string, string> = {};
  try {
    const admin = createServiceClient();
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    for (const u of list?.users ?? []) { const s = SEAT_BY_EMAIL[u.email || ""]; if (s) idToSeat[u.id] = s; }
  } catch { /* تحلّ إلى لا شيء — الحصيلة تُعرض بالمقاعد المعروفة */ }

  const attByReq: Record<string, any[]> = {};
  for (const a of atts) { (attByReq[a.request_id] ||= []).push(a); }

  const requests: any[] = [];
  const decisions: Record<string, any> = {};
  const votesOut: Record<string, any> = {};
  const secretById: Record<string, string> = {};

  for (const r of reqs) {
    const secret = r.secret_code;
    secretById[r.id] = secret;
    requests.push({
      secret, id: r.id, cat: r.category || "—", risk: r.risk || "—",
      preparer: "prep1", createdByPreparer: true,
      applicant: { name: r.applicant_name, nid: r.applicant_nid },
    });

    // بناء بيان المرفقات: القوالب الخمسة الافتراضية + أي مرفق مخصّص
    const mine = attByReq[r.id] || [];
    const byDoc: Record<string, any> = {};
    for (const a of mine) byDoc[a.doc_id] = a;
    const docs: any[] = DEFAULT_SLOTS.map((s) => {
      const a = byDoc[s.id];
      return { id: s.id, group: s.group, label: a?.label || s.label, required: true, fileName: a?.file_name || null, storagePath: a?.storage_path || null };
    });
    for (const a of mine) {
      if (!DEFAULT_SLOTS.some((s) => s.id === a.doc_id)) {
        docs.push({ id: a.doc_id, group: a.doc_group || "other", label: a.label, required: !!a.required, fileName: a.file_name || null, storagePath: a.storage_path || null });
      }
    }

    decisions[secret] = {
      status: r.status, preparer: "prep1", docs,
      attachedDocs: docs.filter((d) => d.fileName).map((d) => d.id),
      packageConfirmed: !!r.package_confirmed, packageConfirmedAt: fmt(r.package_confirmed_at),
      votingStartedAt: fmt(r.voting_started_at), deadlineClosed: !!r.deadline_closed,
      issued: r.issued_type ? { type: choiceAr(r.issued_type), reason: r.issued_reason || "", when: fmt(r.issued_at) } : null,
    };
  }

  for (const v of votes) {
    const secret = secretById[v.request_id]; if (!secret) continue;
    const seat = idToSeat[v.voter_id] || v.voter_id;
    (votesOut[secret] ||= {})[seat] = { choice: choiceAr(v.choice), note: v.note || "", when: fmt(v.voted_at) };
  }

  return { me: { seat: meSeat }, seatUsers: {}, requests, decisions, votes: votesOut };
}
