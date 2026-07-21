"use server";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@hemaya/supabase";

// ── أفعال مرحلة القرار (CO-3، تحديث 15 يوليو) — تستدعي RPCs آلة الحالة ──
// preparing → pending_deputy → approved → voting → issued
// كلّها SECURITY DEFINER تفرض الدور والحالة في القاعدة؛ الواجهة لا تملك تجاوزها.

async function rpc(name: string, args: Record<string, unknown>) {
  const supabase = createServerClient();
  // دوال هذه الدورة ليست بعد في types.gen — استدعاء ديناميكي مقصود
  const { data, error } = await (supabase.rpc as (n: string, a: Record<string, unknown>) => ReturnType<typeof supabase.rpc>)(name, args);
  if (error) return { ok: false as const, error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  return { ok: true as const, row };
}

const revalAll = () => { revalidatePath("/decision"); revalidatePath("/decision-vote"); revalidatePath("/decision-lead"); };

/** المعدّ: حفظ مسوّدة القرار (أنواع م14 + المدة + الحيثيات). */
export async function saveDecision(caseId: string, types: string[], duration: string, reasoning: string) {
  const r = await rpc("council_save", { _case_id: caseId, _types: types, _duration: duration || null, _reasoning: reasoning || null });
  if (r.ok) revalidatePath("/decision");
  return r;
}

/** المعدّ: رفع القرار لاعتماد نائب رئيس المركز. */
export async function submitForApproval(caseId: string, types: string[], duration: string, reasoning: string) {
  const r = await rpc("council_submit", { _case_id: caseId, _types: types, _duration: duration || null, _reasoning: reasoning });
  if (r.ok) revalAll();
  return r;
}

/** نائب رئيس المركز: اعتماد → يمرّ لحلقة اعتماد الرئيس. */
export async function approve(caseId: string) {
  const r = await rpc("council_approve", { _case_id: caseId });
  if (r.ok) revalAll();
  return r;
}

/** رئيس المركز: الحلقة الثانية — اعتماد → يعود للمعدّ للطرح. */
export async function approveChair(caseId: string) {
  const r = await rpc("council_approve_chair", { _case_id: caseId });
  if (r.ok) revalAll();
  return r;
}

/** القيادة (كلٌّ من حلقته): إعادة للمعدّ بملاحظة إلزامية. */
export async function rejectApproval(caseId: string, note: string) {
  const r = await rpc("council_return", { _case_id: caseId, _note: note });
  if (r.ok) revalAll();
  return r;
}

/** المعدّ بعد الاعتماد: طرح القرار على أعضاء المجلس للتصويت. */
export async function openVoting(caseId: string) {
  const r = await rpc("council_open_voting", { _case_id: caseId });
  if (r.ok) revalAll();
  return r;
}

/** عضو/قيادة: تصويت معزول (قبول/رفض — الرفض بتسبيب). */
export async function castVote(caseId: string, choice: "accept" | "reject", note: string) {
  const r = await rpc("council_vote", { _case_id: caseId, _choice: choice, _note: note || null });
  if (r.ok) { revalidatePath("/decision-vote"); revalidatePath("/decision-lead"); }
  return r;
}

/** القيادة: إغلاق التصويت بانتهاء يوم العمل. */
export async function closeDeadline(caseId: string) {
  const r = await rpc("council_close", { _case_id: caseId });
  if (r.ok) revalidatePath("/decision-lead");
  return r;
}

/** رئيس المركز حصراً بعد الإغلاق: إصدار (الحصيلة تُحسم في القاعدة) + إشعار الطرفين (م10). */
export async function issue(caseId: string, reason: string) {
  const r = await rpc("council_issue", { _case_id: caseId, _reason: reason || null });
  if (r.ok) revalAll();
  return r;
}

/** المعدّ: مرفق داعم اختياري (أثناء الإعداد فقط). */
export async function setAttachment(caseId: string, docId: string, group: string, label: string, fileName: string, storagePath: string | null) {
  const r = await rpc("council_set_attachment", { _case_id: caseId, _doc_id: docId, _group: group, _label: label, _file_name: fileName, _storage_path: storagePath });
  if (r.ok) revalidatePath("/decision");
  return r;
}
export async function removeAttachment(caseId: string, docId: string) {
  const r = await rpc("council_remove_attachment", { _case_id: caseId, _doc_id: docId });
  if (r.ok) revalidatePath("/decision");
  return r;
}

/** مراسلات المجلس: المعدّ/العضو يبدأ خيطه، والقيادة تردّ — مسجّلة في التدقيق. */
export async function sendCouncilMessage(caseId: string, party: "preparer" | "member", partyUid: string, withSeat: "deputy" | "chair", body: string) {
  const r = await rpc("council_send_message", { _case_id: caseId, _party: party, _party_uid: partyUid, _with_seat: withSeat, _body: body });
  if (r.ok) revalAll();
  return r;
}
