/*
  【文件职责】     声明 MCP config server-state 的唯一 Vue Query identity。
  【对应 frontend/】 core/mcp/hooks.ts
  【架构位置】     L3 server-state identity
  【主要导出】     MCP_CONFIG_QUERY_KEY
  【依赖关系】     无
  【边界与注意】   保持 React K5 的 ["mcpConfig"] identity。
*/

export const MCP_CONFIG_QUERY_KEY = ["mcpConfig"] as const;
