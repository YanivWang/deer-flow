#!/usr/bin/env node
/*
  【文件职责】     对同一个场景，dump React 与 Vue 的语义 DOM 并比对差异。
  【架构位置】     开发工具（顾问性质，不是门禁）
  【主要导出】     CLI：默认打印差异报告；--json 输出机器可读结果
  【依赖关系】     playwright（本工作区 devDependency）；两个已在跑的 app
  【边界与注意】   **这是唯一可靠的文案与结构判据，词典比对不是。**

                   先试过按词典比对，实测在三个方向上都错：把我误判成「Vue 独创」
                   的 70 条拆开看，30 条其实在 React 词典里（引用扫描漏了）、
                   26 条是 React 在 .tsx 里**硬编码**的可见英文（setup 页、auth
                   回调、browser 面板、artifact 详情、channels 设置都有）、
                   13 条来自第三方库 streamdown。源码里读不出「屏幕上有什么」，
                   因为文字可以来自词典、字面量或依赖包，三条路都得算。

                   `ariaSnapshot()` 读的是渲染后的可访问性树：role + 可访问名 +
                   层级 + 顺序。它天然满足 ARCHITECTURE 里那条判据——不比 class 名、
                   包装元素和 primitive 内部结构，只比用户和辅助技术能感知到的东西。
                   两边用不同组件库，这是唯一能公平比较的粒度。

                   顾问性质、不阻断：它需要 ../frontend 跑起来，而本仓的
                   install/build/test/e2e 都不依赖那个目录（见 make standalone-check）。
*/

import { writeFileSync } from "node:fs";

// 本工作区装的是 `@playwright/test`（`playwright` 只是它的传递依赖，
// 直接 import 会在 pnpm 的严格 node_modules 下解析不到）。
import { chromium } from "@playwright/test";

const REACT_BASE = process.env.DOM_PARITY_REACT_BASE ?? "http://127.0.0.1:3000";
const VUE_BASE = process.env.DOM_PARITY_VUE_BASE ?? "http://127.0.0.1:3100";

/**
 * 只放不需要 Gateway 的公开页。带 workspace 的场景要两边接同一个 replay
 * Gateway，属于下一步——在那之前把范围写死，免得报告里混进「后端没起来」
 * 造成的假差异。
 */
const SCENARIOS = [
  { name: "landing", path: "/" },
  { name: "login", path: "/login" },
  { name: "setup", path: "/setup" },
];

const asJson = process.argv.includes("--json");
const outFlag = process.argv.indexOf("--out");
const outPath = outFlag === -1 ? null : process.argv[outFlag + 1];

/**
 * 归一化 aria 快照。
 *
 * 去掉的都是**两边不可能相同、且用户感知不到**的东西：reka-ui 与 radix 生成的
 * 元素 id、Nuxt/Next 各自的水合标记、以及纯装饰性的空节点。保留 role、可访问名、
 * 层级与顺序——差一条就是真差异。
 */
function normalize(snapshot) {
  return snapshot
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .map((line) =>
      line
        // reka-/radix- 自动生成的 id 每次渲染都不同，且不进可访问名
        .replace(/(reka|radix)-[\w-]+/g, "«id»")
        // 组件库把序号拼进 name 的场合（v-0-2 这类）
        .replace(/-v-\d+(-\d+)*/g, "")
        .replace(/\s{2,}/g, " "),
    )
    .filter((line) => line.trim() !== "" && line.trim() !== "- generic")
    .join("\n");
}

async function snapshotOf(context, base, path) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  try {
    const response = await page.goto(`${base}${path}`, {
      waitUntil: "networkidle",
      timeout: 30_000,
    });
    const status = response?.status() ?? 0;
    const snapshot = await page.locator("body").ariaSnapshot();
    return { status, snapshot: normalize(snapshot), errors };
  } catch (cause) {
    return { status: 0, snapshot: "", errors: [...errors, String(cause)] };
  } finally {
    await page.close();
  }
}

/**
 * 逐行差异，**先去掉缩进**。
 *
 * 保留缩进的话，只要一边多包一层容器（Vue 的登录页外面多一个 `<main>`），
 * 它下面每一行的缩进都变了，于是整棵子树在两侧同时出现——实测把 2 处真差异
 * 刷成 24 行。层级差异本身有价值，但要用树 diff 单独报，不能让它淹没内容差异。
 * 这里只回答「有没有多/少某个可访问节点」。
 */
function diffLines(reactSnapshot, vueSnapshot) {
  const strip = (text) =>
    text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  const react = strip(reactSnapshot);
  const vue = strip(vueSnapshot);
  const count = (lines) => {
    const map = new Map();
    for (const line of lines) map.set(line, (map.get(line) ?? 0) + 1);
    return map;
  };
  const reactCount = count(react);
  const vueCount = count(vue);
  const onlyReact = [];
  const onlyVue = [];
  for (const [line, n] of reactCount) {
    const extra = n - (vueCount.get(line) ?? 0);
    for (let i = 0; i < extra; i++) onlyReact.push(line);
  }
  for (const [line, n] of vueCount) {
    const extra = n - (reactCount.get(line) ?? 0);
    for (let i = 0; i < extra; i++) onlyVue.push(line);
  }
  return { onlyReact, onlyVue };
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
});
const results = [];

for (const scenario of SCENARIOS) {
  const react = await snapshotOf(context, REACT_BASE, scenario.path);
  const vue = await snapshotOf(context, VUE_BASE, scenario.path);
  results.push({
    ...scenario,
    react: { status: react.status, errors: react.errors },
    vue: { status: vue.status, errors: vue.errors },
    ...diffLines(react.snapshot, vue.snapshot),
  });
}

await context.close();
await browser.close();

if (outPath) writeFileSync(outPath, JSON.stringify(results, null, 2));
if (asJson) {
  console.log(JSON.stringify(results, null, 2));
} else {
  console.log(`语义 DOM 对照  React ${REACT_BASE}  ↔  Vue ${VUE_BASE}\n`);
  for (const result of results) {
    const total = result.onlyReact.length + result.onlyVue.length;
    console.log(
      `## ${result.name}  ${result.path}   ` +
        `React ${result.react.status} / Vue ${result.vue.status}   差异 ${total} 行`,
    );
    for (const error of [...result.react.errors, ...result.vue.errors]) {
      console.log(`   ⚠ ${error.slice(0, 140)}`);
    }
    for (const line of result.onlyReact.slice(0, 40))
      console.log(`   React 独有  ${line}`);
    for (const line of result.onlyVue.slice(0, 40))
      console.log(`   Vue   独有  ${line}`);
    const hidden =
      total -
      Math.min(result.onlyReact.length, 40) -
      Math.min(result.onlyVue.length, 40);
    if (hidden > 0) console.log(`   …… 还有 ${hidden} 行`);
    console.log("");
  }
}
