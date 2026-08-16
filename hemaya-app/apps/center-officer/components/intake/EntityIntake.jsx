"use client";
/* ============================================================
   مسار الجهة المختصّة — شاشتان منفصلتان تماماً (قرار ٢):
   · «توصية على طلبٍ مُحال»  — ربطٌ إلزاميّ بطلبٍ قائم، هوية موروثة موثّقة.
   · «طلب نيابةً عن الشخص»  — طلبٌ ابتدائيّ، هوية يدوية غير موثّقة.
   لا مبدّل وضعٍ داخل شاشةٍ واحدة؛ الوضع يأتي من بطاقة المصدر أو من
   نوع المستند في صفّ الواردة.
   ============================================================ */
import React, { useEffect, useState } from "react";
import { InlineAlert } from "@hemaya/ui";
import { REGION_LABEL } from "@hemaya/domain";
import { I, Field, Stepper, LockedCtx, PaperMeta, ENTS, entName, fmtD, todayISO, bizDaysSince } from "./parts";
import { RecommendationForm } from "@hemaya/recommendation";
import { createClient } from "@hemaya/supabase/src/browser";
import { recordAttachment, removeAttachment } from "@/lib/intake-attachments";
import { listReferredForEntity } from "@/lib/paper-intake-actions";

const REC_DEADLINE_DAYS = 5;

const NOTE = {
  rec: "خطاب توصية وارد بالبريد على طلبٍ مُحال. الربط بطلبٍ قائم إلزاميّ: تُورث هويته الموثّقة ولا تُدخل يدوياً، والجهة صاحبة محتوى التوصية. تُرفق صورة الخطاب ويُسجل الإدخال في التدقيق.",
  onbehalf: "خطاب رسمي وارد بالبريد — نموذج التوصية نفسه؛ المُدخِل موظف المركز نيابةً عن الجهة، والهوية تُدخل يدوياً (غير موثّقة)، وطلب الحماية المسبّب والهوية مرفقان إلزاميّان.",
};

// عميلٌ واحدٌ للمتصفح — يُنشأ مرّة لا مع كل إعادة رسم
const browser = typeof window === "undefined" ? null : createClient();

