import { createServerClient } from "@hemaya/supabase";
import { NextResponse } from "next/server";

// خروج: مسح جلسة Supabase فقط (بلا تحويلٍ عبر-الأصل يكسر fetch عبر CORS).
// العميل هو من ينتقل إلى البوّابة الموحّدة بعد نجاح الطلب.
export async function POST() {
  const supabase = createServerClient();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
