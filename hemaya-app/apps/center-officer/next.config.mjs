/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: "/center",
  experimental: { serverActions: { allowedOrigins: ["localhost:3000", ...(process.env.SERVER_ACTIONS_ALLOWED_ORIGINS?.split(",") ?? [])] } },
  transpilePackages: ["@hemaya/ui", "@hemaya/recommendation", "@hemaya/auth", "@hemaya/supabase", "@hemaya/domain"],
  // مسارات أُزيلت وانتقلت وظائفها إلى بواباتها الموحّدة — من يقصدها يُوجَّه إليها:
  //   · القرار (15 يوليو) → منطقة /decision
  //   · الفرز            → منطقة /triage
  //   · الدراسة والتقييم (نسخة 7 يوليو، تجاوزتها @hemaya/study-eval في 19 يوليو)
  //     → منطقتا /studier و/evaluator
  // basePath:false كي تكون الوجهة حرفيّة خارج منطقة /center (منطقة /decision في الشاشة الموحّدة)
  // (basePath:false يجعل المصدر والوجهة حرفيّين — لذا المصدر مكتوب ببادئة /center الصريحة)
  async redirects() {
    const MOVED = {
      "/center/decision": "/decision", "/center/decision-lead": "/decision",
      "/center/decision-vote": "/decision", "/center/triage": "/triage",
      "/center/study": "/studier", "/center/assessment": "/evaluator",
    };
    return Object.entries(MOVED).map(([source, destination]) => ({
      source, destination, basePath: false, permanent: false,
    }));
  },
};
export default nextConfig;
