'use client';
/* ============================================================
   بوابة طالب الحماية — قشرة التطبيق، منقولة من «البوابة.html»
   (دفعة 12 يوليو الثانية) ومكيَّفة على البيانات الحقيقية:
   الطلبات من Supabase (RLS)، عدّادات حيّة للإشعارات/المراسلات،
   رمز سري مقنّع بكشف مؤقت، زر طوارئ، مودال تأكيد الخروج،
   وقفل «تقديم طلب جديد» ما دام للمستفيد طلب قائم.
   لوحة التجارب (Tweaks) مُبطَّلة — تكافئ أعلام إعداد في الإنتاج.
   ============================================================ */
import React, { useState, useContext, useRef, useEffect } from 'react';
import { Card, Tag, InlineAlert, SecretCode, DeadlineTimer } from '@hemaya/ui';
import { createClient } from '@hemaya/supabase/src/browser';
import { IdentityContext, RequestsContext, maskId, isOpenRequest } from './identity-context';
import {
  Profile as ProfileDetailed, NewRequest as NewRequestDetailed, RealRequests,
  STATUS_AR, CATEGORY_AR, STAGES, STAGE_INDEX, realNextAction,
} from './screens-detailed';
import { Messages as MessagesDetailed, Notifications as NotificationsDetailed, RealtimeRefresh, NOTIF_META, NOTIF_TONES } from './realtime-screens';
import { RealRequestDetail } from './real-detail';

const I = ({ name, size = 20, fill = false, color = 'currentColor', style }) => <span className="material-symbols-rounded" style={{ fontSize: size, color, fontVariationSettings: `'FILL' ${fill ? 1 : 0}`, ...style }}>{name}</span>;

const TONE_RGB = { success: 'var(--color-success)', error: 'var(--color-error)', warning: 'var(--color-warning)', info: 'var(--color-info)', neutral: 'var(--text-secondary)' };
const DASH_ICON = { success: 'verified', error: 'cancel', warning: 'draw', info: 'assignment', neutral: 'lock' };

// رمز سري مقنّع مع كشف مؤقت يُخفى آلياً بعد 6 ثوانٍ (في البناء الكامل: يُسجَّل كل كشف في التدقيق)
function SecretChip({ code }) {
  const [show, setShow] = useState(false);
  useEffect(() => { if (show) { const tm = setTimeout(() => setShow(false), 6000); return () => clearTimeout(tm); } }, [show]);
  if (!code) return null;
  return (
    <span className="sec-chip" title="رمزك السري — يحلّ محل اسمك في كل الإجراءات. يُخفى آلياً بعد ثوانٍ من الكشف.">
      <I name="lock" size={13} color="var(--color-error)" />
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-error)' }}>سري</span>
      <span className="mono" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-strong)', minWidth: 86, textAlign: 'center' }} dir="ltr">{show ? code : '••••••••••'}</span>
      <button className="sec-eye" onClick={() => setShow(!show)} aria-label={show ? 'إخفاء الرمز' : 'كشف الرمز مؤقتاً'}><I name={show ? 'visibility_off' : 'visibility'} size={16} /></button>
    </span>
  );
}

function Screen({ title, lede, children }) {
  return (
    <div>
      <div className="row" style={{ marginBottom: 6 }}>
        <h2 className="h-sec" style={{ fontSize: 21 }}>{title}</h2>
      </div>
      {lede && <p className="lede">{lede}</p>}
      {children}
    </div>
  );
}

// المهلة النظامية الجارية بحسب مرحلة الطلب (المُنقضي يُحسب من تاريخ الإنشاء تقريباً)
const daysSince = (iso) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
function deadlineFor(req) {
  if (!req) return null;
  const el = (total) => Math.min(total, Math.max(1, daysSince(req.created_at)));
  switch (req.status) {
    case 'submitted': case 'triage': return { label: 'استيفاء مستندات الفرز', total: 5, elapsed: el(5), ref: 'م7' };
    case 'referred': return { label: 'رفع توصية الجهة المختصة', total: 5, elapsed: el(5), ref: 'م4/3' };
    case 'under_study': case 'classified': case 'in_decision': return { label: 'إصدار القرار والإشعار به', total: 3, elapsed: el(3), ref: 'م10' };
    case 'accepted': case 'rejected': return { label: 'مهلة التظلّم على القرار', total: 10, elapsed: el(10), ref: 'م21' };
    default: return null;
  }
}

