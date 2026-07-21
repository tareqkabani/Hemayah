// اختبارات مكوّنات شاشات الدراسة والتقييم — تحديث مراجع 2026-07-21:
// «الطلبات الواردة» · المستندان المطويّان · عارض المرفقات السرّي · بندا الاطّلاع.
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { PORTAL_CONFIGS } from "@hemaya/domain";
import { Tasks, SeekerReq, AuthRec, AttViewer, UnifiedForm, Dashboard, Profile } from "./screens";

const CFG_S = PORTAL_CONFIGS.studier;
const CFG_E = PORTAL_CONFIGS.evaluator;

const task = (over = {}) => ({
  caseId: "c1",
  secret: "C-2026-0001",
  refNo: "REF-2026-0001",
  cat: "شاهد",
  track: "عادي",
  foreign: null,
  peers: 3,
  status: "new",
  due: "متبقٍّ يوم عمل",
  timer: { total: 1, elapsed: 0, ref: "يوم عمل · م10" },
  createdAt: "2026-07-20T08:00:00Z",
  ...over,
});

const DETAIL = {
  request: {
    submitted_at: "2026-07-19T09:30:00Z",
    details: {
      role: "أصيل — عن نفسه",
      prior_submit: true,
      prior_entity: "النيابة العامة",
      crime: "الجرائم الاقتصادية",
      waqia: "فساد إداري ومالي",
      threat: "مرتفع",
      case_no: "ق-0001/1447",
      reason: "تلقيّت تهديدات مباشرة عقب شهادتي.",
      files: ["صورة محضر الشهادة", "لقطات رسائل التهديد"],
    },
  },
  recommendation: {
    source_body: "النيابة العامة — فرع الرياض",
    decision: "توفير",
    proposed_type: ["الحماية الأمنية", "إخفاء البيانات الشخصية"],
    proposed_duration: null,
    received_at: "2026-07-20T10:00:00Z",
    notes: "جسامة الجريمة ووجود خطر شديد.",
    factors9: { "القدرة على التكيف": "نعم" },
    details: {
      officer: "أ. فهد القحطاني",
      rec_ref: "REC-2026-1183",
      approved_by: "رئيس الفرع المباشر",
      health: "سليم",
      stage: "التحقيق",
      case_summary: "قضية جرائم اقتصادية.",
      role_desc: "شاهد رئيسي.",
      contacted: "نعم — حضوري",
      threat_type: "تهديد مباشر بالقتل",
      harm_type: "اعتداء جسدي",
      extends_who: "الزوج والأبناء",
      attachments: ["تقرير تقييم المخاطر", "طلب الحماية المسبّب"],
    },
  },
};

describe("الطلبات الواردة (Tasks)", () => {
  it("تحمل التسمية المعتمدة لا «المهام المُسندة»", () => {
    render(<Tasks cfg={CFG_S} rows={[task()]} open={() => {}} />);
    expect(screen.getByRole("heading", { name: "الطلبات الواردة" })).toBeTruthy();
    expect(screen.queryByText(/المهام المُسندة/)).toBeNull();
  });

  it("النقر يفتح الطلب الجديد فقط، والمكتمل يحمل وسم «مكتملة»", () => {
    const open = vi.fn();
    render(
      <Tasks
        cfg={CFG_S}
        rows={[task(), task({ caseId: "c2", secret: "C-2026-0002", status: "done", due: "مكتملة" })]}
        open={open}
      />
    );
    fireEvent.click(screen.getByText("C-2026-0001").closest("tr"));
    fireEvent.click(screen.getByText("C-2026-0002").closest("tr"));
    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0][0].secret).toBe("C-2026-0001");
    expect(screen.getAllByText("مكتملة").length).toBeGreaterThan(0);
  });

  it("الطلب الأجنبي يحمل شارة «أجنبي · م6»", () => {
    render(<Tasks cfg={CFG_S} rows={[task({ foreign: { country: "الأردن" } })]} open={() => {}} />);
    expect(screen.getByText(/أجنبي · م6/)).toBeTruthy();
  });
});

