/*
  【文件职责】     识别与 React 一致的 context compact 内建命令拼写。
  【架构位置】     L3
  【主要导出】     isCompactCommand
  【依赖关系】     无
  【边界与注意】   只接受完整命令，避免普通消息被误吞。
*/
/** React-compatible built-in compact command spellings. */
export function isCompactCommand(value: string): boolean {
  return /^\/(?:compact|context\s+compact)\s*$/i.test(value.trim());
}
