/*
  【文件职责】     固定 browser remote keyboard、IME 与 host shortcut preventDefault 策略。
  【对应 frontend/】 frontend/tests/unit/components/workspace/browser-view/keyboard.test.ts
  【架构位置】     测试
  【主要导出】     decideBrowserKeyInput 回归用例
  【依赖关系】     app/core/browser/keyboard.ts
  【边界与注意】   返回 null 的按键必须留给本地浏览器/系统，调用方不得 preventDefault。
*/

import { describe, expect, it } from "vitest";

import { decideBrowserKeyInput } from "@/core/browser/keyboard";

function context(
  overrides: Partial<Parameters<typeof decideBrowserKeyInput>[0]> = {},
) {
  return {
    eventType: "keydown" as const,
    live: true,
    editableTarget: false,
    composing: false,
    key: "a",
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    ...overrides,
  };
}

describe("decideBrowserKeyInput", () => {
  it("forwards printable text and named editing/navigation keys on keydown", () => {
    expect(decideBrowserKeyInput(context({ key: "a" }))).toEqual({
      type: "text",
      text: "a",
    });
    expect(decideBrowserKeyInput(context({ key: "Enter" }))).toEqual({
      type: "key",
      key: "Enter",
    });
    expect(decideBrowserKeyInput(context({ key: "ArrowLeft" }))).toEqual({
      type: "key",
      key: "ArrowLeft",
    });
    expect(
      decideBrowserKeyInput(context({ eventType: "keyup", key: "Enter" })),
    ).toBeNull();
  });

  it("forwards remote editing chords but preserves browser/system shortcuts", () => {
    expect(decideBrowserKeyInput(context({ key: "c", metaKey: true }))).toEqual(
      {
        type: "key",
        key: "Meta+C",
      },
    );
    expect(decideBrowserKeyInput(context({ key: "a", ctrlKey: true }))).toEqual(
      {
        type: "key",
        key: "Control+A",
      },
    );
    for (const shortcut of [
      { key: "l", metaKey: true },
      { key: "r", ctrlKey: true },
      { key: "w", metaKey: true },
      { key: "m", metaKey: true },
      { key: " ", metaKey: true },
      { key: "ArrowLeft", metaKey: true },
      { key: "F5" },
    ]) {
      expect(decideBrowserKeyInput(context(shortcut))).toBeNull();
    }
  });

  it("does not forward editable, inactive, alt, or IME-owned key events", () => {
    expect(
      decideBrowserKeyInput(context({ key: "Enter", editableTarget: true })),
    ).toBeNull();
    expect(
      decideBrowserKeyInput(context({ key: "Enter", live: false })),
    ).toBeNull();
    expect(
      decideBrowserKeyInput(context({ key: "a", altKey: true })),
    ).toBeNull();
    expect(
      decideBrowserKeyInput(context({ key: "Enter", composing: true })),
    ).toBeNull();
  });
});
