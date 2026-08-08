"use server";
// أفعال بوابة مدير النظام — كلها بعميل جلسة المستخدم: RLS هي الحارس
// (كتابة sysadmin على غير المقفل؛ المقفل والنصوص النظامية عبر طلب تعديل
// يعتمده رئيس المركز). كل كتابة تُسجَّل في audit_log بمحفّزات القاعدة.
import { createServerClient } from "@hemaya/supabase";
import { invalidateContent } from "@hemaya/domain";
import { revalidatePath } from "next/cache";

type R = { ok: true } | { ok: false; error: string };
const fail = (m: string): R => ({ ok: false, error: m });

function done(): R {
  invalidateContent();
  revalidatePath("/");
  return { ok: true };
}

/** تعديل نصّ بند (قائمة غير مقفلة) — المفتاح ثابت لا يُمسّ. */
export async function updateItemLabel(listKey: string, itemKey: string, label: string): Promise<R> {
  if (!label.trim()) return fail("النص مطلوب.");
  const sb = createServerClient();
  const { data, error } = await sb
    .from("reference_items")
    .update({ label: label.trim() })
    .eq("list_key", listKey)
    .eq("item_key", itemKey)
    .select("id");
  if (error) return fail(error.message);
  // درس «وهم القياس»: صفر صفوف = محجوب بالسياسة (قائمة مقفلة أو مفتاح خطأ)
  if (!data?.length) return fail("لم يُعدَّل شيء — القائمة مقفلة أو البند غير موجود.");
  return done();
}

/** إعادة ترتيب بنود قائمة غير مقفلة — sort_order من موضعها في المصفوفة. */
export async function saveItemOrder(listKey: string, orderedKeys: string[]): Promise<R> {
  const sb = createServerClient();
  for (let i = 0; i < orderedKeys.length; i++) {
    const { data, error } = await sb
      .from("reference_items")
      .update({ sort_order: i + 1 })
      .eq("list_key", listKey)
      .eq("item_key", orderedKeys[i])
      .select("id");
    if (error) return fail(error.message);
    if (!data?.length) return fail("تعذّر الترتيب — القائمة مقفلة.");
  }
  return done();
}

/** إيقاف/تفعيل بند — لا حذف (سلامة السجلات التاريخية). */
export async function setItemActive(listKey: string, itemKey: string, active: boolean): Promise<R> {
  const sb = createServerClient();
  const { data, error } = await sb
    .from("reference_items")
    .update({ active })
    .eq("list_key", listKey)
    .eq("item_key", itemKey)
    .select("id");
  if (error) return fail(error.message);
  if (!data?.length) return fail("لم يُعدَّل شيء — القائمة مقفلة أو البند غير موجود.");
  return done();
}

/** إضافة بند بمفتاح مولَّد ثابت <list>_NN — لا تُخترع مفاتيح يدوياً. */
export async function addItem(listKey: string, label: string): Promise<R & { key?: string }> {
  if (!label.trim()) return fail("النص مطلوب.");
  const sb = createServerClient();
  const { data: existing, error: qErr } = await sb
    .from("reference_items")
    .select("item_key, sort_order")
    .eq("list_key", listKey);
  if (qErr) return fail(qErr.message);
  const keys = new Set((existing ?? []).map((r) => r.item_key));
  let n = (existing ?? []).length;
  let key: string;
  do {
    n += 1;
    key = `${listKey}_${String(n).padStart(2, "0")}`;
  } while (keys.has(key));
  const maxSort = Math.max(0, ...(existing ?? []).map((r) => r.sort_order ?? 0));
  const { error } = await sb
    .from("reference_items")
    .insert({ list_key: listKey, item_key: key, label: label.trim(), sort_order: maxSort + 1 });
  if (error)
    return fail(error.code === "42501" ? "القائمة مقفلة — الإضافة تمرّ بطلب تعديل يعتمده رئيس المركز." : error.message);
  const r = done();
  return r.ok ? { ok: true, key } : r;
}

/** رفع تعديل محتوى مقفل (قائمة مقفلة / نص نظامي) لاعتماد رئيس المركز. */
export async function submitChangeRequest(
  targetKind: "reference_list" | "notification" | "system_message" | "legal_text",
  targetKey: string,
  payload: unknown,
  note?: string
): Promise<R> {
  const sb = createServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return fail("جلسة منتهية.");
  const { error } = await sb.from("content_change_requests").insert({
    target_kind: targetKind,
    target_key: targetKey,
    payload: payload as never,
    requested_by: user.id,
    note: note ?? null,
  });
  if (error) return fail(error.message);
  return done();
}

