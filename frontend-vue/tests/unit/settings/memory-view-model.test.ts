/*
  【文件职责】     固定 WP-10 fact 表单、PATCH omitted/显式值与搜索筛选合同。
  【架构位置】     WP-10 pure view-model test
  【主要导出】     无；Vitest cases
  【依赖关系】     core/memory/view-model
  【边界与注意】   显式 0 不得被 truthy fallback 吞掉；空 memory 与无匹配结果必须区分。
*/

import { describe, expect, it } from "vitest";

import {
  buildMemoryFactCreateInput,
  buildMemoryFactPatchInput,
  filterMemory,
  validateMemoryFactForm,
} from "@/core/memory/view-model";
import type { MemoryFact, UserMemory } from "@/core/memory/types";

const fact: MemoryFact = {
  id: "fact-a",
  content: "User prefers Vue",
  category: "preference",
  confidence: 0.8,
  createdAt: "2026-08-22",
  source: "manual",
  revision: 4,
  model: "fixture-model",
};

const memory: UserMemory = {
  version: "2.0",
  revision: 9,
  lastUpdated: "2026-08-22",
  user: {
    workContext: { summary: "DeerFlow frontend", updatedAt: "2026-08-22" },
    personalContext: { summary: "", updatedAt: "" },
    topOfMind: { summary: "Memory settings", updatedAt: "2026-08-22" },
  },
  history: {
    recentMonths: { summary: "Vue parity", updatedAt: "2026-08-22" },
    earlierContext: { summary: "", updatedAt: "" },
    longTermBackground: { summary: "", updatedAt: "" },
  },
  facts: [fact],
};

describe("memory fact form", () => {
  it.each(["0", "1", "0.01", "0.99"])("accepts confidence %s", (confidence) => {
    expect(
      validateMemoryFactForm({
        content: "fact",
        category: "contract",
        confidence,
      }).ok,
    ).toBe(true);
  });

  it.each(["", "NaN", "Infinity", "-0.01", "1.01"])(
    "rejects confidence %s",
    (confidence) => {
      expect(
        validateMemoryFactForm({
          content: "fact",
          category: "contract",
          confidence,
        }),
      ).toMatchObject({ ok: false, field: "confidence" });
    },
  );

  it("rejects whitespace-only content", () => {
    expect(
      validateMemoryFactForm({
        content: "   ",
        category: "contract",
        confidence: "0.8",
      }),
    ).toMatchObject({ ok: false, field: "content" });
  });

  it("builds exact create body and preserves explicit zero", () => {
    expect(
      buildMemoryFactCreateInput({
        content: "  explicit zero  ",
        category: "  contract  ",
        confidence: "0",
      }),
    ).toEqual({
      content: "explicit zero",
      category: "contract",
      confidence: 0,
    });
  });

  it("omits unchanged PATCH fields while preserving explicit confidence zero", () => {
    expect(
      buildMemoryFactPatchInput(fact, {
        content: fact.content,
        category: fact.category,
        confidence: "0",
      }),
    ).toEqual({ confidence: 0 });
    expect(
      buildMemoryFactPatchInput(fact, {
        content: fact.content,
        category: fact.category,
        confidence: String(fact.confidence),
      }),
    ).toEqual({});
  });
});

describe("filterMemory", () => {
  it("searches fact content/category and summary title/content", () => {
    expect(filterMemory(memory, "preference", "facts").facts).toEqual([fact]);
    expect(
      filterMemory(memory, "deerflow", "summaries").summaries,
    ).toHaveLength(1);
    expect(
      filterMemory(memory, "top of mind", "summaries").summaries,
    ).toHaveLength(1);
  });

  it("implements all/facts/summaries without rebuilding response objects", () => {
    expect(filterMemory(memory, "", "all")).toMatchObject({
      facts: [fact],
      summaries: expect.any(Array),
      empty: false,
      noMatches: false,
    });
    expect(filterMemory(memory, "", "facts").summaries).toEqual([]);
    expect(filterMemory(memory, "", "summaries").facts).toEqual([]);
    expect(filterMemory(memory, "missing", "all")).toMatchObject({
      empty: false,
      noMatches: true,
    });
  });

  it("distinguishes a truly empty memory from no matching results", () => {
    const empty: UserMemory = {
      ...memory,
      user: {
        workContext: { summary: "", updatedAt: "" },
        personalContext: { summary: "", updatedAt: "" },
        topOfMind: { summary: "", updatedAt: "" },
      },
      history: {
        recentMonths: { summary: "", updatedAt: "" },
        earlierContext: { summary: "", updatedAt: "" },
        longTermBackground: { summary: "", updatedAt: "" },
      },
      facts: [],
    };
    expect(filterMemory(empty, "", "all")).toMatchObject({
      empty: true,
      noMatches: false,
    });
  });
});
