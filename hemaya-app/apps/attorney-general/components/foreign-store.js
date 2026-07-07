"use client";
/* ============================================================
   مصدرٌ حيٌّ للطلبات الأجنبيّة من Supabase (foreign_requests) + Realtime.
   يُطبِّع الصفوف إلى شكلٍ يستهلكه مسار الأجنبي واللوحة والتقرير — بلا بياناتٍ مُلفّقة.
   البتّ يكتب pg_decision فيُشعِل مُشغّل الداخلية القائم (تبليغ moi) لحظيّاً.
   ============================================================ */
import { useEffect, useState, useRef } from "react";
import { createClient } from "@hemaya/supabase/src/browser";

// pg_decision: '' بانتظار البتّ · 'approved' قبول · 'declined' رفض.
const norm = (r) => ({
  id: r.id, ref: r.ref, secret: r.secret, cat: r.category, country: r.country,
  authority: r.authority, basis: r.basis, foreignRef: r.foreign_ref,
  reciprocity: r.reciprocity, summary: r.summary, status: r.status,
  createdAt: r.created_at, decided: r.pg_decision || "",
});

export function useForeign() {
  const [rows, setRows] = useState([]);
  const supabase = useRef(createClient()).current;
  useEffect(() => {
    let active = true;
    const load = () => supabase.from("foreign_requests").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { if (active) setRows((data ?? []).map(norm)); });
    load();
    const ch = supabase.channel("ag-foreign").on("postgres_changes", { event: "*", schema: "public", table: "foreign_requests" }, () => load()).subscribe();
    return () => { active = false; try { supabase.removeChannel(ch); } catch (e) {} };
  }, [supabase]);
  return rows;
}

// كتابة القرار النهائي على foreign_requests (يُشعِل تبليغ الداخلية عبر المُشغّل القائم).
export async function decideForeign(id, outcome) {
  const supabase = createClient();
  const pg_decision = outcome === "accept" ? "approved" : "declined";
  const status = outcome === "accept" ? "notified" : "declined";
  return supabase.from("foreign_requests").update({ pg_decision, status }).eq("id", id).select().single();
}
