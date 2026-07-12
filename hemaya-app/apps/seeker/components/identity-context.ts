"use client";
import { createContext } from "react";

export type Identity = {
  name: string;
  nationalId: string;
  via: string;
  secretCode: string | null;
};

export const IdentityContext = createContext<Identity>({
  name: "طالب الحماية",
  nationalId: "—",
  via: "—",
  secretCode: null,
});

export type SeekerRequest = {
  id: string;
  ref_no: string;
  secret_code: string;
  status: string;
  category: string;
  created_at: string;
  details: Record<string, unknown> | null;
};

export const RequestsContext = createContext<SeekerRequest[]>([]);

/** إخفاء جزئي لرقم الهوية: `1••••••482` — يظهر أول خانة وآخر ثلاث. */
export function maskId(id: string | null | undefined): string {
  if (!id || id.length < 5) return id || "—";
  return id[0] + "••••••" + id.slice(-3);
}