describe("طلب الحماية الكامل (SeekerReq)", () => {
  it("مطويّ افتراضاً ويُفتح بالنقر على ترويسته", () => {
    render(<SeekerReq task={task()} detail={DETAIL} viewer="أ. خالد" onOpenDoc={() => {}} />);
    expect(screen.queryByText(/تلقيّت تهديدات/)).toBeNull();
    fireEvent.click(screen.getByText("طلب الحماية كما ورد من طالب الحماية"));
    expect(screen.getByText("REF-2026-0001")).toBeTruthy();
    expect(screen.getByText(/تلقيّت تهديدات/)).toBeTruthy();
    expect(screen.getByText("نعم — النيابة العامة")).toBeTruthy();
  });

  it("فتح مرفق يستدعي onOpenDoc (صف تدقيق) ويعرضه في العارض السرّي بلا أي رابط", () => {
    const onOpenDoc = vi.fn();
    render(<SeekerReq task={task()} detail={DETAIL} viewer="أ. خالد" onOpenDoc={onOpenDoc} />);
    fireEvent.click(screen.getByText("طلب الحماية كما ورد من طالب الحماية"));
    fireEvent.click(screen.getByText("صورة محضر الشهادة"));

    expect(onOpenDoc).toHaveBeenCalledWith(expect.objectContaining({ caseId: "c1" }), "صورة محضر الشهادة");
    expect(screen.getByText("عرض فقط — يُمنع التنزيل والتداول")).toBeTruthy();
    expect(screen.getAllByText(/مُطّلع: أ. خالد/).length).toBeGreaterThan(0);
    expect(document.querySelectorAll("a").length).toBe(0);
  });

  it("زر الإغلاق وEscape يغلقان العارض", () => {
    render(<SeekerReq task={task()} detail={DETAIL} viewer="أ. خالد" onOpenDoc={() => {}} />);
    fireEvent.click(screen.getByText("طلب الحماية كما ورد من طالب الحماية"));
    fireEvent.click(screen.getByText("صورة محضر الشهادة"));
    expect(screen.getByText("عرض فقط — يُمنع التنزيل والتداول")).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByText("عرض فقط — يُمنع التنزيل والتداول")).toBeNull();
  });
});

describe("التوصية الكاملة (AuthRec)", () => {
  it("مطوية افتراضاً، وعند الفتح: 8 أقسام تبدأ بالجهة صاحبة التوصية وتُختم بتوقيع رقمي", () => {
    const { container } = render(<AuthRec task={task()} detail={DETAIL} viewer="أ. خالد" onOpenDoc={() => {}} />);
    expect(screen.queryByText("الجهة صاحبة التوصية")).toBeNull();
    fireEvent.click(screen.getByText("التوصية الكاملة من الجهة المختصة"));

    const groups = container.querySelectorAll(".grp-n");
    expect(groups).toHaveLength(8);
    expect(screen.getByText("الجهة صاحبة التوصية")).toBeTruthy();
    expect(screen.getByText("أ. فهد القحطاني")).toBeTruthy();
    expect(screen.getByText("REC-2026-1183")).toBeTruthy();
    expect(screen.getByText("موقّعة رقمياً")).toBeTruthy();
    expect(screen.getByText("تقرير تقييم المخاطر")).toBeTruthy();
  });

  it("توصية بلا مرفقات تعرض رسالة بديلة ولا تنهار", () => {
    const detail = {
      ...DETAIL,
      recommendation: { ...DETAIL.recommendation, details: { ...DETAIL.recommendation.details, attachments: [] } },
    };
    render(<AuthRec task={task()} detail={detail} viewer="أ. خالد" onOpenDoc={() => {}} />);
    fireEvent.click(screen.getByText("التوصية الكاملة من الجهة المختصة"));
    expect(screen.getByText("لا مرفقات مسجّلة على التوصية.")).toBeTruthy();
  });
});

