"use client";
/* ============================================================
   إشراف النائب العام على التظلّمات — قراءةٌ حيّة من grievances (RLS: grievance_ag_read) + Realtime.
   اطّلاعٌ فقط (البتّ مفوّضٌ للمكتب الفني). لا بيانات مُلفّقة.
   ============================================================ */
import { useEffect, useState, useRef } from "react";
import { createClient } from "@hemaya/supabase/src/browser";

const DAY = 86400000;
const CAT_AR = { reporter: "مبلّغ", witness: "شاهد", expert: "خبير", victim: "ضحية", related: "ذو صلة" };

const norm = (r) => {
  const pc = r.protection_cases || {};
  const filed = r.filed_at ? new Date(r.filed_at).getTime() : 0;
  const daysElapsed = filed ? Math.max(0, Math.floor((Date.now() - filed) / DAY)) : 0;
  const decided = r.status === "upheld" || r.status === "dismissed";
  return {
    id: r.id,
    ref: "GRV-" + String(r.id).slice(0, 8),
    caseId: r.case_id,
    secret: pc.secret_code || "—",
    cat: CAT_AR[pc.category] || pc.category || "—",
    against: r.against || "—",
    scopeLabel: r.against || "—",
    filedAt: r.filed_at,
    decisionDue: r.decision_due,
    daysElapsed,
    status: r.status,
    techOpinion: r.tech_opinion || "",
    decided,
    // توافقٌ مع فاحصات statusOf/‏!officeDecision في الواجهة:
    officeDecision: decided ? { outcome: r.status === "upheld" ? "accept" : "reject" } : null,
  };
};

export function useGrievancesAG() {
  const [rows, setRows] = useState([]);
  const supabase = useRef(createClient()).current;
  useEffect(() => {
    let active = true;
    const load = () => supabase.from("grievances").select("*, protection_cases(secret_code, category)").order("filed_at", { ascending: false })
      .then(({ data }) => { if (active) setRows((data ?? []).map(norm)); });
    load();
    const ch = supabase.channel("ag-grievances").on("postgres_changes", { event: "*", schema: "public", table: "grievances" }, () => load()).subscribe();
    return () => { active = false; try { supabase.removeChannel(ch); } catch (e) {} };
  }, [supabase]);
  return rows;
}
