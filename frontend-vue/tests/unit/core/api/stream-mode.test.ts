/*
  由 scripts/rstest-to-vitest.mjs 从 frontend/tests/unit/core/api/stream-mode.test.ts 机械生成。
  基线 27a425b0 · 改动仅限 @rstest/core → vitest、rs.* → vi.*。
  勿手改：make codemod-check 会红。需要为 Vue 侧适配就登记进 HAND_MAINTAINED。
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

test("strips streamResumable before sending run options to the API", () => {
  const sanitized = sanitizeRunStreamOptions({
    streamResumable: true,
    streamSubgraphs: true,
  });

  expect(sanitized).toEqual({
    streamSubgraphs: true,
  });
});

test("sanitizes streamResumable while preserving valid stream modes", () => {
  const sanitized = sanitizeRunStreamOptions({
    streamResumable: true,
    streamMode: ["values", "custom"],
  });

  expect(sanitized).toEqual({
    streamMode: ["values", "custom"],
  });
});
