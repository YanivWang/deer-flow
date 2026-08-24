#!/usr/bin/env node
/*
  【文件职责】     从 <repo>/contracts/*.json 生成 app/core/contracts/backend.gen.ts，
                   让后端契约里的枚举、保留字与语法在 Vue 侧只有一份真相。
  【架构位置】     构建脚本
  【主要导出】     CLI：默认写文件；--check 校验签入产物与契约一致
  【依赖关系】     ../contracts/*.json（后端拥有，随 backend/ 同步上游）
  【边界与注意】   契约文件属于后端，**不复制**到本仓——每次生成都从原文件读。
                   后端改了契约，`make gen-contract-constants-check` 就红，
                   这是三层同步方案里唯一**阻断**的一层：它是上游变更能直接
                   让 Vue 功能损坏的路径。
                   产物签入，所以窄 context 的 Docker 构建不需要 contracts/ 也能编译。
*/

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const CONTRACTS = fileURLToPath(new URL("../../contracts/", import.meta.url));
const OUT = fileURLToPath(
  new URL("../app/core/contracts/backend.gen.ts", import.meta.url),
);

function readContract(name) {
  const path = `${CONTRACTS}${name}`;
  if (!existsSync(path)) {
    console.error(`缺少后端契约：${path}`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

const subagent = readContract("subagent_status_contract.json");
const slash = readContract("slash_skill_contract.json");
const runEvents = readContract("run_event_stream_contract.json");

const tuple = (values) =>
  `[\n${values.map((value) => `  ${JSON.stringify(value)},`).join("\n")}\n] as const`;

const aliasEntries = (runEvents.legacy_event_aliases ?? []).map(
  (alias) =>
    `  ${JSON.stringify(alias.event_type)}: ${JSON.stringify(alias.canonical_event_type)},`,
);

const body = `/*
  由 scripts/gen-contract-constants.mjs 从 <repo>/contracts/*.json 生成，勿手改。
  改后端契约后运行 \`make gen-contract-constants\`；\`make verify\` 会校验一致性。
*/

/** 生成时各契约声明的版本号。契约做不兼容变更时这里会跟着变。 */
export const BACKEND_CONTRACT_VERSIONS = {
  subagentStatus: ${JSON.stringify(subagent.version)},
  slashSkill: ${JSON.stringify(slash.version)},
  runEventStream: ${JSON.stringify(runEvents.version)},
} as const;

/** \`ToolMessage.additional_kwargs.subagent_status\` 的合法取值。 */
export const SUBAGENT_STATUS_VALUES = ${tuple(subagent.valid_status_values)};
export type BackendSubagentStatus = (typeof SUBAGENT_STATUS_VALUES)[number];

/** \`subagent_stop_reason\` 的合法取值（附加字段，旧前端读不到也不会坏）。 */
export const SUBAGENT_STOP_REASON_VALUES = ${tuple(subagent.valid_stop_reason_values)};
export type BackendSubagentStopReason = (typeof SUBAGENT_STOP_REASON_VALUES)[number];

/** 占用前导斜杠的 composer 控制命令，永远不能当作技能激活。 */
export const RESERVED_SLASH_SKILL_NAMES = ${tuple(slash.reserved_slash_skill_names)};

/** 后端 \`parse_slash_skill_reference\` 使用的技能名语法。 */
export const SLASH_SKILL_PATTERN_SOURCE = ${JSON.stringify(slash.skill_name_pattern)};

/** run event 的分类维度。 */
export const RUN_EVENT_CATEGORIES = ${tuple(Object.keys(runEvents.categories))};
export type RunEventCategory = (typeof RUN_EVENT_CATEGORIES)[number];

/** 只读兼容：历史 event_type 到当前规范名的映射。新生产者不得使用左边的名字。 */
export const LEGACY_RUN_EVENT_ALIASES = {
${aliasEntries.join("\n")}
} as const;
`;

if (process.argv.includes("--check")) {
  const current = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  if (current === body) {
    console.log("后端契约常量与 contracts/*.json 一致。");
    process.exit(0);
  }
  console.error(
    "后端契约常量已过期：contracts/*.json 变了但 app/core/contracts/backend.gen.ts 没重新生成。\n" +
      "运行 `make gen-contract-constants`，然后检查引用这些常量的代码是否需要跟进。",
  );
  process.exit(1);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, body, "utf8");
console.log(`已生成 ${OUT.split("frontend-vue/")[1]}`);