describe("صدق البيانات — لا اختلاق لغائب (تحقّق عدائي 2026-07-22)", () => {
  it("توصية بلا details لا تختلق وقائع شخصية — تُعرض «—» والحقول الحقيقية فقط", () => {
    const detail = {
      ...DETAIL,
      recommendation: { ...DETAIL.recommendation, details: null },
    };
    render(<AuthRec task={task()} detail={detail} viewer="x" onOpenDoc={() => {}} />);
    fireEvent.click(screen.getByText("التوصية الكاملة من الجهة المختصة"));
    expect(screen.queryByText("سليم")).toBeNull();
    expect(screen.queryByText("لا يرغب")).toBeNull();
    expect(screen.queryByText("رئيس الفرع المباشر")).toBeNull();
    expect(screen.getAllByText("النيابة العامة — فرع الرياض").length).toBeGreaterThan(0);
    expect(screen.getAllByText("—").length).toBeGreaterThan(3);
  });

  it("مدة التوصية الفعلية تُعرض لا افتراض «ثلاثون يوماً» المسطّح", () => {
    const detail = {
      ...DETAIL,
      recommendation: { ...DETAIL.recommendation, proposed_duration: "90 days" },
    };
    render(<AuthRec task={task()} detail={detail} viewer="x" onOpenDoc={() => {}} />);
    fireEvent.click(screen.getByText("التوصية الكاملة من الجهة المختصة"));
    expect(screen.getByText("90 يوماً")).toBeTruthy();
    expect(screen.queryByText("ثلاثون يوماً")).toBeNull();
  });

  it("امتداد الخطر بحسب الطالب (م5/4) يظهر في طلب الحماية", () => {
    const detail = {
      ...DETAIL,
      request: { ...DETAIL.request, details: { ...DETAIL.request.details, extends: "الزوج والأبناء", entity: "النيابة العامة" } },
    };
    render(<SeekerReq task={task()} detail={detail} viewer="x" onOpenDoc={() => {}} />);
    fireEvent.click(screen.getByText("طلب الحماية كما ورد من طالب الحماية"));
    expect(screen.getByText("امتداد الخطر إلى الغير — بحسب الطالب (م5/4)")).toBeTruthy();
    expect(screen.getByText("الجهة المختصة (بحسب الطلب)")).toBeTruthy();
  });

  it("تفاصيل الطلب النصية (النمط القديم) تُعرض سرداً في المسوّغات لا تضيع", () => {
    const detail = { request: { submitted_at: null, details: "سردٌ نصيّ قديم للواقعة." }, recommendation: null };
    render(<SeekerReq task={task()} detail={detail} viewer="x" onOpenDoc={() => {}} />);
    fireEvent.click(screen.getByText("طلب الحماية كما ورد من طالب الحماية"));
    expect(screen.getByText("سردٌ نصيّ قديم للواقعة.")).toBeTruthy();
  });
});

describe("عارض المرفقات السرّي (AttViewer)", () => {
  it("يمنع قائمة السياق ويعرض تنبيه التدقيق والعلامة المائية باسم المُطّلع", () => {
    const { container } = render(
      <AttViewer doc="تقرير طبي" secret="C-2026-0001" viewer="أ. منى" onClose={() => {}} />
    );
    const scrim = container.firstChild;
    const prevented = !fireEvent.contextMenu(scrim);
    expect(prevented).toBe(true);
    expect(screen.getByText(/مُسجّل في التدقيق/)).toBeTruthy();
    expect(screen.getAllByText(/مُطّلع: أ. منى/).length).toBeGreaterThan(0);
    expect(container.querySelectorAll("a")).toHaveLength(0);
  });

  it("زرّا الإغلاق يستدعيان onClose", () => {
    const onClose = vi.fn();
    render(<AttViewer doc="تقرير" secret="C-1" viewer="x" onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("إغلاق العارض"));
    fireEvent.click(screen.getByText(/إغلاق الاطّلاع/));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe("شاشة الطلب (UnifiedForm)", () => {
  const renderForm = (over = {}) => {
    const onSubmit = vi.fn();
    const utils = render(
      <UnifiedForm
        cfg={CFG_S}
        me={{ name: "أ. خالد العنزي" }}
        task={task(over.task)}
        detail={DETAIL}
        back={() => {}}
        onSubmit={onSubmit}
        onReveal={() => {}}
        onOpenDoc={() => {}}
        busy={false}
        {...over.props}
      />
    );
    return { onSubmit, ...utils };
  };

  it("تعرض بيانات الورود والإحالة والمستندين المطويين وشريط توقيع نفاذ", () => {
    renderForm();
    expect(screen.getByText("بيانات الورود والإحالة")).toBeTruthy();
    expect(screen.getByText("طلب الحماية كما ورد من طالب الحماية")).toBeTruthy();
    expect(screen.getByText("التوصية الكاملة من الجهة المختصة")).toBeTruthy();
    expect(screen.getByText(/يُوثّق آلياً عبر نفاذ/)).toBeTruthy();
  });

  it("زر الاعتماد معطّل حتى اختيار الرأي", () => {
    renderForm();
    const submit = screen.getByRole("button", { name: /اعتماد وإرسال/ });
    expect(submit.disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "قبول كلي" }));
    expect(submit.disabled).toBe(false);
  });

  it("بندا الاطّلاع يصلان onSubmit كما اختيرا (يوجد / لا يوجد)", () => {
    const { onSubmit } = renderForm();
    fireEvent.click(screen.getAllByRole("button", { name: "يوجد" })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "لا يوجد" })[1]);
    fireEvent.click(screen.getByRole("button", { name: "قبول كلي" }));
    fireEvent.click(screen.getByRole("button", { name: /اعتماد وإرسال/ }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const f = onSubmit.mock.calls[0][1];
    expect(f.recExists).toBe("يوجد");
    expect(f.reqExists).toBe("لا يوجد");
    expect(f.rec).toBe("قبول كلي");
  });

  it("القبول الجزئي يُظهر خانة أسبابه، والرفض يُظهر قائمة الأسباب", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "قبول جزئي" }));
    expect(screen.getByPlaceholderText(/حدّد ما يُقبل/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "رفض الحماية" }));
    expect(screen.getByText("الجريمة ليست من الجرائم الكبيرة الموجبة للتوقيف")).toBeTruthy();
    expect(screen.queryByPlaceholderText(/حدّد ما يُقبل/)).toBeNull();
  });

  it("المسار الأجنبي (م6): لا مستندين، وتنبيه «لا طلب مباشر من الشخص»", () => {
    renderForm({
      task: {
        foreign: { country: "الأردن", authority: "النيابة العامة — عمّان", foreign_ref: "JOR/1", basis: "اتفاقية", city: "الرياض" },
        track: "أجنبي",
      },
    });
    expect(screen.queryByText("طلب الحماية كما ورد من طالب الحماية")).toBeNull();
    expect(screen.queryByText("التوصية الكاملة من الجهة المختصة")).toBeNull();
    expect(screen.getByText("لا طلب مباشر من الشخص")).toBeTruthy();
  });
});

