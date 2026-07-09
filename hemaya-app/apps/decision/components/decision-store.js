/* ============================================================
   مخزن مرحلة القرار والإشعار — المسار الجديد (بطلب رئيس المركز)
   IIFE(window.HemayaDecision) → وحدة ES تُصدّر HemayaDecision.
   آلة الحالة: preparing → voting → issued (المعدّ يطرح مباشرةً للتصويت).
   مصدر الحقيقة: Supabase (يُغذَّى عبر hydrate؛ الطفرات تُوجَّه لأفعال الخادم).
   ============================================================ */

export const HemayaDecision = (function () {
  "use strict";

  // مقاعد المجلس السبعة المصوّتة (5 أعضاء + النائب + الرئيس)
  var SEATS = {
    pp1:    { name: "عضو المجلس (نيابة 1)",  t: "عضو المجلس", org: "النيابة العامة",              kind: "member" },
    pp2:    { name: "عضو المجلس (نيابة 2)",  t: "عضو المجلس", org: "النيابة العامة",              kind: "member" },
    moi:    { name: "ممثل الداخلية",          t: "عضو المجلس", org: "وزارة الداخلية",              kind: "member" },
    ssp:    { name: "ممثل أمن الدولة",        t: "عضو المجلس", org: "رئاسة أمن الدولة",            kind: "member" },
    nazaha: { name: "ممثل نزاهة",             t: "عضو المجلس", org: "هيئة الرقابة ومكافحة الفساد", kind: "member" },
    deputy: { name: "نائب رئيس المركز",       t: "نائب رئيس المركز", org: "النيابة العامة",         kind: "lead" },
    chair:  { name: "رئيس المركز",            t: "رئيس المركز",      org: "النيابة العامة",         kind: "lead" },
  };
  var MEMBER_SEATS = ["pp1", "pp2", "moi", "ssp", "nazaha"];
  var VOTING_SEATS = ["pp1", "pp2", "moi", "ssp", "nazaha", "deputy", "chair"];
  var MAJORITY = 4; // أغلبية حاسمة من 7

  var PREPARERS = { prep1: { name: "معدّ قرار المركز", t: "مستشار قانوني — معدّ القرار", org: "إدارة البرنامج — النيابة العامة" } };
  var PROTECTION_TYPES = ["الحماية الأمنية والمرافقة", "إخفاء البيانات", "تغيير مكان الإقامة", "الحماية الإجرائية في الجلسات", "وسائل اتصال آمنة", "الدعم المالي المؤقّت"];

  // قوالب المرفقات الافتراضية (من طلب الحماية حتى قرار المركز — كلّها مرفقات)
  var DOC_SLOTS_DEFAULT = [
    { id: "req",      group: "request",    label: "طلب الحماية",                required: true },
    { id: "erec",     group: "entityRec",  label: "توصية الجهة المختصة",        required: true },
    { id: "study",    group: "study",      label: "جميع الدراسات الخاصة بالطلب",  required: true },
    { id: "psych",    group: "assessment", label: "جميع التقييمات الخاصة بالطلب", required: true },
    { id: "decision", group: "decision",   label: "قرار المركز المُعَدّ",         required: true },
  ];
  function slotIcon(s) { return s.group === "request" ? "assignment_ind" : s.group === "entityRec" ? "recommend" : s.group === "study" ? "balance" : s.group === "decision" ? "gavel" : s.group === "assessment" ? "psychology" : "attach_file"; }

  // الحالة في الذاكرة — تُغذَّى من الخادم (hydrate) ثم تُحدَّث تفاؤليّاً
  var store = { requests: [], decisions: {}, votes: {}, seatUsers: {}, me: null };
  var listeners = [];
  var actions = null; // تُحقَن من البوابة (أفعال الخادم)

  function emit() { for (var i = 0; i < listeners.length; i++) { try { listeners[i](); } catch (e) {} } }
  function nowLabel() { return "الآن"; }
  function logErr(tag) { return function (r) { if (r && r.ok === false) console.error("[decision:" + tag + "]", r.error); return r; }; }

  function setActions(a) { actions = a; }
  function hydrate(data) {
    if (!data) return;
    store.requests  = data.requests  || [];
    store.decisions = data.decisions || {};
    store.votes     = data.votes     || {};
    store.seatUsers = data.seatUsers || {};
    store.me        = data.me        || null;
    emit();
  }

  function reqBySecret(s) { for (var i = 0; i < store.requests.length; i++) if (store.requests[i].secret === s) return store.requests[i]; return null; }
  function allCases() { return store.requests.slice(); }
  function ensureDecision(secret) {
    if (!store.decisions[secret]) store.decisions[secret] = { status: "preparing", preparer: "prep1", files: {}, paths: {}, docs: DOC_SLOTS_DEFAULT.slice().map(function (s) { return { id: s.id, group: s.group, label: s.label, required: true, icon: slotIcon(s), fileName: null, storagePath: null }; }), attachedDocs: [], packageConfirmed: false, rejections: [], votingStartedAt: null, deadlineClosed: false, issued: null };
    return store.decisions[secret];
  }

  // بيان مرفقات القضية (القوالب الافتراضية مدموجة مع المُخزَّن)
  function caseDocuments(secret) {
    var d = store.decisions[secret];
    if (d && d.docs && d.docs.length) return d.docs.map(function (x) { return { id: x.id, group: x.group, label: x.label, required: x.required !== false, icon: slotIcon(x), fileName: x.fileName || null, storagePath: x.storagePath || null }; });
    return DOC_SLOTS_DEFAULT.map(function (s) { return { id: s.id, group: s.group, label: s.label, required: true, icon: slotIcon(s), fileName: null, storagePath: null }; });
  }
  function requiredDocIds(secret) { return caseDocuments(secret).filter(function (d) { return d.required; }).map(function (d) { return d.id; }); }

  // حصيلة التصويت (إغلاق 4/7؛ العدد فردي فلا تعادل عند اكتمال النصاب)
  function tally(votesFor) {
    var accept = 0, reject = 0, cast = 0;
    var keys = votesFor ? Object.keys(votesFor) : [];
    for (var i = 0; i < keys.length; i++) { var v = votesFor[keys[i]]; if (v && v.choice) { cast++; if (v.choice === "قبول") accept++; else if (v.choice === "رفض") reject++; } }
    var pending = VOTING_SEATS.length - cast, closed = false, outcome = null;
    if (accept >= MAJORITY) { closed = true; outcome = "مقبول"; }
    else if (reject >= MAJORITY) { closed = true; outcome = "مرفوض"; }
    else if (cast >= VOTING_SEATS.length) { closed = true; outcome = accept >= reject ? "مقبول" : "مرفوض"; }
    return { accept: accept, reject: reject, cast: cast, pending: pending, closed: closed, outcome: outcome };
  }
  function resultFor(secret) {
    var votesFor = store.votes[secret];
    var t = tally(votesFor);
    var deadlineClosed = !!(store.decisions[secret] && store.decisions[secret].deadlineClosed);
    if (t.closed) { t.deadlineClosed = false; return t; }
    if (deadlineClosed && t.cast > 0) { t.closed = true; t.outcome = t.accept >= t.reject ? "مقبول" : "مرفوض"; t.deadlineClosed = true; return t; }
    t.deadlineClosed = false; return t;
  }

  var API = {
    SEATS: SEATS, MEMBER_SEATS: MEMBER_SEATS, VOTING_SEATS: VOTING_SEATS, MAJORITY: MAJORITY,
    PREPARERS: PREPARERS, PROTECTION_TYPES: PROTECTION_TYPES,
    DOC_SLOTS_DEFAULT: DOC_SLOTS_DEFAULT,
    setActions: setActions, hydrate: hydrate,
    getMe: function () { return store.me; },
    allCases: allCases, queueBySecret: reqBySecret,
    caseDocuments: caseDocuments, requiredDocIds: requiredDocIds,
    subscribe: function (fn) { listeners.push(fn); return function () { var i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; },
    getDecision: function (secret) { return store.decisions[secret] || null; },
    getVotes: function (secret) { return store.votes[secret] || {}; },
    tally: tally, resultFor: resultFor,

    // المعدّ يُنشئ طلباً جديداً (المنطلق) — يعيد الرمز السري (وعدٌ)
    createRequest: function (data) {
      if (!actions || !actions.createRequest) return Promise.resolve(null);
      return actions.createRequest(data.name, data.nid).then(function (r) {
        logErr("create")(r);
        if (r && r.ok && r.row) {
          var secret = r.row.secret_code;
          store.requests.unshift({ secret: secret, id: r.row.id, cat: "—", risk: "—", preparer: "prep1", createdByPreparer: true, applicant: { name: data.name, nid: data.nid } });
          ensureDecision(secret);
          emit();
          return secret;
        }
        return null;
      });
    },
    // رفع/إزالة ملف مرفق (تحديث تفاؤليّ + فعل الخادم؛ الرفع للتخزين يتمّ في المكوّن)
    setFile: function (secret, docId, fileName, storagePath, meta) {
      var d = ensureDecision(secret);
      var doc = d.docs.find(function (x) { return x.id === docId; });
      if (fileName) {
        if (!doc) { doc = { id: docId, group: (meta && meta.group) || "other", label: (meta && meta.label) || "مستند إضافي", required: !!(meta && meta.required), icon: slotIcon({ group: (meta && meta.group) || "other", label: (meta && meta.label) || "" }), fileName: null, storagePath: null }; d.docs.push(doc); }
        doc.fileName = fileName; doc.storagePath = storagePath || null;
      } else if (doc) { doc.fileName = null; doc.storagePath = null; }
      d.attachedDocs = d.docs.filter(function (x) { return x.fileName; }).map(function (x) { return x.id; });
      emit();
      var rid = reqBySecret(secret) && reqBySecret(secret).id;
      if (rid && actions) {
        if (fileName && actions.setAttachment) actions.setAttachment(rid, docId, (doc && doc.group) || (meta && meta.group) || "other", (doc && doc.label) || (meta && meta.label) || docId, (doc && doc.required) || false, fileName, storagePath || null).then(logErr("setFile"));
        else if (!fileName && actions.removeAttachment) actions.removeAttachment(rid, docId).then(logErr("removeFile"));
      }
    },
    addDocSlot: function (secret, slot) {
      var d = ensureDecision(secret);
      var id = "x" + (typeof Date !== "undefined" ? Date.now() : Math.floor(Math.random() * 1e9));
      d.docs.push({ id: id, group: slot.group || "other", label: slot.label || "مستند إضافي", required: !!slot.required, icon: slotIcon(slot), fileName: null, storagePath: null });
      emit();
      return id;
    },
    // المعدّ يطرح الحزمة للتصويت مباشرةً
    submitForVoting: function (secret) {
      var d = ensureDecision(secret);
      d.attachedDocs = d.docs.filter(function (x) { return x.fileName; }).map(function (x) { return x.id; });
      d.packageConfirmed = true; d.packageConfirmedAt = nowLabel();
      d.status = "voting"; d.votingStartedAt = nowLabel();
      emit();
      var rid = reqBySecret(secret) && reqBySecret(secret).id;
      if (rid && actions && actions.submitVoting) actions.submitVoting(rid).then(logErr("submit"));
    },
    // تصويت العضو/القيادة (قبول/رفض) — عزلٌ صفّيّ بالخادم
    castVote: function (secret, seat, choice, note) {
      if (!store.votes[secret]) store.votes[secret] = {};
      store.votes[secret][seat] = { choice: choice, note: note || "", when: nowLabel() };
      emit();
      var rid = reqBySecret(secret) && reqBySecret(secret).id;
      if (rid && actions && actions.castVote) actions.castVote(rid, choice === "قبول" ? "accept" : "reject", note || "").then(logErr("vote"));
    },
    closeByDeadline: function (secret) {
      var d = ensureDecision(secret); d.deadlineClosed = true; emit();
      var rid = reqBySecret(secret) && reqBySecret(secret).id;
      if (rid && actions && actions.closeDeadline) actions.closeDeadline(rid).then(logErr("close"));
    },
    issue: function (secret, payload) {
      var d = ensureDecision(secret);
      d.issued = { type: payload.type, reason: payload.reason || "", when: nowLabel() };
      d.status = "issued"; emit();
      var rid = reqBySecret(secret) && reqBySecret(secret).id;
      if (rid && actions && actions.issue) actions.issue(rid, payload.type === "قبول" ? "accept" : "reject", payload.reason || "").then(logErr("issue"));
    },
  };

  return API;
})();
