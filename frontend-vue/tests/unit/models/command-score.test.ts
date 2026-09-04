/*
  【文件职责】     钉住移植过来的 cmdk 评分与真实现逐值相同，以及模型筛选的排序合同。
  【架构位置】     L3 测试
  【主要导出】     无
  【依赖关系】     @/core/models/command-score · @/core/models/filter
  【边界与注意】   **下面那批期望值不是手算的，是从 `cmdk@1.1.1` 的
                   `dist/command-score.js` 取回来的**（2026-09-04，wave 62：
                   19 名 × 25 查询 × 带/不带 aliases 共 950 组，逐值差 0，
                   这里签入其中有代表性的 22 组）。取值那次比对**没有签入**——
                   它 require `../frontend/node_modules`，而 `make standalone-check`
                   （P0）禁止本模块引用兄弟应用。**所以这份文件是那次比对的唯一留存**，
                   改动 `command-score.ts` 里任何一个常量都会让它变红。

                   两个反直觉但**与上游一致**的值，特意留在清单里当哨兵：
                   - 空查询得 0.99（不是 0），所以筛选层必须自己短路空查询；
                   - `deepseek-v3` 配 `"deep seek"` 得 **0**——查询里的空格要求
                     被筛的串在同一处也有空格，而 `deepseek` 中间没有。
*/

import { describe, expect, it } from "vitest";

import { commandScore } from "@/core/models/command-score";
import { filterModelsByQuery } from "@/core/models/filter";
import type { Model } from "@/core/models/types";

const GOLDEN: [string, string, number][] = [
  ["minimax-m3", "mm3", 0.9],
  ["minimax-m3", "MiniMax M3", 0.9996000599960002],
  ["minimax-m3", "minimax", 0.99],
  ["minimax-m3", "m3", 0.9],
  ["minimax-m3", "xm", 0.15147000000000002],
  ["minimax-m3", "zzz", 0],
  ["gpt-4o", "gpt", 0.99],
  ["gpt-4o", "4o", 0.9],
  ["gpt-4o-mini", "gpt4o", 0.891],
  ["gpt-4o-mini", "mini", 0.9],
  ["claude-opus-5", "opus", 0.891],
  ["claude-opus-5", "co5", 0.81],
  ["claude-opus-5", "Claude Opus 5", 0.9996000599960002],
  ["claude-sonnet-5", "cs5", 0.81],
  ["claude-haiku-4-5", "haiku", 0.891],
  ["deepseek-v3", "dsv3", 0.15254145884700002],
  ["deepseek-v3", "deep seek", 0],
  ["qwen2.5-72b-instruct", "q72", 0.891],
  ["llama-3.3-70b", "llama70", 0.890109],
  ["Scenario Model", "sm", 0.8908218089100001],
  ["Scenario Model", "scenario", 0.989901],
  ["gpt-4o", "", 0.99],
];

function model(name: string, displayName = name): Model {
  return { id: name, name, model: name, display_name: displayName };
}

describe("commandScore 与 cmdk 逐值相同", () => {
  it("22 组定值全部命中", () => {
    for (const [string, query, expected] of GOLDEN) {
      expect(commandScore(string, query), `${string} × ${query}`).toBeCloseTo(
        expected,
        12,
      );
    }
  });

  it("aliases 会拼进被筛的串", () => {
    expect(commandScore("gpt-4o", "omni")).toBe(0);
    expect(commandScore("gpt-4o", "omni", ["omni"])).toBeGreaterThan(0);
  });
});

describe("模型筛选", () => {
  const models = [
    model("minimax-m3", "MiniMax M3"),
    model("gpt-4o", "GPT-4o"),
    model("claude-opus-5", "Claude Opus 5"),
    model("claude-sonnet-5", "Claude Sonnet 5"),
  ];

  it("空查询原样返回，不重排", () => {
    expect(filterModelsByQuery(models, "")).toEqual(models);
    expect(filterModelsByQuery(models, "   ")).toEqual(models);
  });

  it("非连续子序列现在能搜到（wave 62 之前搜不到）", () => {
    expect(filterModelsByQuery(models, "mm3").map((m) => m.name)).toEqual([
      "minimax-m3",
    ]);
    // `co5` 也会**低分**命中 claude-sonnet-5（0.81 vs 0.152，实测自 cmdk）——
    // 这正是「模糊匹配 + 评分排序必须一起来」的那半：只筛不排的话，
    // 想要的那条不一定在最前面。
    expect(filterModelsByQuery(models, "co5").map((m) => m.name)).toEqual([
      "claude-opus-5",
      "claude-sonnet-5",
    ]);
  });

  it("照屏幕上的字打也搜得到（wave 37 那条分隔符判据已被覆盖）", () => {
    expect(
      filterModelsByQuery(models, "MiniMax M3").map((m) => m.name),
    ).toEqual(["minimax-m3"]);
  });

  /*
    **wave 62 第一版这条是假绿**：原来只断言 `claude` 与 `co5` 的输出，
    而那两个查询的分数序恰好等于输入序，于是把 `.sort()` 整段删掉照样全绿。
    要测排序，输入序必须与分数序**不同**。
  */
  it("分数高的排前面，即使它在输入里靠后", () => {
    const sonnetFirst = [
      model("claude-sonnet-5", "Claude Sonnet 5"),
      model("claude-opus-5", "Claude Opus 5"),
    ];
    // co5：opus 0.81，sonnet 0.152（实测自 cmdk）。输入序是 sonnet 在前。
    expect(commandScore("claude-opus-5", "co5")).toBeGreaterThan(
      commandScore("claude-sonnet-5", "co5"),
    );
    expect(filterModelsByQuery(sonnetFirst, "co5").map((m) => m.name)).toEqual([
      "claude-opus-5",
      "claude-sonnet-5",
    ]);
  });

  it("按分数从高到低排，同分保持原序", () => {
    // 两条 claude 同分（前缀完全一样），此时必须保持后端给的原序。
    expect(commandScore("claude-opus-5", "claude")).toBe(
      commandScore("claude-sonnet-5", "claude"),
    );
    expect(filterModelsByQuery(models, "claude").map((m) => m.name)).toEqual([
      "claude-opus-5",
      "claude-sonnet-5",
    ]);
    // 把两条 claude 的原序调过来，输出也跟着调——证明上面那条不是碰巧。
    const swapped = [models[1]!, models[3]!, models[2]!, models[0]!];
    expect(filterModelsByQuery(swapped, "claude").map((m) => m.name)).toEqual([
      "claude-sonnet-5",
      "claude-opus-5",
    ]);
  });

  it("零分的条目被筛掉", () => {
    expect(filterModelsByQuery(models, "zzzz")).toEqual([]);
  });
});
