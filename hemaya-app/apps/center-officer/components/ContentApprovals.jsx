'use client';
/* اعتماد تعديلات المحتوى المقفل — شاشة رئيس المركز (الأمر 5).
   مدير النظام يرفع التعديل من بوابته، وهنا يُعرض «قبل/بعد» ويُبتّ فيه:
   الاعتماد يطبّق الحمولة على الجدول الهدف ذرّياً (RPC) ويُسجَّل بالمعتمِد. */
import React, { useState } from 'react';
import { Card, Tag, InlineAlert } from '@hemaya/ui';
import { decideContentChange } from '@/lib/content-approval-actions';

const I = ({ name, size = 18, fill = false, color = 'currentColor', style }) => (
  <span className="material-symbols-rounded" style={{ fontSize: size, color, fontVariationSettings: `'FILL' ${fill ? 1 : 0}`, ...style }}>{name}</span>
);

const KIND_AR = {
  reference_list: { t: 'قائمة مرجعية مقفلة', icon: 'list_alt' },
  notification: { t: 'قالب إشعار', icon: 'notifications' },
  system_message: { t: 'رسالة نظام', icon: 'report' },
  legal_text: { t: 'نصّ نظامي', icon: 'gavel' },
};

function ListDiff({ before, payload }) {
  const old = before.items || [];
  const next = (payload.items || []).map((x, i) => ({ ...x, _idx: i }));
  const oldByKey = Object.fromEntries(old.map((x) => [x.item_key, x]));
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {next.map((it) => {
        const prev = oldByKey[it.item_key];
        const isNew = !prev;
        const changed = prev && (prev.label !== it.label || !!prev.active !== !!it.active);
        return (
          <div key={it.item_key + it._idx} className="row" style={{ gap: 8, fontSize: 12.5, alignItems: 'baseline' }}>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)', direction: 'ltr' }}>{isNew ? '(جديد)' : it.item_key}</span>
            {changed && <span style={{ textDecoration: 'line-through', color: 'var(--text-disabled)' }}>{prev.label}{prev.active === false ? ' (موقوف)' : ''}</span>}
            <b style={{ color: isNew || changed ? 'var(--color-primary)' : 'var(--text-body)', fontWeight: isNew || changed ? 700 : 400 }}>
              {it.label}{it.active === false ? ' — إيقاف' : ''}
            </b>
          </div>
        );
      })}
      {old.filter((o) => !next.some((n) => n.item_key === o.item_key)).map((o) => (
        <div key={o.item_key} className="row" style={{ gap: 8, fontSize: 12.5 }}>
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)', direction: 'ltr' }}>{o.item_key}</span>
          <span style={{ textDecoration: 'line-through', color: 'var(--color-error)' }}>{o.label}</span>
          <Tag tone="error" size="sm">غير وارد في التعديل</Tag>
        </div>
      ))}
    </div>
  );
}

function TextDiff({ before, payload }) {
  const fields = [['subject', 'العنوان'], ['body', 'النصّ'], ['tone', 'الدرجة']];
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {fields.map(([k, t]) => {
        if (payload[k] === undefined) return null;
        return (
          <div key={k} style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)' }}>{t}</span>
            <div style={{ fontSize: 12.5, color: 'var(--text-disabled)', textDecoration: 'line-through', lineHeight: 1.7 }}>{String(before[k] ?? '—')}</div>
            <div style={{ fontSize: 13, color: 'var(--text-strong)', fontWeight: 600, lineHeight: 1.8, borderInlineStart: '3px solid var(--color-primary)', paddingInlineStart: 10 }}>{String(payload[k])}</div>
          </div>
        );
      })}
    </div>
  );
}

