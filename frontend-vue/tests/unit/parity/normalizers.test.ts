/*
  【文件职责】     守住对照取样的两个归一化函数：抹掉的确实是噪声，保留的确实是信号。
  【架构位置】     单元测试
  【主要导出】     无
  【依赖关系】     scripts/lib/aria-parity.mjs · tests/e2e-parity/support/capture.ts
  【边界与注意】   归一化是整条对照链路上**唯一会丢信息**的一步。它写错的后果不是报错，
                   是一处真差异安静消失，而所有门禁继续全绿——这正是这个仓库反复
                   踩到的那类失效。所以每条规则都要有一个「它不该抹掉什么」的反例，
                   而不只是「它抹掉了什么」的正例。

                   这些函数是纯的，因此这组用例不需要任何应用在跑，进 make verify。
*/

import { describe, expect, it } from "vitest";

import {
  diffAriaLines,
  diffAriaOrder,
  normalizeAriaSnapshot,
} from "../../../scripts/lib/aria-parity.mjs";
import { normalizeRequest } from "../../e2e-parity/support/capture";

const KNOWN = new Set(["00000000-0000-0000-0000-000000000001"]);

describe("请求归一化", () => {
  it("丢掉框架自己的资源与载荷请求", () => {
    // 两个框架各有自己的加载协议，留着它们等于让报告每行都在说 Next 不是 Nuxt。
    expect(
      normalizeRequest("GET", "http://x/_next/static/chunk.js"),
    ).toBeNull();
    expect(normalizeRequest("GET", "http://x/_nuxt/entry.js")).toBeNull();
    expect(normalizeRequest("GET", "http://x/workspace/chats/new")).toBeNull();
  });

  it("保留产品 API 请求，并归一成 方法 + 路径 + 排序后的查询", () => {
    expect(
      normalizeRequest("get", "http://x/api/threads/search?b=2&a=1", KNOWN),
    ).toBe("GET /api/threads/search?a=1&b=2");
  });

  /*
    **不再丢弃任何查询参数**（wave 121 改的，原来这里钉的是「丢掉 `_` / `t` / `ts`
    / `cacheBust`」）。给 `normalizeRequest` 装探针跑一整轮 e2e-parity：
    **116 次查询参数观测，`DROPPED` 0 次**——那四条一条都没响过；同一轮的控制组
    打印出实际出现的参数（`include_files` 48 / `include_diff` 48 / `limit` 8 /
    `task_id`、`offset`、`event_types` 各 4），所以那个 0 是**算出来的**（线索 195）。

    **取舍**（两种失效各是什么样，选那个会叫的）：
    - 留着：产品哪天用了一个叫 `t` / `ts` 的参数，它会被**静默丢掉**，
      两个应用在那个参数上的差异**看不见**——与 wave 120 那三个夹具 id 同一类。
    - 删掉：真出现破缓存参数时，它每次的值都不同，台账会**变得不稳定**——
      吵，但**自己会喊**，而且那正是硬规则 2 要的「因为实测才加」的证据。

    **一个会喊的失效优于一个不出声的**，所以删。要加回来就拿着那条不稳定的读数加。
  */
  it("不丢弃任何查询参数——包括看起来像破缓存的那种", () => {
    expect(
      normalizeRequest("GET", "http://x/api/models?_=1699999", KNOWN),
    ).toBe("GET /api/models?_=1699999");
  });

  it("把客户端生成的 id 抹成占位符", () => {
    // /workspace/chats/new 上两个应用各自生成一个新线程 id，必然不同，
    // 这是页面的定义而不是产品差异。
    const a = normalizeRequest(
      "GET",
      "http://x/api/threads/45400545-eacd-44da-a15f-7f5348bb37f8/uploads/limits",
      KNOWN,
    );
    const b = normalizeRequest(
      "GET",
      "http://x/api/threads/7475b747-4fe3-4c00-a7a6-759cba2e7cca/uploads/limits",
      KNOWN,
    );
    expect(a).toBe("GET /api/threads/«generated»/uploads/limits");
    expect(b).toBe(a);
  });

  it("**不**抹掉场景认识的 id", () => {
    // 反例：一律抹掉 UUID 的话，「React 打开线程 1、Vue 打开线程 2」会一起消失，
    // 而那是货真价实的差异。
    const known = normalizeRequest(
      "GET",
      "http://x/api/threads/00000000-0000-0000-0000-000000000001/state",
      KNOWN,
    );
    const other = normalizeRequest(
      "GET",
      "http://x/api/threads/00000000-0000-0000-0000-000000000002/state",
      KNOWN,
    );
    expect(known).toBe(
      "GET /api/threads/00000000-0000-0000-0000-000000000001/state",
    );
    expect(other).not.toBe(known);
  });
});

