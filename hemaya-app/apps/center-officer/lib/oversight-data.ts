import { createServerClient } from "@hemaya/supabase";

async function cnt(supabase: any, statuses: string[]): Promise<number> {
  const { count } = await supabase
    .from("protection_cases")
    .select("id", { count: "exact", head: true })
    .in("status", statuses);
  return count || 0;
}

const CAT_AR: Record<string, string> = { witness: "شاهد", reporter: "مبلّغ", expert: "خبير", victim: "ضحية", related: "ذو صلة" };

// تجميعٌ حقيقيٌّ حسب عمود (فئة/مصدر) — القيادة ترى كل القضايا (board_read).
async function groupBy(s: any, col: string): Promise<Record<string, number>> {
  const { data } = await s.from("protection_cases").select(col);
  const m: Record<string, number> = {};
  (data || []).forEach((r: any) => { const k = r[col]; if (k) m[k] = (m[k] || 0) + 1; });
  return m;
}

// عدّادات حقيقيّة لمرحلة المركز (RLS: board_read — القيادة ترى كل القضايا).
export async function getOversightStats() {
  const s = createServerClient();
  const [triage, underStudy, inDecision, execution, covered, closed, catMap, srcMap] = await Promise.all([
    cnt(s, ["triage"]),
    cnt(s, ["under_study"]),
    cnt(s, ["in_decision"]),
    cnt(s, ["accepted", "signed", "active"]),
    cnt(s, ["signed", "active"]),
    cnt(s, ["accepted", "rejected", "closed"]),
    groupBy(s, "category"),
    groupBy(s, "source"),
  ]);
  const active = triage + underStudy + inDecision + execution;
  const cats = Object.entries(catMap).map(([k, v]) => ({ k: CAT_AR[k] || k, v })).sort((a, b) => b.v - a.v);
  const tracks = [
    { k: "عادي", v: srcMap.local || 0 },
    { k: "عاجل", v: srcMap.urgent || 0 },
    { k: "أجنبي", v: srcMap.foreign || 0 },
  ];
  return {
    kpis: { active, council: inDecision, covered, closed },
    pipeline: [
      { k: "الفرز المبدئي", v: triage },
      { k: "الدراسة والتقييم", v: underStudy },
      { k: "قرار المجلس", v: inDecision },
      { k: "التنفيذ والمتابعة", v: execution },
    ],
    cats,
    tracks,
  };
}
