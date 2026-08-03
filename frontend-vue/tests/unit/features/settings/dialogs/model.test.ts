import { describe, expect, it } from "vitest";

import {
  readInitialDialog,
  SETTINGS_DIALOG_SECTIONS,
} from "../../../../../app/features/settings/dialogs/model";
import {
  readInitialSection,
  SETTINGS_SECTION_IDS,
} from "../../../../../app/entities/settings/model";

describe("settings navigation model", () => {
  it("keeps the section order stable for the navigation widget", () => {
    expect(SETTINGS_SECTION_IDS).toEqual([
      "account",
      "appearance",
      "memory",
      "tools",
      "skills",
      "notification",
      "channels",
      "integrations",
      "about",
    ]);
  });

  it("maps dialog deep links to their owning settings sections", () => {
    expect(readInitialDialog(["lark-auth"])).toBe("lark-auth");
    expect(readInitialDialog("unknown")).toBeNull();
    expect(SETTINGS_DIALOG_SECTIONS["mcp-config"]).toBe("tools");
    expect(readInitialSection("appearance", "#about", "tools")).toBe("tools");
  });

  it("prefers query section, then hash section, and falls back to appearance", () => {
    expect(readInitialSection(["memory"], "#about", null)).toBe("memory");
    expect(readInitialSection(undefined, "#about", null)).toBe("about");
    expect(readInitialSection("unknown", "#unknown", null)).toBe("appearance");
  });
});
