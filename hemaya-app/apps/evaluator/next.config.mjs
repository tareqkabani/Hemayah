/** @type {import('next').NextConfig} */
const nextConfig = {
  // اللِنت يُشغَّل في CI منفصلاً (HMY-19)؛ لا يُفشِل البناء (سلوك Next 14)
  eslint: { ignoreDuringBuilds: true },
  basePath: "/evaluator",
  experimental: { serverActions: { allowedOrigins: [...(process.env.NODE_ENV !== "production" ? ["localhost:3000"] : []), ...(process.env.SERVER_ACTIONS_ALLOWED_ORIGINS?.split(",") ?? [])] } },
  transpilePackages: ["@hemaya/ui", "@hemaya/auth", "@hemaya/supabase", "@hemaya/domain", "@hemaya/study-eval"],
};
export default nextConfig;
