/*
  【文件职责】     打开线程时的 checkpoint 种子：取哪条路由、从响应里取哪一份 values。
  【架构位置】     L3（纯 TS）
  【主要导出】     buildThreadCheckpointSeedUrl · checkpointSeedValues
  【依赖关系】     无（有意：这是协议知识，不该认识 runner 或 vue）
  【边界与注意】   上游没有对应文件——这一整套是 LangGraph SDK 的
                   `useStream({ fetchStateHistory: { limit: 1 } })` 内部行为，
                   本仓自己实现 runner，就得把它显式写出来。三件事各自的判据：

                   1. **打 `POST /history` 而不是 `GET /state`。** 后端只有
                      `get_thread_history` 会把 run 身份写回消息（每条 ai/tool 的
                      `run_id` + 每回合最后一条 AI 的 `turn_duration`），
                      `get_thread_state` 只做一次 `serialize_channel_values_for_api`，
                      两个字段都没有。SDK 的 `fetchHistory` 也是这么分的：
                      `limit === false` 才走 `getState`，数字走 `getHistory`。
                      把上游改成 `fetchStateHistory: false` 去凑「两边都不发」
                      是行不通的——种子在归并里优先，React 会当场丢掉运行耗时。

                   2. **只取第一条。** 后端 `get_thread_history` 的注释写明
                      「Only the latest (first) checkpoint carries the messages
                      key」，`limit: 1` 时数组里本来就只有一条。SDK 取的是
                      `flatHistory.at(-1)`，而 `getBranchSequence` 在
                      `history.length <= 1` 时原样返回，两者同指一条。

                   3. **没有 checkpoint 时返回 undefined，不要返回 `{}`。**
                      空对象喂进 reducer 是一帧「全量替换成空」，会把 store 清空；
                      SDK 那边则是 `threadHead?.values ?? {}` 之后再被
                      `stream.values ?? historyValues` 兜住，语义是「没有种子」。
                      区别只有在压缩前的新线程上才显现，但那正是最常见的一种线程。
*/

/** `POST /history` 里一条 checkpoint 条目——种子只用得上 `values`。 */
type ThreadHistoryEntry = {
  values?: Record<string, unknown>;
};

export function buildThreadCheckpointSeedUrl(
  baseUrl: string,
  threadId: string,
) {
  return `${baseUrl.replace(/\/$/, "")}/api/langgraph/threads/${encodeURIComponent(threadId)}/history`;
}

/**
 * `POST /history` 响应 → 喂给 reducer 的那一帧 `values`。
 *
 * 不做任何字段裁剪：后端返回什么就替换成什么（生产上是
 * `title` / `thread_data` / `messages`）。裁剪等于在这里复刻一份后端的通道清单，
 * 后端加一个通道就静默丢一个。
 */
export function checkpointSeedValues(
  entries: unknown,
): Record<string, unknown> | undefined {
  if (!Array.isArray(entries)) return undefined;
  const head = entries[0] as ThreadHistoryEntry | undefined;
  const values = head?.values;
  if (typeof values !== "object" || values === null || Array.isArray(values)) {
    return undefined;
  }
  return values;
}
