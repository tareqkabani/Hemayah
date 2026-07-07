import { createServerClient } from "@hemaya/supabase";

const CAT_AR: Record<string, string> = { witness: "شاهد", victim: "ضحية", reporter: "مبلّغ", expert: "خبير", related: "ذو صلة" };
const RISK_AR: Record<string, string> = { low: "منخفض", medium: "متوسط", high: "عالٍ", critical: "حرِج" };

function fmt(ts: string | null): string {
  if (!ts) return "—";
  try { return new Intl.DateTimeFormat("ar-SA", { day: "numeric", month: "long" }).format(new Date(ts)); }
  catch { return "—"; }
}

// إحالات الإدارة الأمنية (م14) — تُعاد بشكل الناقل الأصليّ الذي تتوقّعه البوابة (busToCase).
export async function getSecurityReferrals() {
  const s = createServerClient();
  const { data, error } = await s
    .from("referrals")
    .select("id, ref, service, authority, status, assignee, result, summary, created_at, case_id, protection_cases(id, secret_code, category, classification, case_region)")
    .eq("authority", "security")
    .order("created_at", { ascending: true });
  if (error || !data) return [] as any[];
  return data.map((r: any) => {
    const pc = r.protection_cases || {};
    const cd = r.result || {};
    return {
      id: r.ref || r.id,
      _rid: r.id,
      _caseId: pc.id,
      _real: true,
      authority: "security",
      caseRef: pc.secret_code,
      cat: CAT_AR[pc.category] || pc.category,
      risk: RISK_AR[pc.classification] || "متوسط",
      service: r.service,
      summary: r.summary || "",
      referredAt: fmt(r.created_at),
      status: r.status,
      assignee: r.assignee || null,
      assignedTo: cd.assignedTo || "o1",
      region: pc.case_region || "RUH",
      caseData: cd.caseData || (Object.keys(cd).length ? cd : null),
    };
  });
}
