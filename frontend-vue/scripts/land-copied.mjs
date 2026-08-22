#!/usr/bin/env node
/*
  【文件职责】     把 manifest 判定为 COPIED 的文件逐字节落到 app/core/，并生成对应的台账行。
  【对应 frontend/】 frontend/src/core/**（只读，源在 baseline commit 上）
  【架构位置】     构建脚本
  【主要导出】     CLI：--write 落地；默认打印将要落地的清单
  【依赖关系】     baseline/core-manifest.json；写 app/core/** 与 app/core/PROVENANCE.md
  【边界与注意】   从 git 对象读、按字节写，**不经过任何格式化**——
                   prettier 碰一下 COPIED 就不再等同上游，core-provenance.test.ts 会红。
                   实测两边格式化器就是不同意：prettier 3.9.6 想改 7 个文件
                   （上游 3.8.1 认为它们已经合规），eslint 另报 5 处。所以本脚本
                   顺带生成 .prettierignore 的 COPIED 块；eslint 那边由
                   eslint.config.mjs 直接读 manifest 得到同一份清单。
                   **只忽略 COPIED 这一档**，不是整个 app/core/——RETYPED/REWRITE/ADDED
                   是我们自己写的代码，必须继续受检。文件降级出 COPIED 会自动恢复受检。
                   台账里只有标记块内的行由本脚本生成，块外的手写行（如 M0 的 ADDED）原样保留。
*/

import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import prettier from "prettier";

import {
  readBaselineFile,
  resolveCommit,
  sha256,
} from "./lib/source-facts.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LEDGER = join(ROOT, "app/core/PROVENANCE.md");
const PRETTIER_IGNORE = join(ROOT, ".prettierignore");
const BEGIN = "<!-- COPIED:BEGIN 由 `make land-copied` 生成，勿手改 -->";
const END = "<!-- COPIED:END -->";
const IGNORE_BEGIN = "# COPIED:BEGIN 由 `make land-copied` 生成，勿手改";
const IGNORE_END = "# COPIED:END";

/** Intentionally diverged Vue-owned files that started in the COPIED class. */
const HAND_MAINTAINED = {
  "api/errors.ts":
    "WP-02 unifies Gateway response parsing while preserving the legacy export.",
  "i18n/cookies.ts":
    "Existing Vue SSR-free locale cookie adapter is maintained in place.",
  "threads/api.ts":
    "WP-02 preserves Gateway HTTP status/body through the shared Vue error parser.",
  "scheduled-tasks/api.ts":
    "WP-07 adds abortable detail and limit/offset runs queries while narrowing create/update payloads to the Gateway contract.",
};

/** 台账单元格里的 `|` 会把表格切断；COPIED 的说明是脚本给的，不该出现，兜一下。 */
const cell = (text) => text.replace(/\|/g, "\\|");

function renderBlock(entries) {
  const rows = entries.map((entry) => {
    const reason = entry.reasons.find((r) => r.code === "portable");
    return `| \`${entry.source}\` | \`COPIED\` | \`${entry.source}\` | ${cell(reason?.detail ?? "零改动复制。")} |`;
  });
  return [BEGIN, ...rows, END].join("\n");
}

function spliceBlock(markdown, block) {
  const start = markdown.indexOf(BEGIN);
  const end = markdown.indexOf(END);
  if (start !== -1 && end !== -1) {
    return markdown.slice(0, start) + block + markdown.slice(end + END.length);
  }
  // 首次落地：接在表格末尾。找最后一个以 `|` 开头的行。
  const lines = markdown.split("\n");
  let last = -1;
  for (const [index, line] of lines.entries()) {
    if (line.trim().startsWith("|")) last = index;
  }
  if (last === -1) throw new Error("PROVENANCE.md 里找不到台账表格。");
  lines.splice(last + 1, 0, block);
  return lines.join("\n");
}

function renderIgnoreBlock(entries) {
  return [
    IGNORE_BEGIN,
    "# COPIED 档必须逐字节等同上游。prettier 3.9.6 与上游的 3.8.1 对 7 个文件意见不同，",
    "# 一次 `make format` 就会让 core-provenance.test.ts 变红。这里只挡 COPIED，",
    "# app/core/ 下我们自己写的文件照常格式化。",
    ...entries.map((entry) => `app/core/${entry.source}`),
    IGNORE_END,
  ].join("\n");
}

