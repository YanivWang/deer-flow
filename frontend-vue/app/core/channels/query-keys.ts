/*
  【文件职责】     定义 channel providers/connections 的用户隔离 Vue Query key。
  【架构位置】     L3 server-state contract
  【主要导出】     channelKeys
  【依赖关系】     无
  【边界与注意】   scope 必须来自已认证用户；切换 scope 后旧响应只能写回旧 key。
*/

export const channelKeys = {
  all: ["channels"] as const,
  scope: (scopeKey: string) => ["channels", scopeKey] as const,
  providers: (scopeKey: string) => ["channels", scopeKey, "providers"] as const,
  connections: (scopeKey: string) =>
    ["channels", scopeKey, "connections"] as const,
};
