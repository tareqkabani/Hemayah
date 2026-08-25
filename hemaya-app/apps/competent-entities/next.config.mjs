/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: "/entities",
  experimental: { serverActions: { allowedOrigins: [...(process.env.NODE_ENV !== "production" ? ["localhost:3000"] : []), ...(process.env.SERVER_ACTIONS_ALLOWED_ORIGINS?.split(",") ?? [])] } },
  transpilePackages: ["@hemaya/ui", "@hemaya/recommendation", "@hemaya/auth", "@hemaya/supabase", "@hemaya/domain"],
};
export default nextConfig;
