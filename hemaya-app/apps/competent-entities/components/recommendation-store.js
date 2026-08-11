"use client";
/* ============================================================
   مصدرٌ حيٌّ لتوصيات الجهة المختصة من Supabase (recommendations) + Realtime.
   RLS المُوجّهة بالفرع (rec_branch_rw) تعزل تلقائيّاً — تُعرَض توصيات فرع المستخدم فقط.
   الوارِدة (INCOMING) = قيد الإعداد؛ المُرسَلة (SENT) = بُتّ فيها. لا بيانات مُلفّقة.
   وسم «مُرسَلة» يُشتق من الوقائع لا من approval_status (عمود سلسلة اعتمادٍ لم
   تُنفَّذ، يبقى 'preparing' دائماً): record_recommendation تضبط decision
   وreceived_at معاً، وsubmit_entity_recommendation تُدرج decision منذ الإنشاء،
   ومسارات الإحالة تُدرج decision فارغاً — فالفارغ وارِدة وما سواه مُرسَلة.
   ============================================================ */
import { useEffect, useState, useRef } from "react";
import { createClient } from "@hemaya/supabase/src/browser";

const DAY = 86400000;
const CAT = { witness: "شاهد", reporter: "مبلّغ", expert: "خبير", victim: "ضحية", related: "ذو صلة" };

const norm = (r) => {
  const pc = r.protection_cases || {};
  const br = r.branches || {};
  const filed = r.raised_at ? new Date(r.raised_at).getTime() : 0;
  const days = filed ? Math.max(0, Math.floor((Date.now() - filed) / DAY)) : 0;
  const decided = !!r.received_at || !!(r.decision && r.decision.trim());
  const status = decided ? "sent" : "awaiting";
  return {
    id: r.id, caseId: r.case_id, secret: pc.secret_code || "—", cat: CAT[pc.category] || pc.category || "—",
    caseNo: pc.ref_no || "—", entity: br.entity || "prosecution", region: br.region || "RUH",
    days, status, decision: r.decision || "", outcome: r.decision || "",
    linked: true, _real: true, sentAt: r.received_at || r.raised_at,
  };
};

export function useRecommendations() {
  const [rows, setRows] = useState([]);
  const supabase = useRef(createClient()).current;
  useEffect(() => {
    let active = true;
    const load = () => supabase.from("recommendations")
      .select("*, protection_cases(secret_code, category, ref_no), branches(entity, region)")
      .order("raised_at", { ascending: false })
      .then(({ data }) => { if (active) setRows((data ?? []).map(norm)); });
    load();
    const ch = supabase.channel("ce-recs").on("postgres_changes", { event: "*", schema: "public", table: "recommendations" }, () => load()).subscribe();
    return () => { active = false; try { supabase.removeChannel(ch); } catch (e) {} };
  }, [supabase]);
  return {
    incoming: rows.filter((r) => r.status !== "sent"),
    sent: rows.filter((r) => r.status === "sent"),
  };
}
