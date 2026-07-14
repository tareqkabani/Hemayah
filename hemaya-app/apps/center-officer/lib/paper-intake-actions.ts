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
  });
  if (error) return { ok: false as const, error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  revalidatePath("/triage");
  return { ok: true as const, ref: row?.ref_no as string, secret: row?.secret_code as string, caseId: row?.case_id as string };
}
