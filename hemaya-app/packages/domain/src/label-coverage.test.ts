// ============================================================
//  حارس التغطية — يربط خرائط التسميات العربية بقيم enums القاعدة
//  المولَّدة في types.gen (Constants). أي قيمة جديدة في القاعدة بلا
//  تسمية عربية (أو تسمية يتيمة لقيمة أُزيلت) = فشل CI فوري،
//  بدل أن يُكتشف الدرِفت مصادفةً في الواجهات.
// ============================================================
import { describe, it, expect } from "vitest";
import { Constants } from "@hemaya/supabase";
import { CASE_STATUS, CATEGORY, RISK_LEVEL, CASE_SOURCE } from "./enums";
import { ROLE_LABEL, PORTALS } from "./roles";
import { REFERRAL_AUTHORITY_LABEL, REFERRAL_SERVICES } from "./materials";
import { REGIONS, regionDisp } from "./regions";
import { CASE_TRANSITIONS } from "./case-state";

const ENUMS = Constants.public.Enums;
const sorted = (xs: readonly string[]) => [...xs].sort();

/** كل خريطة تسميات تُطابِق قيم نوعها في القاعدة واحدةً واحدة. */
const COVERAGE: Array<[string, Record<string, string>, readonly string[]]> = [
  ["ROLE_LABEL ↔ app_role", ROLE_LABEL, ENUMS.app_role],
  ["CASE_STATUS ↔ case_status", CASE_STATUS, ENUMS.case_status],
  ["CATEGORY ↔ app_category", CATEGORY, ENUMS.app_category],
  ["RISK_LEVEL ↔ risk_level", RISK_LEVEL, ENUMS.risk_level],
  ["CASE_SOURCE ↔ case_source", CASE_SOURCE, ENUMS.case_source],
  ["REFERRAL_AUTHORITY_LABEL ↔ referral_authority", REFERRAL_AUTHORITY_LABEL, ENUMS.referral_authority],
  ["REGIONS ↔ region_code", REGIONS, ENUMS.region_code],
];

describe("تغطية التسميات العربية لقيم القاعدة", () => {
  it.each(COVERAGE)("%s", (_name, map, values) => {
    expect(sorted(Object.keys(map))).toEqual(sorted(values));
  });

  it("لا تسمية فارغة", () => {
    for (const [, map] of COVERAGE)
      for (const label of Object.values(map)) expect(label.trim()).not.toBe("");
  });
});

describe("اتساق المراجع المشتقّة", () => {
  it("آلة حالة القضية تغطي كل الحالات ولا تنتقل لحالة غير معرّفة", () => {
    const statuses = new Set<string>(ENUMS.case_status);
    expect(sorted(Object.keys(CASE_TRANSITIONS))).toEqual(sorted(ENUMS.case_status));
    for (const targets of Object.values(CASE_TRANSITIONS))
      for (const t of targets) expect(statuses).toContain(t);
  });

  it("أدوار البوابات كلها أدوار معرّفة في القاعدة", () => {
    const roles = new Set<string>(ENUMS.app_role);
    for (const portal of PORTALS)
      for (const role of portal.roles) expect(roles).toContain(role);
  });

  it("خدمات الإحالة تُسنَد لجهات معرّفة", () => {
    const authorities = new Set<string>(ENUMS.referral_authority);
    for (const svc of REFERRAL_SERVICES) expect(authorities).toContain(svc.authority);
  });

  it("regionDisp: سابقة «منطقة» إلا للمعرَّف بـ«ال»، والرمز المجهول يمرّ بالسابقة نفسها", () => {
    expect(regionDisp("NAJ")).toBe("منطقة نجران");
    expect(regionDisp("EAS")).toBe("المنطقة الشرقية");
    expect(regionDisp("RUH")).toBe("الرياض");
    expect(regionDisp("XXX")).toBe("منطقة XXX");
  });
});
