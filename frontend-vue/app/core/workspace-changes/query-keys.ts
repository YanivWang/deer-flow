/*
  【文件职责】     声明 workspace changes 的唯一 Query identity。
  【架构位置】     L3 server-state identity
  【主要导出】     workspaceChangesKeys
  【依赖关系】     无
  【边界与注意】   summary/detail 及 thread/run 必须隔离，防止旧响应复用。
*/
export const workspaceChangesKeys = {
  all: ["workspace-changes"] as const,
  request(
    threadId: string,
    runId: string,
    includeFiles: boolean,
    includeDiff: boolean,
  ) {
    return [
      ...this.all,
      threadId,
      runId,
      { includeFiles, includeDiff },
    ] as const;
  },
};
