/*
  【文件职责】     集中声明 Agent Vue Query keys。
  【对应 frontend/】 core/agents/hooks.ts
  【架构位置】     L3 server-state identity
  【主要导出】     agentKeys
  【依赖关系】     无
  【边界与注意】   list/detail 共用前缀，便于创建、更新、删除后精确同步。
*/

export const agentKeys = {
  all: ["agents"] as const,
  list: () => [...agentKeys.all, "list"] as const,
  detail: (name: string) => [...agentKeys.all, "detail", name] as const,
};
