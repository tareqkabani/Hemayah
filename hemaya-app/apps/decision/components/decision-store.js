/* ============================================================
   مخزن مرحلة القرار والإشعار (CO-3) — تحديث 15 يوليو 2026.
   آلة الحالة: preparing → pending_deputy → approved → voting → issued
   (المعدّ يُعِدّ من الدراسات والتقييمات ← اعتماد نائب الرئيس ← يعود
    للمعدّ فيطرحه للتصويت ← إصدار الرئيس وإشعار الطرفين م10).
   مصدر الحقيقة: Supabase (hydrate؛ الطفرات تُوجَّه لأفعال الخادم وتُحدَّث تفاؤليّاً).
   ============================================================ */
import { DECISION_STAGES, decisionStageOf, nextDecisionAction } from "@hemaya/domain";

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

  // أنواع تدابير الحماية (م14) — القرار يحمل أنواعه ومدّته وحيثياته
  var PROTECTION_TYPES = [
    "الحماية الشخصية والمرافقة",
    "تأمين المسكن ومقرّ العمل",
    "إخفاء الهوية وسريّتها",
    "تغيير مكان الإقامة أو العمل",
    "رقابة الاتصالات (بموافقة مكتوبة — م9/1)",
    "الهوية المؤقّتة (م9/3)",
  ];
  var REASON_SKELETON = "استناداً إلى الدراسات والتقييمات المُجمَّعة (عوامل المادة 9) وما اقتُرح من تدابير المادة 14، أُعِدّ هذا القرار لعرضه — إعدادٌ محايد بلا توصية بالقبول أو الرفض؛ والقرار خالصٌ للمجلس.";

  // الحالة في الذاكرة — تُغذَّى من الخادم (hydrate) ثم تُحدَّث تفاؤليّاً
  var store = { requests: [], decisions: {}, packages: {}, attachments: {}, votes: {}, messages: [], me: null };
  var listeners = [];
  var actions = null; // تُحقَن من البوابة (أفعال الخادم)

  function emit() { for (var i = 0; i < listeners.length; i++) { try { listeners[i](); } catch (e) {} } }
  function nowLabel() { return "الآن"; }
  function logErr(tag) { return function (r) { if (r && r.ok === false) console.error("[decision:" + tag + "]", r.error); return r; }; }

  function setActions(a) { actions = a; }
  function hydrate(data, opts) {
    if (!data) return;
    store.requests    = data.requests    || [];
    store.decisions   = data.decisions   || {};
    store.packages    = data.packages    || {};
    store.attachments = data.attachments || {};
    store.votes       = data.votes       || {};
    store.messages    = data.messages    || [];
    store.me          = data.me          || null;
    // silent: للترطيب الأول داخل الرسم — البثّ أثناء render يحذّر React
    if (!(opts && opts.silent)) emit();
  }

  function reqBySecret(s) { for (var i = 0; i < store.requests.length; i++) if (store.requests[i].secret === s) return store.requests[i]; return null; }
  function caseIdOf(secret) { var q = reqBySecret(secret); return q ? q.id : null; }
  function allCases() { return store.requests.slice(); }
  function getDecision(secret) { return store.decisions[secret] || null; }
  function dOf(secret) {
    return store.decisions[secret] || { status: "preparing", mine: false, unclaimed: true, types: [], duration: "", reasoning: "", approvals: { deputy: null, chair: null }, rejections: [], votingStartedAt: null, deadlineClosed: false, voteOpen: false, issued: null };
  }

  // حصيلة التصويت (للقيادة — العضو لا يرى أصوات غيره فتُحسب له من voteOpen فقط)
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
  // النتيجة الفعلية للطلب: تجمع الأغلبية + إغلاق المهلة + باب التصويت من الخادم
  function resultFor(secret) {
    var d = dOf(secret);
    var t = tally(store.votes[secret]);
    if (t.closed) { t.deadlineClosed = false; return t; }
    if (d.deadlineClosed && t.cast > 0) { t.closed = true; t.outcome = t.accept >= t.reject ? "مقبول" : "مرفوض"; t.deadlineClosed = true; return t; }
    // للعضو: لا حصيلة لديه — voteOpen من الخادم هو الفيصل
    if (d.status === "voting" && !d.voteOpen) { t.closed = true; }
    t.deadlineClosed = !!d.deadlineClosed;
    return t;
  }

  // الإجراء المطلوب — دالة موحّدة (مصدرها @hemaya/domain)
  function nextActionOf(scope, seat, q) {
    var d = dOf(q.secret);
    var my = (store.votes[q.secret] || {})[seat];
    var res = resultFor(q.secret);
    return nextDecisionAction(scope, {
      status: d.status,
      mine: !!(d.mine || (scope === "preparer" && d.unclaimed)),
      returned: (d.rejections || []).length > 0,
      voted: !!my,
      closed: !!res.closed,
      leadSeat: seat === "deputy" || seat === "chair" ? seat : undefined,
    });
  }
  function stageOf(status) { return decisionStageOf(status); }

  // ——— المراسلات: خيوط من رسائل القاعدة (معزولة بالمقعد؛ القيادة تطّلع على الجميع) ———
  function threadKey(m) { return m.secret + "/" + m.party + "/" + m.partyUid + "/" + m.withSeat; }
  function getThreads(scope) {
    var byKey = {};
    for (var i = 0; i < store.messages.length; i++) {
      var m = store.messages[i];
      var k = threadKey(m);
      if (!byKey[k]) byKey[k] = { id: k, secret: m.secret, caseId: m.caseId, party: m.party, partyUid: m.partyUid, with: m.withSeat, msgs: [] };
      byKey[k].msgs.push({ id: m.id, from: m.fromSeat, fromMe: m.fromMe, t: m.body, when: m.when, whenTs: m.whenTs || null });
    }
    var out = []; for (var k2 in byKey) out.push(byKey[k2]);
    out.sort(function (a, b) { return a.msgs.length && b.msgs.length ? (a.msgs[a.msgs.length - 1].id < b.msgs[b.msgs.length - 1].id ? 1 : -1) : 0; });
    return out; // RLS في القاعدة تكفّلت بالعزل: غير القيادة لا يصله إلا خيوطه
  }
  function findThread(id) { var ts = getThreads("any"); for (var i = 0; i < ts.length; i++) if (ts[i].id === id) return ts[i]; return null; }
  function startThread(party, secret, withWho) {
    var me = store.me || {}; var uid = me.uid;
    var k = secret + "/" + party + "/" + uid + "/" + withWho;
    return k; // الخيط يتجسّد فعلياً عند أول رسالة (council_send_message)
  }
  function sendMessage(threadId, text) {
    var parts = threadId.split("/");
    var secret = parts[0], party = parts[1], partyUid = parts[2], withSeat = parts[3];
    var cid = caseIdOf(secret); if (!cid) return Promise.resolve(null);
    var me = store.me || {};
    store.messages.push({ id: "tmp" + Date.now(), secret: secret, caseId: cid, party: party, partyUid: partyUid, withSeat: withSeat, fromSeat: me.seat || party, fromMe: true, body: text, when: nowLabel(), whenTs: new Date().toISOString() });
    emit();
    if (actions && actions.sendMessage) return actions.sendMessage(cid, party, partyUid, withSeat, text).then(logErr("message"));
    return Promise.resolve(null);
  }

  var API = {
    SEATS: SEATS, MEMBER_SEATS: MEMBER_SEATS, VOTING_SEATS: VOTING_SEATS, MAJORITY: MAJORITY,
    PREPARERS: PREPARERS, PROTECTION_TYPES: PROTECTION_TYPES, REASON_SKELETON: REASON_SKELETON,
    DECISION_STAGES: DECISION_STAGES,
    setActions: setActions, hydrate: hydrate,
    getMe: function () { return store.me; },
    allCases: allCases, queueBySecret: reqBySecret, caseIdOf: caseIdOf,
    subscribe: function (fn) { listeners.push(fn); return function () { var i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; },
    getDecision: getDecision, dOf: dOf,
    getPackage: function (secret) { return store.packages[secret] || null; },
    getAttachments: function (secret) { return store.attachments[secret] || []; },
    getVotes: function (secret) { return store.votes[secret] || {}; },
    tally: tally, resultFor: resultFor,
    nextActionOf: nextActionOf, stageOf: stageOf,
    getThreads: getThreads, findThread: findThread, startThread: startThread, sendMessage: sendMessage,

    // المعدّ: حفظ مسوّدة القرار (أنواع م14 + مدة + حيثيات)
    saveDecision: function (secret, patch) {
      var d = dOf(secret); var cid = caseIdOf(secret);
      if (patch.types) d.types = patch.types;
      if (patch.duration !== undefined) d.duration = patch.duration;
      if (patch.reasoning !== undefined) d.reasoning = patch.reasoning;
      store.decisions[secret] = d; emit();
      if (cid && actions && actions.saveDecision) return actions.saveDecision(cid, d.types, d.duration, d.reasoning).then(logErr("save"));
      return Promise.resolve(null);
    },
    // المعدّ: رفع القرار لاعتماد نائب الرئيس
    submitForApproval: function (secret, patch) {
      var d = dOf(secret); var cid = caseIdOf(secret);
      d.types = patch.types; d.duration = patch.duration; d.reasoning = patch.reasoning;
      d.approvals = { deputy: null, chair: null }; d.status = "pending_deputy"; d.submittedAt = nowLabel();
      store.decisions[secret] = d; emit();
      if (cid && actions && actions.submitForApproval) return actions.submitForApproval(cid, d.types, d.duration, d.reasoning).then(logErr("submit"));
      return Promise.resolve(null);
    },
    // النائب: اعتماد — يمرّ لحلقة اعتماد الرئيس
    approve: function (secret) {
      var d = dOf(secret); var cid = caseIdOf(secret);
      if (d.status !== "pending_deputy") return Promise.resolve(null);
      d.approvals = { deputy: { when: nowLabel() }, chair: null }; d.status = "pending_chair"; emit();
      if (cid && actions && actions.approve) return actions.approve(cid).then(logErr("approve"));
      return Promise.resolve(null);
    },
    // الرئيس: الحلقة الثانية — بعدها يعود للمعدّ لطرحه
    approveChair: function (secret) {
      var d = dOf(secret); var cid = caseIdOf(secret);
      if (d.status !== "pending_chair") return Promise.resolve(null);
      d.approvals = { deputy: d.approvals && d.approvals.deputy, chair: { when: nowLabel() } }; d.status = "approved"; emit();
      if (cid && actions && actions.approveChair) return actions.approveChair(cid).then(logErr("approveChair"));
      return Promise.resolve(null);
    },
    // القيادة (كلٌّ من حلقته): إعادة بملاحظة إلزامية
    rejectApproval: function (secret, note) {
      var d = dOf(secret); var cid = caseIdOf(secret);
      d.rejections = (d.rejections || []).concat([{ note: note || "", when: nowLabel() }]);
      d.approvals = { deputy: null, chair: null }; d.status = "preparing"; d.submittedAt = null; emit();
      if (cid && actions && actions.rejectApproval) return actions.rejectApproval(cid, note || "").then(logErr("return"));
      return Promise.resolve(null);
    },
    // المعدّ بعد الاعتماد: الطرح على المجلس
    openVoting: function (secret) {
      var d = dOf(secret); var cid = caseIdOf(secret);
      if (d.status !== "approved") return Promise.resolve(null);
      d.status = "voting"; d.votingStartedAt = nowLabel(); d.voteOpen = true; emit();
      if (cid && actions && actions.openVoting) return actions.openVoting(cid).then(logErr("open"));
      return Promise.resolve(null);
    },
    // تصويت العضو/القيادة (قبول/رفض) — عزلٌ صفّيّ بالخادم
    castVote: function (secret, seat, choice, note) {
      var cid = caseIdOf(secret);
      if (!store.votes[secret]) store.votes[secret] = {};
      store.votes[secret][seat] = { choice: choice, note: note || "", when: nowLabel() };
      emit();
      if (cid && actions && actions.castVote) return actions.castVote(cid, choice === "قبول" ? "accept" : "reject", note || "").then(logErr("vote"));
      return Promise.resolve(null);
    },
    closeByDeadline: function (secret) {
      var d = dOf(secret); var cid = caseIdOf(secret);
      d.deadlineClosed = true; d.voteOpen = false; emit();
      if (cid && actions && actions.closeDeadline) return actions.closeDeadline(cid).then(logErr("close"));
      return Promise.resolve(null);
    },
    // الرئيس حصراً بعد الإغلاق — الحصيلة تُحسم في القاعدة، والإشعار فوريّ (م10)
    issue: function (secret, payload) {
      var d = dOf(secret); var cid = caseIdOf(secret);
      var res = resultFor(secret);
      d.issued = { type: res.outcome || (payload && payload.type) || "قبول", reason: (payload && payload.reason) || "", when: nowLabel() };
      d.status = "issued"; emit();
      if (cid && actions && actions.issue) return actions.issue(cid, (payload && payload.reason) || "").then(logErr("issue"));
      return Promise.resolve(null);
    },
    // مرفق داعم اختياري (أثناء الإعداد)
    setFile: function (secret, docId, group, label, fileName, storagePath) {
      var cid = caseIdOf(secret);
      var list = store.attachments[secret] || (store.attachments[secret] = []);
      var found = null; for (var i = 0; i < list.length; i++) if (list[i].id === docId) found = list[i];
      if (fileName) { if (!found) { found = { id: docId, group: group || "other", label: label || "مستند داعم" }; list.push(found); } found.fileName = fileName; found.storagePath = storagePath || null; }
      else if (found) { list.splice(list.indexOf(found), 1); }
      emit();
      if (!cid || !actions) return Promise.resolve(null);
      if (fileName && actions.setAttachment) return actions.setAttachment(cid, docId, group || "other", label || "مستند داعم", fileName, storagePath || null).then(logErr("setFile"));
      if (!fileName && actions.removeAttachment) return actions.removeAttachment(cid, docId).then(logErr("removeFile"));
      return Promise.resolve(null);
    },
  };

  return API;
})();
