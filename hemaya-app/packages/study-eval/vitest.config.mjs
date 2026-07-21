// اختبارات وحدات بوابتي الدارس والمقيّم — بيئة jsdom لاختبار المكوّنات
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{js,jsx}"],
  },
});
