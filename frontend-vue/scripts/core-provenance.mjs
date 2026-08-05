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

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
// 人工输入 2/2：retype 时**声明删除**的 import。
//
// 为什么必须显式声明而不是让脚本猜：DROPPED 档永远不落地，而闭包判据是按上游
// import 图算的，所以「依赖 static-mode」的文件与测试会被判定为**永远搬不了**——
// 靠推进里程碑解不开。实际情况是 06 §M1 1b 早就写了处置方式（「删分支」），
// 删掉之后那条边就不存在了。
//
// 把删除声明进台账，闭包才是**我们落地后的图**而不是上游的图。代价是这份声明
// 必须与 scripts/land-retyped.mjs 的实际改写一致——由 land-retyped 的
// 「改写后不许残留该 specifier」检查兜住，声明了没删或删了没声明都会红。
// ---------------------------------------------------------------------------
const RETYPE_DROPS = {
  "artifacts/utils.ts": {
    imports: ["../static-mode"],
    detail:
      "删掉 isStaticWebsiteOnly 早返回与随之无消费方的 staticDemoArtifactURL。",
  },
  "models/api.ts": {
    imports: ["../static-mode"],
    detail:
      "删掉 isStaticWebsiteOnly 早返回与随之无消费方的 STATIC_MODELS_RESPONSE。",
  },
};

