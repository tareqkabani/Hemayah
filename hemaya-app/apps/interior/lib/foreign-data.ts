import { createServerClient } from "@hemaya/supabase";

function fmt(ts: string | null): string {
  if (!ts) return "—";
  try { return new Intl.DateTimeFormat("ar-SA", { day: "numeric", month: "long" }).format(new Date(ts)); }
  catch { return "—"; }
}

// طلبات المساعدة القانونية الأجنبية (م6) — RLS: سلطة moi.
export async function getForeignRequests() {
  const s = createServerClient();
  const { data, error } = await s
    .from("foreign_requests")
    .select("id, ref, secret, country, authority, auth_kind, category, city, foreign_ref, basis, summary, status, pg_decision, created_at")
    .order("created_at", { ascending: true });
  if (error || !data) return [] as any[];
  return data.map((r: any) => ({
    id: r.ref || r.id,
    _rid: r.id,
    _real: true,
    secret: r.secret,
    country: r.country,
    authority: r.authority,
    authKind: r.auth_kind,
    cat: r.category,
    foreignRef: r.foreign_ref,
    arrived: fmt(r.created_at),
    days: 1,
    status: r.status,
    outcome: r.pg_decision || undefined,
    basis: r.basis,
    city: r.city,
    summary: r.summary,
  }));
}
