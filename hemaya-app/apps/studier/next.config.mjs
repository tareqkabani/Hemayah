/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: "/studier",
  experimental: { serverActions: { allowedOrigins: [...(process.env.NODE_ENV !== "production" ? ["localhost:3000"] : []), ...(process.env.SERVER_ACTIONS_ALLOWED_ORIGINS?.split(",") ?? [])] } },
  transpilePackages: ["@hemaya/ui", "@hemaya/auth", "@hemaya/supabase", "@hemaya/domain", "@hemaya/study-eval"],
};
export default nextConfig;
