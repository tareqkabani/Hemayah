"use server";

import { getNafath } from "@/lib/integrations/nafath";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * جسر دخول نفاذ (M2). في وضع mock: نفاذ يوافق فوراً؛ نبني جلسة Supabase
 * للمستخدم بدور «subject». البريد وكلمة السر جسرٌ تطويريّ فقط — في الحيّ
 * تُستبدل مصادقة Supabase بمطابقة نفاذ عبر الناقل الحكوميّ.
 */

// بريد/سرّ اشتقاقيّان للجسر التطويري (mock فقط).
const emailFor = (nid: string) => `${nid}@nafath.local`;
const DEV_PASSWORD = "nafath-mock-session-2026";

export type StartResult =
  | { ok: true; sessionId: string; verificationNumber: number }
  | { ok: false; error: string };

export async function startNafath(nationalId: string): Promise<StartResult> {
  const nid = nationalId.trim();
  if (!/^\d{10}$/.test(nid)) {
    return { ok: false, error: "رقم الهوية يجب أن يكون 10 أرقام." };
  }
  try {
    const nafath = getNafath();
    const { sessionId, verificationNumber } = await nafath.login(nid);
    return { ok: true, sessionId, verificationNumber };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "تعذّر بدء نفاذ." };
  }
}

export type ConfirmResult =
  | { ok: true; name: string }
  | { ok: false; error: string };

export async function confirmNafath(
  nationalId: string,
  sessionId: string,
): Promise<ConfirmResult> {
  const nid = nationalId.trim();
  const nafath = getNafath();

  const identity = await nafath.poll(sessionId);
  if (!identity) {
    return { ok: false, error: "لم تُنجَز المطابقة في تطبيق نفاذ بعد." };
  }

  const admin = createAdminClient();
  const email = emailFor(nid);

  // أنشئ مستخدم نفاذ إن لم يوجد (idempotent).
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: DEV_PASSWORD,
    email_confirm: true,
    user_metadata: {
      name: identity.name,
      national_id: nid,
      nationality: identity.nationality,
      source: "nafath",
    },
  });

  if (createErr && !/already been registered|already registered/i.test(createErr.message)) {
    return { ok: false, error: `تعذّر تجهيز الحساب: ${createErr.message}` };
  }

  // ابنِ جلسة عبر الكوكيز (SSR).
  const supabase = await createClient();
  const { data: signIn, error: signErr } = await supabase.auth.signInWithPassword({
    email,
    password: DEV_PASSWORD,
  });
  if (signErr || !signIn.user) {
    return { ok: false, error: `تعذّر إنشاء الجلسة: ${signErr?.message ?? ""}` };
  }

  // أسنِد دور «subject» (idempotent) — الأدوار في جدول منفصل.
  const userId = created?.user?.id ?? signIn.user.id;
  const { error: roleErr } = await admin
    .from("user_roles")
    .upsert(
      { user_id: userId, role: "subject" },
      { onConflict: "user_id,role", ignoreDuplicates: true },
    );
  if (roleErr) {
    return { ok: false, error: `تعذّر إسناد الدور: ${roleErr.message}` };
  }

  return { ok: true, name: identity.name };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
