/*
  【文件职责】     钉住「什么时候才放弃一个线程 URL」的判据。
  【架构位置】     单元测试
  【主要导出】     无；Vitest cases
  【依赖关系】     app/core/threads/thread-presence
  【边界与注意】   这条判据之所以是三项合取，是因为少任何一项都对应一个真实故障：
                   少 presence → 一次瞬时错误就误伤；少 historySettled → 在历史
                   还在路上时跳走；少 hasMessages → 就是 checkpoint 缺失导致对话
                   凭空消失的那个缺陷本身。
*/

import { describe, expect, it } from "vitest";

import { GatewayResponseError } from "@/core/api/errors";
import {
  isThreadMissingError,
  shouldLeaveMissingThread,
  type ThreadPresence,
} from "@/core/threads/thread-presence";

function gatewayError(status: number) {
  return new GatewayResponseError("boom", status, null, "");
}

describe("isThreadMissingError", () => {
  it("treats 404 and 403 alike so the UI never discloses foreign threads", () => {
    expect(isThreadMissingError(gatewayError(404))).toBe(true);
    expect(isThreadMissingError(gatewayError(403))).toBe(true);
  });

  it("does not treat transient failures as a missing thread", () => {
    // 这一条是防回归：把 5xx / 网络错误也算成 missing，一次抖动就会把用户
    // 连人带对话踢回新会话，而且没有任何提示。
    for (const status of [400, 408, 429, 500, 502, 503]) {
      expect(isThreadMissingError(gatewayError(status)), String(status)).toBe(
        false,
      );
    }
    expect(isThreadMissingError(new Error("network down"))).toBe(false);
    expect(isThreadMissingError(new TypeError("Failed to fetch"))).toBe(false);
    expect(isThreadMissingError(null)).toBe(false);
    expect(isThreadMissingError(undefined)).toBe(false);
    expect(isThreadMissingError({ status: 404 })).toBe(false);
  });
});

describe("shouldLeaveMissingThread", () => {
  it("leaves only when the thread is missing and its history is settled and empty", () => {
    expect(
      shouldLeaveMissingThread({
        presence: "missing",
        historySettled: true,
        hasMessages: false,
      }),
    ).toBe(true);
  });

  it("stays when the backend can still produce the conversation", () => {
    // checkpoint 没了但 run_events 还在：元数据 404，历史却有内容。
    // 这是上下文压缩之后的常态，必须留在原地把会话渲染出来。
    expect(
      shouldLeaveMissingThread({
        presence: "missing",
        historySettled: true,
        hasMessages: true,
      }),
    ).toBe(false);
  });

  it("never decides while the history has not reached a conclusion", () => {
    for (const presence of [
      "missing",
      "present",
      "unknown",
    ] as ThreadPresence[]) {
      for (const hasMessages of [true, false]) {
        expect(
          shouldLeaveMissingThread({
            presence,
            historySettled: false,
            hasMessages,
          }),
          `${presence}/${String(hasMessages)}`,
        ).toBe(false);
      }
    }
  });

  it("never leaves on an inconclusive probe", () => {
    for (const presence of ["unknown", "present"] as ThreadPresence[]) {
      expect(
        shouldLeaveMissingThread({
          presence,
          historySettled: true,
          hasMessages: false,
        }),
        presence,
      ).toBe(false);
    }
  });
});
