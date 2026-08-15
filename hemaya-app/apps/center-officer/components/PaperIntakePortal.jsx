"use client";
/* ============================================================
   وحدة الإدخال اليدوي للطلبات — بوابة موظف المركز.
   مرجع: حزمة تسليم «الإدخال اليدوي للطلبات» (13 أغسطس 2026).

   شاشتان + الملف الشخصي (قرار ٦): «الواردة» ما لم يُفرَّغ، و«المرسلة»
   ما فُرِّغ وأُرسل — والتفريغ نتيجةُ نقرةٍ من صفّ، لا عنصرَ تنقّلٍ قائماً
   بذاته. قيد الورود يُسجَّل مرّةً ويُورَّث مقفلاً (قرار ٥)، ومنه تُحسب
   المُهل النظامية (م10) لا من لحظة الإدخال.

   مسارات التفريغ الثلاثة (قرارا ١ و٢):
   · طالب الحماية — الموقع الإلكتروني (نفاذ · هوية موثّقة) أو حضوري
     (هوية غير موثّقة + محضر مقابلة إلزاميّ يقوم مقام محضر الاتصال).
   · جهة مختصّة — توصية على طلبٍ مُحال: ربطٌ إلزاميّ، هوية موروثة.
   · جهة مختصّة — طلب نيابةً عن الشخص: طلبٌ ابتدائيّ، هوية يدوية.

   الوحدة قابلة للعزل: مسارها ومكوّناتها وجداولها مستقلّة.
   ============================================================ */
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@hemaya/supabase/src/browser";
import { InlineAlert, PortalShell } from "@hemaya/ui";
import { PAPER_INTAKE_LABEL, buildFactors9, setHolidays } from "@hemaya/domain";
import {
  submitPaperIntake, submitPaperRecommendation,
  registerInbox, claimInbox,
} from "@/lib/paper-intake-actions";
import { I, todayISO, fmtD, chLabel, keyOf } from "./intake/parts";
import { Inbox } from "./intake/Inbox";
import { SentList } from "./intake/SentList";
import { ClerkProfile } from "./intake/ClerkProfile";
import { SeekerPaperForm } from "./intake/SeekerPaperForm";
import { EntityIntake } from "./intake/EntityIntake";
import "@hemaya/ui/shell.css";
import "./paper-intake.css";

const SCREENS = ["inbox", "sent", "profile"];
const SCREEN_META = {
  inbox: { t: "الواردة", icon: "move_to_inbox" },
  sent: { t: "المرسلة", icon: "send" },
  profile: { t: "الملف الشخصي", icon: "account_circle" },
};
const SHELL_CONFIG = { screens: SCREENS, screenMeta: SCREEN_META, label: PAPER_INTAKE_LABEL, identityMode: "no-pii" };

/* بطاقات المصدر — ثلاثٌ لا اثنتان: مسارا الجهة انفصلا شاشتين (قرار ٢) */
const SOURCES = [
  { id: "seeker", icon: "person", tone: "green", t: "من طالب الحماية",
    d: "من الموقع الإلكتروني (تقديم عبر نفاذ — يُطبع ويُدخل يدوياً) أو حضوريّ بمحضر مقابلة — بحقول النموذج كاملةً." },
  { id: "rec", icon: "link", tone: "bronze", t: "من جهة مختصّة — توصية على طلبٍ مُحال",
    d: "خطاب توصية وارد بالبريد على طلبٍ أحاله المركز للجهة. الربط بالطلب القائم إلزاميّ، والهوية موروثة موثّقة." },
  { id: "onbehalf", icon: "gavel", tone: "bronze", t: "من جهة مختصّة — طلب نيابةً عن الشخص",
    d: "خطاب رسمي تنشئ به الجهة طلباً ابتدائياً نيابةً عن الشخص (لا طلب قائم). الهوية تُدخَل يدوياً — غير موثّقة." },
];

