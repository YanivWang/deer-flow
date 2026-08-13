#!/usr/bin/env node
/*
  【文件职责】     把上游 @rstest/core 测试机械改写成 vitest 测试并落到 tests/unit/core/。
  【对应 frontend/】 frontend/tests/unit/core/**（只读，源在 baseline commit 上）
  【架构位置】     构建脚本
  【主要导出】     CLI：--write 生成；默认 --check 校验生成物未被手改
  【依赖关系】     scripts/lib/{source-facts,test-selection}.mjs；读 baseline/core-test-manifest.json
  【边界与注意】   改写用 TS AST 定位、按字节区间原地替换，最后过一遍 prettier。
                   必须过：`"@rstest/core"` → `"vitest"` 少了 6 个字符，
                   原来折行的 import 就能收成一行，不格式化 format-check 直接红。
                   生成物不是 COPIED，格式化它没有护城河代价。
                   只允许改写下面 VERIFIED_APIS 里的 rs.*；每一条在
                   tests/guards/rstest-vitest-parity.test.ts 里都有可执行断言。
                   遇到没验证过的 API 直接报错退出，不猜。
*/

import {
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import prettier from "prettier";

import { readBaselineFile, resolveCommit } from "./lib/source-facts.mjs";
import { selectPortableTests, targetPathOf } from "./lib/test-selection.mjs";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = "tests/unit/core";
const RSTEST_MODULE = "@rstest/core";

/**
 * 只有在 tests/guards/rstest-vitest-parity.test.ts 里有可执行断言的 rs.* 才准改写。
 * 「同名」不是理由——vitest 4 的 mockReset 就不是直觉里那个语义。
 * 要放开一个新 API：先去 parity 测试加断言，再往这里加一行。
 */
const VERIFIED_APIS = new Set([
  "advanceTimersByTimeAsync",
  "doMock",
  "doUnmock",
  "fn",
  "mock",
  "mocked",
  "resetModules",
  "restoreAllMocks",
  "spyOn",
  "stubGlobal",
  "unstubAllGlobals",
  "useFakeTimers",
  "useRealTimers",
]);

/**
 * 生成物一律不许手改（--check 会红）。确实需要针对 Vue 侧改写某个测试时，
 * 它就不再是机器生成的：登记到这里并写明理由，codemod 从此不碰它。
 *
 * 登记之后 codemod 不再生成它，但**文件必须留在磁盘上并签入**——
 * collected-check 的期望集来自台账而不是 codemod，少一个文件照样红。
 */
const HAND_MAINTAINED = {
  "artifacts/utils.test.ts": [
    "上游有 2 个用例测 isStaticWebsiteOnly() 早返回，而 01-scope 已把静态模式排除出迁移范围，",
    "artifacts/utils.ts 落地时按 06 §M1 1b 删掉了那两个分支——留着就是在测一段故意不存在的行为。",
    "顺带删掉整套 NEXT_PUBLIC_* 环境变量夹具：配置改成注入 runtime options 之后它一个字节都读不到。",
    "另增 Vue showcase 显式 isMock transport 用例；其余用例逐字保留。理由与边界写在该文件的六段式文件头里。",
  ].join(" "),
};

// ---------------------------------------------------------------------------
// 改写
// ---------------------------------------------------------------------------
function collectEdits(sourceFile) {
  const edits = [];
  const apis = new Set();
  let sawRstestImport = false;

  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== RSTEST_MODULE
    ) {
      continue;
    }
    sawRstestImport = true;
    const spec = statement.moduleSpecifier;
    edits.push({
      start: spec.getStart(sourceFile),
      end: spec.end,
      text: '"vitest"',
    });

    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        // `rs` 是 rstest 的工具命名空间，vitest 侧叫 `vi`。
        // 只改名字本身，别名形式 `rs as x` 上游没用到，遇到就让断言兜住。
        if (element.name.text !== "rs" || element.propertyName) continue;
        edits.push({
          start: element.name.getStart(sourceFile),
          end: element.name.end,
          text: "vi",
        });
      }
    }
  }

  const rename = (qualifier, api) => {
    apis.add(api);
    edits.push({
      start: qualifier.getStart(sourceFile),
      end: qualifier.end,
      text: "vi",
    });
  };

  const walk = (node) => {
    // 值位置：rs.fn()
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "rs"
    ) {
      rename(node.expression, node.name.text);
    }
    // 类型位置：ReturnType<typeof rs.fn>。这里是 QualifiedName 不是
    // PropertyAccessExpression，只走上面那一支会漏掉，而漏掉的后果是
    // 生成物里留一个悬空的 `rs`——由 transform 末尾的残留检查兜住。
    if (
      ts.isQualifiedName(node) &&
      ts.isIdentifier(node.left) &&
      node.left.text === "rs"
    ) {
      rename(node.left, node.right.text);
    }
    ts.forEachChild(node, walk);
  };
  walk(sourceFile);

  return { edits, apis, sawRstestImport };
}

function applyEdits(text, edits) {
  let out = text;
  for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
    out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  }
  return out;
}

function banner(entry, sourceRoot, commit) {
  return [
    "/*",
    `  由 scripts/rstest-to-vitest.mjs 从 ${sourceRoot}/${entry.source} 机械生成。`,
    `  基线 ${commit.slice(0, 8)} · 改动仅限 @rstest/core → vitest、rs.* → vi.*。`,
    "  勿手改：make codemod-check 会红。需要为 Vue 侧适配就登记进 HAND_MAINTAINED。",
    "*/",
    "",
    "",
  ].join("\n");
}

