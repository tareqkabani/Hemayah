import { Hono } from "hono";
import type { Env } from "./types";
import { audit } from "./middleware/audit";
import { authenticate } from "./middleware/auth";
import { rateLimit } from "./middleware/rate-limit";
import { idempotency } from "./middleware/idempotency";
import { onError } from "./middleware/error";
import { openapi } from "./openapi";
import { auth } from "./routes/auth";
import { cases } from "./routes/cases";
import { referrals } from "./routes/referrals";
import { notifications } from "./routes/notifications";

/**
 * بوّابة Hemayah — طبقة رقيقة أمام Supabase. الإصدار /v1 من أوّل يوم.
 * ترتيب الطبقات: تدقيق (لكل طلب) ← مصادقة (للنقاط المحميّة) ← النقاط.
 * الأمان دفاعٌ في العمق: RLS في القاعدة يبقى خطّ الدفاع الأخير.
 */
export const app = new Hono<Env>();

app.onError(onError);

// تدقيق ثم تحديد معدّل — لكل طلب، بما فيه الصحّة والمسارات غير المعروفة.
app.use("*", audit);
app.use("*", rateLimit);

// نقاط عامّة (بلا مصادقة): الصحّة، عقد OpenAPI، ودخول نفاذ (مصدر التوكن).
app.get("/v1/health", (c) => c.json({ status: "ok", service: "hemaya-api", version: "v1" }));
app.get("/v1/openapi.json", (c) => c.json(openapi));
app.route("/v1/auth", auth);

// كل ما تحت /v1 (عدا العامّة) يتطلّب هويّة صالحة (توكن نفاذ أو مفتاح API).
const v1 = new Hono<Env>();
v1.use("*", authenticate);
v1.use("*", idempotency); // بعد المصادقة كي تُقيَّد المفاتيح بالهويّة
v1.route("/cases", cases);
v1.route("/referrals", referrals);
v1.route("/notifications", notifications);
app.route("/v1", v1);

app.notFound((c) =>
  c.json(
    { error: { code: "not_found", message: "المسار غير موجود.", requestId: c.get("requestId") ?? null } },
    404,
  ),
);
