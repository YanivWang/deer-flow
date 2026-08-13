/*
  【文件职责】     08 §54 的可移植性验收：临时 consumer workspace 的 clean install + typecheck + 最小 session 测试。
  【对应 frontend/】 无
  【架构位置】     构建脚本
  【主要导出】     无（CLI）
  【依赖关系】     scripts/pnpm.py · packages/agent-core
  【边界与注意】   08 §54 逐字写了「可移植性的验收**不是**『复制目录后能编译』」。
                   上一窗口给包配了独立 tsconfig，那证明的是「包自己能独立类型
                   检查」——**证明不了 `exports` 与 `dependencies` 完整**：
                   自家 tsconfig 是按相对路径 include `src/**` 的，根本不经过
                   `package.json` 的 `exports`；而 `node_modules` 里少声明的依赖
                   在本仓库里会被 workspace 根的 node_modules 兜住，只有换一个
                   没有那层兜底的目录才会暴露。

                   所以这里做三件事，缺一件都不算数：
                     1. `pnpm pack` 打真包 → 只有真的被打进 tarball 的文件才存在；
                     2. 在一个系统临时目录里 clean install（`mkdtemp`，往上
                        找不到本仓库的 node_modules，没有任何兜底）；
                     3. 从 **bare specifier** `@deerflow/agent-core` 消费——
                        深路径 import 会绕过 `exports`，那正是要验的东西。

                   最小 session 测试要**真的跑起来**而不只是编译：类型对但
                   `exports.import` 指错文件，tsc 一样绿。运行时用 esbuild 打包
                   之后交给 node——Node 的类型擦除对 `node_modules` 下的 `.ts`
                   是关闭的，而这个包的 `exports` 指的正是 TS 源码
                   （它是给打包器消费的 workspace 包）。所以"用打包器"不是绕路，
                   就是真实消费方式。

                   pnpm 一律走 `scripts/pnpm.py`（AGENTS.md 的仓库规矩）。
                   它只认 `--dir frontend|frontend-vue`，所以临时目录用 pnpm
                   **自己的** `--dir` 覆盖 cwd：第一个 `--dir` 被 wrapper 吃掉，
                   第二个原样转发给 pnpm。
*/

import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const packageDir = join(root, "packages/agent-core");
const exampleDir = join(root, "examples/agent-core-consumer");

/**
 * consumer 自己的工具链。
 *
 * `typescript` 跟着本仓库走——用另一个版本 typecheck，验的就不是我们这份合同了。
 * `esbuild` 只是"一个打包器"，本仓库没有直接依赖它（pnpm 严格模式下也读不到它的
 * package.json），所以这里写死一个版本；它换了不影响结论。
 */
const rootPkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const typescriptVersion = rootPkg.devDependencies.typescript;

function pnpm(args, { cwd } = {}) {
  execFileSync(
    "python3",
    [
      join(repoRoot, "scripts/pnpm.py"),
      "--dir",
      "frontend-vue",
      ...(cwd ? ["--dir", cwd] : []),
      ...args,
    ],
    { cwd: root, stdio: ["ignore", "inherit", "inherit"] },
  );
}

let tarballDir;
let consumer;
try {
  tarballDir = mkdtempSync(join(tmpdir(), "deerflow-agent-core-pack-"));
  console.log("· pnpm pack");
  pnpm(["pack", "--pack-destination", tarballDir], { cwd: packageDir });
  const tarball = join(
    tarballDir,
    readdirSync(tarballDir).find((name) => name.endsWith(".tgz")),
  );

  consumer = mkdtempSync(join(tmpdir(), "deerflow-agent-core-consumer-"));
  cpSync(join(exampleDir, "src"), join(consumer, "src"), { recursive: true });
  copyFileSync(
    join(exampleDir, "tsconfig.json"),
    join(consumer, "tsconfig.json"),
  );
  copyFileSync(tarball, join(consumer, "deerflow-agent-core.tgz"));
  const examplePackage = JSON.parse(
    readFileSync(join(exampleDir, "package.json"), "utf8"),
  );
  examplePackage.devDependencies.typescript = typescriptVersion;
  writeFileSync(
    join(consumer, "package.json"),
    `${JSON.stringify(examplePackage, null, 2)}\n`,
  );
  // 这个临时目录不在任何 workspace 里，也不该被本仓库的设置影响。
  writeFileSync(join(consumer, ".npmrc"), "ignore-workspace-root-check=true\n");

  console.log("· clean install");
  pnpm(["install", "--no-frozen-lockfile"], { cwd: consumer });

  console.log("· typecheck from the consumer's own tsconfig");
  pnpm(["exec", "tsc", "--noEmit"], { cwd: consumer });

  console.log("· minimal session run");
  pnpm(
    [
      "exec",
      "esbuild",
      "src/main.ts",
      "--bundle",
      "--platform=node",
      "--format=esm",
      "--log-level=warning",
      "--outfile=consumer.mjs",
    ],
    { cwd: consumer },
  );
  const output = execFileSync(
    process.execPath,
    [join(consumer, "consumer.mjs")],
    {
      cwd: consumer,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    },
  );
  process.stdout.write(output);
  if (!output.includes("consumer session OK")) {
    throw new Error("the consumer session did not report success");
  }
  console.log(
    "\n@deerflow/agent-core installs, typechecks and runs from a clean consumer.",
  );
} finally {
  for (const dir of [tarballDir, consumer]) {
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
}
