import type { HrdfAdapter } from "./types";
/** الموارد (بيانات العمل) — mock: null → إدخال يدويّ. */
export function createMockHrdf(): HrdfAdapter {
  return { mode: "mock", async getEmployment() { return null; } };
}
