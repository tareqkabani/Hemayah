import type { NafathAdapter, NafathIdentity } from "./types";

const sessions = new Map<string, NafathIdentity>();
const FIRST = ["محمد", "أحمد", "عبدالله", "خالد", "سعد", "فهد", "نورة", "سارة"];
const FAMILY = ["الشهري", "الغامدي", "القحطاني", "الحربي", "العتيبي", "الدوسري"];

export function createMockNafath(): NafathAdapter {
  return {
    mode: "mock",
    async login(nid) {
      if (!/^\d{10}$/.test(nid)) throw new Error("رقم الهوية يجب أن يكون 10 أرقام.");
      const n = Number(nid.slice(-4)) || 0;
      const sessionId = `mock_${nid}_${nid.length}`;
      sessions.set(sessionId, { nationalId: nid, name: `${FIRST[n % FIRST.length]} ${FAMILY[(n >> 2) % FAMILY.length]}`, nationality: "سعودي" });
      return { sessionId, verificationNumber: 10 + (Number(nid.slice(-2)) % 90) };
    },
    async poll(sessionId) { return sessions.get(sessionId) ?? null; },
    async verifyForSignature(sessionId) { return sessions.has(sessionId); },
  };
}
