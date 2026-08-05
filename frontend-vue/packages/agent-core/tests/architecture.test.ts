/*
  【文件职责】     从可搬运包内部验证 L1 的唯一公共入口。
  【对应 frontend/】 无；M0 新增架构门禁
  【架构位置】     L1 测试
  【主要导出】     无
  【依赖关系】     消费 ../src/index.ts
  【边界与注意】   本文件只管「公共入口在不在、版本对不对」。transport / session /
                   store 的行为测试各自成文件，不要往这里堆——它是包边界的守卫，
                   不是 L1 的测试总入口。

                   版本常量跟着里程碑走，M2 起为 `m2`。它不是装饰：消费方拿到包
                   之后靠它判断自己拿的是哪一版合同。改它要同时改 08。
*/

import { describe, expect, it } from "vitest";
import { AGENT_CORE_CONTRACT_VERSION } from "../src/index";

describe("agent-core package", () => {
  it("is a real workspace package with an M2 public export", () => {
    expect(AGENT_CORE_CONTRACT_VERSION).toBe("m2");
  });
});
