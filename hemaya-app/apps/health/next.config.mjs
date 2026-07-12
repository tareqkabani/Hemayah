/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: "/health",
  experimental: { serverActions: { allowedOrigins: ["localhost:3000", ...(process.env.SERVER_ACTIONS_ALLOWED_ORIGINS?.split(",") ?? [])] } },
  transpilePackages: ["@hemaya/ui", "@hemaya/auth", "@hemaya/supabase", "@hemaya/domain"],
};
export default nextConfig;
