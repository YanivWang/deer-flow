/*
  【文件职责】     定义「当前可见且可聚焦」的唯一判据，供抽屉与 UI primitive 共用。
  【架构位置】     L2
  【主要导出】     FOCUSABLE_SELECTOR、isVisiblyFocusable、visibleFocusableWithin
  【依赖关系】     只依赖 DOM，被 ThreadSidebar 抽屉与 ui/ primitive 消费
  【边界与注意】   可见性过滤不能省，理由见下；这份定义只能有一处。
*/

/**
 * 原生可聚焦元素。`[tabindex]:not([tabindex="-1"])` 覆盖被 primitive 接管
 * tab 序的自定义控件（Reka 的 trigger/item 就是这个形状）。
 */
export const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/**
 * 元素是否**真的**能接收焦点。
 *
 * 对隐藏元素调 `focus()` 是静默无效的——不抛错、不报警，只是什么都没发生。
 * 于是「打开面板后焦点进入面板」会失败而没有任何信号。抽屉与对话框在窄屏下
 * 仍然渲染着若干只在 `md:` 断点显示的控件，它们在 DOM 里往往排在真正的
 * 首个可见控件前面，所以这三条过滤缺一不可：
 *
 * - `hidden`：HTML 属性隐藏；
 * - `visibility: hidden`：仍占位但不可聚焦；
 * - `getClientRects().length === 0`：`display: none` 与零尺寸。
 */
export function isVisiblyFocusable(element: HTMLElement): boolean {
  return (
    !element.hidden &&
    globalThis.getComputedStyle(element).visibility !== "hidden" &&
    element.getClientRects().length > 0
  );
}

/**
 * `root` 内当前可见且可聚焦的元素，按文档序。
 *
 * 初始聚焦与 Tab 循环必须共用这一份定义，否则两者会对「第一个可聚焦元素是谁」
 * 给出不同答案，表现就是「打开后焦点没进去，但 Tab 一次又对了」。
 */
export function visibleFocusableWithin(
  root: ParentNode | null | undefined,
): HTMLElement[] {
  if (!root) return [];
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
    (element) => isVisiblyFocusable(element),
  );
}
