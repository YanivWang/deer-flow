/*
  【文件职责】     量「这几轮有没有动过产品面」——C1 收尾判据的机器口径。
  【架构位置】     构建脚本
  【主要导出】     无；CLI
  【依赖关系】     git
  【边界与注意】   **这是判据，不是门禁**：它不进 `make verify`，也不该进。
                   C1 问的是「连着两轮有没有改变用户看得见 / 开发者能执行的东西」，
                   收尾之后没人会再跑它——但**结论必须可复算**，否则又变成
                   「传一个数字」（wave 52 就是这么把十四轮记成三轮的）。

                   口径：对每个 commit，取 `frontend-vue/app/` 下改动的文件，
                   **剥掉注释再比**——只改注释 = 运行时零字节；再看词典与
                   `baseline/` 有没有动。三样都没动，这一轮就没碰产品面。

                   剥注释是**粗口径**，故意的：它会把字符串字面量里的 `//` 也当注释
                   （实测本仓命中 0 次，因为改动本身就少）。**它只用来支持
                   「这一轮什么都没动」这个否定结论**——一旦报出「有差异」，
                   就该去读 diff，而不是信这个脚本的分类。
*/

import { execFileSync } from "node:child_process";

const revs = process.argv.slice(2);
if (revs.length === 0) {
  console.error(
    "用法: node scripts/product-surface-diff.mjs <commit> [<commit> ...]",
  );
  process.exit(2);
}

const strip = (text) =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .replace(/\s+/g, " ")
    .trim();

const git = (args) =>
  execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

let dirty = 0;
for (const rev of revs) {
  const changed = git(["diff", "--name-only", `${rev}^`, rev])
    .split("\n")
    .filter(Boolean);
  const app = changed.filter((file) => file.startsWith("frontend-vue/app/"));
  // 词典 = 真的词典文件；`/i18n/` 下的测试不算（第一版按 `/i18n/` 收口，会把
  // `tests/unit/i18n/*.test.ts` 也算成词典改动——不改任何结论，但口径要准）。
  const data = changed.filter(
    (file) =>
      /^frontend-vue\/baseline\//.test(file) ||
      /^frontend-vue\/app\/core\/i18n\/locales\//.test(file),
  );
  const runtime = [];
  for (const file of app) {
    let before, after;
    try {
      before = git(["show", `${rev}^:${file}`]);
      after = git(["show", `${rev}:${file}`]);
    } catch {
      runtime.push(`${file}（新增或删除）`);
      continue;
    }
    if (strip(before) !== strip(after)) runtime.push(file);
  }
  const clean = runtime.length === 0 && data.length === 0;
  if (!clean) dirty += 1;
  console.log(
    `${rev}  app 改动 ${String(app.length).padStart(2)} 份  ` +
      `运行时差异 ${runtime.length ? runtime.join(" ") : "无"}  ` +
      `词典/baseline ${data.length ? data.join(" ") : "无"}  ` +
      `→ ${clean ? "没碰产品面" : "碰了产品面"}`,
  );
}
console.log(`\n${revs.length} 个 commit 里，${dirty} 个碰了产品面。`);
