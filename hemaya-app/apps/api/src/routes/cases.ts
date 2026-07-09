import { Hono } from "hono";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import type { Env } from "../types";
import { callRpc } from "../lib/supabase";
import {
  SubmitCaseSchema, TriageSchema, StudyAssessmentSchema,
  CouncilDraftSchema, CouncilSubmitSchema, CouncilReturnSchema,
  CouncilVoteSchema, CouncilIssueSchema, ContactLogSchema,
  MessageSendSchema, GrievanceFileSchema, MESSAGE_THREADS,
} from "../schemas";
import { validationHook } from "../middleware/validation";
import { requireScope, requireUser } from "../middleware/scope";

/**
 * قضايا الحماية. كل الاستعلامات بعميل هوية المستخدم، فـ RLS + دوال
 * SECURITY DEFINER في القاعدة هي الحارس النهائيّ. النقاط تلفّ المنطق الموجود
 * ولا تعيد بناءه.
 */
export const cases = new Hono<Env>();

const LIST_FIELDS = "id, ref_no, status, category, classification, source, created_at, updated_at";

/** يحلّ الرقم المرجعيّ إلى معرّف القضية (محكوم بـ RLS)؛ يرمي 404 إن لم تُوجَد/لا صلاحيّة. */
async function resolveCaseId(c: Context<Env>): Promise<string> {
  const ref = c.req.param("ref");
  if (!ref) throw new HTTPException(400, { message: "مرجع القضية مطلوب." });
  const { data, error } = await c.get("db")
    .from("protection_cases")
    .select("id")
    .eq("ref_no", ref)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HTTPException(404, { message: "القضية غير موجودة." });
  return data.id;
}

// ── قراءة ──────────────────────────────────────────────────────────────

cases.get("/", requireScope("cases:read"), async (c) => {
  const db = c.get("db");
  const { data, error } = await db
    .from("protection_cases")
    .select(LIST_FIELDS)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return c.json({ data });
});

cases.get("/:ref", requireScope("cases:read"), async (c) => {
  const db = c.get("db");
  const ref = c.req.param("ref");
  const { data, error } = await db
    .from("protection_cases")
    .select(`${LIST_FIELDS}, secret_code, protection_requests(*)`)
    .eq("ref_no", ref)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    return c.json(
      { error: { code: "not_found", message: "القضية غير موجودة.", requestId: c.get("requestId") ?? null } },
      404,
    );
  }
  return c.json({ data });
});

// ── كتابة (تغليف دوال RPC الآمنة) ───────────────────────────────────────

/** تقديم طلب حماية جديد — يستدعي submit_protection_request بهوية المستفيد. */
cases.post("/", requireUser, zValidator("json", SubmitCaseSchema, validationHook), async (c) => {
  const db = c.get("db");
  const input = c.req.valid("json");
  const rows = await callRpc<{ ref_no: string; secret_code: string; case_id: string }[]>(
    db,
    "submit_protection_request",
    {
      _applicant_role: input.applicantRole,
      _category: input.category,
      _entity: input.entity,
      _crime: input.crime,
      _reason: input.reason,
      _prior_submit: input.priorSubmit,
      _case_no: input.caseNo ?? null,
      _details: input.details ?? {},
    },
  );
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row) throw new HTTPException(502, { message: "لم تُعِد الخدمة نتيجة." });
  return c.json(
    { data: { refNo: row.ref_no, secretCode: row.secret_code, caseId: row.case_id } },
    201,
  );
});

/** قرار الفرز — يحلّ ref_no إلى معرّف القضية (محكوم بـ RLS) ثم ينادي triage_decide. */
cases.post("/:ref/triage", requireUser, zValidator("json", TriageSchema, validationHook), async (c) => {
  const db = c.get("db");
  const caseId = await resolveCaseId(c);
  const input = c.req.valid("json");
  const rows = await callRpc<{ status: string }[]>(db, "triage_decide", {
    _case_id: caseId,
    _decision: input.decision,
    _reason: input.reason ?? null,
    _formal_check: input.formalCheck,
    _authority: input.authority ?? null,
  });
  const row = Array.isArray(rows) ? rows[0] : rows;
  return c.json({ data: { status: row?.status ?? null } });
});

/** تقديم دراسة (دارس) — submit_study. */
cases.post("/:ref/study", requireUser, zValidator("json", StudyAssessmentSchema, validationHook), async (c) => {
  const caseId = await resolveCaseId(c);
  const input = c.req.valid("json");
  const rows = await callRpc<{ id: string }[]>(c.get("db"), "submit_study", {
    _case_id: caseId,
    _recommendation: input.recommendation,
    _reject_reasons: input.rejectReasons,
    _proposed_type: input.proposedType,
    _proposed_duration: input.proposedDuration ?? null,
    _notes: input.notes ?? null,
  });
  const row = Array.isArray(rows) ? rows[0] : rows;
  return c.json({ data: { id: row?.id ?? null } }, 201);
});

