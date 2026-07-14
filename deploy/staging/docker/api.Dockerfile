# ============================================================
# سيرفر الـ APIs — واجهة REST (Hono) على المنفذ 3020.
# ============================================================
FROM node:22-alpine
RUN corepack enable
WORKDIR /repo/hemaya-app
COPY hemaya-app .
# التنفيذ من داخل مجلد الحزمة كي يلتقط corepack إصدار pnpm المثبَّت في packageManager
RUN pnpm --filter @hemaya/api... install --frozen-lockfile
WORKDIR /repo/hemaya-app/apps/api
ENV NODE_ENV=production
EXPOSE 3020
# tsx يقرأ المتغيّرات من بيئة الحاوية مباشرة (لا حاجة لملف .env)
CMD ["npx", "tsx", "src/index.ts"]