export function PaperIntakePortal({ me, lists, inbox, sent, sentTotal, awaiting, holidays }) {
  // التقويم الرسميّ يُحقن قبل أوّل حساب مهلة (انظر نظيرتها في بوابة الفرز).
  setHolidays(holidays || []);
  const router = useRouter();

  // «الواردة» طابورٌ مشترك: ما يفرّغه زميلٌ يجب أن يختفي عند الجميع فوراً
  // (معيار القبول في التسليم) — لا عند تحديث الصفحة يدوياً. بلا فلترٍ على
  // الاشتراك: الفلترة على postgres_changes تُسقط أحداثاً لا تحمل العمود
  // المفلتَر في حمولتها (درس ناقل الإحالات).
  useEffect(() => {
    const sb = createClient();
    const ch = sb
      .channel("intake-inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "intake_inbox" },
        () => router.refresh())
      .subscribe();
    return () => { sb.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [active, setActive] = useState("inbox");
  const [collapsed, setCollapsed] = useState(false);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // حالة التفريغ
  const [stage, setStage] = useState("select");      // select | seeker | entity | done
  const [entityMode, setEntityMode] = useState("rec");
  const [preset, setPreset] = useState(null);        // صفّ الواردة المفتوح (أو null = تفريغ مباشر)
  const [meta, setMeta] = useState({ receivedDate: todayISO(), regNo: "" });
  const [done, setDone] = useState(null);

  const say = (m) => { setToast(m); setTimeout(() => setToast(""), 3200); };
  const top = () => { if (typeof window !== "undefined") window.scrollTo(0, 0); };

  const resetIntake = () => {
    setPreset(null); setDone(null); setErr("");
    setMeta({ receivedDate: todayISO(), regNo: "" });
    setStage("select");
  };
  const backToInbox = () => { resetIntake(); setActive("inbox"); router.refresh(); };

  /* ── الواردة: تسجيل واستلام وفتح ── */
  const onRegister = async (input) => {
    setErr(""); setBusy(true);
    const res = await registerInbox(input);
    setBusy(false);
    if (!res.ok) { setErr(res.error); return false; }
    say("سُجّل الوارد في الطابور");
    router.refresh();
    return true;
  };

  const onClaim = async (id) => {
    setErr(""); setBusy(true);
    const res = await claimInbox(id);
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    router.refresh();
  };

  // فتح صفٍّ للتفريغ: يُستلم أولاً (فلا يعمل عليه زميلان)، ثم يُورَّث قيده.
  const onOpen = async (row) => {
    setErr("");
    if (!row.claimedBy) { setBusy(true); const r = await claimInbox(row.id); setBusy(false); if (!r.ok) { setErr(r.error); return; } }
    setPreset({ inboxId: row.id, channel: row.channel, docKind: row.docKind });
    setMeta({ receivedDate: String(row.arrivedOn).slice(0, 10), regNo: row.regNo });
    setDone(null);
    if (row.channel === "mail") { setEntityMode(row.docKind === "rec" ? "rec" : "onbehalf"); setStage("entity"); }
    else setStage("seeker");
    setActive("intake"); top();
  };

  // فتح «مُحالة من الفرز»: قيد الورود يُدخَل الآن (الخطاب وصل)، والربط تلقائيّ.
  const onOpenRec = (r) => {
    setErr("");
    setPreset({ inboxId: null, channel: "mail", docKind: "rec", entity: r.entKey, caseId: r.caseId });
    setMeta({ receivedDate: todayISO(), regNo: "" });
    setDone(null); setEntityMode("rec"); setStage("entity"); setActive("intake"); top();
  };

  const onDirect = () => { resetIntake(); setActive("intake"); top(); };

  /* ── التفريغ: طلب طالب الحماية ── */
  const finishSeeker = async (_src, d) => {
    setErr(""); setBusy(true);
    const details = {
      paper_source: "seeker",
      channel: d.channel,
      city: d.cityIn || "",
      identity: {
        name: d.name || "", nid: d.nid || "", phone: d.phone || "",
        nationality: d.nat || "", dob: d.dob || "", marital: d.marital || "", email: d.email || "",
        source_verified: d.channel === "legacy", verified: false,
      },
      emergency_contact: { name: d.ecName || "", rel: d.ecRel || "", phone: d.ecPhone || "" },
      on_behalf: d.onBehalf === "نعم" ? { nid: d.repId || "", name: d.repName || "", age: d.repAge || "" } : null,
      // يُخزَّن اسم الملف (لا علامة true/false) — يظهر في شاشة النجاح وسجل الفرز
      attachments: [
        ...(d.scanReq ? [(d.channel === "legacy" ? "نسخة الطلب المطبوعة" : "صورة الطلب الورقيّ") + " — " + d.scanReq] : []),
        ...((d.channel !== "legacy" && d.scanId) ? ["صورة الهوية / الإقامة — " + d.scanId] : []),
        ...(d.extras || []),
      ],
      assess: { caseStage: "" },
      applicant_kind: d.role || "",
    };
    // محضر المقابلة الحضورية — تكتبه الدالة محضرَ تحقّقٍ بقناة inperson.
    if (d.channel === "inperson") details.interview = { date: d.ivDate, note: d.ivNote };
    if (d.channel === "legacy") details.legacy_request = { type: d.reqType || "طلب جديد", prevRef: d.prevRef || "" };

    const res = await submitPaperIntake({
      source: "seeker",
      applicantRole: d.role || "",
      // المخزَّن مفتاحُ البند لا تسميتُه — «ذو صلة» كانت تُخزَّن شاهداً بصمت
      category: keyOf(lists.app_category, d.category) || "witness",
      entity: d.entity || "",
      crime: d.crime || "",
      reason: d.reason || "",
      priorSubmit: d.priorSubmit === "نعم" || d.reqType === "يوجد طلب سابق",
      caseNo: d.caseNo || "",
      receivedDate: meta.receivedDate,
      regNo: meta.regNo,
      inboxId: preset?.inboxId || undefined,
      details,
    });
    setBusy(false);
    if (!res.ok) { setErr(res.error); top(); return; }
    setDone({
      ref: res.secret, src: "seeker", linked: false, channel: d.channel,
      attNames: details.attachments, regNo: meta.regNo, when: fmtD(meta.receivedDate), letter: null,
    });
    setStage("done"); router.refresh(); top();
  };

  /* ── التفريغ: مسار الجهة (توصية مربوطة أو طلب نيابةً) ── */
  const finishEntity = async ({ mode, entityLabel, letter, linkSel, form: d }) => {
    setErr(""); setBusy(true);
    const letterStamp = "خطاب " + letter.no + " بتاريخ " + fmtD(letter.date) + (letter.by ? " · مُعِدّه: " + letter.by : "");
    const regStamp = "قيد إداري " + meta.regNo + " · ورد ورقياً " + fmtD(meta.receivedDate);

    if (mode === "rec") {
      // توصية ورقية مربوطة بطلبٍ مُحال قائم — تُدمج في سجلّه (لا سجلّ مكرّر).
      const res = await submitPaperRecommendation({
        caseId: linkSel.caseId,
        provide: d.provide === "توفير",
        // الكتابة عبر العقد الموحّد (@hemaya/domain) — نقطة كتابةٍ واحدة للكاتبَين.
        factors9: buildFactors9({
          health: d.health, healthNote: d.healthNote,
          criminal: d.criminal, criminalNote: d.criminalNote,
          psych: d.psych, psychHistory: d.psychHistory, reveal: d.reveal,
          crimeType: d.crimeType, waqia: d.waqia, crimeDesc: d.crimeDesc, hideIdentity: d.hidden2,
          threatExists: d.threatExists, threatType: d.threatType, riskLevel: d.riskLevel,
          harmExists: d.harmExists, harmType: d.harmType,
          extendsOthers: d.extends, extendsWho: d.extendsWho, adapt: d.adapt,
          attachments: d.attachFiles,
          caseSummary: d.caseSummary, caseStage: d.caseStage, roleDesc: d.applicantRole,
          contacted: d.contacted, contactKind: d.contactKind,
          reasons: [d.why1, d.why2, d.why3].filter(Boolean),
          alternatives: d.alternatives, duration: d.duration, durationNote: d.durationNote,
        }),
        types: d.types || [],
        durationDays: d.duration === "ثلاثون يوماً" ? 30 : null,
        notes: "توصية " + entityLabel + " الواردة بخطاب رسمي عبر البريد بشأن الطلب المُحال (" + letterStamp + " · " + regStamp + ").",
        receivedDate: meta.receivedDate,
        regNo: meta.regNo,
        letterNo: letter.no,
        letterDate: letter.date,
        letterBy: letter.by,
        inboxId: preset?.inboxId || undefined,
      });
      setBusy(false);
      if (!res.ok) { setErr(res.error); top(); return; }
      setDone({
        ref: linkSel.secret, src: "entity", linked: true, channel: "mail",
        regNo: meta.regNo, when: fmtD(meta.receivedDate), letter: { no: letter.no, date: fmtD(letter.date) },
      });
      setStage("done"); router.refresh(); top();
      return;
    }

    // طلب نيابةً عن الشخص — سجلٌّ جديد بنموذج التوصية الكامل.
    const details = {
      paper_source: "entity", entity_mode: "onbehalf", channel: "mail",
      identity: {
        name: d.obName || "", nid: d.obNid || "", phone: d.obPhone || "", gender: d.obGender || "",
        nationality: d.obNationality || "", marital: d.obMarital || "", residence: d.obResidence || "",
        employer: d.obEmployer || "", education: d.obEducation || "", verified: false,
      },
      letter: { no: letter.no, date: letter.date, by: letter.by },
      recommendation: d.provide || null,
      attachments: (d.attachFiles || []).filter(Boolean),
      assess: {
        health: d.health || "", healthNote: d.healthNote || "",
        criminal: d.criminal || "", criminalNote: d.criminalNote || "",
        psych: d.psych || "", psychHistory: d.psychHistory || "", reveal: d.reveal || "",
        crimeType: d.crimeType || "", waqia: d.waqia || [], crimeDesc: d.crimeDesc || "", hidden2: d.hidden2 || "",
        threatExists: d.threatExists || "", threatType: d.threatType || "", riskLevel: d.riskLevel || "",
        harmExists: d.harmExists || "", harmType: d.harmType || "",
        extends: d.extends || "", extendsWho: d.extendsWho || "", adapt: d.adapt || "",
        caseSummary: d.caseSummary || "", caseStage: d.caseStage || "", applicantRoleDesc: d.applicantRole || "",
        contacted: d.contacted || "", contactKind: d.contactKind || "",
      },
      rec: {
        provide: d.provide || "", reasons: [d.why1, d.why2, d.why3].filter(Boolean),
        types: d.types || [], alternatives: d.alternatives || "",
        duration: d.duration || "", durationNote: d.durationNote || "",
      },
    };
    const res = await submitPaperIntake({
      source: "entity",
      applicantRole: "جهة مختصّة",
      category: keyOf(lists.app_category, d.role) || "witness",
      entity: entityLabel,
      crime: d.crimeDesc || d.reasons || d.caseSummary || "خطاب جهة (ورقيّ)",
      reason: [d.why1, d.why2, d.why3].filter(Boolean).join(" · ") || d.reasons || "مسوّغات الخطاب الوارد",
      priorSubmit: true,
      caseNo: d.caseNo || "",
      receivedDate: meta.receivedDate,
      regNo: meta.regNo,
      inboxId: preset?.inboxId || undefined,
      details,
    });
    setBusy(false);
    if (!res.ok) { setErr(res.error); top(); return; }
    setDone({
      ref: res.secret, src: "entity", linked: false, channel: "mail",
      attNames: details.attachments, regNo: meta.regNo, when: fmtD(meta.receivedDate),
      letter: { no: letter.no, date: fmtD(letter.date) },
    });
    setStage("done"); router.refresh(); top();
  };

  /* ── شاشة التفريغ ── */
  const renderIntake = () => {
    if (stage === "done") return <DoneCard done={done} onAgain={() => { resetIntake(); setActive("inbox"); }} />;

    if (stage === "seeker") {
      return (
        <div className="pi-wrap">
          {err && <InlineAlert kind="error" title="تعذّر التسجيل" style={{ marginBottom: 14 }}>{err}</InlineAlert>}
          <SeekerPaperForm
            key={(preset?.inboxId || "direct") + meta.regNo}
            lockedCh={preset?.channel === "mail" ? null : preset?.channel || null}
            meta={meta} setMeta={setMeta} lists={lists} busy={busy}
            onDone={finishSeeker}
            onBack={() => (preset ? backToInbox() : resetIntake())}
          />
        </div>
      );
    }

    if (stage === "entity") {
      return (
        <EntityIntake
          key={(preset?.inboxId || preset?.caseId || "direct") + entityMode}
          mode={entityMode}
          meta={meta} setMeta={setMeta}
          locked={!!preset?.inboxId}
          presetEntity={preset?.entity}
          presetCaseId={preset?.caseId}
          lists={lists} busy={busy} err={err}
          onBack={() => (preset ? backToInbox() : resetIntake())}
          onSubmit={finishEntity}
        />
      );
    }

    // اختيار المصدر — للتفريغ المباشر بلا قيدٍ مُسبق
    return (
      <div className="pi-wrap">
        <div className="kick">بوابة موظف المركز · {PAPER_INTAKE_LABEL}</div>
        <h1>تفريغ مباشر</h1>
        <p className="sub">اختر مصدر المستند الوارد. تُدخَل الحقول نفسها المعتمدة في البوابة الرقمية، فلا يضيع شيء عند الرقمنة. وإن كان المستند مسجَّلاً في «الواردة» فافتحه من هناك ليُورَّث قيده.</p>
        <div className="pick">
          {SOURCES.map((c) => (
            <button key={c.id} className="pick-card" onClick={() => {
              setErr(""); setMeta({ receivedDate: todayISO(), regNo: "" });
              if (c.id === "seeker") setStage("seeker");
              else { setEntityMode(c.id); setStage("entity"); }
              top();
            }}>
              <div className={"pick-ico " + c.tone}><I name={c.icon} size={24} color={c.tone === "green" ? "var(--color-primary)" : "var(--pp-bronze-ink)"} fill /></div>
              <h3>{c.t}</h3>
              <p>{c.d}</p>
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <PortalShell
      config={SHELL_CONFIG}
      // basePath صريحٌ في المسار: الأصول الثابتة لا يُلحق بها Next البادئة
      // تلقائياً، فبدونها يطلبها المتصفح من جذر النطاق فتعود 404.
      brand={{ logoSrc: "/center/brand/logo-center.png", portalTitle: PAPER_INTAKE_LABEL, markIcon: "move_to_inbox" }}
      user={{ name: me.name, verified: true }}
      active={active === "intake" ? "inbox" : active}
      onNavigate={(id) => { resetIntake(); setActive(id); top(); }}
      counters={{ inbox: inbox.length || null, sent: sent.length || null }}
      collapsed={collapsed}
      onToggleCollapsed={() => setCollapsed((c) => !c)}
      onLogout={() => { fetch("/auth/signout", { method: "POST" }).finally(() => { window.location.href = "/"; }); }}
      toast={toast}
    >
      {active === "inbox" && (
        <Inbox rows={inbox} awaiting={awaiting} busy={busy} err={err}
          onRegister={onRegister} onClaim={onClaim} onOpen={onOpen} onOpenRec={onOpenRec} onDirect={onDirect} />
      )}
      {active === "sent" && <SentList rows={sent} total={sentTotal} />}
      {active === "profile" && <ClerkProfile me={me} />}
      {active === "intake" && renderIntake()}
    </PortalShell>
  );
}

/* شاشة النجاح — تُبيّن الوجهة وقيد الورود وحالة الهوية وسند التدقيق */
function DoneCard({ done, onAgain }) {
  const legacy = done.channel === "legacy";
  const verified = done.linked || legacy;
  return (
    <div className="pi-wrap"><div className="card done-card">
      <div className="done-ico"><I name="task_alt" size={32} color="var(--color-primary)" fill /></div>
      <h1 style={{ marginBottom: 8 }}>{done.linked ? "سُجلت التوصية ودُمجت في صفّ الطلب المُحال القائم" : "سُجِّل الطلب وأُحيل للفرز المبدئي"}</h1>
      <p className="sub" style={{ marginBottom: 0 }}>
        الرمز <span className="mono">{done.ref}</span>
        {done.linked
          ? <> — رُبطت التوصية بالطلب المُحال نفسه فلا سجلّ مكرّر بالرمز السري، وانتقل في سجلّ الفرز إلى «قيد الدراسة».</>
          : <> — ظهر الآن في «الطلبات الواردة» بالفرز المبدئي، ويسلك مساره كأيّ طلب.</>}
      </p>
      <div className="flags">
        <div className="flag"><I name="description" size={17} /> قناة الورود: <b>{chLabel(done.channel)}{legacy ? " — طُبع وأُدخل يدوياً" : " — مُدخَل يدوياً"}</b></div>
        <div className="flag"><I name="tag" size={17} /> {legacy ? "مرجع الموقع الإلكتروني:" : "قيد الورود:"} <b className="mono" style={{ marginInline: 4 }}>{done.regNo}</b> · {legacy ? "قُدّم" : "ورد"} <b style={{ marginInline: 4 }}>{done.when}</b> — منه تُحسب المُهل (م10)</div>
        {done.letter && <div className="flag"><I name="mail" size={17} /> الخطاب الرسمي: <b className="mono" style={{ marginInline: 4 }}>{done.letter.no}</b> · بتاريخ <b style={{ marginInline: 4 }}>{done.letter.date}</b> — وارد بالبريد</div>}
        {verified
          ? <div className="flag"><I name="verified_user" size={17} /> الهوية: <b>{done.linked ? "موثّقة — موروثة من الطلب المُحال القائم" : "موثّقة — دخول عبر نفاذ في الموقع الإلكتروني"}</b></div>
          : <div className="flag"><I name="gpp_maybe" size={17} color="var(--pp-bronze-ink)" /> الهوية: <b style={{ color: "var(--pp-bronze-ink)" }}>غير موثّقة — تُفعَّل عبر نفاذ لاحقاً</b></div>}
        <div className="flag"><I name="attach_file" size={17} /> المرفقات: <b>{(done.attNames || []).length ? done.attNames.join(" · ") : done.linked ? "صورة الخطاب ومرفقاته" : "بلا مرفقات — اختيارية"}</b></div>
        <div className="flag"><I name="history" size={17} /> مُسجَّل في التدقيق: <b>باسمك · الآن</b></div>
        {done.channel === "inperson" && <div className="flag"><I name="record_voice_over" size={17} /> مقابلة طالب الحماية: <b>موثّقة بمحضر — يقوم مقام محضر الاتصال في الفرز</b></div>}
      </div>
      <div className="man ok" style={{ maxWidth: 620, margin: "18px auto 0", textAlign: "start" }}>
        <I name="conversion_path" size={16} />
        <span>{done.linked
          ? <>سُجّلت التوصية وأُحيل الملف كاملاً إلى <b>الدراسة والتقييم</b> — يظهر حيّاً في بوابتي الدارس والمقيّم، ثمّ <b>قرار المجلس ← الإشعار</b>.</>
          : <>بعد التفريغ يسلك الطلب دورة الحياة كاملةً كأيّ طلب رقمي: <b>الفرز المبدئي ← الدراسة والتقييم ← قرار المجلس ← الإشعار والاتفاقية ← التنفيذ والتجديد</b>.</>}</span>
      </div>
      <div style={{ marginTop: 22 }}><button className="btn btn-primary" onClick={onAgain}><I name="move_to_inbox" size={19} /> العودة للواردة</button></div>
    </div></div>
  );
}
