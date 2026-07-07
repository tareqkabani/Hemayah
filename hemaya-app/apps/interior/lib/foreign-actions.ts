"use server";
import { createServerClient } from "@hemaya/supabase";

// تسجيل الطلب الأجنبي وإحالته للمركز (م6).
export async function registerForeign(id: string, basis: string | null) {
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("register_foreign", { _id: id, _basis: basis });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, row: data };
}

// تبليغ السلطة الأجنبية بقرار النائب (approved/declined).
export async function notifyForeign(id: string, decision: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("notify_foreign", { _id: id, _decision: decision });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, row: data };
}
