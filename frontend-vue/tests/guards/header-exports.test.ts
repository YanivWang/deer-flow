/*
  【文件职责】     钉住文件头 `【主要导出】` 里点名的符号，必须真的被这个文件导出。
  【架构位置】     门禁测试
  【主要导出】     无
  【依赖关系】     git ls-files（app / server / packages / scripts 下的 .ts/.mts/.mjs）
  【边界与注意】   **`【主要导出】` 此前零消费者。** 全模块 478 份文件写着它，
                   而只有 `【架构位置】` 有人读（`tests/architecture.test.ts` 的
                   L2 那一条）。wave 60 逐条量了一遍，七份文件点名的符号在
                   checkout 里只剩自己那一行——`provideChainOfThought` /
                   `confettiOrigin` / `updateFlickeringOpacities` /
                   `createFrameBuffer` / `SKILLS_CATALOG_QUERY_KEY` /
                   `probeAuthSession` / `isEditableEventTarget`。
                   七条**全都是写下那天就错的**（真名在同一个 diff 里、
                   多数就在错行下面三行），不是后来改名漂掉的。

                   **只钉一个方向：点名的必须存在。** 反过来「导出了却没写进头」
                   不钉——`主要`两个字就是说它是索引不是全集，钉全集会把
                   每加一个内部 helper 都变成改注释。

                   **只判「长得像标识符」的 token。** 头里混着散文
                   （`browser API helpers`、`list/get/create Agent`、`Nitro API route`），
                   判据取三种命名法：camelCase、多驼峰 PascalCase、带下划线的全大写。
                   全小写单词（helpers/errors/config）与纯首字母缩写（MCP/CLI/GET/API）
                   一律跳过——它们是散文，不是名字。实测：本模块 331 份
                   `.ts`/`.mts`/`.mjs`，261 份写了这一行，209 份点了至少一个名字，
                   共 502 个 token、**0 条豁免**；**豁免表为空，才说明收口选对了**
                   （线索 180）。

                   **`tests/` 有意不在范围里**：那边同一行写的是「被测对象是谁」
                   （`probeArtifactAction 回归`），不是「本文件导出什么」，
                   同一条规则套上去会产 14 条误报。wave 60 顺手逐条撞过，
                   那 12 个被测符号在 `app/` 里全都找得到——两种约定各自成立，
                   只是不能共用一条判据。

                   **形状先断言再计算**（线索 176）：扫不到文件、没有一个
                   token 能判、或者某份文件解析出零导出却点了名，都直接红——
                   一个算出来的 0 和一个没算的 0 长得一模一样。

                   **早年的 `【对应 frontend/】` 那一栏已经不存在了**——`fa2cde27`
                   写过，现在整个 checkout 里一处都没有。所以它不列进
                   HEADER_MARKERS：写进来既没有任何文件会用到，又会让
                   `make standalone-check`（P0 门禁）把这份守卫自己当成一处
                   跨应用引用。哪天要复活那一栏，连同这句一起改。
*/

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));

const MARKER = "【主要导出】";
const HEADER_MARKERS = [
  "【文件职责】",
  "【架构位置】",
  "【主要导出】",
  "【依赖关系】",
  "【边界与注意】",
];

const sourceFiles = execFileSync(
  "git",
  ["ls-files", "app", "server", "packages", "scripts"],
  { cwd: root, encoding: "utf8" },
)
  .split("\n")
  .filter((file) => /\.(ts|mts|mjs)$/.test(file));

