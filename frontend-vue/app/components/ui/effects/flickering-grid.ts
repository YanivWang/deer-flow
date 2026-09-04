/*
  【文件职责】     提供 flickering grid 的初始透明度与帧更新纯函数。
  【架构位置】     L3 product UI helper
  【主要导出】     createInitialOpacities · prefersReducedMotion
  【依赖关系】     无
  【边界与注意】   仅服务 M7 产品特效，不进入 M8 L2 公共集合。
*/

export function createInitialOpacities(count: number, maxOpacity: number) {
  const values = new Float32Array(Math.max(0, count));
  for (let index = 0; index < values.length; index += 1) {
    // Stable initial paint keeps screenshots deterministic. Runtime flicker
    // may randomize a cell only after this frame has been drawn.
    const hash = Math.imul(index + 1, 2654435761) >>> 0;
    values[index] = (hash / 0xffffffff) * maxOpacity;
  }
  return values;
}

export function prefersReducedMotion() {
  return (
    globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  );
}
