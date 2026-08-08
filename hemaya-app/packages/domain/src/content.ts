// ============================================================
//  طبقة قراءة محتوى المنصّة (تسليم 7 أغسطس — الأمر 2)
//  reference_items · notification_templates · system_messages · legal_texts
//  مصدر القيم بعد اليوم هو القاعدة (تديرها بوابة مدير النظام) لا الثوابت
//  المضمّنة في الكود. المخزَّن في جداول الأعمال هو item_key — النص للعرض.
//  cache قصيرة الأمد على مستوى الوحدة (تُبطَل بـ invalidateContent أو
//  بانقضاء المهلة) — مقبولة بنص الحزمة، والتعديل من الأدمن يسري خلالها.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@hemaya/supabase";

type Tables = Database["public"]["Tables"];
export type NotificationTemplate = Tables["notification_templates"]["Row"];
export type SystemMessage = Tables["system_messages"]["Row"];
export type LegalText = Tables["legal_texts"]["Row"];

/** أي عميل Supabase مُنمَّط بمخططنا — خادمياً كان أو متصفحياً. */
export type ContentClient = SupabaseClient<Database>;

/** بند قائمة كما تستهلكه الواجهات: المفتاح يُخزَّن والنص يُعرَض. */
export interface RefItem {
  key: string;
  label: string;
  short: string | null;
  meta: Record<string, unknown>;
}

const TTL_MS = 60_000;
const cache = new Map<string, { at: number; data: unknown }>();

function hit<T>(key: string): T | undefined {
  const c = cache.get(key);
  if (!c) return undefined;
  if (Date.now() - c.at > TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return c.data as T;
}

/** إبطال الذاكرة المؤقتة — يُستدعى بعد أي تعديل محتوى من بوابة الأدمن. */
export function invalidateContent(): void {
  cache.clear();
}

function toItem(r: { item_key: string; label: string; label_short: string | null; meta: unknown }): RefItem {
  return { key: r.item_key, label: r.label, short: r.label_short, meta: (r.meta ?? {}) as Record<string, unknown> };
}

/** بنود قائمة مرجعية واحدة — الفعّالة فقط، بترتيبها المعتمد. */
export async function getList(sb: ContentClient, listKey: string): Promise<RefItem[]> {
  const ck = `list:${listKey}`;
  const cached = hit<RefItem[]>(ck);
  if (cached) return cached;
  const { data, error } = await sb
    .from("reference_items")
    .select("item_key,label,label_short,meta")
    .eq("list_key", listKey)
    .eq("active", true)
    .order("sort_order");
  if (error) throw new Error(`getList(${listKey}): ${error.message}`);
  const items = (data ?? []).map(toItem);
  cache.set(ck, { at: Date.now(), data: items });
  return items;
}

/** عدّة قوائم برحلة واحدة إلى القاعدة — ما كان منها في الذاكرة لا يُطلب ثانية. */
export async function getLists(sb: ContentClient, listKeys: string[]): Promise<Record<string, RefItem[]>> {
  const out: Record<string, RefItem[]> = {};
  const missing: string[] = [];
  for (const k of listKeys) {
    const cached = hit<RefItem[]>(`list:${k}`);
    if (cached) out[k] = cached;
    else missing.push(k);
  }
  if (missing.length) {
    const { data, error } = await sb
      .from("reference_items")
      .select("list_key,item_key,label,label_short,meta")
      .in("list_key", missing)
      .eq("active", true)
      .order("sort_order");
    if (error) throw new Error(`getLists(${missing.join(",")}): ${error.message}`);
    for (const k of missing) out[k] = [];
    for (const r of data ?? []) out[r.list_key].push(toItem(r));
    for (const k of missing) cache.set(`list:${k}`, { at: Date.now(), data: out[k] });
  }
  return out;
}

/**
 * نصّ العرض لقيمة مخزّنة: إن كانت مفتاحاً فنصّه، وإلا فالقيمة ذاتها —
 * فالسجلات السابقة على التحويل تحمل النص العربي لا المفتاح.
 */
export function labelOf(items: RefItem[], value: string | null | undefined): string {
  if (!value) return "—";
  return items.find((i) => i.key === value)?.label ?? value;
}

/** قالب إشعار بمفتاحه — null إن لم يوجد أو كان موقوفاً. */
export async function getTemplate(sb: ContentClient, templateKey: string): Promise<NotificationTemplate | null> {
  const ck = `tpl:${templateKey}`;
  const cached = hit<NotificationTemplate | null>(ck);
  if (cached !== undefined) return cached;
  const { data, error } = await sb
    .from("notification_templates")
    .select("*")
    .eq("template_key", templateKey)
    .eq("active", true)
    .maybeSingle();
  if (error) throw new Error(`getTemplate(${templateKey}): ${error.message}`);
  cache.set(ck, { at: Date.now(), data: data ?? null });
  return data ?? null;
}

/** لافتة منع/تحقّق بمفتاحها — النص فقط؛ شرط المنع يبقى في منطق التطبيق. */
export async function getSystemMessage(sb: ContentClient, messageKey: string): Promise<SystemMessage | null> {
  const ck = `sys:${messageKey}`;
  const cached = hit<SystemMessage | null>(ck);
  if (cached !== undefined) return cached;
  const { data, error } = await sb
    .from("system_messages")
    .select("*")
    .eq("message_key", messageKey)
    .eq("active", true)
    .maybeSingle();
  if (error) throw new Error(`getSystemMessage(${messageKey}): ${error.message}`);
  cache.set(ck, { at: Date.now(), data: data ?? null });
  return data ?? null;
}

/** نصّ نظامي/إقرار بمفتاحه. */
export async function getLegalText(sb: ContentClient, textKey: string): Promise<LegalText | null> {
  const ck = `legal:${textKey}`;
  const cached = hit<LegalText | null>(ck);
  if (cached !== undefined) return cached;
  const { data, error } = await sb
    .from("legal_texts")
    .select("*")
    .eq("text_key", textKey)
    .eq("active", true)
    .maybeSingle();
  if (error) throw new Error(`getLegalText(${textKey}): ${error.message}`);
  cache.set(ck, { at: Date.now(), data: data ?? null });
  return data ?? null;
}
