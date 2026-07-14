import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./types";
import { GATEWAY_URL } from "./gateway";

/** يُدوّر جلسة Supabase على كل طلب ويحرس الدخول (يُوجّه غير المُصادَق إلى البوّابة الموحّدة). */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isPublic = path.startsWith("/auth") || path === "/403";
  if (!user && !isPublic) {
    // لا شاشة دخول محليّة — يُحوَّل غير المُصادَق إلى البوّابة الموحّدة (نفاذ).
    return NextResponse.redirect(new URL(GATEWAY_URL));
  }
  return response;
}