// ===== لوحة المعلومات =====
function Dashboard({ go, openReq, unreadNotifs, unreadMsgs, latestNotifs }) {
  const requests = useContext(RequestsContext);
  const req = requests.find(isOpenRequest) || requests[0] || null;
  const st = req ? (STATUS_AR[req.status] || { t: req.status, tone: 'info' }) : null;
  const tone = st ? (TONE_RGB[st.tone] || TONE_RGB.info) : null;
  const act = req ? realNextAction(req) : null;
  const stage = req ? (STAGE_INDEX[req.status] ?? 1) : 0;
  const needsCount = requests.filter((r) => realNextAction(r)).length;
  const dl = deadlineFor(req && isOpenRequest(req) ? req : requests.find((r) => realNextAction(r)) || null);
  return (
    <Screen title="لوحة المعلومات" lede="نظرة سريعة على طلباتك ومراسلاتك وإشعاراتك — كل ما يتطلّب إجراءً منك يظهر هنا أولاً.">
      <Card className="card pad" style={{ marginBottom: 16 }}>
        {req ? (
          <React.Fragment>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div className="row" style={{ gap: 12 }}>
                <span className="req-ic" style={{ background: 'color-mix(in srgb, ' + tone + ' 12%, transparent)', color: tone }}><I name={DASH_ICON[st.tone] || 'assignment'} size={22} fill /></span>
                <span>
                  <span className="row" style={{ gap: 8, marginBottom: 4 }}>
                    <b style={{ fontSize: 15, color: 'var(--text-strong)' }}>طلبك النشط</b>
                    <Tag tone={st.tone === 'neutral' ? 'info' : st.tone} size="sm">{st.t}</Tag>
                  </span>
                  <span className="muted" style={{ display: 'block' }}>مرجع <span className="mono">{req.ref_no}</span> · {CATEGORY_AR[req.category] || req.category} · قُدِّم {new Date(req.created_at).toLocaleDateString('ar-SA', { dateStyle: 'medium' })}</span>
                </span>
              </div>
              <button className="btn btn-primary" onClick={() => (openReq ? openReq(req) : go('requests'))}>
                <I name={act ? 'touch_app' : 'visibility'} size={18} /> {act ? 'اتّخذ الإجراء' : 'عرض الطلب'}
              </button>
            </div>
            {act && <div className="row" style={{ gap: 7, marginTop: 12, fontSize: 13, fontWeight: 600, color: 'var(--warning-70)' }}><I name="arrow_left_alt" size={15} /> الإجراء المطلوب منك: {act}</div>}
            <div className="stp" aria-hidden="true">{STAGES.map((_, i) => <span key={i} className={i <= stage ? 'on' : ''} />)}</div>
            <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>المرحلة {Math.min(stage + 1, STAGES.length)} من {STAGES.length} — {STAGES[Math.min(stage, STAGES.length - 1)].t}</div>
          </React.Fragment>
        ) : (
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="row" style={{ gap: 12 }}>
              <span className="req-ic" style={{ background: 'var(--green-10)', color: 'var(--color-primary)' }}><I name="note_add" size={22} /></span>
              <span>
                <b style={{ fontSize: 15, color: 'var(--text-strong)', display: 'block', marginBottom: 4 }}>لا يوجد طلب نشط</b>
                <span className="muted">عند تقديم طلب حماية ستظهر حالته هنا أولاً بأول.</span>
              </span>
            </div>
            <button className="btn btn-primary" onClick={() => go('new')}><I name="note_add" size={18} /> تقديم طلب جديد</button>
          </div>
        )}
      </Card>
      <div className="dash-stats">
        <button className="dash-stat" onClick={() => go('requests')}>
          <span className="ntf-ico" style={{ background: 'var(--green-10)', color: 'var(--color-primary)' }}><I name="assignment" size={20} fill /></span>
          <span><span className="dash-num">{requests.length}</span><span className="dash-lbl" style={{ display: 'block' }}>الطلبات — {needsCount} يتطلّب إجراء</span></span>
        </button>
        <button className="dash-stat" onClick={() => go('messages')}>
          <span className="ntf-ico" style={{ background: 'var(--info-10)', color: 'var(--color-info)' }}><I name="forum" size={20} fill /></span>
          <span><span className="dash-num">{unreadMsgs}</span><span className="dash-lbl" style={{ display: 'block' }}>رسائل غير مقروءة</span></span>
        </button>
        <button className="dash-stat" onClick={() => go('notifications')}>
          <span className="ntf-ico" style={{ background: 'var(--warning-10)', color: 'var(--color-warning)' }}><I name="notifications" size={20} fill /></span>
          <span><span className="dash-num">{unreadNotifs}</span><span className="dash-lbl" style={{ display: 'block' }}>إشعارات غير مقروءة</span></span>
        </button>
      </div>
      <div className="dash-grid2">
        <Card className="card pad">
          <div className="row" style={{ gap: 8, marginBottom: 12 }}>
            <I name="timer" size={18} color="var(--color-primary)" />
            <b style={{ fontSize: 13.5, color: 'var(--text-strong)' }}>المهلة النظامية الجارية</b>
          </div>
          {dl
            ? <DeadlineTimer label={dl.label} totalDays={dl.total} daysElapsed={dl.elapsed} articleRef={dl.ref} />
            : <p className="muted" style={{ margin: 0 }}>لا مهلة نظامية جارية على طلبك الحالي.</p>}
          <p className="muted" style={{ margin: '12px 0 0', fontSize: 12 }}>يُسمح بطلب واحد نشط؛ والاعتراض على أي قرار يكون بالتظلّم لا بطلب جديد.</p>
        </Card>
        <Card className="card" style={{ padding: '10px 8px' }}>
          <div className="row" style={{ gap: 8, padding: '6px 12px 8px', justifyContent: 'space-between' }}>
            <span className="row" style={{ gap: 8 }}><I name="update" size={18} color="var(--color-primary)" /><b style={{ fontSize: 13.5, color: 'var(--text-strong)' }}>آخر التحديثات</b></span>
            <button className="linkbtn" onClick={() => go('notifications')}>كل الإشعارات</button>
          </div>
          {latestNotifs.length === 0 && <p className="muted" style={{ padding: '4px 12px 10px', margin: 0 }}>لا تحديثات بعد.</p>}
          {latestNotifs.map((n) => {
            const meta = NOTIF_META(n.type);
            const [bg, fg] = NOTIF_TONES[meta.tone];
            return (
              <button className="dash-ntf" key={n.id} onClick={() => go('notifications')}>
                <span className="ntf-ico" style={{ background: bg, color: fg, width: 30, height: 30 }}><I name={meta.icon} size={16} fill /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title || 'إشعار'}</span>
                  <span className="ntf-time">{new Date(n.created_at).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                </span>
                {!n.read && <span className="dot-unread" style={{ marginTop: 0 }} />}
              </button>
            );
          })}
        </Card>
      </div>
    </Screen>
  );
}

