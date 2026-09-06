/*
  【文件职责】     钉住 rAF stub 的收尾：`cleanup()` 之后不能再有定时器活着。
  【架构位置】     单元测试
  【主要导出】     无；Vitest cases
  【依赖关系】     tests/support/animation-frame-stub
  【边界与注意】   **它守的那个缺陷是间歇性的**：真实症状是「用例全绿、退出码却是 1」，
                   同一棵树跑三次只红一次（wave 96 实测）。靠反复跑去验证不划算，
                   所以把判据落在这里——`cleanup()` 之后推进时钟，回调一次都不该再跑。
*/

import { afterEach, describe, expect, it, vi } from "vitest";

import { installAnimationFrameStub } from "../../support/animation-frame-stub";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("installAnimationFrameStub", () => {
  it("cleanup 之后，已经排队的回调一个都不再跑", () => {
    vi.useFakeTimers();
    const frames = installAnimationFrameStub();
    const ran = vi.fn();

    requestAnimationFrame(ran);
    requestAnimationFrame(ran);
    expect(ran).not.toHaveBeenCalled();

    frames.cleanup();
    vi.advanceTimersByTime(1000);
    // 没有 cleanup 的话这里会是 2 次——而那两次正是「全局已经换回去之后
    // 还有人调 requestAnimationFrame」的来源。
    expect(ran).not.toHaveBeenCalled();
  });

  it("没 cleanup 时回调照常跑（证明上面那条不是因为 stub 压根没装上）", () => {
    vi.useFakeTimers();
    installAnimationFrameStub();
    const ran = vi.fn();

    requestAnimationFrame(ran);
    vi.advanceTimersByTime(1000);
    expect(ran).toHaveBeenCalledTimes(1);
  });

  it("cancelAnimationFrame 之后 cleanup 不会重复清同一个 handle", () => {
    vi.useFakeTimers();
    const frames = installAnimationFrameStub();
    const ran = vi.fn();

    const handle = requestAnimationFrame(ran);
    cancelAnimationFrame(handle);
    frames.cleanup();
    vi.advanceTimersByTime(1000);
    expect(ran).not.toHaveBeenCalled();
  });
});
