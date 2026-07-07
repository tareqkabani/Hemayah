import { createMiddleware } from "hono/factory";
import { randomUUID } from "node:crypto";
import type { Env } from "../types";
import { principalId } from "../types";

/**
 * تسجيل تدقيق لكل طلب — حرِج لنظامٍ حسّاس.
 * يُصدر سطراً منظَّماً (JSON) لكل طلب: المُعرّف، الطريقة، المسار، الحالة،
 * زمن الاستجابة، وهوية المستخدم إن وُجدت. لاحقاً يُكتب إلى جدول تدقيق.
 */
export const audit = createMiddleware<Env>(async (c, next) => {
  const requestId = randomUUID();
  c.set("requestId", requestId);
  const startedAt = performance.now();

  await next();

  const durationMs = Math.round(performance.now() - startedAt);
  const principal = c.get("principal");
  console.log(
    JSON.stringify({
      at: new Date().toISOString(),
      requestId,
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs,
      principal: principal ? principalId(principal) : null,
    }),
  );
});
