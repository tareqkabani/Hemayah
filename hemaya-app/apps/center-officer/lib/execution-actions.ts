"use server";
import { createServerClient } from "@hemaya/supabase";

// توقيع اتفاقية الحماية (م11) → تفعيل الحماية عبر RPC المفروض.
// يُستدعى من مخزن التسليم (fire-and-forget) والتحديث تفاؤليّ في الواجهة؛
// لا نستدعي revalidatePath هنا لأنه يُطلق تحديث المسار خارج سياق الإجراء فيُعطِّل العرض.
export async function signAgreement(caseId: string) {
  const supabase = createServerClient();
  const { error, data } = await supabase.rpc("sign_agreement", { _case_id: caseId });
  if (error) return { ok: false as const, error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  return { ok: true as const, status: row?.status };
}

// كشف جهة اتصال الطوارئ (م14/6) — الاسم والهاتف مشفّران في القاعدة ولا يخرجان
// إلا عبر هذا الـRPC الذي يفحص طور التنفيذ ويقيّد كلّ كشفٍ في سجلّ التدقيق (م15/16).
export async function revealEmergencyContact(caseId: string) {
  const supabase = createServerClient();
  const { error, data } = await supabase.rpc("execution_emergency_contact", { _case_id: caseId });
  if (error) return { ok: false as const, error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  return { ok: true as const, contact: row ?? null };
}
