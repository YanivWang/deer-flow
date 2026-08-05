/*
  由 scripts/rstest-to-vitest.mjs 从 frontend/tests/unit/core/i18n/translations.test.ts 机械生成。
  基线 27a425b0 · 改动仅限 @rstest/core → vitest、rs.* → vi.*。
  勿手改：make codemod-check 会红。需要为 Vue 侧适配就登记进 HAND_MAINTAINED。
*/

import { describe, expect, it } from "vitest";

import { loadTranslations } from "@/core/i18n/translations";

describe("AI disclaimer translations", () => {
  it("loads only the requested overseas and domestic copy", async () => {
    const [english, chinese] = await Promise.all([
      loadTranslations("en-US"),
      loadTranslations("zh-CN"),
    ]);
    expect(english.inputBox.disclaimer).toBe(
      "Deerflow is AI and can make mistakes",
    );
    expect(chinese.inputBox.disclaimer).toBe(
      "内容由AI生成，重要信息请务必核查",
    );
  });
});
