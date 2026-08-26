/*
  【文件职责】     虚拟列表在滚动祖先里的原点计算，以及切换虚拟化的阈值。
  【架构位置】     L3 thread presentation
  【主要导出】     VIRTUALIZATION_THRESHOLD · calculateScrollMargin
  【依赖关系】     无
  【边界与注意】   与 React 的 thread-list-virtualizer.tsx 同一份常数与算法。抽成
                   纯函数是为了能单测：虚拟列表本身要真实布局才跑得起来，而这两个
                   数字错了的表现是「列表整体偏移一段」，在截图里像是间距问题。
*/

/** 少于这么多条就不虚拟化：短列表全量渲染更快，也更好调试。 */
export const VIRTUALIZATION_THRESHOLD = 60;

export function calculateScrollMargin(
  rootTop: number,
  scrollParentTop: number,
  scrollTop: number,
) {
  return Math.max(0, rootTop - scrollParentTop + scrollTop);
}
