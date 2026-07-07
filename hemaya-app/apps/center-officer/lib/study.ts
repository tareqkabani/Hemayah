import { createServerClient } from "@hemaya/supabase";

type Track = "study" | "assessment";
const cfg = (t: Track) => t === "study"
  ? { table: "studies", author: "studier_id" }
  : { table: "assessments", author: "evaluator_id" };

/** حالات الدراسة + حالة صفّي (المؤلّف الحاليّ) — العزل الصفّيّ يضمن عدم رؤية صفوف الأقران. */
export async function listAuthoringCases(track: Track) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { table } = cfg(track);
  const { data: cases } = await supabase
    .from("protection_cases")
    .select("id, ref_no, secret_code, category, created_at")
    .eq("status", "under_study").order("created_at", { ascending: true });
  const { data: mine } = await supabase.from(table).select("case_id, submitted_at");
  const submitted = new Set((mine ?? []).map((r: any) => r.case_id));
  return (cases ?? []).map((c: any) => ({ ...c, submitted: submitted.has(c.id) }));
}

export async function getAuthoringCase(track: Track, id: string) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { table, author } = cfg(track);
  const { data: c } = await supabase
    .from("protection_cases")
    .select("id, ref_no, secret_code, category, status, protection_requests(details)")
    .eq("id", id).single();
  if (!c) return null;
  const { data: row } = await supabase.from(table).select("*").eq("case_id", id).eq(author, user!.id).maybeSingle();
  const req: any = (c as any).protection_requests?.[0] ?? {};
  return {
    id: c.id, ref_no: c.ref_no, secret_code: c.secret_code, category: c.category,
    details: req.details ?? {}, mine: row ?? null,
  };
}
