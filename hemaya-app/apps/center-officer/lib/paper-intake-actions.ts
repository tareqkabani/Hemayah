"use server";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@hemaya/supabase";
import type { AppCategory, Json } from "@hemaya/supabase";

// فئة الحماية: القيمة المعتمدة هي مفتاح البند في طبقة المحتوى (item_key)،
// وهو عين قيمة enum app_category — فلا خريطةَ ترجمةٍ ولا تخمين.
//
// ⚠️ الخريطة العربية أدناه للتوافق الخلفي وحدها (نداءٌ قديم يمرّر التسمية).
// وكان الحلّ قبل اليوم ينتهي بـ«|| witness»: أيّ تسميةٍ خارجها تُخزَّن
// **شاهداً بصمت**. وصارت «ذو صلة» قابلةً للاختيار حين رُبط النموذج بطبقة
// المحتوى وليست في الخريطة — فكان اختيارها يُخزَّن شاهداً. الآن يُرفض
// المجهول صراحةً بدل أن يُملأ حقلٌ نظاميّ بقيمةٍ لم يخترها أحد.
const VALID_CAT = new Set<AppCategory>(["reporter", "witness", "expert", "victim", "related"]);
const LEGACY_CAT: Record<string, AppCategory> = {
  "شاهد": "witness",
  "مبلّغ": "reporter",
  "مُبلِّغ": "reporter",
  "خبير": "expert",
  "ضحية": "victim",
  "ذو صلة": "related",
};
function toCategory(v: string): AppCategory {
  const s = (v || "").trim();
  if (VALID_CAT.has(s as AppCategory)) return s as AppCategory;
  const legacy = LEGACY_CAT[s];
  if (legacy) return legacy;
  throw new Error(`فئة حماية غير معروفة: «${s}» — راجع قائمة app_category في طبقة المحتوى.`);
}

export type PaperIntakeInput = {
  source: "seeker" | "entity";
  applicantRole: string;
  category: string;   // عربي
  entity: string;
  crime: string;
  reason: string;
  priorSubmit: boolean;
  caseNo: string;
  receivedDate?: string; // تاريخ الورود الفعلي (ISO) — منه تُحسب المُهل (م10)
  regNo?: string;        // رقم القيد الإداري / مرجع الموقع الإلكتروني
  inboxId?: string;      // صفّ الواردة الذي يُفرَّغ (إن فُتح النموذج منها)
  details?: Record<string, unknown>;
};

