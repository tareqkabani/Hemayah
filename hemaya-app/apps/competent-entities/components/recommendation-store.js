"use client";
/* ============================================================
   مصدرٌ حيٌّ لتوصيات الجهة المختصة من Supabase (recommendations) + Realtime.
   RLS المُوجّهة بالفرع (rec_branch_rw) تعزل تلقائيّاً — تُعرَض توصيات فرع المستخدم فقط.

   الحالة تُشتقّ من وقائع القاعدة، بترتيبٍ مقصود:
     pending_head → «بانتظار اعتماد الرئيس» (داخل سلسلة الاعتماد، لم تصل المركز)
     returned     → «مُعادة للموظف» بملاحظة الرئيس
     received_at أو decision → «مرفوعة للمركز»
     وإلا         → «بانتظار توصيتنا»
   ترتيبُ الشرطين الأولين قبل الثالث مقصود: مسوّدة الموظف تُودَع في
   recommendations.decision لحظة الرفع للاعتماد، فلولا تقدّمهما لبدت مُرسَلةً
   وهي لم تغادر الفرع. وتوصيات الرفع المبادِر (submit_entity_recommendation)
   تُنشأ بقرارٍ مملوء وهي خارج السلسلة، فيلتقطها الشرط الثالث.

   تفاصيل السلسلة (المُعِدّ، ميعاد الدرجة، ملاحظة الإعادة، المسوّدة الكاملة)
   تأتي من branch_approval_queue() — لأن اسم المُعِدّ في auth.users المحجوبة.
   لا بيانات مُلفّقة.
   ============================================================ */
import { useCallback, useEffect, useState, useRef } from "react";
import { createClient } from "@hemaya/supabase/src/browser";
import { businessDaysBetween } from "@hemaya/domain";

const DAY = 86400000;
const CAT = { witness: "شاهد", reporter: "مبلّغ", expert: "خبير", victim: "ضحية", related: "ذو صلة" };

/** تاريخٌ مقروءٌ بعُرف البوابة، و«—» للغائب. */
export const fmtDate = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("ar-SA", { dateStyle: "medium" });
};

/** أيام العمل المتبقّية حتى ميعادٍ ما (سالبها = تجاوز). */
export const daysLeft = (due) => {
  if (!due) return null;
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  return d >= now ? businessDaysBetween(now, d) : -businessDaysBetween(d, now);
};

const norm = (r, chain) => {
  const pc = r.protection_cases || {};
  const br = r.branches || {};
  const c = chain || null;
  const filed = r.raised_at ? new Date(r.raised_at).getTime() : 0;
  const days = filed ? Math.max(0, Math.floor((Date.now() - filed) / DAY)) : 0;
  const st = r.approval_status || "preparing";
  const status =
    st === "pending_head" ? "pending"
    : st === "returned" ? "returned"
    : (r.received_at || (r.decision && r.decision.trim())) ? "sent"
    : "awaiting";
  return {
    id: r.id, recId: r.id, caseId: r.case_id,
    secret: pc.secret_code || "—", cat: CAT[pc.category] || pc.category || "—",
    caseNo: pc.ref_no || "—", entity: br.entity || "prosecution", region: br.region || "RUH",
    days, status, approvalStatus: st,
    decision: r.decision || "", outcome: r.decision || "",
    linked: true, _real: true,
    referred: fmtDate(r.raised_at),
    // «تاريخ الرفع» = الورود الفعلي للمركز، وإلا وقت الإحالة (لا ختمٌ خام)
    sentAt: fmtDate(r.received_at || r.raised_at),
    caseDueAt: r.due_at || null,
    // تفاصيل السلسلة — حاضرةٌ للتوصيات التي تعيش داخلها فقط
    preparedBy: c ? c.prepared_by_name : null,
    preparedAt: c ? c.prepared_at : null,
    stepDueAt: c ? c.step_due_at : null,
    lastNote: c ? c.last_note : null,
    factors9: c ? c.factors9 || {} : {},
    types: c && Array.isArray(c.proposed_type) ? c.proposed_type : [],
    duration: c ? c.proposed_duration : null,
    notes: c ? c.notes : null,
  };
};

export function useRecommendations() {
  const [rows, setRows] = useState([]);
  const supabase = useRef(createClient()).current;

  const load = useCallback(async () => {
    const [recs, chain] = await Promise.all([
      supabase.from("recommendations")
        .select("*, protection_cases(secret_code, category, ref_no), branches(entity, region)")
        .order("raised_at", { ascending: false }),
      supabase.rpc("branch_approval_queue"),
    ]);
    const byRec = new Map((chain.data ?? []).map((c) => [c.recommendation_id, c]));
    return (recs.data ?? []).map((r) => norm(r, byRec.get(r.id)));
  }, [supabase]);

  useEffect(() => {
    let active = true;
    const run = () => load().then((next) => { if (active) setRows(next); });
    run();
    const ch = supabase.channel("ce-recs")
      .on("postgres_changes", { event: "*", schema: "public", table: "recommendations" }, run)
      .subscribe();
    return () => { active = false; try { supabase.removeChannel(ch); } catch (e) {} };
  }, [supabase, load]);

  const refresh = useCallback(() => load().then(setRows), [load]);

  return {
    // وارِدة الموظف: كل ما لم يغادر الفرع (بانتظار توصيتنا · بانتظار الاعتماد · مُعادة)
    incoming: rows.filter((r) => r.status !== "sent"),
    sent: rows.filter((r) => r.status === "sent"),
    // طابور رئيس الفرع: المرفوعة لاعتماده حصراً
    queue: rows.filter((r) => r.status === "pending"),
    refresh,
  };
}
