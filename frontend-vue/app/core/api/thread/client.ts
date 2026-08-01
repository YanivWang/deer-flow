import { appendCsrfHeader } from "../csrf";
import type {
  AgentThread,
  AgentThreadState,
  DeerFlowMessage,
  GoalState,
  RunMessage,
  ThreadCompactResponse,
  ThreadGoalResponse,
  ThreadMessagesPageResponse,
  ThreadMetadataPatchResponse,
  ThreadSearchParams,
  ThreadStateResponse,
} from "./types";

export type ThreadClientOptions = {
  endpointBase?: string;
  signal?: AbortSignal;
  headers?: HeadersInit;
};

export type UpdateThreadStateInput = {
  values: Partial<AgentThreadState>;
  checkpoint_id?: string;
  as_node?: string;
};

export type SetThreadGoalInput = {
  objective: string;
  maxContinuations?: number;
};

export type CompactThreadContextInput = {
  agentName?: string | null;
  force?: boolean;
  modelName?: string | null;
};

const JSON_HEADERS = {
  "Content-Type": "application/json",
};

export async function searchThreads(
  params: ThreadSearchParams = {},
  options: ThreadClientOptions = {},
): Promise<AgentThread[]> {
  return fetchThreadJson<AgentThread[]>("/api/threads/search", {
    body: JSON.stringify({
      metadata: params.metadata ?? {},
      limit: params.limit ?? 100,
      offset: params.offset ?? 0,
      ...(params.status ? { status: params.status } : {}),
    }),
    method: "POST",
    ...options,
  });
}

export async function getThread(
  threadId: string,
  options: ThreadClientOptions = {},
): Promise<AgentThread> {
  return fetchThreadJson<AgentThread>(`/api/threads/${encodeURIComponent(threadId)}`, {
    method: "GET",
    ...options,
  });
}

export async function createThread(
  input: {
    threadId?: string;
    assistantId?: string;
    metadata?: Record<string, unknown>;
  } = {},
  options: ThreadClientOptions = {},
): Promise<AgentThread> {
  return fetchThreadJson<AgentThread>("/api/threads", {
    body: JSON.stringify({
      ...(input.threadId ? { thread_id: input.threadId } : {}),
      ...(input.assistantId ? { assistant_id: input.assistantId } : {}),
      metadata: input.metadata ?? {},
    }),
    method: "POST",
    ...options,
  });
}

export async function updateThreadState(
  threadId: string,
  input: UpdateThreadStateInput,
  options: ThreadClientOptions = {},
): Promise<ThreadStateResponse> {
  return fetchThreadJson<ThreadStateResponse>(
    `/api/threads/${encodeURIComponent(threadId)}/state`,
    {
      body: JSON.stringify(input),
      method: "POST",
      ...options,
    },
  );
}

export async function renameThread(
  threadId: string,
  title: string,
  options: ThreadClientOptions = {},
): Promise<ThreadStateResponse> {
  return updateThreadState(threadId, { values: { title } }, options);
}

export async function patchThreadMetadata(
  threadId: string,
  metadata: Record<string, unknown>,
  options: ThreadClientOptions = {},
): Promise<ThreadMetadataPatchResponse> {
  return fetchThreadJson<ThreadMetadataPatchResponse>(
    `/api/threads/${encodeURIComponent(threadId)}`,
    {
      body: JSON.stringify({ metadata }),
      method: "PATCH",
      ...options,
    },
  );
}

export async function deleteThread(
  threadId: string,
  options: ThreadClientOptions = {},
): Promise<void> {
  await fetchThreadJson<unknown>(`/api/threads/${encodeURIComponent(threadId)}`, {
    method: "DELETE",
    ...options,
  });
}

export async function getThreadGoal(
  threadId: string,
  options: ThreadClientOptions = {},
): Promise<GoalState | null> {
  const response = await fetchThreadJson<ThreadGoalResponse>(
    `/api/threads/${encodeURIComponent(threadId)}/goal`,
    {
      method: "GET",
      ...options,
    },
  );
  return response.goal ?? null;
}

