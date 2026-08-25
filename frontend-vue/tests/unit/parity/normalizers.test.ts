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

  it("丢掉只为破缓存而存在的查询参数", () => {
    expect(
      normalizeRequest("GET", "http://x/api/models?_=1699999", KNOWN),
    ).toBe("GET /api/models");
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
