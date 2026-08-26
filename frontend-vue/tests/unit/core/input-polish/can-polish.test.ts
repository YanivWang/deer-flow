/*
  【文件职责】     钉住「哪些草稿可以送去润色」的判据。
  【架构位置】     纯逻辑测试
  【主要导出】     无；Vitest cases
  【依赖关系】     core/input-polish/can-polish
  【边界与注意】   内建命令行必须原样送到各自的处理器：被改写掉的 `/goal ...`
                   会变成一句普通聊天，用户看不出发生了什么。
*/

import { describe, expect, it } from "vitest";

import { canPolishInput } from "@/core/input-polish/can-polish";

describe("canPolishInput", () => {
  it("refuses an empty or whitespace-only draft", () => {
    expect(canPolishInput("")).toBe(false);
    expect(canPolishInput("   \n\t ")).toBe(false);
  });

  it("refuses built-in command lines that never reach the model", () => {
    expect(canPolishInput("/goal")).toBe(false);
    expect(canPolishInput("/goal Ship the release")).toBe(false);
    expect(canPolishInput("  /GOAL clear ")).toBe(false);
    expect(canPolishInput("/compact")).toBe(false);
    expect(canPolishInput("/context compact")).toBe(false);
  });

  it("allows ordinary prose, including text that merely mentions a command", () => {
    expect(canPolishInput("summarise this")).toBe(true);
    expect(canPolishInput("what does /goal do?")).toBe(true);
    expect(canPolishInput("/goalkeeper stats")).toBe(true);
  });
});
