#!/usr/bin/env node
/*
  【文件职责】     把 frontend/src/core 的每个文件机械分类为 COPIED / RETYPED / REWRITE / DROPPED，
                   并产出 COPIED 档的 SHA-256 baseline。
  【对应 frontend/】 无（工具链）
  【架构位置】     构建脚本
  【主要导出】     CLI：--refresh 重建台账；默认 --check 校验台账未过期
  【依赖关系】     scripts/lib/source-facts.mjs；产物 baseline/core-manifest.json、baseline/core-sha256.json
  【边界与注意】   分类结果必须由规则推出，不手写清单。唯一的人工输入是下面的
                   DROP_POLICY——计划里明确点名不迁的文件，每条都带理由。
                   本脚本读 git 对象而不是工作树：baseline 锚在 commit 上才有护城河意义。
*/

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  collectFacts,
  listBaselineFiles,
  packageNameOf,
  readBaselineFile,
  resolveCommit,
} from "./lib/source-facts.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_PREFIX = "frontend/src/core";

// ---------------------------------------------------------------------------
// 人工输入 1/1：计划明确点名不迁的文件。其余文件的分类全部由下面的规则推出。
// 出处：06-migration-plan.md §M1 1a/1b/1e、01-scope.md。
// ---------------------------------------------------------------------------
const DROP_POLICY = {
  "static-mode.ts": "静态/mock 模式分支，01-scope 已排除出迁移范围。",
  "threads/static-demo.ts": "静态 demo 数据源，随 static-mode 一起排除。",
  "auth/gateway-config.ts":
    "纯服务端文件；ssr:false + 删掉 server auth 后无消费方（06 §M1 1a）。",
  "blog/index.ts": "nextra 博客装配，不属于 workspace 应用范围。",
};

// ---------------------------------------------------------------------------
// import 分类规则
// ---------------------------------------------------------------------------
const rx = (...patterns) => patterns.map((p) => new RegExp(p));

/** 值导入即运行时依赖 React；这些包没有可直接替换的 Vue 同名实现。 */
const REACT_RUNTIME = rx(
  "^react$",
  "^react/",
  "^react-dom$",
  "^react-dom/",
  "^@tanstack/react-query$",
  "^@langchain/langgraph-sdk/react$",
  "^@xyflow/react$",
  "^@uiw/react-",
  "^sonner$",
  "^streamdown$",
  "^@streamdown/",
  "^@testing-library/react$",
);

/** Next.js 框架专属；Nuxt 侧没有对应物，且 ssr:false 下多数无消费方。 */
const NEXT_ONLY = rx("^next$", "^next/", "^nextra$", "^nextra/");

/** 只改 import specifier 就能过的重定向。目标已实测存在同名导出。 */
const SPECIFIER_REWRITES = [
  {
    match: /^@langchain\/langgraph-sdk(\/.*)?$/,
    to: "@/core/types/message",
    code: "retype-langgraph-sdk",
    detail: "SDK 类型改指向自写 @/core/types/message（06 §M1 1b 的 17 个）。",
  },
  {
    match: /^lucide-react$/,
    to: "lucide-vue-next",
    code: "retype-lucide",
    detail:
      "图标包换 Vue 版；LucideIcon 与所用图标名在 lucide-vue-next 中同名（已实测）。",
  },
  {
    match: /^@\/env$/,
    to: "runtime options",
    code: "retype-env",
    detail: "改为接收普通 runtime options，纯 core 不调用 useRuntimeConfig()。",
  },
  {
    match: /^@\/components\//,
    to: "@/core/…",
    code: "retype-component-type",
    detail: "被引用的类型搬进 core（例：recipes.ts 的 ScheduleValue）。",
  },
];

/** frontend 与 frontend-vue 的 @/* 分别指向 src/* 与 app/*，@/core/… 两边同形。 */
const ALIAS_PORTABLE = rx("^@/core/");

function matchesAny(list, specifier) {
  return list.some((re) => re.test(specifier));
}

function isInternal(specifier) {
  return specifier.startsWith(".") || specifier.startsWith("@/");
}

// ---------------------------------------------------------------------------
// 内部 specifier → 源文件路径解析（用于算传递阻塞）
// ---------------------------------------------------------------------------
function resolveInternal(specifier, fromPath, fileSet) {
  let base;
  if (specifier.startsWith("@/core/")) {
    base = posix.join(SOURCE_PREFIX, specifier.slice("@/core/".length));
  } else if (specifier.startsWith("@/")) {
    return null; // core 之外（@/env、@/lib、@/components），另有规则处理
  } else {
    base = posix.normalize(posix.join(posix.dirname(fromPath), specifier));
  }
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
  ];
  return candidates.find((candidate) => fileSet.has(candidate)) ?? null;
}