export async function setThreadGoal(
  threadId: string,
  input: SetThreadGoalInput,
  options: ThreadClientOptions = {},
): Promise<GoalState | null> {
  const response = await fetchThreadJson<ThreadGoalResponse>(
    `/api/threads/${encodeURIComponent(threadId)}/goal`,
    {
      body: JSON.stringify({
        objective: input.objective,
        ...(input.maxContinuations === undefined
          ? {}
          : { max_continuations: input.maxContinuations }),
      }),
      method: "PUT",
      ...options,
    },
  );
  return response.goal ?? null;
}

export async function clearThreadGoal(
  threadId: string,
  options: ThreadClientOptions = {},
): Promise<GoalState | null> {
  const response = await fetchThreadJson<ThreadGoalResponse>(
    `/api/threads/${encodeURIComponent(threadId)}/goal`,
    {
      method: "DELETE",
      ...options,
    },
  );
  return response.goal ?? null;
}

export async function compactThreadContext(
  threadId: string,
  input: CompactThreadContextInput = {},
  options: ThreadClientOptions = {},
): Promise<ThreadCompactResponse> {
  return fetchThreadJson<ThreadCompactResponse>(
    `/api/threads/${encodeURIComponent(threadId)}/compact`,
    {
      body: JSON.stringify({
        force: input.force ?? true,
        ...(input.agentName ? { agent_name: input.agentName } : {}),
        ...(input.modelName ? { model_name: input.modelName } : {}),
      }),
      method: "POST",
      ...options,
    },
  );
}

export async function fetchThreadMessagesPage(
  threadId: string,
  beforeSeq?: number,
  options: ThreadClientOptions = {},
): Promise<ThreadMessagesPageResponse> {
  const query = beforeSeq === undefined ? "" : `?before_seq=${encodeURIComponent(beforeSeq)}`;
  const payload = await fetchThreadJson<unknown>(
    `/api/threads/${encodeURIComponent(threadId)}/messages/page${query}`,
    {
      method: "GET",
      ...options,
    },
  );
  return parseThreadMessagesPageResponse(payload);
}

export function getThreadHistoryNextPageParam(
  lastPage: ThreadMessagesPageResponse,
): number | undefined {
  if (!lastPage.has_more) {
    return undefined;
  }
  return lastPage.next_before_seq ?? undefined;
}

export function flattenThreadHistoryPages(pages: ThreadMessagesPageResponse[]): RunMessage[] {
  return dedupeRunMessagesByIdentity(
    pages
      .slice()
      .reverse()
      .flatMap((page) => page.data),
  );
}