async function transform(entry, sourceRoot, commit) {
  const path = `${sourceRoot}/${entry.source}`;
  const text = readBaselineFile(commit, path).toString("utf8");
  const sourceFile = ts.createSourceFile(
    path,
    text,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    entry.source.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const { edits, apis, sawRstestImport } = collectEdits(sourceFile);

  const unverified = [...apis].filter((api) => !VERIFIED_APIS.has(api)).sort();
  if (unverified.length) {
    throw new Error(
      `${entry.source}: 用到未验证等价性的 rs.${unverified.join("、rs.")}。` +
        "先在 tests/guards/rstest-vitest-parity.test.ts 加断言，再加进 VERIFIED_APIS。",
    );
  }
  if (!sawRstestImport) {
    throw new Error(
      `${entry.source}: 没有 @rstest/core 导入，分桶台账与源码不符。`,
    );
  }

  const spliced = banner(entry, sourceRoot, commit) + applyEdits(text, edits);
  const out = await prettier.format(spliced, {
    ...(await prettier.resolveConfig(join(ROOT, "package.json"))),
    parser: "typescript",
  });

  // 兜底：改写后不许再有 rstest 的痕迹。上面的规则漏了什么，这里必须拦住。
  const residue = out.replace(/^\/\*[\s\S]*?\*\/\n\n/, "");
  if (residue.includes(RSTEST_MODULE) || /\brs\s*\./.test(residue)) {
    throw new Error(`${entry.source}: 改写后仍残留 rstest 引用。`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------
function listGenerated(dir) {
  const found = [];
  const walk = (rel) => {
    let items;
    try {
      items = readdirSync(join(ROOT, rel), { withFileTypes: true });
    } catch {
      return;
    }
    for (const item of items) {
      const next = `${rel}/${item.name}`;
      if (item.isDirectory()) walk(next);
      else if (item.name.endsWith(".ts")) found.push(next);
    }
  };
  walk(dir);
  return found.sort();
}

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes("--write");
  const landedArg = args.find((a) => a.startsWith("--landed="));
  const landed = (landedArg ? landedArg.split("=")[1] : "COPIED").split(",");

  const manifest = JSON.parse(
    readFileSync(join(ROOT, "baseline/core-test-manifest.json"), "utf8"),
  );
  const coreManifest = JSON.parse(
    readFileSync(join(ROOT, "baseline/core-manifest.json"), "utf8"),
  );
  const commit = resolveCommit(manifest.baselineCommit);
  const portable = selectPortableTests(manifest, coreManifest, landed);
  const selected = portable.filter((entry) => !HAND_MAINTAINED[entry.source]);
  // 手工维护的那些也在台账的期望集里，只是不由这里生成：既不能被清理掉，
  // 也不能被判成「不该存在」。它们的存在由 collected-check 继续盯着。
  const handMaintained = new Set(
    portable
      .filter((entry) => HAND_MAINTAINED[entry.source])
      .map((entry) => targetPathOf(entry)),
  );

  const generated = new Map();
  for (const entry of selected) {
    generated.set(
      targetPathOf(entry),
      await transform(entry, manifest.sourceRoot, commit),
    );
  }

  if (write) {
    // 不能整目录 rm：手工维护的文件就在里面，删了内容就没了。
    // 只清理「既不是本次生成、也不是手工维护」的残留。
    for (const rel of listGenerated(OUT_DIR)) {
      if (!generated.has(rel) && !handMaintained.has(rel)) {
        rmSync(join(ROOT, rel), { force: true });
      }
    }
    for (const [rel, content] of generated) {
      mkdirSync(dirname(join(ROOT, rel)), { recursive: true });
      writeFileSync(join(ROOT, rel), content);
    }
    const dom = [...generated.keys()].filter((p) => p.endsWith(".dom.test.ts"));
    process.stdout.write(
      `landed=${landed.join(",")} baseline ${commit.slice(0, 8)}\n`,
    );
    process.stdout.write(
      `${generated.size} tests written  (node ${generated.size - dom.length} · dom ${dom.length})\n`,
    );
    return;
  }

  let drift = false;
  for (const [rel, expected] of generated) {
    let actual = null;
    try {
      actual = readFileSync(join(ROOT, rel), "utf8");
    } catch {
      /* 缺文件按漂移处理 */
    }
    if (actual !== expected) {
      drift = true;
      process.stderr.write(`与 codemod 输出不一致：${rel}\n`);
    }
  }
  for (const rel of listGenerated(OUT_DIR)) {
    if (!generated.has(rel) && !handMaintained.has(rel)) {
      drift = true;
      process.stderr.write(`不该存在（codemod 不会生成它）：${rel}\n`);
    }
  }
  for (const rel of handMaintained) {
    try {
      readFileSync(join(ROOT, rel), "utf8");
    } catch {
      drift = true;
      process.stderr.write(
        `登记为 HAND_MAINTAINED 但文件不在磁盘上：${rel}（它必须被签入）\n`,
      );
    }
  }
  if (drift) {
    process.stderr.write(
      "运行 `make codemod-tests` 重建。若这处改动是有意的，" +
        "该文件就不再是机器生成的：登记进 rstest-to-vitest.mjs 的 HAND_MAINTAINED。\n",
    );
    process.exit(1);
  }
  process.stdout.write(`${generated.size} 个生成测试与 codemod 输出一致\n`);
}

await main();
