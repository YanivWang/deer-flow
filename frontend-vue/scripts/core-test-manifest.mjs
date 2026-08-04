#!/usr/bin/env node
/*
  【文件职责】     把 frontend/tests/unit/core 的 83 个测试分成 M1 子集与后续里程碑，
                   并量出 rstest→vitest codemod 的表面积。
  【对应 frontend/】 无（工具链）
  【架构位置】     构建脚本
  【主要导出】     CLI：--refresh 重建；默认 --check 校验未过期
  【依赖关系】     scripts/lib/source-facts.mjs、baseline/core-manifest.json
  【边界与注意】   不能只看扩展名。7 个 .test.ts（非 .tsx）同样耦合 React 生态，
                   靠 import 判定而不是文件名。分类结果用于与 collected-test 报告对账：
                   「某些测试暂时不收集」不算 M1 通过。
*/

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  collectFacts,
  listBaselineFiles,
  readBaselineFile,
  resolveCommit,
} from "./lib/source-facts.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TEST_PREFIX = "frontend/tests/unit/core";

/** 值导入这些包 = 测试要跑 React 运行时，Nuxt 侧没有等价物。 */
const REACT_TEST_RUNTIME = [
  /^react$/,
  /^react\//,
  /^react-dom$/,
  /^react-dom\//,
  /^@testing-library\//,
  /^@tanstack\/react-query$/,
  /^@langchain\/langgraph-sdk\/react$/,
  /^sonner$/,
  /^streamdown$/,
  /^@streamdown\//,
];

/** 需要 DOM 环境但不需要 React：happy-dom 就能跑，仍属 M1。 */
const DOM_GLOBALS =
  /\b(document|window|IntersectionObserver|ResizeObserver|MutationObserver|localStorage|sessionStorage|navigator)\b/;

function classifyTest(facts, text, coreClassOf) {
  const reasons = [];
  let bucket = "M1";

  const demote = (next) => {
    const order = { M1: 0, M1_DOM: 1, DEFERRED: 2 };
    if (order[next] > order[bucket]) bucket = next;
  };

  if (facts.isTsx) {
    demote("DEFERRED");
    reasons.push({
      code: "jsx",
      detail: ".tsx 测试渲染 React 组件。",
    });
  }

  // 目标模块：测试导入的 @/core/* 落在哪个源文件上。
  const targets = [];
  for (const imp of facts.imports) {
    const { specifier, typeOnly } = imp;

    if (specifier.startsWith("@/core/")) {
      const rel = specifier.slice("@/core/".length);
      const hit = [rel, `${rel}.ts`, `${rel}.tsx`, `${rel}/index.ts`].find(
        (c) => coreClassOf.has(c),
      );
      if (hit) targets.push({ source: hit, class: coreClassOf.get(hit) });
      continue;
    }

    if (REACT_TEST_RUNTIME.some((re) => re.test(specifier))) {
      if (typeOnly) continue; // 只借类型：换自写类型即可，不阻塞
      demote("DEFERRED");
      reasons.push({
        code: "react-runtime",
        detail: `值导入 "${specifier}"：测试依赖 React 运行时。`,
      });
    }
  }

  for (const target of targets) {
    if (target.class === "REWRITE" || target.class === "DROPPED") {
      demote("DEFERRED");
      reasons.push({
        code: `target-${target.class.toLowerCase()}`,
        detail: `被测模块 ${target.source} 分类为 ${target.class}，随该模块一起推迟。`,
      });
    }
  }

  if (bucket !== "DEFERRED" && DOM_GLOBALS.test(text)) {
    demote("M1_DOM");
    reasons.push({
      code: "dom-env",
      detail: "使用 DOM 全局但不依赖 React；happy-dom 环境即可运行。",
    });
  }

  if (bucket === "M1" && !reasons.length) {
    reasons.push({ code: "pure-node", detail: "纯 node 环境可运行。" });
  }

  // rstest → vitest codemod 表面积
  const rsApis = [...text.matchAll(/\brs\.(\w+)/g)].map((m) => m[1]);
  const codemod = {
    fromRstest: facts.imports.some((i) => i.specifier === "@rstest/core"),
    rsApis: [...new Set(rsApis)].sort(),
  };

  return { bucket, reasons, targets, codemod };
}

function build(commit) {
  const manifest = JSON.parse(
    readFileSync(join(ROOT, "baseline/core-manifest.json"), "utf8"),
  );
  const coreClassOf = new Map(manifest.files.map((f) => [f.source, f.class]));

  const paths = listBaselineFiles(commit, TEST_PREFIX).filter((p) =>
    /\.test\.tsx?$/.test(p),
  );

  const entries = paths.map((path) => {
    const buffer = readBaselineFile(commit, path);
    const facts = collectFacts(path, buffer);
    const text = buffer.toString("utf8");
    const rel = path.slice(`${TEST_PREFIX}/`.length);
    const verdict = classifyTest(facts, text, coreClassOf);

    return {
      source: rel,
      bucket: verdict.bucket,
      sha256: facts.sha256,
      lines: facts.lines,
      reasons: verdict.reasons,
      targets: verdict.targets,
      codemod: verdict.codemod,
    };
  });

  return { commit, entries, coreManifestCommit: manifest.baselineCommit };
}

function summarize(entries) {
  const counts = {};
  for (const e of entries) counts[e.bucket] = (counts[e.bucket] ?? 0) + 1;
  return counts;
}

function render({ commit, entries, coreManifestCommit }) {
  const rsApis = new Set();
  for (const e of entries) for (const api of e.codemod.rsApis) rsApis.add(api);
  return `${JSON.stringify(
    {
      $comment:
        "由 scripts/core-test-manifest.mjs 生成，勿手改。重建：make baseline-refresh",
      baselineCommit: commit,
      coreManifestCommit,
      sourceRoot: TEST_PREFIX,
      totals: {
        files: entries.length,
        buckets: summarize(entries),
        rstestApisToPort: [...rsApis].sort(),
      },
      files: entries,
    },
    null,
    2,
  )}\n`;
}

function main() {
  const args = process.argv.slice(2);
  const refresh = args.includes("--refresh");
  const baselineArg = args.find((a) => a.startsWith("--baseline="));
  const commit = resolveCommit(
    baselineArg ? baselineArg.split("=")[1] : "HEAD",
  );

  const built = build(commit);
  const outPath = join(ROOT, "baseline/core-test-manifest.json");
  const rendered = render(built);

  if (refresh) {
    mkdirSync(join(ROOT, "baseline"), { recursive: true });
    writeFileSync(outPath, rendered);
    const counts = summarize(built.entries);
    process.stdout.write(`${built.entries.length} tests\n`);
    for (const key of ["M1", "M1_DOM", "DEFERRED"]) {
      process.stdout.write(
        `  ${key.padEnd(9)} ${String(counts[key] ?? 0).padStart(3)}\n`,
      );
    }
    return;
  }

  let actual = null;
  try {
    actual = readFileSync(outPath, "utf8");
  } catch {
    /* 缺文件按过期处理 */
  }
  if (actual !== rendered) {
    process.stderr.write(`过期：${outPath}\n`);
    process.stderr.write("运行 `make baseline-refresh` 重建。\n");
    process.exit(1);
  }
  process.stdout.write(`测试台账与 ${commit} 一致\n`);
}

main();
