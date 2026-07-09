import { requireRole } from "@hemaya/auth";
import { createServerClient } from "@hemaya/supabase";
import { TriagePortal } from "@/components/TriagePortal";
export const dynamic = "force-dynamic";

// enum app_category → الفئة العربية المعروضة في البوابة
const CAT_AR: Record<string, string> = {
  witness: "شاهد", reporter: "مبلّغ", expert: "خبير", victim: "ضحية", related: "ذو صلة",
};

function daysAgo(iso: string): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  const diff = Math.floor((Date.now() - then) / 86400000);
  if (diff <= 0) return "اليوم";
  if (diff === 1) return "أمس";
  if (diff < 7) return `قبل ${diff} أيام`;
  if (diff < 14) return "قبل أسبوع";
  return "قبل أكثر من أسبوع";
}

export default async function Page() {
  await requireRole("case_officer" as any, { denyPath: "/403" });

  // القضايا الفعليّة في طابور الفرز (RLS: co_triage_inbox — case_officer + status='triage').
  const supabase = createServerClient();
  const { data: cases } = await supabase
    .from("protection_cases")
    .select("id, ref_no, secret_code, category, status, source, created_at, protection_requests(channel, details)")
    .eq("status", "triage")
    .order("created_at", { ascending: false });

  const initialRows = (cases ?? []).map((c: any) => {
    const req = Array.isArray(c.protection_requests) ? c.protection_requests[0] : c.protection_requests;
    const details = (req?.details ?? {}) as Record<string, any>;
    const isPaper = req?.channel === "paper";
    const paperSrc = details.paper_source; // 'seeker' | 'entity'
    return {
      real: true,
      caseId: c.id,
      secret: c.secret_code,
      ref: c.ref_no,
      cat: CAT_AR[c.category] || "شاهد",
      source: paperSrc === "entity" ? "جهة" : "ذاتي",
      status: "triage",
      clerk: "c1",
      days: daysAgo(c.created_at),
      prior: !!details.prior_submit,
      urgency: "عادي",
      paper: isPaper,
      crime: details.crime || "",
      reason: details.reason || "",
      entity: details.entity || "",
      caseNo: details.case_no || "",
      actions: [],
      calls: [],
    };
  });

  return <TriagePortal mode="clerks" initialRows={initialRows} />;
}
