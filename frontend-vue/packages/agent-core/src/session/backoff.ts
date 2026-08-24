/*
  【文件职责】     重连退避的纯计算（05 L4）与重试总量上限的判据（05 L5）。
  【架构位置】     L1
  【主要导出】     BackoffOptions · DEFAULT_BACKOFF · computeBackoffDelay
  【依赖关系】     无
  【边界与注意】   `random` 由调用方注入而不是直接用 `Math.random()`：抖动的目的是
                   打散重连风暴，但测试要能断言「第 3 次退避是 4s 而不是 4s±抖动」。
                   注入之后同一份实现既能抖也能定。

                   05 L5 的「总量上限」不在本文件——它是会话状态（已经重连了几次），
                   这里只提供判据形状。gamma 那份在每段成功后把计数清零，持续抖动的
                   连接因此可以无限重连；DeerFlow 的长任务必须按**整个 session 的
                   累计次数**封顶，所以 run-session 里的计数器只增不减。
*/

export interface BackoffOptions {
  baseMs: number;
  factor: number;
  maxMs: number;
  /** 0 = 不抖动；0.2 = 在 ±20% 内抖。 */
  jitterRatio: number;
  /** 注入的 [0,1) 随机源。 */
  random?: () => number;
}

/**
 * 起点 1s、翻倍、封顶 30s。
 *
 * 阈值不是抄来的：DeerFlow 的 agent 会跑很长的工具调用（sandbox 执行、浏览器
 * 操作、子 agent），重连间隔比 gamma 的「三次立即重试」宽得多才有意义——
 * 三次快速重试撞上的通常是同一次网络抖动，等于一次都没重试。
 */
export const DEFAULT_BACKOFF: BackoffOptions = {
  baseMs: 1_000,
  factor: 2,
  maxMs: 30_000,
  jitterRatio: 0.2,
};

/** `attempt` 从 1 起算（第一次重连）。 */
export function computeBackoffDelay(
  attempt: number,
  options: BackoffOptions,
): number {
  const exponent = Math.max(0, attempt - 1);
  const raw = options.baseMs * Math.pow(options.factor, exponent);
  const capped = Math.min(raw, options.maxMs);
  if (options.jitterRatio <= 0) return Math.round(capped);

  const random = options.random ?? Math.random;
  const spread = capped * options.jitterRatio;
  // 双边抖动：只往后抖会让实际间隔系统性偏大，封顶也随之失真。
  const jittered = capped - spread + random() * spread * 2;
  return Math.max(0, Math.round(jittered));
}
