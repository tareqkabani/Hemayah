'use client';
/* ============================================================
   طبقة الفروع والمناطق + شاشات رئيس الفرع والمقر — منقولة من lib-branch-roles.jsx
   window/DS → @hemaya/ui. تُصدَّر HemayaBranch.
   ============================================================ */
import React, { useState } from "react";
import { Tag } from "@hemaya/ui";

const I = ({ name, size = 20, fill = false, color = 'currentColor', style }) => (
  <span className="material-symbols-rounded" style={{ fontSize: size, color, fontVariationSettings: `'FILL' ${fill ? 1 : 0}`, ...style }}>{name}</span>
);

const REGIONS = { RUH: 'الرياض', MAK: 'مكة المكرمة', MED: 'المدينة المنورة', QAS: 'القصيم', EAS: 'المنطقة الشرقية', ASR: 'عسير', TAB: 'تبوك', HAI: 'حائل', NOR: 'الحدود الشمالية', JAZ: 'جازان', NAJ: 'نجران', BAH: 'الباحة', JOF: 'الجوف' };
const regionDisp = (code) => { const n = REGIONS[code] || code; return (n.charAt(0) === 'ا' && n.charAt(1) === 'ل') ? n : 'منطقة ' + n; };
const branchLabel = (ent, code) => (ent === 'prosecution' ? 'نيابة ' : 'فرع ') + regionDisp(code);
const ENT_BRANCHES = { prosecution: ['RUH', 'MAK', 'EAS', 'QAS'], state_security: ['RUH', 'EAS'], moi: ['RUH', 'MAK'], nazaha: ['RUH', 'EAS'], moj: ['RUH', 'MED'] };

function StatMini({ icon, v, l, bg, fg }) {
  return (
    <div className="card stat"><div className="stat-ico" style={{ background: bg, color: fg }}><I name={icon} size={22} fill /></div><div><div className="stat-v">{v}</div><div className="stat-l">{l}</div></div></div>
  );
}

function HeadHome({ branchName, stats, onGo }) {
  return (
    <div>
      <h2 className="h2">لوحة الفرع — {branchName}</h2>
      <p className="lede">منظور رئيس الفرع المباشر: اعتماد التوصيات قبل رفعها للمركز. لا يُرفَع أي طلب أو توصية إلا باعتمادك — صاحب الصلاحية، حتى في العاجل.</p>
      <div className="stats">
        <StatMini icon="approval" v={stats.pending} l="بانتظار اعتمادك" bg="var(--warning-10)" fg="var(--color-warning)" />
        <StatMini icon="running_with_errors" v={stats.overdue} l="يقترب ميعادها" bg="var(--error-10)" fg="var(--color-error)" />
        <StatMini icon="send" v={stats.raised} l="مرفوعة للمركز" bg="var(--success-10)" fg="var(--color-success)" />
      </div>
      <div className="card pad">
        <div className="row" style={{ justifyContent: 'space-between', rowGap: 12 }}>
          <div style={{ flex: 1, minWidth: 260 }}><b style={{ fontSize: 15, color: 'var(--text-strong)' }}>سلسلة الاعتماد</b><div className="muted" style={{ marginTop: 4, lineHeight: 1.6 }}>الدرجة الأولى (أنت) إلزامية لكل توصية. المقر يشرف ولا يعتمد. مهلة فرعية ضمن ٥ أيام عمل (م٧)، مع تفويض تلقائي عند غيابك — والنظام جاهز لدرجة اعتماد ثانية إن اشترطتها الجهة.</div></div>
          <button className="btn btn-primary sm" onClick={() => onGo('head-approvals')}><I name="approval" size={17} /> فتح قائمة الاعتماد</button>
        </div>
      </div>
    </div>
  );
}

