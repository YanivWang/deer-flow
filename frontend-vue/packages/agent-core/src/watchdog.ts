/*
  【文件职责】     「这条流是不是真的卡住了」的纯判据（05 L7 / 08 §错误与 watchdog）。
  【对应 frontend/】 无
  【架构位置】     L1
  【主要导出】     WatchdogInput · WatchdogVerdict · evaluateWatchdog
  【依赖关系】     ./session/state
  【边界与注意】   **默认阈值是本仓库实测出来的，不是抄的 15 秒。**
                   gamma 用 15 秒，那是面向一个短问答后端；DeerFlow 的 agent 会跑
                   sandbox 执行、浏览器操作、子 agent，长时间没有业务事件完全正常。
                   实测依据：`tests/fixtures/streams/deerflow-create.sse` 这份真实
                   录制里，74 个事件中间出现过 1 个 `: heartbeat` 注释帧——也就是说
                   bridge 在业务静默时会主动发心跳。所以判据的主语是**心跳**而不是
                   业务事件：只要心跳还在，连接就是活的，多久没有业务事件都不算卡。
                   真正的静默 = 连心跳都停了。

                   等待人工输入时必须停表。否则用户去泡杯咖啡回来，界面已经自己
                   报了超时——而后端那边什么问题都没有。
*/

import type { RunSessionState } from "./session/state";

export interface WatchdogOptions {
  /** 连心跳都没有多久算静默。默认值取心跳间隔的数倍，留足代理抖动余量。 */
  idleMs: number;
}

export const DEFAULT_WATCHDOG: WatchdogOptions = { idleMs: 90_000 };

export interface WatchdogInput {
  now: number;
  /** 最近一次**任何**帧（含心跳）到达的时间。 */
  lastActivityAt: number;
  session: RunSessionState<unknown>;
  /** 业务上正在等人回话（human input / clarification）。 */
  awaitingHumanInput: boolean;
}

export type WatchdogVerdict =
  | { kind: "ok" }
  | { kind: "paused"; reason: "awaiting-human-input" | "not-streaming" }
  | { kind: "idle"; silentMs: number };

export function evaluateWatchdog(
  input: WatchdogInput,
  options: WatchdogOptions = DEFAULT_WATCHDOG,
): WatchdogVerdict {
  if (input.awaitingHumanInput) {
    return { kind: "paused", reason: "awaiting-human-input" };
  }
  // 只有真正在读流时才计时。`reconnecting` 有自己的退避预算与总量上限，
  // 让看门狗同时也在那儿计时，等于同一个故障有两个互相不知情的裁判。
  if (input.session.status !== "streaming") {
    return { kind: "paused", reason: "not-streaming" };
  }
  const silentMs = input.now - input.lastActivityAt;
  return silentMs >= options.idleMs
    ? { kind: "idle", silentMs }
    : { kind: "ok" };
}
