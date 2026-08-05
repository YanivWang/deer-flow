/*
  【文件职责】     框架无关的 external store：快照 + 订阅 + 派发。
  【对应 frontend/】 无；上游对应的是 SDK 内部状态加 React 的 useSyncExternalStore
  【架构位置】     L1
  【主要导出】     AgentExternalStore · createAgentExternalStore · applyReduceActions
  【依赖关系】     ./snapshot · ../message
  【边界与注意】   本文件不返回 `StoreDefinition`，也不 import Pinia。Vue 侧的包装在
                   `app/core/agent-deerflow/vue/`，那里才知道 thread 作用域与卸载。

                   快照是**不可变替换**而不是原地改：`useSyncExternalStore` 与
                   `shallowRef` 都靠引用比较判断要不要重渲染，原地改会让订阅者
                   收到通知却看不出差别，或者干脆不通知。

                   `applyReduceActions` 单独导出且是纯函数：归约逻辑要能脱离
                   store 单测，否则每个 reducer 用例都得先造一个 store。
*/

import type { AgentMessage } from "../message";

import type { AgentSnapshot, EventReducer, ReduceAction } from "./snapshot";

export interface AgentExternalStore<TState, TEvent> {
  getSnapshot(): AgentSnapshot<TState>;
  subscribe(listener: () => void): () => void;
  dispatch(event: TEvent): void;
  reset(next: TState): void;
}

function mergeMessage(base: AgentMessage, patch: AgentMessage): AgentMessage {
  const reasoningChunks =
    base.reasoningChunks || patch.reasoningChunks
      ? [...(base.reasoningChunks ?? []), ...(patch.reasoningChunks ?? [])]
      : undefined;
  return {
    ...base,
    ...patch,
    // chunk 是**追加**语义，不是覆盖。用展开的默认行为会让后到的 delta
    // 把之前收到的整段替换掉，流式文本表现为「越流越短」。
    contentChunks: [...base.contentChunks, ...patch.contentChunks],
    // 两边都没有 reasoning 时**不写这个键**，而不是写 undefined：
    // 消息会被导出成 JSON，也会被 UI 用 `in` 判断有没有 reasoning。
    ...(reasoningChunks === undefined ? {} : { reasoningChunks }),
  };
}

/** 纯函数：把一批 action 折叠进快照，返回新快照。 */
export function applyReduceActions<TState>(
  snapshot: AgentSnapshot<TState>,
  actions: readonly ReduceAction<TState>[],
  now: number,
): AgentSnapshot<TState> {
  let next = snapshot;
  const touch = (patch: Partial<AgentSnapshot<TState>>) => {
    next = { ...next, ...patch, lastActivityAt: now };
  };

  for (const action of actions) {
    switch (action.type) {
      case "ignore":
        break;
      case "replace-state":
        touch({ state: action.state });
        break;
      case "patch-state":
        touch({ state: { ...next.state, ...action.patch } });
        break;
      case "upsert-message": {
        const { message, afterId } = action;
        const exists = next.messages[message.id] !== undefined;
        const ids = exists
          ? next.messageIds
          : insertId(next.messageIds, message.id, afterId);
        touch({
          messageIds: ids,
          messages: {
            ...next.messages,
            [message.id]: exists
              ? mergeMessage(next.messages[message.id] as AgentMessage, message)
              : message,
          },
        });
        break;
      }
      case "merge-message": {
        const base = next.messages[action.messageId];
        if (!base) break;
        touch({
          messages: {
            ...next.messages,
            [action.messageId]: mergeMessage(base, action.message),
          },
        });
        break;
      }
      case "rewrite-message-id": {
        // 临时 id → 服务端 id。位置必须原地保留：删掉再插入会把这条消息
        // 挪到列表末尾，用户看到自己刚发的那条突然跳走。
        const base = next.messages[action.fromId];
        touch({
          messageIds: next.messageIds.map((id) =>
            id === action.fromId ? action.message.id : id,
          ),
          messages: {
            ...omitKey(next.messages, action.fromId),
            [action.message.id]: base
              ? mergeMessage(base, action.message)
              : action.message,
          },
        });
        break;
      }
      case "remove-message": {
        touch({
          messageIds: next.messageIds.filter((id) => id !== action.messageId),
          messages: omitKey(next.messages, action.messageId),
        });
        break;
      }
      case "session":
        touch({ session: action.session });
        break;
      case "error":
        // 错误本身不改业务 state；它的落点是 session。单独一个 action 类型是
        // 为了让 reducer 能在不知道 session 形状的情况下报错。
        touch({});
        break;
    }
  }
  return next;
}

/**
 * 去掉一个键，返回新对象。
 *
 * 不用 `delete`：`@typescript-eslint/no-dynamic-delete` 会红，而且 `delete` 会把
 * 对象降级成字典模式，长 thread 上每次删都让 V8 重建隐藏类。
 */
function omitKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).filter(([id]) => id !== key),
  );
}

function insertId(ids: string[], id: string, afterId?: string): string[] {
  if (afterId === undefined) return [...ids, id];
  const at = ids.indexOf(afterId);
  if (at === -1) return [...ids, id];
  return [...ids.slice(0, at + 1), id, ...ids.slice(at + 1)];
}

export function createAgentExternalStore<TState, TEvent>(options: {
  initialState: TState;
  reducer: EventReducer<TState, TEvent>;
  createId: () => string;
  now: () => number;
}): AgentExternalStore<TState, TEvent> {
  const { initialState, reducer, createId, now } = options;
  const listeners = new Set<() => void>();

  const blank = (state: TState): AgentSnapshot<TState> => ({
    state,
    messageIds: [],
    messages: {},
    session: { status: "idle" },
    lastActivityAt: now(),
  });

  let snapshot = blank(initialState);

  const notify = () => {
    // 复制一份再遍历：订阅者在回调里退订是正常用法（组件卸载），
    // 直接遍历 Set 会跳过后面的监听者。
    for (const listener of [...listeners]) listener();
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispatch(event) {
      const actions = reducer(event, snapshot, { createId, now });
      if (actions.length === 0) return;
      const next = applyReduceActions(snapshot, actions, now());
      if (next === snapshot) return;
      snapshot = next;
      notify();
    },
    reset(nextState) {
      snapshot = blank(nextState);
      notify();
    },
  };
}
