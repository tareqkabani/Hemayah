/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: "/interior",
  transpilePackages: ["@hemaya/ui", "@hemaya/auth", "@hemaya/supabase", "@hemaya/domain"],
};
export default nextConfig;
