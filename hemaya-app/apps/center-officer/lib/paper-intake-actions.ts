"use server";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@hemaya/supabase";
import type { AppCategory, Json } from "@hemaya/supabase";

// خريطة الفئة العربية → enum app_category.
const CAT: Record<string, AppCategory> = {
  "شاهد": "witness",
  "مبلّغ": "reporter",
  "مُبلِّغ": "reporter",
  "خبير": "expert",
  "ضحية": "victim",
};

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
  regNo?: string;        // رقم القيد الإداري / مرجع الموقع القديم
  details?: Record<string, unknown>;
};

export async function submitPaperIntake(input: PaperIntakeInput) {
  if (!input.crime?.trim() || !input.reason?.trim()) {
    return { ok: false as const, error: "الجريمة والمسوّغات مطلوبة." };
  }
  const supabase = createServerClient();
  const { error, data } = await supabase.rpc("submit_paper_intake", {
    _source: input.source,
    _applicant_role: (input.applicantRole || null) as string, // الدالة تقبل NULL فعلياً
    _category: CAT[input.category?.trim()] || "witness",
    _entity: (input.entity || null) as string,
    _crime: input.crime,
    _reason: input.reason,
    _prior_submit: !!input.priorSubmit,
    _case_no: (input.caseNo || null) as string,
    _details: (input.details || {}) as Json,
    _received_date: (input.receivedDate || null) as string,
    _reg_no: (input.regNo || null) as string,
  });
  if (error) return { ok: false as const, error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  revalidatePath("/triage");
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
  });
  if (error) return { ok: false as const, error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  revalidatePath("/triage");
  return { ok: true as const, status: (row as { status?: string } | undefined)?.status };
}
