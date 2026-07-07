import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import type { Env } from "../types";
import { callRpc } from "../lib/supabase";
import { ReferralUpdateSchema, REFERRAL_AUTHORITIES } from "../schemas";
import { validationHook } from "../middleware/validation";
import { requireScope, requireUser } from "../middleware/scope";

/**
 * الإحالات (م14) — الجهات المنفّذة (الصحة، الموارد، الأمنيّة) ترى إحالاتها
 * وتحدّث حالتها. للمستخدم: RLS يقصر الرؤية على جهته. للنظام: صلاحيّة referrals:read.
 */
export const referrals = new Hono<Env>();

const FIELDS =
  "id, ref, service, authority, status, assignee, result, summary, created_at, updated_at, case_id, " +
  "protection_cases(secret_code, category, classification, case_region)";

referrals.get("/", requireScope("referrals:read"), async (c) => {
  const db = c.get("db");
  const authority = c.req.query("authority");
  if (authority && !REFERRAL_AUTHORITIES.includes(authority as (typeof REFERRAL_AUTHORITIES)[number])) {
    throw new HTTPException(400, { message: "جهة الإحالة غير صالحة." });
  }
  let query = db.from("referrals").select(FIELDS).order("created_at", { ascending: false }).limit(200);
  if (authority) query = query.eq("authority", authority as (typeof REFERRAL_AUTHORITIES)[number]);
  const { data, error } = await query;
  if (error) throw error;
  return c.json({ data });
});

referrals.post("/:id", requireUser, zValidator("json", ReferralUpdateSchema, validationHook), async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  if (!id) throw new HTTPException(400, { message: "معرّف الإحالة مطلوب." });
  const input = c.req.valid("json");
  const rows = await callRpc<unknown[]>(db, "referral_update", {
    _id: id,
    _status: input.status,
    _assignee: input.assignee ?? null,
    _result: input.result ?? null,
    _note: input.note,
  });
  const row = Array.isArray(rows) ? rows[0] : rows;
  return c.json({ data: row });
});
