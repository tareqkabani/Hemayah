/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: "/seeker",
  transpilePackages: ["@hemaya/ui", "@hemaya/auth", "@hemaya/supabase", "@hemaya/domain"],
};
export default nextConfig;