export function reconcileThreadHistoryRows(
  previousRows: RunMessage[],
  currentRows: RunMessage[],
  isAuthoritativeComplete: boolean,
): RunMessage[] {
  const sourceRows = isAuthoritativeComplete ? currentRows : [...previousRows, ...currentRows];
  if (sourceRows.some((row) => !isValidThreadMessageSeq(row.seq))) {
    console.error("对话历史合并收到了无效的 sequence 值。");
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

export function buildVisibleHistoryMessages(
  messageRows: RunMessage[],
  supersededRunIds: ReadonlySet<string> = new Set(),
): DeerFlowMessage[] {
  const visibleMessages = messageRows
    .filter((row) => !supersededRunIds.has(row.run_id))
    .map((row) => ({
      ...row.content,
      run_id: row.run_id,
    }));
  return dedupeMessagesByIdentity(visibleMessages);
}

export function parseThreadMessagesPageResponse(value: unknown): ThreadMessagesPageResponse {
  if (!isRecord(value) || !Array.isArray(value.data) || typeof value.has_more !== "boolean") {
    throw new Error("对话历史返回了无效分页。");
  }

  const seenSeqs = new Set<number>();
  const rows = value.data.map((row) => {
    const parsed = parseRunMessage(row);
    if (seenSeqs.has(parsed.seq)) {
      throw new Error("对话历史返回了重复的 seq 值。");
    }
    seenSeqs.add(parsed.seq);
    return parsed;
  });
  const hasMore = value.has_more;
  const nextBeforeSeq = value.next_before_seq;
  if (
    (hasMore && !isValidThreadMessageSeq(nextBeforeSeq)) ||
    (!hasMore && nextBeforeSeq !== null)
  ) {
    throw new Error("对话历史返回了无效的 next_before_seq 游标。");
  }

  return {
    data: rows,
    has_more: hasMore,
    next_before_seq: nextBeforeSeq as number | null,
  };
}

async function fetchThreadJson<T>(
  path: string,
  {
    endpointBase = "",
    signal,
    headers,
    ...init
  }: ThreadClientOptions & Omit<RequestInit, "headers" | "signal">,
): Promise<T> {
  const response = await fetch(buildUrl(endpointBase, path), {
    credentials: "include",
    headers: buildHeaders(headers, init.method),
    signal,
    ...init,
  });

  if (!response.ok) {
    throw new Error(await readResponseErrorMessage(response, "对话请求失败。"));
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

function parseRunMessage(value: unknown): RunMessage {
  if (!isRecord(value) || typeof value.seq !== "number" || !isRecord(value.content)) {
    throw new Error("对话历史返回了无效消息行。");
  }
  if (!isValidThreadMessageSeq(value.seq)) {
    throw new Error("对话历史返回了无效消息行。");
  }

  return {
    run_id: typeof value.run_id === "string" ? value.run_id : "",
    seq: value.seq,
    content: value.content,
    metadata: isRecord(value.metadata) ? value.metadata : {},
    created_at: typeof value.created_at === "string" ? value.created_at : "",
  };
}

function dedupeRunMessagesByIdentity(messages: RunMessage[]): RunMessage[] {
  const lastIndexByIdentity = new Map<string, number>();
  messages.forEach((message, index) => {
    const identity = messageIdentity(message.content);
    if (identity) {
      lastIndexByIdentity.set(`${message.run_id}:${identity}`, index);
    }
  });

  return messages.filter((message, index) => {
    const identity = messageIdentity(message.content);
    if (!identity) {
      return true;
    }
    return lastIndexByIdentity.get(`${message.run_id}:${identity}`) === index;
  });
}

function dedupeMessagesByIdentity(
  messages: AgentThreadState["messages"] = [],
): NonNullable<AgentThreadState["messages"]> {
  const lastIndexByIdentity = new Map<string, number>();
  messages.forEach((message, index) => {
    const identity = messageIdentity(message);
    if (identity) {
      lastIndexByIdentity.set(identity, index);
    }
  });

  return messages.filter((message, index) => {
    const identity = messageIdentity(message);
    if (!identity) {
      return true;
    }
    return lastIndexByIdentity.get(identity) === index;
  });
}

function messageIdentity(message: unknown): string | undefined {
  if (!isRecord(message)) {
    return undefined;
  }
  const toolCallId = message.tool_call_id;
  if (typeof toolCallId === "string" && toolCallId) {
    return `tool:${toolCallId}`;
  }
  const id = message.id;
  return typeof id === "string" && id ? `message:${id}` : undefined;
}

function isValidThreadMessageSeq(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

function buildUrl(endpointBase: string, path: string): string {
  const prefix = endpointBase.replace(/\/$/, "");
  return `${prefix}${path}`;
}

function buildHeaders(headers: HeadersInit | undefined, method = "GET"): Headers {
  const nextHeaders = new Headers(headers);
  for (const [key, value] of Object.entries(JSON_HEADERS)) {
    if (!nextHeaders.has(key)) {
      nextHeaders.set(key, value);
    }
  }

  return appendCsrfHeader(nextHeaders, method);
}

async function readResponseErrorMessage(response: Response, fallback: string): Promise<string> {
  const text = await response.text();
  if (!text) {
    return fallback;
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return fallback;
  }

  if (!isRecord(body)) {
    return fallback;
  }

  return formatResponseErrorDetail(body.detail) ?? fallback;
}

function formatResponseErrorDetail(detail: unknown): string | undefined {
  if (typeof detail === "string") {
    const trimmed = detail.trim();
    return trimmed || undefined;
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => formatResponseErrorDetail(item))
      .filter((item): item is string => Boolean(item));
    return messages.length > 0 ? messages.join("\n") : undefined;
  }

  if (isRecord(detail)) {
    for (const key of ["message", "msg", "error"]) {
      const value = detail[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
