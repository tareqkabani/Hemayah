// جلب بيانات بوابة الفرز (خادمياً تحت RLS): دور المستخدم يحسم إعداد البوابة
// (موظف فرز يقرّر / قيادة viewOnly)، والسجلّ الكامل عبر خريطة register المشتركة.
import { createServerClient, GATEWAY_URL } from "@hemaya/supabase";
import { redirect } from "next/navigation";
import { fetchRegister } from "./register";

// أحدث المراسلات المحمَّلة ابتداءً؛ الخيوط الأقدم تُفتح عند الحاجة من الخيط نفسه.
const MESSAGES_LIMIT = 500;

export async function getTriageData() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(GATEWAY_URL);

  const [rolesQ, register, prefsQ, readsQ, msgsQ] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    fetchRegister(supabase),
    supabase.from("user_prefs").select("prefs").eq("user_id", user.id).maybeSingle(),
    supabase.from("notification_reads").select("notif_key").eq("user_id", user.id),
    // حدٌّ صريح: بلا سقفٍ تُجلب مراسلات كل القضايا المرئية للموظف دفعةً واحدة
    supabase
      .from("messages")
      .select("id, case_id, thread, direction, body, sender_label, created_at")
      .in("thread", ["center", "coord"])
      .order("created_at", { ascending: false })
      .limit(MESSAGES_LIMIT),
  ]);

  const roles = (rolesQ.data ?? []).map((r) => r.role as string);
  const roleKey = roles.includes("deputy_chair") || roles.includes("board_chair") ? "triage-lead" : "triage";

  return {
    roleKey,
    me: {
      id: user.id,
      name: String((user.user_metadata as Record<string, unknown>)?.name ?? "—"),
    },
    initialRows: register.rows,
    registerTotal: register.totalCount,
    registerTruncated: register.truncated,
    prefs: (prefsQ.data?.prefs ?? {}) as Record<string, unknown>,
    initialReadKeys: (readsQ.data ?? []).map((r) => r.notif_key as string),
    // أُعيد ترتيبها تصاعدياً للعرض بعد جلب الأحدث تنازلياً بالحدّ
    initialMessages: (msgsQ.data ?? []).slice().reverse(),
  };
}