/** حفظ نصّ قالب إشعار — المتغيّرات تُشتقّ هنا وتُخزَّن للتحقق قبل الإرسال. */
export async function saveTemplate(
  templateKey: string,
  input: { subject: string; body: string; channels: string[] }
): Promise<R> {
  if (!input.subject.trim() || !input.body.trim()) return fail("العنوان والمتن مطلوبان.");
  const vars = Array.from(new Set(`${input.subject} ${input.body}`.match(/\{[^}]+\}/g) ?? [])).map((v) =>
    v.slice(1, -1)
  );
  const sb = createServerClient();
  const { data, error } = await sb
    .from("notification_templates")
    .update({ subject: input.subject.trim(), body: input.body.trim(), channels: input.channels, variables: vars, updated_at: new Date().toISOString() })
    .eq("template_key", templateKey)
    .select("template_key");
  if (error) return fail(error.message);
  if (!data?.length) return fail("القالب غير موجود أو الكتابة محجوبة.");
  return done();
}

/** تفعيل/إيقاف قالب إشعار. */
export async function setTemplateActive(templateKey: string, active: boolean): Promise<R> {
  const sb = createServerClient();
  const { data, error } = await sb
    .from("notification_templates")
    .update({ active })
    .eq("template_key", templateKey)
    .select("template_key");
  if (error) return fail(error.message);
  if (!data?.length) return fail("القالب غير موجود أو الكتابة محجوبة.");
  return done();
}

/** منح دور منسوب — لا subject ولا الحساب الذاتي (تفرضه القاعدة). */
export async function grantRole(userId: string, role: string, attrs?: Record<string, unknown>): Promise<R> {
  const sb = createServerClient();
  const { error } = await (sb.rpc as CallableFunction)("admin_grant_role", { _user: userId, _role: role, _attrs: attrs ?? null });
  if (error) return fail((error as { message: string }).message);
  revalidatePath("/");
  return { ok: true };
}

/** سحب دور منسوب. */
export async function revokeRole(userId: string, role: string): Promise<R> {
  const sb = createServerClient();
  const { error } = await (sb.rpc as CallableFunction)("admin_revoke_role", { _user: userId, _role: role });
  if (error) return fail((error as { message: string }).message);
  revalidatePath("/");
  return { ok: true };
}

/** إضافة فرع محافظة تحت وحدة منطقة — باب القائمة الرسمية للجهات المناطقية. */
export async function addBranchUnit(parentId: string, city: string, name?: string): Promise<R & { id?: string }> {
  const sb = createServerClient();
  const { data, error } = await (sb.rpc as CallableFunction)("admin_add_branch_unit", {
    _parent: parentId, _city: city, _name: name ?? null,
  });
  if (error) return fail((error as { message: string }).message);
  revalidatePath("/");
  return { ok: true, id: data as string };
}

/** تعديل وحدة: الاسم / نقطة الاستقبال / الإيقاف (لا حذف). */
export async function updateUnit(id: string, patch: { name?: string; intake?: boolean; active?: boolean }): Promise<R> {
  const sb = createServerClient();
  const { error } = await (sb.rpc as CallableFunction)("admin_update_unit", {
    _id: id, _name: patch.name ?? null, _intake: patch.intake ?? null, _active: patch.active ?? null,
  });
  if (error) return fail((error as { message: string }).message);
  revalidatePath("/");
  return { ok: true };
}

/** ضبط مفتاح تشغيل (الإعدادات وأعلام الميزات) — عبر RPC محروسة ومؤثَّرة. */
export async function setSetting(key: string, value: string): Promise<R> {
  const sb = createServerClient();
  const { error } = await (sb.rpc as CallableFunction)("admin_set_setting", { _key: key, _value: value });
  if (error) return fail((error as { message: string }).message);
  revalidatePath("/");
  return { ok: true };
}

/** حفظ لافتة نظام (النصّ والدرجة) — شرط المنع نفسه يبقى في منطق التطبيق. */
export async function saveSystemMessage(
  messageKey: string,
  input: { body: string; tone: "error" | "warning" | "info" | "success" }
): Promise<R> {
  if (!input.body.trim()) return fail("النص مطلوب.");
  const sb = createServerClient();
  const { data, error } = await sb
    .from("system_messages")
    .update({ body: input.body.trim(), tone: input.tone, updated_at: new Date().toISOString() })
    .eq("message_key", messageKey)
    .select("message_key");
  if (error) return fail(error.message);
  if (!data?.length) return fail("الرسالة غير موجودة أو الكتابة محجوبة.");
  return done();
}
