// جلب بيانات البوابة (خادمياً تحت RLS) — المهام عبر RPC معزول بالمؤلّف،
// والإشعارات/الخيوط/التفضيلات صفوف المستخدم نفسه فقط.
import { createServerClient, GATEWAY_URL } from "@hemaya/supabase";
import { redirect } from "next/navigation";

export async function getPortalData(role: "studier" | "evaluator") {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(GATEWAY_URL);

  const tasksRpc = role === "studier" ? "my_study_tasks" : "my_assessment_tasks";
  const [tasksQ, notifsQ, threadsQ, prefsQ, roleQ] = await Promise.all([
    supabase.rpc(tasksRpc),
    supabase
      .from("notifications")
      .select("id, case_id, type, title, body, target_tab, read, crit, created_at")
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("leadership_messages")
      .select("id, case_id, leader, direction, body, read_at, created_at")
      .order("created_at", { ascending: true }),
    supabase.from("user_prefs").select("prefs").eq("user_id", user.id).maybeSingle(),
    supabase.from("user_roles").select("attributes").eq("user_id", user.id).eq("role", role).maybeSingle(),
  ]);

  const tasks = tasksQ.data ?? [];

  // تفاصيل النموذج (الطلب + توصية الجهة) للحالات المُسنَدة — سياسات «المُسنَد إليه» تحكمها
  const caseIds = tasks.map((t) => t.case_id);
  const details: Record<string, unknown> = {};
  if (caseIds.length) {
    const [reqs, recs] = await Promise.all([
      supabase
        .from("protection_requests")
        .select("case_id, applicant_role, channel, details, submitted_at")
        .in("case_id", caseIds),
      supabase
        .from("recommendations")
        .select("case_id, source_body, decision, proposed_type, proposed_duration, factors9, notes, received_at")
        .in("case_id", caseIds),
    ]);
    for (const id of caseIds) {
      details[id] = {
        request: reqs.data?.find((r) => r.case_id === id) ?? null,
        recommendation: recs.data?.find((r) => r.case_id === id) ?? null,
      };
    }
  }

  const attrs = (roleQ.data?.attributes ?? {}) as Record<string, unknown>;
  return {
    me: {
      id: user.id,
      name: String((user.user_metadata as Record<string, unknown>)?.name ?? "—"),
      emp: (attrs.emp as string) ?? null,
    },
    initial: {
      tasks,
      notifications: notifsQ.data ?? [],
      threads: threadsQ.data ?? [],
      prefs: (prefsQ.data?.prefs ?? {}) as Record<string, unknown>,
      details,
    },
  };
}
