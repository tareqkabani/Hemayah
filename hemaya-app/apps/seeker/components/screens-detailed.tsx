"use client";
/* ============================================================
   الملف الشخصي وتقديم الطلب وطلباتي — دفعة 12 يوليو الثانية.
   الملف: تحسين تدريجي (نفاذ مقفل بقيمه؛ سُبل/الموارد إدخال يدوي
   بتحقّق رقمي إلى حين الربط) + زر حفظ واحد + «قيد تحقّق المركز».
   التقديم: حارس «طلب واحد نشط» يحجب النموذج مع وجود طلب قائم.
   طلباتي: وسم «يتطلّب إجراء» + الإجراء المطلوب + خط زمني سداسي
   + قسم «بيانات طلبك (كما قُدّمت)» قابل للطي.
   ============================================================ */
import React, { useState, useContext, useTransition, useEffect } from "react";
import { Card, Tag, InlineAlert } from "@hemaya/ui";
import { SecretCode } from "@hemaya/ui";
import { IdentityContext, RequestsContext, maskId, isOpenRequest } from "./identity-context";
import { submitRequest } from "../lib/seeker-actions";

export const CATEGORY_AR: Record<string, string> = { witness: "شاهد", reporter: "مبلّغ", expert: "خبير", victim: "ضحية", related: "ذو صلة" };
export const STATUS_AR: Record<string, { t: string; tone: string }> = {
  submitted: { t: "مُستلَم", tone: "info" }, triage: { t: "قيد الفرز المبدئي", tone: "info" },
  referred: { t: "محال للجهة المختصة", tone: "info" }, under_study: { t: "قيد الدراسة والتقييم", tone: "info" },
  classified: { t: "مُصنَّف", tone: "info" }, in_decision: { t: "قيد القرار", tone: "warning" },
  accepted: { t: "مقبول", tone: "success" }, rejected: { t: "مرفوض", tone: "error" },
  signed: { t: "موقَّع", tone: "success" }, active: { t: "حماية سارية", tone: "success" },
  under_review: { t: "قيد المراجعة", tone: "info" }, terminating: { t: "قيد الإنهاء", tone: "warning" },
  closed: { t: "مغلق", tone: "neutral" },
};

/* المراحل الست لرحلة الطلب — تُستخدم في طلباتي ومؤشر لوحة المعلومات */
export const STAGES = [
  { t: "تمّ استلام الطلب", d: "سُجِّل الطلب وأُسند الرمز السري." },
  { t: "الفرز المبدئي", d: "يتواصل المركز للتحقّق ويطلب الاستيفاء عند الحاجة." },
  { t: "الإحالة إلى الجهة المختصة", d: "لرفع التوصية خلال 5 أيام عمل." },
  { t: "الدراسة والتقييم", d: "تُدرس عوامل المادة (9) ويُصنَّف الخطر." },
  { t: "قرار إدارة البرنامج", d: "يصدر بالأغلبية ويُشعَر خلال 3 أيام." },
  { t: "تفعيل الحماية", d: "عند صدور قرار المركز بالشمول: توقيع وثيقة الحماية ودخول دورة الحياة." },
];
/* عدد المراحل المُنجزة لكل حالة قاعديّة (المرحلة الجارية = القيمة نفسها كفهرس) */
export const STAGE_INDEX: Record<string, number> = {
  submitted: 1, triage: 1, referred: 2, under_study: 3, classified: 3,
  in_decision: 4, accepted: 5, rejected: 4, signed: 6, active: 6,
  under_review: 6, terminating: 6, closed: 6,
};
/* الإجراء المطلوب من المستفيد بحسب حالة الطلب الحقيقية */
export function realNextAction(r: { status: string }): string | null {
  if (r.status === "accepted") return "مراجعة وتوقيع اتفاقية الحماية";
  if (r.status === "rejected") return "قرار بحاجة لردّك: التظلّم أو قبول القرار";
  return null;
}

const Ic = ({ name, size = 20, fill = false, color = "currentColor", style = {} }: any) => (
  <span className="material-symbols-rounded" style={{ fontSize: size, color, fontVariationSettings: `'FILL' ${fill ? 1 : 0}`, ...style }}>{name}</span>
);

/* ────────────────────────── الملف الشخصي (تحسين تدريجي) ────────────────────────── */
type Mode = "live" | "manual";

