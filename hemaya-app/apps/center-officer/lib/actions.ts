"use server";
import { getNafath } from "@hemaya/auth";
import { createServiceClient, createServerClient } from "@hemaya/supabase";

// جسر دخول الموظّفين عبر نفاذ (mock). الأدوار تأتي من البذور (user_roles) لا من الدخول.
const emailFor = (nid: string) => `${nid}@nafath.local`;
const DEV_PASSWORD = "nafath-staff-2026";

export async function startLogin(nationalId: string) {
  const nid = nationalId.trim();
  if (!/^\d{10}$/.test(nid)) return { ok: false as const, error: "رقم الهوية يجب أن يكون 10 أرقام." };
  try {
    const { sessionId, verificationNumber } = await getNafath().login(nid);
    return { ok: true as const, sessionId, verificationNumber };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "تعذّر بدء نفاذ." };
  }
}

export async function confirmLogin(nationalId: string, sessionId: string) {
  const nid = nationalId.trim();
  const identity = await getNafath().poll(sessionId);
  if (!identity) return { ok: false as const, error: "لم تُنجَز المطابقة في نفاذ بعد." };

  const admin = createServiceClient();
  const email = emailFor(nid);
  const { error: createErr } = await admin.auth.admin.createUser({
    email, password: DEV_PASSWORD, email_confirm: true,
    user_metadata: { name: identity.name, national_id: nid, source: "nafath" },
  });
  if (createErr && !/already/i.test(createErr.message)) return { ok: false as const, error: createErr.message };

  const supabase = createServerClient();
  const { error: signErr } = await supabase.auth.signInWithPassword({ email, password: DEV_PASSWORD });
  if (signErr) return { ok: false as const, error: signErr.message };
  return { ok: true as const, name: identity.name };
}
