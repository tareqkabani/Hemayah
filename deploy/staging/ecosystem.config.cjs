// ============================================================
// pm2 — تشغيل منظومة «حماية» كاملة على سيرفر البيئة التجريبية.
// يتطلب بناء مسبقاً: pnpm -C hemaya-app -r build
// التشغيل: pm2 start deploy/staging/ecosystem.config.cjs
// ============================================================
const path = require("path");
const ROOT = path.resolve(__dirname, "../../hemaya-app");

const portal = (name) => ({
  name: `hemaya-${name}`,
  cwd: path.join(ROOT, "apps", name),
  script: "pnpm",
  args: "start",
  env: { NODE_ENV: "production" },
  max_restarts: 5,
});

const FRONTEND = [
  // الموجّه الموحّد (3000) — نقطة الدخول الوحيدة للمستخدمين
  portal("landing"),
  portal("seeker"),            // 3013
  portal("center-officer"),    // 3002
  portal("competent-entities"),// 3006
  portal("attorney-general"),  // 3007
  portal("technical-office"),  // 3008
  portal("health"),            // 3009
  portal("hr"),                // 3010
  portal("interior"),          // 3011
  portal("security-admin"),    // 3012
  portal("decision"),          // 3014
  portal("studier"),           // 3015
  portal("evaluator"),         // 3016
];
const API = [portal("api")];   // 3020 (Hono REST)

// HEMAYA_ROLE يحدّد ما يعمل على هذا العتاد: frontend | api | all (افتراضي — سيرفر واحد)
const role = process.env.HEMAYA_ROLE || "all";
module.exports = {
  apps: role === "frontend" ? FRONTEND : role === "api" ? API : [...FRONTEND, ...API],
};
