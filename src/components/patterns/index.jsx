'use client';
/* ============================================================
   مكتبة أنماط «حماية» — منقولة من lib/hemaya-patterns-core.jsx
   كل نمط يترجم متطلباً نظامياً إلى عنصر واجهة (الرمز السري، المؤقّت،
   مستوى الخطر، زر الطوارئ). فوق مكوّنات نظام «كود».
   ============================================================ */
import React from 'react';
import { useState } from 'react';
import { Button, Tag, InlineAlert, Modal } from '@/components/ds';

const I = ({ name, size = 20, fill = false, color = 'currentColor', style }) => (
  <span className="material-symbols-rounded" style={{ fontSize: size, color, fontVariationSettings: `'FILL' ${fill ? 1 : 0}`, ...style }}>{name}</span>
);

/* ───────────────── 1. الرمز السري بدل الاسم (م2، م15، م16) ───────────────── */
export function SecretCode({ code = 'C-2026-0481', name = 'محمد بن ع. الشهري', canReveal = true, onReveal }) {
  const [shown, setShown] = useState(false);
  const reveal = () => { setShown(true); onReveal && onReveal(code); };
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '6px 10px 6px 14px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-full)', background: 'var(--surface-card)' }}>
      <I name="tag" size={18} color="var(--color-primary)" />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 600, color: 'var(--text-strong)', letterSpacing: '0.02em' }}>{code}</span>
      <span style={{ width: 1, height: 18, background: 'var(--border-subtle)' }} />
      {shown
        ? <span style={{ fontSize: 14, color: 'var(--text-body)' }}>{name}</span>
        : <span style={{ fontSize: 14, color: 'var(--text-disabled)', fontFamily: 'var(--font-mono)', letterSpacing: '0.15em' }}>••••••</span>}
      {canReveal && !shown &&
        <button onClick={reveal} title="كشف الهوية — يتطلب صلاحية ويُسجَّل في التدقيق"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-link)', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, padding: '2px 4px' }}>
          <I name="visibility" size={16} /> كشف
        </button>}
      {shown &&
        <Tag tone="warning" size="sm" iconLeft={<I name="history" size={13} />}>سُجِّل الكشف</Tag>}
    </div>
  );
}

/* ───────────────── 2. مؤقّت الميعاد النظامي ───────────────── */
export function DeadlineTimer({ label = 'رفع التوصية', totalDays = 5, daysElapsed = 2, articleRef = 'م4/3' }) {
  const remaining = totalDays - daysElapsed;
  const ratio = Math.max(0, Math.min(1, remaining / totalDays));
  const state = remaining <= 0 ? 'over' : ratio > 0.5 ? 'ok' : 'warn';
  const map = {
    ok:   { c: 'var(--color-primary)', bg: 'var(--green-10)', t: `متبقٍّ ${remaining} يوم` },
    warn: { c: 'var(--color-warning)', bg: 'var(--warning-10)', t: `يقترب — ${remaining} يوم` },
    over: { c: 'var(--color-error)',   bg: 'var(--error-10)',   t: `متجاوز بـ ${Math.abs(remaining)} يوم` },
  };
  const m = map[state];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 220, padding: 14, border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', background: 'var(--surface-card)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 600, color: 'var(--text-strong)' }}>
          <I name={state === 'over' ? 'running_with_errors' : 'timer'} size={18} color={m.c} fill /> {label}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{articleRef}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ padding: '2px 10px', borderRadius: 'var(--radius-full)', background: m.bg, color: m.c, fontWeight: 700, fontSize: 12.5 }}>{m.t}</span>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>من أصل {totalDays} أيام</span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: 'var(--surface-sunken)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(1 - ratio) * 100}%`, background: m.c, borderRadius: 3, transition: 'width var(--duration-base)' }} />
      </div>
    </div>
  );
}

/* ───────────────── 3. مستوى تصنيف الأخطار (م3/9/ك) ───────────────── */
export const RISK = {
  'منخفض': { tone: 'success', c: 'var(--color-success)', bg: 'var(--success-10)', icon: 'shield' },
  'متوسط': { tone: 'warning', c: 'var(--color-warning)', bg: 'var(--warning-10)', icon: 'shield' },
  'عالٍ':  { tone: 'error',   c: 'var(--color-error)',   bg: 'var(--error-10)',   icon: 'gpp_maybe' },
  'حرج':   { tone: 'error',   c: 'var(--neutral-0)',     bg: 'var(--error-50)',   icon: 'gpp_bad' },
};
export function RiskLevel({ level = 'عالٍ', locked = true }) {
  const m = RISK[level] || RISK['متوسط'];
  const onDark = level === 'حرج';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 12px', borderRadius: 'var(--radius-md)', background: m.bg, color: onDark ? m.c : m.c, border: onDark ? 'none' : `1px solid ${m.c}33` }}>
      <I name={m.icon} size={17} color={onDark ? 'var(--neutral-0)' : m.c} fill />
      <span style={{ fontWeight: 700, fontSize: 13.5, color: onDark ? 'var(--neutral-0)' : m.c }}>خطر {level}</span>
      {locked && <I name="lock" size={13} color={onDark ? 'var(--neutral-0)' : m.c} style={{ opacity: 0.7 }} />}
    </span>
  );
}

/* ───────────────── 4. زر الإبلاغ الفوري 24/7 (م14/6) ───────────────── */
export function EmergencyButton({ onReport }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const fire = () => { setSent(true); onReport && onReport(); setTimeout(() => { setOpen(false); setSent(false); }, 1800); };
  return (
    <React.Fragment>
      <button onClick={() => setOpen(true)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 10, height: 'var(--control-height-lg)', padding: '0 24px', background: 'var(--color-error)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(217,45,32,0.3)' }}>
        <I name="emergency" size={22} fill /> الإبلاغ الفوري عن خطر
      </button>
      <Modal open={open} onClose={() => !sent && setOpen(false)} title="الإبلاغ الفوري عن خطر وشيك"
        footer={!sent && <React.Fragment>
          <Button variant="secondary" onClick={() => setOpen(false)}>إلغاء</Button>
          <Button variant="danger" iconLeft={<I name="emergency" size={18} fill />} onClick={fire}>إرسال الإنذار الآن</Button>
        </React.Fragment>}>
        {sent
          ? <InlineAlert kind="success" title="تم إرسال الإنذار">وصل الإنذار إلى قناة العمليات 24/7 مع سياق الحالة. ستتلقّى استجابة عاجلة.</InlineAlert>
          : <div style={{ display: 'grid', gap: 12 }}>
              <InlineAlert kind="error" title="للحالات العاجلة فقط">سيُنشئ هذا الإجراء إنذاراً فورياً لقناة العمليات على مدار الساعة، مرفقاً بالرمز السري ومستوى الخطر وجهة الاتصال.</InlineAlert>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--text-body)', lineHeight: 1.6 }}>إن كنت أنت أو أحد وثيقي الصلة بك في خطر، اضغط «إرسال الإنذار الآن».</p>
            </div>}
      </Modal>
    </React.Fragment>
  );
}

export const HemayaPatterns = { SecretCode, DeadlineTimer, RiskLevel, EmergencyButton, RISK };
