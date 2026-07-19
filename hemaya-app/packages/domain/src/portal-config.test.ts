import { describe, expect, it } from "vitest";
import {
  EVALUATOR_CONFIG,
  PORTAL_CONFIGS,
  STAGE_FLOW,
  STUDIER_CONFIG,
  TRIAGE_CONFIG,
  TRIAGE_LEAD_CONFIG,
} from "./portal-config";
import { addBusinessDays, businessDaysBetween, isBusinessDay } from "./sla";

// حالات السجل في مرحلة الدراسة والتقييم: new (مُسنَد بلا مخرَج) · done (مخرَج معتمَد)
describe("nextAction — الدارس", () => {
  it("طلبٌ مُسنَد بلا دراسة → إعداد الدراسة ضمن يوم عمل بمظلّة 3 أيام (م10)", () => {
    const act = STUDIER_CONFIG.nextAction({ status: "new" });
    expect(act).not.toBeNull();
    expect(act!.t).toBe("إعداد الدراسة واعتماده وإرساله — يوم عمل ضمن مظلّة 3 أيام (م10)");
    expect(act!.icon).toBe("rate_review");
  });

  it("مخرَجٌ معتمَد → لا إجراء (لا تعرض البوابة إجراء مرحلةٍ أخرى)", () => {
    expect(STUDIER_CONFIG.nextAction({ status: "done" })).toBeNull();
  });

  it("حالة خارج مرحلة البوابة → لا إجراء", () => {
    expect(STUDIER_CONFIG.nextAction({ status: "submitted" })).toBeNull();
    expect(STUDIER_CONFIG.nextAction({ status: "in_decision" })).toBeNull();
  });
});

describe("nextAction — المقيّم", () => {
  it("طلبٌ مُسنَد بلا تقييم → إعداد التقييم (م10)", () => {
    const act = EVALUATOR_CONFIG.nextAction({ status: "new" });
    expect(act).not.toBeNull();
    expect(act!.t).toBe("إعداد التقييم واعتماده وإرساله — يوم عمل ضمن مظلّة 3 أيام (م10)");
    expect(act!.icon).toBe("psychology");
  });

  it("مخرَجٌ معتمَد → لا إجراء", () => {
    expect(EVALUATOR_CONFIG.nextAction({ status: "done" })).toBeNull();
  });
});

describe("إعدادات الدارس/المقيّم — قيم المصفوفة حرفياً", () => {
  for (const cfg of [STUDIER_CONFIG, EVALUATOR_CONFIG]) {
    it(`${cfg.portal}: لوحة افتراضية · بلا طوارئ · رمز سري · عزل مُسنَد · المرحلة 4 من 6`, () => {
      expect(cfg.defaultScreen).toBe("dashboard");
      expect(cfg.emergencyButton).toBe(false);
      expect(cfg.identityMode).toBe("secret-code");
      expect(cfg.identityRevealSeconds).toBe(6);
      expect(cfg.isolationScope).toBe("assigned");
      expect(cfg.stage).toEqual({ index: 4, total: 6 });
      expect(STAGE_FLOW[cfg.stage.index - 1]).toBe("الدراسة والتقييم");
      // «الملف الشخصي» آخر القائمة دائماً
      expect(cfg.screens[cfg.screens.length - 1]).toBe("profile");
      expect(cfg.screens[0]).toBe("dashboard");
      // الموظف يبدأ المراسلة، مع القيادة فقط، خيط معزول لكل طلب نشط
      expect(cfg.messaging.mode).toBe("initiator");
      expect(cfg.messaging.parties.map((p) => p.id)).toEqual(["deputy", "chair"]);
      expect(cfg.messaging.perCaseThread).toBe(true);
      expect(cfg.messaging.activeCasesOnly).toBe(true);
      expect(cfg.messaging.deliveryReceipt).toBe("سُلّمت — مسجّلة في التدقيق");
      expect(cfg.messaging.identityTag).toBe("بالهوية الوظيفية");
      // فئات الإشعارات الأربع
      expect(cfg.notifCategories.map((c) => c.id)).toEqual(["assign", "deadline", "output", "msg"]);
      // م10: يوم عمل ضمن مظلّة 3 أيام
      expect(cfg.sla.output.totalBusinessDays).toBe(1);
      expect(cfg.sla.output.umbrellaDays).toBe(3);
      expect(cfg.sla.output.article).toBe("م10");
    });
  }

  it("السجلّ يحوي الدورين وكل دورٍ بدوره الصحيح", () => {
    expect(PORTAL_CONFIGS.studier.roles).toEqual(["studier"]);
    expect(PORTAL_CONFIGS.evaluator.roles).toEqual(["evaluator"]);
    expect(PORTAL_CONFIGS.studier.strings.output).toBe("الدراسة");
    expect(PORTAL_CONFIGS.evaluator.strings.output).toBe("التقييم");
  });
});

