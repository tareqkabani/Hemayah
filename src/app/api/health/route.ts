import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * فحص صحّة الاتصال بـ Supabase (تطويريّ).
 * يستعمل مفتاح service_role (خادميّ فقط) للتحقّق من بلوغ القاعدة ووجود المخطّط.
 * anon يبقى ممنوعاً من الجداول قصداً (كل البوابات تتطلّب دخول نفاذ).
 */
export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { count, error } = await supabase
    .from("protection_cases")
    .select("id", { count: "exact", head: true });

  if (error) {
    return NextResponse.json(
      { ok: false, stage: "db", error: error.message || "unknown" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    db: "reachable",
    schema: "protection_cases present",
    rows: count ?? 0,
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
}
