#!/usr/bin/env node
/*
  【文件职责】     统计生产客户端 JS 的 raw/gzip 体积，并钉住 M7 运行时安全分包预算。
  【对应 frontend/】 无（构建产物门禁）
  【架构位置】     构建脚本
  【主要导出】     CLI：读取 .output/public/_nuxt，超预算退出 1
  【依赖关系】     Nuxt production build；Node zlib
  【边界与注意】   这里只给现有动态 import 生成的 chunk 命名和计量，不创建 manual
                   chunk，也不改 Rolldown 执行顺序。CodeMirror 当前未安装/消费，
                   所以它的预算刻意为零；未来引入必须显式更新实现和预算。
*/

import { readdirSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ASSET_DIR = join(ROOT, ".output/public/_nuxt");

const budgets = {
  "vendor-vue": { totalRaw: 400_000, totalGzip: 90_000, maxRaw: 200_000 },
  "vendor-markdown": {
    totalRaw: 1_100_000,
    totalGzip: 340_000,
    // ArtifactPanel deliberately stays synchronous; keep measured headroom
    // without forcing another component boundary solely to satisfy this gate.
    maxRaw: 360_000,
  },
  "vendor-codemirror": { totalRaw: 0, totalGzip: 0, maxRaw: 0 },
  // Typed dictionaries deliberately retain the React suggestion icon shape,
  // so their chunk also contains a small lucide subset. Classify i18n before
  // vendor-ui and budget the complete locale payload instead of hiding it in
  // the Reka/lucide accessibility bucket.
  "vendor-i18n": { totalRaw: 120_000, totalGzip: 45_000, maxRaw: 120_000 },
  // WP-11 mounts Reka dialog/dropdown primitives in the workspace shell. Keep
  // measured headroom for that accessibility payload while the independent
  // whole-client and per-chunk ceilings continue to catch broad regressions.
  "vendor-ui": { totalRaw: 250_000, totalGzip: 80_000, maxRaw: 150_000 },
};
const overallBudget = {
  totalRaw: 14_500_000,
  totalGzip: 3_300_000,
  maxRaw: 800_000,
  maxGzip: 240_000,
};

function sum(items, key) {
  return items.reduce((total, item) => total + item[key], 0);
}

function format(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

const assets = readdirSync(ASSET_DIR)
  .filter((name) => name.endsWith(".js"))
  .map((name) => {
    const contents = readFileSync(join(ASSET_DIR, name));
    return {
      name,
      raw: contents.byteLength,
      gzip: gzipSync(contents, { level: 9 }).byteLength,
    };
  });

if (assets.length === 0) {
  throw new Error(`No production JavaScript assets found in ${ASSET_DIR}`);
}

const failures = [];
for (const [group, budget] of Object.entries(budgets)) {
  const grouped = assets.filter((asset) => asset.name.startsWith(`${group}-`));
  const totalRaw = sum(grouped, "raw");
  const totalGzip = sum(grouped, "gzip");
  const maxRaw = Math.max(0, ...grouped.map((asset) => asset.raw));
  console.log(
    `${group.padEnd(19)} ${String(grouped.length).padStart(3)} chunks  ` +
      `raw ${format(totalRaw).padStart(11)}  gzip ${format(totalGzip).padStart(11)}  ` +
      `max ${format(maxRaw).padStart(11)}`,
  );
  for (const key of ["totalRaw", "totalGzip", "maxRaw"]) {
    const actual = { totalRaw, totalGzip, maxRaw }[key];
    if (actual > budget[key]) {
      failures.push(`${group}.${key}: ${actual} > ${budget[key]}`);
    }
  }
}

const totalRaw = sum(assets, "raw");
const totalGzip = sum(assets, "gzip");
const maxRaw = Math.max(...assets.map((asset) => asset.raw));
const maxGzip = Math.max(...assets.map((asset) => asset.gzip));
console.log(
  `${"all-client-js".padEnd(19)} ${String(assets.length).padStart(3)} chunks  ` +
    `raw ${format(totalRaw).padStart(11)}  gzip ${format(totalGzip).padStart(11)}  ` +
    `max ${format(maxRaw).padStart(11)} / ${format(maxGzip)} gzip`,
);
for (const key of ["totalRaw", "totalGzip", "maxRaw", "maxGzip"]) {
  const actual = { totalRaw, totalGzip, maxRaw, maxGzip }[key];
  if (actual > overallBudget[key]) {
    failures.push(`all-client-js.${key}: ${actual} > ${overallBudget[key]}`);
  }
}

if (failures.length) {
  console.error(`Asset budget exceeded:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log(
  "Asset budget passed; CodeMirror remains absent until editor parity is implemented explicitly.",
);
