/*
  【文件职责】     定义 Vue/Nuxt 源码静态检查规则。
  【对应 frontend/】 frontend/eslint.config.mjs
  【架构位置】     工程底座
  【主要导出】     ESLint flat config
  【依赖关系】     由 make lint 消费；忽略清单读 baseline/core-manifest.json
  【边界与注意】   不关闭 TypeScript 或 Vue 的核心规则。
                   唯一的例外是 app/core/ 里的 COPIED 档：它们必须逐字节等同上游，
                   而 eslint 实测对其中 4 个文件报 5 处（no-empty、import/first…）。
                   这些是上游的写法，我们**不能**改——改了护城河就没了。
                   清单直接从 manifest 推出，不手写：文件降级出 COPIED 就自动恢复受检。
                   同一份清单在 .prettierignore 里由 `make land-copied` 生成。
                   ignores 必须**单独成一个 config 对象**才是全局忽略；
                   和 rules 写在同一个对象里只会把该对象自己的规则排除掉，
                   其余规则照跑（实测：合写时 app/core 仍报 5 处）。
*/

import { readFileSync } from "node:fs";

import withNuxt from "./.nuxt/eslint.config.mjs";

const manifest = JSON.parse(
  readFileSync(new URL("baseline/core-manifest.json", import.meta.url), "utf8"),
);
const copied = manifest.files
  .filter((entry) => entry.class === "COPIED")
  .map((entry) => `app/core/${entry.source}`);

export default withNuxt(
  {
    ignores: [
      ".nuxt/**",
      ".output/**",
      "playwright-report/**",
      "test-results/**",
      ...copied,
    ],
  },
  {
    rules: {
      "vue/multi-word-component-names": "off",
    },
  },
);
