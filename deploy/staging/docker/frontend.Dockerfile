# ============================================================
# سيرفر الواجهات — يبني البوابات الـ11 + الموجّه الموحّد (landing)
# ويشغّلها بـ pm2-runtime خلف المنفذ 3000.
# متغيّرات NEXT_PUBLIC_* تُحقن وقت البناء (تُدمج في شيفرة المتصفح)،
# والأسرار الخادمية تُمرَّر وقت التشغيل من الـ stack.
# ============================================================
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_GATEWAY_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_GATEWAY_URL=$NEXT_PUBLIC_GATEWAY_URL \
    NEXT_TELEMETRY_DISABLED=1

COPY hemaya-app ./hemaya-app
COPY deploy/staging/ecosystem.config.cjs ./deploy/staging/ecosystem.config.cjs
# التنفيذ من داخل مجلد الحزمة كي يلتقط corepack إصدار pnpm المثبَّت في packageManager
RUN cd hemaya-app && pnpm install --frozen-lockfile && pnpm build

FROM node:22-alpine
RUN corepack enable && npm i -g pm2
WORKDIR /repo
COPY --from=build /repo /repo
ENV NODE_ENV=production HEMAYA_ROLE=frontend
EXPOSE 3000
CMD ["pm2-runtime", "start", "deploy/staging/ecosystem.config.cjs"]
