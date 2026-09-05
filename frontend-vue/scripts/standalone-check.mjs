#!/usr/bin/env node
/*
  【文件职责】     验收判据：frontend-vue 必须能在 ../frontend 不存在时完成
                   install / build / test / e2e。本脚本静态证明「没有任何跨应用引用」。
  【架构位置】     构建脚本
  【主要导出】     CLI：默认 --check；--json 输出机器可读记分牌
  【依赖关系】     git（已跟踪 + 未忽略的未跟踪文件）；无运行时依赖
  【边界与注意】   BLOCKING 计数必须归零才算平替达成。COMMENT / DOCS 计数不阻断构建，
                   但会一起打印，避免「注释里还写着对应哪个 React 文件」被当成已经解耦。

                   **这一条只是静态证明。** 它证的是「没有代码级跨应用引用」，
                   证不了「兄弟应用真的移走之后还能跑」——wave 83 真做了一次实验，
                   BLOCKING 早已是 0，而 `make verify` 当场红（见
                   scripts/lib/cross-app-by-design.mjs 的文件头）。
                   动态那一半是 `make standalone-sim`。
*/

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { CROSS_APP_BY_DESIGN } from "./lib/cross-app-by-design.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

/** 匹配兄弟应用 `frontend/`，但不匹配本应用 `frontend-vue/`。 */
const SIBLING = /frontend(?!-vue)[/\\]/;
const SIBLING_G = /frontend(?!-vue)[/\\]/g;

/** 生成物：随其来源一起消失，不单独计数。 */
const GENERATED = new Set(["pnpm-lock.yaml"]);

const COMMENT_STYLES = {
  ".ts": ["line", "block"],
  ".mts": ["line", "block"],
  ".mjs": ["line", "block"],
  ".js": ["line", "block"],
  ".vue": ["line", "block", "html"],
  ".css": ["block"],
  ".json": [],
  ".yaml": ["hash"],
  ".yml": ["hash"],
  ".sh": ["hash"],
  ".py": ["hash"],
  ".md": [],
};

function commentStylesFor(file) {
  if (file === "Makefile") return ["hash"];
  if (file === "Dockerfile" || file.startsWith("Dockerfile.")) return ["hash"];
  return COMMENT_STYLES[extname(file)] ?? ["line", "block"];
}

/**
 * 把注释内容替换成空格，保留行号与列宽。
 * 这样同一次扫描既能判定「这行还有代码级引用吗」，又能定位原始行。
 */
function stripComments(source, styles) {
  const out = source.split("");
  const has = (style) => styles.includes(style);
  let i = 0;
  let state = "code";
  let quote = "";
  const blank = (from, to) => {
    for (let k = from; k < to && k < out.length; k += 1) {
      if (out[k] !== "\n") out[k] = " ";
    }
  };
  while (i < source.length) {
    const two = source.slice(i, i + 2);
    const four = source.slice(i, i + 4);
    if (state === "code") {
      const ch = source[i];
      if (ch === '"' || ch === "'" || ch === "`") {
        quote = ch;
        state = "string";
        i += 1;
        continue;
      }
      if (has("block") && two === "/*") {
        const end = source.indexOf("*/", i + 2);
        const stop = end === -1 ? source.length : end + 2;
        blank(i, stop);
        i = stop;
        continue;
      }
      if (has("html") && four === "<!--") {
        const end = source.indexOf("-->", i + 4);
        const stop = end === -1 ? source.length : end + 3;
        blank(i, stop);
        i = stop;
        continue;
      }
      if (has("line") && two === "//") {
        const end = source.indexOf("\n", i);
        const stop = end === -1 ? source.length : end;
        blank(i, stop);
        i = stop;
        continue;
      }
      if (has("hash") && ch === "#") {
        const end = source.indexOf("\n", i);
        const stop = end === -1 ? source.length : end;
        blank(i, stop);
        i = stop;
        continue;
      }
      i += 1;
      continue;
    }
    // state === "string"
    if (source[i] === "\\") {
      i += 2;
      continue;
    }
    if (source[i] === quote) {
      state = "code";
      quote = "";
    }
    i += 1;
  }
  return out.join("");
}

