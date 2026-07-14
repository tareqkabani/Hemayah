import { redirect } from "next/navigation";
import { createServerClient, GATEWAY_URL } from "@hemaya/supabase";
import { SeekerRoot } from "@/components/portal-app";
import "@/components/portal.css";

export const dynamic = "force-dynamic";

/**
 * بوابة طالب الحماية (محميّة — دور «subject»). تجلب هوية نفاذ من الجلسة وطلبات
 * المستفيد الحقيقية (RLS: submitted_by) وتمرّرها للتطبيق الكامل (portal-app).
 */
export default async function SeekerPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(GATEWAY_URL);

  const meta = user.user_metadata ?? {};

  const { data: cases } = await supabase
    .from("protection_cases")
    .select("id, ref_no, secret_code, status, category, created_at, protection_requests(applicant_role, submitted_at, details)")
    .order("created_at", { ascending: false });

  const requests = (cases ?? []).map((c: any) => ({
    id: c.id,
    ref_no: c.ref_no,
    secret_code: c.secret_code,
    status: c.status,
    category: c.category,
    created_at: c.created_at,
    applicant_role: c.protection_requests?.[0]?.applicant_role ?? null,
    submitted_at: c.protection_requests?.[0]?.submitted_at ?? null,
    details: c.protection_requests?.[0]?.details ?? null,
  }));

  const identity = {
    name: (meta.name as string) || "طالب الحماية",
    nationalId: (meta.national_id as string) || "—",
    via: meta.source === "nafath" ? "نفاذ" : "—",
    secretCode: requests[0]?.secret_code ?? null,
  };

  return <SeekerRoot identity={identity} requests={requests} />;
}
