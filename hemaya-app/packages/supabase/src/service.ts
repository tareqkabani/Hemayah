import { createClient as createSbClient } from "@supabase/supabase-js";
import type { Database } from "./types";
/** عميل service_role — خادميّ فقط. يتجاوز RLS. */
export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY مفقود — خادميّ فقط.");
  return createSbClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
