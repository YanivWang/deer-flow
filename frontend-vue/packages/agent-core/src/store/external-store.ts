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

                   **通知是合并的，不是同步的（05 A1）。** 同一个宏任务里派发的
                   若干个流事件只产生**一次**通知。默认调度器是 `queueMicrotask`：
                   微任务检查点正好在当前宏任务末尾、渲染之前，所以「合并」与
                   「绝不拖到下一帧」两件事同时成立。

                   **不能做成 `setTimeout(fn, N)` 那种尾部防抖。** 05 A1 逐字写了
                   理由：chunk 持续到达时尾部防抖会一直往后推，UI 更新被饿死——
                   而流式回答恰恰就是 chunk 持续到达。这是 SDK `throttle: true`
                   （boolean 档）与数字档的区别，不是同一件事的两种写法。

                   `getSnapshot()` 始终是**同步最新**的：合并的只有通知，不是数据。
                   订阅者被通知晚一点没关系，读到旧数据不行。
*/

import type { AgentMessage } from "../message";

import type { AgentSnapshot, EventReducer, ReduceAction } from "./snapshot";

export interface AgentExternalStore<TState, TEvent> {
  getSnapshot(): AgentSnapshot<TState>;
  subscribe(listener: () => void): () => void;
  dispatch(event: TEvent): void;
  reset(next: TState): void;
  /**
   * 把挂起的通知立刻发出去。
   *
   * 存在的理由是**同步读者**：卸载前的最后一次落盘、测试里的断言、
   * 需要在同一个 tick 里量尺寸的适配器。没有它，唯一的等待方式是
   * 「再 await 一个微任务」——那是在猜调度器的实现。
   */
  flushNotifications(): void;
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

/**
 * 默认调度器：微任务检查点。
 *
 * 它就是「同一个宏任务」的边界——当前宏任务里的所有同步派发都排在这次检查点
 * 之前，检查点又发生在浏览器渲染之前。换成 `setTimeout(fn, 0)` 会晚一整个
 * 宏任务，换成固定延时就变成 05 A1 明令禁止的尾部防抖。
 */
const defaultSchedule = (flush: () => void): void => {
  queueMicrotask(flush);
};

export function createAgentExternalStore<TState, TEvent>(options: {
  initialState: TState;
  reducer: EventReducer<TState, TEvent>;
  createId: () => string;
  now: () => number;
  /**
   * 通知的调度方式（05 A1）。默认合并到当前宏任务末尾。
   *
   * 可替换是为了宿主适配：Vue 侧可以换成 `nextTick`，测试可以换成同步执行。
   * **但换成带延时的实现就违反 A1**——这个扩展点是给「换一个宏任务边界的
   * 定义」用的，不是给「加一点防抖」用的。
   */
  scheduleNotify?: (flush: () => void) => void;
}): AgentExternalStore<TState, TEvent> {
  const {
    initialState,
    reducer,
    createId,
    now,
    scheduleNotify = defaultSchedule,
  } = options;
  const listeners = new Set<() => void>();
  let pending = false;

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

  const flush = () => {
    // 已经被 flushNotifications() 提前发过：这次调度是空转，不能再发一遍。
    if (!pending) return;
    pending = false;
    notify();
  };

  /**
   * 合并的关键就是这个 `pending` 短路：一个宏任务里派发一百次，
   * 也只登记一次调度。**每次都重新调度**（哪怕只是重排队列）就退化成
   * 尾部防抖了——A1 禁的正是那个。
   */
  const scheduleFlush = () => {
    if (pending) return;
    pending = true;
    scheduleNotify(flush);
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
      // 快照同步换新，通知才合并：读者永远读得到最新数据。
      snapshot = next;
      scheduleFlush();
    },
    reset(nextState) {
      snapshot = blank(nextState);
      scheduleFlush();
    },
    flushNotifications: flush,
  };
}
