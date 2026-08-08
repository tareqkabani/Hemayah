// ضغط رحلة المستخدم عبر بوّابة الـAPI: دخول نفاذ ثمّ قراءة القضايا والإشعارات.
// يقيس ما يهمّ فعلاً (زمن الاستجابة تحت التزامن) لا مجرّد صفحةٍ ثابتة.
//
//   docker run --rm -i grafana/k6 run - < journey.js -e BASE=https://hemayah.pp.gov.sa
//
// ⚠️ حدّ المعدّل: البوّابة تسمح 120 طلباً/دقيقة لكلّ IP (rate-limit.ts) ومفتاحه
// X-Forwarded-For. من مصدرٍ واحدٍ يعني ذلك ~2 طلب/ث قبل 429 — وهو السلوك
// الصحيح لا عطل. لذلك:
//   • 429 يُحسَب في عدّادٍ منفصلٍ (rate_limited) ولا يُعدّ إخفاقاً.
//   • لقياس السعة الحقيقيّة شغّل من عدّة مصادر، أو ارفع MAX_PER_WINDOW مؤقّتاً
//     على التجريبيّة وحدها. لا تُزوّر X-Forwarded-For لتجاوزه — ذاك اختبار
//     اختراقٍ لا اختبار حِمل، وله سيناريوه في scan/README.
import http from "k6/http";
import { check, sleep, group } from "k6";
import { Counter, Trend } from "k6/metrics";

const BASE = __ENV.BASE || "http://localhost:3000";
const API = `${BASE}/api/v1`;
// هويّاتٌ وهميّةٌ من بذور التجريبيّة — لا تُستعمل على بيئةٍ فيها بياناتٌ حقيقيّة.
const IDS = (__ENV.IDS || "1000000001,2000000002,2000000008").split(",");

const rateLimited = new Counter("rate_limited");
const loginTime = new Trend("nafath_login_ms", true);

export const options = {
  stages: [
    { duration: "30s", target: Number(__ENV.VUS || 10) }, // تصاعد
    { duration: "1m", target: Number(__ENV.VUS || 10) }, // ثبات
    { duration: "20s", target: 0 }, // هبوط
  ],
  thresholds: {
    // نستثني 429 من حساب الإخفاق: هو حاجزٌ مقصود.
    "http_req_failed{expected_response:true}": ["rate<0.01"],
    http_req_duration: ["p(95)<1500"],
    nafath_login_ms: ["p(95)<3000"],
  },
};

const json = { headers: { "Content-Type": "application/json" } };

/** يُرجع access token أو null إن ردّت البوّابة 429/خطأ. */
function login(nid) {
  const t0 = Date.now();
  const start = http.post(`${API}/auth/nafath/start`, JSON.stringify({ nationalId: nid }), json);
  if (start.status === 429) return (rateLimited.add(1), null);
  if (!check(start, { "بدء نفاذ 200": (r) => r.status === 200 })) return null;

  const sessionId = start.json("data.sessionId");
  const confirm = http.post(
    `${API}/auth/nafath/confirm`,
    JSON.stringify({ nationalId: nid, sessionId }),
    json,
  );
  if (confirm.status === 429) return (rateLimited.add(1), null);
  loginTime.add(Date.now() - t0);
  check(confirm, { "تأكيد نفاذ 200": (r) => r.status === 200 });
  return confirm.json("data.accessToken") ?? confirm.json("data.session.access_token");
}

export default function () {
  const nid = IDS[__VU % IDS.length];
  let token;

  group("دخول نفاذ", () => {
    token = login(nid);
  });
  if (!token) return sleep(1);

  const auth = { headers: { Authorization: `Bearer ${token}` }, tags: { name: "read" } };

  group("قراءة", () => {
    const list = http.get(`${API}/cases`, auth);
    if (list.status === 429) rateLimited.add(1);
    else check(list, { "قائمة القضايا 200": (r) => r.status === 200 });

    const notif = http.get(`${API}/notifications`, auth);
    if (notif.status === 429) rateLimited.add(1);
    else check(notif, { "الإشعارات 200": (r) => r.status === 200 });
  });

  sleep(Number(__ENV.THINK || 3)); // زمن تفكير المستخدم — بلا هذا نقيس الأداة لا النظام.
}
