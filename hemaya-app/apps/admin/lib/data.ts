// جلب بيانات بوابة مدير النظام (خادمياً تحت RLS — دور sysadmin تكفّله القشرة).
// لا PII هنا بطبيعة الجداول: محتوى المنصّة وطلبات التعديل فقط (sysadmin_no_pii).
import { createServerClient, GATEWAY_URL } from "@hemaya/supabase";
import { redirect } from "next/navigation";

export type AdminListRow = {
  list_key: string;
  title: string;
  domain: string;
  legal_ref: string | null;
  icon: string | null;
  scope: string[] | null;
  locked: boolean;
};

export type AdminItemRow = {
  id: string;
  list_key: string;
  item_key: string;
  label: string;
  label_short: string | null;
  sort_order: number;
  active: boolean;
  meta: Record<string, unknown>;
};

export async function getAdminData() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(GATEWAY_URL);

  // RPCs الدفعة الثانية أُنشئت بعد توليد الأنواع — يُعاد التوليد مع دمج السلسلة.
  // (bind إلزامي: استخراج الدالة بلا ربطٍ يفقدها this فتنهار على rest)
  const rpc = (supabase.rpc as CallableFunction).bind(supabase);
  const [listsQ, itemsQ, notifsQ, sysQ, legalsQ, ccrQ, settingsQ, auditQ, healthQ, staffQ, orgQ] = await Promise.all([
    supabase.from("reference_lists").select("*").order("list_key"),
    supabase.from("reference_items").select("*").order("sort_order"),
    supabase.from("notification_templates").select("*").order("category"),
    supabase.from("system_messages").select("*").order("message_key"),
    supabase.from("legal_texts").select("*").order("text_key"),
    supabase
      .from("content_change_requests")
      .select("id, target_kind, target_key, status, requested_at, note")
      .order("requested_at", { ascending: false })
      .limit(50),
    rpc("admin_get_settings"),
    rpc("admin_tech_audit", { _limit: 200 }),
    rpc("admin_system_health"),
    rpc("admin_list_staff"),
    rpc("admin_list_org"),
  ]);

  // بنود كل قائمة بمفتاحها — الموقوف يُعرض موقوفاً لا يُحذف
  const itemsByList: Record<string, AdminItemRow[]> = {};
  for (const it of (itemsQ.data ?? []) as AdminItemRow[]) {
    (itemsByList[it.list_key] ??= []).push(it);
  }

  const meta = user.user_metadata ?? {};
  return {
    me: { name: (meta.name as string) || "مدير النظام", uid: user.id },
    lists: (listsQ.data ?? []) as AdminListRow[],
    itemsByList,
    templates: notifsQ.data ?? [],
    sysMessages: sysQ.data ?? [],
    legalTexts: legalsQ.data ?? [],
    changeRequests: ccrQ.data ?? [],
    settings: (settingsQ as { data: { key: string; value: string }[] | null }).data ?? [],
    techAudit: (auditQ as { data: unknown[] | null }).data ?? [],
    health: (healthQ as { data: Record<string, unknown> | null }).data ?? {},
    staff: (staffQ as { data: unknown[] | null }).data ?? [],
    org: (orgQ as { data: unknown[] | null }).data ?? [],
  };
}