function HeadApprovals({ branchName, queue, onOpen }) {
  return (
    <div>
      <h2 className="h2">بانتظار اعتمادي</h2>
      <p className="lede">توصيات أعدّها موظفو {branchName} بانتظار اعتمادك قبل رفعها للمركز. راجع الملخّص والسند النظامي ثم اعتمد أو أعِدها بملاحظة.</p>
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="tbl-wrap"><table>
          <thead><tr><th>الرمز السري</th><th>الصفة</th><th>رقم القضية</th><th>التوصية المقترحة</th><th>المُعِدّ</th><th>الميعاد</th><th></th></tr></thead>
          <tbody>
            {queue.length === 0 && <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: '28px 16px' }}>لا توصيات بانتظار اعتمادك في هذا الفرع.</td></tr>}
            {queue.map((r) => (
              <tr key={r.secret} className="clk" onClick={() => onOpen(r)}>
                <td className="mono" style={{ fontWeight: 600 }}>{r.secret}</td>
                <td><Tag tone="info" size="sm">{r.cat}</Tag></td>
                <td className="mono">{r.caseNo}</td>
                <td><Tag tone={r.outcome === 'توفير' ? 'success' : 'neutral'} size="sm">{r.outcome}</Tag></td>
                <td className="muted">{r.preparedBy}</td>
                <td>{r.deadlineDays <= 1 ? <span className="src" style={{ color: 'var(--color-error)' }}><I name="schedule" size={14} /> متبقٍّ {r.deadlineDays}</span> : <span className="muted">متبقٍّ {r.deadlineDays} أيام</span>}</td>
                <td><span className="link">مراجعة واعتماد <I name="chevron_left" size={16} /></span></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}

function HeadReview({ item, branchName, onApprove, onReturn, onBack }) {
  const [note, setNote] = useState('');
  const [showFull, setShowFull] = useState(true);
  const D = {
    'توفير': { risk: 'مرتفع', ext: 'نعم — يمتد لأفراد أسرته المقيمين معه', reach: 'ضمن نطاق المادة (٥/٤)', types: ['الحماية الشخصية والمرافقة الأمنية', 'إخفاء الهوية في المحاضر والإجراءات', 'تغيير مكان الإقامة مؤقّتاً'], duration: 'ستة أشهر قابلة للتجديد', just: 'تهديد جدّي مرتبط بصفته في قضية قائمة، مع مؤشّرات على امتداد الخطر لذويه — التوصية بتوفير الحماية.' },
    'عدم توفير': { risk: 'منخفض', ext: 'لا يوجد امتداد للغير', reach: 'لا ينطبق', types: [], duration: '—', just: 'لم تثبت جدّية التهديد أو ارتباطه المباشر بالقضية بما يستوجب تدبيراً — والتوصية استشارية، والقرار النهائي للمركز.' },
  };
  const d = D[item.outcome] || D['توفير'];
  const capMap = { 'شاهد': 'شاهد في قضية جزائية قائمة', 'مبلّغ': 'مبلّغ عن جريمة في قضية قائمة', 'خبير': 'خبير مكلّف في قضية قائمة', 'ضحية': 'مجنيٌّ عليه في قضية قائمة' };
  const cap = capMap[item.cat] || 'ذو صفة في قضية قائمة';
  const reqFields = [['الرمز السري', item.secret], ['الصفة', item.cat], ['رقم القضية', item.caseNo], ['الجهة المُحيلة', 'مركز حماية الشهود والمبلّغين'], ['الفرع المختص', branchName], ['حالة القضية', 'قائمة (سارية)'], ['صفة مقدم الطلب (م١)', cap], ['مستوى التهديد المبدئي', d.risk]];
  const recFields = [['المُعِدّ', item.preparedBy], ['التواصل مع الجهة', 'تمّ — محضر موثّق'], ['مستوى الخطر', d.risk], ['امتداد الخطر للغير', d.ext], ['الامتداد (م٥/٤)', d.reach], ['المدة المقترحة', d.duration]];
  const Fld = ({ l, v }) => <div className="rf-fld"><span className="rf-label" style={{ fontWeight: 600 }}>{l}</span><div style={{ fontSize: 14, color: 'var(--text-strong)', fontWeight: 600 }}>{v}</div></div>;
  return (
    <div style={{ maxWidth: 820 }}>
      <button className="link" onClick={onBack} style={{ marginBottom: 14 }}><I name="arrow_forward" size={17} /> رجوع للقائمة</button>
      <div className="row" style={{ gap: 10, marginBottom: 12, flexWrap: 'nowrap' }}>
        <div style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 'var(--radius-md)', background: 'var(--green-10)', display: 'grid', placeItems: 'center' }}><I name="approval" size={22} color="var(--color-primary)" fill /></div>
        <div><h2 className="h2" style={{ margin: 0 }}>اعتماد التوصية</h2><div className="muted">{branchName} · الرئيس المباشر — صاحب الصلاحية</div></div>
      </div>
      <div className="card pad" style={{ marginBottom: 14 }}>
        <div className="row" style={{ gap: 26, rowGap: 12, alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div className="row" style={{ gap: 26, rowGap: 12, alignItems: 'flex-start' }}>
            <div><div className="muted" style={{ fontSize: 12 }}>الرمز السري</div><div className="mono" style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{item.secret}</div></div>
            <div><div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>الصفة</div><Tag tone="info" size="sm">{item.cat}</Tag></div>
            <div><div className="muted" style={{ fontSize: 12 }}>رقم القضية</div><div className="mono">{item.caseNo}</div></div>
            <div><div className="muted" style={{ fontSize: 12 }}>المُعِدّ</div><div style={{ fontWeight: 600 }}>{item.preparedBy}</div></div>
            <div><div className="muted" style={{ fontSize: 12 }}>الميعاد المتبقّي</div><div style={{ fontWeight: 700, color: item.deadlineDays <= 1 ? 'var(--color-error)' : 'var(--text-strong)' }}>{item.deadlineDays} أيام عمل</div></div>
          </div>
          <button className="btn btn-ghost sm" onClick={() => setShowFull((s) => !s)}><I name={showFull ? 'unfold_less' : 'unfold_more'} size={16} /> {showFull ? 'إخفاء التفاصيل' : 'عرض التفاصيل الكاملة'}</button>
        </div>
      </div>
      {showFull && <>
        <div className="rf-sec">
          <div className="rf-sec-head"><div className="rf-sec-n"><I name="description" size={16} /></div><div><h3 className="rf-sec-t">تفاصيل الطلب المُحال</h3><p className="rf-sec-sub">بيانات الطلب والقضية كما وردت من المركز — الهوية بالرمز السري.</p></div></div>
          <div className="rf-sec-body"><div className="rf-grid2">{reqFields.map(([l, v]) => <Fld key={l} l={l} v={v} />)}</div></div>
        </div>
        <div className="rf-sec">
          <div className="rf-sec-head"><div className="rf-sec-n"><I name="gavel" size={16} /></div><div><h3 className="rf-sec-t">التوصية كاملة — كما أعدّها الموظف</h3><p className="rf-sec-sub">عوامل المادة (٩)، المسوّغات، أنواع الحماية (م١٤)، المدة والمرفقات.</p></div></div>
          <div className="rf-sec-body">
            <div style={{ marginBottom: 16 }}><Tag tone={item.outcome === 'توفير' ? 'success' : 'neutral'} size="md" iconLeft={<I name={item.outcome === 'توفير' ? 'shield' : 'remove_moderator'} size={14} />}>{item.outcome === 'توفير' ? 'التوصية بتوفير الحماية' : 'التوصية بعدم توفير الحماية'}</Tag></div>
            <div className="rf-grid2">{recFields.map(([l, v]) => <Fld key={l} l={l} v={v} />)}</div>
            <div className="rf-fld"><span className="rf-label" style={{ fontWeight: 600 }}>مسوّغات التوصية</span><div style={{ fontSize: 13.5, color: 'var(--text-body)', lineHeight: 1.7 }}>{d.just}</div></div>
            <div className="rf-fld"><span className="rf-label" style={{ fontWeight: 600 }}>أنواع الحماية المقترحة (م١٤)</span>{d.types.length ? <div className="rf-chips">{d.types.map((t) => <span key={t} className="rf-chip on" style={{ cursor: 'default' }}>{t}</span>)}</div> : <div className="muted">لا ينطبق — التوصية بعدم توفير الحماية.</div>}</div>
            <div className="rf-fld"><span className="rf-label" style={{ fontWeight: 600 }}>المرفقات</span><div style={{ display: 'grid', gap: 6 }}>{['محضر التواصل الهاتفي (موثّق)', 'صورة الهوية الوطنية', 'مستندات تدعم التهديد'].map((a) => <div key={a} className="row" style={{ gap: 7 }}><I name="attach_file" size={15} color="var(--color-primary)" /><span style={{ fontSize: 13.5 }}>{a}</span></div>)}</div></div>
            <div className="conf-note" style={{ marginTop: 4 }}><I name="gavel" size={16} /> السند النظامي: عوامل المادة (٩) — التواصل مع الجهة، مستوى الخطر وامتداده للغير، وصفة الشخص (م١). التوصية استشارية؛ القرار النهائي للمركز بعد الدراسة والتقييم.</div>
          </div>
        </div>
      </>}
      <div style={{ display: 'grid', gap: 6, marginBottom: 14, marginTop: 14 }}>
        <label className="rf-label" style={{ fontWeight: 600 }}>ملاحظة <span className="rf-hint">(إلزامية عند الإعادة للموظف)</span></label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة موجّهة للموظف عند الإعادة، أو توثيق عند الاعتماد…" style={{ fontFamily: 'var(--font-sans)', fontSize: 14, width: '100%', border: '1px solid var(--field-border)', borderRadius: 'var(--radius-md)', background: 'var(--field-bg)', padding: '10px 13px', minHeight: 76, resize: 'vertical', lineHeight: 1.6 }} />
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
        <button className="btn btn-ghost" onClick={() => onReturn(item, note)}><I name="undo" size={18} /> إعادة للموظف بملاحظة</button>
        <button className="btn btn-primary" onClick={() => onApprove(item, note)}><I name="task_alt" size={18} /> اعتماد ورفع للمركز</button>
      </div>
    </div>
  );
}

function HeadRaised({ branchName, raised }) {
  return (
    <div>
      <h2 className="h2">المرفوعة للمركز</h2>
      <p className="lede">توصيات {branchName} التي اعتمدتها ورُفِعت للمركز. القرار النهائي لإدارة برنامج الحماية بعد الدراسة والتقييم.</p>
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="tbl-wrap"><table>
          <thead><tr><th>الرمز السري</th><th>الصفة</th><th>رقم القضية</th><th>التوصية</th><th>الرفع</th></tr></thead>
          <tbody>
            {raised.length === 0 && <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: '28px 16px' }}>لم تُرفع توصيات من هذا الفرع بعد.</td></tr>}
            {raised.map((r, i) => (
              <tr key={r.secret + i}>
                <td className="mono" style={{ fontWeight: 600 }}>{r.secret}</td>
                <td><Tag tone="info" size="sm">{r.cat}</Tag></td>
                <td className="mono">{r.caseNo}</td>
                <td><Tag tone={r.outcome === 'توفير' ? 'success' : 'neutral'} size="sm">{r.outcome}</Tag></td>
                <td className="muted">{r.at}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}

function HQHome({ entName, stats }) {
  const tot = stats.reduce((a, s) => ({ inc: a.inc + s.incoming, pend: a.pend + s.pending, rz: a.rz + s.raised, od: a.od + s.overdue }), { inc: 0, pend: 0, rz: 0, od: 0 });
  return (
    <div>
      <h2 className="h2">لوحة المقر — {entName}</h2>
      <p className="lede">منظور الإدارة العامة: إشراف تجميعي على كل فروع الجهة. المقر يتابع ويعيد الإسناد ويستقبل التصعيد — ولا يعتمد التوصيات (الاعتماد صلاحية رئيس الفرع).</p>
      <div className="stats">
        <StatMini icon="inbox" v={tot.inc} l="إجمالي الوارد" bg="var(--info-10)" fg="var(--color-info)" />
        <StatMini icon="approval" v={tot.pend} l="بانتظار اعتماد الفروع" bg="var(--warning-10)" fg="var(--color-warning)" />
        <StatMini icon="running_with_errors" v={tot.od} l="يقترب ميعادها" bg="var(--error-10)" fg="var(--color-error)" />
        <StatMini icon="send" v={tot.rz} l="مرفوعة للمركز" bg="var(--success-10)" fg="var(--color-success)" />
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="pad" style={{ paddingBottom: 8 }}><b style={{ fontSize: 15, color: 'var(--text-strong)' }}>الفروع والأحمال</b></div>
        <div className="tbl-wrap"><table>
          <thead><tr><th>الفرع / المنطقة</th><th>الوارد</th><th>بانتظار الاعتماد</th><th>يقترب ميعاده</th><th>المرفوع</th></tr></thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.code}>
                <td style={{ fontWeight: 600, color: 'var(--text-strong)' }}><I name="location_city" size={15} color="var(--color-primary)" style={{ marginInlineEnd: 6, verticalAlign: 'middle' }} />{s.name}</td>
                <td className="mono">{s.incoming}</td>
                <td>{s.pending > 0 ? <Tag tone="warning" size="sm">{s.pending}</Tag> : <span className="muted">٠</span>}</td>
                <td>{s.overdue > 0 ? <Tag tone="error" size="sm">{s.overdue}</Tag> : <span className="muted">٠</span>}</td>
                <td className="mono">{s.raised}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}

function HQEscalations({ entName, items, branches, onReassign }) {
  const [openFor, setOpenFor] = useState(null);
  return (
    <div>
      <h2 className="h2">التصعيدات وإعادة الإسناد</h2>
      <p className="lede">طلبات اقترب ميعادها أو تجاوزته عبر فروع {entName}. للمقر إعادة إسناد الطلب لفرع آخر عند الحاجة — ويُسجَّل في التدقيق.</p>
      {items.length === 0
        ? <div className="card pad" style={{ textAlign: 'center', padding: '40px 20px' }}><I name="check_circle" size={38} color="var(--color-success)" /><p className="muted" style={{ marginTop: 12 }}>لا تصعيدات — كل الفروع ضمن المهل النظامية.</p></div>
        : <div style={{ display: 'grid', gap: 10 }}>
          {items.map((it) => (
            <div className="card pad" key={it.secret}>
              <div className="row" style={{ justifyContent: 'space-between', rowGap: 10 }}>
                <div className="row" style={{ gap: 10 }}>
                  <span className="mono" style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{it.secret}</span>
                  <Tag tone="info" size="sm">{it.cat}</Tag>
                  <span className="muted">{it.regionName}</span>
                  <Tag tone="error" size="sm" iconLeft={<I name="schedule" size={13} />}>متبقٍّ {Math.max(0, 5 - it.days)} يوم</Tag>
                </div>
                <button className="btn btn-ghost sm" onClick={() => setOpenFor(openFor === it.secret ? null : it.secret)}><I name="move_up" size={16} /> إعادة إسناد</button>
              </div>
              {openFor === it.secret && (
                <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <span className="muted" style={{ fontSize: 12.5 }}>نقل إلى:</span>
                  {branches.filter((b) => b.code !== it.region).map((b) => (
                    <button key={b.code} className="fbtn" onClick={() => { onReassign(it, b.code); setOpenFor(null); }}>{b.name}</button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>}
    </div>
  );
}

export const HemayaBranch = { REGIONS, regionDisp, branchLabel, ENT_BRANCHES, HeadHome, HeadApprovals, HeadReview, HeadRaised, HQHome, HQEscalations };
