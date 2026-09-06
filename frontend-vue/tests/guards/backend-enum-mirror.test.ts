/*
  【文件职责】     钉住本仓抄下来的**后端枚举**——头里写着「全集」的那几张表，
                   必须与 `../backend` 里的枚举逐个相等。
  【架构位置】     门禁测试
  【主要导出】     无；Vitest cases
  【依赖关系】     scripts/lib/backend-source.mjs · app/core/agent-deerflow/run-protocol.ts
  【边界与注意】   与 `gen-contract-constants` 分工：那边管**签入在 contracts/ 里的
                   契约**（后端明确对外承诺的部分），这边管「后端源码里有、契约里
                   没有、而本仓照抄了一份并声称是全集」的枚举。

                   **为什么值得钉**：`DEERFLOW_DURABLE_STATUS` 的注释写着
                   「Gateway 的 durable run status 全集」。wave 106 实测它与
                   `RunStatus` 六个成员一致——**但没有任何机器在对**，后端加一个
                   状态不会有任何征兆。后果不是崩溃（`inspect` 把不认识的 status
                   当作「还没到终态」），而是**停止操作在那个状态上永远收敛不了**，
                   要靠有界轮询兜底。

                   **只钉成员集合，不钉映射。** status → outcome 是一条冻结决策
                   （08 §258，`pending`/`running` 不是终态所以没有 outcome），
                   后端加一个状态时该映射成什么只有人能决定；机器能替人做的是
                   **让他不能忘**。

                   **`DEERFLOW_WIRE_EVENTS` 有意不在这里**（wave 107 量过）：
                   它的头同样写着「全集」，但后端**没有**对应的枚举——wire 名字
                   散在 `bridge.publish(run_id, <mode>)` 的调用点上，实测只有
                   `values` / `messages` 两个是字面量，其余走变量。照这个扫出来的
                   集合会漏，做成门禁就是一条会误报的规则。**别再试第二次**，
                   除非后端那边先有了枚举。

                   后端不在 checkout 里时整组跳过；**后端在、而那份文件被挪走了会红**
                   （两件事分开，理由见 scripts/lib/backend-source.mjs 的头）。
*/

import { describe, expect, it } from "vitest";

import { readBackendSource } from "../../scripts/lib/backend-source.mjs";
import { DEERFLOW_DURABLE_STATUS } from "@/core/agent-deerflow/run-protocol";

const RUN_STATUS_SOURCE = "packages/harness/deerflow/runtime/runs/schemas.py";

const schemas = readBackendSource(RUN_STATUS_SOURCE);

/** `class Foo(StrEnum):` 到下一个顶层声明之间的那一段。 */
function enumBlock(source: string, className: string): string {
  const start = new RegExp(`^class ${className}\\(StrEnum\\):`, "m").exec(
    source,
  );
  if (!start) return "";
  const rest = source.slice(start.index);
  const end = rest.slice(1).search(/^(class|def|@)/m);
  return end === -1 ? rest : rest.slice(0, end + 1);
}

/** StrEnum 成员的字面量取值。 */
function enumValues(source: string, className: string): string[] {
  return [
    ...enumBlock(source, className).matchAll(/^\s{4}\w+\s*=\s*"([a-z_]+)"/gm),
  ].map((match) => match[1] as string);
}

describe.skipIf(schemas === null)("后端枚举的镜像", () => {
  it("找得到 RunStatus，而且不是空的（形状先断言再计算）", () => {
    const values = enumValues(schemas as string, "RunStatus");
    expect(
      values.length,
      `${RUN_STATUS_SOURCE} 里没解析出 RunStatus 成员——枚举改写法了，先修解析`,
    ).toBeGreaterThan(3);
  });

  it("DEERFLOW_DURABLE_STATUS 的键就是后端 RunStatus 的成员", () => {
    const backend = enumValues(schemas as string, "RunStatus").sort();
    const mirrored = Object.keys(DEERFLOW_DURABLE_STATUS).sort();
    expect(
      mirrored,
      "后端的 run status 变了：往 DEERFLOW_DURABLE_STATUS 里补上它，" +
        "并决定它映射到 completed / cancelled / failed 还是 null（不是终态）",
    ).toEqual(backend);
  });

  it("只有非终态映射成 null，且它们确实是后端的非终态", () => {
    /*
      这一条不从后端算，只钉「本仓这张表内部自洽」：映射成 null 的必须恰好是
      pending / running（08 §258 的冻结决策），其余必须落在内核的三个终态里。
      后端加状态时上一条会先红，人做完决定之后这一条保证他没把 null 用成兜底。
    */
    const nonTerminal = Object.entries(DEERFLOW_DURABLE_STATUS)
      .filter(([, outcome]) => outcome === null)
      .map(([status]) => status)
      .sort();
    expect(nonTerminal).toEqual(["pending", "running"]);

    const outcomes = Object.values(DEERFLOW_DURABLE_STATUS).filter(
      (outcome) => outcome !== null,
    );
    expect(outcomes.length).toBeGreaterThan(2);
    for (const outcome of outcomes) {
      expect(["completed", "cancelled", "failed"]).toContain(outcome);
    }
  });
});
