"use client";
/* ============================================================
   الملف الشخصي وتقديم الطلب — منقولان من «الملف الشخصي وتقديم طلب.html».
   يُستعملان داخل هيكل بوابة طالب الحماية (portal-app) بدل النسختين المختصرتين.
   ============================================================ */
import React, { useState, useContext, useTransition } from "react";
import { Card, Tag, InlineAlert } from "@hemaya/ui";
import { SecretCode } from "@hemaya/ui";
import { IdentityContext, RequestsContext, maskId } from "./identity-context";
import { submitRequest } from "../lib/seeker-actions";

export const CATEGORY_AR: Record<string, string> = { witness: "شاهد", reporter: "مبلّغ", expert: "خبير", victim: "ضحية", related: "ذو صلة" };
export const STATUS_AR: Record<string, { t: string; tone: string }> = {
  submitted: { t: "مُستلَم", tone: "info" }, triage: { t: "قيد الفرز المبدئي", tone: "warning" },
  referred: { t: "محال للجهة المختصة", tone: "info" }, under_study: { t: "قيد الدراسة والتقييم", tone: "info" },
  classified: { t: "مُصنَّف", tone: "info" }, in_decision: { t: "قيد القرار", tone: "warning" },
  accepted: { t: "مقبول", tone: "success" }, rejected: { t: "مرفوض", tone: "error" },
  signed: { t: "موقَّع", tone: "success" }, active: { t: "حماية سارية", tone: "success" },
  under_review: { t: "قيد المراجعة", tone: "info" }, terminating: { t: "قيد الإنهاء", tone: "warning" },
  closed: { t: "مغلق", tone: "neutral" },
};

const Ic = ({ name, size = 20, fill = false, color = "currentColor", style = {} }: any) => (
  <span className="material-symbols-rounded" style={{ fontSize: size, color, fontVariationSettings: `'FILL' ${fill ? 1 : 0}`, ...style }}>{name}</span>
);

type Mode = "live" | "manual";
const SRC_KEY: Record<string, "nafath" | "spl" | "hrdf"> = { "نفاذ": "nafath", "سُبل": "spl", "الموارد البشرية": "hrdf" };

function Section({ icon, iconBg, iconColor, title, note, source, mode, children }: any) {
  return (
    <Card padding="none" style={{ overflow: "hidden" }}>
      <div className="sec-head">
        <div className="sec-ico" style={{ background: iconBg, color: iconColor }}><Ic name={icon} size={21} /></div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <h3 className="sec-title">{title}</h3>
          {note && <div className="sec-note">{note}</div>}
        </div>
        {source && (mode === "manual"
          ? <span className="src-pill src-manual"><Ic name="pending" size={14} /> ربط {source} قيد التفعيل · إدخال يدوي</span>
          : <span className="src-pill src-verified"><Ic name="verified" size={14} fill /> مجلوب من {source}</span>)}
      </div>
      <div className="sec-body">{children}</div>
    </Card>
  );
}

function RO({ label, source, mode, value }: { label: string; source: string; mode: Mode; value?: string }) {
  if (mode === "manual") {
    return (
      <div className="fld">
        <span className="fld-label">{label}</span>
        <input placeholder={"أدخل " + label} dir="auto" defaultValue={value ?? ""} />
        <span className="fld-manual-flag"><Ic name="edit_note" size={14} /> مُدخَل يدوياً — يتحقّق منه المركز (ربط {source} قيد التفعيل)</span>
      </div>
    );
  }
  return (
    <div className="fld">
      <span className="fld-label">{label}</span>
      <div className="ro">
        <span className="ro-val">
          {value ? <span className={label === "رقم الهوية" ? "mono" : ""} dir={label === "رقم الهوية" ? "ltr" : undefined}>{value}</span> : <>•••• </>}
          <span className="mono" style={{ fontSize: 11, color: "var(--text-secondary)" }}>({source})</span>
        </span>
        <Ic name="lock" size={17} style={{ color: "var(--text-disabled)" }} />
      </div>
    </div>
  );
}

