/*
  【文件职责】     判断一段草稿是否允许送去润色。
  【架构位置】     L3
  【主要导出】     canPolishInput
  【依赖关系】     threads/builtin-command
  【边界与注意】   与 React 的 canPolishInput（frontend/src/components/workspace/
                   input-box-helpers.ts）同判据：空草稿不润色，内建命令行也不润色——
                   `/goal ...` 与 `/compact` 会被各自的处理器接走，不进模型，
                   把它们改写掉等于让命令悄悄变成一句普通聊天。
                   判据复用 isCompleteBuiltinCommand，而不是第三份命令清单——
                   输入框的回车语义用的是同一个谓词。
*/

import { isCompleteBuiltinCommand } from "@/core/threads/builtin-command";

export function canPolishInput(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return !isCompleteBuiltinCommand(trimmed);
}
