import type { AgentThread, AgentThreadContext, ChannelThreadSource } from "./types";

export const THREAD_PINNED_METADATA_KEY = "deerflow_pinned";

type ThreadRouteTarget =
  | string
  | {
      thread_id: string;
      context?: Pick<AgentThreadContext, "agent_name"> | null;
      metadata?: Record<string, unknown> | null;
    };

export function pathOfThread(
  thread: ThreadRouteTarget,
  context?: Pick<AgentThreadContext, "agent_name"> | null,
): string {
  const threadId = typeof thread === "string" ? thread : thread.thread_id;
  const encodedThreadId = encodeURIComponent(threadId);
  let agentName: string | undefined;

  if (typeof thread === "string") {
    agentName = context?.agent_name;
  } else {
    agentName = thread.context?.agent_name;
    const metaAgent = thread.metadata?.agent_name;
    if (!agentName && typeof metaAgent === "string") {
      agentName = metaAgent;
    }
  }

  return agentName
    ? `/workspace/agents/${encodeURIComponent(agentName)}/chats/${encodedThreadId}`
    : `/workspace/chats/${encodedThreadId}`;
}

export function pathOfNewThread(
  createThreadId: () => string,
  context?: Pick<AgentThreadContext, "agent_name"> | null,
): string {
  return pathOfThread(createThreadId(), context);
}

export function pathAfterDeletingThread({
  context,
  createThreadId,
  currentThreadId,
  deletedThreadId,
}: {
  context?: Pick<AgentThreadContext, "agent_name"> | null;
  createThreadId: () => string;
  currentThreadId: string;
  deletedThreadId: string;
}): string | null {
  if (deletedThreadId !== currentThreadId) {
    return null;
  }
  return pathOfNewThread(createThreadId, context);
}

export function shouldResetChatStateForThreadChange(
  previousThreadId: string | null | undefined,
  nextThreadId: string | null | undefined,
): boolean {
  return Boolean(previousThreadId) && previousThreadId !== nextThreadId;
}

export function titleOfThread(thread: Pick<AgentThread, "thread_id" | "values">): string {
  const title = thread.values?.title;
  return typeof title === "string" && title.trim() ? title : "Untitled";
}

export function isThreadPinned(thread: Pick<AgentThread, "metadata">): boolean {
  return thread.metadata?.[THREAD_PINNED_METADATA_KEY] === true;
}

export function sortPinnedThreads<T extends Pick<AgentThread, "metadata">>(
  threads: readonly T[],
): T[] {
  return threads
    .map((thread, index) => ({ index, thread }))
    .sort((left, right) => {
      const pinnedDiff =
        Number(isThreadPinned(right.thread)) - Number(isThreadPinned(left.thread));
      return pinnedDiff || left.index - right.index;
    })
    .map(({ thread }) => thread);
}

const CHANNEL_PROVIDER_LABELS: Record<string, string> = {
  dingtalk: "DingTalk",
  discord: "Discord",
  feishu: "Feishu",
  slack: "Slack",
  telegram: "Telegram",
  wechat: "WeChat",
  wecom: "WeCom",
};

export function channelSourceOfThread(
  thread: Pick<AgentThread, "metadata">,
): ChannelThreadSource | null {
  const source = thread.metadata?.channel_source;
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return null;
  }

  if (Reflect.get(source, "type") !== "im_channel") {
    return null;
  }

  const provider = Reflect.get(source, "provider");
  if (typeof provider !== "string" || provider.trim().length === 0) {
    return null;
  }

  const normalizedProvider = provider.trim().toLowerCase();
  return {
    type: "im_channel",
    provider: normalizedProvider,
    label: CHANNEL_PROVIDER_LABELS[normalizedProvider] ?? normalizedProvider,
  };
}
