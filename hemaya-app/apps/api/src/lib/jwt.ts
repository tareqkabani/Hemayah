import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * تحقّق محليّ من توكن نفاذ عبر JWKS (مفاتيح التوقيع العامّة ES256 من Supabase).
 * يتحقّق من التوقيع والمُصدِر والانتهاء رياضياً — بلا نداءٍ شبكيّ لكلّ طلب،
 * فأسرع وأصمد من auth.getUser(). (RLS يبقى يُفرَض في PostgREST عند الاستعلام.)
 * مجموعة المفاتيح تُجلَب مرّةً وتُخزَّن وتُحدَّث آلياً عند تدوير المفاتيح.
 */
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!jwks) {
    const url =
      process.env.SUPABASE_JWKS_URL ??
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/.well-known/jwks.json`;
    jwks = createRemoteJWKSet(new URL(url));
  }
  return jwks;
}

export interface VerifiedUser {
  id: string;
  email: string | null;
  nationalId: string | null;
}

/** يتحقّق ويعيد هويّة المستخدم؛ يرمي إن كان التوكن غير صالح أو منتهياً. */
export async function verifyAccessToken(token: string): Promise<VerifiedUser> {
  const issuer = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1`;
  const { payload } = await jwtVerify(token, getJwks(), {
    issuer,
    audience: "authenticated",
  });
  const meta = (payload.user_metadata ?? {}) as Record<string, unknown>;
  return {
    id: String(payload.sub),
    email: typeof payload.email === "string" ? payload.email : null,
    nationalId: typeof meta.national_id === "string" ? meta.national_id : null,
  };
}
