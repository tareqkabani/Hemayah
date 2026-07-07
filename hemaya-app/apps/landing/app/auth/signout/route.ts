import { createServerClient } from "@hemaya/supabase";
import { NextResponse } from "next/server";

// خروج البوّابة الموحّدة: مسح جلسة Supabase (الكوكي المشتركة على localhost) والبقاء على البوّابة.
export async function POST() {
  const supabase = createServerClient();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
