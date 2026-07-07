"use client";
/* ============================================================
   جلبٌ حيٌّ للتسليمات للتنفيذ من القاعدة (protection_cases المقبولة) — نفس شكل SSR.
   يُستدعى عند تغيّر protection_cases (Realtime) فتظهر القضايا المقبولة حديثاً لحظيّاً.
   ============================================================ */
import { createClient } from "@hemaya/supabase/src/browser";

const CAT_AR = { witness: "شاهد", reporter: "مبلّغ", expert: "خبير", victim: "ضحية", related: "ذو صلة" };

export function execClient() { return createClient(); }

export async function refetchHandoffs(supabase) {
  const sb = supabase || createClient();
  const { data: cases } = await sb
    .from("protection_cases")
    .select("id, secret_code, category, source, status, council_decisions(types, issued_reason)")
    .in("status", ["accepted", "signed", "active"])
    .order("updated_at", { ascending: false });
  return (cases ?? []).map((c) => {
    const cd = Array.isArray(c.council_decisions) ? c.council_decisions[0] : c.council_decisions;
    const track = c.source === "foreign" ? "foreign" : c.source === "urgent" ? "urgent" : "council";
    return {
      id: "HDB-" + String(c.id).slice(0, 8), caseId: c.id, real: true,
      secret: c.secret_code, cat: CAT_AR[c.category] || "شاهد", track,
      decidedBy: "مجلس المركز", decidedAt: "صدر القرار",
      status: c.status === "active" ? "active" : "await-agreement",
      types: (cd && cd.types) || [], region: "—",
      note: (cd && cd.issued_reason) || "صدر قرار المجلس بقبول طلب الحماية؛ يُحال للتنفيذ لتوقيع اتفاقية الحماية (م11).",
    };
  });
}
