/* ============================================================
   مخزن مرحلة القرار والإشعار — منقول من decision-store.js
   IIFE(window.HemayaDecision) → وحدة ES تُصدّر HemayaDecision.
   آلة حالة القرار: preparing → voting → issued (إرسال مباشر؛ للقيادة إعادة للمعدّ أثناء التصويت)
   يعتمد localStorage (محروس للـSSR). تُستبدَل الطبقة بـ Supabase لاحقاً.
   ============================================================ */
import { councilSave, councilSubmit, councilApprove, councilReturn, councilVote, councilClose, councilIssue } from "@/lib/council-actions";

export const HemayaDecision = (function () {
  'use strict';
  var _me = null; // هوية المستخدم الحقيقيّة (تُضبط عند hydrate)
  function logErr(w) { return function (r) { if (r && !r.ok) { if (typeof console !== 'undefined') console.error('council ' + w + ':', r.error); } }; }

  // ——— مقاعد المجلس السبعة المصوّتة (5 أعضاء + النائب + الرئيس) ———
  var SEATS = {
    pp1:    { name: 'عضو نيابة (1)',   t: 'عضو المجلس',       org: 'النيابة العامة',              kind: 'member' },
    pp2:    { name: 'عضو نيابة (2)',   t: 'عضو المجلس',       org: 'النيابة العامة',              kind: 'member' },
    moi:    { name: 'ممثل الداخلية',   t: 'عضو المجلس',       org: 'وزارة الداخلية',              kind: 'member' },
    ssp:    { name: 'ممثل أمن الدولة', t: 'عضو المجلس',       org: 'رئاسة أمن الدولة',            kind: 'member' },
    nazaha: { name: 'ممثل نزاهة',      t: 'عضو المجلس',       org: 'هيئة الرقابة ومكافحة الفساد', kind: 'member' },
    deputy: { name: 'علي الدوهان',     t: 'نائب رئيس المركز', org: 'النيابة العامة',              kind: 'lead' },
    chair:  { name: 'د. إسحاق الحصين', t: 'رئيس المركز',      org: 'النيابة العامة',              kind: 'lead' },
  };
  var MEMBER_SEATS = ['pp1', 'pp2', 'moi', 'ssp', 'nazaha'];
  var VOTING_SEATS = ['pp1', 'pp2', 'moi', 'ssp', 'nazaha', 'deputy', 'chair'];
  var MAJORITY = 4; // أغلبية حاسمة من 7

  // ——— معدّو القرار (مستشارون قانونيون · توزيع آلي بالعبء · كلٌّ معزول) ———
  var PREPARERS = {
    prep1: { name: 'معدّ القرار (1)', t: 'مستشار قانوني — معدّ القرار', org: 'إدارة البرنامج — النيابة العامة' },
    prep2: { name: 'معدّ القرار (2)', t: 'مستشار قانوني — معدّ القرار', org: 'إدارة البرنامج — النيابة العامة' },
  };

  var PROTECTION_TYPES = ['الحماية الأمنية والمرافقة', 'إخفاء البيانات', 'تغيير مكان الإقامة', 'الحماية الإجرائية في الجلسات', 'وسائل اتصال آمنة', 'الدعم المالي المؤقّت'];
  var PROPOSED_TYPES = {};
  var DEFAULT_DURATION = {};
  var REASON_SKELETON = 'استناداً إلى الدراسات والتقييمات المُجمَّعة (عوامل المادة 9) وما اقترحته من تدابير المادة 14، أُعِدّ هذا القرار لعرضه على المجلس للتصويت — إعدادٌ محايد بلا توصية بالقبول أو الرفض؛ والقرار خالصٌ للمجلس.';

  // ——— حزمة الاطّلاع المُجمَّعة (دراسات وتقييمات) لكل طلب ابتدائي ———
  var QUEUE = [];
  function queueBySecret(s) { for (var i = 0; i < QUEUE.length; i++) if (QUEUE[i].secret === s) return QUEUE[i]; return null; }

  // ——— مراجعات دورة الحياة (من الإدارة الأمنية → تصويت المجلس مباشرة، دون معدّ) ———
  var LIFECYCLE = [];
  var DECIDED = [];

  // ——— الحالة الأوّلية (تُزرع مرة واحدة في localStorage) ———
  function seed() {
    return { version: 4, decisions: {}, votes: {}, lifecycleVotes: {}, lifecycleClosed: {}, lifecycleIssued: {}, messages: [] };
  }

  // ——— طبقة التخزين + المزامنة عبر الصفحات ———
  var KEY = 'hemayaDecision-v4';
  var listeners = [];
  var store = load();

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) { var p = JSON.parse(raw); if (p && p.version === 4) return p; }
    } catch (e) {}
    var s = seed();
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
    return s;
  }
  function commit() {
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {}
    for (var i = 0; i < listeners.length; i++) { try { listeners[i](); } catch (e) {} }
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', function (e) {
      if (e.key === KEY) { store = load(); for (var i = 0; i < listeners.length; i++) { try { listeners[i](); } catch (e2) {} } }
    });
  }

  function nowLabel() { return 'الآن'; }
  function ensureDecision(secret) {
    if (!store.decisions[secret]) {
      var q = queueBySecret(secret);
      store.decisions[secret] = { status: 'preparing', preparer: q ? q.preparer : 'prep1', types: [], duration: '', reasoning: '', approvals: { deputy: null, chair: null }, rejections: [], votingStartedAt: null, deadlineClosed: false, issued: null };
    }
    return store.decisions[secret];
  }

  // ——— حصيلة التصويت (إغلاق 4/7؛ العدد فردي فلا تعادل عند اكتمال النصاب) ———
  function tally(votesFor) {
    var accept = 0, reject = 0, cast = 0;
    // يعدّ كل الأصوات المُدلاة (مفاتيح مستخدمين حقيقيّين أو مقاعد) — لا يقصر على المقاعد الثابتة.
    if (votesFor) {
      var ks = Object.keys(votesFor);
      for (var i = 0; i < ks.length; i++) {
        var v = votesFor[ks[i]];
        if (v && v.choice) { cast++; if (v.choice === 'قبول') accept++; else if (v.choice === 'رفض') reject++; }
      }
    }
    var pending = Math.max(0, VOTING_SEATS.length - cast), closed = false, outcome = null;
    if (accept >= MAJORITY) { closed = true; outcome = 'مقبول'; }
    else if (reject >= MAJORITY) { closed = true; outcome = 'مرفوض'; }
    else if (cast === VOTING_SEATS.length) { closed = true; outcome = accept > reject ? 'مقبول' : 'مرفوض'; }
    return { accept: accept, reject: reject, cast: cast, pending: pending, closed: closed, outcome: outcome };
  }
  // النتيجة الفعلية مع مراعاة الإغلاق بالمهلة
  function resultFor(secret, lifecycle) {
    var votesFor = lifecycle ? store.lifecycleVotes[secret] : store.votes[secret];
    var t = tally(votesFor);
    var deadlineClosed = lifecycle ? !!store.lifecycleClosed[secret] : !!(store.decisions[secret] && store.decisions[secret].deadlineClosed);
    if (t.closed) { t.deadlineClosed = false; return t; }
    if (deadlineClosed) { t.closed = true; t.outcome = t.accept >= t.reject ? 'مقبول' : 'مرفوض'; t.deadlineClosed = true; return t; }
    t.deadlineClosed = false;
    return t;
  }

  // ——— أفعال آلة الحالة ———
  var API = {
    SEATS: SEATS, MEMBER_SEATS: MEMBER_SEATS, VOTING_SEATS: VOTING_SEATS, MAJORITY: MAJORITY,
    PREPARERS: PREPARERS, PROTECTION_TYPES: PROTECTION_TYPES, PROPOSED_TYPES: PROPOSED_TYPES,
    DEFAULT_DURATION: DEFAULT_DURATION, REASON_SKELETON: REASON_SKELETON,
    QUEUE: QUEUE, LIFECYCLE: LIFECYCLE, DECIDED: DECIDED,

    subscribe: function (fn) { listeners.push(fn); return function () { var i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; },
    getDecision: function (secret) { return store.decisions[secret] || null; },
    getVotes: function (secret) { return store.votes[secret] || {}; },
    getLifecycleVotes: function (secret) { return store.lifecycleVotes[secret] || {}; },
    lifecycleIssued: function (secret) { return store.lifecycleIssued[secret] || null; },
    tally: tally,
    resultFor: resultFor,
    queueBySecret: queueBySecret,

    // معد القرار: حفظ / رفع للاعتماد
    saveDecision: function (secret, patch) {
      var d = ensureDecision(secret);
      if (patch.types) d.types = patch.types;
      if (patch.duration !== undefined) d.duration = patch.duration;
      if (patch.reasoning !== undefined) d.reasoning = patch.reasoning;
      commit();
      if (d.caseId) councilSave(d.caseId, d.types || [], d.duration || '', d.reasoning || '').then(logErr('save'));
    },
    submitForApproval: function (secret, patch) {
      var d = ensureDecision(secret);
      d.types = patch.types; d.duration = patch.duration; d.reasoning = patch.reasoning;
      d.approvals = { deputy: null, chair: null };
      d.status = 'voting';                 // إرسال مباشر للتصويت (اختصار المسار)
      d.votingStartedAt = nowLabel();
      d.submittedAt = nowLabel();
      commit();
      if (d.caseId) councilSubmit(d.caseId, patch.types || [], patch.duration || '', patch.reasoning || '').then(logErr('submit'));
    },
    // القيادة: اعتماد النائب ثم الرئيس
    approve: function (secret, who) {
      var d = ensureDecision(secret);
      if (who === 'deputy' && d.status === 'pending_deputy') {
        d.approvals.deputy = { when: nowLabel() };
        d.status = 'pending_chair';
      } else if (who === 'chair' && d.status === 'pending_chair') {
        d.approvals.chair = { when: nowLabel() };
        d.status = 'voting';
        d.votingStartedAt = nowLabel();
      }
      commit();
      if (d.caseId) councilApprove(d.caseId).then(logErr('approve'));
    },
    // إعادة القرار للمعدّ — من الاعتماد (خامل) أو أثناء التصويت (صمّام أمان): تُصفَّر الأصوات.
    rejectApproval: function (secret, who, note) {
      var d = ensureDecision(secret);
      d.rejections = d.rejections || [];
      d.rejections.push({ by: who, when: nowLabel(), note: note || '' });
      d.approvals = { deputy: null, chair: null };
      d.status = 'preparing';
      d.votingStartedAt = null;
      d.deadlineClosed = false;
      delete store.votes[secret];          // تصفير أصوات القضية لإعادة تصويتٍ نظيف
      commit();
      if (d.caseId) councilReturn(d.caseId, note || '').then(logErr('return'));
    },
    // التصويت
    castVote: function (secret, seat, choice, note) {
      if (!store.votes[secret]) store.votes[secret] = {};
      store.votes[secret][seat] = { choice: choice, note: note || '', when: nowLabel(), mine: true };
      commit();
      var d = store.decisions[secret];
      if (d && d.caseId) councilVote(d.caseId, choice === 'قبول' ? 'accept' : 'reject', note || '').then(logErr('vote'));
    },
    closeByDeadline: function (secret) {
      var d = ensureDecision(secret); d.deadlineClosed = true; commit();
      if (d.caseId) councilClose(d.caseId).then(logErr('close'));
    },
    // الإصدار (القيادة) → إشعار
    issue: function (secret, payload) {
      var d = ensureDecision(secret);
      d.issued = { type: payload.type, types: payload.types || [], duration: payload.duration || '', reason: payload.reason || '', when: nowLabel() };
      d.status = 'issued';
      commit();
      if (d.caseId) councilIssue(d.caseId, payload.reason || '').then(logErr('issue'));
    },

    // ——— دورة الحياة (تصويت مباشر + إصدار، دون معدّ/اعتماد) ———
    castLifecycleVote: function (secret, seat, choice, note) {
      if (!store.lifecycleVotes[secret]) store.lifecycleVotes[secret] = {};
      store.lifecycleVotes[secret][seat] = { choice: choice, note: note || '', when: nowLabel() };
      commit();
    },
    closeLifecycleByDeadline: function (secret) { store.lifecycleClosed[secret] = true; commit(); },
    issueLifecycle: function (secret, payload) { store.lifecycleIssued[secret] = Object.assign({ when: nowLabel() }, payload); commit(); },

    // ——— مراسلات المجلس (معزولة بالمقعد؛ القيادة تطّلع على الجميع) ———
    // scope: 'members' → party==='member' && partySeat===seat ; 'preparer' → party==='preparer' && partySeat===seat ; 'leadership' → الكل
    getThreads: function (scope, seat) {
      if (scope === 'leadership') return store.messages.slice();
      var party = scope === 'preparer' ? 'preparer' : 'member';
      return store.messages.filter(function (t) { return t.party === party && t.partySeat === seat; });
    },
    findThread: function (id) { for (var i = 0; i < store.messages.length; i++) if (store.messages[i].id === id) return store.messages[i]; return null; },
    // بدء مراسلة (يدمج مع خيط قائم بنفس الرمز+المقعد+الطرف)
    startThread: function (party, partySeat, secret, withWho) {
      for (var i = 0; i < store.messages.length; i++) { var t = store.messages[i]; if (t.party === party && t.partySeat === partySeat && t.secret === secret && t.with === withWho) return t.id; }
      var id = 'mn' + (listeners.length + store.messages.length + 1);
      store.messages.unshift({ id: id, secret: secret, party: party, partySeat: partySeat, with: withWho, unread: 0, msgs: [] });
      commit();
      return id;
    },
    sendMessage: function (threadId, fromSeat, text) {
      var t = this.findThread(threadId); if (!t) return;
      t.msgs.push({ from: fromSeat, t: text, when: nowLabel() });
      commit();
    },

    // إعادة الضبط (لأغراض العرض)
    reset: function () { store = seed(); try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} commit(); },

    getMe: function () { return _me; },
    // تغذية المخزن من القاعدة (server): القضايا الحقيقيّة تتصدّر QUEUE، وتُدمج القرارات والأصوات.
    hydrate: function (data) {
      if (!data) return;
      _me = data.me || _me;
      var seen = {};
      (data.queue || []).forEach(function (q) { seen[q.secret] = 1; });
      var kept = QUEUE.filter(function (q) { return !seen[q.secret]; });
      QUEUE.length = 0;
      (data.queue || []).forEach(function (q) { QUEUE.push(q); });
      kept.forEach(function (q) { QUEUE.push(q); });
      Object.keys(data.decisions || {}).forEach(function (k) { store.decisions[k] = data.decisions[k]; });
      Object.keys(data.votes || {}).forEach(function (k) { store.votes[k] = data.votes[k]; });
      (data.decided || []).slice().reverse().forEach(function (d) { DECIDED.unshift(d); });
      commit();
    },
  };

  return API;
})();
