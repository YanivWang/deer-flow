/*
  【文件职责】     可观察快照与归约动作的形状（08 §事件与完整状态归约）。
  【对应 frontend/】 无；上游把这些散在 hooks 与组件生命周期里
  【架构位置】     L1
  【主要导出】     AgentSnapshot · ReduceAction · EventReducer
  【依赖关系】     ../message · ../errors · ../session/state
  【边界与注意】   reducer 一次可以返回**多个** action，这不是方便，是必需：
                   一帧全量快照要同时更新完整业务 state、消息顺序和会话状态，
                   拆成三次调用就会出现「state 已经换了、消息还是旧的」的中间帧，
                   而组件恰好可能在那一帧渲染。

                   `messageIds` 与 `messages` 分开存：顺序是协议给的，
                   内容是按 id 归并的。合成一个数组会让每次 merge 都要线性查找，
                   长 thread 上这是 O(n²)。
*/

import type { AgentStreamError } from "../errors";
import type { AgentMessage } from "../message";
import type { RunSessionState } from "../session/state";

export interface AgentSnapshot<TState> {
  state: TState;
  messageIds: string[];
  messages: Record<string, AgentMessage>;
  session: RunSessionState<unknown>;
  lastActivityAt: number;
}

export type ReduceAction<TState> =
  | { type: "ignore" }
  | { type: "replace-state"; state: TState }
  | { type: "patch-state"; patch: Partial<TState> }
  | { type: "upsert-message"; message: AgentMessage; afterId?: string }
  | { type: "merge-message"; messageId: string; message: AgentMessage }
  | { type: "rewrite-message-id"; fromId: string; message: AgentMessage }
  | { type: "remove-message"; messageId: string }
  | { type: "session"; session: RunSessionState<unknown> }
  | { type: "error"; error: AgentStreamError };

export type EventReducer<TState, TEvent> = (
  event: TEvent,
  snapshot: Readonly<AgentSnapshot<TState>>,
  context: { createId: () => string; now: () => number },
) => readonly ReduceAction<TState>[];
