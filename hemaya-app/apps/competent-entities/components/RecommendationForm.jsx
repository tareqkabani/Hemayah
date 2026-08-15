'use client';
/* ============================================================
   البلاغ العاجل — يبقى محلّياً لأنّه مسارٌ مستقل (م8) لا يمرّ بدورة
   التوصية. أمّا نموذج التوصية فانتقل إلى @hemaya/recommendation
   مصدراً واحداً تستهلكه هذه البوابة ووحدة الإدخال اليدوي معاً.
   ============================================================ */
import React, { useState } from "react";
import { Card, Tag, InlineAlert } from "@hemaya/ui";
import { PROTECTION_TYPE_LABELS_14 as PROTECTION_TYPES, RISK_LEVEL } from "@hemaya/domain";
import { I, Field, Locked, Choice, Multi, Sec, ENTITIES } from "@hemaya/recommendation";

const WAQIA = ['الاعتداء على الأشخاص', 'الآداب العامة', 'الأموال', 'المخدرات', 'الجرائم الاقتصادية', 'الماسة بالثقة العامة', 'الأسرة والأحداث', 'الاتجار بالأشخاص', 'الجرائم المعلوماتية', 'الأمن الوطني'];

export function UrgentForm({ rec, onSubmit, onBack }) {
  const ent = ENTITIES[rec.entity] || ENTITIES.prosecution;
  const [u, setU] = useState({
    obName: '', obNid: '', obPhone: '', cat: '', crimeType: '', waqia: [], danger: '', source: '', requested: '', requestedTypes: [],
    extends: '', extendsWho: '', caseNo: rec.caseNo || '',
  });
  const set = (k, v) => setU((p) => ({ ...p, [k]: v }));
  const [ack, setAck] = useState(false);
  const [sent, setSent] = useState(false);

  const ready = u.obName.trim() && u.obNid.length === 10 && u.cat && u.crimeType && u.danger.trim() && u.source.trim() && u.requestedTypes.length > 0 && u.extends && (u.extends === 'لا' || u.extendsWho.trim()) && ack;

  if (sent) {
    return (
      <div className="rf">
        <button className="btn btn-ghost" onClick={onBack} style={{ marginBottom: 16 }}><I name="arrow_forward" size={18} /> رجوع</button>
        <Card className="card pad" style={{ textAlign: 'center', padding: '44px 24px', borderColor: 'var(--color-error)' }}>
          <div style={{ width: 60, height: 60, margin: '0 auto 16px', borderRadius: 'var(--radius-lg)', background: 'var(--error-10)', display: 'grid', placeItems: 'center' }}><I name="emergency" size={30} color="var(--color-error)" fill /></div>
          <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--text-strong)' }}>رُفع البلاغ العاجل مباشرةً للنائب العام</div>
          <p className="muted" style={{ maxWidth: 520, margin: '10px auto 0', lineHeight: 1.7 }}>رقم البلاغ <b className="mono">U-2026-0052</b>. وصل إلى بوابة النائب العام للبتّ الفوري، ومركز الحماية مطّلع على المسار. ستصلكم نتيجة البتّ عبر الإشعارات والمراسلات.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
            <button className="btn btn-primary" onClick={onBack}><I name="check" size={18} /> تمّ</button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="rf">
      <button className="btn btn-ghost" onClick={onBack} style={{ marginBottom: 16 }}><I name="arrow_forward" size={18} /> رجوع</button>

      <InlineAlert kind="error" title="بلاغ عاجل — خطر وشيك على الحياة" style={{ marginBottom: 18 }}>
        يُرفع هذا البلاغ <b>مباشرةً إلى النائب العام</b> للبتّ الفوري (المادة الثامنة)، ويتجاوز الفرز والدراسة والمجلس. لا يُستخدم إلا عند وجود خطر وشيك يهدّد الحياة؛ ولغير ذلك استخدم نموذج التوصية المعتاد.
      </InlineAlert>

      <div className="rf-officer">
        <div className="rf-officer-ico"><I name="support_agent" size={20} color="var(--color-primary)" fill /></div>
        <div className="rf-officer-main">
          <div className="rf-officer-role">ضابط الاتصال المعتمد · <span className="rf-officer-ent">{ent.name}</span></div>
          <div className="rf-officer-sub">أنت الرافع للبلاغ العاجل؛ هويتك ودورك موثّقان آلياً في سجلّ التدقيق.</div>
        </div>
        <div className="rf-officer-meta"><Tag tone="success" size="sm" iconLeft={<I name="verified_user" size={13} />}>دخول عبر نفاذ</Tag></div>
      </div>

      <Sec n="١" title="المعنيّ بالحماية" sub="تُجلب الهوية آلياً من نفاذ / المركز الوطني للمعلومات لمنع خطأ الإدخال.">
        <div className="rf-fetch unverified">
          <div className="row" style={{ gap: 9, marginBottom: 6 }}><I name="running_with_errors" size={20} color="var(--color-warning)" fill /><b style={{ fontSize: 15, color: 'var(--text-strong)' }}>بيانات تُدخلها الجهة — غير موثّقة بعد</b></div>
          <p className="muted" style={{ margin: '0 0 12px' }}>تُدخل الجهة بيانات المعنيّ وترفق صورة هويته؛ ويُرفع البلاغ فوراً للنائب العام. تُوثّق الهوية حين يدخل الشخص بحسابه عبر نفاذ لاحقاً.</p>
          <div className="rf-grid2">
            <Field label="الاسم الرباعي" req><input value={u.obName} onChange={(e) => set('obName', e.target.value)} dir="auto" /></Field>
            <Field label="رقم الهوية / الإقامة" req><input value={u.obNid} onChange={(e) => set('obNid', e.target.value.replace(/\D/g, '').slice(0, 10))} className="mono" inputMode="numeric" placeholder="1XXXXXXXXX" dir="ltr" /></Field>
            <Field label="رقم الجوال" req hint="(للإشعار بالتفعيل)"><input value={u.obPhone} onChange={(e) => set('obPhone', e.target.value.replace(/\D/g, '').slice(0, 10))} className="mono" inputMode="numeric" placeholder="05XXXXXXXX" dir="ltr" /></Field>
          </div>
          <Field label="صفة المعنيّ" req hint=""><Choice value={u.cat} set={(v) => set('cat', v)} options={['شاهد', 'مبلّغ', 'خبير', 'ضحية']} /></Field>
        </div>
      </Sec>

      <Sec n="٢" title="القضية محل البلاغ">
        <div className="rf-grid2">
          <Locked label="الجهة الرافعة" value={ent.name} src="حساب الجهة" />
          <Field label="رقم القضية" req><input value={u.caseNo} onChange={(e) => set('caseNo', e.target.value)} dir="auto" placeholder="مثال: ق-5102/1447" /></Field>
        </div>
        <Field label="نوع الجريمة" req><Choice value={u.crimeType} set={(v) => set('crimeType', v)} options={['كبيرة موجبة للتوقيف', 'ليست كبيرة موجبة للتوقيف']} /></Field>
        <Field label="الواقعة (يمكن اختيار أكثر من واحدة)"><Multi value={u.waqia} set={(v) => set('waqia', v)} options={WAQIA} /></Field>
      </Sec>

      <Sec n="٣" title="طبيعة الخطر الوشيك" sub="بيانات مختصرة كافية للبتّ الفوري." fed>
        <Field label="وصف الخطر الوشيك" req hint="ما الذي يجعل الخطر داهماً الآن؟">
          <textarea value={u.danger} onChange={(e) => set('danger', e.target.value)} dir="auto" placeholder="مثال: تهديد مباشر بالقتل عقب الإدلاء بالشهادة، ورُصد تتبّع للمسكن مساء أمس…" />
        </Field>
        <Field label="مصدر التهديد" req><textarea value={u.source} onChange={(e) => set('source', e.target.value)} dir="auto" placeholder="من مصدر التهديد، وهل هو محدّد الهوية؟" /></Field>
        <Field label="هل يمتدّ الخطر لوثيقي الصلة؟" req><Choice value={u.extends} set={(v) => set('extends', v)} options={['نعم', 'لا']} /></Field>
        {u.extends === 'نعم' && <Field label="من يمتدّ إليهم الخطر" req><input value={u.extendsWho} onChange={(e) => set('extendsWho', e.target.value)} dir="auto" placeholder="مثال: الزوجة وابنان قاصران" /></Field>}
      </Sec>

      <Sec n="٤" title="التدابير المؤقّتة المطلوبة" sub="تُختار من بنود المادة الرابعة عشرة واللائحة؛ والنائب العام يبتّ بالتدابير النهائية." fed>
        <Field label="التدابير المطلوبة (يمكن اختيار أكثر من واحد)" req>
          <Multi value={u.requestedTypes} set={(v) => set('requestedTypes', v)} options={PROTECTION_TYPES} />
        </Field>
        <Field label="إيضاح الإجراء العاجل (اختياري)" hint="تفاصيل تساعد النائب على البتّ الفوري">
          <textarea value={u.requested} onChange={(e) => set('requested', e.target.value)} dir="auto" placeholder="مثال: مرافقة أمنية فورية ونقل مؤقّت لمكان آمن لحين انعقاد المجلس." />
        </Field>
      </Sec>

      <Sec n="٥" title="المرفقات الداعمة" sub="مستندات تُرفع مع البلاغ وتُحفظ في ملف الحالة؛ يستند إليها مركز الحماية لاحقاً عند إعداد دراسة الحالة وتجديد مدّة التدابير المؤقّتة (الحدّ الأقصى 30 يوماً — المادة الثامنة).">
        <div className="rf-attach-grid">
          {['الهوية الوطنية للمعنيّ بالحماية والتابعين', 'بيانات القضية والإجراءات النظامية', 'أدلّة الخطر الوشيك (وسائط، تسجيلات، صور، أوراق)', 'المحضر الهاتفي / إثبات التهديد', 'تقرير تقييم المخاطر إن وُجد', 'تقرير طبي للحالة الصحية إن وُجد', 'أي مسوّغات تدعم البلاغ'].map((a, i) => (
            <label key={i} className="rf-attach"><input type="checkbox" /><I name="upload_file" size={16} color="var(--text-secondary)" /><span>{a}</span></label>
          ))}
        </div>
        <InlineAlert kind="info" style={{ marginTop: 12 }}>
          رفع المرفقات لا يؤخّر البتّ الفوري؛ يُرفع البلاغ فوراً، وتبقى المرفقات متاحةً لمركز الحماية لإعداد الدراسة الكاملة وتجديد المدّة قبل انقضائها.
        </InlineAlert>
      </Sec>

      <Card className="card pad" style={{ marginTop: 8, borderColor: 'var(--color-error)' }}>
        <div className="row" style={{ gap: 9, marginBottom: 10 }}><I name="bolt" size={22} color="var(--color-error)" fill /><b style={{ fontSize: 16, color: 'var(--text-strong)' }}>رفع البلاغ العاجل</b></div>
        <label className="rf-ack"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /><span>أقرّ بصحّة البيانات، وأنّ الخطر وشيك ويهدّد الحياة فعلاً، وأرفع البلاغ مباشرةً للنائب العام للبتّ الفوري — تحت مسؤوليتي النظامية.</span></label>
        <div className="row" style={{ marginTop: 16, gap: 10 }}>
          <button className="btn btn-danger" disabled={!ready} onClick={() => { setSent(true); if (typeof window !== 'undefined') window.scrollTo(0, 0); if (onSubmit) onSubmit(u); }}><I name="send" size={18} /> رفع البلاغ للنائب العام</button>
        </div>
        {!ready && <p className="muted" style={{ marginTop: 10, fontSize: 12.5 }}>أكمل الحقول الإلزامية وأقرّ بالتعهّد لتفعيل الرفع.</p>}
      </Card>
    </div>
  );
}
