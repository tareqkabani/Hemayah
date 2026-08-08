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

  const [listsQ, itemsQ, notifsQ, sysQ, legalsQ, ccrQ] = await Promise.all([
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
  };
}
