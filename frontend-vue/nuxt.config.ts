/*
  【文件职责】     装配 Nuxt M0 工程、主题、路由和生产安全配置。
  【对应 frontend/】 frontend/next.config.js
  【架构位置】     L3
  【主要导出】     Nuxt 配置
  【依赖关系】     消费 config/routes.ts
  【边界与注意】   不承载聊天或协议业务；代理规则只从 routes.ts 读取。
*/

import tailwindcss from "@tailwindcss/vite";
import { csrRoutes, prerenderRoutes } from "./config/routes";

export default defineNuxtConfig({
  compatibilityDate: "2026-08-03",
  modules: ["shadcn-nuxt", "@nuxtjs/color-mode", "@nuxt/eslint"],
  css: ["~/assets/css/main.css", "splitpanes/dist/splitpanes.css"],
  vite: { plugins: [tailwindcss()] },
  components: { dirs: [] },
  colorMode: { classSuffix: "" },
  shadcn: { prefix: "", componentDir: "./app/components/ui" },
  devServer: { port: 3100 },
  routeRules: {
    ...Object.fromEntries(csrRoutes.map((route) => [route, { ssr: false }])),
    ...Object.fromEntries(
      prerenderRoutes.map((route) => [route, { prerender: true }]),
    ),
  },
  runtimeConfig: {
    gatewayInternalBaseUrl:
      process.env.DEER_FLOW_INTERNAL_GATEWAY_BASE_URL ??
      "http://127.0.0.1:8001",
    public: {
      langgraphBaseUrl: "",
      backendBaseUrl: "",
      authDisabled: "",
      m0TestPages: "",
    },
  },
  nitro: { compressPublicAssets: true },
  typescript: { typeCheck: false },
});
