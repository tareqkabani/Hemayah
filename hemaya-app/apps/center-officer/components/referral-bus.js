/* ============================================================
   ناقل الإحالات المشترك — منقول من lib/referral-bus.js (IIFE→وحدة ES).
   المركز يُصدر إحالات تدابير م14 → الجهة المنفّذة. localStorage محروسٌ للـSSR.
   ============================================================ */
export const HemayaBus = (function () {
  const KEY = 'hemaya.referrals.v1';
  const KEY_REV = 'hemaya.reviews.v1';
  const hasLS = () => typeof localStorage !== 'undefined';
  const hasWin = () => typeof window !== 'undefined';

  const M13 = {
    transfer:  { ar: 'النقل من مكان العمل',       ref: 'م14/3',    authority: 'hr',     icon: 'move_up' },
    alt:       { ar: 'توفير عمل بديل',            ref: 'م14/4',    authority: 'hr',     icon: 'work' },
    dismissal: { ar: 'معالجة الفصل التعسفي',       ref: 'م14/4',    authority: 'hr',     icon: 'gavel' },
    housing:   { ar: 'تغيير / تأمين المسكن',       ref: 'م14/8،11', authority: 'hr',     icon: 'home' },
    finance:   { ar: 'المساعدة المالية',           ref: 'م14/12',   authority: 'hr',     icon: 'payments' },
    psych:     { ar: 'الإرشاد النفسي',             ref: 'م14/5',    authority: 'health', icon: 'psychology' },
    social:    { ar: 'الإرشاد الاجتماعي',          ref: 'م14/5',    authority: 'health', icon: 'diversity_3' },
    medical:   { ar: 'الرعاية الطبية',             ref: 'م14/5',    authority: 'health', icon: 'medical_services' },
    legal:     { ar: 'الاستشارة / المساعدة القانونية', ref: 'م14', authority: 'legal',  icon: 'balance' },
    guard:     { ar: 'الحماية الشخصية والمرافقة',  ref: 'م14/1',    authority: 'security', icon: 'shield_person' },
    secure:    { ar: 'تأمين وحراسة المسكن',         ref: 'م14/2',    authority: 'security', icon: 'home_health' },
    testify:   { ar: 'تدابير الإدلاء بالشهادة',     ref: 'م14/9',    authority: 'security', icon: 'record_voice_over' },
  };
  const AUTH = {
    hr:     { ar: 'وزارة الموارد البشرية',     short: 'الموارد البشرية', icon: 'badge',             color: 'var(--color-info)' },
    health: { ar: 'وزارة الصحة',               short: 'الصحة',           icon: 'health_and_safety', color: 'var(--color-primary)' },
    legal:  { ar: 'القسم القانوني — المركز',   short: 'القانوني',        icon: 'balance',           color: 'var(--warning-70)' },
    security:{ ar: 'الإدارة الأمنية — الداخلية', short: 'الأمنية',         icon: 'security',          color: 'var(--green-80)' },
  };
  const STATUS = {
    new:      { ar: 'مُرسَلة — بانتظار الجهة', tone: 'warning' },
    assigned: { ar: 'مُسنَدة لمختص',           tone: 'info' },
    progress: { ar: 'قيد المعالجة',            tone: 'info' },
    review:   { ar: 'بانتظار اعتماد المدير',   tone: 'warning' },
    done:     { ar: 'مكتملة ومُبلَّغة',         tone: 'success' },
  };

  function read() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } }
  function writeAll(arr) {
    try { localStorage.setItem(KEY, JSON.stringify(arr)); } catch (e) {}
    try { if (hasWin()) window.dispatchEvent(new CustomEvent('hemaya-bus', { detail: { key: KEY } })); } catch (e) {}
  }
  function now() { try { return new Date().toLocaleString('ar-SA', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }); } catch (e) { return 'الآن'; } }
  function uid() { return 'REF-' + Math.random().toString(36).slice(2, 7).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(); }

  function list(filter) {
    let a = read();
    if (filter && filter.authority) a = a.filter((r) => r.authority === filter.authority);
    if (filter && filter.caseRef) a = a.filter((r) => r.caseRef === filter.caseRef);
    return a.sort((x, y) => (y.createdAt || 0) - (x.createdAt || 0));
  }
  function create(rec) {
    const m = M13[rec.service] || {};
    const r = Object.assign({ id: uid(), status: 'new', assignee: null, sched: null, result: null, createdAt: Date.now(),
      authority: m.authority, ref: m.ref, referredAt: now(),
      history: [{ at: now(), by: 'مركز الحماية', note: 'إصدار الإحالة وتوجيهها للجهة' }] }, rec);
    const all = read(); all.push(r); writeAll(all); return r;
  }
  function update(id, patch, note) {
    const all = read(); const i = all.findIndex((r) => r.id === id); if (i < 0) return null;
    all[i] = Object.assign({}, all[i], patch, { updatedAt: Date.now() });
    if (note) all[i].history = (all[i].history || []).concat([{ at: now(), by: patch._by || 'الجهة المنفّذة', note }]);
    delete all[i]._by; writeAll(all); return all[i];
  }
  function seed(records) {
    const all = read(); const have = new Set(all.map((r) => r.id)); let added = 0;
    records.forEach((rec) => {
      if (have.has(rec.id)) return;
      const m = M13[rec.service] || {};
      all.push(Object.assign({ status: 'new', assignee: null, sched: null, result: null, createdAt: Date.now() - (++added) * 86400000,
        authority: m.authority, ref: m.ref, referredAt: rec.referredAt || now(),
        history: [{ at: rec.referredAt || now(), by: 'مركز الحماية', note: 'إصدار الإحالة وتوجيهها للجهة' }] }, rec));
    });
    if (added) writeAll(all); return added;
  }

  function readRev() { try { return JSON.parse(localStorage.getItem(KEY_REV) || '[]'); } catch (e) { return []; } }
  function writeAllRev(arr) {
    try { localStorage.setItem(KEY_REV, JSON.stringify(arr)); } catch (e) {}
    try { if (hasWin()) window.dispatchEvent(new CustomEvent('hemaya-bus', { detail: { key: KEY_REV } })); } catch (e) {}
  }
  function raiseReview(rec) {
    const all = readRev(); const i = all.findIndex((r) => r.id === rec.id);
    const row = Object.assign({ status: 'raised', createdAt: Date.now(),
      history: [{ at: now(), by: rec.officer || 'الإدارة الأمنية', note: 'رفع توصية دورة الحياة للمجلس' }] }, rec);
    if (i < 0) all.push(row); else all[i] = Object.assign({}, all[i], rec, { status: 'raised', updatedAt: Date.now() });
    writeAllRev(all); return row;
  }
  function listReviews(filter) {
    let a = readRev();
    if (filter && filter.status) a = a.filter((r) => r.status === filter.status);
    return a.sort((x, y) => (y.createdAt || 0) - (x.createdAt || 0));
  }
  function decideReview(id, decision) {
    const all = readRev(); const i = all.findIndex((r) => r.id === id); if (i < 0) return null;
    all[i] = Object.assign({}, all[i], { status: 'decided', decision: decision, decidedAt: Date.now() });
    all[i].history = (all[i].history || []).concat([{ at: now(), by: 'مجلس المركز', note: 'بتّ المجلس: ' + (decision.type || '') }]);
    writeAllRev(all); return all[i];
  }
  function subscribe(cb) {
    if (!hasWin()) return () => {};
    const onStorage = (e) => { if (!e || e.key === KEY || e.key === KEY_REV) cb(); };
    const onLocal = () => cb();
    window.addEventListener('storage', onStorage);
    window.addEventListener('hemaya-bus', onLocal);
    return () => { window.removeEventListener('storage', onStorage); window.removeEventListener('hemaya-bus', onLocal); };
  }

  return { KEY, KEY_REV, M13, AUTH, STATUS, list, create, update, seed, read, subscribe, raiseReview, listReviews, decideReview };
})();