// حالات سجلّ الفرز: triage (وارد جديد) · replied (وردت التوصية) · pending (لدى الجهة) · study/closed (مُنجز)
describe("nextAction — موظف الفرز", () => {
  it("وردت التوصية → اتخاذ قرار الفرز (م10) — الأولوية الأولى", () => {
    const act = TRIAGE_CONFIG.nextAction({ status: "replied" });
    expect(act).not.toBeNull();
    expect(act!.t).toBe("وردت توصية الجهة — اتخاذ قرار الفرز (م10)");
    expect(act!.icon).toBe("gavel");
  });

  it("وارد جديد → محضر اتصال ثم الفحص الشكلي فقرار الفرز (م7)", () => {
    const act = TRIAGE_CONFIG.nextAction({ status: "triage" });
    expect(act!.t).toBe("محضر اتصال موثّق ثم الفحص الشكلي فقرار الفرز (م7)");
    expect(act!.icon).toBe("fact_check");
  });

  it("وارد ورقيّ → صيغة الهوية غير الموثّقة", () => {
    const act = TRIAGE_CONFIG.nextAction({ status: "triage", paper: true });
    expect(act!.t).toBe("ورود ورقيّ (هوية غير موثّقة) — محضر اتصال ثم الفحص الشكلي (م7)");
  });

  it("بانتظار الجهة أو مُنجز → لا إجراء على الموظف", () => {
    expect(TRIAGE_CONFIG.nextAction({ status: "pending" })).toBeNull();
    expect(TRIAGE_CONFIG.nextAction({ status: "study" })).toBeNull();
    expect(TRIAGE_CONFIG.nextAction({ status: "closed" })).toBeNull();
  });
});

describe("nextAction — قيادة الفرز (إشراف)", () => {
  it("تجاوز مهلة الجهة → مراجعة التصعيد", () => {
    const act = TRIAGE_LEAD_CONFIG.nextAction({ status: "pending", sla: { totalDays: 5, daysElapsed: 5 } });
    expect(act).not.toBeNull();
    expect(act!.icon).toBe("priority_high");
  });

  it("مهلة جارية أو وارد جديد → لا إجراء على القيادة (لا تدخّل في قرار الموظف)", () => {
    expect(TRIAGE_LEAD_CONFIG.nextAction({ status: "pending", sla: { totalDays: 5, daysElapsed: 2 } })).toBeNull();
    expect(TRIAGE_LEAD_CONFIG.nextAction({ status: "pending" })).toBeNull();
    expect(TRIAGE_LEAD_CONFIG.nextAction({ status: "triage" })).toBeNull();
    expect(TRIAGE_LEAD_CONFIG.nextAction({ status: "replied" })).toBeNull();
  });
});

describe("إعدادات الفرز — قيم المصفوفة حرفياً", () => {
  for (const cfg of [TRIAGE_CONFIG, TRIAGE_LEAD_CONFIG]) {
    it(`${cfg.portal}/${cfg.label}: لوحة افتراضية · بلا طوارئ · رمز سري · قائمة مشتركة · المرحلة 2 من 6`, () => {
      expect(cfg.defaultScreen).toBe("dashboard");
      expect(cfg.emergencyButton).toBe(false); // العاجل لا يدخل الفرز (م8)
      expect(cfg.identityMode).toBe("secret-code");
      expect(cfg.identityRevealSeconds).toBe(6);
      expect(cfg.isolationScope).toBe("shared-queue");
      expect(cfg.stage).toEqual({ index: 2, total: 6 });
      expect(STAGE_FLOW[cfg.stage.index - 1]).toBe("الفرز المبدئي");
      expect(cfg.screens[0]).toBe("dashboard");
      expect(cfg.screens[cfg.screens.length - 1]).toBe("profile");
      expect(cfg.screens).toContain("queue");
      // مهلة توصية الجهة: 5 أيام عمل (م5/4)
      expect(cfg.sla.output.slaId).toBe("recommendation");
      expect(cfg.sla.output.totalBusinessDays).toBe(5);
      // الطرفان: طالب الحماية بالرمز السري والجهة بضابط الاتصال
      expect(cfg.messaging.parties.map((p) => p.id)).toEqual(["seeker", "entity"]);
      expect(cfg.messaging.perCaseThread).toBe(true);
      expect(cfg.messaging.activeCasesOnly).toBe(true);
      expect(cfg.messaging.identityTag).toBe("بالرمز السري");
    });
  }

  it("الموظف يبدأ المراسلة والقيادة اطّلاع فقط", () => {
    expect(TRIAGE_CONFIG.messaging.mode).toBe("initiator");
    expect(TRIAGE_LEAD_CONFIG.messaging.mode).toBe("read-only");
  });

  it("تسميات شاشة القائمة تختلف بالدور (شاشة queue من screenMeta)", () => {
    expect(TRIAGE_CONFIG.screenMeta!.queue!.t).toBe("الطلبات الواردة");
    expect(TRIAGE_LEAD_CONFIG.screenMeta!.queue!.t).toBe("سجلّ الفرز");
  });

  it("السجلّ يحوي الإعدادين بأدوارهما", () => {
    expect(PORTAL_CONFIGS.triage.roles).toEqual(["case_officer"]);
    expect(PORTAL_CONFIGS["triage-lead"].roles).toEqual(["deputy_chair", "board_chair"]);
  });
});

describe("أيام العمل (الأحد–الخميس)", () => {
  it("الجمعة والسبت عطلة", () => {
    expect(isBusinessDay(new Date("2026-07-17"))).toBe(false); // جمعة
    expect(isBusinessDay(new Date("2026-07-18"))).toBe(false); // سبت
    expect(isBusinessDay(new Date("2026-07-19"))).toBe(true); // أحد
  });

  it("يوم عملٍ من الخميس → الأحد (يتجاوز العطلة)", () => {
    const d = addBusinessDays(new Date("2026-07-16"), 1); // خميس
    expect(d.getDay()).toBe(0); // الأحد
    expect(d.getDate()).toBe(19);
  });

  it("المنقضي من الخميس إلى الأحد = يوم عملٍ واحد", () => {
    expect(businessDaysBetween(new Date("2026-07-16"), new Date("2026-07-19"))).toBe(1);
  });
});
