"use client";
import { useEffect } from "react";
import { createClient } from "./browser";

/** اشتراك حيّ على جدول (postgres_changes) — يستدعي onChange عند أي تغيير. */
export function useRealtime(
  table: string,
  onChange: () => void,
  opts?: { filter?: string; event?: "INSERT" | "UPDATE" | "DELETE" | "*" },
) {
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel("rt-" + table + "-" + (opts?.filter ?? "all"))
      .on(
        "postgres_changes" as never,
        { event: opts?.event ?? "*", schema: "public", table, filter: opts?.filter } as never,
        () => onChange(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, opts?.filter]);
}