function spliceIgnore(text, block) {
  const start = text.indexOf(IGNORE_BEGIN);
  const end = text.indexOf(IGNORE_END);
  if (start !== -1 && end !== -1) {
    return text.slice(0, start) + block + text.slice(end + IGNORE_END.length);
  }
  return `${text.trimEnd()}\n\n${block}\n`;
}

async function main() {
  const write = process.argv.slice(2).includes("--write");
  const manifest = JSON.parse(
    readFileSync(join(ROOT, "baseline/core-manifest.json"), "utf8"),
  );
  const commit = resolveCommit(manifest.baselineCommit);
  const copied = manifest.files
    .filter((entry) => entry.class === "COPIED")
    .filter((entry) => !HAND_MAINTAINED[entry.source])
    .sort((a, b) => a.source.localeCompare(b.source));

  if (!write) {
    process.stdout.write(`${copied.length} 个 COPIED 待落地（--write 执行）\n`);
    for (const entry of copied) process.stdout.write(`  ${entry.source}\n`);
    return;
  }

  // 先清理**降级出落地档**的文件。分类会变（`api/index.ts` 就从 COPIED 变成了
  // BLOCKED，因为它 re-export 的 api-client.ts 改判 REWRITE），
  // 而两个 land-* 脚本都只写不删，旧文件会留在磁盘上变成幽灵——
  // 它已经不在台账里，却还能被 import 到。
  // core-provenance.test.ts 能报出来（「磁盘上的每个文件都已登记」），
  // 但让人手动 rm 不如这里直接扫掉。
  //
  // 手写落地的 REWRITE 必须排除在清理之外。它的分类确实不在落地档里
  // （REWRITE 永远不由脚本落地），但文件是人写的、已签入的——照着分类扫会把它
  // 当幽灵删掉。实测就是这么发生的：加完 LANDED_REWRITES 之后第一次
  // `make land-copied` 直接删掉了刚写完的 api/api-client.ts。
  // 判据用台账的 handWritten，与 core-provenance 的 LANDED_REWRITES 同源。
  const LANDING_CLASSES = new Set(["COPIED", "RETYPED"]);
  for (const entry of manifest.files) {
    if (
      LANDING_CLASSES.has(entry.class) ||
      entry.handWritten ||
      HAND_MAINTAINED[entry.source]
    )
      continue;
    const stale = join(ROOT, "app/core", entry.source);
    if (existsSync(stale)) {
      rmSync(stale);
      process.stdout.write(`清理降级出落地档的文件：${entry.source}\n`);
    }
  }

  for (const entry of copied) {
    const buffer = readBaselineFile(
      commit,
      `${manifest.sourceRoot}/${entry.source}`,
    );
    // 落地前先自证：读到的字节确实是 manifest 记的那一份。
    const actual = sha256(buffer);
    if (actual !== entry.sha256) {
      throw new Error(
        `${entry.source}: 从 ${commit.slice(0, 8)} 读到的内容与 manifest 记录不符` +
          `（期望 ${entry.sha256.slice(0, 12)}…，实际 ${actual.slice(0, 12)}…）。`,
      );
    }
    const dest = join(ROOT, "app/core", entry.source);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, buffer); // Buffer 直写，不转字符串、不加尾换行
  }

  // 台账是我们自己的文档，不是 COPIED；交给 prettier 对齐表格，
  // 否则生成的行与 format-check 的期望不一致。
  const ledger = spliceBlock(readFileSync(LEDGER, "utf8"), renderBlock(copied));
  writeFileSync(
    LEDGER,
    await prettier.format(ledger, {
      ...(await prettier.resolveConfig(LEDGER)),
      parser: "markdown",
    }),
  );
  writeFileSync(
    PRETTIER_IGNORE,
    spliceIgnore(
      readFileSync(PRETTIER_IGNORE, "utf8"),
      renderIgnoreBlock(copied),
    ),
  );
  process.stdout.write(
    `${copied.length} 个 COPIED 已落到 app/core/（基线 ${commit.slice(0, 8)}）\n`,
  );
}

await main();
