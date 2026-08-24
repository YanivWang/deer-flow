/*
  【文件职责】     看门狗判据（05 L7 / L9）。
  【架构位置】     L1 测试
  【主要导出】     无
  【依赖关系】     ../src/watchdog
  【边界与注意】   这里断言的是**判据**，不是「多少秒合适」。阈值是可配的，
                   而错误的判据（把等人回话算成静默、把心跳不算活动）
                   换多大的阈值都救不回来。
*/

import { describe, expect, it } from "vitest";

import { DEFAULT_WATCHDOG, evaluateWatchdog } from "../src/watchdog";

const streaming = { status: "streaming", handle: "h" } as const;

describe("停表规则", () => {
  it("等人回话时停表——用户去泡咖啡不该报超时", () => {
    expect(
      evaluateWatchdog({
        now: 1_000_000,
        lastActivityAt: 0,
        session: streaming,
        awaitingHumanInput: true,
      }),
    ).toEqual({ kind: "paused", reason: "awaiting-human-input" });
  });

  it("不在 streaming 时停表——重连有自己的预算与上限", () => {
    // 让看门狗同时在重连期间计时，等于同一个故障有两个互不知情的裁判。
    expect(
      evaluateWatchdog({
        now: 1_000_000,
        lastActivityAt: 0,
        session: { status: "reconnecting", handle: "h", attempt: 1 },
        awaitingHumanInput: false,
      }).kind,
    ).toBe("paused");
  });
});

describe("静默判定", () => {
  const at = (silentMs: number) =>
    evaluateWatchdog({
      now: silentMs,
      lastActivityAt: 0,
      session: streaming,
      awaitingHumanInput: false,
    });

  it("阈值以内是 ok", () => {
    expect(at(DEFAULT_WATCHDOG.idleMs - 1).kind).toBe("ok");
  });

  it("到达阈值即判静默，并带出静默时长", () => {
    expect(at(DEFAULT_WATCHDOG.idleMs)).toEqual({
      kind: "idle",
      silentMs: DEFAULT_WATCHDOG.idleMs,
    });
  });

  it("L7：默认阈值远大于 gamma 的 15 秒", () => {
    // DeerFlow 的 agent 会跑 sandbox 执行、浏览器操作、子 agent，
    // 15 秒静默完全正常。这条钉的是「阈值被谁抄回去」这类回退。
    expect(DEFAULT_WATCHDOG.idleMs).toBeGreaterThan(15_000);
  });

  it("L9：心跳刷新过 lastActivityAt 之后就不再是静默", () => {
    // 心跳的全部意义在这里：bridge 在业务静默时仍会发 `: heartbeat`，
    // 把它当成「解析不出来的东西」丢掉，健康连接就会被误判。
    const heartbeatAt = 100_000;
    expect(
      evaluateWatchdog({
        now: heartbeatAt + 1_000,
        lastActivityAt: heartbeatAt,
        session: streaming,
        awaitingHumanInput: false,
      }).kind,
    ).toBe("ok");
  });

  it("阈值可配", () => {
    expect(
      evaluateWatchdog(
        {
          now: 10,
          lastActivityAt: 0,
          session: streaming,
          awaitingHumanInput: false,
        },
        { idleMs: 5 },
      ).kind,
    ).toBe("idle");
  });
});
