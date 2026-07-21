// اختبارات وحدات بوابة القرار — بيئة jsdom لمكوّنات الحزمة
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["lib/**/*.test.{ts,tsx}", "components/**/*.test.{js,jsx}"],
  },
});
