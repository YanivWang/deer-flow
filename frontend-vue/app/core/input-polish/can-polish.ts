/*
  【文件职责】     判断一段草稿是否允许送去润色。
  【架构位置】     L3
  【主要导出】     canPolishInput
  【依赖关系】     threads/goal · threads/compact-command
  【边界与注意】   与 React 的 canPolishInput（frontend/src/components/workspace/
                   input-box-helpers.ts）同判据：空草稿不润色，内建命令行也不润色——
                   `/goal ...` 与 `/compact` 会被各自的处理器接走，不进模型，
                   把它们改写掉等于让命令悄悄变成一句普通聊天。
                   判据复用两个已有的解析器，而不是第三份命令清单。
*/

import { isCompactCommand } from "@/core/threads/compact-command";
import { parseGoalCommand } from "@/core/threads/goal";

export function canPolishInput(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return parseGoalCommand(trimmed) === null && !isCompactCommand(trimmed);
}
