/*
  【文件职责】     用 setTimeout 冒充 requestAnimationFrame，并保证**没有一个定时器
                   活过这条用例**。
  【架构位置】     单元测试支持模块
  【主要导出】     installAnimationFrameStub
  【依赖关系】     vitest
  【边界与注意】   **抽出来是因为它踩过一次，而且五份用例里写的是同一段。**
                   happy-dom 没有 `requestAnimationFrame`，于是这五份 DOM 用例各自
                   `vi.stubGlobal("requestAnimationFrame", cb => setTimeout(cb, 16))`。
                   问题出在**收尾**：`vi.unstubAllGlobals()` 只是把全局换回去，
                   **已经排进队列的那个 setTimeout 还在**。它 16ms 后照常触发，
                   而被它唤醒的代码（`MessageList.vue` 的 `animate`）会再调一次
                   `requestAnimationFrame`——那时候全局已经没有这个函数了，
                   于是整个 vitest 进程收到一条 `ReferenceError: requestAnimationFrame
                   is not defined` 的 **Uncaught Exception**：用例全绿、退出码却是 1。

                   实测就是这么红的（wave 96 收工跑 verify 时）：同一棵树跑三次，
                   一次报 14 条这样的错、两次全绿；干净树也是绿的。
                   **「偶尔红」按真缺陷查，查到的就是这条。**

                   **只有三份用例适用**，这一点是量出来才收窄的：全仓五份 stub 里
                   `use-browser-stream.dom.test.ts` 是**同步**版（`callback(16)` 当场调，
                   没有定时器、也就没有这个问题），`browser-panel.dom.test.ts` 是
                   **收集回调、由用例自己 drain** 的版本（而且它已经有一个同名的
                   `animationFrames` 数组）。**一开始五份一起改，后两份当场红**——
                   同样的形状不等于同样的机制（坑 236）。

                   适用的那三份 mount/unmount 都不配对（1/0、6/3、1/0），
                   所以**不能靠「记得 unmount」来收口**——组件不卸载就会一直重排。
                   这里改成由 stub 自己记账：每个 handle 记下来，`cleanup()` 时
                   一律清掉，**与用例有没有 unmount 无关**。
*/

import { vi } from "vitest";

export function installAnimationFrameStub() {
  const pending = new Set<number>();

  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const handle = globalThis.setTimeout(() => {
      pending.delete(handle);
      callback(performance.now());
    }, 16) as unknown as number;
    pending.add(handle);
    return handle;
  });
  vi.stubGlobal("cancelAnimationFrame", (handle: number) => {
    pending.delete(handle);
    globalThis.clearTimeout(handle);
  });

  return {
    /** 清掉所有还没触发的定时器。**必须在 `vi.unstubAllGlobals()` 之前调用**。 */
    cleanup() {
      for (const handle of pending) globalThis.clearTimeout(handle);
      pending.clear();
    },
  };
}