describe("لوحة المعلومات (Dashboard)", () => {
  const rows = [
    task({ caseId: "a", secret: "C-NORMAL", track: "عادي" }),
    task({ caseId: "b", secret: "C-URGENT", track: "عاجل" }),
    task({ caseId: "c", secret: "C-DONE", status: "done" }),
  ];

  it("بطاقة العمل الأبرز تقدّم المسار العاجل، وزر الإجراء يفتح الطلب", () => {
    const openTask = vi.fn();
    render(<Dashboard cfg={CFG_S} rows={rows} openTask={openTask} go={() => {}} notifs={[]} onOpenNotif={() => {}} />);
    const hero = screen.getByText(/الإجراء المطلوب منك/).closest(".card");
    expect(within(hero).getByText("C-URGENT")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /اتّخذ الإجراء/ }));
    expect(openTask.mock.calls[0][0].secret).toBe("C-URGENT");
  });

  it("العدّادات قابلة للنقر وتفتح «الطلبات الواردة»", () => {
    const go = vi.fn();
    render(<Dashboard cfg={CFG_S} rows={rows} openTask={() => {}} go={go} notifs={[]} onOpenNotif={() => {}} />);
    fireEvent.click(screen.getByText("يتطلّب إجراءً منك").closest("button"));
    expect(go).toHaveBeenCalledWith("tasks");
  });

  it("بلا إجراءات معلّقة تظهر رسالة الاكتمال", () => {
    render(
      <Dashboard cfg={CFG_S} rows={[task({ status: "done" })]} openTask={() => {}} go={() => {}} notifs={[]} onOpenNotif={() => {}} />
    );
    expect(screen.getByText(/لا إجراءات معلّقة عليك الآن/)).toBeTruthy();
  });
});

describe("الملف الشخصي (Profile) — العزل الصفّي", () => {
  it("الدارس محجوب عن أي تقييم، والمقيّم محجوب عن أي دراسة", () => {
    const { unmount } = render(<Profile cfg={CFG_S} me={{ name: "خالد", emp: "EMP-4210" }} />);
    expect(screen.getByText("الاطّلاع على أيّ تقييم")).toBeTruthy();
    expect(screen.getByText("الاطّلاع على دراسات الدارسين الآخرين")).toBeTruthy();
    unmount();
    render(<Profile cfg={CFG_E} me={{ name: "منى", emp: "EMP-4233" }} />);
    expect(screen.getByText("الاطّلاع على أيّ دراسة")).toBeTruthy();
  });
});
