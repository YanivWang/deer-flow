/*
  【文件职责】     守住 `baseline/*.json` 里每个**不带 `$` 前缀**的顶层键都真的有人读。
  【架构位置】     门禁测试
  【主要导出】     无；Vitest cases
  【依赖关系】     baseline/*.json · app/** · scripts/** · tests/**
  【边界与注意】   **这条是线索 131 的一般化。** wave 29 发现
                   `parity-scenario-coverage.json` 的 `$pendingReasons` 挂了十几轮
                   没有任何消费者——删掉一条理由不会让任何门禁变红。当时是给那一个
                   键补了守卫；wave 48 发现同样的事又发生了一次：
                   `react-parity-scope.json` 的 `exemptModes` 声明了「静态整站模式
                   不欠」，**没有任何东西读它**（`product-surface.test.ts` 比的是路由，
                   而静态模式不是一条路由，是 env 开关下的分支——所以它天生没有
                   消费者，属于纯说明）。

                   于是本仓的约定被写死成一条可执行的判据：

                   - **`$` 开头 = 纯说明**，不参与任何判断，没人读是正常的；
                   - **不带 `$` = 真数据**，必须至少有一个 `.ts` / `.mjs` / `.vue`
                     读它，否则它就是一条「写了没人看」的声明——
                     **改错了不会有任何门禁变红**，而这正是它最危险的地方。

                   `exemptModes` 已按这条规矩改名成 `$exemptModes`（它确实是说明）。

                   **判据只钉顶层键**：深层字段的消费方式太多（解构、索引、
                   `Object.entries` 遍历），钉进去会变成噪声。顶层键是这些文件的
                   「目录」，写错一个整块就静默失效。
*/

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = fileURLToPath(new URL(".", import.meta.url));
const root = join(here, "../..");
const baselineDir = join(root, "baseline");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".nuxt" || entry === ".output") {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|mjs|vue)$/.test(entry)) out.push(full);
  }
  return out;
}

const sources = ["app", "scripts", "tests"].flatMap((dir) =>
  walk(join(root, dir)),
);

/*
  **先把注释剥掉再判「有没有人读」。** 不剥的话，一句提到这个键的注释就会把它算成
  被消费——本守卫自己的文件头就提到了 `exemptModes`，第一版因此对「把它改回没人读的
  名字」这条变异**假绿**（同线索 126：写进注释就会被算成有人用）。
*/
function stripComments(text: string): string {
  return text
    .replaceAll(/\/\*[\s\S]*?\*\//g, " ")
    .replaceAll(/<!--[\s\S]*?-->/g, " ")
    .replaceAll(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

const sourceText = sources.map((file) =>
  stripComments(readFileSync(file, "utf8")),
);

const baselines = readdirSync(baselineDir).filter((name) =>
  name.endsWith(".json"),
);

describe("baseline 数据文件的顶层键", () => {
  it("扫到了 baseline 文件与源码（两边空掉时不能假绿）", () => {
    expect(baselines.length).toBeGreaterThan(3);
    expect(sources.length).toBeGreaterThan(100);
  });

  it("每个不带 $ 前缀的顶层键都至少有一个消费者", () => {
    const orphans: string[] = [];
    for (const name of baselines) {
      const parsed: unknown = JSON.parse(
        readFileSync(join(baselineDir, name), "utf8"),
      );
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        continue;
      }
      for (const key of Object.keys(parsed)) {
        if (key.startsWith("$")) continue;
        const used = sourceText.some((text) => text.includes(key));
        if (!used) orphans.push(`${name} → ${key}`);
      }
    }
    expect(
      orphans,
      "这些键写了但没人读：要么接上消费者，要么加 $ 前缀声明它是纯说明",
    ).toEqual([]);
  });
});
