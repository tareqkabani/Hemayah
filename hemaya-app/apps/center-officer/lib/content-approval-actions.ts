"use server";
// بتّ رئيس المركز في طلبات تعديل المحتوى المقفل — عبر RPC content_change_decide
// (الفحص والتطبيق والتسجيل كلها في القاعدة؛ الواجهة مجرّد ناقل).
import { createServerClient } from "@hemaya/supabase";
import { invalidateContent } from "@hemaya/domain";
import { revalidatePath } from "next/cache";

export async function decideContentChange(id: string, approve: boolean, note?: string) {
  const supabase = createServerClient();
  // الدالة أُنشئت بعد توليد الأنواع — يُعاد التوليد مع دمج السلسلة
  const { data, error } = await (supabase.rpc as CallableFunction)("content_change_decide", {
    _id: id,
    _approve: approve,
    _note: note ?? null,
  });
  if (error) return { ok: false as const, error: (error as { message: string }).message };
  invalidateContent();
  revalidatePath("/oversight");
  const row = Array.isArray(data) ? data[0] : data;
  return { ok: true as const, status: row?.status as string };
}