// ---------------------------------------------------------------------------
// 分类
// ---------------------------------------------------------------------------
function classify(facts, relPath, vueDeps) {
  const reasons = [];
  const needsDeps = new Set();
  let cls = "COPIED";

  const escalate = (next) => {
    const order = { COPIED: 0, RETYPED: 1, REWRITE: 2, DROPPED: 3 };
    if (order[next] > order[cls]) cls = next;
  };

  if (DROP_POLICY[relPath]) {
    return {
      class: "DROPPED",
      reasons: [{ code: "drop-policy", detail: DROP_POLICY[relPath] }],
      needsDeps: [],
    };
  }

  if (facts.isTsx) {
    escalate("REWRITE");
    reasons.push({
      code: "jsx",
      detail: ".tsx 含 JSX，需按 Vue 重写。",
    });
  }

  if (facts.readsProcessEnv) {
    escalate("RETYPED");
    reasons.push({
      code: "retype-process-env",
      detail:
        "读 process.env；Nuxt 客户端产物没有该全局，改为接收注入的 runtime options。",
    });
  }

  for (const imp of facts.imports) {
    const { specifier, typeOnly } = imp;

    if (matchesAny(NEXT_ONLY, specifier)) {
      escalate("REWRITE");
      reasons.push({
        code: "next-only",
        detail: `import "${specifier}"：Next 框架专属，Nuxt 侧无对应物。`,
      });
      continue;
    }

    if (matchesAny(REACT_RUNTIME, specifier)) {
      if (typeOnly) {
        // 只借类型不进运行时：换成自写类型即可（如 artifacts/loader.ts 的 BaseStream）。
        const rewrite = SPECIFIER_REWRITES.find((r) => r.match.test(specifier));
        escalate("RETYPED");
        reasons.push({
          code: rewrite?.code ?? "retype-react-type",
          detail: rewrite
            ? `${rewrite.detail}（type-only：${specifier}）`
            : `type-only import "${specifier}"，换成自写类型。`,
        });
      } else {
        escalate("REWRITE");
        reasons.push({
          code: "react-runtime",
          detail: `值导入 "${specifier}"：运行时依赖 React。`,
        });
      }
      continue;
    }

    const rewrite = SPECIFIER_REWRITES.find((r) => r.match.test(specifier));
    if (rewrite) {
      escalate("RETYPED");
      reasons.push({
        code: rewrite.code,
        detail: `${rewrite.detail}（${specifier} → ${rewrite.to}）`,
      });
      continue;
    }

    if (isInternal(specifier)) {
      if (
        specifier.startsWith("@/") &&
        !matchesAny(ALIAS_PORTABLE, specifier)
      ) {
        escalate("RETYPED");
        reasons.push({
          code: "retype-alias",
          detail: `"${specifier}" 指向 core 之外，需要重新落点。`,
        });
      }
      continue; // 相对路径与 @/core/* 两边同形，零改动
    }

    const pkg = packageNameOf(specifier);
    if (pkg && !vueDeps.has(pkg)) {
      // 装包不改文件内容，所以不影响 COPIED 判定，只是落地前置条件。
      needsDeps.add(pkg);
    }
  }

  if (cls === "COPIED") {
    reasons.push({
      code: "portable",
      detail: "所有 import 在 frontend-vue 中同形可解析，零改动复制。",
    });
  }

  return { class: cls, reasons, needsDeps: [...needsDeps].sort() };
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------
function loadVueDeps() {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  return new Set(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }));
}

