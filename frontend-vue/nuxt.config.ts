/*
  【文件职责】     装配 Nuxt M0 工程、主题、路由和生产安全配置。
  【对应 frontend/】 frontend/next.config.js
  【架构位置】     L3
  【主要导出】     Nuxt 配置
  【依赖关系】     消费 config/routes.ts
  【边界与注意】   不承载聊天或协议业务；代理规则只从 routes.ts 读取。
*/

import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { createThemeBootstrapScript } from "./app/core/theme/bootstrap";
import { csrRoutes, prerenderRoutes } from "./config/routes";

type ClientChunk = { moduleIds: string[]; name: string };

function clientChunkFileName(chunk: ClientChunk) {
  const ids = chunk.moduleIds.join("\n");
  if (
    /(?:StreamMarkdown|\/markdown\/|node_modules\/.+\/(?:hast|mdast|unified|unist-util|remark-|rehype-|marked|remend|katex))/.test(
      ids,
    )
  ) {
    return "_nuxt/vendor-markdown-[hash].js";
  }
  if (/(?:codemirror|@codemirror)/.test(ids)) {
    return "_nuxt/vendor-codemirror-[hash].js";
  }
  if (/\/app\/core\/i18n\//.test(ids)) {
    return "_nuxt/vendor-i18n-[hash].js";
  }
  if (
    /node_modules\/.+\/(?:reka-ui|lucide-vue-next|class-variance-authority|clsx|tailwind-merge|splitpanes)/.test(
      ids,
    )
  ) {
    return "_nuxt/vendor-ui-[hash].js";
  }
  if (
    /node_modules\/.+\/(?:@vue|vue|vue-router|pinia|@pinia|@tanstack\/vue-query)/.test(
      ids,
    )
  ) {
    return "_nuxt/vendor-vue-[hash].js";
  }
  return `_nuxt/${chunk.name}-[hash].js`;
}

export default defineNuxtConfig({
  compatibilityDate: "2026-08-03",
  modules: ["shadcn-nuxt", "@nuxt/eslint", "@pinia/nuxt"],
  app: {
    head: {
      script: [
        {
          key: "deerflow-theme-bootstrap",
          innerHTML: createThemeBootstrapScript(),
        },
      ],
    },
  },
  css: ["~/assets/css/main.css", "splitpanes/dist/splitpanes.css"],
  vite: { plugins: [tailwindcss()] },
  hooks: {
    "vite:extendConfig"(config, { isClient }) {
      if (!isClient) return;
      if (!config.build) return;
      config.build.rolldownOptions ??= {};
      const output = config.build.rolldownOptions.output;
      if (Array.isArray(output)) {
        for (const item of output) item.chunkFileNames = clientChunkFileName;
      } else {
        config.build.rolldownOptions.output = {
          ...output,
          chunkFileNames: clientChunkFileName,
        };
      }
    },
  },
  components: { dirs: [] },
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
  nitro: {
    compressPublicAssets: true,
    publicAssets: [
      {
        dir: fileURLToPath(new URL("../frontend/public/demo", import.meta.url)),
        baseURL: "/demo",
      },
      {
        dir: fileURLToPath(
          new URL("../frontend/public/images", import.meta.url),
        ),
        baseURL: "/images",
      },
    ],
  },
  typescript: { typeCheck: false },
});
