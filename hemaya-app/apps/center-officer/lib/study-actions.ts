"use server";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@hemaya/supabase";

export type AuthorInput = {
  recommendation: string; rejectReasons: string[];
  proposedType: string[]; durationDays: number | null; notes: string;
};

async function submit(rpc: "submit_study" | "submit_assessment", caseId: string, i: AuthorInput) {
  const supabase = createServerClient();
  const { error, data } = await supabase.rpc(rpc, {
    _case_id: caseId, _recommendation: i.recommendation,
    _reject_reasons: i.rejectReasons, _proposed_type: i.proposedType,
    // الدالة تقبل NULL فعلياً في المدة والملاحظات
    _proposed_duration: (i.durationDays ? `${i.durationDays} days` : null) as string,
    _notes: (i.notes || null) as string,
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, id: (Array.isArray(data) ? data[0] : data)?.id };
}

export async function submitStudy(caseId: string, i: AuthorInput) {
  const r = await submit("submit_study", caseId, i);
  if (r.ok) revalidatePath("/study");
  return r;
}
export async function submitAssessment(caseId: string, i: AuthorInput) {
  const r = await submit("submit_assessment", caseId, i);
  if (r.ok) revalidatePath("/assessment");
  return r;
}