const NAV = [
  { id: 'dashboard', t: 'لوحة المعلومات', icon: 'dashboard', C: Dashboard },
  { id: 'requests', t: 'طلباتي', icon: 'assignment', C: RealRequests },
  { id: 'new', t: 'تقديم طلب جديد', icon: 'note_add', C: NewRequestDetailed },
  { id: 'messages', t: 'المراسلات', icon: 'forum', C: MessagesDetailed },
  { id: 'notifications', t: 'الإشعارات', icon: 'notifications', C: NotificationsDetailed },
  { id: 'profile', t: 'الملف الشخصي', icon: 'account_circle', C: ProfileDetailed },
];

function PortalApp() {
  const identity = useContext(IdentityContext);
  const requests = useContext(RequestsContext);
  const supabase = useRef(createClient()).current;
  const [active, setActive] = useState('dashboard');
  const [open, setOpen] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  const [sos, setSos] = useState(false);
  // حالة الطيّ محلية وتُحفظ في تفضيلات المتصفح (تُقرأ بعد التركيب تفادياً لاختلاف الترطيب)
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { try { if (localStorage.getItem('seeker.side.collapsed') === '1') setCollapsed(true); } catch { /* خصوصية المتصفح */ } }, []);
  const toggleCollapsed = () => setCollapsed((c) => { try { localStorage.setItem('seeker.side.collapsed', c ? '0' : '1'); } catch { /* خصوصية المتصفح */ } return !c; });
  const signOut = () => { fetch('/auth/signout', { method: 'POST' }).finally(() => { window.location.href = 'http://localhost:3000/'; }); };

  // نسخة القشرة من الإشعارات: تُغذّي الشارات والعدّادات وبطاقة «آخر التحديثات» (القراءة محفوظة في القاعدة)
  const [notifs, setNotifs] = useState([]);
  useEffect(() => {
    let on = true;
    const load = () => supabase.from('notifications').select('id, title, type, read, target_tab, created_at').order('created_at', { ascending: false })
      .then(({ data }) => { if (on) setNotifs(data ?? []); });
    load();
    const ch = supabase.channel('sk-shell-notifs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => load())
      .subscribe();
    return () => { on = false; supabase.removeChannel(ch); };
  }, [supabase]);
  const unreadNotifs = notifs.filter((n) => !n.read).length;
  const latestUnread = notifs.filter((n) => !n.read).slice(0, 2);
  const latestNotifs = latestUnread.length ? latestUnread : notifs.slice(0, 2);

  // المراسلات عبر كل قضايا المستفيد (RLS) — «غير المقروء» يُتتبّع محلياً لغياب علامة قراءة في الجدول
  const [msgs, setMsgs] = useState([]);
  useEffect(() => {
    let on = true;
    const load = () => supabase.from('messages').select('*').order('created_at', { ascending: true })
      .then(({ data }) => { if (on) setMsgs(data ?? []); });
    load();
    const ch = supabase.channel('sk-shell-msgs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
        (p) => setMsgs((m) => (m.some((x) => x.id === p.new.id) ? m : [...m, p.new])))
      .subscribe();
    return () => { on = false; supabase.removeChannel(ch); };
  }, [supabase]);
  const msgReadKey = 'seeker.msgRead:' + identity.nationalId;
  const [msgReadIds, setMsgReadIds] = useState([]);
  useEffect(() => { try { const s = localStorage.getItem(msgReadKey); if (s) setMsgReadIds(JSON.parse(s)); } catch { /* خصوصية المتصفح */ } }, [msgReadKey]);
  const persistMsgRead = (ids) => { setMsgReadIds(ids); try { localStorage.setItem(msgReadKey, JSON.stringify(ids)); } catch { /* خصوصية المتصفح */ } };
  const markThreadRead = (thread) => {
    const ids = msgs.filter((m) => m.thread === thread && m.direction === 'in' && !msgReadIds.includes(m.id)).map((m) => m.id);
    if (ids.length) persistMsgRead([...msgReadIds, ...ids]);
  };
  const unreadMsgs = msgs.filter((m) => m.direction === 'in' && !msgReadIds.includes(m.id)).length;
  const sendMsg = async (thread, body) => {
    const caseId = (requests.find(isOpenRequest) || requests[0] || {}).id;
    if (!caseId || !body) return;
    const { data } = await supabase.from('messages').insert({ case_id: caseId, thread, direction: 'out', body, sender_label: 'أنت' }).select().single();
    if (data) setMsgs((m) => (m.some((x) => x.id === data.id) ? m : [...m, data]));
  };

  const hasActive = requests.some(isOpenRequest);
  const needsAction = requests.some((r) => realNextAction(r));
  // الطلب المفتوح في شاشة التفاصيل الحقيقية (seeker_case_view)
  const [selReq, setSelReq] = useState(null);
  const go = (id) => { setActive(id); setOpen(false); if (id === 'requests') setSelReq(null); };
  const openReq = (r) => { setSelReq(r); setActive('requests'); setOpen(false); };
  const cur = NAV.find((n) => n.id === active) || NAV[0];
  const Comp = cur.C;
  const secret = (requests.find(isOpenRequest) || requests[0] || {}).secret_code;

  return (
    <div className="shell">
      <aside className={'side' + (open ? ' open' : '') + (collapsed ? ' collapsed' : '')}>
        <div className="brand">
          <div className="brand-mark"><I name="shield_person" size={22} fill color="#fff" /></div>
          <div className="brand-txt">
            <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text-strong)', lineHeight: 1.2 }}>بوابة طالب الحماية</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>النيابة العامة</div>
          </div>
          <button className="collapse-btn" onClick={toggleCollapsed} title={collapsed ? 'توسيع القائمة' : 'طيّ القائمة'} aria-label={collapsed ? 'توسيع القائمة' : 'طيّ القائمة'}>
            <I name={collapsed ? 'left_panel_open' : 'left_panel_close'} size={20} />
          </button>
        </div>
        <nav className="nav">
          {NAV.map((n) => {
            const badge = n.id === 'notifications' ? (unreadNotifs || null) : n.id === 'messages' ? (unreadMsgs || null) : n.id === 'requests' && needsAction ? '!' : null;
            const lockedNew = n.id === 'new' && hasActive;
            return (
              <button key={n.id} className={'nav-item' + (active === n.id ? ' on' : '')} title={collapsed ? n.t : (lockedNew ? 'لديك طلب قائم — لا يمكن تقديم طلب جديد' : undefined)} onClick={() => go(n.id)}>
                <I name={n.icon} size={20} /> <span className="nav-lbl">{n.t}</span>
                {lockedNew && <span style={{ marginInlineStart: 'auto' }} className="nav-lbl"><I name="lock" size={15} color="var(--text-disabled)" /></span>}
                {badge && <span className="nav-badge">{badge}</span>}
              </button>
            );
          })}
        </nav>
        <div className="side-bottom">
          <div className="side-user" title={identity.name + (identity.via === 'نفاذ' ? ' — موثّق عبر نفاذ' : '')}>
            <span className="su-av">{(identity.name || '؟').trim()[0]}</span>
            <span className="nav-lbl" style={{ minWidth: 0 }}>
              <span className="su-name" style={{ display: 'block' }}>{identity.name}</span>
              {identity.via === 'نفاذ' && <span className="su-badge"><I name="verified_user" size={12} fill /> موثّق عبر نفاذ</span>}
            </span>
          </div>
          <button className="logout-btn" title="تسجيل الخروج" onClick={() => setConfirmOut(true)}>
            <I name="logout" size={19} /> <span className="nav-lbl">تسجيل الخروج</span>
          </button>
        </div>
        <div className="side-foot">© 2026 النيابة العامة — جميع الحقوق محفوظة.</div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <div className="main">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setOpen(true)}><I name="menu" size={22} /></button>
          <button className="sos-btn" onClick={() => setSos(true)} title="الإبلاغ عن خطر"><I name="e911_emergency" size={17} /> طوارئ</button>
          <span className="row" style={{ marginInlineStart: 'auto', gap: 10 }}>
            <button className="qa-btn" title="الإشعارات" onClick={() => go('notifications')}>
              <I name="notifications" size={20} />
              {unreadNotifs > 0 && <span className="qa-badge">{unreadNotifs}</span>}
            </button>
            <button className="qa-btn" title="المراسلات" onClick={() => go('messages')}>
              <I name="forum" size={20} />
              {unreadMsgs > 0 && <span className="qa-badge">{unreadMsgs}</span>}
            </button>
            <SecretChip code={secret} />
          </span>
        </header>
        <main className="content">
          {active === 'requests' && selReq
            ? <RealRequestDetail request={selReq} back={() => setSelReq(null)} go={go} />
            : <Comp go={go} openReq={openReq} onOpen={active === 'requests' ? openReq : undefined}
                unreadNotifs={unreadNotifs} unreadMsgs={unreadMsgs} latestNotifs={latestNotifs}
                msgs={msgs} sendMsg={sendMsg} msgReadIds={msgReadIds} markThreadRead={markThreadRead} />}
        </main>
      </div>
      {sos && (
        <div className="nf-scrim" onClick={() => setSos(false)}>
          <div className="nf-modal" onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ justifyContent: 'center', gap: 8 }}>
              <I name="e911_emergency" size={24} fill color="var(--color-error)" />
              <b style={{ fontSize: 16, color: 'var(--text-strong)' }}>الإبلاغ عن خطر</b>
            </div>
            <p className="muted" style={{ margin: '10px 0 16px', lineHeight: 1.7, textAlign: 'start' }}><b style={{ color: 'var(--color-error)' }}>إن كان الخطر داهماً اتصل فوراً بالجهات الأمنية (911).</b><br />لغير ذلك، راسِل المركز عبر القناة المؤمّنة — تُعالج بلاغات الخطر بأولوية عاجلة.</p>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => { setSos(false); go('messages'); }}><I name="forum" size={18} /> مراسلة المركز الآن</button>
            <button className="linkbtn" style={{ marginTop: 12 }} onClick={() => setSos(false)}>إغلاق</button>
          </div>
        </div>
      )}
      {confirmOut && (
        <div className="nf-scrim" onClick={() => setConfirmOut(false)}>
          <div className="nf-modal" onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ justifyContent: 'center', gap: 8 }}>
              <I name="logout" size={22} color="var(--color-error)" />
              <b style={{ fontSize: 16, color: 'var(--text-strong)' }}>تسجيل الخروج</b>
            </div>
            <p className="muted" style={{ margin: '10px 0 18px', lineHeight: 1.6 }}>ستُنهى جلستك الموثّقة عبر نفاذ، وستحتاج للدخول مجدداً لمتابعة طلبك. هل تريد المتابعة؟</p>
            <button className="btn" style={{ width: '100%', background: 'var(--color-error)', color: '#fff' }} onClick={signOut}><I name="logout" size={18} /> تسجيل الخروج</button>
            <button className="linkbtn" style={{ marginTop: 12 }} onClick={() => setConfirmOut(false)}>إلغاء</button>
          </div>
        </div>
      )}
    </div>
  );
}

function SeekerRoot({ identity, requests }) {
  return (
    <IdentityContext.Provider value={identity}>
      <RequestsContext.Provider value={requests || []}>
        <RealtimeRefresh />
        <PortalApp />
      </RequestsContext.Provider>
    </IdentityContext.Provider>
  );
}

export { PortalApp, SeekerRoot };
