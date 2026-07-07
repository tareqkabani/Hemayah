import type { Context } from "hono";
import type { ZodError } from "zod";
import type { Env } from "../types";

/**
 * خُطّاف تحقّق موحَّد لـ zValidator — يحوّل فشل التحقّق إلى نفس شكل الخطأ
 * المستخدَم في كامل الـ API (بدل شكل @hono/zod-validator الافتراضيّ).
 */
export function validationHook(
  result: { success: true; data: unknown } | { success: false; error: ZodError },
  c: Context<Env>,
): Response | undefined {
  if (!result.success) {
    return c.json(
      {
        error: {
          code: "validation_error",
          message: "مدخلات غير صالحة.",
          requestId: c.get("requestId") ?? null,
          details: result.error.issues,
        },
      },
      422,
    );
  }
  return undefined;
}
