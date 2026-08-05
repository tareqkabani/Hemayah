import { describe, it, expect } from "vitest";
import { DURATIONS, LEGACY_DURATION_30, LEGACY_DURATION_OTHER, isCustomDuration, durationDays } from "./durations";

describe("مدد الحماية الموحّدة", () => {
  it("الصياغة المعتمدة مثبَّتة حرفياً", () => {
    expect(DURATIONS).toEqual(["ثلاثون يوماً", "إلى حين انتهاء القضية", "مدة محدّدة"]);
  });

  it("العوْنيّات تفهم الصياغتين الجديدة والقديمة معاً", () => {
    expect(isCustomDuration("مدة محدّدة")).toBe(true);
    expect(isCustomDuration(LEGACY_DURATION_OTHER)).toBe(true);
    expect(isCustomDuration("إلى حين انتهاء القضية")).toBe(false);
    expect(isCustomDuration(null)).toBe(false);

    expect(durationDays("ثلاثون يوماً")).toBe(30);
    expect(durationDays(LEGACY_DURATION_30)).toBe(30);
    expect(durationDays("مدة محدّدة")).toBeNull();
    expect(durationDays(undefined)).toBeNull();
  });
});
