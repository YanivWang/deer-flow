/*
  【文件职责】     把 Gateway workspace change status/reason 映射为 i18n key。
  【架构位置】     L3 presentation
  【主要导出】     workspaceChangeStatusKey · workspaceChangeReasonKey
                   formatWorkspacePath
  【依赖关系】     workspace changes wire types
  【边界与注意】   不折叠真实 reason；null 才使用 generic fallback。
*/
import type { DiffUnavailableReason, WorkspaceChangeStatus } from "./types";

export function workspaceChangeStatusKey(status: WorkspaceChangeStatus) {
  return {
    created: "created",
    modified: "modified",
    deleted: "deleted",
    symlink_created: "symlinkCreated",
  }[status] as "created" | "modified" | "deleted" | "symlinkCreated";
}

export function workspaceChangeReasonKey(reason: DiffUnavailableReason | null) {
  return reason
    ? (
        {
          binary: "binaryUnavailable",
          large: "largeUnavailable",
          sensitive: "sensitiveUnavailable",
          truncated: "truncatedUnavailable",
          symlink: "symlinkUnavailable",
        } as const
      )[reason]
    : "diffUnavailable";
}

/**
 * summary 行里那条路径怎么拆。
 *
 * 上游 `workspace-change-badge.tsx` 的 `formatWorkspacePath` 是组件私有函数，
 * 这里提到 L3 只是为了能单测：两条前缀替换与「最后一个 `/`」的切分都是纯字符串
 * 逻辑，放在组件里就只能靠挂载去测。
 *
 * 目录段与文件名段**必须分开**：上游把前者渲染成 `text-muted-foreground`、
 * 后者 `text-foreground font-medium`，整条一个颜色的话，同一行路径在两个应用里
 * 的视觉重心不一样。
 */
export function formatWorkspacePath(path: string): {
  dirname: string;
  basename: string;
} {
  const compact = path
    .replace(/^\/mnt\/user-data\/workspace\//, "")
    .replace(/^\/mnt\/user-data\/outputs\//, "outputs/");
  const lastSlash = compact.lastIndexOf("/");
  if (lastSlash < 0) return { dirname: "", basename: compact };
  return {
    dirname: compact.slice(0, lastSlash),
    basename: compact.slice(lastSlash + 1),
  };
}
