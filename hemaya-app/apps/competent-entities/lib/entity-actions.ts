"use server";
import { createServerClient } from "@hemaya/supabase";

const CAT: Record<string, string> = {
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

export async function submitRecommendation(input: RecommendationInput) {
  if (!input.crime?.trim() || !input.reason?.trim()) {
    return { ok: false as const, error: "الجريمة والمسوّغات مطلوبة." };
  }
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("submit_entity_recommendation", {
    _applicant_role: "جهة مختصّة",
    _category: CAT[input.role?.trim()] || "witness",
    _entity: input.entity || null,
    _crime: input.crime,
    _reason: input.reason,
    _case_no: input.caseNo || null,
    _provide: !!input.provide,
    _details: input.details || {},
  });
  if (error) return { ok: false as const, error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  return { ok: true as const, ref: row?.ref_no as string, secret: row?.secret_code as string, caseId: row?.case_id as string };
}