export function ContentApprovals({ initial, toast }) {
  const [items, setItems] = useState(initial || []);
  const [rejecting, setRejecting] = useState(null); // {id, note}
  const [busy, setBusy] = useState(false);

  const decide = async (id, approve, note) => {
    setBusy(true);
    const r = await decideContentChange(id, approve, note);
    setBusy(false);
    if (!r.ok) return toast('⚠ ' + r.error);
    setItems((xs) => xs.filter((x) => x.id !== id));
    setRejecting(null);
    toast(approve ? 'اعتُمد التعديل وسرى على كل البوابات — مُسجَّل باسمك في التدقيق' : 'رُفض التعديل بسببٍ موثّق');
  };

  return (
    <div>
      <InlineAlert kind="info" title="تعديلات المحتوى المقفل تمرّ بك" style={{ marginBottom: 14 }}>
        القوائم المسنَدة لمواد نظامية والنصوص النظامية لا يعدّلها مدير النظام مباشرة — يرفعها هنا،
        وباعتمادك تُطبَّق ذرّياً على كل البوابات وتُسجَّل في التدقيق باسمك.
      </InlineAlert>

      {items.length === 0 && (
        <Card className="card pad" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <I name="check_circle" size={38} color="var(--color-success)" />
          <p className="muted" style={{ marginTop: 12 }}>لا طلبات تعديل معلّقة.</p>
        </Card>
      )}

      <div style={{ display: 'grid', gap: 14 }}>
        {items.map((c) => {
          const k = KIND_AR[c.target_kind] || KIND_AR.legal_text;
          return (
            <Card key={c.id} className="card pad">
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12, rowGap: 8 }}>
                <div className="row" style={{ gap: 10 }}>
                  <span style={{ width: 38, height: 38, borderRadius: 'var(--radius-md)', background: 'var(--warning-10)', display: 'grid', placeItems: 'center' }}>
                    <I name={k.icon} size={20} color="var(--color-warning)" fill /></span>
                  <span>
                    <b style={{ color: 'var(--text-strong)' }}>{c.targetTitle}</b>
                    <div className="muted" style={{ fontSize: 11.5 }}>
                      {k.t} · <span className="mono" style={{ direction: 'ltr' }}>{c.target_key}</span> · رُفع {new Date(c.requested_at).toLocaleDateString('ar-SA')}
                    </div>
                  </span>
                </div>
                <Tag tone="warning" size="sm">بانتظار البتّ</Tag>
              </div>

              {c.note && <div className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}><I name="sticky_note_2" size={14} /> ملاحظة الرافع: {c.note}</div>}

              <div style={{ background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)', padding: '12px 14px', marginBottom: 14 }}>
                {c.target_kind === 'reference_list'
                  ? <ListDiff before={c.before} payload={c.payload} />
                  : <TextDiff before={c.before} payload={c.payload} />}
              </div>

              {rejecting?.id === c.id ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  <textarea value={rejecting.note} onChange={(e) => setRejecting({ id: c.id, note: e.target.value })}
                    placeholder="سبب الرفض — إلزامي ويصل مدير النظام…" dir="auto"
                    style={{ minHeight: 64, fontFamily: 'inherit', fontSize: 13, padding: '9px 12px', border: '1px solid var(--field-border)', borderRadius: 'var(--radius-md)', background: 'var(--field-bg)' }} />
                  <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
                    <button className="btn btn-ghost sm" onClick={() => setRejecting(null)}>إلغاء</button>
                    <button className="btn sm" disabled={!rejecting.note.trim() || busy}
                      style={{ background: 'var(--color-error)', color: '#fff', border: 'none' }}
                      onClick={() => decide(c.id, false, rejecting.note.trim())}>
                      <I name="block" size={16} /> تأكيد الرفض</button>
                  </div>
                </div>
              ) : (
                <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
                  <button className="btn btn-ghost sm" disabled={busy} onClick={() => setRejecting({ id: c.id, note: '' })}>
                    <I name="block" size={16} /> رفض بسبب</button>
                  <button className="btn btn-primary sm" disabled={busy} onClick={() => decide(c.id, true)}>
                    <I name="task_alt" size={16} /> اعتماد وسريان</button>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
