#!/bin/sh
# ============================================================
# وكيل https للبيئة التجريبية:
#   443 ← البوابة الموحّدة + تمرير /supabase/ لقاعدة Supabase
#   (لتفادي حجب المحتوى المختلط في المتصفحات على صفحات https)
#   80  ← تحويل دائم إلى https
# الشهادة: من TLS_CERT_B64/TLS_KEY_B64 إنوفّرتها الجهة (base64 سطر واحد)،
# وإلا شهادة ذاتية التوقيع تُولَّد تلقائياً (تحذير متصفح متوقع).
# ============================================================
set -e
mkdir -p /etc/nginx/certs

if [ -n "$TLS_CERT_B64" ] && [ -n "$TLS_KEY_B64" ]; then
  echo "$TLS_CERT_B64" | base64 -d > /etc/nginx/certs/server.crt
  echo "$TLS_KEY_B64" | base64 -d > /etc/nginx/certs/server.key
  echo "[proxy] using provided TLS certificate"
else
  CN="${PUBLIC_HOST:-hemayah.local}"
  openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
    -subj "/CN=${CN}" -addext "subjectAltName=DNS:${CN}" \
    -keyout /etc/nginx/certs/server.key -out /etc/nginx/certs/server.crt 2>/dev/null
  echo "[proxy] generated self-signed certificate for ${CN}"
fi

cat > /etc/nginx/conf.d/default.conf <<EOF
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

  # قاعدة Supabase عبر النطاق نفسه (auth/rest/realtime/storage)
  location /supabase/ {
    proxy_pass http://${DB_HOST}:55321/;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection \$http_upgrade;
    proxy_read_timeout 3600s;
  }

  location / {
    proxy_pass http://hemaya-frontend:3000;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection \$http_upgrade;
    proxy_read_timeout 120s;
  }
}
EOF

exec nginx -g 'daemon off;'
