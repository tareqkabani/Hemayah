/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: "/center",
  experimental: { serverActions: { allowedOrigins: ["localhost:3000", ...(process.env.SERVER_ACTIONS_ALLOWED_ORIGINS?.split(",") ?? [])] } },
  transpilePackages: ["@hemaya/ui", "@hemaya/auth", "@hemaya/supabase", "@hemaya/domain"],
  // مسار القرار القديم أُزيل (تحديث 15 يوليو) — من يقصده يُوجَّه لبوابة القرار الموحّدة
  // basePath:false كي تكون الوجهة حرفيّة خارج منطقة /center (منطقة /decision في الشاشة الموحّدة)
  // (basePath:false يجعل المصدر والوجهة حرفيّين — لذا المصدر مكتوب ببادئة /center الصريحة)
  async redirects() {
    return ["/center/decision", "/center/decision-lead", "/center/decision-vote", "/center/triage"].map((source) => ({
      source, destination: source === "/center/triage" ? "/triage" : "/decision", basePath: false, permanent: false,
    }));
  },
};
export default nextConfig;
