"use server";
// إجراءات المكتب الفني — كلّها عبر RPCs الآمنة (SECURITY DEFINER):
// آلة الحالة والعزل والتدقيق تُفرَض في القاعدة لا في الواجهة.
import { revalidatePath } from "next/cache";
import { createServerClient } from "@hemaya/supabase";

export async function advisorDecide(
  grievanceId: string,
  decision: "support" | "reject_grievance",
  types: string[],
  reason: string,
) {
  const supabase = createServerClient();
  const { error } = await supabase.rpc("advisor_decide_grievance", {
    _grievance_id: grievanceId, _decision: decision, _types: types, _reason: reason,
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/");
  return { ok: true as const };
}

export async function officeAdopt(
  grievanceId: string,
  outcome: "accept" | "reject",
  types: string[],
  reason: string,
) {
  const supabase = createServerClient();
  const { error } = await supabase.rpc("office_adopt_grievance", {
    _grievance_id: grievanceId, _outcome: outcome, _types: types, _reason: reason,
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/");
  return { ok: true as const };
}

export async function officeReturn(grievanceId: string, note: string) {
  const supabase = createServerClient();
  const { error } = await supabase.rpc("office_return_grievance", {
    _grievance_id: grievanceId, _note: note,
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/");
  return { ok: true as const };
}

export async function sendOfficeMessage(grievanceId: string, channel: "head" | "center" | "ag", body: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("send_office_message", {
    _grievance_id: grievanceId, _channel: channel, _body: body,
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, id: data as string };
}
