import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { mergeLoopbackNoProxy } from "../../scripts/with-loopback-no-proxy.mjs";

const makefile = readFileSync(
  new URL("../../Makefile", import.meta.url),
  "utf8",
);
const m4bConfig = readFileSync(
  new URL("../../playwright.m4b.config.ts", import.meta.url),
  "utf8",
);
const inventory = JSON.parse(
  readFileSync(new URL("../m4b-inventory.json", import.meta.url), "utf8"),
) as {
  expectedFileCount: number;
  expectedTestCount: number;
  specFiles: string[];
};
const m6Inventory = JSON.parse(
  readFileSync(new URL("../m6-inventory.json", import.meta.url), "utf8"),
) as typeof inventory;
const browserStream = readFileSync(
  new URL(
    "../../app/components/workspace/browser-view/useBrowserStream.ts",
    import.meta.url,
  ),
  "utf8",
);
const browserApi = readFileSync(
  new URL(
    "../../app/components/workspace/browser-view/browser-api.ts",
    import.meta.url,
  ),
  "utf8",
);
const browserPanel = readFileSync(
  new URL(
    "../../app/components/workspace/browser-view/BrowserPanel.vue",
    import.meta.url,
  ),
  "utf8",
);
const threadSidebar = readFileSync(
  new URL("../../app/components/workspace/ThreadSidebar.vue", import.meta.url),
  "utf8",
);
const threadStore = readFileSync(
  new URL("../../app/stores/threads.ts", import.meta.url),
  "utf8",
);
const toolSettings = readFileSync(
  new URL(
    "../../app/components/workspace/settings/ToolSettings.vue",
    import.meta.url,
  ),
  "utf8",
);

describe("local Playwright command contracts", () => {
  it("real-backend pins the shared specs and Vue webServer to the same 3101 port", () => {
    expect(makefile).toContain("E2E_PORT ?= 3101");
    expect(makefile).toContain(
      "E2E_FRONTEND_PORT=$(E2E_PORT) $(E2E_EXEC) playwright test -c playwright.real-backend.config.ts",
    );
  });

  it("merges both NO_PROXY spellings without deleting the user's entries", () => {
    const merged = mergeLoopbackNoProxy({
      NO_PROXY: "internal.example,localhost",
      no_proxy: "legacy.example,127.0.0.1",
      HTTPS_PROXY: "http://proxy.example",
    });

    expect(merged.NO_PROXY).toBe(
      "internal.example,localhost,legacy.example,127.0.0.1",
    );
    expect(merged.no_proxy).toBe(merged.NO_PROXY);
    expect(merged.HTTPS_PROXY).toBe("http://proxy.example");
  });

  it("routes Playwright test processes through the loopback proxy wrapper", () => {
    const commands = makefile
      .split("\n")
      .filter((line) => line.includes("playwright test"));
    expect(commands.length).toBeGreaterThan(0);
    expect(commands.every((line) => line.includes("$(E2E_EXEC)"))).toBe(true);
  });
});

describe("M6 inventory and browser contract", () => {
  it("is exactly the frozen 8-file / 27-test gate", () => {
    expect(m6Inventory.specFiles).toHaveLength(8);
    expect(new Set(m6Inventory.specFiles)).toHaveLength(8);
    expect(m6Inventory.expectedFileCount).toBe(8);
    expect(m6Inventory.expectedTestCount).toBe(27);
    expect(makefile).toContain("playwright test -c playwright.m6.config.ts");
  });

  it("keeps browser frames binary/legacy compatible and emits one click per physical click", () => {
    expect(browserApi).toContain('frame_format: "binary"');
    expect(browserStream).toContain('payload.type === "frame"');
    expect(browserStream).toContain("LatestBrowserFrameBuffer");
    expect(browserPanel).toContain('@click="clickFrame"');
    expect(browserPanel).toContain('type: "click"');
    expect(browserPanel).not.toContain('type: "down"');
    expect(browserPanel).not.toContain('type: "up"');
  });

  it("keeps thread rename fail-closed and the dialog open after a failed write", () => {
    expect(threadStore).toContain("threads.updateState(threadId");
    expect(threadSidebar).toMatch(
      /await threads\.rename[\s\S]*renameThreadId\.value = null;[\s\S]*catch \(cause\)/,
    );
    expect(threadSidebar).toContain('role="alert"');
  });

  it("updates one MCP server before refreshing authoritative config", () => {
    expect(toolSettings).toContain("await updateMCPServerState(name, enabled)");
    expect(toolSettings).toMatch(
      /await updateMCPServerState\(name, enabled\);[\s\S]*config\.value = await loadMCPConfig\(\)/,
    );
    expect(toolSettings).toContain('role="alert"');
  });
});

describe("M4b inventory contract", () => {
  it("is exactly the frozen 11-file / 66-test gate", () => {
    expect(inventory.specFiles).toHaveLength(11);
    expect(new Set(inventory.specFiles)).toHaveLength(11);
    expect(inventory.expectedFileCount).toBe(11);
    expect(inventory.expectedTestCount).toBe(66);
    expect(m4bConfig).toContain("tests/m4b-inventory.json");
  });
});
