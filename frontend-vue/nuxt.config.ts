/*
  【文件职责】     装配 Nuxt M0 工程、主题、路由和生产安全配置。
  【架构位置】     L3
  【主要导出】     Nuxt 配置
  【依赖关系】     消费 config/routes.ts
  【边界与注意】   不承载聊天或协议业务；代理规则只从 routes.ts 读取。
*/

import tailwindcss from "@tailwindcss/vite";
import { createThemeBootstrapScript } from "./app/core/theme/bootstrap";
import { csrRoutes } from "./config/routes";

type ClientChunk = { moduleIds: string[]; name: string };

function clientChunkFileName(chunk: ClientChunk) {
  const ids = chunk.moduleIds.join("\n");
  /*
    CodeMirror 必须排在 markdown 之前。`@codemirror/lang-markdown` 依赖
    `@lezer/markdown`，它的路径里带着字面量 `/markdown/`——按原来的顺序，
    整个语法高亮 chunk 会被命名成 vendor-markdown，同时污染两边的预算。
  */
  if (/(?:codemirror|@codemirror)/.test(ids)) {
    return "_nuxt/vendor-codemirror-[hash].js";
  }
  if (
    /(?:StreamMarkdown|\/markdown\/|node_modules\/.+\/(?:hast|mdast|unified|unist-util|remark-|rehype-|marked|remend|katex))/.test(
      ids,
    )
  ) {
    return "_nuxt/vendor-markdown-[hash].js";
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
    /node_modules\/.+\/(?:@vue|vue|vue-router|@tanstack\/vue-query)/.test(ids)
  ) {
    return "_nuxt/vendor-vue-[hash].js";
  }
  return `_nuxt/${chunk.name}-[hash].js`;
}

export default defineNuxtConfig({
  compatibilityDate: "2026-08-03",
  modules: ["shadcn-nuxt", "@nuxt/eslint"],
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
