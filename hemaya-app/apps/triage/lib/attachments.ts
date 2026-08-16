"use server";
/* مرفقات الطلب في شاشة الفرز — قراءةٌ مقيَّدة بالدور والإسناد، ورابطٌ
   موقَّتٌ يُطلب عند النقر لا عند العرض. الرابط يُوقَّع بجلسة المستخدم
   نفسه (سياسة intakedocs_read) فلا يُستدعى مفتاح الخدمة. */
import { createServerClient } from "@hemaya/supabase";

export type CaseFile = { id: string; name: string; path: string; mime: string; size: number };

export async function caseAttachments(caseId: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("intake_case_attachments", { _case_id: caseId });
  if (error) return { ok: false as const, error: error.message, rows: [] as CaseFile[] };
  const rows: CaseFile[] = (data || []).map((r) => ({
    id: r.id as string,
    name: r.file_name as string,
    path: r.path as string,
    mime: (r.mime as string) || "",
    size: Number(r.size_bytes ?? 0),
  }));
  return { ok: true as const, rows };
}

/** رابطٌ موقَّت للمرفق — يُفحص انتماؤه للقضية أوّلاً، فلا يُوقَّع مسارٌ دخيل. */
export async function attachmentUrl(caseId: string, path: string, seconds = 120) {
  const allowed = await caseAttachments(caseId);
  if (!allowed.ok) return { ok: false as const, error: allowed.error };
  if (!allowed.rows.some((r) => r.path === path)) {
    return { ok: false as const, error: "المرفق ليس من هذه القضية." };
  }
  const supabase = createServerClient();
  const { data, error } = await supabase.storage.from("intake-docs").createSignedUrl(path, seconds);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, url: data.signedUrl };
}
