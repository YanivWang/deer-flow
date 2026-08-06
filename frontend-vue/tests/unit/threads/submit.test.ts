/*
  【文件职责】     提交请求体的构造：run context 的档位推导与附件透传。
  【对应 frontend/】 tests/unit/core/threads/send-message.test.ts（部分）
  【架构位置】     L3 测试
  【主要导出】     无
  【依赖关系】     app/core/threads/submit.ts
  【边界与注意】   `buildRunContext` 在上游是**两处逐字重复**的对象字面量
                   （首次发送与重跑各一份）。合并之后必须有测试钉住推导表，
                   否则「重跑用了与首次发送不同的推理档位」这种分叉会一直
                   在 UI 上看不出来。
*/

import { describe, expect, it } from "vitest";

import {
  buildRunContext,
  buildThreadSubmitMessages,
  hasToolResult,
} from "@/core/threads/submit";
import type { Message } from "@/core/types/message";

describe("buildRunContext", () => {
  it.each([
    ["ultra", { thinking: true, plan: true, subagent: true, effort: "high" }],
    ["pro", { thinking: true, plan: true, subagent: false, effort: "medium" }],
    [
      "thinking",
      { thinking: true, plan: false, subagent: false, effort: "low" },
    ],
    [
      "flash",
      { thinking: false, plan: false, subagent: false, effort: undefined },
    ],
  ] as const)("mode=%s 推导出固定的四个字段", (mode, expected) => {
    const context = buildRunContext({ mode }, "thread-1");
    expect(context).toMatchObject({
      thinking_enabled: expected.thinking,
      is_plan_mode: expected.plan,
      subagent_enabled: expected.subagent,
      reasoning_effort: expected.effort,
      thread_id: "thread-1",
    });
  });

  it("显式给的 reasoning_effort 覆盖 mode 推导", () => {
    expect(
      buildRunContext({ mode: "ultra", reasoning_effort: "minimal" }, "t"),
    ).toMatchObject({ reasoning_effort: "minimal" });
  });

  it("extraContext 在最外层被 context 覆盖，thread_id 始终最后写", () => {
    const context = buildRunContext({ mode: "flash", agent_name: "a" }, "t", {
      agent_name: "b",
      extra: 1,
    });
    expect(context).toMatchObject({
      agent_name: "a",
      extra: 1,
      thread_id: "t",
    });
  });
});

describe("buildThreadSubmitMessages", () => {
  it("只有附件时也带上 files，没有附件时不写这个键", () => {
    const withFiles = buildThreadSubmitMessages({
      text: "hi",
      filesForSubmit: [{ filename: "a.txt", size: 1, status: "uploaded" }],
    });
    expect(withFiles[0]?.additional_kwargs?.files).toHaveLength(1);

    const without = buildThreadSubmitMessages({ text: "hi" });
    expect(without[0]?.additional_kwargs).not.toHaveProperty("files");
  });

  it("additionalInputMessages 排在用户消息之前", () => {
    const extra = { id: "x", type: "human", content: "ctx" } as Message;
    const built = buildThreadSubmitMessages({
      text: "hi",
      additionalInputMessages: [extra],
    });
    expect(built).toHaveLength(2);
    expect(built[0]).toBe(extra);
  });
});

describe("hasToolResult", () => {
  it("按 tool_call_id 关联，而不是只看名字", () => {
    const messages = [
      {
        type: "ai",
        id: "a",
        content: "",
        tool_calls: [{ id: "call-1", name: "search", args: {} }],
      },
      { type: "tool", id: "t", content: "ok", tool_call_id: "call-1" },
    ] as unknown as Message[];
    expect(hasToolResult(messages, "search")).toBe(true);
    expect(hasToolResult(messages, "other")).toBe(false);
  });
});
