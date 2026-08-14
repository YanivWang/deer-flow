/*
  【文件职责】     守住行为合同的条目格式、唯一性和 A–N 全组覆盖。
  【对应 frontend/】 无（本仓自写的护栏）
  【架构位置】     门禁测试
  【主要导出】     无
  【依赖关系】     frontend-vue/BEHAVIOR_CONTRACTS.md
  【边界与注意】   本门禁只验证合同结构，行为正确性仍由对应 unit/E2E/协议测试负责。
*/

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const invariants = readFileSync(
  fileURLToPath(new URL("../../BEHAVIOR_CONTRACTS.md", import.meta.url)),
  "utf8",
);

/** 05 的条目行长这样：`| A1  | …` 或 `| **L9**  | …`（加粗的是后补的条目）。 */
function declaredInvariants(): string[] {
  const found: string[] = [];
  for (const line of invariants.split("\n")) {
    if (!line.startsWith("|")) continue;
    const first = (line.split("|")[1] ?? "").replaceAll("*", "").trim();
    if (/^[A-N]\d+$/.test(first)) found.push(first);
  }
  return found;
}

describe("Vue 行为合同结构", () => {
  const declared = declaredInvariants();

  it("读取到完整的 A–N 合同，而不是解析失败后假绿", () => {
    expect(declared.length).toBeGreaterThanOrEqual(110);
    expect(new Set(declared.map((id) => id[0])).size).toBe(14);
  });

  it("条目 id 唯一", () => {
    const seen = new Map<string, number>();
    for (const id of declared) seen.set(id, (seen.get(id) ?? 0) + 1);
    expect(
      [...seen].filter(([, count]) => count > 1).map(([id]) => id),
    ).toEqual([]);
  });
});