export async function submitPaperIntake(input: PaperIntakeInput) {
  if (!input.crime?.trim() || !input.reason?.trim()) {
    return { ok: false as const, error: "الجريمة والمسوّغات مطلوبة." };
  }
  let category: AppCategory;
  try {
    category = toCategory(input.category);
  } catch (e) {
    return { ok: false as const, error: String(e instanceof Error ? e.message : e) };
  }
  const supabase = createServerClient();
  const { error, data } = await supabase.rpc("submit_paper_intake", {
    _source: input.source,
    _applicant_role: (input.applicantRole || null) as string, // الدالة تقبل NULL فعلياً
    _category: category,
    _entity: (input.entity || null) as string,
    _crime: input.crime,
    _reason: input.reason,
    _prior_submit: !!input.priorSubmit,
    _case_no: (input.caseNo || null) as string,
    _details: (input.details || {}) as Json,
    _received_date: (input.receivedDate || null) as string,
    _reg_no: (input.regNo || null) as string,
    _inbox_id: (input.inboxId || null) as string,
  });
  if (error) return { ok: false as const, error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  revalidatePath("/triage");
  revalidatePath("/paper-intake");
  return { ok: true as const, ref: row?.ref_no as string, secret: row?.secret_code as string, caseId: row?.case_id as string };
}

export type ReferredCase = {
  caseId: string;
  secret: string;
  cat: string;         // عربي
  caseNo: string;
  city: string;
  region: string;
  referredAt: string;  // ISO
  dueAt: string | null;
};

const CAT_AR: Record<string, string> = {
  witness: "شاهد", reporter: "مبلّغ", expert: "خبير", victim: "ضحية", related: "ذو صلة",
};

// خطوة الربط الإلزامية: الطلبات المُحالة إلى الجهة بانتظار توصيتها —
// تُدمج التوصية الورقية في سجلّ الطلب نفسه، لا في سجلٍّ مكرّر.
export async function listReferredForEntity(entityKey: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("list_referred_for_entity", { _entity: entityKey });
  if (error) return { ok: false as const, error: error.message, rows: [] as ReferredCase[] };
  const rows: ReferredCase[] = (data || []).map((r) => ({
    caseId: r.case_id as string,
    secret: r.secret_code as string,
    cat: CAT_AR[r.category as string] || (r.category as string),
    caseNo: (r.case_no as string) || "",
    city: (r.city as string) || "",
    region: (r.region as string) || "",
    referredAt: r.referred_at as string,
    dueAt: (r.due_at as string) || null,
  }));
  return { ok: true as const, rows };
}

/* ── «مُحالة من الفرز» — بحثٌ وترقيمٌ على الخادم (فجوة التسليم ٥) ──
   كانت الصفحة تنادي list_referred_for_entity **خمس مرّات** (مرّةً لكلّ جهة)
   وتُسطّح الناتج بلا حدٍّ ولا بحث. هنا نداءٌ واحد مُرقَّم.
   وlistReferredForEntity أعلاه تبقى: خطوة الربط تحتاج جهةً واحدة معلومة. */
export type ReferredQuery = {
  q?: string;
  entity?: string | null;
  due?: "over" | "open" | null;
  limit?: number;
  offset?: number;
};

// recId هويّة الصفّ: القضية الواحدة تُحال لأكثر من جهة، فلكلّ توصيةٍ صفُّها
// وخطابُها المنتظَر — وcaseId عندئذٍ يتكرّر.
export type ReferredRow = ReferredCase & { recId: string; entity: string; isOver: boolean };

/* ⚠️ دوالّ هذه الدفعة أُنشئت بعد توليد types.gen.ts، فتُنادى بربطٍ صريح —
   نمط apps/admin/lib/data.ts نفسه. يُعاد التوليد مع دمج السلسلة.
   (bind إلزامي: استخراج الدالة بلا ربطٍ يفقدها this فتنهار على rest) */
type RpcRow = Record<string, unknown>;
const rpcOf = (sb: ReturnType<typeof createServerClient>) =>
  (sb.rpc as CallableFunction).bind(sb) as (
    fn: string, args?: Record<string, unknown>,
  ) => Promise<{ data: RpcRow[] | null; error: { message: string } | null }>;

export async function listReferred(query: ReferredQuery = {}) {
  const supabase = createServerClient();
  const { data, error } = await rpcOf(supabase)("intake_referred_list", {
    _q: query.q?.trim() || null,
    _entity: query.entity || null,
    _due: query.due || null,
    _limit: query.limit ?? 25,
    _offset: query.offset ?? 0,
  });
  if (error) return { ok: false as const, error: error.message, rows: [] as ReferredRow[], total: 0 };
  const rows: ReferredRow[] = (data || []).map((r) => ({
    recId: r.rec_id as string,
    caseId: r.case_id as string,
    secret: r.secret_code as string,
    cat: CAT_AR[r.category as string] || (r.category as string),
    caseNo: (r.case_no as string) || "",
    city: (r.city as string) || "",
    region: (r.region as string) || "",
    referredAt: r.referred_at as string,
    dueAt: (r.due_at as string) || null,
    entity: (r.entity as string) || "",
    isOver: !!r.is_over,
  }));
  const total = Number((data?.[0] as { total_count?: number } | undefined)?.total_count ?? rows.length);
  return { ok: true as const, rows, total };
}

/* ── الحالات الورقية بلا حساب (فجوة التسليم ٦) ──
   قضيةٌ أُدخلت ورقياً لا مالك لها حتى يدخل صاحبها بنفاذ مرّةً فتُضمّ. والآلية
   سليمة، والمفقود أن يعلم أحدٌ مَن ينتظر. hasContact رايةٌ لا رقم — والرقم
   يُطلب بنداءٍ مستقلٍّ مُقيَّدٍ في التدقيق. */
export type UnclaimedRow = {
  caseId: string;
  secret: string;
  refNo: string;
  channel: string;
  regNo: string;
  arrivedOn: string;
  daysWaiting: number;
  verified: boolean;
  hasContact: boolean;
  outreachCount: number;
  lastOutreachAt: string | null;
};

export async function listUnclaimed() {
  const supabase = createServerClient();
  const { data, error } = await rpcOf(supabase)("intake_unclaimed_cases");
  if (error) return { ok: false as const, error: error.message, rows: [] as UnclaimedRow[] };
  const rows: UnclaimedRow[] = (data || []).map((r) => ({
    caseId: r.case_id as string,
    secret: r.secret_code as string,
    refNo: (r.ref_no as string) || "",
    channel: (r.channel as string) || "",
    regNo: (r.reg_no as string) || "",
    arrivedOn: String(r.arrived_on),
    daysWaiting: Number(r.days_waiting ?? 0),
    verified: !!r.identity_verified,
    hasContact: !!r.has_contact,
    outreachCount: Number(r.outreach_count ?? 0),
    lastOutreachAt: (r.last_outreach_at as string) || null,
  }));
  return { ok: true as const, rows };
}

// كشفٌ مقيَّدٌ: كلّ اطّلاعٍ على اسمٍ أو رقمٍ يُقيَّد في audit_log باسم الكاشف.
export async function revealSubjectContact(caseId: string) {
  const supabase = createServerClient();
  const { data, error } = await rpcOf(supabase)("intake_reveal_subject_contact", { _case_id: caseId });
  if (error) return { ok: false as const, error: error.message };
  const row = (data || [])[0] as { full_name?: string; contact?: string } | undefined;
  return { ok: true as const, name: row?.full_name || "", contact: row?.contact || "" };
}

export async function logOutreach(caseId: string, channel: string, note: string) {
  const supabase = createServerClient();
  const { error } = await rpcOf(supabase)("intake_log_outreach", {
    _case_id: caseId, _channel: channel, _note: note,
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/paper-intake");
  return { ok: true as const };
}

export type PaperRecommendationInput = {
  caseId: string;          // الطلب المُحال المختار في خطوة الربط
  provide: boolean;        // توفير | عدم توفير
  factors9?: Record<string, unknown>;
  types?: string[];
  durationDays?: number | null;
  notes?: string;
  receivedDate?: string;   // تاريخ ورود الخطاب — منه تُحسب المُهل
  regNo?: string;          // رقم القيد الإداري
  letterNo?: string;       // رقم خطاب الجهة
  letterDate?: string;     // تاريخ الخطاب
  letterBy?: string;       // مُعِدّ التوصية في الجهة
  inboxId?: string;        // صفّ الواردة الذي يُفرَّغ
};

// توصية ورقية على طلبٍ مُحال: تُقيَّد على التوصية المعلّقة للطلب نفسه عبر
// record_recommendation (قناة paper) — فيصير «وردت التوصية» في الفرز بلا سجلٍّ مكرّر.
export async function submitPaperRecommendation(input: PaperRecommendationInput) {
  if (!input.caseId) return { ok: false as const, error: "اختر الطلب المُحال أولاً — الربط إلزاميّ." };
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("record_recommendation", {
    _case_id: input.caseId,
    _decision: input.provide ? "توفير" : "عدم توفير",
    _channel: "paper",
    _factors9: (input.factors9 || {}) as Json,
    _proposed_type: (input.types || []) as unknown as Json,
    _proposed_duration: input.durationDays ? `${input.durationDays} days` : undefined,
    _notes: (input.notes || null) as string,
    _received_date: (input.receivedDate || null) as string,
    _reg_no: (input.regNo || null) as string,
    _letter_no: (input.letterNo || null) as string,
    _letter_date: (input.letterDate || null) as string,
    _letter_by: (input.letterBy || null) as string,
    _inbox_id: (input.inboxId || null) as string,
  });
  if (error) return { ok: false as const, error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  revalidatePath("/triage");
  revalidatePath("/paper-intake");
  return { ok: true as const, status: (row as { status?: string } | undefined)?.status };
}

// ════════════════ سِجلّ الوحدة — الواردة والمرسلة والمسوّدات ════════════════
// كلّ ما تحته يمرّ بدوالّ SECURITY DEFINER تحرس الدور (is_intake_staff)
// وتكتب في التدقيق باسم الفاعل — لا كتابة مباشرة على الجدولين.

export type InboxRow = {
  id: string;
  channel: "legacy" | "inperson" | "mail";
  docKind: "req" | "rec";
  regNo: string;
  arrivedOn: string;      // ISO date — منه تُحسب المُهل (م10)
  claimedBy: string | null;
  claimedName: string;
};

export async function listInbox() {
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("intake_inbox_list");
  if (error) return { ok: false as const, error: error.message, rows: [] as InboxRow[] };
  const rows: InboxRow[] = (data || []).map((r) => ({
    id: r.id as string,
    channel: r.channel as InboxRow["channel"],
    docKind: r.doc_kind as InboxRow["docKind"],
    regNo: r.reg_no as string,
    arrivedOn: String(r.arrived_on),
    claimedBy: (r.claimed_by as string) || null,
    claimedName: (r.claimed_name as string) || "",
  }));
  return { ok: true as const, rows };
}

export type SentRow = {
  id: string;
  secret: string;
  channel: "legacy" | "inperson" | "mail";
  docKind: "req" | "rec";
  regNo: string;
  arrivedOn: string;
  entity: string;
  byName: string;
  byRole: string;
  at: string;
  verified: boolean;
  status: string;
};

export type SentQuery = { q?: string; dest?: "triage" | "study" | null; limit?: number; offset?: number };

/** «المرسلة» ببحثٍ وترقيمٍ على الخادم — لا تُجلب كل الصفوف دفعةً واحدة. */
export async function listSent(query: SentQuery = {}) {
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("intake_sent_list", {
    _q: (query.q?.trim() || null) as string,
    _dest: (query.dest || null) as string,
    _limit: query.limit ?? 25,
    _offset: query.offset ?? 0,
  });
  if (error) return { ok: false as const, error: error.message, rows: [] as SentRow[], total: 0 };
  const rows: SentRow[] = (data || []).map((r) => ({
    id: r.id as string,
    secret: r.secret_code as string,
    channel: r.channel as SentRow["channel"],
    docKind: r.doc_kind as SentRow["docKind"],
    regNo: (r.reg_no as string) || "",
    arrivedOn: String(r.arrived_on),
    entity: (r.entity as string) || "",
    byName: (r.entered_by_name as string) || "",
    byRole: (r.entered_by_role as string) || "",
    at: String(r.entered_at || ""),
    verified: !!r.identity_verified,
    status: (r.case_status as string) || "",
  }));
  const total = Number((data?.[0] as { total_count?: number } | undefined)?.total_count ?? rows.length);
  return { ok: true as const, rows, total };
}

export async function registerInbox(input: {
  channel: string; docKind: string; regNo: string; arrivedOn: string;
}) {
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("intake_inbox_register", {
    _channel: input.channel,
    _doc_kind: input.docKind || "req",
    _reg_no: input.regNo,
    _arrived_on: input.arrivedOn,
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/paper-intake");
  return { ok: true as const, id: data as unknown as string };
}

export async function claimInbox(id: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("intake_inbox_claim", { _id: id });
  if (error) return { ok: false as const, error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  revalidatePath("/paper-intake");
  return { ok: true as const, name: (row as { claimed_by_name?: string } | undefined)?.claimed_by_name || "" };
}

// المسوّدة على الخادم (فجوة الإنتاج ٢): لكل قيدٍ ومُدخِل، ولا يقرؤها زميل.
export async function saveDraft(regNo: string, payload: Record<string, unknown>) {
  if (!regNo?.trim()) return { ok: true as const };
  const supabase = createServerClient();
  const { error } = await supabase.rpc("intake_draft_save", {
    _reg_no: regNo, _payload: payload as Json,
  });
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}

export async function loadDraft(regNo: string) {
  if (!regNo?.trim()) return { ok: true as const, payload: null };
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("intake_draft_load", { _reg_no: regNo });
  if (error) return { ok: false as const, error: error.message, payload: null };
  return { ok: true as const, payload: (data as Record<string, unknown> | null) ?? null };
}

export async function clearDraft(regNo: string) {
  if (!regNo?.trim()) return { ok: true as const };
  const supabase = createServerClient();
  const { error } = await supabase.rpc("intake_draft_clear", { _reg_no: regNo });
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}
