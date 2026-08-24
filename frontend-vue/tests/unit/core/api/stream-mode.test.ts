/*
  【文件职责】     固定 Vue 应用层 run stream-mode 校验与非 resumable 请求语义。
  【架构位置】     L3 测试
  【主要导出】     无
  【依赖关系】     @/core/api/stream-mode
  【边界与注意】   从冻结生成档转为手工维护；禁止恢复静默删除 run option 的兼容路径。
*/

import { expect, test } from "vitest";

import { sanitizeRunStreamOptions } from "@/core/api/stream-mode";

test("rejects mixed supported and unsupported stream modes", () => {
  expect(() =>
    sanitizeRunStreamOptions({
      streamMode: ["values", "events", "tools"],
    }),
  ).toThrow("Unsupported LangGraph stream mode(s): events, tools");
});

test("rejects payloads when every requested stream mode is unsupported", () => {
  expect(() =>
    sanitizeRunStreamOptions({
      streamMode: ["events", "tools"],
    }),
  ).toThrow("Unsupported LangGraph stream mode(s): events, tools");

  expect(() =>
    sanitizeRunStreamOptions({
      streamMode: "tools",
    }),
  ).toThrow("Unsupported LangGraph stream mode(s): tools");
});

test("rejects messages because the Gateway only supports messages-tuple framing", () => {
  expect(() =>
    sanitizeRunStreamOptions({
      streamMode: "messages",
    }),
  ).toThrow("Unsupported LangGraph stream mode(s): messages");
});

test("keeps payloads without streamMode untouched", () => {
  const options = {
    streamSubgraphs: true,
  };

  expect(sanitizeRunStreamOptions(options)).toBe(options);
});

test("keeps the SDK's supported non-resumable option unchanged", () => {
  const options = {
    streamResumable: false,
    onDisconnect: "continue",
    streamSubgraphs: true,
  } as const;

  expect(sanitizeRunStreamOptions(options)).toBe(options);
});

test("validates stream modes without rewriting other supported options", () => {
  const options = {
    streamResumable: false,
    onDisconnect: "continue",
    streamMode: ["values", "custom"],
  } as const;

  expect(sanitizeRunStreamOptions(options)).toBe(options);
});
