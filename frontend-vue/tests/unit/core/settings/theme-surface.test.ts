import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const stylesRoot = resolve(process.cwd(), "app/shared/styles");
const sharedStyles = ["main.scss", "scheduled.scss", "settings.scss", "theme.scss"]
  .map((file) => readFileSync(resolve(stylesRoot, file), "utf8"))
  .join("\n");

describe("dark theme shared surface contract", () => {
  it("keeps the shared dark surface override for core desktop pages", () => {
    for (const selector of [
      ".settings-content",
      ".workspace-chat__token-indicator summary",
      ".workspace-chat--welcome .workspace-chat__suggestions button",
      ".scheduled-create",
      ".scheduled-create__builder",
      ".scheduled-create__type-button",
    ]) {
      expect(sharedStyles).toContain(selector);
    }

    expect(sharedStyles).toContain("background: var(--df-color-bg-container)");
    expect(sharedStyles).toContain("background: var(--df-chat-surface)");
    expect(sharedStyles).toContain("background: var(--df-input-bg)");
  });
});
