/*
  【文件职责】     Thread share URL 与 export state-load 的无 UI 契约。
  【架构位置】     L3 thread actions
  【主要导出】     buildThreadShareUrl · loadThreadExportMessages
  【依赖关系】     thread path · API client-shaped contract
  【边界与注意】   share 不调用 API；export 只消费现有 thread-state client。
*/
import type { Message } from "@/core/types/message";

import { pathOfThread } from "./utils";

const PUBLIC_SHARE_ORIGIN = "https://deer-flow-v2.vercel.app";

type ShareableThread = {
  thread_id: string;
  context?: { agent_name?: string } | null;
  metadata?: Record<string, unknown> | null;
};

export function buildThreadShareUrl(thread: ShareableThread, origin: string) {
  const url = new URL(origin);
  const shareOrigin = ["localhost", "127.0.0.1"].includes(url.hostname)
    ? PUBLIC_SHARE_ORIGIN
    : url.origin;
  return new URL(pathOfThread(thread), shareOrigin).toString();
}

type ThreadStateClient = {
  threads: {
    getState(threadId: string): Promise<{
      values?: { messages?: Message[] | null } | null;
    }>;
  };
};

export async function loadThreadExportMessages(
  client: ThreadStateClient,
  threadId: string,
) {
  const state = await client.threads.getState(threadId);
  const messages = state.values?.messages ?? [];
  if (messages.length === 0) {
    throw new Error("This conversation has no messages to export.");
  }
  return messages;
}
