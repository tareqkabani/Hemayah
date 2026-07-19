// جلب بيانات بوابة الفرز (خادمياً تحت RLS): دور المستخدم يحسم إعداد البوابة
// (موظف فرز يقرّر / قيادة viewOnly)، والسجلّ الكامل عبر خريطة register المشتركة.
import { createServerClient, GATEWAY_URL } from "@hemaya/supabase";
import { redirect } from "next/navigation";
import { fetchRegister } from "./register";

export async function getTriageData() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(GATEWAY_URL);

  const [rolesQ, initialRows, prefsQ, readsQ, msgsQ] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    fetchRegister(supabase),
    supabase.from("user_prefs").select("prefs").eq("user_id", user.id).maybeSingle(),
    supabase.from("notification_reads").select("notif_key").eq("user_id", user.id),
    supabase
      .from("messages")
      .select("id, case_id, thread, direction, body, sender_label, created_at")
      .in("thread", ["center", "coord"])
      .order("created_at", { ascending: true }),
  ]);

  const roles = (rolesQ.data ?? []).map((r) => r.role as string);
  const roleKey = roles.includes("deputy_chair") || roles.includes("board_chair") ? "triage-lead" : "triage";

  return {
    roleKey,
    me: {
      id: user.id,
      name: String((user.user_metadata as Record<string, unknown>)?.name ?? "—"),
    },
    initialRows,
    prefs: (prefsQ.data?.prefs ?? {}) as Record<string, unknown>,
    initialReadKeys: (readsQ.data ?? []).map((r) => r.notif_key as string),
    initialMessages: msgsQ.data ?? [],
  };
}