function ProSection({ icon, title, source, mode, pending, children }: any) {
  return (
    <Card className="card pad" style={{ marginBottom: 16 }}>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
        <div className="row"><Ic name={icon} size={20} color="var(--color-primary)" /><b style={{ color: "var(--text-strong)" }}>{title}</b></div>
        <div className="row" style={{ gap: 6 }}>
          {mode === "manual" && pending && <Tag tone="warning" size="sm" iconLeft={<Ic name="hourglass_top" size={13} />}>قيد تحقّق المركز</Tag>}
          {source && (mode === "manual"
            ? <Tag tone="warning" size="sm" iconLeft={<Ic name="link_off" size={13} />}>ربط {source} قيد التفعيل — إدخال يدوي</Tag>
            : <Tag tone="info" size="sm" iconLeft={<Ic name="verified" size={13} />}>مجلوب من {source}</Tag>)}
        </div>
      </div>
      {children}
    </Card>
  );
}

function ROGrid({ items }: { items: [string, React.ReactNode, string?][] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {items.map(([l, v, src], i) => (
        <div className="ro-field" key={i}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)" }}>{l}</span>
          <span className="row" style={{ gap: 6 }}>
            <span style={{ fontSize: 13, color: "var(--text-body)" }}>{v || "••••"}</span>
            {src && <span className="mono muted" style={{ fontSize: 11 }}>({src})</span>}
            <Ic name="lock" size={15} style={{ color: "var(--text-disabled)" }} />
          </span>
        </div>
      ))}
    </div>
  );
}

const EC_RELATIONS = ["أب", "أم", "زوج/زوجة", "أخ/أخت", "ابن/ابنة", "قريب", "صديق"];

function ManualFields({ sec, items, vals, errs, onEdit }: any) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      {items.map((it: any) => (
        <div className="pf-fld" key={it.l}>
          <span className="pf-label">{it.l}</span>
          {it.options
            ? <select className="pf-input" value={vals[it.l] || ""} onChange={(e) => onEdit(sec, it.l, e.target.value)}>
                <option value="">الرجاء اختيار عنصر</option>
                {it.options.map((o: string) => <option key={o} value={o}>{o}</option>)}
              </select>
            : <input className="pf-input" value={vals[it.l] || ""} onChange={(e) => onEdit(sec, it.l, e.target.value)} placeholder={it.ph || ("أدخل " + it.l)} dir={it.ltr ? "ltr" : "auto"} style={it.ltr ? { textAlign: "right" } : undefined} aria-invalid={errs && errs[it.l] ? "true" : undefined} />}
          {errs && errs[it.l] && <span className="pf-err"><Ic name="error" size={14} /> {errs[it.l]}</span>}
        </div>
      ))}
    </div>
  );
}

/* حقول الإدخال اليدوي — تبدأ فارغة ويملؤها المستفيد (لا قيم مُلفّقة) */
const MANUAL_EMPTY = {
  spl: { "العنوان المختصر": "", "رقم المبنى": "", "الشارع": "", "الرقم الفرعي": "", "الحي": "", "الرمز البريدي": "", "المدينة": "" },
  hrdf: { "جهة العمل": "", "المسمى الوظيفي": "" },
  ec: { "الاسم": "", "صلة القرابة": "", "رقم الجوال": "" },
};
type ManualVals = typeof MANUAL_EMPTY;

