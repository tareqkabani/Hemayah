import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { Env } from "../types";

/**
 * دعم Idempotency-Key لطرق الكتابة — يمنع تكرار طلب الحماية إن أعاد العميل
 * الإرسال (شبكة متقطّعة، ضغطة مزدوجة). حرِجٌ لنظامٍ حسّاس: طلبان بنفس المفتاح
 * يُنتجان قضيّةً واحدة لا قضيّتين.
 *
 * السلوك: المفتاح اختياريّ؛ يُحترَم متى حضر. أوّل طلبٍ يُنفَّذ وتُخزَّن استجابته؛
 * التكرار يُعيد الاستجابة نفسها. طلبٌ متزامنٌ بنفس المفتاح أثناء المعالجة → 409.
 *
 * التخزين في الذاكرة (لكلّ مثيل) — كافٍ الآن؛ للإنتاج متعدّد المثيلات يُنقَل
 * إلى مخزنٍ مشترك (Redis/جدول). المفاتيح مقيّدة بالمستخدم منعاً للتصادم.
 */
const TTL_MS = 24 * 60 * 60 * 1000;
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

interface Entry {
  status: "pending" | "done";
  httpStatus?: number;
  body?: unknown;
  expiresAt: number;
}
const store = new Map<string, Entry>();

export const idempotency = createMiddleware<Env>(async (c, next) => {
  const key = c.req.header("Idempotency-Key");
  if (!key || !WRITE_METHODS.has(c.req.method)) return next();

  const now = Date.now();
  if (store.size > 10_000) {
    for (const [k, e] of store) if (e.expiresAt <= now) store.delete(k);
  }

  const p = c.get("principal");
  const owner = p.type === "user" ? p.user.id : `key:${p.keyId}`;
  const composite = `${owner}:${key}`;
  const existing = store.get(composite);
  if (existing && existing.expiresAt > now) {
    if (existing.status === "pending") {
      throw new HTTPException(409, { message: "طلبٌ بنفس مفتاح idempotency قيد المعالجة." });
    }
    c.header("Idempotency-Replayed", "true");
    return c.json(existing.body as never, (existing.httpStatus ?? 200) as never);
  }

  store.set(composite, { status: "pending", expiresAt: now + TTL_MS });
  try {
    await next();
  } catch (err) {
    store.delete(composite); // افسح المجال لإعادة محاولةٍ صحيحة بعد فشلٍ عابر
    throw err;
  }

  // خزّن الاستجابات الحاسمة فقط (2xx/4xx)؛ لا تُعِد تشغيل أخطاء الخادم العابرة (5xx).
  const res = c.res.clone();
  if (res.status < 500) {
    const body = await res.json().catch(() => null);
    store.set(composite, { status: "done", httpStatus: res.status, body, expiresAt: now + TTL_MS });
  } else {
    store.delete(composite);
  }
});
