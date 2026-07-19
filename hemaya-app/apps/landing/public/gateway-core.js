/* ============================================================
   منصّة «حماية» — الشاشة الموحّدة (Gateway) · المنطق التفاعلي
   نفاذ مبنيٌّ على الهوية → توجيهٌ إلى بوّابة المستخدم حسب الصلاحيات (لا اختيار).
   منقول من design/الواجهة الرئيسية/gateway-core.js — روابط البوّابات مسارات
   موحّدة خلف منفذ الشاشة الموحّدة (Multi-Zones؛ في الإنتاج: RBAC من قاعدة البيانات).
   بلا أطر — JS عاديّ. الحالة في localStorage.
   ============================================================ */
(function () {
  'use strict';

  var STORE = 'hemayaGatewaySession';
  var HEADER_OFFSET = 84;

  /* ---- مسارات البوّابات — موحّدة خلف منفذ الشاشة الموحّدة (Multi-Zones) ---- */
  var APP = {
    seeker:    '/seeker',
    center:    '/center',      // بوّابة موظف المركز — تعرض البوّابة الفرعية حسب دور المستخدم
    triage:    '/triage',      // الفرز المبدئي — بوّابة مستقلّة
    studier:   '/studier',     // الدراسة — بوّابة مستقلّة
    evaluator: '/evaluator',   // التقييم — بوّابة مستقلّة
    entities:  '/entities',
    health:    '/health',
    hr:        '/hr',
    interior:  '/interior',
    security:  '/security',
    ag:        '/ag',
    technical: '/technical'    // المكتب الفني — المستشارون/المدير حسب الدور
  };

  /* ---- المجموعات (الفاعل الأعلى) ---- */
  var GROUPS = {
    seeker:    { label: 'طالب الحماية',  icon: 'shield_person',      prefix: 'ح', single: true  },
    center:    { label: 'المركز',         icon: 'badge',             prefix: 'م', single: false },
    entity:    { label: 'الجهات',         icon: 'apartment',         prefix: 'ج', single: false },
    ag:        { label: 'النائب العام',   icon: 'balance',           prefix: 'ن', single: true  },
    technical: { label: 'المكتب الفني',   icon: 'workspace_premium', prefix: 'ف', single: false }
  };
  var ROLE_ORDER = ['seeker', 'center', 'entity', 'ag', 'technical'];
  var GROUP_PRIMARY = { seeker: 'seeker-main', center: 'center-triage', entity: 'entity-competent', ag: 'ag-main', technical: 'tech-consultants' };

  /* ---- البوّابات الفرعية (كلٌّ بوّابة مستقلّة بصلاحيتها) ---- */
  var PORTALS = {
    'seeker-main':      { role: 'seeker',    label: 'بوّابة طالب الحماية',      href: APP.seeker },
    'seeker-apply':     { role: 'seeker',    label: 'تقديم طلب جديد',           href: APP.seeker },
    'center-intake':    { role: 'center',    label: 'الاستقبال الورقيّ',        href: APP.center },
    'center-triage':    { role: 'center',    label: 'الفرز المبدئي',            href: APP.triage },
    'center-studier':   { role: 'center',    label: 'الدراسة — الدارس',         href: APP.studier },
    'center-evaluator': { role: 'center',    label: 'التقييم — المقيّم',        href: APP.evaluator },
    'center-preparer':  { role: 'center',    label: 'إعداد القرار',             href: APP.center },
    'center-council':   { role: 'center',    label: 'أعضاء المجلس',             href: APP.center },
    'center-exec':      { role: 'center',    label: 'التنفيذ والتجديد',         href: APP.center },
    'center-chief':     { role: 'center',    label: 'قيادة المركز — الرئيس',    href: APP.center },
    'center-deputy':    { role: 'center',    label: 'قيادة المركز — النائب',    href: APP.center },
    'entity-competent': { role: 'entity',    label: 'الجهات المختصة',           href: APP.entities },
    'entity-health':    { role: 'entity',    label: 'وزارة الصحة',              href: APP.health },
    'entity-hr':        { role: 'entity',    label: 'الموارد البشرية',          href: APP.hr },
    'entity-security':  { role: 'entity',    label: 'الإدارة الأمنية',          href: APP.security },
    'entity-interior':  { role: 'entity',    label: 'وزارة الداخلية',           href: APP.interior },
    'ag-main':          { role: 'ag',        label: 'بوّابة النائب العام',      href: APP.ag },
    'tech-consultants': { role: 'technical', label: 'المستشارون',              href: APP.technical },
    'tech-manager':     { role: 'technical', label: 'مدير المكتب الفني',        href: APP.technical }
  };

  /* ---- الهوية → البوّابة الفرعية (تُحاكي ربط نفاذ بالصلاحيات) ---- */
  var IDENTITY = {
    '1000000001': 'seeker-main',
    '2000000001': 'center-intake',
    '2000000002': 'center-triage',
    '2000000003': 'center-studier',
    '2000000004': 'center-evaluator',
    '2000000005': 'center-preparer',
    '2000000006': 'center-council',
    '2000000007': 'center-exec',
    '2000000008': 'center-chief',
    '2000000009': 'center-deputy',
    '3000000001': 'entity-competent',
    '3000000002': 'entity-health',
    '3000000003': 'entity-hr',
    '3000000004': 'entity-security',
    '3000000005': 'entity-interior',
    '4000000001': 'ag-main',
    '5000000001': 'tech-consultants',
    '5000000002': 'tech-manager'
  };
  var PORTAL_DEMO = {};
  Object.keys(IDENTITY).forEach(function (did) { PORTAL_DEMO[IDENTITY[did]] = did; });

  function portalForId(id) { return IDENTITY[id] || 'seeker-main'; }
  function secretForId(id) {
    var pid = portalForId(id);
    var role = PORTALS[pid].role;
    var last4 = (id && /^\d{10}$/.test(id)) ? id.slice(-4) : '0000';
    return GROUPS[role].prefix + '-' + last4;
  }
  function resolvePrefill(pre) {
    if (!pre) return '';
    if (PORTALS[pre]) return PORTAL_DEMO[pre] || '';
    var primary = GROUP_PRIMARY[pre];
    return primary ? (PORTAL_DEMO[primary] || '') : '';
  }

  /* ---------- جلسة ---------- */
  function getSession() {
    try { return JSON.parse(localStorage.getItem(STORE) || 'null'); }
    catch (e) { return null; }
  }
  function setSession(s) {
    try { s ? localStorage.setItem(STORE, JSON.stringify(s)) : localStorage.removeItem(STORE); }
    catch (e) {}
  }

  /* ---------- أدوات ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ============================================================
     حالة الرأس + البوّابات
     ============================================================ */
  function hasSupabaseSession() {
    return /sb-[^=;]*-auth-token/.test(document.cookie);
  }

  function applyState() {
    var s = getSession();
    // مصالحة: كوكي Supabase هي مصدر الحقيقة؛ إن غابت (كأن خرج من بوّابةٍ فرعيّة) فالحالة المحليّة لاغية
    if (s && !hasSupabaseSession()) { setSession(null); s = null; }
    renderAuth(s);
    renderStatus(s);
    renderGroups(s);
    renderHeroLogin(s);
  }

  function renderAuth(s) {
    var slot = $('#gwAuth');
    if (!slot) return;
    if (!s) {
      slot.innerHTML =
        '<a class="nafath solid" href="#" data-nafath><span class="nf-badge"><span class="ms">fingerprint</span></span> الدخول عبر نفاذ</a>';
      return;
    }
    var g = GROUPS[s.role];
    var p = PORTALS[s.portal];
    slot.innerHTML =
      '<div class="gw-user" id="gwUser">' +
        '<button class="gw-user-btn" data-user-toggle aria-haspopup="true">' +
          '<span class="gw-avatar"><span class="ms">' + g.icon + '</span></span>' +
          '<span class="gw-user-meta"><b>' + p.label + '</b><span>نفاذ · ' + s.secret + '</span></span>' +
          '<span class="ms caret">expand_more</span>' +
        '</button>' +
        '<div class="gw-menu">' +
          '<div class="gm-id"><span class="ms">verified_user</span><div><b>حسابٌ مُوثّق عبر نفاذ</b><span>' + p.label + ' · ' + s.secret + '</span></div></div>' +
          '<a href="' + p.href + '"><span class="ms">login</span> الدخول إلى بوّابتي</a>' +
          '<button data-switch><span class="ms">swap_horiz</span> تبديل الهوية</button>' +
          '<button class="danger" data-logout><span class="ms">logout</span> تسجيل الخروج</button>' +
        '</div>' +
      '</div>' +
      '<button class="gw-logout" data-logout aria-label="تسجيل الخروج"><span class="ms">logout</span> خروج</button>';
  }

  function renderStatus(s) {
    var box = $('#gwStatus');
    if (!box) return;
    if (!s) {
      box.className = 'gw-status';
      box.innerHTML =
        '<span class="st-ico"><span class="ms">fingerprint</span></span>' +
        '<div class="st-txt"><b>الدخول إلى بوّابتك</b>' +
          '<span>سجّل الدخول عبر النفاذ الوطني الموحّد، فيوجّهك النظام مباشرةً إلى بوّابتك حسب صلاحياتك.</span></div>' +
        '<div class="st-act"><a class="nafath solid" href="#" data-nafath><span class="nf-badge"><span class="ms">fingerprint</span></span> الدخول عبر نفاذ</a></div>';
    } else {
      var g = GROUPS[s.role];
      var p = PORTALS[s.portal];
      box.className = 'gw-status in';
      box.innerHTML =
        '<span class="st-ico"><span class="ms">verified_user</span></span>' +
        '<div class="st-txt"><b>بوّابتك: ' + p.label + '</b>' +
          '<span>ضمن «' + g.label + '» · رمزك السرّي <code>' + s.secret + '</code> — وُجّهت آلياً حسب صلاحياتك؛ بقية البوّابات مُقفلة.</span></div>' +
        '<div class="st-act">' +
          '<a class="btn primary" href="' + p.href + '"><span class="ms">login</span> الدخول إلى بوّابتي</a>' +
          '<button class="btn ghost" data-switch><span class="ms">swap_horiz</span> تبديل الهوية</button>' +
          '<button class="btn danger-ghost" data-logout><span class="ms">logout</span> خروج</button>' +
        '</div>';
    }
  }

  function renderGroups(s) {
    $all('.portal-group').forEach(function (grp) {
      var role = grp.getAttribute('data-role');
      var meta = GROUPS[role];
      var myGroup = !!(s && s.role === role);
      grp.classList.toggle('is-mine', myGroup);
      grp.setAttribute('data-locked', myGroup ? 'false' : 'true');

      var badge = $('.pg-badge', grp);
      if (badge) {
        if (myGroup) {
          badge.className = 'pg-badge mine';
          badge.innerHTML = '<span class="ms">check_circle</span> ' + (meta.single ? 'بوّابتك' : 'صلاحيتك هنا');
        } else {
          badge.className = 'pg-badge locked';
          badge.innerHTML = '<span class="ms">lock</span> مُقفلة';
        }
      }

      $all('.plink', grp).forEach(function (l) {
        var pid = l.getAttribute('data-portal');
        var mine = !!(s && s.portal === pid);
        var accessible;
        if (!s || !myGroup) accessible = false;
        else if (meta.single) accessible = true;   // مجموعة بشخصٍ واحد: كل روابطها متاحة
        else accessible = mine;                     // مجموعة متعدّدة الأدوار: بوّابتك فقط
        l.classList.toggle('mine', mine && !meta.single);
        l.classList.toggle('locked', !accessible);
      });
    });
  }

  function renderHeroLogin(s) {
    var btn = $('#gwHeroLoginBtn');
    if (!btn) return;
    if (s) {
      btn.innerHTML = '<span class="nf-badge"><span class="ms">login</span></span> الذهاب إلى بوّابتي';
      btn.setAttribute('data-goto-hero', '');
      btn.removeAttribute('data-nafath');
    } else {
      btn.innerHTML = '<span class="nf-badge"><span class="ms">fingerprint</span></span> الدخول عبر نفاذ';
      btn.setAttribute('data-nafath', '');
      btn.removeAttribute('data-goto-hero');
    }
  }

  /* ---------- توجيه بالبوّابة ---------- */
  function routeTo(portal) {
    var l = $('.plink[data-portal="' + portal + '"]');
    var g = l ? l.closest('.portal-group') : (PORTALS[portal] ? $('.portal-group[data-role="' + PORTALS[portal].role + '"]') : null);
    var target = g || $('#enter');
    if (!target) return;
    var top = target.getBoundingClientRect().top + window.pageYOffset - HEADER_OFFSET;
    window.scrollTo({ top: top, behavior: 'smooth' });
    var pulse = l || g;
    if (pulse) {
      pulse.classList.remove('routed');
      void pulse.offsetWidth;
      pulse.classList.add('routed');
      setTimeout(function () { pulse.classList.remove('routed'); }, 2600);
    }
  }

  function logout() {
    setSession(null);
    applyState();
    // مسح جلسة Supabase الحقيقيّة (الكوكي المشتركة) لا مجرّد الحالة المحليّة
    fetch('/auth/signout', { method: 'POST' }).catch(function () {});
    var top = ($('#enter') || document.body).getBoundingClientRect().top + window.pageYOffset - HEADER_OFFSET;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }

  /* ============================================================
     نافذة نفاذ — الهوية ← المطابقة ← نجاح (لا اختيار بوّابة)
     ============================================================ */
  var mstate = { step: 'id', prefillId: '', enteredId: '', match: null, portal: null, timer: null };

  function openNafath(pre) {
    mstate.prefillId = resolvePrefill(pre);
    mstate.enteredId = mstate.prefillId;
    mstate.portal = null;
    mstate.match = null;
    mstate.submitting = false;
    mstate.step = 'id';
    var modal = $('#gwModal');
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    renderStep();
  }
  function closeNafath() {
    $('#gwModal').classList.remove('open');
    document.body.style.overflow = '';
    if (mstate.timer) { clearTimeout(mstate.timer); mstate.timer = null; }
  }

  function dots(active) {
    var idx = { id: 0, match: 1, success: 2 };
    var a = idx[active];
    var out = '';
    for (var i = 0; i < 3; i++) out += '<i class="' + (i <= a ? 'on' : '') + '"></i>';
    return '<div class="gw-steps-dots">' + out + '</div>';
  }

  function demoSelect() {
    var html = '<select class="gw-demo-select" id="gwDemoSelect"><option value="">— أو اختر هويّة تجريبية للاستعراض —</option>';
    ROLE_ORDER.forEach(function (role) {
      var opts = '';
      Object.keys(IDENTITY).forEach(function (did) {
        var pid = IDENTITY[did];
        if (PORTALS[pid].role === role) opts += '<option value="' + did + '">' + PORTALS[pid].label + ' · ' + did + '</option>';
      });
      if (opts) html += '<optgroup label="' + GROUPS[role].label + '">' + opts + '</optgroup>';
    });
    return html + '</select>';
  }

  function renderStep() {
    var body = $('#gwModalBody');
    var foot = $('#gwModalFoot');
    var step = mstate.step;

    if (step === 'id') {
      var pre = mstate.enteredId || mstate.prefillId || '';
      body.innerHTML =
        '<p class="gw-step-title">الدخول عبر نفاذ</p>' +
        '<p class="gw-step-sub">أدخل رقم هويتك الوطنية أو الإقامة. يتحقّق النفاذ الوطني من هويتك، ثمّ تُوجَّه آلياً إلى بوّابتك الفرعية التي تخوّلها صلاحياتك — دون اختيارٍ منك.</p>' +
        '<div class="gw-field"><label>رقم الهوية الوطنية / الإقامة</label>' +
          '<input class="gw-input" id="gwId" inputmode="numeric" maxlength="10" placeholder="١٠ أرقام" autocomplete="off" value="' + pre + '">' +
          '<div class="gw-err" id="gwIdErr">يُرجى إدخال رقم هوية صحيح مكوّن من ١٠ أرقام.</div>' +
          '<div class="gw-hint"><span class="ms">shield</span> صلاحياتك وبياناتك تُجلب آلياً من مصادر الهوية الوطنية — لا اختيار للبوّابة، ولا كلمة مرور.</div></div>' +
        '<div class="gw-demo">' +
          '<p class="gd-lbl"><span class="ms">science</span> هويّات تجريبية للاستعراض — كلٌّ يمثّل شخصاً بصلاحية بوّابةٍ فرعية</p>' +
          demoSelect() +
        '</div>';
      foot.innerHTML =
        dots('id') +
        '<button class="btn primary" data-id-next>متابعة عبر نفاذ <span class="ms">arrow_back</span></button>';
      var input = $('#gwId', body);
      input.addEventListener('input', function () {
        input.value = input.value.replace(/[^\d٠-٩]/g, '').slice(0, 10);
        mstate.enteredId = input.value;
        input.classList.remove('err'); $('#gwIdErr').classList.remove('show');
      });
      var sel = $('#gwDemoSelect', body);
      sel.addEventListener('change', function () {
        if (!sel.value) return;
        input.value = sel.value;
        mstate.enteredId = sel.value;
        input.classList.remove('err'); $('#gwIdErr').classList.remove('show');
      });
      if (!pre) input.focus();
      $('[data-id-next]', foot).addEventListener('click', function () { submitId(input.value); });
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') submitId(input.value); });
      return;
    }

    if (step === 'match') {
      mstate.match = mstate.match || (10 + Math.floor(Math.random() * 89));
      body.innerHTML =
        '<p class="gw-step-title">طابِق الرقم في تطبيق نفاذ</p>' +
        '<p class="gw-step-sub">أرسلنا طلب تحقّقٍ إلى تطبيق نفاذ على جهازك. اختر الرقم المطابق:</p>' +
        '<div class="gw-match">' +
          '<div class="m-num">' + mstate.match + '</div>' +
          '<div class="m-wait"><span class="gw-spinner"></span> بانتظار تأكيدك في تطبيق نفاذ…</div>' +
          '<div class="m-app"><span class="ms">smartphone</span> افتح تطبيق نفاذ وحدّد الرقم أعلاه لإتمام الدخول</div>' +
        '</div>' +
        '<div class="gw-secure"><span class="ms">verified_user</span> لن يُطلب منك أبداً إدخال كلمة المرور أو رمز التحقّق خارج التطبيق</div>';
      foot.innerHTML =
        '<button class="gw-back" data-back><span class="ms">arrow_forward</span> رجوع</button>' +
        '<button class="btn primary" data-confirm>تأكيد المطابقة <span class="ms">check</span></button>';
      $('[data-back]', foot).addEventListener('click', function () {
        if (mstate.timer) { clearTimeout(mstate.timer); mstate.timer = null; }
        mstate.step = 'id'; renderStep();
      });
      $('[data-confirm]', foot).addEventListener('click', function () {
        if (mstate.timer) { clearTimeout(mstate.timer); mstate.timer = null; }
        mstate.step = 'success'; renderStep();
      });
      mstate.timer = setTimeout(function () { mstate.step = 'success'; renderStep(); }, 2600);
      return;
    }

    if (step === 'success') {
      var portal = portalForId(mstate.enteredId);
      mstate.portal = portal;
      var p = PORTALS[portal];
      var g = GROUPS[p.role];
      body.innerHTML =
        '<div class="gw-success">' +
          '<div class="s-check"><span class="ms">check_circle</span></div>' +
          '<h3>تمّ التحقّق من هويتك</h3>' +
          '<p>وفق الصلاحيات الممنوحة لك، وُجّهت إلى <b>«' + p.label + '»</b> ضمن ' + g.label + '. رمزك السرّي <code>' + secretForId(mstate.enteredId) + '</code> — تُعرَّف به داخل المنصّة بدل اسمك.</p>' +
          '<div class="gw-redirect"><span class="gw-spinner"></span> جارِ تحويلك إلى بوّابتك…</div>' +
        '</div>';
      foot.innerHTML =
        '<button class="btn primary" data-finish>الذهاب إلى بوّابتي <span class="ms">arrow_back</span></button>';
      $('[data-finish]', foot).addEventListener('click', finishLogin);
      mstate.timer = setTimeout(finishLogin, 2200);
      return;
    }
  }

  function submitId(val) {
    var digits = (val || '').replace(/٠/g,'0').replace(/١/g,'1').replace(/٢/g,'2').replace(/٣/g,'3')
      .replace(/٤/g,'4').replace(/٥/g,'5').replace(/٦/g,'6').replace(/٧/g,'7').replace(/٨/g,'8').replace(/٩/g,'9');
    if (!/^\d{10}$/.test(digits)) {
      var i = $('#gwId'); if (i) i.classList.add('err');
      var e = $('#gwIdErr'); if (e) e.classList.add('show');
      return;
    }
    mstate.enteredId = digits; mstate.step = 'match'; mstate.match = null; renderStep();
  }

  function showLoginError(msg) {
    var rd = $('#gwModalBody .gw-redirect');
    if (rd) rd.innerHTML = '<span class="ms" style="color:var(--error-50)">error</span> ' + msg;
    var foot = $('#gwModalFoot');
    if (foot) {
      foot.innerHTML =
        '<button class="gw-back" data-err-back><span class="ms">arrow_forward</span> رجوع</button>' +
        '<button class="btn primary" data-err-retry>إعادة المحاولة <span class="ms">refresh</span></button>';
      var rb = $('[data-err-retry]', foot); if (rb) rb.addEventListener('click', function () { mstate.step = 'success'; renderStep(); });
      var bk = $('[data-err-back]', foot); if (bk) bk.addEventListener('click', function () { mstate.step = 'id'; renderStep(); });
    }
  }

  function finishLogin() {
    if (mstate.timer) { clearTimeout(mstate.timer); mstate.timer = null; }
    if (mstate.submitting) return;
    mstate.submitting = true;
    var nid = mstate.enteredId;
    var portal = portalForId(nid);
    var role = PORTALS[portal].role;
    // ننشئ جلسة Supabase حقيقيّة (كوكي مشتركة على localhost) كي لا تطلب البوّابةُ الوجهة نفاذاً مرّةً أخرى
    fetch('/api/nafath', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nationalId: nid })
    })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'استجابةٌ غير صالحة من خدمة الدخول.' }; }); })
      .then(function (data) {
        if (!data || !data.ok) { mstate.submitting = false; showLoginError((data && data.error) || 'تعذّر إتمام الدخول عبر نفاذ.'); return; }
        setSession({ role: role, portal: portal, secret: secretForId(nid), at: Date.now() });
        window.location.href = data.portal || PORTALS[portal].href;
      })
      .catch(function () { mstate.submitting = false; showLoginError('تعذّر الاتصال بخدمة الدخول.'); });
  }

  /* ============================================================
     ربط عام (تفويض)
     ============================================================ */
  function wireGlobal() {
    document.addEventListener('click', function (e) {
      var nf = e.target.closest('[data-nafath]');
      if (nf) { e.preventDefault(); openNafath(nf.getAttribute('data-role') || null); return; }
      var gh = e.target.closest('[data-goto-hero]');
      if (gh) { e.preventDefault(); var sh = getSession(); if (sh && PORTALS[sh.portal]) window.location.href = PORTALS[sh.portal].href; return; }
      var tog = e.target.closest('[data-user-toggle]');
      if (tog) { e.preventDefault(); e.stopPropagation(); var u1 = $('#gwUser'); if (u1) u1.classList.toggle('open'); return; }
      var lo = e.target.closest('[data-logout]');
      if (lo) { e.preventDefault(); var u2 = $('#gwUser'); if (u2) u2.classList.remove('open'); logout(); return; }
      var sw = e.target.closest('[data-switch]');
      if (sw) { e.preventDefault(); var u3 = $('#gwUser'); if (u3) u3.classList.remove('open'); openNafath(); return; }
      var gt = e.target.closest('[data-goto]');
      if (gt) { e.preventDefault(); var u4 = $('#gwUser'); if (u4) u4.classList.remove('open'); var sg = getSession(); if (sg) routeTo(sg.portal); return; }
      // رابط بوّابة مُقفلة → افتح نفاذ بهويّة صاحب صلاحيتها
      var plink = e.target.closest('.plink');
      if (plink) {
        if (plink.classList.contains('locked')) {
          e.preventDefault();
          openNafath(plink.getAttribute('data-portal'));
        }
        return;
      }
      var openUser = $('#gwUser.open');
      if (openUser && !e.target.closest('#gwUser')) openUser.classList.remove('open');
    });

    var modal = $('#gwModal');
    if (modal) {
      $('#gwModalClose').addEventListener('click', closeNafath);
      $('.gw-scrim', modal).addEventListener('click', closeNafath);
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modal.classList.contains('open')) closeNafath();
      });
    }

    var header = $('#gwHeader');
    if (header) {
      var onScroll = function () { header.classList.toggle('scrolled', window.pageYOffset > 8); };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
  }

  function init() {
    applyState();
    wireGlobal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.HemayaGateway = { open: openNafath, logout: logout, route: routeTo, state: getSession };
})();
