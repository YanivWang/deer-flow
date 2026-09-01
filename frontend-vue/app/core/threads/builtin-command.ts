/*
  【文件职责】     判断一行草稿是否**正好**是一条打全了的内建命令。
  【架构位置】     L3
  【主要导出】     isCompleteBuiltinCommand
  【依赖关系】     threads/goal · threads/compact-command
  【边界与注意】   两个消费者共用一份判据：润色按钮（内建命令行不送去改写）与输入框的
                   回车语义（打全了的命令直接执行，而不是再接受一次它自己的建议）。
                   复用两个已有的解析器，而不是维护第三份命令清单——清单一分家，
                   两处对「什么算内建命令」的答案迟早会不一样。
*/

import { isCompactCommand } from "./compact-command";
import { parseGoalCommand } from "./goal";

export function isCompleteBuiltinCommand(value: string): boolean {
  const trimmed = value.trim();
  return parseGoalCommand(trimmed) !== null || isCompactCommand(trimmed);
}
