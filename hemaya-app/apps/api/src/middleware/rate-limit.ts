import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { Env } from "../types";

/**
 * تحديد معدّل بسيط بنافذة ثابتة في الذاكرة — حاجز أوّليّ ضدّ الإساءة والفيضان.
 * المفتاح: عنوان العميل من X-Forwarded-For (يضبطه الوسيط العكسيّ Nginx في
 * الإنتاج). ملاحظة: في الإنتاج متعدّد المثيلات، انقل هذا إلى مخزنٍ مشترك
 * (Redis) أو اعتمد تحديد المعدّل على حافة الشبكة.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 120;

interface Bucket {
  count: number;
  resetAt: number;
}
const buckets = new Map<string, Bucket>();

function clientKey(c: Parameters<Parameters<typeof createMiddleware<Env>>[0]>[0]): string {
  const fwd = c.req.header("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return c.req.header("x-real-ip") ?? "unknown";
}

export const rateLimit = createMiddleware<Env>(async (c, next) => {
  const now = Date.now();
  const key = clientKey(c);

  // كنسٌ كسولٌ للمفاتيح المنتهية كي لا تنمو الخريطة بلا حدّ.
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }

  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, bucket);
  }
  bucket.count++;

  const remaining = Math.max(0, MAX_PER_WINDOW - bucket.count);
  c.header("X-RateLimit-Limit", String(MAX_PER_WINDOW));
  c.header("X-RateLimit-Remaining", String(remaining));
  c.header("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

  if (bucket.count > MAX_PER_WINDOW) {
    c.header("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
    throw new HTTPException(429, { message: "تجاوزت حدّ الطلبات المسموح، حاول لاحقاً." });
  }

  await next();
});
