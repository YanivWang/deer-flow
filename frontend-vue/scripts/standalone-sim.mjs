#!/usr/bin/env node
/*
  【文件职责】     验收判据的**动态**那一半：真把 ../frontend 移出 checkout，
                   把 CROSS_APP_BY_DESIGN 表里点名的每一条跑一遍，再移回来。
  【架构位置】     构建脚本
  【主要导出】     CLI：默认跑 script + test 两类；--with-e2e 再加 make e2e-parity
  【依赖关系】     scripts/lib/cross-app-by-design.mjs（表的唯一事实源）· vitest · git
  【边界与注意】   **它会 rename 兄弟应用目录**（`<repoRoot>/frontend` →
                   `<repoRoot>/.frontend-standalone-sim-parked`），跑完在 finally 里
                   移回来，SIGINT / 未捕获异常 / process exit 三条路径上都挂了还原。
                   硬杀（SIGKILL）之后 checkout 会停在「兄弟应用不见了」的状态——
                   **下一次启动会先自愈**，而且这个状态在 `git status` 上是几百行删除，
                   不会安静地留在那里。

                   **有意不进 `verify`**：verify 不该动文件系统，而且这个脚本与任何
                   构建/测试**不能并发**（Nuxt 构建锁 + 它在挪目录）。它是收工清单的
                   一项，和 `e2e-backend`、`asset-budget` 同级。

                   **为什么要有它**：`standalone-check` 是静态证明，证的是「没有代码级
                   跨应用引用」。wave 83 第一次真做这个实验时，BLOCKING 已经是 0
                   整整几十轮，而 `make verify` 当场红——`upstream-key-coverage.test.ts`
                   的 `describe.skipIf` 工厂函数里那句 readFileSync 照样执行。
                   **静态证明和「移走之后还能跑」是两件事。**

                   **它自己不进 `CROSS_APP_BY_DESIGN`**：那张表是 BLOCKING 的豁免名单，
                   而本脚本按目录名 `join(REPO, …)` 解析兄弟应用，撞不上
                   `standalone-check` 那条**要求带斜杠**的路径正则，一处 BLOCKING 都不产生。
                   给一个零命中的文件挂豁免就是死配置——下一个人只会以为它真的被豁免过
                   （清单腐烂的老路，线索 186）。要找「谁在动兄弟应用」，看这里。
*/

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { CROSS_APP_BY_DESIGN, KINDS } from "./lib/cross-app-by-design.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const REPO = fileURLToPath(new URL("../../", import.meta.url));
const SIBLING = join(REPO, "frontend");
const PARKED = join(REPO, ".frontend-standalone-sim-parked");

const withE2e = process.argv.includes("--with-e2e");

let parked = false;

function restore() {
  if (!parked) return;
  if (existsSync(PARKED) && !existsSync(SIBLING)) renameSync(PARKED, SIBLING);
  parked = false;
}

process.on("exit", restore);
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    restore();
    process.exit(130);
  });
}
process.on("uncaughtException", (error) => {
  restore();
  console.error(error);
  process.exit(1);
});

/** 上一次跑崩在半路时，先把兄弟应用放回去。 */
function selfHeal() {
  if (!existsSync(PARKED)) return;
  if (existsSync(SIBLING)) {
    console.error(
      `两个都在，人工处理：\n  ${SIBLING}\n  ${PARKED}\n` +
        "（说明上一次跑到一半时有人手动把兄弟应用放回去了。确认哪一份是要的，删掉另一份。）",
    );
    process.exit(1);
  }
  renameSync(PARKED, SIBLING);
  console.log(`上一次跑没还原干净，已自愈：${SIBLING} 放回去了。\n`);
}

function run(command, args, options = {}) {
  try {
    const stdout = execFileSync(command, args, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    });
    return { code: 0, stdout };
  } catch (error) {
    return {
      code: error.status ?? 1,
      stdout: `${error.stdout ?? ""}${error.stderr ?? ""}`,
    };
  }
}

const entries = Object.entries(CROSS_APP_BY_DESIGN);
const unknown = entries.filter(([, value]) => !KINDS.includes(value.kind));
if (unknown.length > 0) {
  console.error(
    `表里有没分类的条目：${unknown.map(([file]) => file).join(", ")}`,
  );
  process.exit(1);
}

const scripts = entries.filter(([, v]) => v.kind === "script").map(([f]) => f);
const tests = entries.filter(([, v]) => v.kind === "test").map(([f]) => f);
const data = entries.filter(([, v]) => v.kind === "data").map(([f]) => f);
const e2e = entries.filter(([, v]) => v.kind === "e2e").map(([f]) => f);

const results = [];

/*
  表里点名的文件必须真的在。少了这一条，一个被删掉/改名的条目会一路安静下去：
  `data` 那四条根本不跑，`test` 那几条会让 vitest 报「没有匹配的测试文件」——
  两种都不指向出问题的那一行。
*/
const missing = entries
  .map(([file]) => file)
  .filter((file) => !existsSync(join(ROOT, file)));
if (missing.length > 0) {
  console.error(
    `表里点名的文件不存在（改名了还是删了？）：\n  ${missing.join("\n  ")}`,
  );
  process.exit(1);
}

