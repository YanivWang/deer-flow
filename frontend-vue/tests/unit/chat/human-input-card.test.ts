/*
  【文件职责】     钉住 HumanInputCard 的两个纯判定，与上游同名用例逐条对齐。
  【架构位置】     unit test
  【主要导出】     无；Vitest cases
  【依赖关系】     app/components/chat/human-input-card.ts
  【边界与注意】   对照来源是
                   frontend/tests/unit/components/workspace/messages/human-input-card.test.ts
                   的 "findMissingRequiredFields flags empty required values only" 与
                   "does not submit text with Enter while IME composition is active"。
                   `amount: "  "` 那一条不是凑数：本仓此前把判空内联成 `value === ""`，
                   只填空格的必填项能直接提交过去。
*/

import { describe, expect, it } from "vitest";

import {
  findMissingRequiredFields,
  shouldSubmitHumanInputTextOnKeyDown,
} from "@/components/chat/human-input-card";
import type { HumanInputField } from "@/core/messages/human-input";

function keyEvent(
  overrides: Partial<{
    key: string;
    shiftKey: boolean;
    isComposing: boolean;
    keyCode: number;
  }> = {},
) {
  return {
    key: "Enter",
    shiftKey: false,
    isComposing: false,
    keyCode: 13,
    ...overrides,
  };
}

describe("human-input-card pure logic", () => {
  const fields: HumanInputField[] = [
    { name: "amount", label: "Amount", type: "number", required: true },
    { name: "note", label: "Note", type: "text", required: false },
    {
      name: "receipts",
      label: "Receipts",
      type: "multi_select",
      required: true,
      options: [{ id: "o1", label: "A-1", value: "A-1" }],
    },
  ];

  it("flags empty required values only", () => {
    expect(findMissingRequiredFields(fields, {}).map((f) => f.name)).toEqual([
      "amount",
      "receipts",
    ]);
    expect(
      findMissingRequiredFields(fields, {
        amount: "300",
        receipts: ["A-1"],
      }),
    ).toEqual([]);
  });

  it("treats a whitespace-only required string as missing", () => {
    expect(
      findMissingRequiredFields(fields, {
        amount: "  ",
        receipts: [],
      }).map((f) => f.name),
    ).toEqual(["amount", "receipts"]);
  });

  it("treats a required unchecked checkbox as missing but a filled one as present", () => {
    const consent: HumanInputField[] = [
      { name: "agree", label: "I agree", type: "checkbox", required: true },
    ];
    expect(
      findMissingRequiredFields(consent, { agree: false }).map((f) => f.name),
    ).toEqual(["agree"]);
    expect(findMissingRequiredFields(consent, { agree: true })).toEqual([]);
  });

  it("reads own properties only, so a field named toString is still required", () => {
    const inherited: HumanInputField[] = [
      { name: "toString", label: "To string", type: "text", required: true },
    ];
    expect(findMissingRequiredFields(inherited, {}).map((f) => f.name)).toEqual(
      ["toString"],
    );
  });

  it("does not submit text with Enter while IME composition is active", () => {
    expect(shouldSubmitHumanInputTextOnKeyDown(keyEvent())).toBe(true);
    expect(
      shouldSubmitHumanInputTextOnKeyDown(keyEvent({ shiftKey: true })),
    ).toBe(false);
    expect(
      shouldSubmitHumanInputTextOnKeyDown(keyEvent({ isComposing: true })),
    ).toBe(false);
    expect(
      shouldSubmitHumanInputTextOnKeyDown(keyEvent({ keyCode: 229 })),
    ).toBe(false);
    expect(shouldSubmitHumanInputTextOnKeyDown(keyEvent(), true)).toBe(false);
    expect(shouldSubmitHumanInputTextOnKeyDown(keyEvent({ key: "a" }))).toBe(
      false,
    );
  });
});