export function Profile() {
  const id = useContext(IdentityContext);
  // محاكاة حالة الربط (تكافئ أعلام إعداد في الإنتاج): نفاذ مربوط دائماً
  const [intg, setIntg] = useState<{ spl: Mode; hrdf: Mode }>({ spl: "manual", hrdf: "manual" });
  const toggle = (k: "spl" | "hrdf") => setIntg((s) => ({ ...s, [k]: s[k] === "live" ? "manual" : "live" }));
  const storeKey = "skProfileManual:" + id.nationalId;

  const [store, setStore] = useState<{ vals: ManualVals; pendingAt: string | null }>({ vals: MANUAL_EMPTY, pendingAt: null });
  const [draft, setDraft] = useState<ManualVals>(MANUAL_EMPTY);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    try {
      const s = localStorage.getItem(storeKey);
      if (s) {
        const p = JSON.parse(s);
        const vals: ManualVals = { spl: { ...MANUAL_EMPTY.spl, ...(p.vals?.spl || {}) }, hrdf: { ...MANUAL_EMPTY.hrdf, ...(p.vals?.hrdf || {}) }, ec: { ...MANUAL_EMPTY.ec, ...(p.vals?.ec || {}) } };
        if (vals.ec["صلة القرابة"] && !EC_RELATIONS.includes(vals.ec["صلة القرابة"])) vals.ec = { ...vals.ec, "صلة القرابة": "" };
        setStore({ vals, pendingAt: p.pendingAt || null });
        setDraft(vals);
      }
    } catch { /* خصوصية المتصفح */ }
  }, [storeKey]);

  const onEdit = (sec: keyof ManualVals, l: string, v: string) => { setDraft((s) => ({ ...s, [sec]: { ...s[sec], [l]: v } })); setDirty(true); setSaved(false); };

  const phone = (draft.ec["رقم الجوال"] || "").trim();
  const phoneOk = /^05\d{8}$/.test(phone);
  const ecErrs = phone && !phoneOk ? { "رقم الجوال": "أدخل رقماً بصيغة 05XXXXXXXX (10 أرقام)" } : null;
  const digits = (v: string, n: number) => new RegExp("^\\d{" + n + "}$").test((v || "").trim());
  const splErrs: Record<string, string> = {};
  ([["رقم المبنى", 4], ["الرمز البريدي", 5], ["الرقم الفرعي", 4]] as const).forEach(([l, n]) => { const v = (draft.spl[l] || "").trim(); if (v && !digits(v, n)) splErrs[l] = n + " أرقام فقط"; });
  const shortAddr = (draft.spl["العنوان المختصر"] || "").trim();
  if (shortAddr && !/^[A-Za-z]{4}\d{4}$/.test(shortAddr)) splErrs["العنوان المختصر"] = "4 أحرف ثم 4 أرقام (مثال: RYIB3063)";
  const splInvalid = intg.spl !== "live" && Object.keys(splErrs).length > 0;
  const secActive: Record<keyof ManualVals, boolean> = { spl: intg.spl !== "live", hrdf: intg.hrdf !== "live", ec: true };
  const incomplete = (Object.keys(MANUAL_EMPTY) as (keyof ManualVals)[]).some((sec) => secActive[sec] && Object.keys(MANUAL_EMPTY[sec]).some((l) => !((draft[sec] as any)[l] || "").trim())) || !phoneOk || splInvalid;

  const saveAll = () => {
    const next = { vals: draft, pendingAt: new Date().toISOString() };
    try { localStorage.setItem(storeKey, JSON.stringify(next)); } catch { /* خصوصية المتصفح */ }
    setStore(next); setDirty(false); setSaved(true); setTimeout(() => setSaved(false), 3000);
  };
  const undo = () => { setDraft(store.vals); setDirty(false); setSaved(false); };
  const pending = !!store.pendingAt;

  return (
    <div>
      <p className="lede">هويتك موثّقة من نفاذ وتظهر لك وحدك (مالك الحساب). العنوان وبيانات العمل تُدخَل يدوياً إلى حين تفعيل الربط مع سُبل والموارد البشرية، ويتحقّق منها المركز.</p>
      <div className="intg-bar">
        <Ic name="cable" size={18} color="var(--text-secondary)" />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-strong)" }}>حالة الربط (محاكاة):</span>
        {([["spl", "سُبل"], ["hrdf", "الموارد"]] as const).map(([k, ar]) => (
          <button key={k} className={"intg-chip " + intg[k]} onClick={() => toggle(k)}>
            <Ic name={intg[k] === "live" ? "link" : "link_off"} size={15} /> {ar}: {intg[k] === "live" ? "مربوط" : "يدوي"}
          </button>
        ))}
      </div>
      <ProSection icon="badge" title="بيانات الهوية" source="نفاذ" mode="live">
        <ROGrid items={[
          ["الاسم", id.name], ["رقم الهوية", <span className="mono" dir="ltr" key="nid">{maskId(id.nationalId)}</span>],
          ["الجنس", null], ["تاريخ الميلاد", null], ["الجنسية", null], ["الحالة الاجتماعية", null],
        ]} />
      </ProSection>
      <ProSection icon="location_on" title="العنوان الوطني" source="سُبل" mode={intg.spl} pending={pending}>
        {intg.spl === "live"
          ? <ROGrid items={[["العنوان المختصر", null, "سبل"], ["رقم المبنى", null, "سبل"], ["الشارع", null, "سبل"], ["الرقم الفرعي", null, "سبل"], ["الحي", null, "سبل"], ["الرمز البريدي", null, "سبل"], ["المدينة", null, "سبل"]]} />
          : <ManualFields sec="spl" items={[{ l: "العنوان المختصر", ltr: true, ph: "RYIB3063" }, { l: "رقم المبنى", ltr: true, ph: "4 أرقام" }, { l: "الشارع" }, { l: "الرقم الفرعي", ltr: true, ph: "4 أرقام" }, { l: "الحي" }, { l: "الرمز البريدي", ltr: true, ph: "5 أرقام" }, { l: "المدينة" }]} vals={draft.spl} errs={splErrs} onEdit={onEdit} />}
      </ProSection>
      <ProSection icon="work" title="بيانات العمل" source="الموارد البشرية" mode={intg.hrdf} pending={pending}>
        {intg.hrdf === "live"
          ? <ROGrid items={[["جهة العمل", null, "الموارد"], ["المسمى الوظيفي", null, "الموارد"]]} />
          : <ManualFields sec="hrdf" items={[{ l: "جهة العمل" }, { l: "المسمى الوظيفي" }]} vals={draft.hrdf} onEdit={onEdit} />}
      </ProSection>
      <ProSection icon="contact_emergency" title="جهة اتصال للطوارئ" mode="manual" pending={pending}>
        <ManualFields sec="ec" items={[{ l: "الاسم" }, { l: "صلة القرابة", options: EC_RELATIONS }, { l: "رقم الجوال", ltr: true, ph: "05XXXXXXXX" }]} vals={draft.ec} errs={ecErrs} onEdit={onEdit} />
        <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>للتواصل عند الخطر الوشيك (م14/6) — تُدخَل من المستخدم وتُحفظ في الملف.</p>
      </ProSection>
      <div className="row" style={{ justifyContent: "flex-end", gap: 10, position: "sticky", bottom: 0, padding: "12px 0", background: "color-mix(in srgb, var(--surface-page) 92%, transparent)", backdropFilter: "blur(6px)" }}>
        {saved && <Tag tone="success" size="sm" iconLeft={<Ic name="check_circle" size={13} fill />}>حُفظت التعديلات وأُرسلت لتحقّق المركز</Tag>}
        <button className="btn btn-ghost" disabled={!dirty} onClick={undo}><Ic name="undo" size={17} /> تراجع عن التعديلات</button>
        <button className="btn btn-primary" disabled={!dirty || incomplete} onClick={saveAll}><Ic name="save" size={17} /> حفظ التعديلات</button>
      </div>
    </div>
  );
}

