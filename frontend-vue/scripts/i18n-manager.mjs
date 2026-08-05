#!/usr/bin/env node
/*
  【文件职责】     词典体检：check / diff / unused（06 §M1 1d、03 §scripts）。
  【对应 frontend/】 无（工具链）
  【架构位置】     构建脚本
  【主要导出】     CLI：check（门禁）/ diff（对基线）/ unused（无人引用的 key）/ --refresh
  【依赖关系】     app/core/i18n/locales/{en-US,zh-CN}.ts；产物 baseline/i18n-keys.json
  【边界与注意】   **基线必须趁词典还是原样的时候取。** 06 §1d 把这条写在 M1 而不是 M4b，
                   理由是：等组件重写完再补，基线就已经是「被改过的词典」，
                   「这次重写漏了哪个 key」从此无从判断。词典是本窗口随 RETYPED
                   一起落地的，所以现在正是取基线的时刻。

                   三个子命令各管一件事，别混：

                     diff   —— 当前 key 集 vs 签入基线。**少 key 是错，多 key 只报告。**
                               少了意味着某次重写把它弄丢了；多了是正常的新增。
                     unused —— 词典里有、但 app/ 代码里没人引用的 key。
                               M1 阶段几乎全部「未引用」（组件还没重写），
                               所以它**只报告不判错**，等 M4b 之后才有意义。
                     check  —— 进 CI 的那条：diff 不许少 key，且两个 locale 的 key 集必须一致。

                   为什么还要查两个 locale 一致：`export const zhCN: Translations` 的
                   多余属性检查确实能拦住大部分，但那依赖两个文件都显式标注了类型。
                   谁把标注去掉（或改成 `satisfies` 之后再放宽），typecheck 就不管了，
                   而词典缺一条中文没人会立刻发现。这里不依赖类型标注，直接比 key。

                   key 用 TS AST 抽，不用正则——与 lib/source-facts.mjs 同一条口径。
                   词典里有大量嵌套对象和方法（`searchFor(query)` 那种模板函数），
                   正则分不清「对象字面量的属性」和「函数体里的对象」。
*/

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE = join(ROOT, "baseline/i18n-keys.json");
const LOCALES = {
  "en-US": { file: "app/core/i18n/locales/en-US.ts", symbol: "enUS" },
  "zh-CN": { file: "app/core/i18n/locales/zh-CN.ts", symbol: "zhCN" },
};
/** 扫 key 引用时看的目录；词典自身与基线产物排除在外。 */
const USAGE_ROOTS = ["app", "tests", "packages"];

// ---------------------------------------------------------------------------
// 抽 key
// ---------------------------------------------------------------------------

function parse(relPath) {
  const absolute = join(ROOT, relPath);
  return ts.createSourceFile(
    absolute,
    readFileSync(absolute, "utf8"),
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );
}

function propertyName(node) {
  const name = node.name;
  if (!name) return null;
  if (ts.isIdentifier(name)) return name.text;
  if (ts.isStringLiteral(name)) return name.text;
  return null; // 计算属性名：词典里不该有，出现就当它不存在，由 diff 暴露
}

/**
 * 从对象字面量收集点分 key 路径。
 * 方法与函数属性（`searchFor: (q) => …`）算叶子——它们是带参模板，
 * 不该再往里递归，否则会把函数体里的对象当成 key。
 */
function collectKeys(node, prefix, out) {
  for (const property of node.properties) {
    const name = propertyName(property);
    if (name === null) continue;
    const path = prefix ? `${prefix}.${name}` : name;

    if (ts.isMethodDeclaration(property)) {
      out.add(path);
      continue;
    }
    if (ts.isPropertyAssignment(property)) {
      const value = property.initializer;
      if (ts.isObjectLiteralExpression(value)) {
        collectKeys(value, path, out);
        continue;
      }
      out.add(path);
      continue;
    }
    out.add(path); // shorthand 等
  }
}

function keysOf(locale) {
  const { file, symbol } = LOCALES[locale];
  const source = parse(file);
  const keys = new Set();
  let found = false;

  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name)) continue;
      if (declaration.name.text !== symbol) continue;
      const init = declaration.initializer;
      if (!init || !ts.isObjectLiteralExpression(init)) {
        throw new Error(`${file}: ${symbol} 不是对象字面量，抽不了 key。`);
      }
      collectKeys(init, "", keys);
      found = true;
    }
  }
  if (!found) throw new Error(`${file}: 找不到 ${symbol} 的导出。`);
  return keys;
}

// ---------------------------------------------------------------------------
// 引用扫描（unused）
// ---------------------------------------------------------------------------

