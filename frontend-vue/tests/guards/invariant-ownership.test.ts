/*
  【文件职责】     守住行为合同的条目格式，以及若干「所有权只有一处」的源码不变量。
  【架构位置】     门禁测试
  【主要导出】     无
  【依赖关系】     frontend-vue/BEHAVIOR_CONTRACTS.md · app/** 若干所有权关键文件
  【边界与注意】   源码断言只钉「谁是唯一 owner」这类会被无声破坏的结构事实，
                   不钉实现细节。行为正确性仍由对应 unit/E2E/协议测试负责。
*/

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const invariants = readFileSync(
  fileURLToPath(new URL("../../BEHAVIOR_CONTRACTS.md", import.meta.url)),
  "utf8",
);

/** 05 的条目行长这样：`| A1  | …` 或 `| **L9**  | …`（加粗的是后补的条目）。 */
function declaredInvariants(): string[] {
  const found: string[] = [];
  for (const line of invariants.split("\n")) {
    if (!line.startsWith("|")) continue;
    const first = (line.split("|")[1] ?? "").replaceAll("*", "").trim();
    if (/^[A-N]\d+$/.test(first)) found.push(first);
  }
  return found;
}

describe("Vue 行为合同结构", () => {
  const declared = declaredInvariants();

  it("读取到完整的 A–N 合同，而不是解析失败后假绿", () => {
    expect(declared.length).toBeGreaterThanOrEqual(110);
    expect(new Set(declared.map((id) => id[0])).size).toBe(14);
  });

  it("条目 id 唯一", () => {
    const seen = new Map<string, number>();
    for (const id of declared) seen.set(id, (seen.get(id) ?? 0) + 1);
    expect(
      [...seen].filter(([, count]) => count > 1).map(([id]) => id),
    ).toEqual([]);
  });
});

const agentChat = readFileSync(
  new URL("../../app/components/chat/AgentChat.vue", import.meta.url),
  "utf8",
);
const messageList = readFileSync(
  new URL("../../app/components/chat/MessageList.vue", import.meta.url),
  "utf8",
);
const workspacePanels = readFileSync(
  new URL(
    "../../app/components/workspace/WorkspacePanels.vue",
    import.meta.url,
  ),
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
  new URL("../../app/composables/useMCPConfig.ts", import.meta.url),
  "utf8",
);

describe("所有权不变量", () => {
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

  it("updates one MCP server through the single query owner before authoritative re-read", () => {
    expect(toolSettings).toContain("updateMCPServerState");
    expect(toolSettings).toContain("MCP_CONFIG_QUERY_KEY");
    expect(toolSettings).toContain("invalidateQueries");
    expect(toolSettings).not.toContain("defineStore");
  });

  it("does not reintroduce React DOM or fixed-timer shims in Vue panel behavior", () => {
    expect(workspacePanels).not.toContain('data-slot="resizable-');
    expect(workspacePanels).not.toContain("data-separator");
    expect(workspacePanels).not.toContain("flexGrow");
    expect(workspacePanels).not.toContain("animationTimer");
    expect(agentChat).not.toContain("artifactOpenTimer");
    expect(messageList).not.toContain("AIMessageChunk");
  });
});
