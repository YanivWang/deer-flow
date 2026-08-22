/*
  【文件职责】     固定 WP-09 setup_agent ToolMessage 识别与隐藏保存请求合同。
  【对应 frontend/】 app/workspace/agents/new/page.tsx · core/threads/hooks.ts
  【架构位置】     WP-09 纯逻辑测试
  【主要导出】     无；Vitest cases
  【依赖关系】     core/agents/creation-session · core/types/message
  【边界与注意】   只接受真实 tool call/result 关联与 ToolMessage.status；assistant 文本不是成功证据。
*/

import { describe, expect, it } from "vitest";

import {
  buildAgentSaveSubmission,
  classifySetupAgentResult,
} from "@/core/agents/creation-session";
import type { Message } from "@/core/types/message";

const toolCall = {
  type: "ai",
  content: "",
  tool_calls: [
    { id: "setup-call", name: "setup_agent", args: { soul: "# Agent" } },
  ],
} as Message;

describe("setup_agent result classification", () => {
  it("recognizes a correlated successful ToolMessage", () => {
    const result = classifySetupAgentResult([
      toolCall,
      {
        type: "tool",
        content: "Agent 'reviewer' created successfully!",
        tool_call_id: "setup-call",
        status: "success",
      },
    ] as Message[]);

    expect(result).toEqual({ kind: "success" });
  });

  it("preserves the real tool error detail", () => {
    const result = classifySetupAgentResult([
      toolCall,
      {
        type: "tool",
        content: "Agent store is read-only",
        tool_call_id: "setup-call",
        status: "error",
      },
    ] as Message[]);

    expect(result).toEqual({
      kind: "error",
      detail: "Agent store is read-only",
    });
  });

  it("does not treat assistant prose or an unrelated tool result as success", () => {
    expect(
      classifySetupAgentResult([
        { type: "ai", content: "setup_agent completed successfully" },
        {
          type: "tool",
          name: "setup_agent",
          content: "unmatched",
          tool_call_id: "other-call",
          status: "success",
        },
      ] as Message[]),
    ).toEqual({ kind: "missing" });
  });
});

describe("agent save submission", () => {
  it("marks the save instruction hidden so it never enters visible chat", () => {
    expect(buildAgentSaveSubmission("Save the agent now")).toEqual({
      text: "Save the agent now",
      files: [],
      additionalKwargs: { hide_from_ui: true },
    });
  });
});
