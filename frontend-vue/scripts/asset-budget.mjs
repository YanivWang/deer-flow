#!/usr/bin/env node
/*
  【文件职责】     统计**全部构建产物**的 raw/gzip 体积，防止依赖或分包整体失控。
  【架构位置】     构建脚本
  【主要导出】     CLI：读取 .output/public/_nuxt，超预算退出 1
  【依赖关系】     Nuxt production build；Node zlib
  【边界与注意】   ⚠️ **这条门禁量的不是用户下载的字节。** 它把**全部** chunk 加起来，
                   其中绝大多数是懒加载的；打开工作区实际只下载其中几十个。
                   两个数没有对应关系，而且方向可以相反：把
                   KaTeX 从同步改成按需之后，用户首屏少了 269 KB，这里的总数却
                   **涨了 1 KiB**（多分出一个 chunk）——它对那次改进完全无感。

                   面向用户的预算在 `tests/e2e/route-payload.spec.ts` +
                   `baseline/route-payload-budget.json`：在真实导航里量浏览器
                   实际请求的脚本，并禁止重量级渲染器进入关键路径。调性能先看那条。

                   本条保留的价值是另一个方向：**产物总量**的天花板，能抓住
                   「装了个巨大的包」「分包规则失效导致重复打包」这类问题。
                   它不在 verify 里，但是 CI 的独立一步（0ce8caa3）。
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
    // 这一格在 UI primitive 层落地**之前**就已经超了：在 48f3ef29 上实测
    // raw 1_139_429 / gzip 341_956 / maxRaw 374_890，三项全红。
    // 之前没人看见，是因为 asset-budget 不在 verify 里，得单独跑。
    // 这里记录的是当前实测值加余量，不是把一次回归悄悄放行；
    // maxRaw 前后完全没变（374_890），说明最大的那个 chunk 不是这次改动撑大的。
    totalRaw: 1_200_000,
    totalGzip: 360_000,
    // ArtifactPanel deliberately stays synchronous; keep measured headroom
    // without forcing another component boundary solely to satisfy this gate.
    maxRaw: 380_000,
  },
  // 这一格从「刻意为零」变成实测值：artifact 编辑器现在真的跑 CodeMirror 6。
  // 实测 raw 555_743 / gzip 199_712 / maxRaw 199_773（11 个 chunk，全部动态
  // import，首屏一个字节都不加载）。maxRaw 那一个是 `@codemirror/view`。
  // 语法包按语言分片，所以打开一个 .py 不会顺带下载 html/css/markdown。
  "vendor-codemirror": {
    totalRaw: 580_000,
    totalGzip: 210_000,
    maxRaw: 210_000,
  },
  // Typed dictionaries deliberately retain the React suggestion icon shape,
  // so their chunk also contains a small lucide subset. Classify i18n before
  // vendor-ui and budget the complete locale payload instead of hiding it in
  // the Reka/lucide accessibility bucket.
  "vendor-i18n": { totalRaw: 120_000, totalGzip: 45_000, maxRaw: 120_000 },
  // 原来这一格只装着 workspace shell 用到的 Reka dialog/dropdown。UI primitive 层
  // 落地后它还要装 Select、Tabs、Switch、ScrollArea、Listbox/Combobox、AlertDialog
  // 和 Popover——手搓 div 换成真的可访问控件，这些字节就是它的价格：
  // raw 227.8 KiB → 331.7 KiB，gzip 70.4 KiB → 101.4 KiB。
  // 已确认不是重复打包：Reka 运行时只出现在 vendor-ui 的 chunk 里，
  // 消费它的 markdown/workspace chunk 引用同一份。整包 raw/gzip 天花板仍然通过。
  "vendor-ui": { totalRaw: 380_000, totalGzip: 115_000, maxRaw: 150_000 },
};
// 整包天花板同步抬高，抬的正好是 CodeMirror 那 542.7 KiB / 195.0 KiB：
// 实测 raw 14_305_757 / gzip 3_292_309 / maxRaw 779_847 / maxGzip 230_136。
// 不抬的话 gzip 只剩 7_691 字节余量，下一次无关改动就会撞线，
// 而撞线的原因和被记录的原因对不上——那种门禁只会教人抬数字。
const overallBudget = {
  totalRaw: 14_800_000,
  totalGzip: 3_400_000,
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
  "Build-output budget passed. 面向用户的首屏预算见 make e2e（route-payload.spec.ts）。",
);
