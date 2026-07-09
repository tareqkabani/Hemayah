"use server";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@hemaya/supabase";

// ── أفعال المسار الجديد لمرحلة القرار — تستدعي RPCs آلة الحالة المفروضة ──
// كلّها SECURITY DEFINER تفرض الدور والحالة في القاعدة؛ الواجهة لا تملك تجاوزها.

async function rpc(name: string, args: Record<string, unknown>) {
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc(name, args);
  if (error) return { ok: false as const, error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  return { ok: true as const, row };
}

const revalAll = () => { revalidatePath("/decision"); revalidatePath("/decision-vote"); revalidatePath("/decision-lead"); };

export async function createRequest(name: string, nid: string) {
  const r = await rpc("dec_create_request", { _name: name, _nid: nid });
  if (r.ok) revalidatePath("/decision");
  return r;
}
export async function setAttachment(requestId: string, docId: string, group: string, label: string, required: boolean, fileName: string, storagePath: string | null) {
  const r = await rpc("dec_set_attachment", { _request_id: requestId, _doc_id: docId, _group: group, _label: label, _required: required, _file_name: fileName, _storage_path: storagePath });
  if (r.ok) revalidatePath("/decision");
  return r;
}
export async function removeAttachment(requestId: string, docId: string) {
  const r = await rpc("dec_remove_attachment", { _request_id: requestId, _doc_id: docId });
  if (r.ok) revalidatePath("/decision");
  return r;
}
export async function submitVoting(requestId: string) {
  const r = await rpc("dec_submit_voting", { _request_id: requestId });
  if (r.ok) revalAll();
  return r;
}
export async function castVote(requestId: string, choice: "accept" | "reject", note: string) {
  const r = await rpc("dec_cast_vote", { _request_id: requestId, _choice: choice, _note: note || null });
  if (r.ok) { revalidatePath("/decision-vote"); revalidatePath("/decision-lead"); }
  return r;
}
export async function closeDeadline(requestId: string) {
  const r = await rpc("dec_close_deadline", { _request_id: requestId });
  if (r.ok) revalidatePath("/decision-lead");
  return r;
}
export async function issue(requestId: string, type: "accept" | "reject", reason: string) {
  const r = await rpc("dec_issue", { _request_id: requestId, _type: type, _reason: reason || null });
  if (r.ok) revalAll();
  return r;
}
