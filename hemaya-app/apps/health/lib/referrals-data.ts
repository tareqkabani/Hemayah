import { createServerClient } from "@hemaya/supabase";
import type { ReferralAuthority } from "@hemaya/supabase";

const CAT_AR: Record<string, string> = { witness: "شاهد", victim: "ضحية", reporter: "مبلّغ", expert: "خبير", related: "ذو صلة" };
const RISK_AR: Record<string, string> = { low: "منخفض", medium: "متوسط", high: "عالٍ", critical: "حرِج" };

function fmt(ts: string | null): string {
  if (!ts) return "—";
  try {
    return new Intl.DateTimeFormat("ar-SA", { day: "numeric", month: "long" }).format(new Date(ts));
  } catch { return "—"; }
}

// يجلب إحالات م14 للسلطة (health) مربوطةً بالقضية، ويعيّنها لشكل صفّ البوابة.
export async function getReferrals(authority = "health") {
  const s = createServerClient();
  const { data, error } = await s
    .from("referrals")
    .select("id, ref, service, authority, status, assignee, result, summary, created_at, case_id, protection_cases(secret_code, category, classification, case_region)")
    .eq("authority", authority as ReferralAuthority)
    .order("created_at", { ascending: true });
  if (error || !data) return [] as any[];
  return data.map((r: any) => {
    const pc = r.protection_cases || {};
    const res = r.result || {};
    return {
      id: r.ref || r.id,
      _rid: r.id,
      _real: true,
      authority,
      secret: pc.secret_code,
      cat: CAT_AR[pc.category] || pc.category,
      service: r.service,
      risk: RISK_AR[pc.classification] || "متوسط",
      region: pc.case_region || "RUH",
      referred: fmt(r.created_at),
      status: r.status,
      assignee: r.assignee || null,
      sched: res.sched || null,
      result: res.result || null,
      centerRef: (pc.secret_code || "") + " · التنفيذ والتجديد",
      summary: r.summary || "",
    };
  });
}
