"use server";
import { createServerClient } from "@hemaya/supabase";
import type { Json, ReferralAuthority, ReferralStatus } from "@hemaya/supabase";
import { getCenterReferrals } from "./referrals-data";

// إعادة جلب كل الإحالات من الخادم (تُستدعى عند كل حدث Realtime لإعادة hydrate).
// إعادة الجلب تحترم RLS تلقائيّاً (referral_center_read) وتتجنّب أخطاء تطبيق الدلتا.
export async function refetchCenterReferrals() {
  return getCenterReferrals();
}

// إصدار إحالة م14 من المركز → الجهة المنفّذة عبر RPC المفروض
// (case_officer حصراً + قضية نشطة + لا ازدواج + تدقيق).
export async function referralCreate(
  secret: string,
  service: string,
  authority: string,
  summary: string,
) {
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("referral_create", {
    _secret: secret,
    _service: service,
    _authority: authority as ReferralAuthority,
    _summary: summary,
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, row: data };
}

// إقفال الإحالة بعد اعتماد الجهة (done → closed) — دورة «متابعة التنفيذ».
export async function referralClose(id: string, note: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("referral_close", { _id: id, _note: note });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, row: data };
}

// تحديث إحالة القسم القانوني الداخليّ عبر RPC المفروض (المركز سلطة legal).
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
