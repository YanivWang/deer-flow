/*
  【文件职责】     钉住「这一行是不是一条打全了的内建命令」这个共享谓词。
  【架构位置】     L3 测试
  【依赖关系】     core/threads/builtin-command
  【边界与注意】   两个消费者共用它：润色按钮的禁用判据、以及输入框「打全了就直接
                   执行」的回车语义。判错一边就会连累另一边。
*/

import { describe, expect, it } from "vitest";

import { isCompleteBuiltinCommand } from "@/core/threads/builtin-command";

describe("isCompleteBuiltinCommand", () => {
  it("accepts every spelling the two dispatchers actually run", () => {
    for (const value of [
      "/goal",
      "/goal ",
      "/goal clear",
      "/goal ship the parity harness",
      "/GOAL",
      "/compact",
      "/context compact",
      "  /compact  ",
    ]) {
      expect(isCompleteBuiltinCommand(value)).toBe(true);
    }
  });

  it("rejects half-typed commands and ordinary text", () => {
    for (const value of [
      "",
      "   ",
      "/",
      "/go",
      "/comp",
      "/compacted",
      "/goalkeeper",
      "compact",
      "tell me about /compact",
    ]) {
      expect(isCompleteBuiltinCommand(value)).toBe(false);
    }
  });
});
