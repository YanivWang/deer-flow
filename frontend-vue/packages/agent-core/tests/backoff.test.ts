/*
  【文件职责】     退避计算（05 L4）的边界。
  【架构位置】     L1 测试
  【主要导出】     无
  【依赖关系】     ../src/session/backoff
  【边界与注意】   抖动用注入的随机源断言确定值。用真 `Math.random()` 只能写
                   「落在某个区间」，那种断言对「抖动方向反了」「spread 算错一倍」
                   都是绿的。
*/

import { describe, expect, it } from "vitest";

import { computeBackoffDelay, DEFAULT_BACKOFF } from "../src/session/backoff";

const noJitter = { baseMs: 1000, factor: 2, maxMs: 30_000, jitterRatio: 0 };

describe("指数退避（05 L4）", () => {
  it("attempt 从 1 起算，第一次就是 baseMs", () => {
    expect(computeBackoffDelay(1, noJitter)).toBe(1000);
  });

  it("按 factor 翻倍", () => {
    expect([2, 3, 4, 5].map((n) => computeBackoffDelay(n, noJitter))).toEqual([
      2000, 4000, 8000, 16_000,
    ]);
  });

  it("封顶后不再增长", () => {
    expect(computeBackoffDelay(6, noJitter)).toBe(30_000);
    expect(computeBackoffDelay(50, noJitter)).toBe(30_000);
  });

  it("默认值不是 gamma 的「三次立即重试」", () => {
    // 这条钉的是判断本身：DeerFlow 的长任务如果退避从 0 开始，
    // 三次快速重试撞上的通常是同一次网络抖动，等于一次都没重试。
    expect(DEFAULT_BACKOFF.baseMs).toBeGreaterThanOrEqual(1000);
    expect(DEFAULT_BACKOFF.maxMs).toBeGreaterThanOrEqual(10_000);
  });
});

describe("抖动", () => {
  const jitter = { ...noJitter, jitterRatio: 0.2 };

  it("random=0 落在下界，random=1 落在上界", () => {
    expect(computeBackoffDelay(1, { ...jitter, random: () => 0 })).toBe(800);
    expect(computeBackoffDelay(1, { ...jitter, random: () => 1 })).toBe(1200);
  });

  it("random=0.5 回到中值——抖动是双边的，不是只往后推", () => {
    expect(computeBackoffDelay(1, { ...jitter, random: () => 0.5 })).toBe(1000);
  });

  it("永不为负", () => {
    const wild = { ...noJitter, jitterRatio: 5, random: () => 0 };
    expect(computeBackoffDelay(1, wild)).toBeGreaterThanOrEqual(0);
  });
});
