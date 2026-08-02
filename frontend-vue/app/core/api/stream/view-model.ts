import type { StreamSnapshot } from "./reducer";
import type { DeerFlowMessage } from "../thread/types";

export type ThreadStreamStatus =
  | "idle"
  | "streaming"
  | "recovering"
  | "stopping"
  | "completed"
  | "aborted"
  | "error";

export type StreamViewMessage = {
  id?: string;
  role: string;
  content: string;
  reasoning?: string;
  raw: unknown;
};

export type ThreadStreamViewModel = {
  threadId: string | null;
  runId: string | null;
  status: ThreadStreamStatus;
  cursor: string | null;
  messageCount: number;
  messages: StreamViewMessage[];
  subtasks: unknown[];
  artifacts: unknown[];
  humanInputRequests: unknown[];
  notices: unknown[];
  gapCount: number;
  done: boolean;
  errorMessage: string | null;
};

export type ThreadStreamViewModelMeta = {
  threadId?: string | null;
  runId?: string | null;
  status?: ThreadStreamStatus;
  errorMessage?: string | null;
  historyMessages?: unknown[];
};

export function deriveThreadStreamViewModel(
  snapshot: StreamSnapshot,
  meta: ThreadStreamViewModelMeta = {},
): ThreadStreamViewModel {
  const messages = mergeMessagesForView(meta.historyMessages ?? [], extractSnapshotMessages(snapshot));

  return {
    threadId: meta.threadId ?? null,
    runId: meta.runId ?? null,
    status: meta.status ?? (snapshot.done ? "completed" : "idle"),
    cursor: snapshot.cursor ?? null,
    messageCount: messages.length,
    messages,
    subtasks: snapshot.subtasks,
    artifacts: snapshot.artifacts,
    humanInputRequests: snapshot.humanInputRequests,
    notices: snapshot.notices,
    gapCount: snapshot.gapCount,
    done: snapshot.done,
    errorMessage: meta.errorMessage ?? null,
  };
}

function extractSnapshotMessages(snapshot: StreamSnapshot): unknown[] {
  const valuesMessages = readMessagesArray(snapshot.values);
  // LangGraph's `values` frames can arrive before the final tool-call chunks.
  // Keep both sources and let the identity merge below replace partial rows
  // with the assembled delta instead of dropping the streamed tool call.
  const deltas = assembleMessageDeltas(snapshot.messageDeltas);
  const valueIds = new Set(valuesMessages.flatMap((message) => {
    if (!isRecord(message) || typeof message.id !== "string") return [];
    return [message.id];
  }));
  return [...valuesMessages, ...deltas.filter((message) => {
    if (!isRecord(message) || typeof message.id !== "string") return true;
    if (!valueIds.has(message.id)) return true;
    return Array.isArray(message.tool_calls) && message.tool_calls.length > 0;
  })];
}

function assembleMessageDeltas(deltas: unknown[]): unknown[] {
  const messages = new Map<string, {
    type: "ai";
    id: string;
    content: string;
    reasoning_content: string;
    tool_calls: Array<{ id: string; name: string; args: Record<string, unknown> }>;
    chunks: Map<number, { id: string; name: string; args: string }>;
  }>();

  for (const delta of deltas) {
    const chunk = Array.isArray(delta) ? delta[0] : delta;
    if (!isRecord(chunk)) continue;
    const id = typeof chunk.id === "string" && chunk.id ? chunk.id : `delta-${messages.size}`;
    const current = messages.get(id) ?? {
      type: "ai" as const,
      id,
      content: "",
      reasoning_content: "",
      tool_calls: [],
      chunks: new Map(),
    };
    if (typeof chunk.content === "string") current.content += chunk.content;
    const reasoning = isRecord(chunk.additional_kwargs)
      ? chunk.additional_kwargs.reasoning_content
      : chunk.reasoning_content;
    if (typeof reasoning === "string") current.reasoning_content += reasoning;
    const toolChunks = Array.isArray(chunk.tool_call_chunks) ? chunk.tool_call_chunks : [];
    for (const rawChunk of toolChunks) {
      if (!isRecord(rawChunk)) continue;
      const index = typeof rawChunk.index === "number" ? rawChunk.index : 0;
      const previous = current.chunks.get(index) ?? {
        id: typeof rawChunk.id === "string" ? rawChunk.id : `tool-${index}`,
        name: typeof rawChunk.name === "string" ? rawChunk.name : "tool",
        args: "",
      };
      if (typeof rawChunk.name === "string" && rawChunk.name) previous.name = rawChunk.name;
      if (typeof rawChunk.id === "string" && rawChunk.id) previous.id = rawChunk.id;
      if (typeof rawChunk.args === "string") previous.args += rawChunk.args;
      current.chunks.set(index, previous);
    }
    messages.set(id, current);
  }

  return [...messages.values()].map(({ chunks, ...message }) => ({
    ...message,
    ...(chunks.size > 0
      ? {
          tool_calls: [...chunks.values()].flatMap((chunk) => {
            try {
              const args = JSON.parse(chunk.args) as unknown;
              return isRecord(args) ? [{ id: chunk.id, name: chunk.name, args }] : [];
            } catch {
              return [];
            }
          }),
        }
      : {}),
  }));
}

