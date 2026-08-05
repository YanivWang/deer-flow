/*
  【文件职责】     从签入的 openapi.snapshot.json 生成 app/core/api/types.gen.ts，并提供 --check。
  【对应 frontend/】 无（上游的 REST 信封类型是从 @langchain/langgraph-sdk 借的）
  【架构位置】     构建脚本
  【主要导出】     无（CLI）
  【依赖关系】     openapi-typescript（02 §340 / 04 §267 点名的生成器）
  【边界与注意】   **生成源是签入的快照，不是活着的 Gateway。** 06 §M2 逐字写的是
                   「`openapi-typescript` 从签入的 `openapi.snapshot.json` 生成」
                   与「`make gen-api-types-check` 在 CI 临时生成并 diff」。
                   两句连起来的意思是：check 是**幂等性检查**（同一份快照生成两次
                   结果必须一样），不是「和线上后端对不对得上」。让 CI 去 curl
                   一个跑着的 Gateway，门禁就会随后端部署状态变色——那是环境问题，
                   不是代码问题。

                   快照本身怎么来的、以及它受哪个环境变量影响，写在
                   baseline/openapi.snapshot.README.md 里。刷新快照是一次显式动作。

                   **OpenAPI 不承担 SSE schema（06 原话）。** 流式事件的形状由
                   raw trace 契约管（tests/fixtures/streams/），这里生成的只有
                   REST 信封。指望这份类型能描述 `values` / `messages` 帧，
                   拿到的会是一个空对象。
*/

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const snapshot = join(root, "baseline/openapi.snapshot.json");
const target = join(root, "app/core/api/types.gen.ts");

const HEADER = `/*
  【文件职责】     Gateway REST 信封类型。**生成物，勿手改。**
  【对应 frontend/】 无；上游这些类型是从 @langchain/langgraph-sdk 借的（02 §106 决定移除）
  【架构位置】     L3 类型
  【主要导出】     paths · components · operations（openapi-typescript 的固定三件套）
  【依赖关系】     baseline/openapi.snapshot.json
  【边界与注意】   重新生成：make gen-api-types。漂移检查：make gen-api-types-check。
                   OpenAPI **不覆盖 SSE 动态 schema**（06 §M2）——流式事件的形状
                   由 tests/fixtures/streams/ 的 raw trace 契约管，不在这个文件里。
*/

`;

function generate() {
  const out = mkdtempSync(join(tmpdir(), "deerflow-api-types-"));
  const file = join(out, "types.gen.ts");
  try {
    execFileSync(
      process.execPath,
      [
        join(root, "node_modules/openapi-typescript/bin/cli.js"),
        snapshot,
        "-o",
        file,
      ],
      { cwd: root, stdio: ["ignore", "ignore", "inherit"] },
    );
    return HEADER + readFileSync(file, "utf8");
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

const check = process.argv.includes("--check");
const generated = generate();

if (!check) {
  writeFileSync(target, generated, "utf8");
  console.log(`wrote ${target} (${generated.split("\n").length} lines)`);
  process.exit(0);
}

let current = "";
try {
  current = readFileSync(target, "utf8");
} catch {
  console.error(
    `app/core/api/types.gen.ts is missing. Run \`make gen-api-types\`.`,
  );
  process.exit(1);
}

if (current !== generated) {
  console.error(
    [
      "app/core/api/types.gen.ts is stale relative to baseline/openapi.snapshot.json.",
      "Run `make gen-api-types` and commit the result.",
      "",
      `  checked in : ${current.length} bytes`,
      `  regenerated: ${generated.length} bytes`,
    ].join("\n"),
  );
  process.exit(1);
}
console.log(
  "app/core/api/types.gen.ts matches the checked-in OpenAPI snapshot.",
);
