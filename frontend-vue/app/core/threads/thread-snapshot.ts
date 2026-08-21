/*
  【文件职责】     合并稀疏 thread 列表快照而不丢失已缓存的详细 state。
  【对应 frontend/】 core/threads/hooks.ts 的 thread cache merge
  【架构位置】     L3
  【主要导出】     mergeThreadSnapshot
  【依赖关系】     threads/types
  【边界与注意】   metadata/values 分层浅并；更新快照优先覆盖同名字段。
*/
import type { AgentThread } from "./types";

/** Preserve detailed cached fields when a newer list summary is sparse. */
export function mergeThreadSnapshot(
  existing: AgentThread | undefined,
  incoming: AgentThread,
): AgentThread {
  if (!existing) return incoming;
  return {
    ...existing,
    ...incoming,
    metadata: { ...existing.metadata, ...incoming.metadata },
    values: { ...existing.values, ...incoming.values },
  };
}
