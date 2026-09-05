/*
  【文件职责】     列出「当前 checkout 里真实存在的文件」，供各扫描器当作扫描面。
  【架构位置】     构建脚本共享库
  【主要导出】     checkoutFiles
  【依赖关系】     git
  【边界与注意】   **已跟踪 + 未跟踪且未被忽略，两半都要。** 只看 `git ls-files`
                   会留下一个盲区：**新写的文件在提交之前是不可见的**，于是
                   「这次改动引入了一处违规」要等提交之后才暴露——而门禁最该
                   拦住它的时刻恰恰在提交之前。

                   这条 `scripts/standalone-check.mjs` 早在自己身上踩过一次并修好了，
                   但同一个盲区在 `tests/architecture.test.ts`（L2 边界）与
                   `tests/guards/file-header-claims.test.ts`（两处）里一直开着——
                   **一条已经被诊断过的坑，在另一个文件里照样是新的**。
                   抽成一份是为了让下一个扫描器不必再想一遍。

                   **返回前按磁盘上是否真的存在过滤一遍**：`--cached` 会列出
                   已删除但还没 stage 的文件，调用方直接 `readFileSync` 会 ENOENT，
                   而那个错和「扫描器坏了」长得一模一样。
*/

import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * @param {string[]} pathspecs 传给 git 的路径限定（目录或 glob）；空数组表示整个仓库。
 * @param {{ cwd: string }} options `cwd` 是扫描面的根，返回的路径相对它。
 * @returns {string[]} 去重并排好序的相对路径。
 */
export function checkoutFiles(pathspecs, { cwd }) {
  const listed = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", ...pathspecs],
    { cwd, encoding: "utf8" },
  )
    .split("\n")
    .filter(Boolean);
  return [...new Set(listed)]
    .filter((file) => {
      const absolute = join(cwd, file);
      return existsSync(absolute) && statSync(absolute).isFile();
    })
    .sort();
}
