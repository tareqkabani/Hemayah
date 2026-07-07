import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // ثبّت جذر مساحة العمل على هذا المجلد (يوجد lockfile شارد في المجلد المنزليّ).
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
