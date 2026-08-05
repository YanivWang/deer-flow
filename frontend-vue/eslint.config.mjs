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

                   RETYPED 与机器生成的测试**继续受检**，只关掉三条与「保真搬运」
                   直接冲突的规则，逐条理由见下面的 override。关掉规则而不是豁免文件：
                   同一个文件里别的问题照报。
*/

import { readFileSync } from "node:fs";

import withNuxt from "./.nuxt/eslint.config.mjs";

const manifest = JSON.parse(
  readFileSync(new URL("baseline/core-manifest.json", import.meta.url), "utf8"),
);
const copied = manifest.files
  .filter((entry) => entry.class === "COPIED")
  .map((entry) => `app/core/${entry.source}`);
const retyped = manifest.files
  .filter((entry) => entry.class === "RETYPED")
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
  {
    // RETYPED 档：正文是上游的，只有声明过的那几处是我们改的
    // （改写清单在 scripts/land-retyped.mjs）。这里关掉的两条都是**风格**规则，
    // 报的位置全在我们没碰过的正文里；要消掉就得改上游逻辑，
    // 那正是 M1「语义保真」要避免的事。
    files: retyped,
    rules: {
      // `interface HumanMessageGroup extends GenericMessageGroup<"human"> {}`
      // ——给泛型实例化取名字的常见写法，messages/utils.ts 有 6 处。
      "@typescript-eslint/no-empty-object-type": "off",
      // `switch` 的 case 里声明 const（messages/utils.ts 的 image_url 分支）。
      // 上游 Next 预设不开这条，Nuxt 预设开。
      "no-case-declarations": "off",
    },
  },
  {
    // 机器生成的迁移测试（scripts/rstest-to-vitest.mjs 的产物）。
    files: ["tests/unit/core/**/*.test.ts"],
    rules: {
      // 上游把 `vi.mock(...)` 写在 import 之前——这不是笔误，是 vitest/jest 的
      // 提升语义要求的写法，9 个文件共 21 处。`import/first` 在这里是误报：
      // 按它说的挪到 import 之后，mock 就不生效了。
      "import/first": "off",
    },
  },
);
