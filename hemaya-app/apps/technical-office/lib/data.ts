// جلب بيانات بوابة المكتب الفني (خادمياً تحت RLS): الدور يحسم الإعداد
// (مستشار يقرّر مستقلّاً / مدير يعتمد)، والسجلّ عبر خريطة grievances المشتركة.
import { createServerClient, GATEWAY_URL } from "@hemaya/supabase";
import { redirect } from "next/navigation";
import { fetchGrievances } from "./grievances";

export async function getTechData() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(GATEWAY_URL);

  const [rolesQ, initialRows, prefsQ, notifsQ, readsQ, officeMsgsQ, caseMsgsQ, advisorsQ] = await Promise.all([
    supabase.from("user_roles").select("role, attributes").eq("user_id", user.id),
    fetchGrievances(supabase),
    supabase.from("user_prefs").select("prefs").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("notifications")
      .select("id, case_id, type, title, body, target_tab, crit, read, sent_at, created_at")
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false })
      .limit(120),
    supabase.from("notification_reads").select("notif_key").eq("user_id", user.id),
    supabase
      .from("office_messages")
      .select("id, grievance_id, channel, author_id, author_label, body, created_at")
      .order("created_at", { ascending: true }),
    supabase
      .from("messages")
      .select("id, case_id, thread, direction, body, sender_label, created_at")
      .eq("thread", "center")
      .order("created_at", { ascending: true }),
    supabase.rpc("tech_office_advisors"),
  ]);

  const roles = (rolesQ.data ?? []).map((r) => r.role as string);
  const roleKey = roles.includes("tech_manager") ? "tech-head" : "tech-advisor";
  const advisorRow = (rolesQ.data ?? []).find((r) => (r.role as string) === "advisor");
  const mySpec = String(((advisorRow?.attributes ?? {}) as Record<string, unknown>).spec ?? "");

  return {
    roleKey,
    mySpec,
    me: {
      id: user.id,
      name: String((user.user_metadata as Record<string, unknown>)?.name ?? "—"),
    },
    initialRows,
    prefs: (prefsQ.data?.prefs ?? {}) as Record<string, unknown>,
    initialNotifs: notifsQ.data ?? [],
    initialReadKeys: (readsQ.data ?? []).map((r) => r.notif_key as string),
    initialOfficeMsgs: officeMsgsQ.data ?? [],
    initialCaseMsgs: caseMsgsQ.data ?? [],
    advisors: (advisorsQ.data ?? []) as { user_id: string; name: string; spec: string; open_load: number; decided: number }[],
  };
}