selfHeal();

const siblingPresent = existsSync(SIBLING);
if (siblingPresent) {
  console.log(`把兄弟应用移开：${SIBLING}\n            →   ${PARKED}`);
  console.log(`跑崩了就手动还原：mv "${PARKED}" "${SIBLING}"\n`);
  renameSync(SIBLING, PARKED);
  parked = true;
} else {
  console.log("兄弟应用本来就不在这个 checkout 里，直接跑（不 park）。\n");
}

try {
  // ── script：缺席时必须 exit 0 ──────────────────────────────────────────
  for (const file of scripts) {
    const { code, stdout } = run("node", [file]);
    results.push({
      file,
      kind: "script",
      ok: code === 0,
      detail: code === 0 ? stdout.trim().split("\n")[0] : `exit ${code}`,
    });
  }

  // ── test：一次 vitest 跑完，逐文件核对「跑到了、没红」 ─────────────────
  const outDir = mkdtempSync(join(tmpdir(), "standalone-sim-"));
  const outFile = join(outDir, "vitest.json");
  const vitest = run(process.env.PYTHON ?? "python3", [
    "../scripts/pnpm.py",
    "--dir",
    "frontend-vue",
    "exec",
    "vitest",
    "run",
    ...tests,
    "--reporter=json",
    `--outputFile=${outFile}`,
  ]);

  let report = null;
  try {
    report = JSON.parse(readFileSync(outFile, "utf8"));
  } catch {
    report = null;
  }
  rmSync(outDir, { recursive: true, force: true });

  if (report === null) {
    for (const file of tests) {
      results.push({
        file,
        kind: "test",
        ok: false,
        detail: `vitest 没产出报告（exit ${vitest.code}）——看上面的输出`,
      });
    }
    if (vitest.code !== 0) console.log(vitest.stdout);
  } else {
    // 【坑】只看 vitest 的退出码不够：一个文件**根本没被收集**时退出码可以是 0。
    // 所以逐个文件在报告里找它，找不到就算红。
    const byFile = new Map();
    for (const suite of report.testResults ?? []) {
      const relative = suite.name.startsWith(ROOT)
        ? suite.name.slice(ROOT.length)
        : suite.name;
      byFile.set(relative, suite);
    }
    for (const file of tests) {
      const suite = byFile.get(file);
      if (suite === undefined) {
        results.push({
          file,
          kind: "test",
          ok: false,
          detail: "vitest 报告里没有这个文件——它没被收集",
        });
        continue;
      }
      const cases = suite.assertionResults ?? [];
      const failed = cases.filter((c) => c.status === "failed").length;
      const skipped = cases.filter(
        (c) =>
          c.status === "pending" ||
          c.status === "skipped" ||
          c.status === "todo",
      ).length;
      const passed = cases.length - failed - skipped;
      const ok = suite.status !== "failed" && failed === 0;
      results.push({
        file,
        kind: "test",
        ok,
        detail:
          !ok && cases.length === 0
            ? "整个文件没跑起来——收集阶段就炸了（一条用例都没注册）"
            : `${passed} 过 / ${skipped} 跳过 / ${failed} 红`,
      });
    }
  }

  // ── e2e：整组跳过（贵，默认不跑）────────────────────────────────────────
  for (const file of e2e) {
    if (!withE2e) {
      results.push({
        file,
        kind: "e2e",
        ok: true,
        skipped: true,
        detail: "要跑加 --with-e2e（会起 Nuxt preview，约 1 分钟）",
      });
      continue;
    }
    const parity = run("make", ["e2e-parity"]);
    const line = /(\d+) skipped/.exec(parity.stdout);
    results.push({
      file,
      kind: "e2e",
      ok: parity.code === 0,
      detail:
        parity.code === 0
          ? `make e2e-parity exit 0，${line ? `${line[1]} 条跳过` : "跳过条数没解析出来"}`
          : `make e2e-parity exit ${parity.code}`,
    });
  }
} finally {
  restore();
}

for (const file of data) {
  results.push({
    file,
    kind: "data",
    ok: true,
    skipped: true,
    detail: "纯数据，没有可执行行为",
  });
}

const order = { script: 0, test: 1, e2e: 2, data: 3 };
results.sort(
  (a, b) => order[a.kind] - order[b.kind] || a.file.localeCompare(b.file),
);

console.log("兄弟应用缺席时，表里每一条的实际表现：\n");
for (const row of results) {
  const mark = row.skipped ? "–" : row.ok ? "✓" : "✗";
  console.log(
    `  ${mark} [${row.kind.padEnd(6)}] ${row.file}\n        ${row.detail}`,
  );
}

const failures = results.filter((row) => !row.ok);
console.log("");
console.log(
  `  跑过 ${results.filter((r) => !r.skipped).length} 条，` +
    `未跑 ${results.filter((r) => r.skipped).length} 条，` +
    `红 ${failures.length} 条。`,
);
if (existsSync(SIBLING)) console.log(`  兄弟应用已还原：${SIBLING}`);
else console.error(`  **兄弟应用没还原**，手动跑：mv "${PARKED}" "${SIBLING}"`);

process.exitCode = failures.length > 0 || !existsSync(SIBLING) ? 1 : 0;
