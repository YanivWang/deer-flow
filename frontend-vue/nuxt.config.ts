/*
  【文件职责】     装配 Nuxt M0 工程、主题、路由和生产安全配置。
  【架构位置】     L3
  【主要导出】     Nuxt 配置
  【依赖关系】     消费 config/routes.ts
  【边界与注意】   不承载聊天或协议业务；代理规则只从 routes.ts 读取。
*/

import { readFileSync } from "node:fs";

import tailwindcss from "@tailwindcss/vite";
import { createThemeBootstrapScript } from "./app/core/theme/bootstrap";
import { csrRoutes } from "./config/routes";

const appPackageVersion = (
  JSON.parse(
    readFileSync(new URL("package.json", import.meta.url), "utf8"),
  ) as {
    version: string;
  }
).version;

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
  /*
    **只认 reka-ui 与 splitpanes。** 这个函数按「chunk 里**任意一个**模块 id 命中」
    贴标签，所以桶的种子选得越常见，标签就越不像话：原来这里还写着
    `lucide-vue-next|class-variance-authority|clsx|tailwind-merge`，
    而那四个几乎每个组件都 import——于是任何一个产品 chunk 只要碰过一个图标，
    就被叫成 `vendor-ui`。

    wave 66 实测（改之前）：`vendor-ui` 24 个 chunk 共 728,591 raw，
    而**最大的两个（320 KB / 192 KB）连一个 reka / lucide / cva / clsx 标记都没有**，
    全是产品代码。于是 `make asset-budget` 长期红着，而红的原因（728 KB > 380 KB）
    和它注释里写的原因（「Reka 的 dialog/dropdown 加 Select、Tabs、Switch……」）
    根本不是一回事——**一个测错了东西的门禁，比没有门禁更糟，因为它让人以为有东西在守。**

    去掉那四个之后，它们的字节落回默认命名（按 chunk 自己的名字），
    仍然计进整包天花板，只是不再冒充 UI 基础层。
    `tests/guards/chunk-buckets.test.ts` 钉住「每个 vendor-* chunk 里真的有它
    声称的那个包」。
  */
  if (/node_modules\/.+\/(?:reka-ui|splitpanes)/.test(ids)) {
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
      /*
        与 React 的根 layout metadata 逐字一致（frontend/src/app/layout.tsx）。
        Vue 此前一条都没设，`document.title` 是空字符串——浏览器标签、书签、
        窗口标题和读屏打开页面时的播报全都拿不到名字。只有 blog 与 docs 路由
        在 React 侧覆盖了标题，而那几条路由 Vue 还没有。
      */
      title: "DeerFlow",
      meta: [
        {
          name: "description",
          content: "A LangChain-based framework for building super agents.",
        },
      ],
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
      /*
        关于页显示的产品版本。与 React 的 `src/version.ts` 同一条判据：优先用
        构建期注入的 NUXT_PUBLIC_APP_VERSION（nightly CI 会写成
        `<base>-nightly.<日期>-<短 sha>`），否则回落到 package.json。
        用 `||` 而不是 `??` 是**有意**的：容器构建会把它设成空串，空串必须一起回落。
      */
      appVersion: process.env.NUXT_PUBLIC_APP_VERSION || appPackageVersion,
    },
  },
  nitro: { compressPublicAssets: true },
  typescript: { typeCheck: false },
});
