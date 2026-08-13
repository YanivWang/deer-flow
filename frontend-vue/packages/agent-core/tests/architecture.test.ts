/*
  【文件职责】     从可搬运包内部验证 L1 的唯一公共入口。
  【对应 frontend/】 无；M0 新增架构门禁
  【架构位置】     L1 测试
  【主要导出】     无
  【依赖关系】     消费 ../src/index.ts
  【边界与注意】   本文件只管「公共入口在不在、版本对不对」。transport / session /
                   store 的行为测试各自成文件，不要往这里堆——它是包边界的守卫，
                   不是 L1 的测试总入口。

                   版本常量跟着公共契约冻结点走，M8 起为 `m8`。它不是装饰：消费方拿到包
                   之后靠它判断自己拿的是哪一版合同。改它要同时改 08。
*/

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AGENT_CORE_CONTRACT_VERSION } from "../src/index";

describe("agent-core package", () => {
  it("is a real workspace package with an M8 public export", () => {
    expect(AGENT_CORE_CONTRACT_VERSION).toBe("m8");
    const manifest = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as {
      exports: Record<string, unknown>;
      files: string[];
      private: boolean;
      types: string;
    };
    expect(Object.keys(manifest.exports)).toEqual(["."]);
    expect(manifest.files).toEqual(["src"]);
    expect(manifest.private).toBe(true);
    expect(manifest.types).toBe("./src/index.ts");
  });

  it("freezes the exact root export surface", () => {
    const source = readFileSync(
      new URL("../src/index.ts", import.meta.url),
      "utf8",
    );
    const names = new Set<string>();
    for (const block of source.matchAll(
      /export(?:\s+type)?\s*\{([\s\S]*?)\}\s*from/g,
    )) {
      for (const entry of (block[1] ?? "").split(",")) {
        const parts = entry.trim().split(/\s+as\s+/);
        const name = parts[1] ?? parts[0];
        if (name) names.add(name);
      }
    }
    for (const declaration of source.matchAll(/export\s+const\s+(\w+)/g)) {
      names.add(declaration[1] ?? "");
    }
    expect([...names].sort()).toEqual(
      [
        "AGENT_CORE_CONTRACT_VERSION",
        "AgentContentPart",
        "AgentErrorKind",
        "AgentExternalStore",
        "AgentMessage",
        "AgentMessageContent",
        "AgentMessageRole",
        "AgentSnapshot",
        "AgentStreamError",
        "AgentToolCall",
        "BackoffOptions",
        "CancelResult",
        "ClassifyEvent",
        "DEFAULT_BACKOFF",
        "DEFAULT_WATCHDOG",
        "EventReducer",
        "FrameReaderOptions",
        "InspectedRun",
        "OpenedStream",
        "ReduceAction",
        "RunOutcome",
        "RunProtocol",
        "RunSession",
        "RunSessionOptions",
        "RunSessionState",
        "SessionOutput",
        "SseEvent",
        "SseFrame",
        "StreamRequest",
        "StreamSignal",
        "WatchdogInput",
        "WatchdogOptions",
        "WatchdogVerdict",
        "applyReduceActions",
        "computeBackoffDelay",
        "createAgentExternalStore",
        "createAgentMessage",
        "createRunSession",
        "evaluateWatchdog",
        "flushSseRemainder",
        "isRetryableKind",
        "parseSseFrame",
        "readNextSseFrame",
        "readSseFrames",
        "toAgentStreamError",
      ].sort(),
    );
  });
});
