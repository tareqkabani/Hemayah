import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SeekerRoot } from "./portal-app";
import "./portal.css";

export const metadata = {
  title: "بوابة طالب الحماية — منصّة «حماية»",
};

/**
 * بوابة طالب الحماية (محميّة). يجلب هوية نفاذ من الجلسة ويمرّرها للتطبيق الكامل
 * (portal-app: هيكل + كل الشاشات منقولة من التصميم). قوائم الطلبات/الرسائل
 * تعرض بيانات البروتوتايب لتوضيح المسارات؛ ربطها بـ Supabase هو خطوة التكامل.
 */
export default async function SeekerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const meta = user.user_metadata ?? {};

  // طلبات المستفيد الحقيقية (RLS: يرى طلباته فقط) + تفاصيلها من protection_requests.
  const { data: cases } = await supabase
    .from("protection_cases")
    .select("id, ref_no, secret_code, status, category, created_at, protection_requests(details)")
    .order("created_at", { ascending: false });

  const requests = (cases ?? []).map((c: any) => ({
    id: c.id,
    ref_no: c.ref_no,
    secret_code: c.secret_code,
    status: c.status,
    category: c.category,
    created_at: c.created_at,
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
