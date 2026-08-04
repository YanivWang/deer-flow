/*
  【文件职责】     从可搬运包内部验证 L1 的唯一公共入口。
  【对应 frontend/】 无；M0 新增架构门禁
  【架构位置】     L1 测试
  【主要导出】     无
  【依赖关系】     消费 ../src/index.ts
  【边界与注意】   不测试 M2 尚未实现的 run/session/reducer。
*/

import { describe, expect, it } from "vitest";
import { AGENT_CORE_CONTRACT_VERSION } from "../src/index";

describe("agent-core package", () => {
  it("is a real workspace package with an M0 public export", () => {
    expect(AGENT_CORE_CONTRACT_VERSION).toBe("m0");
  });
});
