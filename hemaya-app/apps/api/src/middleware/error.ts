import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import type { Env } from "../types";

/** شكل خطأ موحَّد لكل الـ API — لا تتسرّب تفاصيل القاعدة الخام للعملاء. */
export interface ApiError {
  error: {
    code: string;
    message: string;
    requestId: string | null;
    details?: unknown;
  };
}

/** معالج الأخطاء المركزيّ — يحوّل أي استثناء إلى استجابة JSON ثابتة. */
export function onError(err: Error, c: Context<Env>): Response {
  const requestId = c.get("requestId") ?? null;

  if (err instanceof HTTPException) {
    return c.json<ApiError>(
      { error: { code: statusCode(err.status), message: err.message, requestId } },
      err.status,
    );
  }

  if (err instanceof ZodError) {
    return c.json<ApiError>(
      { error: { code: "validation_error", message: "مدخلات غير صالحة.", requestId, details: err.issues } },
      422,
    );
  }

  // أخطاء القاعدة (RLS، قواعد العمل، قيود) — تُربَط بحالة HTTP صحيحة بدل 500.
  const mapped = mapDbError(err);
  if (mapped) {
    console.warn(JSON.stringify({ requestId, dbError: rawMessage(err), pgCode: rawCode(err) }));
    return c.json<ApiError>({ error: { code: mapped.code, message: mapped.message, requestId } }, mapped.status);
  }

  // خطأ غير متوقّع — سجّله كاملاً داخلياً، وأعِد رسالة عامّة للعميل.
  console.error(JSON.stringify({ requestId, unexpected: rawMessage(err) }));
  return c.json<ApiError>(
    { error: { code: "internal_error", message: "حدث خطأ غير متوقّع.", requestId } },
    500,
  );
}

function rawCode(err: unknown): string | null {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : null;
}
function rawMessage(err: unknown): string {
  const msg = (err as { message?: unknown } | null)?.message;
  return typeof msg === "string" ? msg : "خطأ في القاعدة.";
}

interface MappedError {
  status: 400 | 403 | 404 | 409;
  code: string;
  message: string;
}

/** يربط رمز Postgres/PostgREST بحالة HTTP ورسالةٍ آمنة للعميل. */
function mapDbError(err: unknown): MappedError | null {
  const code = rawCode(err);
  if (!code) return null;
  switch (code) {
    case "42501": // insufficient_privilege — رفض صلاحيّة/RLS
      return { status: 403, code: "forbidden", message: "لا تملك صلاحيّة تنفيذ هذا الإجراء." };
    case "P0001": // RAISE EXCEPTION — قاعدة عملٍ مقصودة؛ رسالتها موجّهة للمستخدم فآمنة للعرض
      return { status: 409, code: "business_rule", message: rawMessage(err) };
    case "23505": // unique_violation
      return { status: 409, code: "conflict", message: "يوجد سجلّ مطابق مسبقاً." };
    case "23514": // check_violation
    case "23502": // not_null_violation
    case "22P02": // invalid_text_representation
    case "23503": // foreign_key_violation
      return { status: 400, code: "invalid_input", message: "مدخلات غير صالحة وفق قيود القاعدة." };
    case "PGRST116": // لا صفوف
      return { status: 404, code: "not_found", message: "غير موجود." };
    default:
      if (code.startsWith("PGRST")) return { status: 400, code: "request_error", message: "طلبٌ غير صالح." };
      return null;
  }
}

function statusCode(status: number): string {
  switch (status) {
    case 401:
      return "unauthorized";
    case 403:
      return "forbidden";
    case 404:
      return "not_found";
    case 429:
      return "rate_limited";
    default:
      return "error";
  }
}
