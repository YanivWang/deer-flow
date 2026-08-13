/*
  【文件职责】     检查本仓维护源码是否包含六段式文件头。
  【对应 frontend/】 无；M8 新增架构守卫
  【架构位置】     构建脚本
  【主要导出】     无（CLI）
  【依赖关系】     app/core/PROVENANCE.md · app/** · packages/agent-core/src/**
  【边界与注意】   class=COPIED 必须跳过；不得通过刷新 baseline 掩盖缺头。
*/

import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const provenance = readFileSync(join(root, "app/core/PROVENANCE.md"), "utf8");
const copied = new Set(
  [...provenance.matchAll(/^\| `([^`]+)` \| `COPIED`/gm)].map(
    (match) => `app/core/${match[1]}`,
  ),
);
const labels = [
  "【文件职责】",
  "【对应 frontend/】",
  "【架构位置】",
  "【主要导出】",
  "【依赖关系】",
  "【边界与注意】",
];

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return [".ts", ".vue"].includes(extname(entry.name)) ? [path] : [];
  });
}

const files = [
  ...sourceFiles(join(root, "app")),
  ...sourceFiles(join(root, "packages/agent-core/src")),
];
const violations = [];
for (const file of files) {
  const path = relative(root, file);
  if (copied.has(path)) continue;
  const source = readFileSync(file, "utf8");
  const missing = labels.filter((label) => !source.includes(label));
  if (missing.length > 0) violations.push(`${path}: ${missing.join(" ")}`);
}

if (violations.length > 0) {
  console.error("文件头检查失败：");
  console.error(violations.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `文件头检查通过：${files.length - copied.size} 个本仓维护源码，跳过 ${copied.size} 个 COPIED 文件`,
  );
}
