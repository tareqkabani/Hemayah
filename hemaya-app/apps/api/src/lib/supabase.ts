import { createClient, type SupabaseClient } from "@supabase/supabase-js";
// نستورد النوع مباشرةً — لا نحمّل barrel الحزمة كي لا نجرّ وحدات Next (server/middleware).
import type { Database } from "@hemaya/supabase/src/types.gen";

const url = () => {
  const v = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!v) throw new Error("NEXT_PUBLIC_SUPABASE_URL مفقود.");
  return v;
};

/**
 * عميل بهوية المستخدم — يفرض RLS بتمرير توكن نفاذ في كل طلب.
 * هذا هو العميل الافتراضيّ لكل نقاط الـ API: القاعدة نفسها تحرس البيانات.
 */
export function createUserClient(accessToken: string): SupabaseClient<Database> {
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anon) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY مفقود.");
  return createClient<Database>(url(), anon, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * عميل service_role — يتجاوز RLS. للعمليات الإدارية فقط (إنشاء مستخدم، إسناد دور).
 * لا يُستخدَم لخدمة طلبات العملاء أبداً.
 */
export function createServiceClient(): SupabaseClient<Database> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY مفقود — خادميّ فقط.");
  return createClient<Database>(url(), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** خطأ قاعدة يحمل رمز Postgres (SQLSTATE أو رمز PostgREST) ليربطه معالج الأخطاء بحالة HTTP. */
export class DbError extends Error {
  code: string | undefined;
  details: string | undefined;
  constructor(message: string, code?: string | null, details?: string | null) {
    super(message);
    this.name = "DbError";
    this.code = code ?? undefined;
    this.details = details ?? undefined;
  }
}

/**
 * مُنادٍ موحَّد لدوال RPC. الأنواع المولّدة يدويّاً في هذه المرحلة لا يتعرّف
 * عليها postgrest-js لاستنتاج وسائط RPC، فنعزل التحويل هنا في مكانٍ واحد
 * موثَّق بدل نثره في كل نقطة. المدخلات محقَّقة بـ zod، والمخرجات مُنمَّطة صراحةً.
 * يرمي DbError (حاملاً رمز القاعدة) ليربطه معالج الأخطاء المركزيّ بحالة صحيحة.
 */
type PgError = { message: string; code?: string | null; details?: string | null };
type RpcResult = { data: unknown; error: PgError | null };
type RpcCaller = (fn: string, args: Record<string, unknown>) => PromiseLike<RpcResult>;

export async function callRpc<T>(
  db: SupabaseClient<Database>,
  fn: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await (db.rpc as unknown as RpcCaller)(fn, args);
  if (error) throw new DbError(error.message, error.code, error.details);
  return data as T;
}
