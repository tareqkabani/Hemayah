"use client";
/* ============================================================
   تفريغ طلب طالب الحماية — معالجٌ بثلاث خطوات (قرار ٨):
   مقدّم الطلب · القضية والمرفقات · المراجعة والإرسال.
   المسوّدة تُحفظ على الخادم لكل قيدٍ ومُدخِل (فجوة الإنتاج ٢)،
   والقناة وقيد الورود موروثان مقفلين حين يُفتح من الواردة (قرار ٥).
   ============================================================ */
import React, { useEffect, useRef, useState } from "react";
import { Card, InlineAlert } from "@hemaya/ui";
import {
  I, Field, Choice, Sec, Stepper, LockedCtx, PaperMeta,
  todayISO, chLabel, fmtD,
} from "./parts";
import { saveDraft, loadDraft, clearDraft } from "@/lib/paper-intake-actions";

const STEPS = ["مقدّم الطلب", "القضية والمرفقات", "المراجعة والإرسال"];

const BLANK = {
  name: "", nid: "", phone: "", ecName: "", ecRel: "", ecPhone: "",
  role: "", category: "", priorSubmit: "", entity: "", repId: "", repName: "", repAge: "",
  crime: "", reason: "", caseNo: "", scanReq: false, scanId: false, extras: [], ackTrue: false,
  ivDate: todayISO(), ivNote: "",
  nat: "", dob: "", marital: "", cityIn: "", email: "", reqType: "طلب جديد", prevRef: "",
};

