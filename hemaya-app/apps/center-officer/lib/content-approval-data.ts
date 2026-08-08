// طلبات تعديل المحتوى المقفل المعلّقة — لبتّ رئيس المركز (RLS: ccr_read).
// لكل طلبٍ تُجلب الحالة الراهنة للهدف ليُعرض «قبل/بعد» أمانةً.
import { createServerClient } from "@hemaya/supabase";

export type ContentChange = {
  id: string;
  target_kind: "reference_list" | "notification" | "system_message" | "legal_text";
  target_key: string;
  payload: Record<string, unknown>;
  requested_at: string;
  note: string | null;
  targetTitle: string;
  before: Record<string, unknown>;
};

const KIND_TABLE = {
  reference_list: { table: "reference_lists", key: "list_key", title: "title" },
  notification: { table: "notification_templates", key: "template_key", title: "title" },
  system_message: { table: "system_messages", key: "message_key", title: "title" },
  legal_text: { table: "legal_texts", key: "text_key", title: "title" },
} as const;

export async function getPendingContentChanges(): Promise<ContentChange[]> {
  const sb = createServerClient();
  const { data: ccrs } = await sb
    .from("content_change_requests")
    .select("id, target_kind, target_key, payload, requested_at, note, status")
    .eq("status", "pending")
    .order("requested_at", { ascending: true });

  const out: ContentChange[] = [];
  for (const c of ccrs ?? []) {
    const kind = c.target_kind as ContentChange["target_kind"];
    const spec = KIND_TABLE[kind];
    if (!spec) continue;
    // جدول الهدف يُحلّ ديناميكياً بحسب النوع — التنميط الاتحادي يضيق هنا فيُوسَّع قصداً
    const { data: target } = await (sb.from(spec.table) as ReturnType<typeof sb.from>)
      .select("*")
      .eq(spec.key as string, c.target_key)
      .maybeSingle();

    let before: Record<string, unknown> = (target as Record<string, unknown>) ?? {};
    if (kind === "reference_list") {
      const { data: items } = await sb
        .from("reference_items")
        .select("item_key, label, active, sort_order")
        .eq("list_key", c.target_key)
        .order("sort_order");
      before = { ...before, items: items ?? [] };
    }

    out.push({
      id: c.id,
      target_kind: kind,
      target_key: c.target_key,
      payload: (c.payload ?? {}) as Record<string, unknown>,
      requested_at: c.requested_at ?? new Date().toISOString(),
      note: c.note,
      targetTitle: ((target as Record<string, unknown>)?.[spec.title] as string) ?? c.target_key,
      before,
    });
  }
  return out;
}
