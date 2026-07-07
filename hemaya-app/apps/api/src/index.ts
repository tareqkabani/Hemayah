import { serve } from "@hono/node-server";
import { app } from "./app";

const port = Number(process.env.API_PORT ?? 3020);

// تحقّق مبكر من متغيّرات البيئة الحرِجة — فشلٌ واضح خيرٌ من خطأ غامض لاحقاً.
for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]) {
  if (!process.env[key]) {
    console.error(`[hemaya-api] متغيّر البيئة ${key} مفقود. انسخ .env.example إلى .env واملأه.`);
    process.exit(1);
  }
}

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[hemaya-api] يعمل على http://localhost:${info.port} (v1)`);
});
