/* ============================================================
   ناقل «التسليم للتنفيذ» — منقول من lib/execution-handoff.js (IIFE→وحدة ES).
   كل قبولٍ يُنشئ سجلّ «مشمول» يؤول إلى مرحلة التنفيذ والتجديد. localStorage محروسٌ للـSSR.
   ============================================================ */

export const HemayaHandoff = (function () {
  var KEY = 'hemayaHandoff-v1';
  var hasWin = function () { return typeof window !== 'undefined'; };
  var _hydrated = null; // بيانات القاعدة (المقبولون الفعليّون) — تتقدّم على SEED عند ضبطها

  // لا بيانات مُلفّقة: التسليمات الحقيقيّة فقط (من إجراءات القبول الفعليّة). فارغةٌ بصدقٍ حتى ترد.
  var SEED = [];
  var TRACKS = {
    council:   { label: 'قرار المجلس', article: 'م5', icon: 'gavel', tone: 'success' },
    urgent:    { label: 'عاجل', article: 'م8', icon: 'bolt', tone: 'error' },
    foreign:   { label: 'أجنبي', article: 'م6', icon: 'public', tone: 'bronze' },
    grievance: { label: 'تظلّم', article: 'م21', icon: 'gavel', tone: 'info' }
  };
  function load() {
    if (_hydrated) return _hydrated;
    try { var r = localStorage.getItem(KEY); if (r) { var p = JSON.parse(r); if (p && p.items) return p; } } catch (e) {}
    return { items: SEED.map(function (x) { return Object.assign({}, x); }) };
  }
  function save(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
    try { if (hasWin()) window.dispatchEvent(new Event('hemaya-handoff')); } catch (e) {}
    return s.items;
  }
  var uid = function () { return 'HX-' + Math.random().toString(36).slice(2, 9); };

  return {
    TRACKS: TRACKS,
    get: function () { return load(); },
    list: function () { return load().items; },
    byTrack: function (t) { return load().items.filter(function (i) { return i.track === t; }); },
    pending: function () { return load().items.filter(function (i) { return i.status === 'await-agreement'; }); },
    urgentBoard: function () { return load().items.filter(function (i) { return i.track === 'urgent' && i.boardReviewDue != null; }); },
    handoff: function (rec) { var s = load(); s.items.unshift(Object.assign({ id: uid(), status: 'await-agreement', decidedAt: 'الآن' }, rec)); return save(s); },
    update: function (id, patch) {
      var s = load();
      var target = s.items.filter(function (i) { return i.id === id; })[0];
      s.items = s.items.map(function (i) { return i.id === id ? Object.assign({}, i, patch) : i; });
      // توقيع الاتفاقية على سجلّ حقيقيّ → RPC المفروض (accepted→active).
      if (target && target.caseId && patch.status === 'active') {
      }
      if (_hydrated) { _hydrated = s; try { if (hasWin()) window.dispatchEvent(new Event('hemaya-handoff')); } catch (e) {} return s.items; }
      return save(s);
    },
    // تغذية من القاعدة: المقبولون الفعليّون يتصدّرون (dedupe بالرمز)، ثم SEED للعرض.
    hydrate: function (items) {
      var seen = {}; (items || []).forEach(function (x) { seen[x.secret] = 1; });
      var demo = SEED.filter(function (x) { return !seen[x.secret]; }).map(function (x) { return Object.assign({}, x); });
      _hydrated = { items: (items || []).concat(demo) };
      try { if (hasWin()) window.dispatchEvent(new Event('hemaya-handoff')); } catch (e) {}
      return _hydrated.items;
    },
    reset: function () { _hydrated = null; try { localStorage.removeItem(KEY); } catch (e) {} try { if (hasWin()) window.dispatchEvent(new Event('hemaya-handoff')); } catch (e) {} }
  };
})();
