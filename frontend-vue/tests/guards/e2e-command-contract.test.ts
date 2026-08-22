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
const m5Inventory = JSON.parse(
  readFileSync(new URL("../m5-inventory.json", import.meta.url), "utf8"),
) as typeof inventory;
const m7Inventory = JSON.parse(
  readFileSync(new URL("../m7-inventory.json", import.meta.url), "utf8"),
) as typeof inventory;
const workspacePanels = readFileSync(
  new URL(
    "../../app/components/workspace/WorkspacePanels.vue",
    import.meta.url,
  ),
  "utf8",
);
const agentChat = readFileSync(
  new URL("../../app/components/chat/AgentChat.vue", import.meta.url),
  "utf8",
);
const messageList = readFileSync(
  new URL("../../app/components/chat/MessageList.vue", import.meta.url),
  "utf8",
);
const vueWorkflow = readFileSync(
  new URL(
    "../../../.github/workflows/frontend-vue-verify.yml",
    import.meta.url,
  ),
  "utf8",
);
const m7Config = readFileSync(
  new URL("../../playwright.m7.config.ts", import.meta.url),
  "utf8",
);
const wp07RealConfig = readFileSync(
  new URL("../../playwright.wp07-real-backend.config.ts", import.meta.url),
  "utf8",
);
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
const threadQueries = readFileSync(
  new URL("../../app/composables/useThreads.ts", import.meta.url),
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
  it("is exactly the WP-05 9-file / 33-test gate", () => {
    expect(m6Inventory.specFiles).toHaveLength(9);
    expect(new Set(m6Inventory.specFiles)).toHaveLength(9);
    expect(m6Inventory.expectedFileCount).toBe(9);
    expect(m6Inventory.expectedTestCount).toBe(33);
    expect(m6Inventory.specFiles).toContain(
      "frontend-vue/tests/m7/integrations.spec.ts",
    );
    expect(m6Inventory.specFiles).not.toContain(
      "frontend/tests/e2e/integrations.spec.ts",
    );
    expect(m6Inventory.specFiles).toContain(
      "frontend-vue/tests/m6/browser-control.spec.ts",
    );
    expect(makefile).toContain("playwright test -c playwright.m6.config.ts");
  });

  it("keeps browser frames binary/legacy compatible and emits one click per physical click", () => {
    expect(browserApi).toContain('frame_format: "binary"');
    expect(browserStream).toContain("BrowserConnectionController");
    expect(browserStream).toContain("LatestBrowserFrameBuffer");
    expect(browserPanel).toContain('@click="clickFrame"');
    expect(browserPanel).toContain('type: "click"');
    expect(browserPanel).not.toContain('type: "down"');
    expect(browserPanel).not.toContain('type: "up"');
  });

  it("keeps thread rename fail-closed and the dialog open after a failed write", () => {
    expect(threadQueries).toContain("apiClient.threads.updateState(threadId");
    expect(threadSidebar).toMatch(
      /await threads\.rename[\s\S]*renameThreadId\.value = null;[\s\S]*catch \(cause\)/,
    );
    expect(threadSidebar).toContain('role="alert"');
  });

  it("keeps thread server state in Vue Query and routes deletes through the sidecar cascade", () => {
    expect(threadQueries).toContain("useInfiniteQuery");
    expect(threadQueries).toContain("fetchInfiniteThreadsPage");
    expect(threadQueries).toContain("deleteThreadCascade");
    expect(threadQueries).not.toContain("defineStore");
  });

  it("updates one MCP server before refreshing authoritative config", () => {
    expect(toolSettings).toContain("await updateMCPServerState(name, enabled)");
    expect(toolSettings).toMatch(
      /await updateMCPServerState\(name, enabled\);[\s\S]*config\.value = await loadMCPConfig\(\)/,
    );
    expect(toolSettings).toContain('role="alert"');
  });
});

describe("M5 artifact inventory", () => {
  it("keeps the exact WP-06 6-file / 29-test gate", () => {
    expect(m5Inventory.expectedFileCount).toBe(6);
    expect(m5Inventory.expectedTestCount).toBe(29);
    expect(m5Inventory.specFiles).toHaveLength(6);
    expect(m5Inventory.specFiles).toContain(
      "frontend-vue/tests/m5/artifact-batched-stream.spec.ts",
    );
  });
});

describe("Vue M7 gate ownership", () => {
  it("keeps the exact WP-07 26-file / 138-test gate and owns framework-specific specs", () => {
    expect(m7Inventory.expectedFileCount).toBe(26);
    expect(m7Inventory.expectedTestCount).toBe(144);
    expect(m7Inventory.specFiles).toHaveLength(26);
    expect(m7Inventory.specFiles).toContain(
      "frontend-vue/tests/m5/artifact-batched-stream.spec.ts",
    );
    expect(m7Inventory.specFiles).toContain(
      "frontend-vue/tests/m5/artifact-panel-resize.spec.ts",
    );
    expect(m7Inventory.specFiles).not.toContain(
      "frontend/tests/e2e/artifact-batched-stream.spec.ts",
    );
    expect(m7Inventory.specFiles).not.toContain(
      "frontend/tests/e2e/artifact-panel-resize.spec.ts",
    );
    expect(m7Inventory.specFiles).toContain(
      "frontend-vue/tests/m6/browser-control.spec.ts",
    );
    for (const spec of [
      "agent-chat.spec.ts",
      "channels.spec.ts",
      "integrations.spec.ts",
      "scheduled-tasks.spec.ts",
      "thread-history.spec.ts",
    ]) {
      expect(m7Inventory.specFiles).toContain(`frontend-vue/tests/m7/${spec}`);
      expect(m7Inventory.specFiles).not.toContain(`frontend/tests/e2e/${spec}`);
    }
    expect(makefile).toContain("playwright test -c playwright.m7.config.ts");
    expect(vueWorkflow).toContain("run: make e2e-m7");
    expect(m7Config).toContain("retries: 0");
    expect(m7Config).toContain("workers: process.env.CI ? 2 : undefined");
  });

  it("does not reintroduce React DOM or fixed-timer shims in Vue panel behavior", () => {
    expect(workspacePanels).not.toContain('data-slot="resizable-');
    expect(workspacePanels).not.toContain("data-separator");
    expect(workspacePanels).not.toContain("flexGrow");
    expect(workspacePanels).not.toContain("animationTimer");
    expect(agentChat).not.toContain("artifactOpenTimer");
    expect(messageList).not.toContain("AIMessageChunk");
  });

  it("owns a dedicated WP-07 real FastAPI/SQLite/Chromium gate", () => {
    expect(makefile).toContain("e2e-wp07-real-backend:");
    expect(makefile).toContain(
      "playwright test -c playwright.wp07-real-backend.config.ts",
    );
    expect(wp07RealConfig).toContain("scripts/run_replay_gateway.py");
    expect(wp07RealConfig).toContain('testDir: "tests/wp07-real-backend"');
    expect(wp07RealConfig).toContain("NUXT_PUBLIC_AUTH_DISABLED=1");
  });
});

describe("M4b inventory contract", () => {
  it("is exactly the Vue-owned 11-file / 73-test gate", () => {
    expect(inventory.specFiles).toHaveLength(11);
    expect(new Set(inventory.specFiles)).toHaveLength(11);
    expect(inventory.expectedFileCount).toBe(11);
    expect(inventory.expectedTestCount).toBe(73);
    expect(m4bConfig).toContain("tests/m4b-inventory.json");
  });
});
