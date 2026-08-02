import { existsSync } from "node:fs";
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

// @ant-design-vue/nuxt rewrites dayjs/plugin/* to dayjs/esm/plugin/*, but
// dayjs publishes ESM plugins as plugin-name/index.js rather than plugin-name.js.
// Resolve the rewritten specifier to the published CJS file before that alias runs.
const dayjsPluginResolver = {
  name: "deerflow-dayjs-plugin-resolver",
  enforce: "pre" as const,
  resolveId(source: string) {
    const match = /^dayjs\/(?:esm\/)?plugin\/([^/]+?)(?:\.js)?$/.exec(source);
    if (!match) {
      return undefined;
    }

    const plugin = match[1];
    if (!plugin) {
      return undefined;
    }

    const pluginPath = dayjsPluginPath(plugin);
    return existsSync(pluginPath) ? pluginPath : undefined;
  },
};

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
    optimizeDeps: {
      // Mermaid's lazy Gantt chunk imports CJS dayjs plugins. The Ant Design
      // Nuxt module rewrites those imports during esbuild pre-bundling to
      // dayjs/esm/plugin/*.js, which is not a published dayjs file.
      exclude: ["mermaid"],
    },
    plugins: [dayjsPluginResolver],
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