export function EntityIntake({
  mode, meta, setMeta, locked, presetEntity, presetCaseId,
  lists, busy, err, onBack, onSubmit,
}) {
  const isRec = mode === "rec";
  const [step, setStep] = useState(1);
  const [entity, setEntity] = useState(presetEntity || "prosecution");
  const [letter, setLetter] = useState({ no: "", date: todayISO(), by: "" });
  const [linkSel, setLinkSel] = useState(null);
  const [refList, setRefList] = useState(null); // null = يُحمَّل

  const metaOk = !!(meta.receivedDate && meta.regNo.trim());
  const letterOk = !!(letter.no.trim() && letter.date);
  const steps = isRec ? ["الجهة والخطاب", "ربط الطلب المُحال", "نموذج التوصية"] : ["الجهة والخطاب", "نموذج الطلب"];
  const last = steps.length;

  // خطوة الربط الإلزامية — الطلبات المُحالة للجهة المختارة من القاعدة.
  useEffect(() => {
    if (!isRec) return;
    let alive = true;
    setRefList(null);
    listReferredForEntity(entity).then((res) => {
      if (!alive) return;
      setRefList(res.ok ? res.rows : []);
      // فتحٌ من «مُحالة من الفرز»: يُربط بطلبه تلقائياً (قرار ٩).
      if (res.ok && presetCaseId) {
        const hit = res.rows.find((r) => r.caseId === presetCaseId);
        if (hit) setLinkSel(hit);
      }
    });
    return () => { alive = false; };
  }, [isRec, entity, presetCaseId]);

  const go = (n) => { setStep(n); if (typeof window !== "undefined") window.scrollTo(0, 0); };
  const stepOk = step === 1 ? (metaOk && letterOk) : step === 2 && isRec ? !!linkSel : true;

  return (
    <div className="pi-wrap">
      <button className="link" onClick={() => (step > 1 ? go(step - 1) : onBack())} style={{ marginBottom: 12 }}>
        <I name="arrow_forward" size={18} /> {step > 1 ? "السابق" : locked ? "رجوع للواردة" : "رجوع لاختيار المصدر"}
      </button>
      <div className="kick">تفريغ وارد · جهة مختصّة</div>
      <h1 style={{ marginBottom: 14 }}>{isRec ? "توصية على طلبٍ مُحال" : "طلب نيابةً عن الشخص"}</h1>

      {locked ? <LockedCtx ch="mail" meta={meta} note={NOTE[mode]} /> : null}
      {err && <InlineAlert kind="error" title="تعذّر التسجيل" style={{ marginBottom: 14 }}>{err}</InlineAlert>}

      <Stepper steps={steps} step={step} go={go} />

      {step === 1 && (
        <>
          {!locked && <PaperMeta meta={meta} setMeta={setMeta} />}
          <div className="card pad" style={{ marginBottom: 14 }}>
            <div className="sec-h"><I name="account_balance" size={19} /> الجهة المُرسِلة (بالبريد الرسمي)</div>
            <div className="entseg">
              {ENTS.map(([k, n]) => (
                <button key={k} className={entity === k ? "on" : ""} onClick={() => { setEntity(k); setLinkSel(null); }}>{n}</button>
              ))}
            </div>
            <div className="rf" style={{ maxWidth: "none", marginTop: 16 }}>
              <div className="rf-divider" style={{ borderTop: "1px dashed var(--border-default)", margin: "0 0 14px", paddingTop: 14 }}>
                <I name="mail" size={16} color="var(--text-secondary)" /> بيانات الخطاب الرسمي الوارد
              </div>
              <div className="rf-grid2">
                <Field label="رقم خطاب الجهة" req hint="(الوارد بالبريد الرسمي)"><input className="mono" dir="ltr" value={letter.no} onChange={(e) => setLetter({ ...letter, no: e.target.value })} placeholder="مثال: 447/12345" /></Field>
                <Field label="تاريخ الخطاب" req><input type="date" value={letter.date} max={todayISO()} onChange={(e) => setLetter({ ...letter, date: e.target.value })} /></Field>
                <Field label="مُعِدّ التوصية في الجهة" hint="(الاسم والصفة كما في الخطاب — اختياري)"><input value={letter.by} onChange={(e) => setLetter({ ...letter, by: e.target.value })} dir="auto" placeholder="كما ورد في الخطاب" /></Field>
              </div>
            </div>
          </div>
          {!(metaOk && letterOk) && (
            <InlineAlert kind="warning" title="أكمل قيد الورود وبيانات الخطاب">
              تاريخ الورود ورقم القيد الإداري ورقم خطاب الجهة وتاريخه إلزامية قبل المتابعة — ومن تاريخ الورود تُحسب المُهل النظامية (م10).
            </InlineAlert>
          )}
        </>
      )}

      {step === 2 && isRec && (
        <div className="card pad" style={{ marginBottom: 14 }}>
          <div className="sec-h"><I name="link" size={19} /> ربط التوصية بالطلب المُحال <span className="rf-req">*</span></div>
          <p className="muted" style={{ margin: "0 0 12px" }}>اختر الطلب المُحال إلى {entName(entity)} الذي تخصّه التوصية الورقية — تُورث بياناته الموثّقة من الطلب القائم.</p>
          {refList === null ? (
            <p className="muted" style={{ margin: 0 }}>يُحمَّل من القاعدة…</p>
          ) : refList.length ? (
            <div className="lnk">
              {refList.map((r) => {
                const on = linkSel && linkSel.caseId === r.caseId;
                const left = REC_DEADLINE_DAYS - bizDaysSince(r.referredAt);
                return (
                  <button key={r.caseId} className={"lnk-row" + (on ? " on" : "")} onClick={() => setLinkSel(r)}>
                    <I name={on ? "radio_button_checked" : "radio_button_unchecked"} size={20} color={on ? "var(--color-primary)" : "var(--text-secondary)"} />
                    <div className="lnk-main">
                      <div><span className="mono" style={{ fontWeight: 700, color: "var(--text-strong)" }}>{r.secret}</span> · {r.cat}{(r.city || REGION_LABEL[r.region]) ? " · " + (r.city || REGION_LABEL[r.region]) : ""}</div>
                      <div className="muted" style={{ marginTop: 2 }}>أُحيل في {fmtD(r.referredAt)}{r.caseNo ? " · قضية " + r.caseNo : ""}</div>
                    </div>
                    <div className="lnk-meta">
                      <span className={"lnk-due" + (left <= 0 ? " over" : "")}>{left <= 0 ? "المهلة متجاوزة" : "متبقٍّ " + left + " أيام عمل"}</span>
                      <span>مهلة التوصية {REC_DEADLINE_DAYS} أيام عمل</span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <InlineAlert kind="warning" title="لا طلبات مُحالة إلى هذه الجهة بانتظار توصية">
              لا تُدخل توصية دون طلبٍ مُحال قائم — راجع الجهة المختارة أو أعد المستند للجهة لتصحيح مرجع الإحالة (يُسجل في التدقيق).
            </InlineAlert>
          )}
        </div>
      )}

      {step === last && (
        <RecommendationForm
          variant="paper"
          key={entity + mode + (linkSel ? linkSel.caseId : "")}
          rec={{
            entity, linked: isRec, letterBy: letter.by,
            secret: isRec && linkSel ? linkSel.secret : "—",
            cat: isRec && linkSel ? linkSel.cat : "",
            caseNo: isRec && linkSel ? linkSel.caseNo : "",
          }}
          lists={lists}
          busy={busy}
          uploader={browser ? {
            client: browser, regNo: meta.regNo,
            onRecord: recordAttachment, onRemove: removeAttachment,
          } : null}
          onApprove={(f) => onSubmit({ mode, entity, entityLabel: entName(entity), letter, linkSel, form: f })}
        />
      )}

      {step < last && (
        <div className="wz-nav">
          <span />
          <button className="btn btn-primary" disabled={!stepOk} onClick={() => go(step + 1)}>التالي <I name="arrow_back" size={18} /></button>
        </div>
      )}
    </div>
  );
}
