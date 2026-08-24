/*
  【文件职责】     渲染合帧的调度判定（前沿 flush + 至多一次尾部 flush）。
  【架构位置】     L3（纯 TS）
  【主要导出】     STREAM_RENDER_COALESCE_MS · CoalesceDecision · decideCoalesce
  【依赖关系】     无
  【边界与注意】   这**不是** 05 A1。A1 说的是「同宏任务内的流事件合并成一次通知」，
                   实现在 L1 的 external store（`queueMicrotask`）。本文件是它之上
                   的第二层：把「每个宏任务一次」再降到「每 80ms 一次」，为的是
                   merge/group/render 这条重管线按帧预算跑而不是按 token 跑。

                   两层都不许退化成尾部防抖，理由相同也写在两处：
                   `delayMs = interval - elapsed`，**永远不超过一个 interval**，
                   所以密集流饿不死 UI。判定与副作用分开的收益在 `flush-now`
                   那条分支上——它要求调用方**先拆掉已武装的定时器**，这个义务
                   只有在纯函数里穷举得出来（上游用例专门测了「迟到的尾部 flush
                   还挂着时仍取前沿」）。
*/

export const STREAM_RENDER_COALESCE_MS = 80;

export type CoalesceDecision =
  | { action: "flush-now" }
  | { action: "schedule"; delayMs: number }
  | { action: "wait" };

/**
 * Decide how an incoming stream update reaches the rendered snapshot: flush
 * immediately once a full interval has elapsed (leading edge), otherwise
 * schedule exactly one trailing flush for the interval remainder. Unlike a
 * debounce, the delay never extends past the interval, so a dense stream can
 * never starve rendering.
 */
export function decideCoalesce(
  nowMs: number,
  lastFlushMs: number,
  intervalMs: number,
  hasPendingTimer: boolean,
): CoalesceDecision {
  if (nowMs - lastFlushMs >= intervalMs) {
    return { action: "flush-now" };
  }
  if (hasPendingTimer) {
    return { action: "wait" };
  }
  return { action: "schedule", delayMs: intervalMs - (nowMs - lastFlushMs) };
}
