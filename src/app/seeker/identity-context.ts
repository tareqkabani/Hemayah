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
