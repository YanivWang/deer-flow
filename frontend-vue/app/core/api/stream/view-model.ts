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
    notices: snapshot.notices,
    gapCount: snapshot.gapCount,
    done: snapshot.done,
    errorMessage: meta.errorMessage ?? null,
  };
}

function extractSnapshotMessages(snapshot: StreamSnapshot): unknown[] {
  const valuesMessages = readMessagesArray(snapshot.values);
  return valuesMessages.length > 0 ? valuesMessages : snapshot.messageDeltas;
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
  return { ...(id ? { id } : {}), role, content, raw };
}

function mergeMessagesForView(historyMessages: unknown[], liveMessages: unknown[]): StreamViewMessage[] {
  const merged: StreamViewMessage[] = [];
  const indexByIdentity = new Map<string, number>();

  for (const raw of [...historyMessages, ...liveMessages]) {
    const message = normalizeMessageForView(raw);
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
