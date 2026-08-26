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

/**
 * 取出可导出的消息。**空列表就返回空列表**，不抛异常。
 *
 * 原来这里在空的时候抛一个写死英文句子的 Error，调用方再拿正则去匹配那句话，
 * 决定该念哪一条文案。两处都不对：core 层出现用户可见的英文字面量，而分支判据
 * 变成"错误消息长什么样"——上游哪天改一个词，那条分支就静默失效，没有任何门禁会红。
 * React 那边就是一个 `messages.length === 0` 的直接判断
 * （frontend/src/components/workspace/recent-chat-list.tsx 的 handleExport）。
 */
export async function loadThreadExportMessages(
  client: ThreadStateClient,
  threadId: string,
) {
  const state = await client.threads.getState(threadId);
  return state.values?.messages ?? [];
}
