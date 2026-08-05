// دخان: طلبٌ واحدٌ لكلّ نقطةٍ عامّة — يُشغَّل قبل أيّ اختبار ضغطٍ للتأكّد أنّ
// الهدف حيٌّ وأنّ الطبقات الثلاث تتكلّم. نظير verify.sh لكن بمقاييس k6.
//
//   docker run --rm -i grafana/k6 run - < smoke.js \
//     -e BASE=https://hemayah.pp.gov.sa -e DB=https://hemayah.pp.gov.sa/supabase
import http from "k6/http";
import { check } from "k6";

const BASE = __ENV.BASE || "http://localhost:3000";
const DB = __ENV.DB || "http://localhost:55321";

export const options = {
  vus: 1,
  iterations: 1,
  // الدخان لا يحتمل أيّ إخفاق: أيّ فحصٍ ساقطٍ يُسقط التشغيلة.
  thresholds: { checks: ["rate==1.0"] },
};

export default function () {
  const pages = [
    ["الشاشة الموحّدة", `${BASE}/`, 200],
    ["منطقة seeker", `${BASE}/seeker`, 307],
    ["منطقة المركز", `${BASE}/center`, 307],
    ["منطقة القرار", `${BASE}/decision`, 307],
    ["صحّة الـAPI", `${BASE}/api/v1/health`, 200],
    ["عقد OpenAPI", `${BASE}/api/v1/openapi.json`, 200],
    // 401 هو الجواب الصحيح: PostgREST مكشوفٌ للمتصفّحات لكنّه يطلب مفتاحاً.
    ["Supabase REST", `${DB}/rest/v1/`, 401],
    ["Supabase Auth", `${DB}/auth/v1/health`, 200],
  ];

  for (const [label, url, want] of pages) {
    const res = http.get(url, { redirects: 0, tags: { name: label } });
    check(res, { [`${label} → ${want}`]: (r) => r.status === want });
  }
}
