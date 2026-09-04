import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it } from "@rstest/core";
import { cleanup, render, screen } from "@testing-library/react";

import { CopyButton } from "@/components/workspace/copy-button";
import { enUS } from "@/core/i18n";
import { I18nProvider } from "@/core/i18n/context";

/*
  Icon-only controls must carry an accessible name.

  A tooltip is not one: Radix wires `Tooltip` as `aria-describedby` on the
  trigger, so a screen reader announced these controls as a bare "button".
  Found by sweeping the whole chat screen for nameless interactive controls
  after a completed run — the copy buttons on both turn kinds and the sidebar
  footer's settings trigger were the only three hits.
*/
afterEach(cleanup);

describe("icon-only controls carry an accessible name", () => {
  it("names the copy button from the clipboard copy", () => {
    render(
      <I18nProvider initialLocale="en-US">
        <CopyButton clipboardData="hello" />
      </I18nProvider>,
    );

    expect(
      screen.getByRole("button", { name: enUS.clipboard.copyToClipboard }),
    ).toBeTruthy();
  });

  it("lets a caller override the name", () => {
    render(
      <I18nProvider initialLocale="en-US">
        <CopyButton clipboardData="hello" aria-label="Copy the diff" />
      </I18nProvider>,
    );

    expect(screen.getByRole("button", { name: "Copy the diff" })).toBeTruthy();
  });
});

/*
  Source-level, not a render: WorkspaceNavMenu needs SidebarProvider, the
  settings-dialog context and a mounted dropdown before it draws anything, and
  the collapsed branch only appears once the sidebar store says so. The thing
  worth pinning is one attribute on one element, so read it from the source the
  way `layout-boundaries.test.ts` already does for layout ownership.
*/
describe("sidebar footer trigger", () => {
  it("names the settings trigger so the collapsed icon is not a bare button", () => {
    const source = readFileSync(
      path.resolve(
        __dirname,
        "../../../../src/components/workspace/workspace-nav-menu.tsx",
      ),
      "utf8",
    );

    // The collapsed branch renders the icon alone — that is why the name has
    // to live on the button rather than in its children.
    expect(source).toContain("aria-label={t.workspace.settingsAndMore}");
    const collapsed = source.slice(source.indexOf("isSidebarOpen ? ("));
    expect(collapsed).toContain("flex size-full items-center justify-center");
  });
});
