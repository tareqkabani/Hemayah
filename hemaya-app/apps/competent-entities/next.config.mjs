/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: "/entities",
  transpilePackages: ["@hemaya/ui", "@hemaya/auth", "@hemaya/supabase", "@hemaya/domain"],
};
export default nextConfig;
