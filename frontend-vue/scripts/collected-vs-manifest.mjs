#!/usr/bin/env node
/*
  【文件职责】     拿 vitest 真实收集到的测试与 core-test-manifest 的期望分桶逐条对账。
  【对应 frontend/】 无（工具链）
  【架构位置】     构建脚本
  【主要导出】     CLI：默认对账并在不一致时非零退出
  【依赖关系】     vitest list --json；baseline/core-{test-,}manifest.json；lib/test-selection.mjs
  【边界与注意】   这个脚本存在的唯一理由：**不许用「某些测试暂时不收集」换全绿**。
                   `vitest run` 只报告它收集到的东西——少收集一个文件，它照样绿。
                   所以判据必须来自台账而不是运行结果：台账说该有 N 个，就得收集到 N 个，
                   而且要落在期望的 project 上（node/dom 环境不同，跑错地方等于没测）。
                   期望集与 codemod 共用 lib/test-selection.mjs——各算各的就变成自证了。
*/

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { partition, projectOf, targetPathOf } from "./lib/test-selection.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function collect() {
  const raw = execFileSync(
    process.execPath,
    [join(ROOT, "node_modules/vitest/vitest.mjs"), "list", "--json"],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
  );
  // vitest 会在 JSON 前后夹杂 banner，取最外层的数组。
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1)
    throw new Error("vitest list 没有输出 JSON 数组。");
  return JSON.parse(raw.slice(start, end + 1));
}

function main() {
  const landedArg = process.argv
    .slice(2)
    .find((a) => a.startsWith("--landed="));
  const landed = (landedArg ? landedArg.split("=")[1] : "COPIED").split(",");

  const testManifest = JSON.parse(
    readFileSync(join(ROOT, "baseline/core-test-manifest.json"), "utf8"),
  );
  const coreManifest = JSON.parse(
    readFileSync(join(ROOT, "baseline/core-manifest.json"), "utf8"),
  );
  const { portable, waiting } = partition(testManifest, coreManifest, landed);

  const expected = new Map(
    portable.map((entry) => [targetPathOf(entry), projectOf(entry.bucket)]),
  );

  /** 收集到的：文件 → { project, 用例数 } */
  const actual = new Map();
  for (const item of collect()) {
    const rel = relative(ROOT, item.file).split("\\").join("/");
    const seen = actual.get(rel) ?? { projects: new Set(), tests: 0 };
    seen.projects.add(item.projectName);
    seen.tests += 1;
    actual.set(rel, seen);
  }

  const problems = [];

  for (const [path, project] of expected) {
    const hit = actual.get(path);
    if (!hit) {
      problems.push(`台账要求收集但没收集到：${path}`);
      continue;
    }
    const projects = [...hit.projects].sort();
    if (projects.length !== 1 || projects[0] !== project) {
      problems.push(
        `${path} 跑在 project [${projects.join(", ")}]，台账期望 ${project}` +
          "（node 与 dom 环境不同，跑错 project 等于没按该环境测）。",
      );
    }
  }

  for (const path of actual.keys()) {
    if (path.startsWith("tests/unit/core/") && !expected.has(path)) {
      problems.push(`收集到台账里没有的迁移测试：${path}`);
    }
  }

  const total = [...expected.keys()].reduce(
    (sum, path) => sum + (actual.get(path)?.tests ?? 0),
    0,
  );
  const dom = [...expected.values()].filter((p) => p === "dom").length;

  process.stdout.write(
    `landed=${landed.join(",")}\n` +
      `期望搬运 ${expected.size} 个测试文件（node ${expected.size - dom} · dom ${dom}），` +
      `实收 ${total} 个用例\n` +
      `本轮不搬 ${waiting.length} 个（依赖尚未落地）· DEFERRED ${
        testManifest.files.filter((f) => f.bucket === "DEFERRED").length
      } 个\n`,
  );

  if (problems.length) {
    for (const problem of problems) process.stderr.write(`✗ ${problem}\n`);
    process.stderr.write(
      `对账失败：${problems.length} 处。台账是判据，不要靠少收集测试来换全绿。\n`,
    );
    process.exit(1);
  }
  process.stdout.write("收集结果与台账一致\n");
}

main();
