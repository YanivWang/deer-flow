#!/usr/bin/env node
/*
  【文件职责】     跑 vue-tsc，并把「COPIED 已落地、它依赖的 RETYPED 还没落地」造成的
                   已知报错钉成一份会缩小的预算表；预算之外的报错一律红。
  【对应 frontend/】 无（工具链）
  【架构位置】     构建脚本
  【主要导出】     CLI：--refresh 重建预算表；默认校验
  【依赖关系】     vue-tsc；baseline/typecheck-known.json
  【边界与注意】   M1 按分类分窗口推进，COPIED 先落地必然出现一段
                   「引用了还没搬过来的模块」的红。把 typecheck 移出 verify
                   会连带放过真正的类型错误——那是拿门禁换绿。
                   所以改成钉预算：**多一条报错红，少一条也红**。
                   少一条也红是关键：RETYPED 落地后预算必须显式缩小并进 review，
                   而不是悄悄留着一份过时的豁免。M1 收口时这张表必须为空。
*/

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BUDGET = join(ROOT, "baseline/typecheck-known.json");

/** `app/core/x.ts(2,15): error TS2305: ...` → 去掉行列，保留文件+错误码+文本。 */
const LINE = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/;

function runTsc() {
  try {
    execFileSync(
      process.execPath,
      [join(ROOT, "node_modules/vue-tsc/bin/vue-tsc.js"), "--noEmit"],
      { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    );
    return [];
  } catch (error) {
    const output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
    if (!output.includes("error TS")) {
      process.stderr.write(output);
      throw new Error("vue-tsc 失败但没有输出可解析的 TS 报错。", {
        cause: error,
      });
    }
    return output.split("\n").flatMap((line) => {
      const match = LINE.exec(line.trim());
      // 行列号刻意丢掉：我们自己的文件被 prettier 动一下就会整体位移，
      // 而「哪个文件、哪个错误码、哪条消息」已经足够精确地指认一条报错。
      return match ? [`${match[1]} :: ${match[4]} :: ${match[5]}`] : [];
    });
  }
}

function tally(keys) {
  const counts = {};
  for (const key of keys) counts[key] = (counts[key] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort());
}

function main() {
  const refresh = process.argv.slice(2).includes("--refresh");
  const actual = tally(runTsc());

  if (refresh) {
    writeFileSync(
      BUDGET,
      `${JSON.stringify(
        {
          $comment:
            "COPIED 先于 RETYPED 落地造成的已知类型报错。由 `make typecheck-refresh` 生成。" +
            "M1 收口时必须为空——每搬完一批 RETYPED 就该缩小一次。",
          total: Object.values(actual).reduce((a, b) => a + b, 0),
          errors: actual,
        },
        null,
        2,
      )}\n`,
    );
    process.stdout.write(
      `预算表已重建：${Object.values(actual).reduce((a, b) => a + b, 0)} 条已知报错\n`,
    );
    return;
  }

  const known = JSON.parse(readFileSync(BUDGET, "utf8")).errors;
  const problems = [];
  for (const [key, count] of Object.entries(actual)) {
    const allowed = known[key] ?? 0;
    if (count > allowed) {
      problems.push(`新增（预算 ${allowed}，实际 ${count}）：${key}`);
    }
  }
  for (const [key, allowed] of Object.entries(known)) {
    const count = actual[key] ?? 0;
    if (count < allowed) {
      problems.push(
        `已修复但预算未更新（预算 ${allowed}，实际 ${count}）：${key}`,
      );
    }
  }

  const total = Object.values(actual).reduce((a, b) => a + b, 0);
  if (problems.length) {
    for (const problem of problems) process.stderr.write(`✗ ${problem}\n`);
    process.stderr.write(
      "预算之外的类型报错。若是搬运推进导致的合法变化，" +
        "跑 `make typecheck-refresh` 并把 diff 交 review。\n",
    );
    process.exit(1);
  }
  process.stdout.write(
    total === 0
      ? "类型检查通过，预算表为空\n"
      : `类型检查符合预算：${total} 条已知报错（全部因 RETYPED 尚未落地）\n`,
  );
}

main();
