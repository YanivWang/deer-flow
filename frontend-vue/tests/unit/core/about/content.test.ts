import { describe, expect, it } from "vitest";

import {
  ABOUT_FEATURES,
  ABOUT_LINKS,
  ABOUT_MARKDOWN_SECTIONS,
  resolveAboutVersion,
} from "../../../../app/core/about/content";

describe("about content", () => {
  it("keeps project links, core features, and version fallback explicit", () => {
    expect(ABOUT_FEATURES).toContain("长期记忆");
    expect(ABOUT_LINKS.map((link) => link.href)).toEqual([
      "https://github.com/bytedance/deer-flow",
      "https://deerflow.tech/",
      "mailto:support@deerflow.tech",
    ]);
    expect(resolveAboutVersion("  v1.2.3  ")).toBe("v1.2.3");
    expect(resolveAboutVersion("")).toBe("开发版");
    expect(ABOUT_MARKDOWN_SECTIONS.map((section) => section.heading)).toContain(
      "验证边界",
    );
    expect(JSON.stringify(ABOUT_MARKDOWN_SECTIONS)).toContain("frontend-vue");
    expect(JSON.stringify(ABOUT_MARKDOWN_SECTIONS)).toContain("Gateway");
  });
});