/**
 * 已跟踪的文件**加上**未跟踪且未被忽略的文件。
 *
 * 只看 `git ls-files` 会留下一个盲区：新写的文件在提交前是不可见的，于是
 * 「这次改动引入了跨应用引用」要等提交之后才暴露——本脚本自己就踩过一次。
 */
function scannedFiles() {
  return execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard"],
    { cwd: ROOT, encoding: "utf8" },
  )
    .split("\n")
    .filter(Boolean);
}

function readSafe(path) {
  try {
    const buffer = readFileSync(path);
    if (buffer.includes(0)) return null; // 二进制
    return buffer.toString("utf8");
  } catch {
    return null;
  }
}

const blocking = [];
const comments = [];
const docs = [];
const declared = [];

for (const file of scannedFiles()) {
  if (GENERATED.has(file)) continue;
  const source = readSafe(join(ROOT, file));
  if (source === null || !SIBLING.test(source)) continue;

  const isDoc = extname(file) === ".md";
  const stripped = isDoc ? "" : stripComments(source, commentStylesFor(file));
  const strippedLines = stripped.split("\n");

  source.split("\n").forEach((line, index) => {
    if (!SIBLING.test(line)) return;
    const hits = (line.match(SIBLING_G) ?? []).length;
    const codeLine = strippedLines[index] ?? "";
    const codeHits = (codeLine.match(SIBLING_G) ?? []).length;
    const entry = { file, line: index + 1, text: line.trim().slice(0, 160) };
    if (isDoc) {
      docs.push({ ...entry, hits });
      return;
    }
    if (codeHits > 0) {
      if (file in CROSS_APP_BY_DESIGN)
        declared.push({ ...entry, hits: codeHits });
      else blocking.push({ ...entry, hits: codeHits });
    }
    if (hits - codeHits > 0) comments.push({ ...entry, hits: hits - codeHits });
  });
}

const byFile = (rows) => {
  const map = new Map();
  for (const row of rows)
    map.set(row.file, (map.get(row.file) ?? 0) + row.hits);
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
};

if (process.argv.includes("--json")) {
  console.log(
    JSON.stringify(
      {
        blocking: blocking.length,
        blockingFiles: byFile(blocking).length,
        comment: comments.length,
        docs: docs.length,
        declared: declared.length,
        rows: blocking,
      },
      null,
      2,
    ),
  );
} else {
  console.log(
    "frontend-vue 独立性检查（判据：移走 ../frontend 后仍可 install/build/test/e2e）",
  );
  console.log("");
  console.log(
    `  BLOCKING 代码级跨应用引用 : ${blocking.length} 处 / ${byFile(blocking).length} 个文件`,
  );
  console.log(`  COMMENT  注释级引用       : ${comments.length} 处（不阻断）`);
  console.log(`  DOCS     文档级引用       : ${docs.length} 处（不阻断）`);
  console.log(
    `  DECLARED 声明的对照工具   : ${declared.length} 处 / ${Object.keys(CROSS_APP_BY_DESIGN).length} 个文件`,
  );
  for (const [file, { note }] of Object.entries(CROSS_APP_BY_DESIGN)) {
    console.log(`             ${file}\n               ${note}`);
  }
  if (blocking.length > 0) {
    console.log("");
    console.log("BLOCKING 明细：");
    for (const [file, count] of byFile(blocking)) {
      console.log(`  ${String(count).padStart(3)}  ${file}`);
    }
    console.log("");
    console.log("逐行：");
    for (const row of blocking) {
      console.log(`  ${row.file}:${row.line}  ${row.text}`);
    }
  }
}

process.exitCode = blocking.length > 0 ? 1 : 0;