function readMessagesArray(values: unknown): unknown[] {
  if (!isRecord(values)) {
    return [];
  }
  const messages = values.messages;
  return Array.isArray(messages) ? messages : [];
}

function normalizeMessageForView(raw: unknown): StreamViewMessage {
  if (!isRecord(raw)) {
    return { role: "unknown", content: String(raw ?? ""), raw };
  }

  const id = typeof raw.id === "string" ? raw.id : undefined;
  const role = readRole(raw);
  const content = readMessageContent(raw.content);
  const reasoning = readReasoningContent(raw);
  return { ...(id ? { id } : {}), role, content, ...(reasoning ? { reasoning } : {}), raw };
}

function readReasoningContent(message: Record<string, unknown>): string {
  const direct = message.reasoning_content;
  const additional = isRecord(message.additional_kwargs)
    ? message.additional_kwargs.reasoning_content
    : undefined;
  return typeof direct === "string" ? direct : typeof additional === "string" ? additional : "";
}

function mergeMessagesForView(historyMessages: unknown[], liveMessages: unknown[]): StreamViewMessage[] {
  const merged: StreamViewMessage[] = [];
  const indexByIdentity = new Map<string, number>();
  const optimisticHumanIndexByContent = new Map<string, number>();

  for (const raw of [...historyMessages, ...liveMessages]) {
    const message = normalizeMessageForView(raw);
    const rawId = isRecord(raw) && typeof raw.id === "string" ? raw.id : "";
    if (message.role === "human" && rawId.startsWith("optimistic-") && message.content) {
      optimisticHumanIndexByContent.set(message.content, merged.length);
    } else if (message.role === "human" && !rawId && message.content) {
      const optimisticIndex = optimisticHumanIndexByContent.get(message.content);
      if (optimisticIndex !== undefined) {
        continue;
      }
    }
    const identity = messageIdentity(raw, message);
    if (!identity) {
      merged.push(message);
      continue;
    }

    const existingIndex = indexByIdentity.get(identity);
    if (existingIndex === undefined) {
      indexByIdentity.set(identity, merged.length);
      merged.push(message);
    } else {
      merged[existingIndex] = message;
    }
  }

  return merged;
}

function messageIdentity(raw: unknown, normalized: StreamViewMessage): string | undefined {
  if (isRecord(raw)) {
    const toolCallId = raw.tool_call_id;
    if (typeof toolCallId === "string" && toolCallId) {
      return `tool:${toolCallId}`;
    }
  }
  return normalized.id ? `message:${normalized.id}` : undefined;
}

function readRole(message: DeerFlowMessage): string {
  const type = message.type ?? message.role;
  if (type === "assistant") {
    return "ai";
  }
  return typeof type === "string" && type ? type : "unknown";
}

function readMessageContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content.map(readContentPart).filter(Boolean).join("");
  }
  if (content == null) {
    return "";
  }
  return String(content);
}

function readContentPart(part: unknown): string {
  if (typeof part === "string") {
    return part;
  }
  if (!isRecord(part)) {
    return "";
  }
  if (typeof part.text === "string") {
    return part.text;
  }
  if (typeof part.content === "string") {
    return part.content;
  }
  return "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
