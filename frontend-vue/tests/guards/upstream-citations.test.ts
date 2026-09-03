/*
  【文件职责】     守住本仓写下的、对上游的 `文件:行号` 引用都还指得到东西。
  【架构位置】     门禁测试
  【主要导出】     无；Vitest cases
  【依赖关系】     本模块的源码/测试/文档注释 · ../frontend/{src,tests}（缺席则整组跳过）
  【边界与注意】   **这是本仓最容易被信、却从来没有被验过的一类记录。**
                   wave 45（线索 171）翻出 `ChatComposer.vue` 里一句「布局那几个类
                   （`min-h-10 flex-1`）」——那两个类在 wave 37 就被顺带去掉了，
                   注释却留在原地挂了八轮。wave 46 顺着往下查，发现 `app/**` 里
                   **有 136 处 `上游文件.tsx:行号` 形式的引用，一次都没有被验过**，
                   而抽验能看到行号漂了（`input-box.tsx:1328` 写的是 composerLocked，
                   实际在 1331）。

                   **这条守卫只钉能机械判的那一半**：被引的文件必须存在，行号必须
                   落在文件长度之内。**它不判「那一行是不是仍在说同一件事」**——
                   那要语义判断，钉进门禁只会变成一条随上游任何改动就红的噪声。
                   小幅漂移（几行）不影响读者找到目标；文件没了、行号越界才是
                   「照着找什么都找不到」。

                   同名文件（`hooks.ts` / `page.tsx` 在上游有多份）按**路径后缀**
                   先精确匹配；只写了 basename 时，只要有一个候选够长就算过——
                   再严就会把合法的简写判红。

                   `../frontend` 缺席时整组跳过：本模块的独立性不受影响
                   （与 scenario-coverage / standalone-check 的 DECLARED 同一条规矩）。

                   **wave 51 把范围从 `app/**` 推到整个模块。** wave 46 只扫了 `app/**`，
                   而同一形状的引用在 `tests/**` 里有 **90 处**、在 `BEHAVIOR_CONTRACTS.md`
                   里还有 1 处——**同一类记录，只因为换了个目录就一条都没人验**。
                   实测这 91 处当前全部指得到（越界 0、不存在 0），所以这次扩范围
                   **不改判据、只改覆盖面**：227 处一起看着。
                   扫描面直接取模块根，跳过 node_modules/.nuxt/.output/test-results/public
                   这些产物目录——按目录清单列举，下一个人加一个新顶层目录就会自动进来。
*/

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = fileURLToPath(new URL(".", import.meta.url));
const moduleRoot = join(here, "../..");

/** 产物与录制内容，不是本仓写下的记录。 */
const SKIPPED_DIRS = new Set([
  "node_modules",
  ".nuxt",
  ".output",
  ".data",
  "test-results",
  "playwright-report",
  "dist",
  "public",
]);
const upstreamRoots = [
  join(here, "../../../frontend/src"),
  join(here, "../../../frontend/tests"),
];
const upstreamPresent = upstreamRoots.some((root) => existsSync(root));

function walk(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (SKIPPED_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full, exts));
    } else if (exts.some((ext) => entry.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

const CITATION = /([A-Za-z0-9_\-./]+\.(?:tsx|ts))[:：](\d+)/g;

type Citation = { from: string; line: number; ref: string; target: number };

function collectCitations(): Citation[] {
  const found: Citation[] = [];
  for (const file of walk(moduleRoot, [".vue", ".ts", ".mts", ".mjs", ".md"])) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((text, index) => {
      for (const match of text.matchAll(CITATION)) {
        found.push({
          from: file.slice(moduleRoot.length + 1),
          line: index + 1,
          ref: match[1]!,
          target: Number(match[2]),
        });
      }
    });
  }
  return found;
}

function upstreamIndex(): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const root of upstreamRoots) {
    if (!existsSync(root)) continue;
    for (const file of walk(root, [".ts", ".tsx"])) {
      const name = file.slice(file.lastIndexOf("/") + 1);
      index.set(name, [...(index.get(name) ?? []), file]);
    }
  }
  return index;
}

describe.skipIf(!upstreamPresent)("本仓写下的上游引用", () => {
  const citations = collectCitations();
  const index = upstreamIndex();

  it("扫到了引用，也扫到了上游文件（两边空掉时不能假绿）", () => {
    // 少了这条，把正则写坏或把上游根写错都会让下面那条静默全绿。
    // 阈值按实测（227 处）留出余量，不是钉死的条数：这里要挡的是「扫成 0」。
    expect(citations.length).toBeGreaterThan(150);
    expect(index.size).toBeGreaterThan(50);
  });

  it("每条引用的文件都存在，行号都在文件长度之内", () => {
    const broken: string[] = [];
    for (const citation of citations) {
      const base = citation.ref.slice(citation.ref.lastIndexOf("/") + 1);
      const candidates = index.get(base) ?? [];
      const exact = candidates.filter((path) =>
        path.endsWith(citation.ref.replace(/^\.\//, "")),
      );
      const pool = exact.length ? exact : candidates;
      if (!pool.length) {
        broken.push(
          `${citation.from}:${citation.line} → ${citation.ref} 不存在`,
        );
        continue;
      }
      const fits = pool.some(
        (path) =>
          readFileSync(path, "utf8").split("\n").length >= citation.target,
      );
      if (!fits) {
        broken.push(
          `${citation.from}:${citation.line} → ${citation.ref}:${citation.target} 行号越界`,
        );
      }
    }
    expect(broken).toEqual([]);
  });
});
