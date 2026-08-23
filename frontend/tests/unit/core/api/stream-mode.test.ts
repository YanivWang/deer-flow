import { expect, test } from "@rstest/core";

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
