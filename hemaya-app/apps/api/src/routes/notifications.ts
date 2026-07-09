import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { Env } from "../types";
import { requireScope, requireUser } from "../middleware/scope";

/** إشعارات المستخدم — قراءة محكومة بـ RLS، وتعليمٌ كمقروء بهوية المستفيد. */
export const notifications = new Hono<Env>();

notifications.get("/", requireScope("notifications:read"), async (c) => {
  const db = c.get("db");
  const { data, error } = await db
    .from("notifications")
    .select("id, case_id, type, title, body, target_tab, channel, due_at, sent_at, read, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return c.json({ data });
});

/** تعليم إشعارٍ كمقروء — تحديثٌ محكومٌ بـ RLS (المستفيد يملك إشعارات قضاياه). */
notifications.post("/:id/read", requireUser, async (c) => {
  const id = c.req.param("id");
  if (!id) throw new HTTPException(400, { message: "معرّف الإشعار مطلوب." });
  const { data, error } = await c.get("db")
    .from("notifications")
    .update({ read: true })
    .eq("id", id)
    .select("id, read")
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    return c.json(
      { error: { code: "not_found", message: "الإشعار غير موجود.", requestId: c.get("requestId") ?? null } },
      404,
    );
  }
  return c.json({ data });
});
