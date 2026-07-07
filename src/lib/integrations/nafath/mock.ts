import type {
  NafathAdapter,
  NafathIdentity,
  NafathLoginChallenge,
} from "./types";

/**
 * مزوّد محاكاة «نفاذ» للتطوير والاختبار — خلف نفس واجهة المُحوِّل الحيّ.
 * يُوافق على المطابقة فوراً عند أول استطلاع. لا نداءات خارجية.
 */

type MockSession = { nationalId: string; identity: NafathIdentity };
const sessions = new Map<string, MockSession>();

// أسماء تجريبية لتوليد هوية معقولة من رقم الهوية (محاكاة فقط).
const FIRST = ["محمد", "أحمد", "عبدالله", "خالد", "سعد", "فهد", "نورة", "سارة"];
const FAMILY = ["الشهري", "الغامدي", "القحطاني", "الحربي", "العتيبي", "الدوسري"];

function fakeIdentity(nationalId: string): NafathIdentity {
  const n = Number(nationalId.slice(-4)) || 0;
  return {
    nationalId,
    name: `${FIRST[n % FIRST.length]} ${FAMILY[(n >> 2) % FAMILY.length]}`,
    nationality: "سعودي",
  };
}

export function createMockNafath(): NafathAdapter {
  return {
    mode: "mock",

    async login(nationalId: string): Promise<NafathLoginChallenge> {
      if (!/^\d{10}$/.test(nationalId)) {
        throw new Error("رقم الهوية يجب أن يكون 10 أرقام.");
      }
      const sessionId = `mock_${nationalId}_${Date.now()}`;
      sessions.set(sessionId, { nationalId, identity: fakeIdentity(nationalId) });
      // رقم تحقّق من رقمين (كما في نفاذ الحقيقيّ)، مشتقّ لثباته خلال الجلسة.
      const verificationNumber = 10 + (Number(nationalId.slice(-2)) % 90);
      return { sessionId, verificationNumber };
    },

    async poll(sessionId: string): Promise<NafathIdentity | null> {
      // المحاكاة توافق فوراً.
      return sessions.get(sessionId)?.identity ?? null;
    },

    async verifyForSignature(sessionId: string): Promise<boolean> {
      return sessions.has(sessionId);
    },
  };
}
