// الشاشة الموحّدة هي المنطقة الافتراضية والموجّه (Multi-Zones): كل البوّابات
// تُخدَم عبر منفذها الموحّد 3000 بمساراتها، وفي الإنتاج تُستبدل الوجهات بالنطاق الفعلي.
const zone = (env, fallback) => process.env[env] ?? fallback;

const ZONES = {
  "/seeker": zone("ZONE_SEEKER_URL", "http://localhost:3013"),
  "/center": zone("ZONE_CENTER_URL", "http://localhost:3002"),
  "/entities": zone("ZONE_ENTITIES_URL", "http://localhost:3006"),
  "/ag": zone("ZONE_AG_URL", "http://localhost:3007"),
  "/technical": zone("ZONE_TECHNICAL_URL", "http://localhost:3008"),
  "/health": zone("ZONE_HEALTH_URL", "http://localhost:3009"),
  "/hr": zone("ZONE_HR_URL", "http://localhost:3010"),
  "/interior": zone("ZONE_INTERIOR_URL", "http://localhost:3011"),
  "/security": zone("ZONE_SECURITY_URL", "http://localhost:3012"),
  "/decision": zone("ZONE_DECISION_URL", "http://localhost:3014"),
};
const API_URL = zone("ZONE_API_URL", "http://localhost:3020");

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@hemaya/supabase", "@hemaya/auth"],
  async rewrites() {
    return [
      ...Object.entries(ZONES).map(([path, origin]) => ({
        source: `${path}/:path*`,
        destination: `${origin}${path}/:path*`,
      })),
      { source: "/api/v1/:path*", destination: `${API_URL}/v1/:path*` },
    ];
  },
};
export default nextConfig;
