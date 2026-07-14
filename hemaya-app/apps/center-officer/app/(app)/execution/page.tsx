import { requireRole } from "@hemaya/auth";
import { createServerClient } from "@hemaya/supabase";
import { ExecutionPortal } from "@/components/ExecutionPortal";
export const dynamic = "force-dynamic";

const CAT_AR: Record<string, string> = { witness: "شاهد", reporter: "مبلّغ", expert: "خبير", victim: "ضحية", related: "ذو صلة" };

export default async function Page() {
  await requireRole("case_officer" as any, { denyPath: "/403" });

  // القضايا التي صدر قبولها (تتدفّق للتنفيذ) — RLS: co_execution_read.
  const supabase = createServerClient();
  const { data: cases } = await supabase
    .from("protection_cases")
    .select("id, secret_code, category, source, status, council_decisions(types, issued_reason)")
    .in("status", ["accepted", "signed", "active"])
    .order("updated_at", { ascending: false });

  const handoffs = (cases ?? []).map((c: any) => {
    const cd: any = Array.isArray(c.council_decisions) ? c.council_decisions[0] : c.council_decisions;
    const track = c.source === "foreign" ? "foreign" : c.source === "urgent" ? "urgent" : "council";
    return {
      id: "HDB-" + c.id.slice(0, 8),
      caseId: c.id,
      real: true,
      secret: c.secret_code,
      cat: CAT_AR[c.category] || "شاهد",
      track,
      decidedBy: "مجلس المركز",
      decidedAt: "صدر القرار",
      status: c.status === "active" ? "active" : "await-agreement",
      types: cd?.types || [],
      region: "—",
      note: cd?.issued_reason || "صدر قرار المجلس بقبول طلب الحماية؛ يُحال للتنفيذ لتوقيع اتفاقية الحماية (م11).",
    };
  });

  return <ExecutionPortal initialData={{ handoffs }} />;
}
