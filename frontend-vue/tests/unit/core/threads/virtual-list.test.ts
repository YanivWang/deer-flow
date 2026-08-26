/*
  与 React 的 thread-list-virtualizer.test.ts 同一组用例：虚拟列表的原点是「本列表
  相对滚动祖先内容顶部」的偏移，不能为负。这两个数字错了的表现是整块列表整体偏移
  一段——在截图里像是间距没调好，实际是每一行都排在错的位置。
*/
import { describe, expect, it } from "vitest";

import {
  calculateScrollMargin,
  VIRTUALIZATION_THRESHOLD,
} from "@/core/threads/virtual-list";

describe("calculateScrollMargin", () => {
  it("keeps a nested list aligned to its scrolling ancestor", () => {
    expect(calculateScrollMargin(180, 40, 0)).toBe(140);
    expect(calculateScrollMargin(-320, 40, 500)).toBe(140);
  });

  it("does not produce a negative virtual-list origin", () => {
    expect(calculateScrollMargin(20, 40, 0)).toBe(0);
  });
});

describe("virtualization threshold", () => {
  it("matches React's cutover point", () => {
    expect(VIRTUALIZATION_THRESHOLD).toBe(60);
  });
});