/** تقديم تقييم (مقيّم) — submit_assessment (نفس بنية الدراسة). */
cases.post("/:ref/assessment", requireUser, zValidator("json", StudyAssessmentSchema, validationHook), async (c) => {
  const caseId = await resolveCaseId(c);
  const input = c.req.valid("json");
  const rows = await callRpc<{ id: string }[]>(c.get("db"), "submit_assessment", {
    _case_id: caseId,
    _recommendation: input.recommendation,
    _reject_reasons: input.rejectReasons,
    _proposed_type: input.proposedType,
    _proposed_duration: input.proposedDuration ?? null,
    _notes: input.notes ?? null,
  });
  const row = Array.isArray(rows) ? rows[0] : rows;
  return c.json({ data: { id: row?.id ?? null } }, 201);
});

/** إحالة القضية للقرار — send_to_decision (يتطلّب اكتمال الدراسة والتقييم). */
cases.post("/:ref/send-to-decision", requireUser, async (c) => {
  const caseId = await resolveCaseId(c);
  const rows = await callRpc<{ status: string }[]>(c.get("db"), "send_to_decision", { _case_id: caseId });
  const row = Array.isArray(rows) ? rows[0] : rows;
  return c.json({ data: { status: row?.status ?? null } });
});

// ── دورة المجلس (إعداد ← اعتماد ← تصويت ← إصدار) ─────────────────────────

/** حفظ مسوّدة القرار — council_save. */
cases.post("/:ref/council/draft", requireUser, zValidator("json", CouncilDraftSchema, validationHook), async (c) => {
  const caseId = await resolveCaseId(c);
  const input = c.req.valid("json");
  await callRpc<unknown>(c.get("db"), "council_save", {
    _case_id: caseId, _types: input.types, _duration: input.duration ?? null, _reasoning: input.reasoning ?? null,
  });
  return c.json({ data: { ok: true } });
});

/** رفع القرار للاعتماد — council_submit. */
cases.post("/:ref/council/submit", requireUser, zValidator("json", CouncilSubmitSchema, validationHook), async (c) => {
  const caseId = await resolveCaseId(c);
  const input = c.req.valid("json");
  const rows = await callRpc<{ status: string }[]>(c.get("db"), "council_submit", {
    _case_id: caseId, _types: input.types, _duration: input.duration ?? null, _reasoning: input.reasoning,
  });
  const row = Array.isArray(rows) ? rows[0] : rows;
  return c.json({ data: { status: row?.status ?? null } });
});

/** اعتماد القيادة (نائب ← رئيس) — council_approve. */
cases.post("/:ref/council/approve", requireUser, async (c) => {
  const caseId = await resolveCaseId(c);
  const rows = await callRpc<{ status: string }[]>(c.get("db"), "council_approve", { _case_id: caseId });
  const row = Array.isArray(rows) ? rows[0] : rows;
  return c.json({ data: { status: row?.status ?? null } });
});

/** إعادة القرار للمُعِدّ — council_return. */
cases.post("/:ref/council/return", requireUser, zValidator("json", CouncilReturnSchema, validationHook), async (c) => {
  const caseId = await resolveCaseId(c);
  const input = c.req.valid("json");
  await callRpc<unknown>(c.get("db"), "council_return", { _case_id: caseId, _note: input.note });
  return c.json({ data: { ok: true } });
});

/** تصويت عضو المجلس — council_vote. */
cases.post("/:ref/council/vote", requireUser, zValidator("json", CouncilVoteSchema, validationHook), async (c) => {
  const caseId = await resolveCaseId(c);
  const input = c.req.valid("json");
  await callRpc<unknown>(c.get("db"), "council_vote", { _case_id: caseId, _choice: input.choice, _note: input.note ?? null });
  return c.json({ data: { ok: true } });
});

/** فرز الأصوات — council_tally (قراءة). */
cases.get("/:ref/council/tally", requireUser, async (c) => {
  const caseId = await resolveCaseId(c);
  const rows = await callRpc<Record<string, unknown>[]>(c.get("db"), "council_tally", { _case_id: caseId });
  const row = Array.isArray(rows) ? rows[0] : rows;
  return c.json({ data: row ?? null });
});

/** إغلاق التصويت — council_close. */
cases.post("/:ref/council/close", requireUser, async (c) => {
  const caseId = await resolveCaseId(c);
  await callRpc<unknown>(c.get("db"), "council_close", { _case_id: caseId });
  return c.json({ data: { ok: true } });
});

/** إصدار القرار النهائيّ — council_issue. */
cases.post("/:ref/council/issue", requireUser, zValidator("json", CouncilIssueSchema, validationHook), async (c) => {
  const caseId = await resolveCaseId(c);
  const input = c.req.valid("json");
  const rows = await callRpc<{ outcome: string }[]>(c.get("db"), "council_issue", { _case_id: caseId, _reason: input.reason ?? null });
  const row = Array.isArray(rows) ? rows[0] : rows;
  return c.json({ data: { outcome: row?.outcome ?? null } });
});

