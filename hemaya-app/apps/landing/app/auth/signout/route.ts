import { createServerClient } from "@hemaya/supabase";
import { NextResponse } from "next/server";

// خروج البوّابة الموحّدة: مسح جلسة Supabase (الكوكي المشتركة) والبقاء على البوّابة.
export async function POST() {
  const supabase = createServerClient();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}

// خروج عبر رابط مباشر (صفحات 403 في البوّابات تشير إلى /auth/signout): مسحٌ ثم عودة للبوّابة الموحّدة.
export async function GET(req: Request) {
  const supabase = createServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", req.url), 303);
}
