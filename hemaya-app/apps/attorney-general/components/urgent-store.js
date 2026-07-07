"use client";
/* ============================================================
   المسار العاجل (م8) — قراءةٌ حيّة من emergency_reports + Realtime، وبتٌّ عبر RPC approve_urgent.
   لا بيانات مُلفّقة: التفاصيل من escalation (يملؤها المُنتِج: الإدارة الأمنية).
   ============================================================ */
import { useEffect, useState, useRef } from "react";
import { createClient } from "@hemaya/supabase/src/browser";

const CAT_AR = { reporter: "مبلّغ", witness: "شاهد", expert: "خبير", victim: "ضحية", related: "ذو صلة" };

const norm = (r) => {
  const pc = r.protection_cases || {};
  const esc = r.escalation || {};
  const reported = r.reported_at ? new Date(r.reported_at).getTime() : 0;
  const elapsed = reported ? Math.max(0, Math.floor((Date.now() - reported) / 60000)) : 0; // دقائق
  return {
    id: r.id, ref: "EMR-" + String(r.id).slice(0, 8), caseId: r.case_id,
    secret: pc.secret_code || "—", cat: CAT_AR[pc.category] || pc.category || "—",
    elapsed, reportedAt: r.reported_at,
    status: r.status, // pending | approved | rejected
    raisedBy: esc.raisedBy || "جهةٌ مختصّة",
    danger: esc.danger || "", source: esc.source || "", requested: esc.requested || "", extends: esc.extends || "—",
    ruling: esc.ruling || null,
  };
};

export function useUrgent() {
  const [rows, setRows] = useState([]);
  const supabase = useRef(createClient()).current;
  useEffect(() => {
    let active = true;
    const load = () => supabase.from("emergency_reports").select("*, protection_cases(secret_code, category)").order("reported_at", { ascending: false })
      .then(({ data }) => { if (active) setRows((data ?? []).map(norm)); });
    load();
    const ch = supabase.channel("ag-urgent").on("postgres_changes", { event: "*", schema: "public", table: "emergency_reports" }, () => load()).subscribe();
    return () => { active = false; try { supabase.removeChannel(ch); } catch (e) {} };
  }, [supabase]);
  return rows;
}

export async function approveUrgent(id, approve, types, days, reason) {
  const supabase = createClient();
  return supabase.rpc("approve_urgent", { _emergency_id: id, _approve: approve, _types: types, _days: days, _reason: reason });
}
