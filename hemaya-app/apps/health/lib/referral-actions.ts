"use server";
import { createServerClient } from "@hemaya/supabase";
import type { Json, ReferralStatus } from "@hemaya/supabase";
import { getReferrals } from "./referrals-data";

// إعادة جلب إحالات السلطة من الخادم (تُستدعى عند كل حدث Realtime لإعادة hydrate).
// إعادة الجلب تحترم RLS تلقائيّاً وتتجنّب أخطاء تطبيق الدلتا.
export async function refetchReferrals(authority = "health") {
  return getReferrals(authority);
}

// تحديث إحالة م14 عبر RPC المفروض (آلة حالة + عزل السلطة + تدقيق + إشعار المركز عند الاعتماد).
export async function referralUpdate(
  id: string,
  status: string,
  assignee: string | null,
  result: Record<string, unknown> | null,
  note: string,
) {
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("referral_update", {
    _id: id,
    _status: status as ReferralStatus,
    _assignee: assignee as string, // الدالة تقبل NULL فعلياً
    _result: result as Json,
    _note: note,
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, row: data };
}
