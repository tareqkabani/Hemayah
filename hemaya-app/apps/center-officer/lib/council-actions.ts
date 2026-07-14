"use server";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@hemaya/supabase";

// ── أفعال مرحلة القرار — تستدعي RPCs آلة الحالة المفروضة (SECURITY DEFINER) ──
// كلّها تفرض الدور والحالة في القاعدة؛ الواجهة لا تملك تجاوزها.

async function rpc(name: string, args: Record<string, unknown>) {
  const supabase = createServerClient();
  // الاسم ديناميكي هنا فنتجاوز اتحاد الأسماء المولّد؛ القاعدة تفرض الصلاحيات والحالة.
  const { data, error } = await supabase.rpc(name as never, args as never);
  if (error) return { ok: false as const, error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  return { ok: true as const, row };
}

export async function sendToDecision(caseId: string) {
  const r = await rpc("send_to_decision", { _case_id: caseId });
  if (r.ok) revalidatePath("/decision");
  return r;
}

export async function councilSave(caseId: string, types: string[], duration: string, reasoning: string) {
  return rpc("council_save", { _case_id: caseId, _types: types, _duration: duration || null, _reasoning: reasoning || null });
}

export async function councilSubmit(caseId: string, types: string[], duration: string, reasoning: string) {
  const r = await rpc("council_submit", { _case_id: caseId, _types: types, _duration: duration || null, _reasoning: reasoning });
  if (r.ok) { revalidatePath("/decision"); revalidatePath("/decision-lead"); }
  return r;
}

export async function councilApprove(caseId: string) {
  const r = await rpc("council_approve", { _case_id: caseId });
  if (r.ok) { revalidatePath("/decision-lead"); revalidatePath("/decision-vote"); }
  return r;
}

export async function councilReturn(caseId: string, note: string) {
  const r = await rpc("council_return", { _case_id: caseId, _note: note });
  if (r.ok) { revalidatePath("/decision-lead"); revalidatePath("/decision"); }
  return r;
}

export async function councilVote(caseId: string, choice: "accept" | "reject", note: string) {
  const r = await rpc("council_vote", { _case_id: caseId, _choice: choice, _note: note || null });
  if (r.ok) { revalidatePath("/decision-vote"); revalidatePath("/decision-lead"); }
  return r;
}

export async function councilClose(caseId: string) {
  const r = await rpc("council_close", { _case_id: caseId });
  if (r.ok) revalidatePath("/decision-lead");
  return r;
}

export async function councilIssue(caseId: string, reason: string) {
  const r = await rpc("council_issue", { _case_id: caseId, _reason: reason || null });
  if (r.ok) { revalidatePath("/decision-lead"); revalidatePath("/decision-vote"); revalidatePath("/decision"); }
  return r;
}
