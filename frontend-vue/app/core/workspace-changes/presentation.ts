/*
  【文件职责】     把 Gateway workspace change status/reason 映射为 i18n key。
  【架构位置】     L3 presentation
  【主要导出】     workspaceChangeStatusKey · workspaceChangeReasonKey
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