/* ── الملف الشخصي التفصيليّ ── */
export function Profile() {
  const id = useContext(IdentityContext);
  const [intg, setIntg] = useState<{ nafath: Mode; spl: Mode; hrdf: Mode }>({ nafath: "live", spl: "manual", hrdf: "manual" });
  const m = (source: string): Mode => intg[SRC_KEY[source]];
  const toggle = (k: "nafath" | "spl" | "hrdf") => setIntg((s) => ({ ...s, [k]: s[k] === "live" ? "manual" : "live" }));
  return (
    <div className="seeker-form" style={{ display: "grid", gap: 16 }}>
      <InlineAlert kind="info" title="ملف شخصي موثّق">بياناتك مجلوبة من المصادر الوطنية وتظهر لك وحدك (مالك الحساب) بقيمها الفعلية، ولا تُعدَّل من البوابة؛ تُستخدم تلقائياً عند تقديم أي طلب دون إعادة إدخال.</InlineAlert>
      <div className="intg-bar">
        <Ic name="cable" size={18} color="var(--text-secondary)" />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-strong)" }}>حالة الربط (محاكاة):</span>
        {([["nafath", "نفاذ"], ["spl", "سُبل"], ["hrdf", "الموارد"]] as const).map(([k, ar]) => (
          <button key={k} className={"intg-chip " + intg[k]} onClick={() => toggle(k)}>
            <Ic name={intg[k] === "live" ? "link" : "link_off"} size={15} /> {ar}: {intg[k] === "live" ? "مربوط" : "يدوي"}
          </button>
        ))}
        <span className="hint" style={{ width: "100%" }}>نفاذ أساسي (الدخول والهوية) يبقى مربوطاً؛ سُبل والموارد قد يتأخّران عند الإطلاق فيُدخلان يدوياً ويتحقّق منهما المركز.</span>
      </div>
      <Section icon="badge" iconBg="var(--info-10)" iconColor="var(--color-info)" title="بيانات مقدم الطلب" note="موثّقة — غير قابلة للتعديل" source="نفاذ" mode={m("نفاذ")}>
        <div className="grid2">
          <RO label="الاسم" source="نفاذ" mode={m("نفاذ")} value={id.name} />
          <RO label="رقم الهوية" source="نفاذ" mode={m("نفاذ")} value={maskId(id.nationalId)} />
          <RO label="الجنس" source="نفاذ" mode={m("نفاذ")} />
          <RO label="تاريخ الميلاد" source="نفاذ" mode={m("نفاذ")} />
          <RO label="رقم الهاتف" source="نفاذ" mode={m("نفاذ")} />
          <RO label="الجنسية" source="نفاذ" mode={m("نفاذ")} />
          <RO label="الحالة الاجتماعية" source="نفاذ" mode={m("نفاذ")} />
        </div>
      </Section>
      <Section icon="location_on" iconBg="var(--info-10)" iconColor="var(--color-info)" title="العنوان الوطني" note="مرتبط بتدبير «تغيير محل الإقامة» عند الحاجة" source="سُبل" mode={m("سُبل")}>
        <div className="grid2">
          <RO label="المدينة" source="سُبل" mode={m("سُبل")} />
          <RO label="الحي" source="سُبل" mode={m("سُبل")} />
          <RO label="الرمز البريدي" source="سُبل" mode={m("سُبل")} />
          <RO label="رقم المبنى" source="سُبل" mode={m("سُبل")} />
        </div>
      </Section>
      <Section icon="work" iconBg="var(--info-10)" iconColor="var(--color-info)" title="بيانات العمل" note="تُستخدم لرصد الإجراءات الوظيفية المحظورة (م17)" source="الموارد البشرية" mode={m("الموارد البشرية")}>
        <div className="grid2">
          <RO label="جهة العمل" source="الموارد البشرية" mode={m("الموارد البشرية")} />
          <RO label="المسمى الوظيفي" source="الموارد البشرية" mode={m("الموارد البشرية")} />
        </div>
      </Section>
      <Section icon="contact_emergency" iconBg="var(--green-10)" iconColor="var(--color-primary)" title="جهة اتصال للطوارئ" note="للتواصل عند الخطر الوشيك (م14/6) — تُدخَل من المستخدم">
        <div className="grid2">
          <div className="fld"><span className="fld-label">الاسم <span className="req">*</span></span><input placeholder="اسم جهة الاتصال" dir="auto" /></div>
          <div className="fld"><span className="fld-label">صلة القرابة <span className="req">*</span></span>
            <select defaultValue=""><option value="">الرجاء اختيار عنصر</option>{["أب", "أم", "زوج/زوجة", "أخ/أخت", "ابن/ابنة", "قريب", "صديق"].map((o) => <option key={o} value={o}>{o}</option>)}</select>
          </div>
          <div className="fld"><span className="fld-label">رقم الجوال <span className="req">*</span></span><input placeholder="05XXXXXXXX" dir="ltr" style={{ textAlign: "right" }} /></div>
        </div>
      </Section>
    </div>
  );
}

