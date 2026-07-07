import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";
/** عميل Supabase لمكوّنات العميل. */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
