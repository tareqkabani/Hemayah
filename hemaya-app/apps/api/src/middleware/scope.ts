import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { Env } from "../types";

/**
 * يتطلّب صلاحيّةً معيّنة للمستهلك الآليّ (مفتاح API). المستخدم البشريّ يمرّ —
 * فوصوله محكومٌ بـ RLS في القاعدة لا بالصلاحيات.
 */
export function requireScope(scope: string) {
  return createMiddleware<Env>(async (c, next) => {
    const p = c.get("principal");
    if (p.type === "machine" && !p.scopes.includes(scope)) {
      throw new HTTPException(403, { message: `المفتاح لا يملك الصلاحيّة المطلوبة: ${scope}` });
    }
    await next();
  });
}

/**
 * يقصر النقطة على مستخدمٍ بشريّ. الكتابة عبر دوال RPC تعتمد هويّة نفاذ
 * (auth.uid())، فلا تُتاح لمفاتيح API بعد (لا هويّة مستخدم لها).
 */
export const requireUser = createMiddleware<Env>(async (c, next) => {
  if (c.get("principal").type !== "user") {
    throw new HTTPException(403, {
      message: "هذا الإجراء يتطلّب جلسة مستخدم (نفاذ)، ولا يُتاح لمفاتيح API حالياً.",
    });
  }
  await next();
});
