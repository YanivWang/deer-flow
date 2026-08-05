/*
  【文件职责】     run session 的状态枚举（08 §Run session 逐字实现）。
  【对应 frontend/】 无；上游只有 `isLoading` 一个布尔
  【架构位置】     L1
  【主要导出】     RunSessionState · SessionOutput
  【依赖关系】     ../errors · ../transport/sse-event
  【边界与注意】   `stopping` 只是客户端瞬态，Gateway 那边没有这个枚举；
                   `cancelled` 与 `failed` 才有 durable 对应物（08 §258）。
                   把 stopping 当成「已取消」显示，会在 cancel 还没被后端确认时
                   就告诉用户停住了——而 run 可能还在跑。

                   没有 handle 的断开进 `failed` 而不是 `cancelled`：
                   创建阶段断线是**结果不确定**，不是「已取消」（08 §硬规则 8）。
*/

import type { AgentStreamError } from "../errors";
import type { SseEvent } from "../transport/sse-event";

export type RunSessionState<THandle> =
  | { status: "idle" }
  | { status: "creating" }
  | { status: "streaming"; handle: THandle; cursor?: string }
  | {
      status: "reconnecting";
      handle: THandle;
      cursor?: string;
      attempt: number;
    }
  | {
      status: "stopping";
      handle: THandle;
      cursor?: string;
      mode: "draining" | "polling";
    }
  | { status: "completed"; handle: THandle }
  | { status: "cancelled"; handle?: THandle; reason?: string }
  | { status: "failed"; handle?: THandle; error: AgentStreamError }
  | { status: "gap"; handle: THandle; recovery: "reload_durable_state" };

/**
 * 会话向外发的三种信号。
 *
 * heartbeat 单独成一种而不是被丢掉：它不进业务 reducer，但必须刷新
 * `lastActivityAt`，否则看门狗会把一条有心跳的健康连接判成静默（05 L9）。
 */
export type SessionOutput<THandle> =
  | { kind: "state"; state: RunSessionState<THandle> }
  | { kind: "event"; event: SseEvent }
  | { kind: "heartbeat"; comment: string };
