/* ============================================================
   مخزن «التحديات والحلول» — منقول من lib/challenges-store.js (IIFE→وحدة ES).
   يكتبه رئيس المركز (مُحرّر التحديات) ويقرؤه تقرير النائب العام. localStorage محروسٌ للـSSR.
   ============================================================ */
export const HemayaChallenges = (function () {
  var KEY = 'hemayaChallenges-v1';
  var PERIOD = 'الربع الثاني — 1447هـ';
  var hasWin = function () { return typeof window !== 'undefined'; };

  var SEED = []; // لا تحدّيات مُلفّقة
  var SUGGESTIONS = []; // لا مقترحات مُلفّقة

  function load() {
    try { var r = localStorage.getItem(KEY); if (r) { var p = JSON.parse(r); if (p && p.items) return p; } } catch (e) {}
    return { period: PERIOD, items: SEED.map(function (x) { return Object.assign({}, x); }) };
  }
  function save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    try { if (hasWin()) window.dispatchEvent(new Event('hemaya-challenges')); } catch (e) {}
    return state.items;
  }
  var _n = 0;
  var uid = function () { return 'ch-' + (_n++) + '-' + Math.floor((typeof performance !== 'undefined' ? performance.now() : _n) * 1000 % 100000); };

  return {
    period: PERIOD,
    get: function () { return load(); },
    list: function () { return load().items; },
    suggestions: function () { return SUGGESTIONS.map(function (x) { return Object.assign({}, x); }); },
    add: function (item) {
      var s = load();
      s.items.push(Object.assign({ id: uid(), c: '', s: '', evidence: '', by: 'رئيس المركز', at: 'الآن' }, item));
      return save(s);
    },
    update: function (id, patch) {
      var s = load();
      s.items = s.items.map(function (i) { return i.id === id ? Object.assign({}, i, patch) : i; });
      return save(s);
    },
    remove: function (id) {
      var s = load();
      s.items = s.items.filter(function (i) { return i.id !== id; });
      return save(s);
    },
    move: function (id, dir) {
      var s = load(), a = s.items, idx = a.findIndex(function (i) { return i.id === id; });
      if (idx < 0) return a; var j = idx + dir; if (j < 0 || j >= a.length) return a;
      var t = a[idx]; a[idx] = a[j]; a[j] = t; return save(s);
    },
    reset: function () { try { localStorage.removeItem(KEY); } catch (e) {} try { if (hasWin()) window.dispatchEvent(new Event('hemaya-challenges')); } catch (e) {} }
  };
})();
