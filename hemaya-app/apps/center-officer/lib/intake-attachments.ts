"use server";
/* ============================================================
   مرفقات الإدخال اليدوي — تقييدُ المرفوع وقراءتُه.

   الملف نفسه يُرفع من المتصفح مباشرةً إلى دلو intake-docs تحت سياسات
   التخزين (فلا يمرّ بخادم التطبيق)، وهذه الإجراءات تقيّد سجلّه وتقرؤه
   عبر دوالّ تحرس الدور والإسناد.
   ============================================================ */
import { createServerClient } from "@hemaya/supabase";

export async function recordAttachment(
  path: string, fileName: string, mime: string, size: number, regNo: string,
) {
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("intake_attach_record", {
    _path: path, _file_name: fileName, _mime: mime || null as unknown as string,
    _size: size, _reg_no: regNo,
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, id: data as unknown as string };
}

export async function removeAttachment(id: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("intake_attach_remove", { _id: id });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, path: data as unknown as string };
}

export type CaseAttachment = {
  id: string; name: string; path: string; mime: string; size: number; at: string;
};

/** مرفقات قضيةٍ لمن يحقّ له (منسوب الوحدة · موظف الفرز · المُسنَد للدراسة/التقييم). */
export async function listCaseAttachments(caseId: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("intake_case_attachments", { _case_id: caseId });
  if (error) return { ok: false as const, error: error.message, rows: [] as CaseAttachment[] };
  const rows: CaseAttachment[] = (data || []).map((r) => ({
    id: r.id as string,
    name: r.file_name as string,
    path: r.path as string,
    mime: (r.mime as string) || "",
    size: Number(r.size_bytes ?? 0),
    at: String(r.created_at ?? ""),
  }));
  return { ok: true as const, rows };
}

/** رابطٌ موقَّت لفتح المرفق — يُطلب عند النقر لا عند العرض، وينتهي بمُدّته.
 *  الصلاحية تُفحص أوّلاً بدالّة القراءة المقيَّدة: لا رابط لمن لا يحقّ له. */
export async function attachmentUrl(caseId: string, path: string, seconds = 120) {
  const supabase = createServerClient();
  const allowed = await listCaseAttachments(caseId);
  if (!allowed.ok) return { ok: false as const, error: allowed.error };
  if (!allowed.rows.some((r) => r.path === path)) {
    return { ok: false as const, error: "المرفق ليس من هذه القضية." };
  }
  const { data, error } = await supabase.storage
    .from("intake-docs")
    .createSignedUrl(path, seconds);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, url: data.signedUrl };
}
