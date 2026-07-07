/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@hemaya/ui", "@hemaya/auth", "@hemaya/supabase", "@hemaya/domain"],
};
export default nextConfig;
