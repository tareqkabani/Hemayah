/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: "/decision",
  transpilePackages: ["@hemaya/ui", "@hemaya/auth", "@hemaya/supabase", "@hemaya/domain"],
};
export default nextConfig;
