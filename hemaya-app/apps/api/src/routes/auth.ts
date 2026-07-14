import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { createClient } from "@supabase/supabase-js";
// deep import: نتفادى barrel @hemaya/auth الذي يجرّ وحدات Next عبر guard.
import { getNafath } from "@hemaya/auth/src/adapters";
import type { Env } from "../types";
import { createServiceClient } from "../lib/supabase";
import { NafathStartSchema, NafathConfirmSchema } from "../schemas";
import { validationHook } from "../middleware/validation";

/**
 * دخول نفاذ للجوّال — نقاطٌ عامّة (بلا مصادقة، فهي مصدر التوكن).
 * تغلّف مُحوّل نفاذ (mock الآن، live لاحقاً بنفس الواجهة). تُرجِع confirm
 * توكنَي الجلسة (access/refresh) كي يخزّنهما التطبيق ويرسل access كـ Bearer —
 * بخلاف الويب الذي يعتمد الكوكيز.
 *
 * جسر التطوير: مستخدم Supabase بريدُه {nid}@nafath.local وكلمة سرّ خادميّة.
 * في وضع live يُستبدَل الجسر بمطابقة نفاذ الحقيقيّة عبر الناقل الحكوميّ.
 */
export const auth = new Hono<Env>();

const emailFor = (nid: string) => `${nid}@nafath.local`;
// كلمة سرّ جسر التطوير — **موحّدة** مع البوّابة الموحّدة (landing) والبذور
// (`nafath-staff-2026`) كي لا يتضارب دخول الويب ودخول الجوّال على المستخدم نفسه
// (كلٌّ كان يعيد ضبط كلمة السرّ لقيمته فيكسر الآخر). في الإنتاج: نفاذ OIDC، بلا كلمة سرّ.
const BRIDGE_PASSWORD = process.env.NAFATH_BRIDGE_PASSWORD ?? "nafath-staff-2026";

auth.post("/nafath/start", zValidator("json", NafathStartSchema, validationHook), async (c) => {
  const { nationalId } = c.req.valid("json");
  try {
    const { sessionId, verificationNumber } = await getNafath().login(nationalId);
    return c.json({ data: { sessionId, verificationNumber } });
  } catch (e) {
    throw new HTTPException(400, { message: e instanceof Error ? e.message : "تعذّر بدء نفاذ." });
  }
});

auth.post("/nafath/confirm", zValidator("json", NafathConfirmSchema, validationHook), async (c) => {
  const { nationalId, sessionId } = c.req.valid("json");
  const identity = await getNafath().poll(sessionId);
  if (!identity) {
    throw new HTTPException(401, { message: "لم تُنجَز المطابقة في نفاذ بعد." });
  }

  const admin = createServiceClient();
  const email = emailFor(nationalId);

  // تأكيد وجود المستخدم بكلمة سرّ الجسر (تطويريّ فقط).
  const created = await admin.auth.admin.createUser({
    email,
    password: BRIDGE_PASSWORD,
    email_confirm: true,
    user_metadata: { national_id: nationalId, name: identity.name, source: "nafath" },
  });
  if (created.error && !/registered|already/i.test(created.error.message)) {
    throw new HTTPException(500, { message: created.error.message });
  }
  if (created.error) {
    // موجودٌ مسبقاً (ربما أُنشئ من الويب بكلمة سرّ مختلفة) — نوائم كلمة السرّ لإصدار جلسة.
    const { data: list } = await admin.auth.admin.listUsers();
    const existing = list.users.find((u) => u.email === email);
    if (existing) {
      await admin.auth.admin.updateUserById(existing.id, { password: BRIDGE_PASSWORD });
    }
  }

  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  const { data, error } = await anon.auth.signInWithPassword({ email, password: BRIDGE_PASSWORD });
  if (error || !data.session) {
    throw new HTTPException(500, { message: error?.message ?? "تعذّر إصدار الجلسة." });
  }

  return c.json({
    data: {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at,
      user: { id: data.user.id, name: identity.name, nationalId },
    },
  });
});
