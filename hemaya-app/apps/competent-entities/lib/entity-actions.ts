"use server";
import { createServerClient } from "@hemaya/supabase";
import type { AppCategory, Json } from "@hemaya/supabase";

const CAT: Record<string, AppCategory> = {
  "شاهد": "witness", "مبلّغ": "reporter", "مُبلِّغ": "reporter", "خبير": "expert", "ضحية": "victim",
};

export type RecommendationInput = {
  role: string;         // صفة مقدم الطلب (عربي)
  entity: string;       // اسم الجهة
  crime: string;
  reason: string;
  caseNo: string;
  provide: boolean;     // توصية بتوفير الحماية؟
  details?: Record<string, unknown>;
};

export type LinkedRecommendationInput = {
  caseId: string;         // الطلب المُحال من الفرز — التوصية تُسجَّل عليه لا على سجل جديد
  provide: boolean;
  factors9?: Record<string, unknown>;
  types?: string[];
  durationDays?: number | null;
  notes?: string;
};

// طلبٌ مُحالٌ من المركز (م5/4): التوصية تُقيَّد على التوصية المعلّقة للطلب نفسه
// وتُرفَع لاعتماد رئيس الفرع — الدرجة الأولى الإلزامية في سلسلة الاعتماد.
// لا تصل المركزَ هنا: الحالة تبقى referred حتى يعتمد الرئيس.
export async function submitForApproval(input: LinkedRecommendationInput) {
  if (!input.caseId) return { ok: false as const, error: "لا طلب مرتبط." };
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("submit_recommendation_for_approval", {
    _case_id: input.caseId,
    _decision: input.provide ? "توفير" : "عدم توفير",
    _factors9: (input.factors9 || {}) as Json,
    _proposed_type: (input.types || []) as unknown as Json,
    _proposed_duration: input.durationDays ? `${input.durationDays} days` : undefined,
    _notes: (input.notes || null) as string,
  });
  if (error) return { ok: false as const, error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  const r = row as { recommendation_id?: string; step_due_at?: string } | undefined;
  return { ok: true as const, recommendationId: r?.recommendation_id, stepDueAt: r?.step_due_at };
}

// بتّ رئيس الفرع: الاعتماد يرفع التوصية للمركز فعليّاً (received_at + عودة
// الملف للفرز)، والإعادة تردّها للموظف بملاحظةٍ إلزامية. الصلاحية محروسة
// في القاعدة بـcb_level()='head' — لا بالواجهة.
export async function decideApproval(recommendationId: string, decision: "approved" | "returned", note?: string) {
  if (!recommendationId) return { ok: false as const, error: "لا توصية محدّدة." };
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("decide_recommendation_approval", {
    _recommendation_id: recommendationId,
    _decision: decision,
    _note: (note?.trim() || null) as string,
  });
  if (error) return { ok: false as const, error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  const r = row as { new_approval_status?: string; new_case_status?: string } | undefined;
  return { ok: true as const, approvalStatus: r?.new_approval_status, caseStatus: r?.new_case_status };
}

export async function submitRecommendation(input: RecommendationInput) {
  if (!input.crime?.trim() || !input.reason?.trim()) {
    return { ok: false as const, error: "الجريمة والمسوّغات مطلوبة." };
  }
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("submit_entity_recommendation", {
    _applicant_role: "جهة مختصّة",
    _category: CAT[input.role?.trim()] || "witness",
    _entity: (input.entity || null) as string, // الدالة تقبل NULL فعلياً
    _crime: input.crime,
    _reason: input.reason,
    _case_no: (input.caseNo || null) as string,
    _provide: !!input.provide,
    _details: (input.details || {}) as Json,
  });
  if (error) return { ok: false as const, error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  return { ok: true as const, ref: row?.ref_no as string, secret: row?.secret_code as string, caseId: row?.case_id as string };
}
