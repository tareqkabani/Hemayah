// البوّابة الموحّدة (Gateway) — منقولة حرفيّاً من design/فهرس.html (المعتمدة في التسليم).
// نافذة نفاذ ثلاثية الخطوات → توجيهٌ مباشر لبوّابة المستخدم حسب صلاحياته (المنطق في /gateway-core.js).
// أُزيلت لوحة Tweaks (عرضٌ فقط) وسكربتات React CDN — يبقى الجسم الدلاليّ فقط.

const HTML = `
<header class="gw-header" id="gwHeader">
  <div class="wrap gw-header-in">
    <a class="gw-brand" href="#top" aria-label="منصّة حماية — النيابة العامة">
      <img src="/assets/logo-center.png" alt="مركز برنامج حماية المبلّغين والشهود والخبراء والضحايا — النيابة العامة">
    </a>
    <nav class="gw-nav" aria-label="روابط رئيسية">
      <a href="#about">عن المركز</a>
      <a href="#covered">من نحمي</a>
      <a href="#measures">تدابير الحماية</a>
      <a href="#enter">الدخول</a>
    </nav>
    <div class="gw-actions">
      <div id="gwAuth"></div>
    </div>
  </div>
</header>

<section class="gw-hero" id="top">
  <span class="tess-deco" aria-hidden="true"></span>
  <span class="bg-square" aria-hidden="true"></span>
  <div class="wrap">
    <div class="gw-hero-grid">
      <div>
        <span class="eyebrow">النيابة العامة · مركز برنامج الحماية</span>
        <h1>حمايةٌ موثوقةٌ لِمَن <span class="accent">قال الحقّ</span> وأعان العدالة</h1>
        <p class="lede">بوّابةٌ رقميةٌ موحّدةٌ وآمنة تقود كلَّ مستخدمٍ إلى ما يخصّه — طلبُ الحماية ومتابعتها من التقديم حتى القرار، بسرّيةٍ تامّة واستناداً إلى نظام حماية المبلّغين والشهود والخبراء والضحايا ولائحته التنفيذية.</p>
        <div class="cta-row">
          <a class="btn primary lg" href="#" data-nafath data-role="seeker"><span class="ms">shield_person</span> تقديم طلب حماية</a>
          <a class="btn ghost lg" href="#" data-nafath><span class="ms">login</span> الدخول عبر نفاذ</a>
        </div>
        <div class="note"><span class="ms">lock</span> هويتك محجوبةٌ خلف رمزٍ سرّي، وبياناتك سرّيةٌ لا يُفصح عنها إلا في الأحوال النظامية.</div>
      </div>

      <div class="gw-hero-lock" aria-hidden="true">
        <span class="tess"></span>
        <div class="lk">
          <img class="pp" src="/assets/logo-pp-gold.png" alt="النيابة العامة">
          <span class="sep"></span>
          <img class="ctr" src="/assets/logo-center-gold.png" alt="مركز برنامج الحماية">
        </div>
      </div>

      <div class="gw-hero-login">
        <div class="lg-badge"><span class="ms">fingerprint</span></div>
        <h3>الدخول عبر نفاذ</h3>
        <p>ادخل عبر النفاذ الوطني الموحّد للوصول إلى بوّابتك بأمان — للأفراد والموظفين والجهات على حدٍّ سواء.</p>
        <a class="nafath solid" href="#" id="gwHeroLoginBtn" data-nafath><span class="nf-badge"><span class="ms">fingerprint</span></span> الدخول عبر نفاذ</a>
        <div class="lg-alt"><span class="ms">verified_user</span> دخولٌ آمنٌ ومصادَقٌ وطنياً</div>
        <a class="lg-track" href="#enter"><span class="ms">help</span> كيف يعمل الدخول؟</a>
      </div>
    </div>
  </div>
</section>

<div class="system-band">
  <span class="ms">gavel</span> نظام حماية المبلّغين والشهود والخبراء والضحايا ولائحته التنفيذية
  <span class="en latin">· PROTECTION SYSTEM</span>
</div>

<section class="section tight" id="covered">
  <div class="wrap">
    <div class="center-head">
      <span class="eyebrow">وفق النظام</span>
      <h2>من هُم المشمولون بالحماية؟</h2>
      <p>أربع فئاتٍ يكفل لها النظام الحماية، ومن في حكمهم ممّن تربطهم بهم صلةٌ وثيقة.</p>
    </div>
    <div class="covered-grid">
      <div class="covered"><div class="cv-ico"><span class="ms">campaign</span></div><h3>المبلِّغ</h3><p>من يُدلي طواعيةً بمعلومةٍ أو إثباتٍ يبعث على الاعتقاد بارتكاب جريمةٍ مشمولة بالنظام، أو يكشف عن مرتكبيها.</p></div>
      <div class="covered"><div class="cv-ico"><span class="ms">visibility</span></div><h3>الشاهد</h3><p>من يُدلي بمعلومةٍ مؤثّرةٍ أدركها بحواسّه، أو وافق على الإدلاء بها لإثبات جريمةٍ من الجرائم المشمولة.</p></div>
      <div class="covered"><div class="cv-ico"><span class="ms">workspace_premium</span></div><h3>الخبير</h3><p>صاحب الدراية الفنية أو العلمية أو العملية، تستعين به جهة التحقيق أو المحكمة للكشف عن الجريمة أو أدلّتها.</p></div>
      <div class="covered"><div class="cv-ico"><span class="ms">healing</span></div><h3>الضحية</h3><p>من تعرّض للضرر بسبب ارتكاب جريمةٍ من الجرائم المشمولة بأحكام النظام.</p></div>
    </div>
  </div>
</section>

<section class="section" id="about">
  <div class="wrap">
    <div class="vA-trust">
      <div class="tess"></div>
      <div class="vA-trust-grid">
        <div>
          <span class="eyebrow light">الإطار النظامي</span>
          <h2>الحمايةُ <b>إجراءاتٌ وتدابيرُ وضماناتٌ</b> يوفّرها برنامجٌ خاصٌّ في النيابة العامة.</h2>
          <p style="margin:18px 0 0;font-size:15.5px;color:rgba(255,255,255,.82);line-height:1.75;max-width:52ch;">يُنشأ البرنامج وفق أحكام النظام، ولإدارته —بقرارٍ منها— صلاحيةُ قبول المبلّغين والشهود والخبراء والضحايا وتحديدُ نوع الحماية المقدَّم لهم ومدّته.</p>
        </div>
        <div class="vA-assur">
          <div class="a-item"><div class="a-ico"><span class="ms">lock</span></div><div><h4>خصوصيةٌ محفوظة</h4><p>بيانات المشمولين سرّية، ولا يجوز الإفصاح عنها إلا في الأحوال المبيّنة في النظام.</p></div></div>
          <div class="a-item"><div class="a-ico"><span class="ms">visibility_off</span></div><div><h4>لا كشفَ ولا إضرار</h4><p>يُحظر الكشف عمّا يُفضي إلى هوية المشمول أو مكانه أو أنواع الحماية وإجراءاتها.</p></div></div>
          <div class="a-item"><div class="a-ico"><span class="ms">health_and_safety</span></div><div><h4>وقايةٌ ورعاية</h4><p>إجراءاتٌ لوقاية المشمول وضمان صحّته وسلامته وتكيّفه الاجتماعي طوال مدّة الحماية.</p></div></div>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="section tight" id="measures" style="background:var(--pp-cream-2);">
  <div class="wrap">
    <div class="center-head">
      <span class="eyebrow">إجراءاتٌ آمنة يوفّرها البرنامج · المادة (14)</span>
      <h2>تدابيرُ الحماية</h2>
      <p>يقرّر المجلسُ التدابيرَ المناسبةَ لكلّ حالةٍ بحسب مستوى الخطر — ومن أبرزها:</p>
    </div>
    <div class="measures-grid">
      <div class="measure"><div class="mz-ico"><span class="ms">security</span></div><div><h4>الحماية الأمنية</h4><p>تأمينٌ شخصيٌّ للمشمول بحسب الحاجة.</p></div></div>
      <div class="measure"><div class="mz-ico"><span class="ms">home</span></div><div><h4>حماية المسكن</h4><p>تأمين مكان سكنه ومحيطه.</p></div></div>
      <div class="measure"><div class="mz-ico"><span class="ms">call</span></div><div><h4>تغيير أرقام الهواتف</h4><p>أرقامٌ جديدةٌ يصعب تتبّعها.</p></div></div>
      <div class="measure"><div class="mz-ico"><span class="ms">visibility_off</span></div><div><h4>إخفاء الهوية</h4><p>إخفاء بياناته وكلّ ما يدلّ عليه طوال فترة الحماية.</p></div></div>
      <div class="measure"><div class="mz-ico"><span class="ms">volunteer_activism</span></div><div><h4>الإرشاد القانوني والنفسي والاجتماعي</h4><p>دعمٌ متكاملٌ للمشمول.</p></div></div>
      <div class="measure"><div class="mz-ico"><span class="ms">work</span></div><div><h4>عملٌ بديل</h4><p>المساعدة في عملٍ بديلٍ إن اقتضى الأمر تركه لعمله.</p></div></div>
      <div class="measure"><div class="mz-ico"><span class="ms">sync_alt</span></div><div><h4>النقل من مكان العمل</h4><p>نقلٌ مؤقّتٌ أو دائمٌ بالتنسيق مع جهة عمله.</p></div></div>
      <div class="measure"><div class="mz-ico"><span class="ms">moving</span></div><div><h4>تغيير محلّ الإقامة</h4><p>نقلٌ لمنطقةٍ أو مدينةٍ أخرى مع توفير بدائل مناسبة.</p></div></div>
      <div class="measure"><div class="mz-ico"><span class="ms">local_police</span></div><div><h4>مرافقةٌ أمنية</h4><p>إجراءاتٌ كفيلةٌ بسلامة نقله وتنقّله.</p></div></div>
      <div class="measure"><div class="mz-ico"><span class="ms">sos</span></div><div><h4>وسائل الإبلاغ الفوري</h4><p>للتبليغ عن أيّ خطرٍ يهدّده أو يهدّد ذويه.</p></div></div>
      <div class="measure"><div class="mz-ico"><span class="ms">payments</span></div><div><h4>المساعدة المالية</h4><p>عند تعطُّل قدرته على الاكتساب بسبب شموله بالحماية.</p></div></div>
      <div class="measure"><div class="mz-ico"><span class="ms">videocam_off</span></div><div><h4>الإدلاء عن بُعد</h4><p>عبر الوسائط الإلكترونية مع تغيير الصوت وإخفاء الملامح.</p></div></div>
    </div>
    <div class="measures-note"><span class="ms">add_circle</span> وأيُّ أنواع حمايةٍ أخرى ترى إدارة البرنامج مناسبتها وفقاً لما تحدّده اللائحة التنفيذية.</div>
  </div>
</section>

<section class="section tight">
  <div class="wrap">
    <div class="center-head">
      <span class="eyebrow">كيف تعمل المنصّة</span>
      <h2>رحلة الطلب في خمس مراحل</h2>
      <p>مسارٌ رقميٌّ متكاملٌ من لحظة التقديم حتى تفعيل الحماية ومتابعتها.</p>
    </div>
    <div class="vA-steps">
      <div class="step"><span class="s-n latin">01</span><span class="ms">draft</span><h4>التقديم</h4><p>تقديم الطلب عبر نفاذ ببياناتٍ تُجلب آلياً.</p></div>
      <div class="step"><span class="s-n latin">02</span><span class="ms">fact_check</span><h4>الفرز المبدئي</h4><p>فحص الاختصاص ووجود قضيةٍ قائمة.</p></div>
      <div class="step"><span class="s-n latin">03</span><span class="ms">analytics</span><h4>الدراسة والتقييم</h4><p>دراسةٌ وتقييمٌ مستقلّان لعوامل الخطر.</p></div>
      <div class="step"><span class="s-n latin">04</span><span class="ms">how_to_vote</span><h4>قرار المجلس</h4><p>تصويتٌ يحدّد الشمول وأنواع الحماية.</p></div>
      <div class="step"><span class="s-n latin">05</span><span class="ms">verified_user</span><h4>التنفيذ والمتابعة</h4><p>تفعيل التدابير وتجديدها دورياً.</p></div>
    </div>
  </div>
</section>

<section class="gw-enter" id="enter">
  <div class="wrap">
    <div class="ge-band">
      <span class="tess" aria-hidden="true"></span>
      <div class="ge-inner">
        <span class="eyebrow light">مدخلٌ موحّد</span>
        <h2>بابٌ واحدٌ عبر نفاذ — يوجّهك النظام إلى بوّابتك</h2>
        <p>سجّل الدخول عبر النفاذ الوطني الموحّد من زرّ «الدخول عبر نفاذ» أعلى الصفحة، فيتعرّف النظام على صلاحياتك ويوجّهك مباشرةً إلى بوّابتك — للأفراد والموظفين والجهات على حدٍّ سواء، بعزلٍ تامٍّ وتسجيلٍ في سجلّ التدقيق. لا اختيارَ للبوّابة؛ صلاحيتك وحدها تحدّدها.</p>
        <div class="gw-status" id="gwStatus"></div>
        <div class="ge-actors">
          <span class="ge-actor"><span class="ms">shield_person</span> طالب الحماية</span>
          <span class="ge-actor"><span class="ms">badge</span> موظفو المركز</span>
          <span class="ge-actor"><span class="ms">apartment</span> الجهات والوزارات</span>
          <span class="ge-actor"><span class="ms">balance</span> النائب العام</span>
          <span class="ge-actor"><span class="ms">workspace_premium</span> المكتب الفني</span>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="section tight" style="background:var(--pp-cream-2);">
  <div class="wrap">
    <div class="center-head" style="margin-bottom:26px;">
      <span class="eyebrow">منظومةٌ متكاملة</span>
      <h2>شركاء المنظومة</h2>
      <p>يعمل المركز بالتنسيق مع الجهات المعنية لتوفير الحماية والرعاية للمشمولين.</p>
    </div>
    <div class="partner-logos">
      <div class="plogo"><img src="/assets/partner-3.png" alt="نزاهة — هيئة الرقابة ومكافحة الفساد" loading="lazy"><span class="plogo-name">نزاهة — الرقابة ومكافحة الفساد</span></div>
      <div class="plogo"><img src="/assets/partner-4.png" alt="رئاسة أمن الدولة" loading="lazy"><span class="plogo-name">رئاسة أمن الدولة</span></div>
      <div class="plogo"><img src="/assets/partner-6.png" alt="الموارد البشرية والتنمية الاجتماعية" loading="lazy"><span class="plogo-name">الموارد البشرية والتنمية الاجتماعية</span></div>
      <div class="plogo"><img src="/assets/partner-7.png" alt="وزارة العدل" loading="lazy"><span class="plogo-name">وزارة العدل</span></div>
      <div class="plogo"><img src="/assets/partner-8.png" alt="وزارة الداخلية" loading="lazy"><span class="plogo-name">وزارة الداخلية</span></div>
      <div class="plogo"><img src="/assets/partner-sehha.png" alt="وزارة الصحة" loading="lazy"><span class="plogo-name">وزارة الصحة</span></div>
    </div>
  </div>
</section>

<footer class="foot">
  <div class="wrap">
    <div class="f-top">
      <div class="f-lock">
        <img src="/assets/logo-pp-white.png" alt="النيابة العامة">
        <span class="sep"></span>
        <img src="/assets/logo-center-gold.png" alt="مركز برنامج الحماية">
      </div>
      <div class="f-cols">
        <div class="f-col"><h5>المنصّة</h5><a href="#about">عن المركز</a><a href="#covered">من نحمي</a><a href="#measures">تدابير الحماية</a></div>
        <div class="f-col"><h5>الخدمات</h5><a href="#" data-nafath data-role="seeker">تقديم طلب حماية</a><a href="#" data-nafath>الدخول عبر نفاذ</a><a href="#enter">المدخل الموحّد</a></div>
        <div class="f-col"><h5>مراجع</h5><a href="#">الأنظمة واللوائح</a><a href="#">أطلس الإجراءات</a><a href="#">الأسئلة الشائعة</a></div>
      </div>
    </div>
    <div class="f-bottom">
      <span>© 2026 النيابة العامة — مركز برنامج حماية المبلّغين والشهود والخبراء والضحايا. جميع الحقوق محفوظة.</span>
      <div class="f-2030"><img src="/assets/logo-2030.png" alt="رؤية 2030"><span>رؤية<br>السعودية 2030</span></div>
    </div>
  </div>
</footer>

<div class="gw-modal" id="gwModal" role="dialog" aria-modal="true" aria-label="الدخول عبر نفاذ">
  <div class="gw-scrim"></div>
  <div class="gw-dialog">
    <div class="gw-dialog-head">
      <span class="nf-badge"><span class="ms">fingerprint</span></span>
      <div><b>الدخول عبر نفاذ</b><span class="nf-official">النفاذ الوطني الموحّد · منصّة حماية</span></div>
      <button class="gw-close" id="gwModalClose" aria-label="إغلاق"><span class="ms">close</span></button>
    </div>
    <div class="gw-dialog-body" id="gwModalBody"></div>
    <div class="gw-dialog-foot" id="gwModalFoot"></div>
  </div>
</div>
`;

export default function GatewayPage() {
  return <div dangerouslySetInnerHTML={{ __html: HTML }} />;
}