function build(commit) {
  const paths = listBaselineFiles(commit, SOURCE_PREFIX);
  const fileSet = new Set(paths);
  const vueDeps = loadVueDeps();

  const entries = paths.map((path) => {
    const buffer = readBaselineFile(commit, path);
    const facts = collectFacts(path, buffer);
    const relPath = path.slice(`${SOURCE_PREFIX}/`.length);
    const verdict = classify(facts, relPath, vueDeps);

    const internalDeps = facts.imports
      .map((imp) => resolveInternal(imp.specifier, path, fileSet))
      .filter(Boolean)
      .map((p) => p.slice(`${SOURCE_PREFIX}/`.length));

    return {
      source: relPath,
      class: verdict.class,
      sha256: facts.sha256,
      lines: facts.lines,
      reasons: verdict.reasons,
      needsDeps: verdict.needsDeps,
      internalDeps: [...new Set(internalDeps)].sort(),
    };
  });

  // 传递阻塞。依赖 DROPPED 的文件**必然**要改（那行 import 没有落点），
  // 依赖 REWRITE 的文件导出面不再保证同名——两种都不能算零改动。
  // 宁可保守：把 COPIED 说大了会架空 hash 护城河，说小了只是少省点事。
  // RETYPED 不传染：它只改自己的 import，导出面按约定保持结构等价。
  const classOf = new Map(entries.map((e) => [e.source, e.class]));
  for (const entry of entries) {
    const droppedDeps = entry.internalDeps.filter(
      (dep) => classOf.get(dep) === "DROPPED",
    );
    const rewriteDeps = entry.internalDeps.filter(
      (dep) => classOf.get(dep) === "REWRITE",
    );
    entry.blockedBy = [...droppedDeps, ...rewriteDeps].sort();

    if (entry.class === "COPIED" && droppedDeps.length) {
      entry.class = "RETYPED";
      entry.reasons = entry.reasons.filter((r) => r.code !== "portable");
      entry.reasons.push({
        code: "retype-dropped-dep",
        detail: `依赖不迁的模块（${droppedDeps.join("、")}），该 import 必须删除或改写。`,
      });
    } else if (entry.class === "COPIED" && rewriteDeps.length) {
      entry.class = "RETYPED";
      entry.reasons = entry.reasons.filter((r) => r.code !== "portable");
      entry.reasons.push({
        code: "retype-rewrite-dep",
        detail: `依赖需重写的模块（${rewriteDeps.join("、")}），其导出面不保证同名；落地时逐个复核，若确实无需改动可降级回 COPIED。`,
      });
    }
  }

  return { commit, entries };
}

function summarize(entries) {
  const counts = {};
  const lines = {};
  for (const entry of entries) {
    counts[entry.class] = (counts[entry.class] ?? 0) + 1;
    lines[entry.class] = (lines[entry.class] ?? 0) + entry.lines;
  }
  return { counts, lines };
}

function renderManifest({ commit, entries }) {
  const { counts, lines } = summarize(entries);
  return `${JSON.stringify(
    {
      $comment:
        "由 scripts/core-provenance.mjs 生成，勿手改。重建：make baseline-refresh",
      baselineCommit: commit,
      sourceRoot: SOURCE_PREFIX,
      totals: { files: entries.length, counts, lines },
      files: entries,
    },
    null,
    2,
  )}\n`;
}

function renderSha256({ commit, entries }) {
  const files = {};
  for (const entry of entries) files[entry.source] = entry.sha256;
  return `${JSON.stringify(
    {
      $comment:
        "COPIED 档护城河基线。由 scripts/core-provenance.mjs 生成，勿手改。",
      baselineCommit: commit,
      sourceRoot: SOURCE_PREFIX,
      files,
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
  const manifestPath = join(ROOT, "baseline/core-manifest.json");
  const shaPath = join(ROOT, "baseline/core-sha256.json");
  const manifest = renderManifest(built);
  const sha = renderSha256(built);

  if (refresh) {
    mkdirSync(join(ROOT, "baseline"), { recursive: true });
    writeFileSync(manifestPath, manifest);
    writeFileSync(shaPath, sha);
    const { counts, lines } = summarize(built.entries);
    process.stdout.write(`baseline commit ${commit}\n`);
    process.stdout.write(`${built.entries.length} files\n`);
    for (const key of ["COPIED", "RETYPED", "REWRITE", "DROPPED"]) {
      process.stdout.write(
        `  ${key.padEnd(8)} ${String(counts[key] ?? 0).padStart(3)} files  ${String(lines[key] ?? 0).padStart(6)} lines\n`,
      );
    }
    return;
  }

  let stale = false;
  for (const [path, expected] of [
    [manifestPath, manifest],
    [shaPath, sha],
  ]) {
    let actual = null;
    try {
      actual = readFileSync(path, "utf8");
    } catch {
      /* 缺文件按过期处理 */
    }
    if (actual !== expected) {
      stale = true;
      process.stderr.write(`过期：${path}\n`);
    }
  }
  if (stale) {
    process.stderr.write(
      "运行 `make baseline-refresh` 重建，并把 diff 交 review。\n",
    );
    process.exit(1);
  }
  process.stdout.write(`台账与 ${commit} 一致\n`);
}

main();