/* ────────────────────────── تقديم طلب جديد ────────────────────────── */
export function NewRequest({ go }: { go?: (id: string) => void }) {
  const requests = useContext(RequestsContext);
  const [f, setF] = useState<any>({ role: "", category: "", entity: "", crime: "", priorSubmit: "", reason: "", caseNo: "", files: [] as string[], repId: "", repName: "", repAge: "", ackTrue: false, ackTerms: false });
  const set = (k: string) => (e: any) => setF((s: any) => ({ ...s, [k]: e.target.value }));
  const [submitted, setSubmitted] = useState(false);
  const [code, setCode] = useState("");
  const [ref, setRef] = useState("");
  const [error, setError] = useState("");
  const [pending, startSubmit] = useTransition();

  // حارس «طلب واحد نشط»: النموذج لا يظهر ما دام للمستفيد طلب قائم (يُفرض أيضاً في الخادم لاحقاً)
  const activeReq = requests.find(isOpenRequest);
  if (activeReq && !submitted) {
    return (
      <div>
        <InlineAlert kind="warning" title="لديك طلب قائم" style={{ marginBottom: 16 }}>
          لا يمكن تقديم طلب جديد ما دام لديك طلب قيد المعالجة (منعاً للتكرار). تابِع طلبك القائم، أو تواصل مع المركز عبر المراسلات.
        </InlineAlert>
        <Card padding="lg">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <div className="tl-t">طلبك القائم</div>
              <div className="muted mono" style={{ marginTop: 4 }}>{activeReq.ref_no} · {activeReq.secret_code}</div>
            </div>
            <button className="btn btn-primary" onClick={() => go && go("requests")}><Ic name="visibility" size={18} /> متابعة الطلب في البوابة</button>
          </div>
        </Card>
        <p className="muted" style={{ marginTop: 14 }}>عند إغلاق الطلب أو رفضه نهائياً، تُفتح إمكانية تقديم طلب جديد بمستجدات جديدة. والاعتراض على القرار يكون عبر التظلّم لا بطلب جديد.</p>
      </div>
    );
  }

  const doSubmit = () => {
    setError("");
    startSubmit(async () => {
      const r = await submitRequest({
        role: f.role, category: f.category, entity: f.entity,
        crime: f.crime, reason: f.reason, priorSubmit: f.priorSubmit, caseNo: f.caseNo,
        details: { onBehalf: { id: f.repId, name: f.repName, age: f.repAge }, files: f.files },
      });
      if (!r.ok) { setError(r.error); return; }
      setCode(r.secretCode); setRef(r.refNo); setSubmitted(true);
    });
  };
  const onBehalf = f.role && f.role !== "أصيل (المشمول)";
  const isMinor = onBehalf && f.repAge !== "" && Number(f.repAge) < 18;
  const repValid = !onBehalf || (f.repId.trim() && f.repName.trim() && f.repAge.trim());
  const valid = f.role && f.category && f.entity && f.crime.trim() && f.priorSubmit && f.reason.trim() && f.ackTrue && f.ackTerms && repValid;

  if (submitted) {
    return (
      <Card padding="lg" style={{ textAlign: "center" }}>
        <div style={{ width: 72, height: 72, margin: "0 auto 16px", borderRadius: "50%", background: "var(--green-10)", display: "grid", placeItems: "center" }}><Ic name="task_alt" size={40} color="var(--color-primary)" fill /></div>
        <h2 style={{ margin: "0 0 8px", fontSize: 23, fontWeight: 700, color: "var(--text-strong)" }}>تمّ استلام طلب الحماية</h2>
        <p style={{ margin: "0 auto 20px", maxWidth: 520, fontSize: 14.5, color: "var(--text-body)", lineHeight: 1.65 }}>سُجِّل طلبك وأُسند له رقم مرجعي ورمز سري. سيُحال إلى الجهة المختصة لرفع التوصية خلال 5 أيام، ويمكنك متابعة الحالة بالرمز السري.</p>
        <div style={{ display: "inline-flex", flexWrap: "wrap", gap: 10, justifyContent: "center", padding: 16, background: "var(--surface-subtle)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-subtle)" }}>
          <SecretCode code={code} canReveal={false} />
          <Tag tone="neutral" size="md" iconLeft={<Ic name="tag" size={14} />}>{ref}</Tag>
          <Tag tone="warning" size="md" iconLeft={<Ic name="schedule" size={14} />}>بانتظار توصية الجهة (5 أيام)</Tag>
        </div>
        <div style={{ marginTop: 22 }}>
          <button className="btn btn-ghost" onClick={() => go && go("requests")}><Ic name="assignment" size={18} /> متابعة الطلب في «طلباتي»</button>
        </div>
      </Card>
    );
  }

  return (
    <div className="seeker-form" style={{ display: "grid", gap: 16 }}>
      <div className="verif-strip">
        <Ic name="verified_user" size={20} fill color="var(--color-info)" />
        <span>هويتك موثّقة عبر <b>نفاذ</b> — تُرفق تلقائياً بالطلب دون إعادة إدخال.</span>
        <button className="link-btn" onClick={() => go && go("profile")}>عرض الملف الشخصي</button>
      </div>

      <Section icon="assignment" iconBg="var(--green-10)" iconColor="var(--color-primary)" title="بيانات الطلب" note="الرجاء إدخال البيانات المطلوبة">
        <div className="grid2">
          <div className="fld">
            <span className="fld-label">صفة مقدم الطلب <span className="req">*</span></span>
            <select value={f.role} onChange={set("role")}><option value="">الرجاء اختيار عنصر</option>{["أصيل (المشمول)", "وليّ", "وصيّ", "وكيل", "محامٍ"].map((o) => <option key={o} value={o}>{o}</option>)}</select>
            {onBehalf && <span className="hint">تقدّم نيابةً عن المشمول — أدخل بياناته الأساسية أدناه.</span>}
          </div>
          <div className="fld">
            <span className="fld-label">دور مقدم الطلب <span className="req">*</span></span>
            <select value={f.category} onChange={set("category")}><option value="">الرجاء اختيار عنصر</option>{["شاهد", "مبلّغ", "خبير", "ضحية"].map((o) => <option key={o} value={o}>{o}</option>)}</select>
          </div>
          <div className="fld">
            <span className="fld-label">هل سبق التقديم إلى الجهة المختصة؟ <span className="req">*</span></span>
            <select value={f.priorSubmit} onChange={set("priorSubmit")}><option value="">الرجاء اختيار عنصر</option><option value="yes">نعم</option><option value="no">لا</option></select>
          </div>
          {onBehalf &&
            <div className="fld full">
              <div className="rep-box">
                <div className="rep-head"><Ic name="supervisor_account" size={18} color="var(--color-primary)" /> بيانات المشمول (المنوب عنه){isMinor && <Tag tone="warning" size="sm" iconLeft={<Ic name="child_care" size={13} />}>قاصر</Tag>}</div>
                <div className="grid2">
                  <div className="fld"><span className="fld-label">رقم هوية المشمول <span className="req">*</span></span><input value={f.repId} onChange={set("repId")} placeholder="10XXXXXXXX" dir="ltr" style={{ textAlign: "right" }} /></div>
                  <div className="fld"><span className="fld-label">اسم المشمول <span className="req">*</span></span><input value={f.repName} onChange={set("repName")} placeholder="الاسم الكامل" dir="auto" /></div>
                  <div className="fld"><span className="fld-label">العمر <span className="req">*</span></span><input type="number" value={f.repAge} onChange={set("repAge")} placeholder="بالسنوات" dir="auto" />{isMinor && <span className="hint" style={{ color: "var(--color-warning)" }}>المشمول قاصر — يتطلّب ولياً/وصياً معتمداً.</span>}</div>
                </div>
              </div>
            </div>}
          <div className="fld">
            <span className="fld-label">اسم الجهة المختصة <span className="req">*</span></span>
            <select value={f.entity} onChange={set("entity")}><option value="">الرجاء اختيار الجهة</option>{["النيابة العامة", "رئاسة أمن الدولة", "وزارة الداخلية", "هيئة الرقابة ومكافحة الفساد", "وزارة العدل"].map((o) => <option key={o} value={o}>{o}</option>)}</select>
          </div>
          <div className="fld full">
            <span className="fld-label">نوع الجريمة محل الحماية <span className="req">*</span></span>
            <textarea value={f.crime} onChange={set("crime")} placeholder="وصف موجز لطبيعة الجريمة المشمولة بالنظام…" dir="auto" />
          </div>
          <div className="fld full">
            <span className="fld-label">سبب طلب الحماية ومسوّغاته <span className="req">*</span></span>
            <textarea value={f.reason} onChange={set("reason")} placeholder="اذكر طبيعة الخطر والمسوّغات التي تستدعي توفير الحماية…" dir="auto" />
          </div>
          <div className="fld full">
            <span className="fld-label">رقم القضية <span style={{ fontWeight: 400, color: "var(--text-secondary)" }}>(إن وجد)</span></span>
            <input value={f.caseNo} onChange={set("caseNo")} placeholder="مثال: 1447/…" dir="auto" style={{ maxWidth: 420 }} />
          </div>
          <div className="fld full">
            <span className="fld-label">المرفقات <span style={{ fontWeight: 400, color: "var(--text-secondary)" }}>(PDF — يمكن إرفاق أكثر من ملف)</span></span>
            <label className="file">
              <input type="file" accept="application/pdf" multiple style={{ display: "none" }}
                onChange={(e) => { const names = Array.from(e.target.files || []).map((x) => x.name); if (names.length) setF((s: any) => ({ ...s, files: [...s.files, ...names] })); e.target.value = ""; }} />
              <Ic name="upload_file" size={26} color="var(--text-secondary)" />
              <div><div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>اضغط لإرفاق ملف أو أكثر</div><div className="hint">المستندات الداعمة للطلب — صيغة PDF فقط.</div></div>
            </label>
            {f.files.length > 0 &&
              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                {f.files.map((n: string, i: number) => (
                  <div key={i} className="file-chip">
                    <Ic name="picture_as_pdf" size={20} color="var(--color-error)" fill />
                    <span style={{ flex: 1, fontSize: 13.5, color: "var(--text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n}</span>
                    <button type="button" className="file-rm" onClick={() => setF((s: any) => ({ ...s, files: s.files.filter((_: string, j: number) => j !== i) }))}><Ic name="close" size={16} /></button>
                  </div>))}
              </div>}
          </div>
        </div>
      </Section>

      <Section icon="fact_check" iconBg="var(--green-10)" iconColor="var(--color-primary)" title="الإقرار والموافقة" note="إلزامي قبل تقديم الطلب">
        <label className="chk">
          <input type="checkbox" checked={f.ackTrue} onChange={(e) => setF((s: any) => ({ ...s, ackTrue: e.target.checked }))} />
          <span>أقرّ بأن جميع البيانات والمعلومات المدخلة في نموذج تقديم طلب الحماية صحيحة، ويحقّ للجهة المسؤولة اتخاذ أي إجراء نظامي في حال ثبوت عدم صحّة البيانات والمعلومات المدخلة في نموذج تقديم الطلب. <span className="req">*</span></span>
        </label>
        <label className="chk">
          <input type="checkbox" checked={f.ackTerms} onChange={(e) => setF((s: any) => ({ ...s, ackTerms: e.target.checked }))} />
          <span>أوافق على الشروط والأحكام وسياسة الخصوصية. <span className="req">*</span></span>
        </label>
      </Section>

      {error && <InlineAlert kind="error" title="تعذّر التقديم">{error}</InlineAlert>}

      <Card padding="none">
        <div className="footer-bar">
          <button className="btn btn-ghost"><Ic name="save" size={18} /> حفظ كمسودة</button>
          <span style={{ flex: 1 }} />
          <button className="btn btn-primary" disabled={!valid || pending} onClick={doSubmit}>
            {pending ? "جارٍ التقديم…" : <>تقديم الطلب <Ic name="arrow_back" size={18} /></>}
          </button>
        </div>
      </Card>
    </div>
  );
}

function Section({ icon, iconBg, iconColor, title, note, children }: any) {
  return (
    <Card padding="none" style={{ overflow: "hidden" }}>
      <div className="sec-head">
        <div className="sec-ico" style={{ background: iconBg, color: iconColor }}><Ic name={icon} size={21} /></div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <h3 className="sec-title">{title}</h3>
          {note && <div className="sec-note">{note}</div>}
        </div>
      </div>
      <div className="sec-body">{children}</div>
    </Card>
  );
}

/* ────────────────────────── طلباتي (بيانات حقيقية من Supabase) ────────────────────────── */
const STATUS_ICON: Record<string, string> = { success: "verified", error: "cancel", warning: "draw", info: "assignment", neutral: "lock" };
const TONE_VAR: Record<string, string> = { success: "var(--color-success)", error: "var(--color-error)", warning: "var(--color-warning)", info: "var(--color-info)", neutral: "var(--text-secondary)" };

export function RealRequests({ go }: { go?: (id: string) => void }) {
  const requests = useContext(RequestsContext);
  const [openId, setOpenId] = useState<string | null>(null);
  const [formOpenId, setFormOpenId] = useState<string | null>(null);

  if (!requests.length) {
    return (
      <div className="card">
        <div className="empty">
          <span className="empty-ic"><Ic name="assignment" size={30} color="var(--color-primary)" /></span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-strong)" }}>لا توجد طلبات بعد</div>
            <p className="muted" style={{ maxWidth: "40ch", margin: "6px auto 0" }}>عند تقديم طلب حماية ستظهر هنا بحالته الحيّة ورمزه السرّي.</p>
          </div>
          <button className="btn btn-primary" onClick={() => go && go("new")}><Ic name="note_add" size={18} /> تقديم طلب جديد</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="lede">جميع طلباتك بحالتها الحيّة ورمزها السرّي المرجعيّ. اختر طلباً لعرض مراحله وبياناته.</p>
      <div style={{ display: "grid", gap: 12 }}>
        {requests.map((r) => {
          const st = STATUS_AR[r.status] || { t: r.status, tone: "neutral" };
          const tone = TONE_VAR[st.tone] || TONE_VAR.info;
          const act = realNextAction(r);
          const stage = STAGE_INDEX[r.status] ?? 1;
          const open = openId === r.id;
          const formOpen = formOpenId === r.id;
          const d: any = r.details || {};
          const submitted = r.submitted_at || r.created_at;
          return (
            <div key={r.id} className="card" style={{ overflow: "hidden" }}>
              <button className="req-card" style={{ border: "none", boxShadow: "none", borderRadius: 0 }} onClick={() => setOpenId(open ? null : r.id)}>
                <span className="req-ic" style={{ background: "color-mix(in srgb, " + tone + " 12%, transparent)", color: tone }}><Ic name={STATUS_ICON[st.tone] || "assignment"} size={22} fill /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="row" style={{ gap: 8, marginBottom: 4 }}>
                    <b style={{ fontSize: 15, color: "var(--text-strong)" }}>طلب حماية · {CATEGORY_AR[r.category] || r.category}</b>
                    <Tag tone={st.tone === "neutral" ? "info" : st.tone} size="sm">{st.t}</Tag>
                    {act && <Tag tone="warning" size="sm" iconLeft={<Ic name="touch_app" size={12} />}>يتطلّب إجراء</Tag>}
                  </span>
                  <span className="muted mono" style={{ display: "block" }}>{r.ref_no} · {r.secret_code}</span>
                  {act && <span style={{ display: "block", marginTop: 5, fontSize: 12.5, fontWeight: 600, color: "var(--warning-70)" }}><Ic name="arrow_left_alt" size={13} style={{ verticalAlign: "-2px" }} /> الإجراء المطلوب منك: {act}</span>}
                </span>
                <Ic name={open ? "expand_more" : "chevron_left"} size={20} color="var(--text-disabled)" />
              </button>
              {open &&
                <div style={{ padding: "0 16px 18px" }}>
                  <div className="row" style={{ gap: 10, marginBottom: 12 }}>
                    <SecretCode code={r.secret_code} canReveal={false} />
                    <Tag tone="neutral" size="sm" iconLeft={<Ic name="tag" size={13} />}>{r.ref_no}</Tag>
                  </div>
                  <div className="tl">
                    {STAGES.map((s, i) => {
                      const done = i < stage, active = i === stage && stage < STAGES.length;
                      return (
                        <div className="tl-step" key={i}>
                          <div className="tl-rail">
                            <div className="tl-dot" style={{ background: done ? "var(--green-10)" : active ? "var(--color-primary)" : "var(--surface-subtle)", color: active ? "#fff" : done ? "var(--color-primary)" : "var(--text-disabled)", border: active ? "none" : "2px solid " + (done ? "var(--color-primary)" : "var(--border-default)") }}>
                              {done ? <Ic name="check" size={15} /> : i + 1}
                            </div>
                            {i < STAGES.length - 1 && <div className={"tl-line" + (done ? " done" : "")} />}
                          </div>
                          <div className="tl-body">
                            <div className="tl-t" style={{ color: active ? "var(--color-primary)" : done ? "var(--text-strong)" : "var(--text-secondary)" }}>
                              {s.t}
                              {i === 0 && <span className="mono" style={{ fontSize: 11.5, fontWeight: 500, color: "var(--color-primary)", marginInlineStart: 8 }}>{new Date(r.created_at).toLocaleDateString("ar-SA", { dateStyle: "medium" })}</span>}
                            </div>
                            <div className="tl-d">{s.d}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="card" style={{ marginTop: 4 }}>
                    <button className="row" style={{ width: "100%", justifyContent: "space-between", padding: "14px 18px", background: "transparent", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)" }} onClick={() => setFormOpenId(formOpen ? null : r.id)}>
                      <span className="row" style={{ gap: 8 }}><Ic name="description" size={19} color="var(--color-primary)" /><b style={{ fontSize: 14.5, color: "var(--text-strong)" }}>بيانات طلبك (كما قُدّمت)</b></span>
                      <Ic name={formOpen ? "expand_less" : "expand_more"} size={22} color="var(--text-secondary)" />
                    </button>
                    {formOpen && (
                      <div style={{ padding: "0 18px 16px", display: "grid", gap: 10 }}>
                        {([
                          ["تاريخ التقديم", new Date(submitted).toLocaleDateString("ar-SA", { dateStyle: "long" })],
                          ["صفة مقدم الطلب", r.applicant_role],
                          ["دور مقدم الطلب", CATEGORY_AR[r.category] || r.category],
                          ["الجهة المختصة", d.entity],
                          ["نوع الجريمة محل الحماية", d.crime],
                          ["سبب الطلب ومسوّغاته", d.reason],
                          ["رقم القضية", d.case_no],
                        ] as [string, string | null][]).filter(([, v]) => v).map(([l, v]) => (
                          <div className="ro-field" key={l}>
                            <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)", flexShrink: 0 }}>{l}</span>
                            <span style={{ fontSize: 13, color: "var(--text-body)", textAlign: "start" }}>{v}</span>
                          </div>
                        ))}
                        {Array.isArray(d.files) && d.files.length > 0 && (
                          <div className="row" style={{ gap: 8 }}>
                            {d.files.map((f: string) => <span className="attach-chip" key={f}><Ic name="picture_as_pdf" size={14} />{f}</span>)}
                          </div>
                        )}
                        <p className="muted" style={{ margin: 0, fontSize: 12 }}>هذه البيانات كما قُدّمت — لا تُعدّل بعد التسجيل؛ وأي مستجدّ يُرفع عبر المراسلات أو بطاقة الاستيفاء.</p>
                      </div>
                    )}
                  </div>
                </div>}
            </div>
          );
        })}
      </div>
      <InlineAlert kind="info" title="طلب واحد نشط" style={{ marginTop: 16 }}>يُسمح بطلب واحد نشط في كل مرة؛ والطلبات السابقة تبقى في سجلّك للاطّلاع. الاعتراض على أي قرار يكون بالتظلّم لا بطلب جديد.</InlineAlert>
    </div>
  );
}