function sourceFiles(relRoot) {
  const found = [];
  const walk = (rel) => {
    let entries;
    try {
      entries = readdirSync(join(ROOT, rel), { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const next = `${rel}/${entry.name}`;
      if (entry.isDirectory()) {
        walk(next);
      } else if ([".ts", ".vue"].includes(extname(entry.name))) {
        found.push(next);
      }
    }
  };
  walk(relRoot);
  return found;
}

/**
 * 一个 key 算「被引用」的判据：它的**叶子名**在代码里以属性访问出现过。
 * 不做完整路径匹配是有意的——上游到处是 `const { common } = t` 再 `common.cancel`，
 * 以及 `t[section][key]` 这种间接访问，强求全路径会把大量真实引用误判成未引用。
 * 宁可少报：这个命令的用途是「重写完之后找死条目」，误删的代价远大于漏报。
 */
function referencedLeaves() {
  const leaves = new Set();
  const dictionary = new Set(Object.values(LOCALES).map((l) => l.file));
  for (const root of USAGE_ROOTS) {
    for (const rel of sourceFiles(root)) {
      if (dictionary.has(rel)) continue;
      const text = readFileSync(join(ROOT, rel), "utf8");
      for (const match of text.matchAll(/\.([A-Za-z_$][\w$]*)/g)) {
        leaves.add(match[1]);
      }
      for (const match of text.matchAll(/\[["']([^"']+)["']\]/g)) {
        leaves.add(match[1]);
      }
    }
  }
  return leaves;
}

// ---------------------------------------------------------------------------
// 子命令
// ---------------------------------------------------------------------------

function loadBaseline() {
  try {
    return JSON.parse(readFileSync(BASELINE, "utf8"));
  } catch {
    return null;
  }
}

function compareToBaseline(keys) {
  const baseline = loadBaseline();
  if (!baseline) {
    return { missing: [], added: [...keys].sort(), noBaseline: true };
  }
  const known = new Set(baseline.keys);
  return {
    missing: baseline.keys.filter((key) => !keys.has(key)),
    added: [...keys].filter((key) => !known.has(key)).sort(),
    noBaseline: false,
  };
}

function refresh() {
  const keys = keysOf("en-US");
  writeFileSync(
    BASELINE,
    `${JSON.stringify(
      {
        $comment:
          "词典 key 基线。由 `make i18n-refresh` 生成。趁词典还是上游原样时取（06 §M1 1d）——" +
          "此后组件重写漏掉任何一条，`make i18n-check` 立刻报出来。",
        source: LOCALES["en-US"].file,
        total: keys.size,
        keys: [...keys].sort(),
      },
      null,
      2,
    )}\n`,
  );
  process.stdout.write(`词典基线已重建：${keys.size} 个 key\n`);
}

function diff() {
  const en = keysOf("en-US");
  const { missing, added, noBaseline } = compareToBaseline(en);
  if (noBaseline) {
    process.stdout.write(
      `还没有基线（${en.size} 个 key）。跑 \`make i18n-refresh\` 取一份。\n`,
    );
    return 0;
  }
  process.stdout.write(`当前 ${en.size} 个 key\n`);
  for (const key of missing) process.stdout.write(`  - ${key}\n`);
  for (const key of added) process.stdout.write(`  + ${key}\n`);
  if (!missing.length && !added.length) process.stdout.write("  与基线一致\n");
  return missing.length ? 1 : 0;
}

function unused() {
  const en = keysOf("en-US");
  const referenced = referencedLeaves();
  const dead = [...en]
    .filter((key) => !referenced.has(key.split(".").pop()))
    .sort();
  process.stdout.write(
    `${dead.length} / ${en.size} 个 key 在 ${USAGE_ROOTS.join(" / ")} 里找不到引用\n`,
  );
  for (const key of dead.slice(0, 40)) process.stdout.write(`  ${key}\n`);
  if (dead.length > 40)
    process.stdout.write(`  …… 还有 ${dead.length - 40} 个\n`);
  process.stdout.write(
    "（M4b 之前组件还没重写，绝大多数「未引用」是正常的；本命令只报告，不判错。）\n",
  );
  return 0;
}

function check() {
  const problems = [];

  const en = keysOf("en-US");
  const zh = keysOf("zh-CN");
  for (const key of en) {
    if (!zh.has(key)) problems.push(`zh-CN 缺 key：${key}`);
  }
  for (const key of zh) {
    if (!en.has(key)) problems.push(`en-US 缺 key：${key}`);
  }

  const { missing, noBaseline } = compareToBaseline(en);
  if (noBaseline) {
    problems.push("没有签入词典基线，跑 `make i18n-refresh`。");
  }
  for (const key of missing) {
    problems.push(`基线里有、现在没了：${key}`);
  }

  if (problems.length) {
    for (const problem of problems) process.stderr.write(`✗ ${problem}\n`);
    process.stderr.write(
      "词典体检不通过。少 key 说明某次改动把它弄丢了；" +
        "若确实要删，改完两个 locale 后跑 `make i18n-refresh` 并把 diff 交 review。\n",
    );
    return 1;
  }
  process.stdout.write(
    `词典体检通过：两个 locale 各 ${en.size} 个 key，与基线一致\n`,
  );
  return 0;
}

const COMMANDS = { check, diff, unused };

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--refresh")) {
    refresh();
    return;
  }
  const name = args[0] ?? "check";
  const command = COMMANDS[name];
  if (!command) {
    process.stderr.write(
      `未知子命令 ${name}。可用：${Object.keys(COMMANDS).join(" / ")}，或 --refresh。\n`,
    );
    process.exit(2);
  }
  process.exit(command());
}

main();
