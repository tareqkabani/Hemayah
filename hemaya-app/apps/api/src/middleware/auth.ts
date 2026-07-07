import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { createHash } from "node:crypto";
import type { Env } from "../types";
import { createUserClient, createServiceClient } from "../lib/supabase";
import { verifyAccessToken } from "../lib/jwt";

/** تجزئة المفتاح الخام — نفس الخوارزميّة في سكربت الإصدار. */
export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

interface ApiKeyRow {
  id: string;
  name: string;
  scopes: string[];
  active: boolean;
  expires_at: string | null;
}

/**
 * حارس المصادقة المركزيّ — يقبل هويّتين:
 *   • مفتاح API عبر ترويسة X-API-Key  → هويّة نظام (service client + صلاحيات).
 *   • توكن نفاذ عبر Authorization: Bearer → هويّة مستخدم (user client + RLS).
 * يُطبَّق مرّةً واحدة على كلّ نقاط /v1 المحميّة.
 */
export const authenticate = createMiddleware<Env>(async (c, next) => {
  const apiKey = c.req.header("X-API-Key");
  if (apiKey) {
    await authenticateMachine(c, apiKey);
    return next();
  }

  const header = c.req.header("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    throw new HTTPException(401, { message: "بيانات المصادقة مفقودة (توكن نفاذ أو مفتاح API)." });
  }

  // تحقّق محليّ عبر JWKS — بلا نداءٍ شبكيّ. العميل يحمل التوكن كي يُفرَض RLS
  // في PostgREST عند الاستعلام (طبقة تحقّق ثانية).
  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    throw new HTTPException(401, { message: "توكن غير صالح أو منتهٍ." });
  }
  c.set("db", createUserClient(token));
  c.set("principal", { type: "user", user });
  await next();
});

async function authenticateMachine(c: Parameters<Parameters<typeof createMiddleware<Env>>[0]>[0], rawKey: string) {
  const admin = createServiceClient();
  const hash = hashApiKey(rawKey);
  const { data } = await admin
    .from("api_keys")
    .select("id, name, scopes, active, expires_at")
    .eq("key_hash", hash)
    .eq("active", true)
    .maybeSingle();

  const row = data as ApiKeyRow | null;
  if (!row) {
    throw new HTTPException(401, { message: "مفتاح API غير صالح أو مُبطَل." });
  }
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
    throw new HTTPException(401, { message: "مفتاح API منتهي الصلاحيّة." });
  }

  // تحديث آخر استخدام — أفضل جهدٍ، لا يعطّل الطلب. نستدعي then() لأن مُنشئ
  // الاستعلام كسولٌ (لا يُنفَّذ إلا عند then/await).
  admin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", row.id)
    .then(() => {}, () => {});

  c.set("db", admin);
  c.set("principal", { type: "machine", keyId: row.id, name: row.name, scopes: row.scopes ?? [] });
}