// ---------------------------------------------------------------------------
// 已经手写落地的 REWRITE。
//
// REWRITE 的含义是「没有可搬的东西，只能自写」，不是「永远不存在」。写完之后它
// 就不该再阻塞下游了——否则 `api/index.ts` 会因为一个**已经躺在磁盘上**的
// 被依赖方而永远 BLOCKED，台账与现实脱节。
//
// 为什么要显式声明而不是「扫一眼磁盘上有没有这个文件」：REWRITE 是人写的，
// 文件存在不等于它把上游的职责补齐了（M2 的 api-client 就只补了 core 真正调用
// 的 7 个方法，SDK 的其余几十个没有）。让人写一行声明，是逼这个判断被看见一次。
//
// 两头都有门禁：声明了但文件不在磁盘上 → 下面的 staleness 检查报错；
// 文件在磁盘上但没登记进 PROVENANCE.md → core-provenance.test.ts 报错。
// ---------------------------------------------------------------------------
//
// `landedDeps` 是**落地后**这个文件真正 import 的 core 模块，必须显式写出来。
// 台账记的 internalDeps 是上游那一版的依赖（api-client 的上游 import 了
// static-mode 与 static-demo，两个都是 DROPPED），而手写版根本没有这些边。
// 不声明的话，闭包会顺着上游的图判定 `sidecar/api.test.ts` 永远搬不了——
// 与 M1 给 RETYPE_DROPS 加 landedDeps 是同一个问题的第二次出现。
//
// 下面的 staleness 检查会拿磁盘上的真实 import 与这份声明逐条比对，
// 所以它不会悄悄过期。
const LANDED_REWRITES = {
  "api/api-client.ts": {
    detail:
      "M2 自写：core/api/client.ts 之上的薄包装，替代 SDK 的 Client（02 §249）。",
    landedDeps: ["api/client.ts", "agent-deerflow/gap.ts", "config/index.ts"],
  },
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

/**
 * **明确不装进 frontend-vue 的包**（02 §「LangChain 依赖全部去掉」，02 §372
 * 逐字写了「不必装进项目」）。它们与 REACT_RUNTIME 走同一套判定：
 *
 *   type-only 导入 → RETYPED，specifier 重定向到自写类型；
 *   值导入        → REWRITE，因为没有包可以装，只能自写替代物。
 *
 * `api/api-client.ts` 就是后者：`import { Client } from "@langchain/langgraph-sdk/client"`
 * 是值导入，02 §249 给的处置是**自写 `core/api/client.ts`（~180 行，7 个 REST 方法
 * + CSRF 头 + 错误规范化）**，03 §100 也写明 `api/` 是改写。所以它不是 M1 的活。
 *
 * 这条规则原本写成「值导入 → 装包解决」，据此把 SDK 装进了 frontend-vue。
 * 那是查错了文档：依赖决策在 02/04，不在 08。08 说的「SDK 保留为开发期
 * oracle/fallback」指的是继续跑着的 `frontend/`（07 的并行运行），
 * 以及 M2 那个一次性 worktree 里的兼容探针（06 §358 / 08 §68），
 * 都不是往 frontend-vue 的 package.json 里加一行。
 */
const REMOVED_DEPS = rx(
  "^@langchain/langgraph-sdk$",
  "^@langchain/langgraph-sdk/",
  "^@langchain/core$",
  "^@langchain/core/",
  // 02 §321：「决策：内联定义，不装这个包」。core 里只有
  // uploads/prompt-input-files.ts 一处 type-only 引用（FileUIPart）。
  "^ai$",
  "^ai/",
);

/** 只改 import specifier 就能过的重定向。目标已实测存在同名导出。 */
const SPECIFIER_REWRITES = [
  {
    match: /^@langchain\/(langgraph-sdk|core)(\/.*)?$/,
    to: "@/core/types/message",
    code: "retype-langgraph-sdk",
    detail: "SDK 类型改指向自写 @/core/types/message（06 §M1 1b 的 17 个）。",
  },
  {
    match: /^ai(\/.*)?$/,
    to: "@/core/types/message",
    code: "retype-vercel-ai",
    detail:
      "Vercel AI SDK 的类型内联进 @/core/types/message，不装这个包（02 §321）。",
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

/**
 * 分类的严重度序。`BLOCKED` 排在 `RETYPED` 之后、`REWRITE` 之前：
 * 它的**内容零改动**（比 RETYPED 轻），但**当下一行都落不了**（比 RETYPED 重），
 * 因为它 import 的模块要等 M4 重写完才存在。
 */
const CLASS_ORDER = {
  COPIED: 0,
  RETYPED: 1,
  BLOCKED: 2,
  REWRITE: 3,
  DROPPED: 4,
};

function findRewrite(specifier) {
  return SPECIFIER_REWRITES.find((rule) => rule.match.test(specifier));
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

/**
 * 手写 REWRITE 在**磁盘上**真正 import 到的 core 模块。
 *
 * 解析针对 `app/core/` 而不是 baseline 的文件列表：M2 新写的模块
 * （`agent-deerflow/gap.ts`）在基线里根本不存在，拿基线解析会全部落空，
 * 于是「声明与实际一致」这条检查退化成「两边都是空」——永远绿。
 */
function coreImportsOnDisk(source, content) {
  const facts = collectFacts(source, content);
  const found = new Set();
  for (const record of facts.imports) {
    const specifier = record.specifier;
    let base;
    if (specifier.startsWith("@/core/")) {
      base = specifier.slice("@/core/".length);
    } else if (specifier.startsWith(".")) {
      base = posix.normalize(posix.join(posix.dirname(source), specifier));
    } else {
      continue;
    }
    // 顺序要紧，且只接受 `.ts` 结尾：`@/core/config` 既是一个目录也可能是
    // 一个文件，先试裸路径会 existsSync 命中**目录**，声明就永远对不上。
    const hit = [`${base}.ts`, `${base}/index.ts`].find((candidate) =>
      existsSync(join(ROOT, "app/core", candidate)),
    );
    if (hit) found.add(hit);
  }
  return [...found].sort();
}

// ---------------------------------------------------------------------------
// 分类
// ---------------------------------------------------------------------------
function classify(facts, relPath, vueDeps) {
  const reasons = [];
  const needsDeps = new Set();
  let cls = "COPIED";

  const escalate = (next) => {
    if (CLASS_ORDER[next] > CLASS_ORDER[cls]) cls = next;
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

    if (matchesAny(REMOVED_DEPS, specifier)) {
      const rewrite = findRewrite(specifier);
      if (typeOnly) {
        escalate("RETYPED");
        reasons.push({
          code: rewrite.code,
          detail: `${rewrite.detail}（${specifier} → ${rewrite.to}）`,
        });
      } else {
        escalate("REWRITE");
        reasons.push({
          code: "removed-dep-runtime",
          detail:
            `值导入 "${specifier}"：该包明确不装进 frontend-vue（02 §372「不必装进项目」），` +
            "没有可装的替代，只能自写（02 §249：core/api/client.ts，~180 行）。",
        });
      }
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

    const rewrite = findRewrite(specifier);
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

  // 传递阻塞，两种性质完全不同：
  //
  //   依赖 DROPPED  → RETYPED。那行 import 没有落点，**必须自己动手删**，
  //                   删法记在 RETYPE_DROPS 里。这是 M1 的活。
  //   依赖 REWRITE  → BLOCKED。内容一个字节都不用改，但被依赖方要等 M4 重写完
  //                   才存在，所以**现在落不了**。这不是 M1 的活。
  //
  // 上一版把后者也判成 RETYPED，注了「落地时逐个复核，确实无需改动可降级回 COPIED」。
  // 本窗口逐个复核了这 8 个（7 个 barrel + utils/datetime.ts），结论是两头都不对：
  // 内容确实零改动（所以不是 RETYPED），但降级成 COPIED 会落下一个
  // `export * from "./hooks"` 指向不存在的模块（所以也不是 COPIED）。
  // 它们真正的状态是「等被依赖方」，于是有了 BLOCKED 这一档。
  //
  // **BLOCKED 必须传递到不动点，一轮不够。** `api/api-client.ts` 判成 REWRITE 之后，
  // `api/index.ts` 因为 re-export 它而 BLOCKED，`sidecar/api.ts` 又因为 import
  // `api/index.ts` 而 BLOCKED——第二跳的源头是 BLOCKED 而不是 REWRITE。
  // 只扫一轮会把 sidecar/api.ts 留在 COPIED，落地后就是个悬空 import。
  const classOf = new Map(entries.map((e) => [e.source, e.class]));
  const blockingClasses = new Set(["REWRITE", "BLOCKED"]);
  // 已手写落地的 REWRITE 不再阻塞下游，并在台账里带上 handWritten 标记，
  // 让 test-selection 的闭包也能把它算作「已落地」。
  for (const entry of entries) {
    if (LANDED_REWRITES[entry.source]) {
      entry.handWritten = true;
      entry.reasons.push({
        code: "rewrite-landed",
        detail: LANDED_REWRITES[entry.source].detail,
      });
      entry.landedDeps = [...LANDED_REWRITES[entry.source].landedDeps].sort();
    }
  }
  const isBlocking = (dep) =>
    blockingClasses.has(classOf.get(dep)) && !LANDED_REWRITES[dep];
  let settling = true;
  while (settling) {
    settling = false;
    for (const entry of entries) {
      const droppedDeps = entry.internalDeps.filter(
        (dep) => classOf.get(dep) === "DROPPED",
      );
      const blockedDeps = entry.internalDeps.filter(isBlocking);
      entry.blockedBy = [...droppedDeps, ...blockedDeps].sort();

      // DROPPED 依赖：即使文件已经因为别的理由是 RETYPED，这条理由也要单独记上——
      // 否则台账会漏报它必须做的改动。
      if (
        ["COPIED", "RETYPED"].includes(entry.class) &&
        droppedDeps.length &&
        !entry.reasons.some((r) => r.code === "retype-dropped-dep")
      ) {
        entry.class = "RETYPED";
        classOf.set(entry.source, "RETYPED");
        entry.reasons = entry.reasons.filter((r) => r.code !== "portable");
        entry.reasons.push({
          code: "retype-dropped-dep",
          detail: `依赖不迁的模块（${droppedDeps.join("、")}），该 import 必须删除或改写。`,
        });
        settling = true;
      }

      if (["COPIED", "RETYPED"].includes(entry.class) && blockedDeps.length) {
        entry.class = "BLOCKED";
        classOf.set(entry.source, "BLOCKED");
        entry.reasons = entry.reasons.filter((r) => r.code !== "portable");
        entry.reasons.push({
          code: "blocked-rewrite-dep",
          detail: `内容零改动，但 import 的 ${blockedDeps.join("、")} 当前落不了（REWRITE 或同样 BLOCKED），因此随被依赖方一起落地。`,
        });
        settling = true;
      }
    }
  }

  // 声明了「已手写落地」却不在磁盘上 → 台账在撒谎，下游会按「可以落地」去搬，
  // 然后在 import 解析时才炸。宁可在这里红。
  for (const source of Object.keys(LANDED_REWRITES)) {
    if (!entries.some((entry) => entry.source === source)) {
      throw new Error(
        `LANDED_REWRITES 里的 ${source} 不在基线的 core 文件列表里，声明已过期。`,
      );
    }
    const onDisk = join(ROOT, "app/core", source);
    if (!existsSync(onDisk)) {
      throw new Error(
        `LANDED_REWRITES 声明 ${source} 已手写落地，但 app/core/${source} 不存在。` +
          "先把文件写出来，或者去掉这条声明。",
      );
    }

    // 声明的 landedDeps 必须与磁盘上真实的 core 内 import 完全一致。
    // 少写一条 → 闭包以为不依赖它，搬过去的测试在 import 时才炸；
    // 多写一条 → 无谓地把下游卡住。两种都当过期处理。
    const actual = coreImportsOnDisk(source, readFileSync(onDisk, "utf8"));
    const declared = [...LANDED_REWRITES[source].landedDeps].sort();
    if (actual.join("|") !== declared.join("|")) {
      throw new Error(
        `${source}: LANDED_REWRITES 的 landedDeps 与磁盘上的 import 不一致，声明已过期。\n` +
          `  声明：${declared.join("、") || "（空）"}\n` +
          `  实际：${actual.join("、") || "（空）"}`,
      );
    }
  }

  // 声明删除的 import：落地后的依赖图去掉这些边。闭包判据读 landedDeps，
  // 台账仍保留 internalDeps 记录上游真实形状，两者的差就是 review 要看的东西。
  // 这一遍必须在不动点之外只跑一次——放进循环里 reason 会被重复 push。
  for (const entry of entries) {
    const drops = RETYPE_DROPS[entry.source];
    if (drops) {
      const resolved = drops.imports
        .map((specifier) =>
          resolveInternal(
            specifier,
            `${SOURCE_PREFIX}/${entry.source}`,
            fileSet,
          ),
        )
        .filter(Boolean)
        .map((p) => p.slice(`${SOURCE_PREFIX}/`.length));
      const missing = drops.imports.length - resolved.length;
      if (missing > 0) {
        throw new Error(
          `${entry.source}: RETYPE_DROPS 里有 ${missing} 条 import 在基线上解析不到，声明已过期。`,
        );
      }
      entry.droppedImports = drops.imports;
      entry.landedDeps = entry.internalDeps.filter(
        (dep) => !resolved.includes(dep),
      );
      entry.reasons.push({ code: "retype-drop-import", detail: drops.detail });
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
