"use server";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@hemaya/supabase";

export async function addContactLog(caseId: string, channel: string, result: string, summary: string) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("contact_logs").insert({
    case_id: caseId, officer_id: user?.id, channel,
    result: result === "noanswer" ? "noanswer" : "answered",
    summary: summary.trim() || "—",
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/triage");
  return { ok: true as const };
}

export async function triageDecide(
  caseId: string, decision: "study" | "refer" | "close",
  reason: string, formalCheck: Record<string, boolean>, authority?: string,
) {
  const supabase = createServerClient();
  const { error, data } = await supabase.rpc("triage_decide", {
    _case_id: caseId, _decision: decision, _reason: (reason || null) as string, // الدالة تقبل NULL فعلياً
    _formal_check: formalCheck, _authority: authority || undefined,
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/triage");
  const row = Array.isArray(data) ? data[0] : data;
  return { ok: true as const, status: row?.status };
}
