#!/usr/bin/env node
/*
  【文件职责】     报告 ../frontend（上游持续同步的 React 应用）自 marker 以来改了什么，
                   供人工判断哪些行为变更需要在 frontend-vue 里跟进。
  【架构位置】     开发工具（顾问性质，不是门禁）
  【主要导出】     CLI：默认列出漂移；--accept 把 marker 推到当前 HEAD；--check 有漂移时退出 1
  【依赖关系】     git；baseline/upstream-marker.json
  【边界与注意】   这个工具**不阻断构建**，也不要求 frontend-vue 的文件与 React 逐字节一致。
                   它取代了原来的 SHA-256 护城河，原因是那套机制的方向反了：
                   它比对「Vue 副本 vs 冻结基线」，因此 React 前进时结构上看不见，
                   实测已让两个 lark 文件在 CI 全绿的情况下过期。
                   这里比对的是「React 自 marker 以来的全部改动」，覆盖 React 整个源码树，
                   而不只是当初字节相同的那一小部分。
                   frontend/ 不在当前 checkout 里时安静跳过——独立性是硬要求，
                   能不能看见上游不是。
*/

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../../", import.meta.url));
const MARKER = fileURLToPath(
  new URL("../baseline/upstream-marker.json", import.meta.url),
);

/** React 应用里，行为变更需要 Vue 跟进的路径。 */
const WATCHED = ["frontend/src", "frontend/tests/e2e"];

function git(args, options = {}) {
  return execFileSync("git", args, {
    cwd: REPO,
    encoding: "utf8",
    ...options,
  }).trimEnd();
}

function loadMarker() {
  if (!existsSync(MARKER)) return null;
  return JSON.parse(readFileSync(MARKER, "utf8"));
}

function upstreamPresent() {
  return existsSync(
    fileURLToPath(new URL("../../frontend/src", import.meta.url)),
  );
}

const wantAccept = process.argv.includes("--accept");
const wantCheck = process.argv.includes("--check");

if (!upstreamPresent()) {
  console.log("上游 React 应用不在当前 checkout 里，跳过漂移报告。");
  process.exit(0);
}

const marker = loadMarker();
if (!marker) {
  console.error(
    `缺少 marker：${MARKER}\n先运行 make upstream-accept 记录当前已审阅到的位置。`,
  );
  process.exit(1);
}

const head = git(["rev-parse", "HEAD"]);

if (wantAccept) {
  const next = {
    $comment:
      "已审阅到的上游位置。--accept 表示「这个 commit 之前 React 的改动我都看过并决定了跟进与否」，不表示两边代码相同。",
    commit: head,
    acceptedAt: new Date().toISOString(),
    watched: WATCHED,
  };
  writeFileSync(MARKER, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  console.log(`marker 更新为 ${head.slice(0, 12)}`);
  process.exit(0);
}

let reachable = true;
try {
  git(["cat-file", "-e", `${marker.commit}^{commit}`], { stdio: "pipe" });
} catch {
  reachable = false;
}
if (!reachable) {
  console.log(
    `marker commit ${marker.commit.slice(0, 12)} 不在当前 clone 里（浅克隆？），跳过。`,
  );
  process.exit(0);
}

const range = `${marker.commit}..${head}`;
const commits = git(["log", "--oneline", range, "--", ...WATCHED]);
const stat = git(["diff", "--stat", range, "--", ...WATCHED]);
const files = git(["diff", "--name-only", range, "--", ...WATCHED])
  .split("\n")
  .filter(Boolean);

console.log(
  `上游漂移报告  ${marker.commit.slice(0, 12)} → ${head.slice(0, 12)}`,
);
console.log(`监视路径：${WATCHED.join("  ")}`);
console.log("");

if (files.length === 0) {
  console.log("无漂移：marker 之后上游没有改动被监视的路径。");
  process.exit(0);
}

console.log(`改动文件 ${files.length} 个：`);
console.log("");
console.log(commits);
console.log("");
console.log(stat);
console.log("");
console.log(
  "逐个决定是否需要在 frontend-vue 跟进；决定完运行 make upstream-accept 推进 marker。",
);
console.log(
  "跟进方式是在 Vue 侧用自己的实现表达同一个可观察行为，不是把文件复制过来。",
);

process.exitCode = wantCheck ? 1 : 0;
