/*
  【文件职责】     Scheduled-task Vue Query key 的唯一注册表。
  【架构位置】     L3 server-state contract
  【主要导出】     scheduledTaskKeys
  【依赖关系】     零依赖
  【边界与注意】   没有 detail key：详情来自列表那一份数据，页面不再单独取一次
                   （理由写在 useScheduledTasks.ts 文件头）。

                   也没有「哪种 mutation 失效哪几个 key」的表。任何一种 mutation 之后
                   失效的都是 `root()` 这**整棵**子树：React 的六个 mutation hook 各自调
                   `invalidateQueries(["scheduled-tasks"])`（外加两条被前缀盖住的冗余
                   调用），前缀失效会把 list、thread 与 runs 一并标脏，于是 pause/resume
                   之后 runs 也会重取。写成精确 key 的那一版只标脏 list，少发一次请求
                   ——那不是优化，是与 React 不同的刷新时机，在同一个 Gateway 上会产生
                   两种可见结果。
*/

export const scheduledTaskKeys = {
  /** 前缀 key：mutation 之后失效的就是它，配合 `exact: false`。 */
  root: () => ["scheduled-tasks"] as const,
  list: () => ["scheduled-tasks", "list"] as const,
  thread: (threadId: string) =>
    ["scheduled-tasks", "thread", threadId] as const,
  runs: (taskId: string) => ["scheduled-tasks", "runs", taskId] as const,
};
