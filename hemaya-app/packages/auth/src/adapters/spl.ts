import type { SplAdapter } from "./types";
/** سُبل (العنوان الوطني) — mock: يعيد null ليتحوّل الحقل إلى إدخال يدويّ. */
export function createMockSpl(): SplAdapter {
  return { mode: "mock", async getNationalAddress() { return null; } };
}
