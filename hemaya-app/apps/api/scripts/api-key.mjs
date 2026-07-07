#!/usr/bin/env node
// ============================================================
//  أداة إدارة مفاتيح API — إصدار/سرد/إبطال. تستخدم service_role.
//  المفتاح الخام يُعرَض مرّةً واحدة فقط عند الإصدار؛ نخزّن تجزئته فقط.
//
//  الاستخدام (من داخل apps/api):
//    node --env-file=.env scripts/api-key.mjs mint "وزارة الداخلية" cases:read
//    node --env-file=.env scripts/api-key.mjs list
//    node --env-file=.env scripts/api-key.mjs revoke <id>
// ============================================================
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !service) {
  console.error("متغيّرات البيئة مفقودة (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");
  process.exit(1);
}
const admin = createClient(url, service, { auth: { persistSession: false } });
const sha256 = (s) => createHash("sha256").update(s).digest("hex");

const [cmd, ...args] = process.argv.slice(2);

if (cmd === "mint") {
  const name = args[0];
  const scopes = args.slice(1);
  if (!name || scopes.length === 0) {
    console.error('الاستخدام: mint "اسم الجهة" scope1 [scope2 ...]');
    process.exit(1);
  }
  const raw = `hem_live_${randomBytes(24).toString("base64url")}`;
  const prefix = raw.slice(0, 16);
  const { data, error } = await admin
    .from("api_keys")
    .insert({ name, prefix, key_hash: sha256(raw), scopes })
    .select("id")
    .single();
  if (error) { console.error("فشل الإصدار:", error.message); process.exit(1); }
  console.log("\n✅ صدر مفتاح API. انسخه الآن — لن يُعرَض مجدّداً:\n");
  console.log("   " + raw + "\n");
  console.log(`   المُعرّف: ${data.id}`);
  console.log(`   الجهة:   ${name}`);
  console.log(`   الصلاحيات: ${scopes.join(", ")}\n`);
} else if (cmd === "list") {
  const { data, error } = await admin
    .from("api_keys")
    .select("id, name, prefix, scopes, active, expires_at, last_used_at, created_at")
    .order("created_at", { ascending: false });
  if (error) { console.error(error.message); process.exit(1); }
  for (const k of data ?? []) {
    console.log(`${k.active ? "●" : "○"} ${k.id}  ${k.prefix}…  [${(k.scopes ?? []).join(", ")}]  ${k.name}` +
      (k.last_used_at ? `  آخر استخدام: ${k.last_used_at}` : "  (لم يُستخدم)"));
  }
  if (!data?.length) console.log("لا مفاتيح.");
} else if (cmd === "revoke") {
  const id = args[0];
  if (!id) { console.error("الاستخدام: revoke <id>"); process.exit(1); }
  const { error } = await admin.from("api_keys").update({ active: false }).eq("id", id);
  if (error) { console.error(error.message); process.exit(1); }
  console.log("✅ أُبطِل المفتاح:", id);
} else {
  console.log("الأوامر: mint \"اسم\" scope… | list | revoke <id>");
  process.exit(1);
}
