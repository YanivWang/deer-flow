import { defineVitestConfig } from "@nuxt/test-utils/config";

export default defineVitestConfig({
  test: {
    environment: "happy-dom",
    globals: true,
    restoreMocks: true,
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "~": new URL("./app", import.meta.url).pathname,
      "@": new URL("./app", import.meta.url).pathname,
    },
  },
});
