#!/usr/bin/env node
/*
  【文件职责】     词典体检：check / diff / unused（06 §M1 1d、03 §scripts）。
  【架构位置】     构建脚本
  【主要导出】     CLI：check（门禁）/ diff（对基线）/ unused（无人引用的 key）/ --refresh
  【依赖关系】     app/core/i18n/locales/{en-US,zh-CN}.ts；产物 baseline/i18n-keys.json
  【边界与注意】   基线钉的是「当前词典有哪些 key」。它的用途是让一次改动里
                   **丢 key** 这件事必须被显式承认：删 key 要连同刷新基线一起进 review，
                   而不是悄悄少一条翻译。

                   三个子命令各管一件事，别混：

                     diff   —— 当前 key/unused 集 vs 签入基线。新增、删除与 unused 漂移
                               都必须显式刷新基线，避免词典只增不收。
                     unused —— 词典里有、但产品/测试/包代码没人引用的 key；已审计集合
                               签入基线，任何新增或恢复使用都需要 review。
                     check  —— 进 CI 的那条：key 与 unused 集都必须精确匹配基线，
                               且两个 locale 的 key 集必须一致。

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
 *
 * 变量下标要单独认。`authDomains[domain].label` 与 `descriptions[provider]`
 * 里，被索引的那一段**永远不会**以 `.calendar` / `["buzz"]` 的形态出现在源码里，
 * 于是整组条目会被报成 unused——而它们每一条都在页面上渲染着。实测两处：
 * Lark 的 22 个授权域，以及 channels 的 provider 描述（后者的 e2e 明确断言
 * "Buzz channels and direct messages" 可见，同一条 key 却在 unused 名单里）。
 *
 * 记的是**带形状的**下标访问，不是光记一个容器名：
 *
 *   `.authDomains[x].label`  ->  (authDomains, "label")
 *   `.descriptions[x]`       ->  (descriptions, "*")
 *
 * 「容器名出现过就放行整棵子树」这条更省事的规则实测是错的：
 * `app/core/settings/store.ts` 里有一处与词典毫无关系的 `.settings[key]`，
 * 那条规则会把整个 `settings.*` 子树标成已引用——一次就吞掉 18 条真实
 * 未渲染的 Lark 文案。带形状之后，(settings, "*") 只放行 settings 的直接子项，
 * 够不到 settings.integrations.lark.waitingAuthTitle。
 */
function referencedNames() {
  const leaves = new Set();
  /** `${container}.${leafOrStar}` */
  const dynamicAccess = new Set();
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
      // `.container[<变量>]` 可选地再跟一个 `.prop`。
      const dynamic =
        /\.([A-Za-z_$][\w$]*)\s*\[\s*[^\]"'\s][^\]]*\]\s*(?:\.([A-Za-z_$][\w$]*))?/g;
      for (const match of text.matchAll(dynamic)) {
        dynamicAccess.add(`${match[1]}.${match[2] ?? "*"}`);
      }
    }
  }
  return { leaves, dynamicAccess };
}

