import { Hono } from "hono";
import type { Env } from "../types";
import { requireScope } from "../middleware/scope";

/** إشعارات المستخدم — قراءة فقط، محكومة بـ RLS. */
export const notifications = new Hono<Env>();

notifications.get("/", requireScope("notifications:read"), async (c) => {
  const db = c.get("db");
  const { data, error } = await db
    .from("notifications")
    .select("id, case_id, type, channel, due_at, sent_at, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return c.json({ data });
});
