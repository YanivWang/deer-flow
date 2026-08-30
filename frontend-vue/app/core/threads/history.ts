/*
  【文件职责】     thread 历史的分页协议：解析、游标、扁平化、跨刷新对账。
  【架构位置】     L3（纯 TS）
  【主要导出】     parseThreadMessagesPageResponse · getThreadHistoryNextPageParam
                   buildThreadMessagesPageUrl · flattenThreadHistoryPages
                   reconcileThreadHistoryRows · THREAD_HISTORY_QUERY_POLICY
                   threadHistoryQueryKey · buildThreadCheckpointSeedUrl
                   checkpointSeedRows
  【依赖关系】     ./message-identity · ./types
  【边界与注意】   05 C1（保留后端 thread 全局 seq）与 C6（历史失效时保留已加载的页）
                   的实现都在 `reconcileThreadHistoryRows` 一个函数里。

                   `buildThreadMessagesPageUrl` 上游读 `window.location.origin`。
                   这里保留同一行为但把它写成显式的 `origin` 参数默认值——Nuxt 下
                   这个函数会在 SSR 侧被打包进 chunk，`typeof window` 判断在上游是
                   隐式的，在这里必须能被测试穷举（相对 base / 绝对 base 两条路径
                   走的是不同分支）。
*/

import { dedupeRunMessagesByIdentity } from "./message-identity";
import type { RunMessage } from "./types";

export type ThreadMessagesPageResponse = {
  data: RunMessage[];
  has_more: boolean;
  next_before_seq: number | null;
};

function isValidThreadMessageSeq(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

/**
 * Validate the sequence fields that history reconciliation and pagination use
 * as runtime identities. The static RunMessage type cannot protect this JSON
 * boundary from version skew or malformed responses.
 */
export function parseThreadMessagesPageResponse(
  value: unknown,
): ThreadMessagesPageResponse {
  if (typeof value !== "object" || value === null) {
    throw new Error("Thread history returned an invalid response.");
  }

  const data = Reflect.get(value, "data");
  const hasMore = Reflect.get(value, "has_more");
  const nextBeforeSeq = Reflect.get(value, "next_before_seq");
  if (!Array.isArray(data) || typeof hasMore !== "boolean") {
    throw new Error("Thread history returned an invalid response.");
  }

  const seenSeqs = new Set<number>();
  for (const row of data) {
    const seq =
      typeof row === "object" && row !== null
        ? Reflect.get(row, "seq")
        : undefined;
    if (!isValidThreadMessageSeq(seq)) {
      throw new Error("Thread history returned a row with an invalid seq.");
    }
    if (seenSeqs.has(seq)) {
      throw new Error("Thread history returned duplicate seq values.");
    }
    seenSeqs.add(seq);
  }

  if (
    (hasMore && !isValidThreadMessageSeq(nextBeforeSeq)) ||
    (!hasMore && nextBeforeSeq !== null)
  ) {
    throw new Error(
      "Thread history returned an invalid next_before_seq cursor.",
    );
  }

  return value as ThreadMessagesPageResponse;
}

export function getThreadHistoryNextPageParam(
  lastPage: ThreadMessagesPageResponse,
): number | undefined {
  if (!lastPage.has_more) {
    return undefined;
  }
  if (lastPage.next_before_seq === null) {
    console.warn(
      "Thread history returned has_more without next_before_seq; pagination cannot continue.",
    );
    return undefined;
  }
  return lastPage.next_before_seq;
}

export const threadHistoryQueryKey = (threadId: string) =>
  ["thread-messages", threadId] as const;

export function buildThreadMessagesPageUrl(
  baseUrl: string,
  threadId: string,
  beforeSeq?: number,
  origin: string = typeof window !== "undefined"
    ? window.location.origin
    : "http://localhost",
) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  const path = `/api/threads/${encodeURIComponent(threadId)}/messages/page`;
  const url = new URL(`${normalizedBaseUrl}${path}`, origin);
  if (beforeSeq !== undefined) {
    url.searchParams.set("before_seq", String(beforeSeq));
  }
  return normalizedBaseUrl ? url.toString() : `${url.pathname}${url.search}`;
}

/**
 * 事件库为空时，退回「最新 checkpoint」这一支所用的那条 URL。
 *
 * 取 `POST /history` 而不是 `GET /state`，理由是后端只有前者会把 run 身份写回
 * 消息：`get_thread_history` 对每条 ai/tool 消息做 `msg.setdefault("run_id",
 * …)`，并对每个回合的最后一条 AI 消息 `stamp_turn_duration_on_last_ai`。
 * `get_thread_state` 只做一次 `serialize_channel_values_for_api(snapshot.values)`，
 * 两个字段都没有。React 侧的 LangGraph SDK 走的也是这一条
 * （`fetchStateHistory: { limit: 1 }` → `client.threads.getHistory`）；
 * SDK 的 `fetchStateHistory: false` 才是 `/state`。
 */
