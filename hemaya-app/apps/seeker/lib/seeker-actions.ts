"use server";

import { createServerClient as createClient } from "@hemaya/supabase";
import type { AppCategory, Json } from "@hemaya/supabase";

/**
 * تقديم طلب حماية (M4) — يستدعي دالة Supabase الآمنة submit_protection_request
 * التي تُنشئ الحالة والطلب والتدقيق وتولّد الرمز السرّي، بهوية المستفيد (RLS/SECURITY DEFINER).
 */

const CATEGORY_MAP: Record<string, AppCategory> = {
  "شاهد": "witness",
  "مبلّغ": "reporter",
  "خبير": "expert",
  "ضحية": "victim",
};

export type SubmitInput = {
  role: string;
  category: string; // بالعربية من النموذج
  entity: string;
  crime: string;
  reason: string;
  priorSubmit: string; // 'yes' | 'no'
  caseNo: string;
  details?: Record<string, unknown>;
};

export type SubmitResult =
  | { ok: true; refNo: string; secretCode: string; caseId: string }
  | { ok: false; error: string };

export async function submitRequest(input: SubmitInput): Promise<SubmitResult> {
  const category = CATEGORY_MAP[input.category];
  if (!category) return { ok: false, error: "دور مقدّم الطلب غير صحيح." };
  if (!input.crime.trim() || !input.reason.trim()) {
    return { ok: false, error: "الجريمة والمسوّغات مطلوبة." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_protection_request", {
    _applicant_role: input.role,
    _category: category,
    _entity: input.entity,
    _crime: input.crime,
    _reason: input.reason,
    _prior_submit: input.priorSubmit === "yes",
    _case_no: (input.caseNo || null) as string, // الدالة تقبل NULL فعلياً
    _details: (input.details ?? {}) as Json,
  });

  if (error) return { ok: false, error: `تعذّر تقديم الطلب: ${error.message}` };

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { ok: false, error: "لم تُعِد الخدمة نتيجة." };
  return { ok: true, refNo: row.ref_no, secretCode: row.secret_code, caseId: row.case_id };
}
