#!/bin/sh
# ============================================================
# وكيل https للبيئة التجريبية:
#   443 ← البوابة الموحّدة + تمرير /supabase/ لقاعدة Supabase
#   (لتفادي حجب المحتوى المختلط في المتصفحات على صفحات https)
#   80  ← تحويل دائم إلى https
#
# الشهادة: من TLS_CERT_B64/TLS_KEY_B64 إن وفّرتها الجهة (base64 سطر واحد).
# وإلا: تُولَّد ذاتية التوقيع في غير الإنتاج فقط؛ وفي الإنتاج يُرفض الإقلاع
# (HMY-14 — لا فشلٌ مفتوحٌ إلى شهادةٍ يعتاد المستخدمون تجاوز تحذيرها).
#
# تقسية 2026-08-25:
#   · HMY-08: ترويسات أمان (HSTS · nosniff · DENY تأطير · Referrer · Permissions)
#   · HMY-05: حدُّ معدّلٍ على الحافة لمسارَي الدخول (nafath/auth) + X-Forwarded-For
#     يُعاد كتابته من عنوان الاتصال ($remote_addr) لا يُلحَق (منعُ انتحاله)
# ============================================================
set -e
mkdir -p /etc/nginx/certs

if [ -n "$TLS_CERT_B64" ] && [ -n "$TLS_KEY_B64" ]; then
  echo "$TLS_CERT_B64" | base64 -d > /etc/nginx/certs/server.crt
  echo "$TLS_KEY_B64" | base64 -d > /etc/nginx/certs/server.key
  echo "[proxy] using provided TLS certificate"
elif [ "${APP_ENV:-development}" = "production" ]; then
  echo "[proxy] ✗ APP_ENV=production بلا TLS_CERT_B64/TLS_KEY_B64 — يُرفض الإقلاع (HMY-14)." >&2
  echo "[proxy]   وفّر شهادةً حقيقيّة؛ الذاتيّةُ التوقيع للتطوير وحده." >&2
  exit 1
else
  CN="${PUBLIC_HOST:-hemayah.local}"
  echo "[proxy] ⚠ development: توليد شهادةٍ ذاتية التوقيع لـ${CN} (تحذير متصفح متوقع)."
  openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
    -subj "/CN=${CN}" -addext "subjectAltName=DNS:${CN}" \
    -keyout /etc/nginx/certs/server.key -out /etc/nginx/certs/server.crt 2>/dev/null
fi

cat > /etc/nginx/conf.d/default.conf <<EOF
# حدُّ معدّلٍ على الحافة لمسارات الدخول (HMY-05): مفتاحُه عنوانُ الاتصال
# الحقيقيّ (\$binary_remote_addr) لا ترويسةٌ منتحَلة. 10 طلبات/ث بدفقة 20.
limit_req_zone \$binary_remote_addr zone=authlimit:10m rate=10r/s;

server {
  listen 80;
  server_name _;
  return 301 https://\$host\$request_uri;
}
server {
  listen 443 ssl;
  server_name _;
  ssl_certificate     /etc/nginx/certs/server.crt;
  ssl_certificate_key /etc/nginx/certs/server.key;
  client_max_body_size 25m;

  # ── ترويسات الأمان (HMY-08) — تُطبَّق على كل استجابة (بما فيها الأخطاء) ──
  add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-Frame-Options "DENY" always;
  add_header Referrer-Policy "no-referrer" always;
  add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

  # قاعدة Supabase عبر النطاق نفسه (auth/rest/realtime/storage)
  location /supabase/ {
    proxy_pass http://${DB_HOST}:55321/;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    # HMY-05: أعِد كتابة X-Forwarded-For من عنوان الاتصال — لا تُلحق رأسَ العميل
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$remote_addr;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection \$http_upgrade;
    proxy_read_timeout 3600s;
  }

  # نقاط مصادقة Supabase — حدُّ معدّلٍ أشدّ (تخمينُ الدخول والتسجيل)
  location /supabase/auth/ {
    limit_req zone=authlimit burst=20 nodelay;
    proxy_pass http://${DB_HOST}:55321/auth/;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$remote_addr;
  }

  # جسر نفاذ (مصدر التوكن) — حدُّ معدّلٍ على الحافة
  location /api/nafath {
    limit_req zone=authlimit burst=20 nodelay;
    proxy_pass http://hemaya-frontend:3000;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$remote_addr;
    proxy_set_header X-Forwarded-Proto https;
  }

  location / {
    proxy_pass http://hemaya-frontend:3000;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    # HMY-05: إعادة كتابة لا إلحاق
    proxy_set_header X-Forwarded-For \$remote_addr;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection \$http_upgrade;
    proxy_read_timeout 120s;
  }
}
EOF

exec nginx -g 'daemon off;'
