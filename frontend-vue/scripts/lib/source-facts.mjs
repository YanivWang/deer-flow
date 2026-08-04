/*
  【文件职责】     从 TS 源码抽取分类所需的机械事实（import、type-only、process.env、JSX）。
  【对应 frontend/】 无（工具链，非业务迁移）
  【架构位置】     构建脚本
  【主要导出】     readBaselineFile / listBaselineFiles / collectFacts
  【依赖关系】     被 core-provenance.mjs 与 core-test-manifest.mjs 共用
  【边界与注意】   一律用 TS AST 判断 type-only，不用正则——`import type {A}` 与
                   `import {type A}` 两种写法都要认，弄错会把 RETYPED 误判成重写。
*/

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

/** 所有 git 调用都锚在仓库根：pathspec 与 `commit:path` 都按根解释，不受 cwd 影响。 */
const REPO_ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
}).trim();

const git = (args, options = {}) =>
  execFileSync("git", args, {
    cwd: REPO_ROOT,
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });

/** 从 git 对象读取，而不是工作树：baseline 锚在 commit 上才有护城河意义。 */
export function readBaselineFile(commit, path) {
  return git(["show", `${commit}:${path}`], { encoding: "buffer" });
}

export function listBaselineFiles(commit, prefix) {
  const out = git(["ls-tree", "-r", "--name-only", commit, "--", prefix], {
    encoding: "utf8",
  });
  return out
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((p) => /\.(ts|tsx|mts|cts)$/.test(p))
    .sort();
}

export function resolveCommit(ref) {
  return git(["rev-parse", ref], { encoding: "utf8" }).trim();
}

export function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * 每个 module specifier 归并成一条记录。typeOnly 为真的条件是
 * **该 specifier 的所有绑定**都是 type-only；只要有一个值导入就是 false，
 * 因为值导入意味着运行时真的依赖这个包。
 */
function recordSpecifier(map, specifier, { typeOnly, sideEffect }) {
  const existing = map.get(specifier);
  if (!existing) {
    map.set(specifier, { specifier, typeOnly, sideEffect });
    return;
  }
  existing.typeOnly = existing.typeOnly && typeOnly;
  existing.sideEffect = existing.sideEffect || sideEffect;
}

function importClauseIsTypeOnly(clause) {
  if (!clause) return false; // `import "x"` 副作用导入：运行时依赖
  if (clause.isTypeOnly) return true; // `import type { A } from "x"`
  if (clause.name) return false; // default 导入按值算
  const bindings = clause.namedBindings;
  if (!bindings) return false;
  if (ts.isNamespaceImport(bindings)) return false; // `import * as ns` 按值算
  if (!bindings.elements.length) return false;
  // `import { type A, type B } from "x"` —— 全部逐项 type-only 才算
  return bindings.elements.every((element) => element.isTypeOnly);
}

function exportClauseIsTypeOnly(node) {
  if (node.isTypeOnly) return true;
  const clause = node.exportClause;
  if (!clause || !ts.isNamedExports(clause)) return false;
  if (!clause.elements.length) return false;
  return clause.elements.every((element) => element.isTypeOnly);
}

export function collectFacts(path, buffer) {
  const text = buffer.toString("utf8");
  const source = ts.createSourceFile(
    path,
    text,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ false,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const specifiers = new Map();

  for (const statement of source.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      recordSpecifier(specifiers, statement.moduleSpecifier.text, {
        typeOnly: importClauseIsTypeOnly(statement.importClause),
        sideEffect: !statement.importClause,
      });
      continue;
    }
    if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      recordSpecifier(specifiers, statement.moduleSpecifier.text, {
        typeOnly: exportClauseIsTypeOnly(statement),
        sideEffect: false,
      });
      continue;
    }
    // `import foo = require("x")`
    if (
      ts.isImportEqualsDeclaration(statement) &&
      ts.isExternalModuleReference(statement.moduleReference) &&
      ts.isStringLiteral(statement.moduleReference.expression)
    ) {
      recordSpecifier(specifiers, statement.moduleReference.expression.text, {
        typeOnly: statement.isTypeOnly,
        sideEffect: false,
      });
    }
  }

  // 动态 import 与 require 也是运行时依赖，正则足够（它们不参与 type-only 判定）。
  const dynamic = new Set();
  for (const match of text.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)) {
    dynamic.add(match[1]);
    recordSpecifier(specifiers, match[1], {
      typeOnly: false,
      sideEffect: false,
    });
  }

  return {
    path,
    sha256: sha256(buffer),
    bytes: buffer.length,
    // wc -l 语义（数换行符），这样总行数能与 06-migration-plan 的基线值直接对账。
    lines: (text.match(/\n/g) ?? []).length,
    isTsx: path.endsWith(".tsx"),
    readsProcessEnv: /\bprocess\s*\.\s*env\b/.test(text),
    dynamicImports: [...dynamic].sort(),
    imports: [...specifiers.values()].sort((a, b) =>
      a.specifier.localeCompare(b.specifier),
    ),
  };
}

/** npm 包名（去掉子路径），相对路径与别名返回 null。 */
export function packageNameOf(specifier) {
  if (specifier.startsWith(".") || specifier.startsWith("/")) return null;
  if (specifier.startsWith("@/") || specifier.startsWith("~/")) return null;
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}