describe("可访问性树归一化", () => {
  it("抹掉组件库生成的 id 与纯装饰节点", () => {
    const snapshot = [
      '- button "Open" [describedby=radix-abc123]',
      "- generic",
      '- tab "Files-v-0-2"',
    ].join("\n");
    expect(normalizeAriaSnapshot(snapshot)).toBe(
      ['- button "Open" [describedby=«id»]', '- tab "Files"'].join("\n"),
    );
  });

  it("**不**抹掉 role、可访问名与状态", () => {
    // 反例：这三样正是判据本身，抹掉任意一样都会让整层比对失去意义。
    const snapshot = '- button "Submit" [disabled]';
    expect(normalizeAriaSnapshot(snapshot)).toBe(snapshot);
  });
});

describe("可访问性树差异", () => {
  it("双向报告，且不看缩进", () => {
    const react = ["- main:", '  - button "Submit"'].join("\n");
    const vue = ["- main:", '  - button "Send"'].join("\n");
    expect(diffAriaLines(react, vue)).toEqual({
      onlyReact: ['- button "Submit"'],
      onlyVue: ['- button "Send"'],
    });
  });

  it("按多重集比对：少了一项列表要能看见", () => {
    // 反例：按集合比对的话，三条同名列表项少掉一条完全看不出来。
    const react = ["- listitem", "- listitem", "- listitem"].join("\n");
    const vue = ["- listitem", "- listitem"].join("\n");
    expect(diffAriaLines(react, vue)).toEqual({
      onlyReact: ["- listitem"],
      onlyVue: [],
    });
  });
});

describe("可访问性树的顺序差异", () => {
  const tree = (...lines: string[]) => lines.map((l) => `  - ${l}`).join("\n");

  it("节点相同、顺序也相同时不报", () => {
    const a = tree('button "A"', 'button "B"', 'button "C"');
    expect(diffAriaOrder(a, a)).toEqual([]);
  });

  it("多包一层容器（缩进变了）不算顺序差异", () => {
    const react = ['- button "A"', '- button "B"'].join("\n");
    const vue = ["- main:", '  - button "A"', '  - button "B"'].join("\n");
    // `main:` 只在一边有，属于 diffAriaLines 那一档；公共节点的相对顺序没变。
    expect(diffAriaOrder(react, vue)).toEqual([]);
  });

  it("同一组节点被摆成另一个次序时，只报第一处分岔", () => {
    const react = tree('button "A"', 'button "B"', 'button "C"');
    const vue = tree('button "B"', 'button "A"', 'button "C"');
    expect(diffAriaOrder(react, vue)).toEqual([
      '第 1 个公共节点 React=- button "A" Vue=- button "B"',
    ]);
  });

  it("一边多出来的节点不参与顺序比对", () => {
    const react = tree('button "A"', 'button "C"');
    const vue = tree('button "A"', 'button "B"', 'button "C"');
    expect(diffAriaOrder(react, vue)).toEqual([]);
  });

  it("重复出现的节点按出现次数的较小值参与", () => {
    // React 有两颗 A、Vue 只有一颗：公共多重集里 A 只算一次。
    const react = tree('button "A"', 'button "A"', 'button "B"');
    const vue = tree('button "A"', 'button "B"');
    expect(diffAriaOrder(react, vue)).toEqual([]);
  });
});
