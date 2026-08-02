import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineNuxtConfig } from "nuxt/config";

import { csrRouteRules, prerenderRoutes, swrRouteRules } from "./config/routes";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const gatewayUrl =
  process.env.DEER_FLOW_INTERNAL_GATEWAY_BASE_URL ??
  process.env.NUXT_GATEWAY_URL ??
  "http://127.0.0.1:8001";
const dayjsPluginPath = (plugin: string) =>
  resolve(projectRoot, "node_modules/dayjs/plugin", `${plugin}.js`);

export default defineNuxtConfig({
  compatibilityDate: "2026-07-31",
  devtools: { enabled: true },
  modules: ["@pinia/nuxt", "@ant-design-vue/nuxt", "@nuxt/eslint"],
  components: [{ path: "~/components", pathPrefix: false }],
  css: ["~/assets/styles/main.scss"],
  runtimeConfig: {
    gatewayUrl,
    public: {
      backendBaseUrl: "",
      langgraphBaseUrl: "",
    },
  },
  antd: {
    extractStyle: true,
  },
  typescript: {
    strict: true,
    typeCheck: true,
  },
  vite: {
    resolve: {
      alias: {
        "dayjs/esm/plugin/advancedFormat.js": dayjsPluginPath("advancedFormat"),
        "dayjs/esm/plugin/customParseFormat.js": dayjsPluginPath("customParseFormat"),
        "dayjs/esm/plugin/duration.js": dayjsPluginPath("duration"),
        "dayjs/esm/plugin/isoWeek.js": dayjsPluginPath("isoWeek"),
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: '@use "~/assets/styles/tokens/variables" as *;',
        },
      },
    },
  },
  routeRules: {
    ...Object.fromEntries(prerenderRoutes.map((route) => [route, { prerender: true }])),
    ...Object.fromEntries(swrRouteRules.map((route) => [route, { swr: 3600 }])),
    ...Object.fromEntries(csrRouteRules.map((route) => [route, { ssr: false }])),
    "/api/langgraph/**": {
      proxy: `${gatewayUrl}/api/**`,
    },
    "/api/**": {
      proxy: `${gatewayUrl}/api/**`,
    },
  },
});