export function buildThreadCheckpointSeedUrl(
  baseUrl: string,
  threadId: string,
) {
  return `${baseUrl.replace(/\/$/, "")}/api/langgraph/threads/${encodeURIComponent(threadId)}/history`;
}

/** `POST /history` 里一条 checkpoint 条目——只用得上 `values.messages`。 */
type ThreadHistoryEntry = {
  values?: { messages?: unknown[] };
};

/**
 * 把最新 checkpoint 的消息摊成 `/messages/page` 那样的行。
 *
 * **没有 run 身份时不要凭空造一个。** 这里原先写的是
 * `run_id: \`state-${threadId}\``，那个 id 后端并不存在，于是它一路流到
 * `buildVisibleHistoryMessages` 写进消息体，再被 WorkspaceChangesBadge 当成
 * 真 run 发出 `GET /threads/{id}/runs/state-<threadId>/workspace-changes`——
 * 一条注定 404 的请求。实测 browser-feature 场景里 React 一条都不发，
 * 正是因为它的 checkpoint 消息没有 run_id，徽章的查询就停在 disabled。
 *
 * 所以：后端给了就用后端的（ai/tool 在消息自身的 `run_id`，human 在
 * `additional_kwargs.run_id`），没给就留空串——空串是「这条消息不属于任何
 * 已知 run」的真实答案，`enabled: Boolean(props.runId && …)` 会照此停住。
 */
export function checkpointSeedRows(entries: unknown): RunMessage[] {
  const first = Array.isArray(entries)
    ? (entries[0] as ThreadHistoryEntry | undefined)
    : undefined;
  const messages = first?.values?.messages;
  if (!Array.isArray(messages)) return [];
  return messages.map((content, index) => ({
    run_id: checkpointMessageRunId(content),
    seq: index + 1,
    content: content as RunMessage["content"],
    metadata: { caller: "lead_agent" },
    created_at: new Date(0).toISOString(),
  }));
}

function checkpointMessageRunId(content: unknown): string {
  if (typeof content !== "object" || content === null) return "";
  const own = Reflect.get(content, "run_id");
  if (typeof own === "string" && own) return own;
  const kwargs = Reflect.get(content, "additional_kwargs");
  if (typeof kwargs === "object" && kwargs !== null) {
    const carried = Reflect.get(kwargs, "run_id");
    if (typeof carried === "string" && carried) return carried;
  }
  return "";
}

export function flattenThreadHistoryPages(
  pages: ThreadMessagesPageResponse[],
): RunMessage[] {
  return dedupeRunMessagesByIdentity(
    pages
      .slice()
      .reverse()
      .flatMap((page) => page.data),
  );
}

/**
 * Preserve rows that this client has already loaded while newest-first cursor
 * pages move forward during a long run.
 *
 * A background refetch recalculates every loaded page from the refreshed first
 * page. When older pages have not all been loaded yet, that can displace rows
 * which were visible a moment ago even though they still exist on the server.
 * Thread-global seq is the authoritative order; refreshed copies win without
 * moving their established position.
 */
export function reconcileThreadHistoryRows(
  previousRows: RunMessage[],
  currentRows: RunMessage[],
  isAuthoritativeComplete: boolean,
): RunMessage[] {
  const sourceRows = isAuthoritativeComplete
    ? currentRows
    : [...previousRows, ...currentRows];
  if (sourceRows.some((row) => !isValidThreadMessageSeq(row.seq))) {
    console.error(
      "Thread history reconciliation received an invalid sequence value.",
    );
    // Never skip an invalid row or feed it into Map/Array.sort: either choice
    // can silently lose or misorder messages. A failed refresh keeps the last
    // known-good snapshot; an invalid first snapshot degrades to server order.
    return previousRows.length > 0 ? previousRows : currentRows;
  }

  const rowsBySeq = new Map<number, RunMessage>();
  for (const row of sourceRows) {
    rowsBySeq.set(row.seq, row);
  }

  const reconciled = dedupeRunMessagesByIdentity(
    [...rowsBySeq.values()].sort((left, right) => left.seq - right.seq),
  );
  if (
    reconciled.length === previousRows.length &&
    reconciled.every((row, index) => row === previousRows[index])
  ) {
    return previousRows;
  }
  return reconciled;
}

export const THREAD_HISTORY_QUERY_POLICY = {
  refetchOnWindowFocus: false,
  staleTime: 5 * 60 * 1_000,
} as const;
