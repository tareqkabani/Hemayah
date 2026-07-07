"use server";
import { createServerClient } from "@hemaya/supabase";
import { getSecurityReferrals } from "./referrals-data";

// إعادة جلب إحالات الأمنية من الخادم (تُستدعى عند كل حدث Realtime لإعادة hydrate).
export async function refetchReferrals() {
  return getSecurityReferrals();
}

// تحديث إحالة أمنية (استلام/خطوات التنفيذ/الحالة) عبر RPC المفروض.
export async function referralUpdate(
  id: string,
  status: string,
  assignee: string | null,
  result: Record<string, unknown> | null,
  note: string,
) {
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("referral_update", {
    _id: id, _status: status, _assignee: assignee, _result: result, _note: note,
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, row: data };
}

const REC_MAP: Record<string, string> = { cont: "continue", mod: "modify", close: "close" };

// رفع توصية دورة الحياة للمجلس (م18) عبر lifecycle_reviews.
export async function raiseLifecycleReview(caseId: string, recKind: string, rationale: string) {
  const supabase = createServerClient();
  const proposal = REC_MAP[recKind] || "continue";
  const { data, error } = await supabase.rpc("raise_lifecycle_review", {
    _case_id: caseId, _proposal: proposal, _rationale: rationale,
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, row: data };
}
