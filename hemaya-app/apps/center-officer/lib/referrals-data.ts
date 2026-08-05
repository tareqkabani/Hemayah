import { createServerClient } from "@hemaya/supabase";

const CAT_AR: Record<string, string> = { witness: "شاهد", victim: "ضحية", reporter: "مبلّغ", expert: "خبير", related: "ذو صلة" };
const RISK_AR: Record<string, string> = { low: "منخفض", medium: "متوسط", high: "عالٍ", critical: "حرِج" };

function fmt(ts: string | null): string {
  if (!ts) return "—";
  try {
    return new Intl.DateTimeFormat("ar-SA", { day: "numeric", month: "long" }).format(new Date(ts));
  } catch { return "—"; }
}

// يجلب كل إحالات م14 (المركز مُصدرها ومتابعها — سياسة referral_center_read)
// مربوطةً بالقضية، ويعيّنها لشكل صفّ ناقل المركز (caseRef = الرمز السري).
export async function getCenterReferrals() {
  const s = createServerClient();
  const { data, error } = await s
    .from("referrals")
    .select("id, ref, service, authority, status, assignee, result, summary, history, created_at, protection_cases(secret_code, category, classification)")
    .order("created_at", { ascending: false });
  if (error || !data) return [] as any[];
  return data.map((r: any) => {
    const pc = r.protection_cases || {};
    const res = r.result || {};
    const hist: any[] = Array.isArray(r.history) ? r.history : [];
    const closedAt = hist.filter((h) => h && h.status === "closed").pop();
    return {
      id: r.id,
      _rid: r.id,
      _real: true,
      ref: r.ref || "",
      caseRef: pc.secret_code,
      name: pc.secret_code,
      cat: CAT_AR[pc.category] || pc.category,
      risk: RISK_AR[pc.classification] || "متوسط",
      service: r.service,
      authority: r.authority,
      status: r.status,
      assignee: r.assignee || null,
      sched: res.sched || null,
      result: res.result || null,
      summary: r.summary || "",
      referredAt: fmt(r.created_at),
      createdAt: r.created_at ? Date.parse(r.created_at) : 0,
      closedBy: (closedAt && closedAt.by) || null,
    };
  });
}
