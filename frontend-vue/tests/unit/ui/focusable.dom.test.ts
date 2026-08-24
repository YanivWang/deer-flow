/*
  【文件职责】     钉住「当前可见且可聚焦」的唯一判据。
  【架构位置】     L2 单元测试
  【主要导出】     无；Vitest cases
  【依赖关系】     app/lib/focusable
  【边界与注意】   这三条可见性过滤各自对应一个实测踩过的坑：对隐藏元素调 focus()
                   静默无效，于是「打开面板后焦点进入面板」会失败而不报错。
                   抽屉与 UI primitive 共用这一份定义，不许各写一份。
*/

import { afterEach, describe, expect, it } from "vitest";

import {
  FOCUSABLE_SELECTOR,
  isVisiblyFocusable,
  visibleFocusableWithin,
} from "@/lib/focusable";

function render(html: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.append(host);
  return host;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("visibleFocusableWithin", () => {
  it("returns visible focusables in document order", () => {
    const host = render(`
      <a href="/first">first</a>
      <button type="button">second</button>
      <input aria-label="third" />
      <select aria-label="fourth"><option>x</option></select>
      <textarea aria-label="fifth"></textarea>
      <div tabindex="0">sixth</div>
    `);
    expect(
      visibleFocusableWithin(host).map((element) =>
        element.tagName.toLowerCase(),
      ),
    ).toEqual(["a", "button", "input", "select", "textarea", "div"]);
  });

  it("skips disabled controls, tabindex -1, and anchors without href", () => {
    const host = render(`
      <button type="button" disabled>disabled</button>
      <input aria-label="disabled" disabled />
      <div tabindex="-1">programmatic only</div>
      <a>no href</a>
      <button type="button">only survivor</button>
    `);
    expect(visibleFocusableWithin(host)).toHaveLength(1);
  });

  it("skips hidden elements, because focus() on them fails silently", () => {
    const host = render(`
      <button type="button" hidden>hidden attribute</button>
      <button type="button" style="visibility: hidden">visibility hidden</button>
      <button type="button">visible</button>
    `);
    const zeroBox = host.querySelectorAll("button")[2]!;
    // happy-dom 不做布局，`getClientRects()` 恒为空，所以这里显式模拟
    // 「有盒子」与「没盒子」两种情况，把第三条过滤也钉住。
    zeroBox.getClientRects = (() => [{}]) as never;
    for (const button of [...host.querySelectorAll("button")].slice(0, 2)) {
      button.getClientRects = (() => [{}]) as never;
    }

    expect(visibleFocusableWithin(host)).toEqual([zeroBox]);
    expect(isVisiblyFocusable(zeroBox)).toBe(true);

    zeroBox.getClientRects = (() => []) as never;
    expect(isVisiblyFocusable(zeroBox)).toBe(false);
  });

  it("tolerates a missing root instead of throwing", () => {
    expect(visibleFocusableWithin(null)).toEqual([]);
    expect(visibleFocusableWithin(undefined)).toEqual([]);
  });

  it("keeps one selector for both initial focus and Tab cycling", () => {
    // 初始聚焦与 Tab 循环共用同一个 selector 常量，两者不会对
    // 「第一个可聚焦元素是谁」给出不同答案。
    expect(FOCUSABLE_SELECTOR).toContain("a[href]");
    expect(FOCUSABLE_SELECTOR).toContain("button:not([disabled])");
    expect(FOCUSABLE_SELECTOR).toContain('[tabindex]:not([tabindex="-1"])');
  });
});
