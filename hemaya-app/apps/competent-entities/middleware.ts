import { type NextRequest } from "next/server";
import { updateSession } from "@hemaya/supabase";
export async function middleware(request: NextRequest) {
  return updateSession(request, "/login");
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/).*)"] };