export function SeekerPaperForm({ onDone, onBack, meta, setMeta, busy, lists, lockedCh }) {
  const locked = !!lockedCh;
  const [step, setStep] = useState(1);
  const [s, setS] = useState(BLANK);
  const [ch, setCh] = useState(lockedCh || "");
  const [restored, setRestored] = useState(false);
  const savedOnce = useRef(false);

  const roleOptions = (lists.applicant_role || []).map((i) => i.label);
  const catOptions = (lists.app_category || []).map((i) => i.label);
  const entOptions = (lists.competent_entity || []).map((i) => i.label);

  // ── استعادة المسوّدة من الخادم عند فتح قيدٍ له مسوّدة ──
  useEffect(() => {
    let alive = true;
    if (!meta.regNo) return;
    loadDraft(meta.regNo).then((r) => {
      if (!alive || !r.ok || !r.payload) return;
      // الإقرار يُعاد دائماً — لا يُورَّث من مسوّدة.
      setS((cur) => ({ ...cur, ...r.payload, ackTrue: false }));
      setRestored(true);
    });
    return () => { alive = false; };
    // القيد هو مفتاح المسوّدة؛ تغيّره يعني مستنداً آخر.
  }, [meta.regNo]);

  // ── حفظ تلقائي مُهدَّأ (لا نداء لكل ضغطة مفتاح) ──
  useEffect(() => {
    if (!meta.regNo) return;
    if (!savedOnce.current) { savedOnce.current = true; return; } // لا يُحفظ الفارغ فور الفتح
    const t = setTimeout(() => { void saveDraft(meta.regNo, s); }, 1200);
    return () => clearTimeout(t);
  }, [s, meta.regNo]);

  const set = (k) => (v) => setS((x) => ({ ...x, [k]: v && v.target ? v.target.value : v }));
  const onBehalfRole = !!s.role && !s.role.startsWith("أصيل");
  const minor = onBehalfRole && s.repAge !== "" && Number(s.repAge) < 18;
  const repOk = !onBehalfRole || (s.repId.trim() && s.repName.trim() && s.repAge !== "");
  const ivOk = ch !== "inperson" || (s.ivDate && s.ivNote.trim());
  const legacy = ch === "legacy";
  const legacyOk = !legacy || (s.nat.trim() && s.cityIn.trim());
  const metaOk = !!(meta.receivedDate && meta.regNo.trim());

  // جهة الاتصال موسومةٌ إلزاميةً في غير قناة الموقع الإلكتروني — وكانت
  // تُعرض بنجمةٍ ولا تُفرض، فيمرّ النموذج بلا نقطة تواصلٍ للطوارئ.
  const ecOk = legacy || (s.ecName.trim() && s.ecPhone.trim());
  const step1Ok = !!(ch && metaOk && legacyOk && ecOk && s.name.trim() && s.nid.trim().length === 10 && s.phone.trim() && s.role && s.category && repOk);
  const step2Ok = !!(s.crime.trim() && s.reason.trim() && s.priorSubmit && (s.priorSubmit !== "نعم" || s.entity));
  const ready = step1Ok && step2Ok && ivOk && s.ackTrue && !busy;
  const stepOk = step === 1 ? step1Ok : step === 2 ? step2Ok : ready;

  const go = (n) => { setStep(n); if (typeof window !== "undefined") window.scrollTo(0, 0); };
  const submit = () => {
    if (meta.regNo) void clearDraft(meta.regNo);
    onDone("seeker", { ...s, onBehalf: onBehalfRole ? "نعم" : "لا", channel: ch });
  };

  return (
    <div className="rf">
      <div className="rf-top">
        <button className="link" onClick={onBack}><I name="arrow_forward" size={18} /> رجوع {locked ? "للواردة" : "لاختيار المصدر"}</button>
        <div className="rf-top-main"><div><div className="rf-kicker">تفريغ وارد · طالب الحماية</div><h2 className="rf-h">تفريغ طلب طالب الحماية</h2></div></div>
      </div>

      {restored && step === 1 && (
        <InlineAlert kind="info" title="استُعيدت مسودة" style={{ marginBottom: 12 }}>
          ما كتبته محفوظٌ تلقائياً على الخادم لهذا القيد — أكمل من حيث توقّفت (الإقرار يُعاد).
        </InlineAlert>
      )}

      {!locked && (
        <div className="card pad" style={{ marginBottom: 14 }}>
          <div className="sec-h"><I name="alt_route" size={19} /> قناة ورود الطلب <span className="rf-req">*</span></div>
          <div className="entseg">
            <button className={ch === "legacy" ? "on" : ""} onClick={() => setCh("legacy")}>الموقع الإلكتروني (تقديم عبر نفاذ)</button>
            <button className={ch === "inperson" ? "on" : ""} onClick={() => setCh("inperson")}>حضوري</button>
          </div>
          {ch === "legacy" && <div className="man ok" style={{ marginTop: 12, marginBottom: 0 }}><I name="verified_user" size={16} /> قدّم طالب الحماية طلبه بنفسه في الموقع الإلكتروني بعد دخوله عبر نفاذ — الهوية موثّقة، وتُنسخ البيانات من الطلب المطبوع كما وردت.</div>}
          {ch === "inperson" && <div className="man" style={{ marginTop: 12, marginBottom: 0 }}><I name="record_voice_over" size={16} /> تقديم حضوري — يوجب النظام واللائحة <b style={{ marginInline: 4 }}>مقابلة طالب الحماية</b> وتوثيق محضرها (في خطوة المراجعة).</div>}
        </div>
      )}

      {locked ? (
        <LockedCtx ch={ch} meta={meta} note={legacy
          ? "قدّم طالب الحماية طلبه بنفسه في الموقع الإلكتروني بعد دخوله عبر نفاذ — الهوية موثّقة، وتُنسخ البيانات من الطلب المطبوع كما وردت."
          : "تقديم حضوري — يوجب النظام مقابلة طالب الحماية وتوثيق محضرها (في خطوة المراجعة)، والهوية غير موثّقة حتى يُفعّل حسابه عبر نفاذ."} />
      ) : ch ? <PaperMeta meta={meta} setMeta={setMeta} ch={ch} /> : null}

      {!ch ? null : (
        <>
          <Stepper steps={STEPS} step={step} go={go} />

          {step === 1 && (
            <>
              <Sec n="١" title="بيانات مقدّم الطلب">
                {legacy
                  ? <div className="man ok"><I name="verified_user" size={16} /> الهوية <b style={{ marginInline: 4 }}>موثّقة عبر نفاذ</b> (الموقع الإلكتروني) — انسخ البيانات من الطلب المطبوع كما وردت.</div>
                  : <div className="man"><I name="gpp_maybe" size={16} /> تُدخَل يدوياً من الورق — <b style={{ marginInlineStart: 4 }}>غير موثّقة</b>؛ يُفعّل الشخص حسابه عبر نفاذ لاحقاً (لازمٌ للاتفاقية م11 والتظلّم م21).</div>}
                <div className="rf-grid2">
                  <Field label="الاسم الكامل" req><input value={s.name} onChange={set("name")} dir="auto" placeholder="كما في الطلب الورقيّ" /></Field>
                  <Field label="رقم الهوية / الإقامة" req><input value={s.nid} onChange={(e) => setS((x) => ({ ...x, nid: e.target.value.replace(/\D/g, "").slice(0, 10) }))} className="mono" inputMode="numeric" placeholder="١٠ أرقام" /></Field>
                  <Field label="رقم الجوال" req><input value={s.phone} onChange={(e) => setS((x) => ({ ...x, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }))} className="mono" inputMode="tel" placeholder="05XXXXXXXX" /></Field>
                  <Field label="صفة مقدّم الطلب" hint="(م7/1 · م5/1)" req>
                    <select value={s.role} onChange={set("role")}><option value="">— اختر —</option>{roleOptions.map((o) => <option key={o}>{o}</option>)}</select>
                  </Field>
                  {onBehalfRole && (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <div className="rf-divider"><I name="supervisor_account" size={16} color="var(--text-secondary)" /> بيانات طالب الحماية (المُقدَّم نيابةً عنه) — لائحة م5/1</div>
                      <div className="rf-grid2">
                        <Field label="رقم هوية الشخص" req><input value={s.repId} onChange={(e) => setS((x) => ({ ...x, repId: e.target.value.replace(/\D/g, "").slice(0, 10) }))} className="mono" inputMode="numeric" placeholder="١٠ أرقام" /></Field>
                        <Field label="اسم الشخص" req><input value={s.repName} onChange={set("repName")} dir="auto" placeholder="الاسم الكامل" /></Field>
                        <Field label="العمر" req><input type="number" value={s.repAge} onChange={set("repAge")} placeholder="بالسنوات" /></Field>
                        {minor && <div className="man warn" style={{ gridColumn: "1 / -1" }}><I name="info" size={16} /> الشخص قاصر — يتطلّب ولياً/وصياً معتمداً.</div>}
                      </div>
                    </div>
                  )}
                  <Field label="دور مقدّم الطلب" hint="(م1 — فئات الحماية)" req>
                    <select value={s.category} onChange={set("category")}><option value="">— اختر —</option>{catOptions.map((o) => <option key={o}>{o}</option>)}</select>
                  </Field>
                  {legacy && (
                    <>
                      <div className="rf-divider" style={{ gridColumn: "1 / -1" }}><I name="content_copy" size={16} color="var(--text-secondary)" /> حقول نموذج الموقع الإلكتروني (تُنسخ كما في الطلب المطبوع)</div>
                      <Field label="الجنسية" req><input value={s.nat} onChange={set("nat")} dir="auto" placeholder="كما في الطلب المطبوع" /></Field>
                      <Field label="تاريخ الميلاد"><input value={s.dob} onChange={set("dob")} className="mono" placeholder="1418/01/01" dir="ltr" /></Field>
                      <Field label="الحالة الاجتماعية"><input value={s.marital} onChange={set("marital")} dir="auto" placeholder="أعزب / متزوج …" /></Field>
                      <Field label="المدينة" req hint="(عنوان الإقامة)"><input value={s.cityIn} onChange={set("cityIn")} dir="auto" placeholder="مثال: مكة المكرمة" /></Field>
                      <Field label="البريد الإلكتروني" hint="(معلومات التواصل)"><input value={s.email} onChange={set("email")} className="mono" dir="ltr" placeholder="name@example.com" /></Field>
                    </>
                  )}
                </div>
              </Sec>

              <Sec n="٢" title="جهة الاتصال في الحالات الطارئة" sub={legacy ? "غير موجودة في نموذج الموقع الإلكتروني — اختيارية، تُستكمل عند تفعيل الحساب أو في التواصل مع طالب الحماية." : undefined}>
                <div className="rf-grid2">
                  <Field label="الاسم" req={!legacy}><input value={s.ecName} onChange={set("ecName")} dir="auto" placeholder="اسم جهة الاتصال" /></Field>
                  <Field label="صلة القرابة"><input value={s.ecRel} onChange={set("ecRel")} dir="auto" placeholder="مثال: أخ / زوج" /></Field>
                  <Field label="رقم الجوال" req={!legacy}><input value={s.ecPhone} onChange={(e) => setS((x) => ({ ...x, ecPhone: e.target.value.replace(/\D/g, "").slice(0, 10) }))} className="mono" inputMode="tel" placeholder="05XXXXXXXX" /></Field>
                </div>
              </Sec>
            </>
          )}

          {step === 2 && (
            <>
              <Sec n="٣" title="القضية وأسباب الطلب">
                <Field label="نوع الجريمة محل الحماية" hint="(م1 — الجرائم الكبيرة)" req><textarea value={s.crime} onChange={set("crime")} dir="auto" placeholder="وصف موجز لطبيعة الجريمة المشمولة بالنظام…" /></Field>
                <Field label="سبب طلب الحماية ومسوّغاته" hint="(طلب مسبّب — م7/1)" req><textarea value={s.reason} onChange={set("reason")} dir="auto" placeholder="اذكر طبيعة الخطر والمسوّغات التي تستدعي توفير الحماية…" style={{ minHeight: 100 }} /></Field>
                <div className="rf-grid2">
                  <Field label="هل سبق التقديم إلى الجهة المختصة؟" req>
                    <select value={s.priorSubmit} onChange={(e) => { const v = e.target.value; setS((x) => ({ ...x, priorSubmit: v, ...(v !== "نعم" ? { entity: "" } : {}) })); }}>
                      <option value="">— اختر —</option><option value="نعم">نعم</option><option value="لا">لا</option>
                    </select>
                  </Field>
                  {s.priorSubmit === "نعم" && (
                    <Field label="اسم الجهة المختصة" hint="(م1/5 · جهة التحقيق أو المحاكمة)" req>
                      <select value={s.entity} onChange={set("entity")}><option value="">— اختر —</option>{entOptions.map((o) => <option key={o}>{o}</option>)}</select>
                    </Field>
                  )}
                </div>
                <Field label="رقم القضية" hint="(إن وجد)"><input value={s.caseNo} onChange={set("caseNo")} dir="auto" placeholder="مثال: 1447/…" /></Field>
                {legacy && (
                  <div className="rf-grid2" style={{ marginTop: 4 }}>
                    <Field label="نوع الطلب" req hint="(كما في نموذج الموقع الإلكتروني)"><Choice value={s.reqType} set={set("reqType")} options={["طلب جديد"]} /></Field>
                    {s.reqType === "يوجد طلب سابق" && <Field label="رقم الطلب السابق"><input value={s.prevRef} onChange={set("prevRef")} className="mono" dir="ltr" placeholder="رقم الطلب في الموقع الإلكتروني" /></Field>}
                  </div>
                )}
              </Sec>

              <Sec n="٤" title="المرفقات" sub="المرفقات اختيارية — أضفها إن توفّرت تعزيزاً لسند التدقيق.">
                <div className="rf-attach-grid">
                  <label className="rf-attach" style={{ cursor: "pointer" }}>
                    <input type="file" style={{ display: "none" }} accept="image/*,application/pdf" onChange={(e) => { const fl = e.target.files && e.target.files[0]; if (fl) setS((x) => ({ ...x, scanReq: fl.name })); e.target.value = ""; }} />
                    <I name={s.scanReq ? "check_circle" : "upload_file"} size={18} color={s.scanReq ? "var(--color-primary)" : "var(--text-secondary)"} fill={!!s.scanReq} />
                    <span>{(legacy ? "نسخة الطلب المطبوعة من الموقع الإلكتروني" : "صورة الطلب الورقيّ") + (s.scanReq ? " — " + s.scanReq : " (اختياري) — اختر ملفاً")}</span>
                  </label>
                  {!legacy && (
                    <label className="rf-attach" style={{ cursor: "pointer" }}>
                      <input type="file" style={{ display: "none" }} accept="image/*,application/pdf" onChange={(e) => { const fl = e.target.files && e.target.files[0]; if (fl) setS((x) => ({ ...x, scanId: fl.name })); e.target.value = ""; }} />
                      <I name={s.scanId ? "check_circle" : "badge"} size={18} color={s.scanId ? "var(--color-primary)" : "var(--text-secondary)"} fill={!!s.scanId} />
                      <span>{s.scanId ? "صورة الهوية / الإقامة — " + s.scanId : "صورة الهوية / الإقامة (اختياري) — اختر ملفاً"}</span>
                    </label>
                  )}
                  {s.extras.map((x, i) => (
                    <label key={x + i} className="rf-attach">
                      <I name="check_circle" size={18} color="var(--color-primary)" fill /><span>{x}</span>
                      <button className="link" style={{ marginInlineStart: "auto", fontSize: 12 }} onClick={(e) => { e.preventDefault(); setS((st) => ({ ...st, extras: st.extras.filter((_, j) => j !== i) })); }}><I name="close" size={15} /></button>
                    </label>
                  ))}
                </div>
                <label className="link" style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                  <input type="file" multiple style={{ display: "none" }} accept="image/*,application/pdf" onChange={(e) => { const fs = Array.from(e.target.files || []).map((fl) => fl.name); if (fs.length) setS((x) => ({ ...x, extras: [...x.extras, ...fs] })); e.target.value = ""; }} />
                  <I name="add" size={16} /> إضافة مرفق آخر
                </label>
                <p className="muted" style={{ marginTop: 10, fontSize: 12 }}><I name="info" size={14} style={{ verticalAlign: "middle", marginInlineEnd: 4 }} />يُخزَّن اسم الملف في سند التدقيق؛ ورفع الملف نفسه إلى مخزنٍ خاصّ فجوةُ إنتاجٍ معلنة.</p>
              </Sec>
            </>
          )}

          {step === 3 && (
            <>
              <div className="sec-h" style={{ marginBottom: 10 }}><I name="fact_check" size={19} /> مراجعة ما أُدخِل</div>
              <div className="rvw">
                <div><div className="k">الاسم</div><div className="v">{s.name || "—"}</div></div>
                <div><div className="k">الهوية / الإقامة</div><div className="v mono">{s.nid || "—"}</div></div>
                <div><div className="k">الجوال</div><div className="v mono">{s.phone || "—"}</div></div>
                <div><div className="k">الصفة والدور</div><div className="v">{(s.role || "—") + " · " + (s.category || "—")}</div></div>
                <div><div className="k">القناة وقيد الورود</div><div className="v">{chLabel(ch)} · <span className="mono">{meta.regNo || "—"}</span> · {fmtD(meta.receivedDate)}</div></div>
                <div><div className="k">الهوية</div><div className="v">{legacy ? "موثّقة — نفاذ (الموقع الإلكتروني)" : "غير موثّقة — تُفعّل عبر نفاذ لاحقاً"}</div></div>
                <div><div className="k">الجريمة محل الحماية</div><div className="v">{s.crime || "—"}</div></div>
                <div><div className="k">رقم القضية</div><div className="v mono">{s.caseNo || "لا يوجد"}</div></div>
                <div style={{ gridColumn: "1 / -1" }}><div className="k">مسوّغات الطلب</div><div className="v" style={{ fontWeight: 400, lineHeight: 1.7 }}>{s.reason || "—"}</div></div>
                <div style={{ gridColumn: "1 / -1" }}><div className="k">المرفقات</div><div className="v" style={{ fontWeight: 400 }}>{[s.scanReq, s.scanId, ...s.extras].filter(Boolean).join(" · ") || "بلا مرفقات (اختيارية)"}</div></div>
              </div>
              <p className="muted" style={{ margin: "0 0 14px", fontSize: 12.5 }}>لتعديل أي حقل ارجع للخطوة المعنية من شريط الخطوات أعلاه.</p>

              {ch === "inperson" && (
                <Sec n="٥" title="محضر مقابلة طالب الحماية" sub="يوجب النظام واللائحة مقابلة طالب الحماية عند التقديم الحضوري — المحضر إلزاميّ ويُسجّل في التدقيق، ويقوم مقام محضر الاتصال في الفرز فلا يُطلب مرّةً أخرى.">
                  <div className="rf-grid2">
                    <Field label="تاريخ المقابلة" req><input type="date" value={s.ivDate} max={todayISO()} onChange={set("ivDate")} /></Field>
                    <Field label="الموظف المُقابِل"><div className="rf-locked"><span style={{ fontWeight: 600, color: "var(--text-strong)" }}>أنت — مُدخِل النموذج</span><span className="rf-src"><I name="history" size={14} /> يُسجّل في التدقيق</span></div></Field>
                  </div>
                  <Field label="ملخص المقابلة" req hint="(ما تم التحقّق منه وجوهر ما ذكره طالب الحماية)"><textarea value={s.ivNote} onChange={set("ivNote")} dir="auto" placeholder="مثال: قوبل طالب الحماية حضورياً، وتُحُقّق من مطابقة هويته للمستند، وأفاد بـ…" style={{ minHeight: 90 }} /></Field>
                </Sec>
              )}

              <Card className="card pad" style={{ marginTop: 8, borderColor: "var(--green-20)" }}>
                <div className="row" style={{ gap: 9, marginBottom: 10 }}><I name="fact_check" size={22} color="var(--color-primary)" fill /><b style={{ fontSize: 16, color: "var(--text-strong)" }}>الإقرار والإحالة</b></div>
                <label className="rf-ack" style={{ marginBottom: 10 }}>
                  <input type="checkbox" checked={s.ackTrue} onChange={(e) => setS((x) => ({ ...x, ackTrue: e.target.checked }))} />
                  <span>{legacy
                    ? "أقرّ بأنّ البيانات نُسخت مطابقةً للطلب المطبوع من الموقع الإلكتروني ونسخته مُرفقة، ويُسجل إدخالي في التدقيق باسمي ووقته."
                    : "أقرّ بأنّ البيانات أُدخلت مطابقةً للطلب الورقيّ الوارد وصورته مُرفقة، ويُسجل إدخالي في التدقيق باسمي ووقته."}</span>
                </label>
                {legacy
                  ? <div className="man ok" style={{ marginBottom: 0 }}><I name="verified_user" size={16} /> <span>استوفى طالب الحماية الموافقة على الشروط والأحكام عند تقديمه عبر نفاذ في الموقع الإلكتروني — وتبقى الاتفاقية (م11) والتظلّم (م21) عبر حسابه في المنصة.</span></div>
                  : <div className="man" style={{ marginBottom: 0 }}><I name="verified_user" size={16} /> <span>تُستوفى موافقة مقدّم الطلب على الشروط والأحكام وسياسة الخصوصية <b>عند تفعيل حسابه عبر نفاذ</b> — وهي لازمة لاتفاقية الحماية (م11) والتظلّم (م21).</span></div>}
                {ch === "inperson" && (
                  <div className="man ok" style={{ marginTop: 12, marginBottom: 0 }}><I name="conversion_path" size={16} /> <span>يدخل الفرز <b>بلا حاجة لمحضر اتصال</b> — محضر المقابلة الحضورية يقوم مقامه (م7)؛ ويتولّى موظف الفرز الفحص الشكليّ ثمّ <b>إحالته للجهة المختصّة لطلب التوصية</b> أو حفظه أو إغلاقه بسبب موثّق.</span></div>
                )}
                <div className="row" style={{ marginTop: 16, justifyContent: "flex-end" }}>
                  <button className="btn btn-primary" disabled={!ready} onClick={submit}><I name="send" size={18} /> تسجيل وإرسال</button>
                </div>
                {!ready && <p className="muted" style={{ marginTop: 10, fontSize: 12.5 }}>{ch === "inperson" ? "أكمل القيد والحقول الإلزامية ومحضر المقابلة، وأقرّ لتفعيل الإحالة." : "أكمل القيد والحقول الإلزامية، وأقرّ لتفعيل الإحالة."}</p>}
              </Card>
            </>
          )}

          {step < 3 && (
            <div className="wz-nav">
              {step > 1 ? <button className="btn btn-ghost" onClick={() => go(step - 1)}><I name="arrow_forward" size={18} /> السابق</button> : <span />}
              <div className="row" style={{ gap: 12 }}>
                {meta.regNo
                  ? <span className="muted" style={{ fontSize: 12 }}><I name="cloud_done" size={15} style={{ verticalAlign: "middle", marginInlineEnd: 4 }} />يُحفظ تلقائياً كمسودة</span>
                  : <span className="muted" style={{ fontSize: 12 }}><I name="cloud_off" size={15} style={{ verticalAlign: "middle", marginInlineEnd: 4 }} />المسودة تُحفظ بعد إدخال رقم القيد</span>}
                <button className="btn btn-primary" disabled={!stepOk} onClick={() => go(step + 1)}>التالي <I name="arrow_back" size={18} /></button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
