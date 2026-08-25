/*
  【文件职责】     固定memory import 的运行时 schema、extra 与 duplicate 合同。
  【架构位置】     pure contract test
  【主要导出】     无；Vitest cases
  【依赖关系】     core/memory/schema
  【边界与注意】   Gateway 对 partial/extra 较宽松；设置页按 React 完整导出结构预检，并显式提示会被 Gateway 忽略的 extra。
*/

import { describe, expect, it } from "vitest";

import {
  parseMemoryImportText,
  validateImportedMemory,
} from "@/core/memory/schema";

function memoryFixture() {
  return {
    version: "2.0",
    revision: 7,
    lastUpdated: "2026-08-22T00:00:00Z",
    user: {
      workContext: { summary: "Vue migration", updatedAt: "2026-08-22" },
      personalContext: { summary: "", updatedAt: "" },
      topOfMind: { summary: "Recent work", updatedAt: "2026-08-22" },
    },
    history: {
      recentMonths: { summary: "Parity work", updatedAt: "2026-08-22" },
      earlierContext: { summary: "", updatedAt: "" },
      longTermBackground: { summary: "", updatedAt: "" },
    },
    facts: [
      {
        id: "fact-a",
        content: "Explicit zero confidence is valid.",
        category: "contract",
        confidence: 0,
        createdAt: "2026-08-22T00:00:00Z",
        source: "manual",
        revision: 3,
        model: "fixture-model",
      },
    ],
  };
}

describe("parseMemoryImportText", () => {
  it("separates malformed JSON from schema failures", () => {
    expect(parseMemoryImportText("{oops")).toMatchObject({
      ok: false,
      issues: [{ code: "malformed-json", path: "$" }],
    });
  });
});

describe("validateImportedMemory", () => {
  it.each([null, [], "memory", 42, true])(
    "rejects a non-object root: %j",
    (value) => {
      expect(validateImportedMemory(value)).toMatchObject({
        ok: false,
        issues: [{ code: "root-type", path: "$" }],
      });
    },
  );

  it.each(["version", "lastUpdated", "user", "history", "facts"] as const)(
    "rejects a missing required root field: %s",
    (field) => {
      const value = Object.fromEntries(
        Object.entries(memoryFixture()).filter(([key]) => key !== field),
      );
      const result = validateImportedMemory(value);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toContainEqual(
          expect.objectContaining({
            code: "missing-field",
            path: `$.${field}`,
          }),
        );
      }
    },
  );

  it("rejects wrong nested summary and updatedAt types", () => {
    const value = memoryFixture();
    value.user.workContext = {
      summary: 3 as unknown as string,
      updatedAt: false as unknown as string,
    };
    const result = validateImportedMemory(value);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.path)).toEqual(
        expect.arrayContaining([
          "$.user.workContext.summary",
          "$.user.workContext.updatedAt",
        ]),
      );
    }
  });

  it.each([
    ["id", 1],
    ["content", null],
    ["category", []],
    ["createdAt", 1],
    ["source", {}],
  ])("rejects an invalid fact %s", (field, invalid) => {
    const value = memoryFixture();
    Object.assign(value.facts[0]!, { [field]: invalid });
    const result = validateImportedMemory(value);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ path: `$.facts[0].${field}` }),
      );
    }
  });

  it.each([
    ["id", ""],
    ["id", "fact/escape"],
    ["content", "   "],
    ["status", "deleted"],
    ["revision", 0],
  ])(
    "rejects a storage-invalid fact %s=%j before Gateway",
    (field, invalid) => {
      const value = memoryFixture();
      Object.assign(value.facts[0]!, { [field]: invalid });
      const result = validateImportedMemory(value);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toContainEqual(
          expect.objectContaining({
            code: "invalid-fact",
            path: `$.facts[0].${field}`,
          }),
        );
      }
    },
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -0.01, 1.01])(
    "rejects invalid confidence %s",
    (confidence) => {
      const value = memoryFixture();
      value.facts[0]!.confidence = confidence;
      const result = validateImportedMemory(value);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toContainEqual(
          expect.objectContaining({
            code: "invalid-confidence",
            path: "$.facts[0].confidence",
          }),
        );
      }
    },
  );

  it("accepts 0 and 1 confidence boundaries", () => {
    const zero = memoryFixture();
    const one = memoryFixture();
    one.facts[0]!.confidence = 1;
    expect(validateImportedMemory(zero).ok).toBe(true);
    expect(validateImportedMemory(one).ok).toBe(true);
  });

  it("accepts extra fields without silently dropping them and returns warnings", () => {
    const value = memoryFixture();
    Object.assign(value, { futureRoot: { enabled: true } });
    Object.assign(value.user.workContext, { futureSection: "kept" });
    const result = validateImportedMemory(value);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.memory).toMatchObject({
        futureRoot: { enabled: true },
        user: { workContext: { futureSection: "kept" } },
      });
      expect(result.warnings.map((warning) => warning.path)).toEqual(
        expect.arrayContaining([
          "$.futureRoot",
          "$.user.workContext.futureSection",
          "$.facts[0].model",
        ]),
      );
    }
  });

  it("rejects duplicate fact ids before Gateway storage returns a 500", () => {
    const value = memoryFixture();
    value.facts.push({ ...value.facts[0]! });
    const result = validateImportedMemory(value);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ code: "duplicate-fact-id" }),
      );
    }
  });

  it("accepts duplicate normalized content with different ids but makes it visible", () => {
    const value = memoryFixture();
    value.facts.push({
      ...value.facts[0]!,
      id: "fact-b",
      content: "  EXPLICIT ZERO CONFIDENCE IS VALID.  ",
    });
    const result = validateImportedMemory(value);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ code: "duplicate-fact-content" }),
      );
    }
  });
});
