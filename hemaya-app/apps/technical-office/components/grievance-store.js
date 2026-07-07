"use client";
/* ============================================================
   مصدرٌ حيٌّ للتظلّمات من Supabase (grievances) + Realtime — بلا بياناتٍ مُلفّقة.
   بتّ المكتب (upheld/dismissed) يكتب على الصفّ فيُشعِل مُشغّل إشعار طالب الحماية لحظيّاً.
   ============================================================ */
import { useEffect, useState, useRef } from "react";
import { createClient } from "@hemaya/supabase/src/browser";

const DAY = 86400000;
export const CAT_AR = { reporter: "مبلّغ", witness: "شاهد", expert: "خبير", victim: "ضحية", related: "ذو صلة" };

const norm = (r) => {
  const pc = r.protection_cases || {};
  const filed = r.filed_at ? new Date(r.filed_at).getTime() : 0;
  const daysElapsed = filed ? Math.max(0, Math.floor((Date.now() - filed) / DAY)) : 0;
  return {
    id: r.id,
    ref: "GRV-" + String(r.id).slice(0, 8),
    caseId: r.case_id,
    secret: pc.secret_code || "—",
    cat: CAT_AR[pc.category] || pc.category || "—",
    against: r.against || "—",
    filedAt: r.filed_at,
    decisionDue: r.decision_due,
    daysElapsed,
    status: r.status, // filed | tech_review | pg_decision | upheld | dismissed
    techOpinion: r.tech_opinion || "",
    outcome: r.outcome || "",
    decided: r.status === "upheld" || r.status === "dismissed",
  };
};

export function useGrievances() {
  const [rows, setRows] = useState([]);
  const supabase = useRef(createClient()).current;
  useEffect(() => {
    let active = true;
    const load = () => supabase.from("grievances").select("*, protection_cases(secret_code, category)").order("filed_at", { ascending: false })
      .then(({ data }) => { if (active) setRows((data ?? []).map(norm)); });
    load();
    const ch = supabase.channel("to-grievances").on("postgres_changes", { event: "*", schema: "public", table: "grievances" }, () => load()).subscribe();
    return () => { active = false; try { supabase.removeChannel(ch); } catch (e) {} };
  }, [supabase]);
  return rows;
}

// بتّ المكتب الفني: status='upheld' (قبول التظلّم) | 'dismissed' (رفضه) + حيثيّات.
export async function decideGrievance(id, status, techOpinion) {
  const supabase = createClient();
  const outcome = status === "upheld" ? "accept" : "reject";
  return supabase.from("grievances").update({ status, outcome, tech_opinion: techOpinion }).eq("id", id).select().single();
}