// ── التنفيذ ومحاضر الاتصال ──────────────────────────────────────────────

/** توقيع اتفاقية الحماية — sign_agreement. */
cases.post("/:ref/sign-agreement", requireUser, async (c) => {
  const caseId = await resolveCaseId(c);
  const rows = await callRpc<{ status: string }[]>(c.get("db"), "sign_agreement", { _case_id: caseId });
  const row = Array.isArray(rows) ? rows[0] : rows;
  return c.json({ data: { status: row?.status ?? null } });
});

/** تسجيل محضر اتصال — إدراج في contact_logs بهوية الموظّف. */
cases.post("/:ref/contact-logs", requireUser, zValidator("json", ContactLogSchema, validationHook), async (c) => {
  const caseId = await resolveCaseId(c);
  const input = c.req.valid("json");
  const principal = c.get("principal");
  const officerId = principal.type === "user" ? principal.user.id : null;
  const { error } = await c.get("db")
    .from("contact_logs")
    .insert({ case_id: caseId, officer_id: officerId, channel: input.channel, summary: input.summary });
  if (error) throw error;
  return c.json({ data: { ok: true } }, 201);
});

// ── المستفيد: تفصيلٌ موحّد + مراسلات + تظلّمات ───────────────────────────

/** عرضٌ موحّد لقضيّة المستفيد (قضية + قرارٌ مُصدَر + آخر تظلّم) — RPC seeker_case_view.
 *  يكسر فجوة RLS التي تحجب council_decisions عن المستفيد (يُكشَف القرار بعد الإصدار فقط). */
cases.get("/:ref/view", requireUser, async (c) => {
  const view = await callRpc<{ case: unknown; decision: unknown; grievance: unknown } | null>(
    c.get("db"), "seeker_case_view", { _ref: c.req.param("ref") },
  );
  if (!view) {
    return c.json(
      { error: { code: "not_found", message: "القضية غير موجودة.", requestId: c.get("requestId") ?? null } },
      404,
    );
  }
  return c.json({ data: view });
});

const MESSAGE_FIELDS = "id, case_id, thread, direction, body, sender_label, created_at";

/** مراسلات القضية — قراءة (RLS: seeker_msg_read/staff_msg_read). فلترة اختيارية بالخيط. */
cases.get("/:ref/messages", requireUser, async (c) => {
  const caseId = await resolveCaseId(c);
  const thread = c.req.query("thread");
  if (thread && !MESSAGE_THREADS.includes(thread as (typeof MESSAGE_THREADS)[number])) {
    throw new HTTPException(400, { message: "خيط المراسلة غير صالح." });
  }
  let query = c.get("db")
    .from("messages")
    .select(MESSAGE_FIELDS)
    .eq("case_id", caseId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (thread) query = query.eq("thread", thread as (typeof MESSAGE_THREADS)[number]);
  const { data, error } = await query;
  if (error) throw error;
  return c.json({ data });
});

/** ردّ المستفيد على المركز/الجهة — إدراجٌ باتّجاه out (تفرضه RLS: seeker_msg_reply). */
cases.post("/:ref/messages", requireUser, zValidator("json", MessageSendSchema, validationHook), async (c) => {
  const caseId = await resolveCaseId(c);
  const input = c.req.valid("json");
  const { data, error } = await c.get("db")
    .from("messages")
    .insert({ case_id: caseId, thread: input.thread, direction: "out", body: input.body, sender_label: "طالب الحماية" })
    .select(MESSAGE_FIELDS)
    .single();
  if (error) throw error;
  return c.json({ data }, 201);
});

/** تظلّمات القضية — قراءة (RLS: grievance_seeker_read = owns_case). */
cases.get("/:ref/grievances", requireUser, async (c) => {
  const caseId = await resolveCaseId(c);
  const { data, error } = await c.get("db")
    .from("grievances")
    .select("id, case_id, against, status, outcome, filed_at, decision_due, tech_opinion")
    .eq("case_id", caseId)
    .order("filed_at", { ascending: false });
  if (error) throw error;
  return c.json({ data });
});

/** رفع تظلّم أمام النائب العام — إدراجٌ في grievances (RLS: grievance_seeker_insert).
 *  يُشغّل مُشغّل القاعدة لإشعار المكتب الفنّي. المهلة النظاميّة (10) أيام. */
cases.post("/:ref/grievances", requireUser, zValidator("json", GrievanceFileSchema, validationHook), async (c) => {
  const caseId = await resolveCaseId(c);
  const input = c.req.valid("json");
  const against = [input.scope, input.reason].filter((s) => s && s.trim()).join(" — ");
  const now = new Date();
  const due = new Date(now.getTime() + 10 * 86_400_000).toISOString();
  const { data, error } = await c.get("db")
    .from("grievances")
    .insert({ case_id: caseId, against, status: "filed", filed_at: now.toISOString(), decision_due: due })
    .select("id, case_id, against, status, filed_at, decision_due")
    .single();
  if (error) throw error;
  return c.json({ data }, 201);
});