function isReferenced(key, { leaves, dynamicAccess }) {
  const segments = key.split(".");
  if (leaves.has(segments.at(-1))) return true;
  const [leaf, parent, grandparent] = [
    segments.at(-1),
    segments.at(-2),
    segments.at(-3),
  ];
  // `descriptions[provider]` -> descriptions 的直接子项。
  if (parent !== undefined && dynamicAccess.has(`${parent}.*`)) return true;
  // `authDomains[domain].label` -> authDomains 的孙辈中名为 label 的那些。
  return (
    grandparent !== undefined && dynamicAccess.has(`${grandparent}.${leaf}`)
  );
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

function unusedKeys(keys) {
  const referenced = referencedNames();
  return [...keys].filter((key) => !isReferenced(key, referenced)).sort();
}

function compareUnusedToBaseline(dead) {
  const baseline = loadBaseline();
  if (!baseline || !Array.isArray(baseline.unusedKeys)) {
    return { newlyUnused: dead, newlyUsed: [], noBaseline: true };
  }
  const current = new Set(dead);
  const known = new Set(baseline.unusedKeys);
  return {
    newlyUnused: dead.filter((key) => !known.has(key)),
    newlyUsed: baseline.unusedKeys.filter((key) => !current.has(key)),
    noBaseline: false,
  };
}

function refresh() {
  const keys = keysOf("en-US");
  const dead = unusedKeys(keys);
  writeFileSync(
    BASELINE,
    `${JSON.stringify(
      {
        $comment:
          "词典 key 基线。由 `make i18n-refresh` 生成。趁词典还是上游原样时取（06 §M1 1d）——" +
          "此后 key 新增/删除或 unused 集漂移，`make i18n-check` 立刻报出来。",
        source: LOCALES["en-US"].file,
        total: keys.size,
        keys: [...keys].sort(),
        unusedTotal: dead.length,
        unusedKeys: dead,
      },
      null,
      2,
    )}\n`,
  );
  process.stdout.write(
    `词典基线已重建：${keys.size} 个 key，${dead.length} 个已审计未引用 key\n`,
  );
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
  const dead = unusedKeys(en);
  const unusedDiff = compareUnusedToBaseline(dead);
  for (const key of unusedDiff.newlyUnused) {
    process.stdout.write(`  unused + ${key}\n`);
  }
  for (const key of unusedDiff.newlyUsed) {
    process.stdout.write(`  unused - ${key}\n`);
  }
  if (
    !missing.length &&
    !added.length &&
    !unusedDiff.newlyUnused.length &&
    !unusedDiff.newlyUsed.length
  ) {
    process.stdout.write("  key 与 unused 集均与基线一致\n");
  }
  return missing.length ||
    added.length ||
    unusedDiff.noBaseline ||
    unusedDiff.newlyUnused.length ||
    unusedDiff.newlyUsed.length
    ? 1
    : 0;
}

function unused() {
  const en = keysOf("en-US");
  const dead = unusedKeys(en);
  const drift = compareUnusedToBaseline(dead);
  process.stdout.write(
    `${dead.length} / ${en.size} 个 key 在 ${USAGE_ROOTS.join(" / ")} 里找不到引用\n`,
  );
  for (const key of dead.slice(0, 40)) process.stdout.write(`  ${key}\n`);
  if (dead.length > 40)
    process.stdout.write(`  …… 还有 ${dead.length - 40} 个\n`);
  for (const key of drift.newlyUnused) {
    process.stderr.write(`✗ 新增未引用 key：${key}\n`);
  }
  for (const key of drift.newlyUsed) {
    process.stderr.write(`✗ 基线未引用 key 已恢复使用：${key}\n`);
  }
  if (drift.noBaseline) {
    process.stderr.write("✗ 基线没有 unusedKeys，跑 `make i18n-refresh`。\n");
  }
  if (
    !drift.noBaseline &&
    !drift.newlyUnused.length &&
    !drift.newlyUsed.length
  ) {
    process.stdout.write("unused 集与已审计基线一致\n");
  }
  return drift.noBaseline || drift.newlyUnused.length || drift.newlyUsed.length
    ? 1
    : 0;
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

  const { missing, added, noBaseline } = compareToBaseline(en);
  if (noBaseline) {
    problems.push("没有签入词典基线，跑 `make i18n-refresh`。");
  }
  for (const key of missing) {
    problems.push(`基线里有、现在没了：${key}`);
  }
  for (const key of added) {
    problems.push(`新增 key 尚未进入审计基线：${key}`);
  }
  const dead = unusedKeys(en);
  const unusedDiff = compareUnusedToBaseline(dead);
  if (unusedDiff.noBaseline) {
    problems.push("基线没有 unusedKeys，跑 `make i18n-refresh`。 ");
  }
  for (const key of unusedDiff.newlyUnused) {
    problems.push(`新增未引用 key：${key}`);
  }
  for (const key of unusedDiff.newlyUsed) {
    problems.push(`基线未引用 key 已恢复使用：${key}`);
  }

  if (problems.length) {
    for (const problem of problems) process.stderr.write(`✗ ${problem}\n`);
    process.stderr.write(
      "词典体检不通过。key 或 unused 集发生漂移；" +
        "确认两份 locale 与引用情况后跑 `make i18n-refresh` 并 review diff。\n",
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
