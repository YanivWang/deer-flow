/*
  【文件职责】     钉住 rstest→vitest codemod 依赖的 vitest 行为假设。
  【对应 frontend/】 无（迁移工具链守护）
  【架构位置】     工程底座
  【主要导出】     无（测试）
  【依赖关系】     被 make test/verify 消费；scripts/rstest-to-vitest.mjs 的语义前提
  【边界与注意】   codemod 把 83 个测试里的 rs.* 机械换成 vi.*。「同名」不等于「同义」，
                   这里逐条把等价性变成可执行断言：vitest 升级后若某条不再成立，
                   红的是这个文件，而不是 43 个业务测试里一句沉默走形的断言。
                   新增 rs.* 映射时，先在这里加一条断言再改 codemod。
*/

import { afterEach, describe, expect, test, vi } from "vitest";

describe("vi.mock 工厂提升到静态 import 之上", () => {
  // 上游写法是 rs.mock(...) 写在 import 之前（见 agents/api.test.ts）。
  // vitest 同样提升 vi.mock，所以 codemod 不需要搬动语句顺序。
  test("被 mock 的模块在静态 import 处已经是替身", async () => {
    const mod = await import("./fixtures/parity-target");
    expect(mod.greet()).toBe("mocked");
  });
});

describe("vi.mocked 是运行时恒等", () => {
  test("返回的就是同一个对象，不是副本", () => {
    const spy = vi.fn();
    // 上游 `const mockedFetch = rs.mocked(fetcher)` 之后对 mockedFetch 调
    // mockReset()，靠的正是恒等；若返回副本，reset 打不到真身而测试仍会「通过」。
    expect(vi.mocked(spy)).toBe(spy);
  });

  test("对 mock 副本的操作作用于原始 mock", () => {
    const spy = vi.fn(() => "original");
    vi.mocked(spy).mockReturnValue("changed");
    expect(spy()).toBe("changed");
    vi.mocked(spy).mockReset();
    // mockReset 退回 fn(impl) 传入的那个实现，**不是** undefined。
    // 两边行为一致（rstest 0.10.6 实测同样返回 "original"），但反直觉：
    // 上游 beforeEach 里的 mockReset() 都作用在无实现的 fn() 上，所以看不出区别；
    // 哪天有人给工厂里的 fn 加了默认实现，差别才会显形。这里先钉住。
    expect(spy()).toBe("original");
  });
});

describe("vi.spyOn + restoreAllMocks", () => {
  test("restoreAllMocks 装回原实现", () => {
    const obj = { value: () => "real" };
    vi.spyOn(obj, "value").mockReturnValue("spied");
    expect(obj.value()).toBe("spied");
    vi.restoreAllMocks();
    expect(obj.value()).toBe("real");
  });
});

describe("vi.stubGlobal + unstubAllGlobals", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("stub 生效且 unstubAllGlobals 复原", () => {
    const before = globalThis.fetch;
    vi.stubGlobal("fetch", "stubbed");
    expect(globalThis.fetch as unknown).toBe("stubbed");
    vi.unstubAllGlobals();
    expect(globalThis.fetch).toBe(before);
  });

  test("stub 一个原本不存在的全局，复原后重新消失", () => {
    const key = "__parityProbe__";
    expect(key in globalThis).toBe(false);
    vi.stubGlobal(key, 1);
    expect(key in globalThis).toBe(true);
    vi.unstubAllGlobals();
    expect(key in globalThis).toBe(false);
  });
});

describe("假时钟", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("advanceTimersByTimeAsync 会冲掉 await 之后的续体", async () => {
    vi.useFakeTimers();
    const seen: string[] = [];
    void (async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      seen.push("timer-then-microtask");
    })();
    expect(seen).toEqual([]);
    await vi.advanceTimersByTimeAsync(100);
    // 同步版 advanceTimersByTime 到不了这一步——两者不可互换，codemod 保持原名。
    expect(seen).toEqual(["timer-then-microtask"]);
  });
});

describe("doMock / doUnmock（本窗口未用到，为下一窗口留证）", () => {
  afterEach(() => {
    vi.doUnmock("./fixtures/parity-dynamic");
    vi.resetModules();
  });

  test("doMock 只影响其后的动态 import，且接受字符串路径", async () => {
    const before = await import("./fixtures/parity-dynamic");
    expect(before.name()).toBe("real");

    vi.doMock("./fixtures/parity-dynamic", () => ({ name: () => "faked" }));
    vi.resetModules();
    const after = await import("./fixtures/parity-dynamic");
    expect(after.name()).toBe("faked");
  });

  test("doUnmock + resetModules 退回真实模块", async () => {
    vi.doMock("./fixtures/parity-dynamic", () => ({ name: () => "faked" }));
    vi.resetModules();
    expect((await import("./fixtures/parity-dynamic")).name()).toBe("faked");

    vi.doUnmock("./fixtures/parity-dynamic");
    vi.resetModules();
    expect((await import("./fixtures/parity-dynamic")).name()).toBe("real");
  });
});

vi.mock("./fixtures/parity-target", () => ({ greet: () => "mocked" }));