/** `【主要导出】` 那一行加上它后面所有缩进续行，拼成一句。 */
function exportBlockOf(source: string): string | null {
  const lines = source.split("\n");
  const start = lines.findIndex((line) => line.includes(MARKER));
  if (start < 0) return null;
  const head = lines[start] as string;
  const parts = [head.slice(head.indexOf(MARKER) + MARKER.length)];
  for (const line of lines.slice(start + 1)) {
    if (HEADER_MARKERS.some((marker) => line.includes(marker))) break;
    if (/^\s*(\*\/|-->)/.test(line)) break;
    if (!line.trim()) break;
    if (!/^\s{4,}/.test(line)) break;
    parts.push(line);
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/*
  注释要先剥掉，否则头注释自己提到的名字会把被测对象救活——线索 174 里
  `baseline-keys-consumed` 的第一版就是这样假绿的。
*/
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function exportedNamesOf(source: string): Set<string> {
  const code = stripComments(source);
  const names = new Set<string>();
  const collect = (pattern: RegExp) => {
    for (const match of code.matchAll(pattern)) names.add(match[1] as string);
  };
  collect(
    /^\s*export\s+(?:declare\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/gm,
  );
  collect(
    /^\s*export\s+(?:declare\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/gm,
  );
  collect(
    /^\s*export\s+(?:declare\s+)?(?:interface|enum)\s+([A-Za-z_$][\w$]*)/gm,
  );
  collect(/^\s*export\s+(?:declare\s+)?type\s+([A-Za-z_$][\w$]*)\s*[=<]/gm);
  collect(
    /^\s*export\s+(?:declare\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm,
  );
  collect(
    /^\s*export\s+default\s+(?:async\s+)?(?:function\s*\*?|class)\s+([A-Za-z_$][\w$]*)/gm,
  );
  for (const match of code.matchAll(/^\s*export\s+(?:type\s+)?\{([^}]*)\}/gm)) {
    for (const piece of (match[1] as string).split(",")) {
      const token = piece.trim();
      if (!token) continue;
      const renamed = /\bas\s+([A-Za-z_$][\w$]*)\s*$/.exec(token);
      names.add(
        renamed ? (renamed[1] as string) : token.replace(/^type\s+/, "").trim(),
      );
    }
  }
  if (/^\s*export\s+default\b/m.test(code)) names.add("default");
  return names;
}

/** 三种命名法才算「点了一个名字」，其余按散文放过。 */
function looksLikeSymbol(token: string): boolean {
  return (
    /^[a-z][a-z0-9]*[A-Z]/.test(token) ||
    /^[A-Z][a-z0-9]+[A-Z]/.test(token) ||
    /^[A-Z][A-Z0-9]*_[A-Z0-9_]*$/.test(token)
  );
}

interface Declaration {
  file: string;
  block: string;
  tokens: string[];
  exported: Set<string>;
  reExports: boolean;
}

const declarations: Declaration[] = [];
for (const file of sourceFiles) {
  const source = readFileSync(`${root}${file}`, "utf8");
  const block = exportBlockOf(source);
  if (block === null) continue;
  const tokens = [
    ...new Set([...block.matchAll(/[A-Za-z_$][\w$]*/g)].map((m) => m[0])),
  ].filter(looksLikeSymbol);
  declarations.push({
    file,
    block,
    tokens,
    exported: exportedNamesOf(source),
    reExports: /^\s*export\s+\*/m.test(stripComments(source)),
  });
}

describe("文件头的【主要导出】", () => {
  it("扫到的文件与可判 token 都不是零（形状先断言再计算）", () => {
    expect(sourceFiles.length).toBeGreaterThan(300);
    expect(declarations.length).toBeGreaterThan(200);
    const named = declarations.filter((entry) => entry.tokens.length > 0);
    expect(named.length).toBeGreaterThan(150);
    expect(
      named.reduce((sum, entry) => sum + entry.tokens.length, 0),
    ).toBeGreaterThan(400);
  });

  it("点了名的文件必须真的解析出导出", () => {
    const silent = declarations
      .filter((entry) => entry.tokens.length > 0 && entry.exported.size === 0)
      .map((entry) => entry.file);
    expect(
      silent,
      "这些文件的头点了符号，却一个 export 都解析不出来——先修解析再谈比对",
    ).toEqual([]);
  });

  it("每个点名的符号都真的被这个文件导出", () => {
    const broken: string[] = [];
    for (const entry of declarations) {
      /*
        `export *` 的转出名要跨文件解析，当前模块里一个都没有（上面那条
        形状断言之外再兜一层）；真出现时先把这里补成解析，不要静默放过。
      */
      if (entry.reExports) continue;
      for (const token of entry.tokens) {
        if (!entry.exported.has(token)) {
          broken.push(
            `${entry.file}：【主要导出】点名了 ${token}，文件没有导出它`,
          );
        }
      }
    }
    expect(broken).toEqual([]);
  });

  it("当前没有任何文件靠 export * 绕过比对", () => {
    const starred = declarations
      .filter((entry) => entry.reExports && entry.tokens.length > 0)
      .map((entry) => entry.file);
    expect(
      starred,
      "有文件同时用 export * 且在头里点名——把上面那条 continue 改成真解析",
    ).toEqual([]);
  });
});
