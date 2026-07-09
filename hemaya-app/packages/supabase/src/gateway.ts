// عنوان البوّابة الموحّدة (نقطة الدخول الوحيدة عبر نفاذ). كل بوّابةٍ فرعية
// تُحوِّل غير المُصادَق إلى هنا؛ لا شاشات نفاذ محليّة داخل البوّابات.
export const GATEWAY_URL =
  process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:3000";