/* ── تقديم طلب جديد (النموذج الكامل) ── */
export function NewRequest({ go }: { go?: (id: string) => void }) {
  const [f, setF] = useState<any>({ role: "", category: "", entity: "", crime: "", priorSubmit: "", reason: "", caseNo: "", files: [] as string[], repId: "", repName: "", repAge: "", ackTrue: false, ackTerms: false });
  const set = (k: string) => (e: any) => setF((s: any) => ({ ...s, [k]: e.target.value }));
  const [submitted, setSubmitted] = useState(false);
  const [code, setCode] = useState("");
  const [ref, setRef] = useState("");
  const [error, setError] = useState("");
  const [pending, startSubmit] = useTransition();
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
          <button className="btn btn-ghost" onClick={() => setSubmitted(false)}><Ic name="arrow_forward" size={18} /> عودة للنموذج</button>
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

/* ── طلباتي (بيانات حقيقية من Supabase) ── */
export function RealRequests({ go }: { go?: (id: string) => void }) {
  const requests = useContext(RequestsContext);
  const [openId, setOpenId] = useState<string | null>(null);

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
      <p className="lede">جميع طلباتك بحالتها الحيّة ورمزها السرّي المرجعيّ.</p>
      <div style={{ display: "grid", gap: 12 }}>
        {requests.map((r) => {
          const st = STATUS_AR[r.status] || { t: r.status, tone: "neutral" };
          const open = openId === r.id;
          return (
            <div key={r.id} className="card" style={{ overflow: "hidden" }}>
              <button className="req-card" style={{ border: "none", boxShadow: "none", borderRadius: 0 }} onClick={() => setOpenId(open ? null : r.id)}>
                <span className="req-ic" style={{ background: "var(--green-10)" }}><Ic name="verified_user" size={22} color="var(--color-primary)" fill /></span>
                <div style={{ flex: 1 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <b style={{ color: "var(--text-strong)" }}>طلب حماية · {CATEGORY_AR[r.category] || r.category}</b>
                    <Tag tone={st.tone} size="sm">{st.t}</Tag>
                  </div>
                  <div className="muted mono">{r.ref_no} · {r.secret_code}</div>
                </div>
                <Ic name={open ? "expand_more" : "chevron_left"} size={20} color="var(--text-disabled)" />
              </button>
              {open &&
                <div style={{ padding: "0 16px 18px" }}>
                  <div className="row" style={{ gap: 10, marginBottom: 12 }}>
                    <SecretCode code={r.secret_code} canReveal={false} />
                    <Tag tone="neutral" size="sm" iconLeft={<Ic name="tag" size={13} />}>{r.ref_no}</Tag>
                  </div>
                  <div className="tl">
                    {[["مُستلَم", true], ["الفرز المبدئي", r.status !== "submitted"], ["الإحالة للجهة المختصة", ["referred", "under_study", "classified", "in_decision", "accepted", "rejected", "signed", "active"].includes(r.status)], ["القرار", ["accepted", "rejected", "signed", "active"].includes(r.status)]].map(([t, done]: any, i, arr) => (
                      <div className="tl-step" key={i}>
                        <div className="tl-rail">
                          <div className="tl-dot" style={{ background: done ? "var(--color-primary)" : "var(--surface-sunken)", color: done ? "#fff" : "var(--text-disabled)" }}>
                            <Ic name={done ? "check" : "radio_button_unchecked"} size={15} />
                          </div>
                          {i < arr.length - 1 && <div className={"tl-line" + (done ? " done" : "")} />}
                        </div>
                        <div className="tl-body"><div className="tl-t">{t}</div></div>
                      </div>
                    ))}
                  </div>
                </div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
