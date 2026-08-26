/*
  【文件职责】     用**与框架无关的数据**描述对照场景：打开哪里、做什么、等到什么。
  【架构位置】     对照测试基础设施
  【主要导出】     PARITY_SCENARIOS · applyScenarioBackend · runScenario · DIMENSION 类型
  【依赖关系】     ../../e2e/utils/mock-api（Gateway 的 HTTP/SSE 行为）· @playwright/test
  【边界与注意】   场景是**数据不是函数**，这一条是刻意的。写成函数，作者迟早会在里面
                   分叉——「React 走这条、Vue 走那条」——而那正是对照要发现的东西，
                   一旦能被绕过，比对结果就只反映测试作者的耐心。写成数据，一个场景
                   只能有一种执行方式，两个应用要么都到得了，要么就是一处真差异。

                   步骤只能用**两边共有**的定位方式表达：data-testid、role + 可访问名、
                   可见文本、以及两边都写死的 data-* 选择器（如 [data-sidebar]）。
                   不允许用 class 名或组件库内部结构——那是 ARCHITECTURE 里明写只对齐
                   可观察行为的三处之一。

                   后端有两种来源，对应仓库里本来就有的两种拓扑：
                   - mock：共享 route-level mock，两个应用拿到**逐字节相同**的响应，
                     因此渲染差异只可能来自前端；
                   - gateway：真 replay Gateway，用于必须有真实后端行为的场景。
                   同一份 mock 能同时喂两个应用，是因为它拦的是 glob 通配下的 `/api/` 路径，而两个
                   应用都走自己的同源代理请求这些路径（见 react-preview.ts 文件头）。
*/

import type { Page } from "@playwright/test";

import {
  mockLangGraphAPI,
  type MockAPIOptions,
} from "../../e2e/utils/mock-api";

/** 采样维度。默认只取一份 desktop/light/en-US；要变的场景自己声明。 */
export const VIEWPORTS = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
} as const;

export type ParityViewport = keyof typeof VIEWPORTS;
export type ParityTheme = "light" | "dark";
export type ParityLocale = "en-US" | "zh-CN";

export type ParityDimension = {
  viewport: ParityViewport;
  theme: ParityTheme;
  locale: ParityLocale;
};

export const DEFAULT_DIMENSION: ParityDimension = {
  viewport: "desktop",
  theme: "light",
  locale: "en-US",
};

/**
 * 定位方式。四种都是两个应用共有的表达，没有第五种。
 */
export type ParityTarget =
  | { testId: string }
  | { selector: string }
  | { role: Parameters<Page["getByRole"]>[0]; name: string | RegExp }
  | { text: string | RegExp };

export type ParityStep =
  | { kind: "visible"; target: ParityTarget }
  | { kind: "hidden"; target: ParityTarget }
  | { kind: "click"; target: ParityTarget }
  | { kind: "fill"; target: ParityTarget; value: string }
  | { kind: "press"; key: string };

/**
 * 额外的路由覆盖，写成数据。
 *
 * 好几个 React spec 在 mockLangGraphAPI 之上再盖一条 `page.route`（把某个 feature
 * flag 关掉、换一份 provider 列表）。这里照搬那种能力，但仍然是数据：一旦允许写
 * 回调，场景就又能分叉了。Playwright 后注册的路由优先，所以覆盖必须在 mock 之后注册。
 */
export type ParityRouteOverride = {
  /** Playwright glob，与 mock-api 里的写法一致。 */
  pattern: string;
  status?: number;
  json: unknown;
  /*
    artifact 的**正文**不是 JSON。用 application/json 端上去，两个应用都会渲染一串
    带引号的 JSON 字面量——比出来的仍然一致，但比的是夹具而不是产品。
    ETag 同理：artifact 的 revision 走它，没有 ETag 两个应用都看不到编辑入口，
    于是「编辑这一整块」被静默排除在对照之外。
  */
  contentType?: string;
  headers?: Record<string, string>;
};

export type ParityScenario = {
  /** 与 React spec 文件同名（去掉 .spec.ts），覆盖率棘轮靠它对齐。 */
  id: string;
  title: string;
  backend: "mock" | "gateway";
  /** 两个应用打开同一个路径。 */
  path: string;
  mock?: MockAPIOptions;
  routes?: ParityRouteOverride[];
  /** 打开后等到这些锚点，保证两边取样时机一致。 */
  settle: ParityStep[];
  /** 取样前的交互。 */
  steps?: ParityStep[];
  /** 要跑的采样维度；缺省只跑 DEFAULT_DIMENSION。 */
  dimensions?: ParityDimension[];
};

export function locateTarget(page: Page, target: ParityTarget) {
  if ("testId" in target) return page.getByTestId(target.testId);
  if ("selector" in target) return page.locator(target.selector);
  if ("role" in target)
    return page.getByRole(target.role, { name: target.name });
  return page.getByText(target.text);
}

/** 把后端接上。mock 场景必须在 goto 之前调用。 */
export async function applyScenarioBackend(
  page: Page,
  scenario: ParityScenario,
) {
  if (scenario.backend === "mock") mockLangGraphAPI(page, scenario.mock);
  // 后注册者优先，所以覆盖一定要在 mock 之后。
  for (const override of scenario.routes ?? []) {
    await page.route(override.pattern, (route) =>
      route.fulfill({
        status: override.status ?? 200,
        contentType: override.contentType ?? "application/json",
        headers: override.headers,
        body:
          typeof override.json === "string" && override.contentType
            ? override.json
            : JSON.stringify(override.json),
      }),
    );
  }
}

/**
 * 把维度加到页面上。两个应用用的是**同一套**持久化：locale 走 `locale` cookie，
 * theme 走 localStorage 的 `theme` 键（next-themes 的默认 storageKey 与 Vue 的
 * THEME_STORAGE_KEY 恰好相同）。所以维度也能用一份数据表达。
 */
export async function applyDimension(
  page: Page,
  base: string,
  dimension: ParityDimension,
) {
  await page.setViewportSize(VIEWPORTS[dimension.viewport]);
  await page.context().addCookies([
    {
      name: "locale",
      value: dimension.locale,
      url: base,
    },
  ]);
  await page.addInitScript((theme) => {
    try {
      globalThis.localStorage?.setItem("theme", theme);
    } catch {
      /* 无痕/禁用存储时按默认主题渲染即可 */
    }
  }, dimension.theme);
}

async function runStep(page: Page, step: ParityStep, timeout: number) {
  if (step.kind === "press") return page.keyboard.press(step.key);
  const locator = locateTarget(page, step.target).first();
  switch (step.kind) {
    case "visible":
      return locator.waitFor({ state: "visible", timeout });
    case "hidden":
      return locator.waitFor({ state: "hidden", timeout });
    case "click":
      return locator.click({ timeout });
    case "fill":
      return locator.fill(step.value, { timeout });
  }
}

/** 在一个应用上执行一个场景，返回稳定后的页面，供调用方取样。 */
export async function runScenario(
  page: Page,
  base: string,
  scenario: ParityScenario,
  dimension: ParityDimension = DEFAULT_DIMENSION,
  timeout = 30_000,
) {
  await applyScenarioBackend(page, scenario);
  await applyDimension(page, base, dimension);
  await page.goto(`${base}${scenario.path}`);
  for (const step of scenario.settle) await runStep(page, step, timeout);
  for (const step of scenario.steps ?? []) await runStep(page, step, timeout);
  return page;
}

const MOCK_THREAD_ID = "00000000-0000-0000-0000-000000000001";
const MOCK_RUN_ID = "00000000-0000-0000-0000-000000000099";
const MOCK_THREAD_ID_2 = "00000000-0000-0000-0000-000000000002";

const MOCK_AGENTS = [
  {
    name: "test-agent",
    description: "A test agent for E2E tests",
    system_prompt: "You are a test agent.",
  },
  {
    name: "second-agent",
    description: "Another test agent for E2E tests",
    system_prompt: "You are another test agent.",
  },
];

/** 与 frontend/tests/e2e/thread-list-infinite-scroll.spec.ts 同一份构造。 */
const MANY_THREADS = Array.from({ length: 120 }, (_, index) => {
  const padded = String(index + 1).padStart(3, "0");
  return {
    thread_id: `00000000-0000-0000-0000-0000000${padded.padStart(5, "0")}`,
    title: `Conversation ${padded}`,
    updated_at: new Date(
      Date.UTC(2025, 5, 30, 12, 0, 0) - index * 60_000,
    ).toISOString(),
  };
});

const PLAIN_TEXT_SOURCE = "#include <stdio.h>";

/** 与 frontend/tests/e2e/channels.spec.ts 同一份 provider 列表。 */
const CHANNEL_PROVIDERS = [
  ["buzz", "Buzz", "binding_code"],
  ["telegram", "Telegram", "deep_link"],
  ["slack", "Slack", "binding_code"],
  ["discord", "Discord", "binding_code"],
  ["feishu", "Feishu", "binding_code"],
  ["dingtalk", "DingTalk", "binding_code"],
  ["wechat", "WeChat", "binding_code"],
  ["wecom", "WeCom", "binding_code"],
].map(([provider, displayName, authMode]) => ({
  provider,
  display_name: displayName,
  enabled: true,
  configured: true,
  connectable: true,
  auth_mode: authMode,
  connection_status: "connected",
  credential_fields: [
    { name: "token", label: "Token", type: "password", required: true },
  ],
}));

const ARTIFACT_PATH = "/artifact-fixtures/report.html";

/** 与 frontend/tests/e2e/artifact-preview.spec.ts 的 writeFileMessages() 同形。 */
const ARTIFACT_MESSAGES = [
  {
    type: "human",
    id: "msg-human-artifact",
    content: [{ type: "text", text: "Create a report artifact" }],
  },
  {
    type: "ai",
    id: "msg-ai-write-artifact",
    content: "",
    tool_calls: [
      {
        id: "write-file-artifact",
        name: "write_file",
        args: {
          description: "Writing report artifact",
          path: ARTIFACT_PATH,
          content:
            "<!doctype html><html><body><h1>Report draft</h1><p>测试内容</p></body></html>",
        },
        type: "tool_call",
      },
    ],
    invalid_tool_calls: [],
  },
];

const SUBTASK_DESCRIPTION = "Research stopped reload regression";

const MERMAID_CONTENT = `Here is a relationship diagram.

\`\`\`mermaid
flowchart TD
    A[Lin<br/>protagonist]
    F[Gu<br/>daughter]
    A -- "sealed memory" -.-> F
\`\`\`
`;

const WORKSPACE_CHANGES_RUN_ID = "00000000-0000-0000-0000-0000000009c1";

const HISTORY_THREADS = [
  {
    thread_id: MOCK_THREAD_ID,
    title: "First conversation",
    updated_at: "2025-06-01T12:00:00Z",
  },
  {
    thread_id: MOCK_THREAD_ID_2,
    title: "Second conversation",
    updated_at: "2025-06-02T12:00:00Z",
  },
];

/**
 * 场景目录。
 *
 * id 与 `frontend/tests/e2e/*.spec.ts` 的文件名一一对应，缺哪个由
 * `baseline/parity-scenario-coverage.json` 显式列出——目录只能变长，
 * 待办清单只能变短。
 */
export const PARITY_SCENARIOS: ParityScenario[] = [
  {
    id: "chat",
    title: "新会话的空状态与输入框",
    backend: "mock",
    path: "/workspace/chats/new",
    settle: [
      { kind: "visible", target: { selector: "textarea" } },
      {
        kind: "hidden",
        target: { role: "button", name: /load more/i },
      },
    ],
    // 这一条跑满矩阵，用来证明维度机制真的生效；其余场景先跑默认维度，
    // 全矩阵留给比对层按需要展开，避免现在就把套件时间乘以十二。
    dimensions: (["desktop", "tablet", "mobile"] as const).flatMap((viewport) =>
      (["light", "dark"] as const).flatMap((theme) =>
        (["en-US", "zh-CN"] as const).map((locale) => ({
          viewport,
          theme,
          locale,
        })),
      ),
    ),
  },
  {
    id: "sidebar",
    title: "侧栏的 Chats / Agents 导航",
    backend: "mock",
    path: "/workspace/chats/new",
    settle: [
      {
        kind: "visible",
        target: {
          selector: "[data-sidebar='sidebar'] a[href='/workspace/chats']",
        },
      },
      {
        kind: "visible",
        target: {
          selector: "[data-sidebar='sidebar'] a[href='/workspace/agents']",
        },
      },
    ],
  },
  {
    id: "thread-history",
    title: "侧栏列出已有会话",
    backend: "mock",
    path: "/workspace/chats/new",
    mock: { threads: HISTORY_THREADS },
    settle: [
      { kind: "visible", target: { text: "First conversation" } },
      { kind: "visible", target: { text: "Second conversation" } },
    ],
  },
  {
    id: "agent-chat",
    title: "自定义 agent 的新会话页",
    backend: "mock",
    path: "/workspace/agents/test-agent/chats/new",
    mock: { agents: MOCK_AGENTS },
    settle: [{ kind: "visible", target: { selector: "textarea" } }],
  },
  {
    id: "agents-feature-disabled",
    title: "agents_api 关闭时的说明页",
    backend: "mock",
    path: "/workspace/agents",
    mock: { agents: [] },
    routes: [
      { pattern: "**/api/features", json: { agents_api: { enabled: false } } },
    ],
    settle: [
      {
        kind: "visible",
        target: { text: /contact your administrator|联系管理员/i },
      },
    ],
  },
  {
    id: "browser-feature",
    title: "浏览器面板入口",
    backend: "mock",
    path: `/workspace/chats/${MOCK_THREAD_ID}`,
    mock: {
      threads: [{ thread_id: MOCK_THREAD_ID, title: "Browser Enabled" }],
    },
    settle: [{ kind: "visible", target: { testId: "browser-trigger" } }],
  },
  {
    id: "thread-list-pin",
    title: "会话列表的置顶排序",
    backend: "mock",
    path: "/workspace/chats/new",
    mock: {
      threads: [
        {
          thread_id: "00000000-0000-0000-0000-00000000010a",
          title: "Newest chat",
          updated_at: "2026-07-04T10:00:00Z",
        },
        {
          thread_id: "00000000-0000-0000-0000-00000000010b",
          title: "Older chat",
          updated_at: "2026-07-03T10:00:00Z",
        },
      ],
    },
    settle: [
      { kind: "visible", target: { text: "Newest chat" } },
      { kind: "visible", target: { text: "Older chat" } },
    ],
  },
  {
    id: "thread-list-infinite-scroll",
    title: "会话列表页的首屏分页",
    backend: "mock",
    path: "/workspace/chats",
    mock: { threads: MANY_THREADS },
    settle: [{ kind: "visible", target: { text: "Conversation 001" } }],
  },
  {
    id: "ui-polish-mobile",
    title: "移动端工作区首屏",
    backend: "mock",
    path: "/workspace/chats/new",
    settle: [{ kind: "visible", target: { selector: "textarea" } }],
    // 这个场景的全部意义就是小屏，所以它只跑 mobile。
    dimensions: [{ viewport: "mobile", theme: "light", locale: "en-US" }],
  },
  {
    id: "user-message-plain-text",
    title: "用户消息按纯文本渲染",
    backend: "mock",
    path: `/workspace/chats/${MOCK_THREAD_ID}`,
    mock: {
      threads: [
        {
          thread_id: MOCK_THREAD_ID,
          title: "Plain text rendering",
          updated_at: "2025-06-01T12:00:00Z",
          messages: [
            {
              type: "human",
              id: "msg-human-plain-text",
              content: [{ type: "text", text: PLAIN_TEXT_SOURCE }],
            },
            { type: "ai", id: "msg-ai-plain-text", content: "ack" },
          ],
        },
      ],
    },
    settle: [{ kind: "visible", target: { text: PLAIN_TEXT_SOURCE } }],
  },
  {
    id: "integrations",
    title: "设置里的集成页",
    backend: "mock",
    path: "/workspace/chats/new?settings=integrations",
    settle: [
      { kind: "visible", target: { role: "dialog", name: "Settings" } },
      { kind: "visible", target: { text: "Lark / Feishu CLI" } },
    ],
  },
  {
    id: "branch-thread",
    title: "已完成回合上的分支入口",
    backend: "mock",
    path: `/workspace/chats/${MOCK_THREAD_ID}`,
    mock: {
      threads: [
        {
          thread_id: MOCK_THREAD_ID,
          title: "Original chat",
          updated_at: "2026-06-01T12:00:00Z",
          messages: [
            {
              type: "human",
              id: "human-1",
              content: [{ type: "text", text: "First question" }],
            },
            { type: "ai", id: "ai-1", content: "First answer" },
            {
              type: "human",
              id: "human-2",
              content: [{ type: "text", text: "Second question" }],
            },
            { type: "ai", id: "ai-2", content: "Intermediate answer" },
          ],
        },
      ],
    },
    settle: [{ kind: "visible", target: { text: "First answer" } }],
  },
  {
    id: "subtask-card",
    title: "子任务卡片",
    backend: "mock",
    path: `/workspace/chats/${MOCK_THREAD_ID}`,
    mock: {
      threads: [
        {
          thread_id: MOCK_THREAD_ID,
          title: "Stopped subtask",
          updated_at: "2026-06-18T12:00:00Z",
          messages: [
            {
              type: "human",
              id: "msg-human-stopped-subtask",
              content: [
                {
                  type: "text",
                  text: "Start a subtask and then stop before the task tool returns.",
                },
              ],
            },
            {
              type: "ai",
              id: "msg-ai-stopped-subtask",
              content: "",
              additional_kwargs: {},
              response_metadata: {},
              tool_calls: [
                {
                  id: "call-stopped-subtask",
                  name: "task",
                  args: {
                    subagent_type: "general-purpose",
                    description: SUBTASK_DESCRIPTION,
                    prompt:
                      "Investigate why the stopped subtask card should not remain running after reload.",
                  },
                  type: "tool_call",
                },
              ],
              invalid_tool_calls: [],
            },
          ],
        },
      ],
    },
    settle: [{ kind: "visible", target: { text: SUBTASK_DESCRIPTION } }],
  },
  {
    id: "artifact-preview",
    title: "打开 artifact 面板后的预览",
    backend: "mock",
    path: `/workspace/chats/${MOCK_THREAD_ID}`,
    mock: {
      threads: [
        {
          thread_id: MOCK_THREAD_ID,
          title: "Artifact preview",
          updated_at: "2026-06-02T12:00:00Z",
          messages: ARTIFACT_MESSAGES,
        },
      ],
    },
    settle: [{ kind: "visible", target: { text: ARTIFACT_PATH } }],
    steps: [
      { kind: "click", target: { text: ARTIFACT_PATH } },
      { kind: "visible", target: { text: "report.html" } },
    ],
    /*
      窄屏也跑一份。React 在 isMobile 分支把右侧面板整个换成 Sheet，也就是一个真的
      模态 dialog（chats/chat-box.tsx）——那是与宽屏 complementary 完全不同的语义，
      不跑窄屏就等于没比过其中一半。
    */
    dimensions: [
      DEFAULT_DIMENSION,
      { viewport: "mobile", theme: "light", locale: "en-US" },
    ],
  },
  {
    id: "artifact-panel-resize",
    title: "artifact 面板的分栏几何",
    backend: "mock",
    path: `/workspace/chats/${MOCK_THREAD_ID}`,
    mock: {
      threads: [
        {
          thread_id: MOCK_THREAD_ID,
          title: "Artifact panel resize",
          updated_at: "2026-06-03T12:00:00Z",
          messages: ARTIFACT_MESSAGES,
        },
      ],
    },
    settle: [{ kind: "visible", target: { text: ARTIFACT_PATH } }],
    steps: [{ kind: "click", target: { text: ARTIFACT_PATH } }],
  },
  {
    id: "scheduled-tasks",
    title: "定时任务列表",
    backend: "mock",
    path: "/workspace/scheduled-tasks",
    mock: {
      threads: [],
      scheduledTasks: [
        {
          id: "task-1",
          thread_id: "thread-1",
          title: "Daily summary",
          prompt: "Summarize thread",
          schedule_type: "cron",
          schedule_spec: { cron: "0 9 * * *" },
          timezone: "UTC",
          status: "enabled",
          next_run_at: "2026-07-02T01:00:00+00:00",
          last_run_at: null,
          last_run_id: null,
          last_error: null,
          run_count: 0,
          created_at: "2026-07-01T00:00:00+00:00",
          updated_at: "2026-07-01T00:00:00+00:00",
        },
      ],
    },
    settle: [
      { kind: "visible", target: { role: "button", name: /Daily summary/i } },
    ],
  },
  {
    id: "channels",
    title: "侧栏的 IM 渠道列表",
    backend: "mock",
    path: "/workspace/chats/new",
    routes: [
      {
        pattern: "**/api/channels/providers",
        json: { enabled: true, providers: CHANNEL_PROVIDERS },
      },
      { pattern: "**/api/channels/connections", json: { connections: [] } },
    ],
    settle: [
      {
        kind: "visible",
        target: { selector: "[data-sidebar='sidebar']" },
      },
      { kind: "visible", target: { text: "Telegram" } },
      { kind: "visible", target: { text: "DingTalk" } },
    ],
  },
  {
    id: "thread-history-mermaid",
    title: "历史消息里的 Mermaid 图",
    backend: "mock",
    path: `/workspace/chats/${MOCK_THREAD_ID}`,
    mock: {
      threads: [
        {
          thread_id: MOCK_THREAD_ID,
          title: "Mermaid history",
          updated_at: "2026-05-24T04:47:01.123949+00:00",
        },
      ],
    },
    routes: [
      {
        pattern: "**/api/langgraph/threads/*/runs*",
        json: [
          {
            run_id: MOCK_RUN_ID,
            thread_id: MOCK_THREAD_ID,
            status: "success",
            created_at: "2026-05-24T04:46:42.565307+00:00",
            updated_at: "2026-05-24T04:47:01.123949+00:00",
          },
        ],
      },
      {
        pattern: `**/api/threads/${MOCK_THREAD_ID}/messages/page*`,
        json: {
          data: [
            {
              thread_id: MOCK_THREAD_ID,
              run_id: MOCK_RUN_ID,
              event_type: "llm.ai.response",
              category: "message",
              content: {
                content: MERMAID_CONTENT,
                additional_kwargs: {},
                response_metadata: {},
                type: "ai",
                name: null,
                id: "lc_run--issue-3193",
                tool_calls: [],
                invalid_tool_calls: [],
              },
              seq: 720,
              created_at: "2026-05-24T04:47:01.123949+00:00",
              metadata: {
                caller: "lead_agent",
                content_is_json: true,
                content_is_dict: true,
              },
            },
          ],
          has_more: false,
          next_before_seq: null,
        },
      },
    ],
    /*
      锚点是消息正文，不是图本身。锚点的职责只是确定取样时刻——正文出现就说明
      这条历史消息已经从 messages/page 加载并渲染完了。把「图渲染出来了没有」
      写成锚点，等于让锚点兼任断言：一边渲染不出来时，得到的是一条超时，
      而不是台账里那一行「React 有这个节点、Vue 没有」。
    */
    settle: [
      { kind: "visible", target: { text: "Here is a relationship diagram." } },
    ],
  },
  {
    id: "workspace-changes",
    title: "工作区改动摘要",
    backend: "mock",
    path: `/workspace/chats/${MOCK_THREAD_ID}`,
    mock: {
      threads: [
        {
          thread_id: MOCK_THREAD_ID,
          title: "Workspace changes",
          updated_at: "2026-07-04T10:00:00Z",
          messages: [
            {
              type: "human",
              id: "msg-human-workspace-changes",
              content: [{ type: "text", text: "Create a report" }],
              run_id: WORKSPACE_CHANGES_RUN_ID,
            },
            {
              type: "ai",
              id: "msg-ai-workspace-changes",
              content: "I updated the workspace report.",
              run_id: WORKSPACE_CHANGES_RUN_ID,
            },
          ],
        },
      ],
    },
    routes: [
      {
        pattern: "**/api/threads/*/runs/*/workspace-changes*",
        json: {
          available: true,
          version: 1,
          summary: {
            created: 1,
            modified: 1,
            deleted: 0,
            symlink_created: 0,
            additions: 8,
            deletions: 2,
            truncated: false,
          },
          files: [
            {
              path: "/mnt/user-data/outputs/report.md",
              root: "outputs",
              status: "modified",
              binary: false,
              sensitive: false,
              size_before: 12,
              size_after: 20,
              sha256_before: "before",
              sha256_after: "after",
              diff: "--- a/mnt/user-data/outputs/report.md\n+++ b/mnt/user-data/outputs/report.md\n@@ -1,2 +1,2 @@\n-Draft\n+Ready",
              diff_truncated: false,
              diff_unavailable_reason: null,
              additions: 1,
              deletions: 1,
            },
          ],
        },
      },
    ],
    settle: [
      { kind: "visible", target: { text: "I updated the workspace report." } },
    ],
  },
  {
    id: "streaming-reasoning-order",
    title: "已结束回合里推理在答案之上",
    backend: "mock",
    path: `/workspace/chats/${MOCK_THREAD_ID}`,
    /*
      取的是 React spec 里**已结束**的那半边。另一半要挂一个「一直不关」的流服务器，
      那超出当前步骤词汇能表达的范围；顺序这件事在结束态同样可比。
    */
    mock: {
      threads: [
        {
          thread_id: MOCK_THREAD_ID,
          title: "Settled reasoning order",
          updated_at: "2026-06-04T12:00:00Z",
          messages: [
            {
              type: "human",
              id: "msg-human-4576",
              content: [{ type: "text", text: "Who are you?" }],
            },
            {
              type: "ai",
              id: "msg-ai-4576-settled",
              content: "I am DeerFlow, an open-source super agent.",
              additional_kwargs: {
                reasoning_content:
                  "The user asked who I am, so I will list the core capabilities.",
              },
            },
          ],
        },
      ],
    },
    settle: [
      {
        kind: "visible",
        target: { text: "I am DeerFlow, an open-source super agent." },
      },
    ],
  },
  {
    id: "artifact-stream-state",
    title: "线程带 artifact 时的入口",
    backend: "mock",
    path: `/workspace/chats/${MOCK_THREAD_ID}`,
    mock: {
      threads: [
        {
          thread_id: MOCK_THREAD_ID,
          title: "Artifact stream state",
          updated_at: "2026-06-05T12:00:00Z",
          artifacts: ["/artifact-fixtures/report.md"],
          messages: [
            {
              type: "human",
              id: "msg-human-artifact",
              content: [{ type: "text", text: "Create a markdown report" }],
            },
            {
              type: "ai",
              id: "msg-ai-artifact",
              content: "Created a markdown report.",
            },
          ],
        },
      ],
    },
    /*
      正文只回一段并声明总长度，两个应用都会进入**截断**分支：提示条、
      「加载完整文件」、以及截断时代码区的渲染方式。此前没有任何样本走到这里，
      而 React 在截断时还会把代码/预览开关整个收起来（canPreview && !truncated）。
    */
    routes: [
      {
        pattern: "**/api/threads/*/artifacts/**",
        status: 206,
        contentType: "text/markdown",
        headers: {
          "Content-Range": "bytes 0-31/2097152",
          ETag: `"${"b".repeat(64)}"`,
        },
        json: "# report\n\nfirst chunk of a long file",
      },
    ],
    settle: [{ kind: "visible", target: { testId: "artifact-trigger" } }],
    steps: [
      { kind: "click", target: { testId: "artifact-trigger" } },
      { kind: "visible", target: { text: "report.md" } },
      { kind: "click", target: { text: "report.md" } },
      { kind: "visible", target: { role: "button", name: "Load full file" } },
    ],
  },
  {
    id: "artifact-batched-stream",
    title: "批量写入后的 artifact 面板",
    backend: "mock",
    path: `/workspace/chats/${MOCK_THREAD_ID}`,
    mock: {
      threads: [
        {
          thread_id: MOCK_THREAD_ID,
          title: "Artifact batched stream",
          updated_at: "2026-06-06T12:00:00Z",
          /*
            路径必须落在 /mnt/user-data/outputs/ 下，两个应用的编辑门槛都要求它
            （React 的 canEditOpenedArtifact 与 Vue 的 canSaveArtifactText 同一条规则）。

            另外两个文件是为了走到详情面板剩下的两条分支：图片走浏览器媒体预览，
            .docx 走「不能预览」的下载回退。它们和 markdown 那条一起挂在同一个线程上，
            靠头部的文件下拉切换——这是唯一不用新增场景 id 就能覆盖到的走法。
          */
          artifacts: [
            "/mnt/user-data/outputs/batched-report.md",
            "/mnt/user-data/outputs/diagram.png",
            "/mnt/user-data/outputs/report.docx",
            "/mnt/user-data/outputs/helper.skill",
          ],
          messages: [
            {
              type: "human",
              id: "msg-human-batched",
              content: [{ type: "text", text: "Create a markdown report" }],
            },
            {
              type: "ai",
              id: "msg-ai-batched",
              content: "Created a markdown report.",
            },
          ],
        },
      ],
    },
    /*
      正文与 ETag 都要给：没有正文两个应用各自报错（错误处理是另一处差异，会盖住
      这里要比的东西），没有 ETag 两边都拿不到 revision，于是编辑入口在两侧都不出现，
      「详情面板有哪些动作」这一整块就静默地没被比过。
    */
    routes: [
      {
        pattern: "**/api/threads/*/artifacts/**",
        contentType: "text/markdown",
        headers: { ETag: `"${"a".repeat(64)}"` },
        json: "# batched report\n\nbody",
      },
    ],
    settle: [{ kind: "visible", target: { testId: "artifact-trigger" } }],
    steps: [
      { kind: "click", target: { testId: "artifact-trigger" } },
      { kind: "visible", target: { text: "batched-report.md" } },
      // 从清单点进详情：这一支覆盖的是**正式产物**的详情面板（文件下拉、
      // 打开/下载/编辑动作、代码/预览切换），write-file 草稿那一支由
      // artifact-preview 覆盖。
      { kind: "click", target: { text: "batched-report.md" } },
      // 详情面板独有的锚点：清单那一支的下载是 link，只有详情面板里它是 button。
      // 不用文件下拉当锚点——它**没有可访问名**（照 React 的 SelectTrigger），
      // 按名字根本定位不到。
      { kind: "visible", target: { role: "button", name: "Download" } },
      // 再点进编辑态：编辑器、保存/退出/放弃，以及「有未保存的改动」那条播报，
      // 此前一条样本都走不到。上面的 ETag 就是为这一步准备的——没有 revision，
      // 两个应用都不会显示编辑入口。
      // 名字用锚定正则：`name: "Edit"` 是子串匹配，会先命中消息工具条上的
      // "Edit and rerun"，一路点进消息编辑态。
      { kind: "click", target: { role: "button", name: /^Edit$/ } },
      { kind: "visible", target: { role: "button", name: "Exit editing" } },
      { kind: "click", target: { role: "button", name: "Exit editing" } },
      /*
        文件下拉**没有可访问名**（照 React 的 SelectTrigger），只能按选择器定位；
        `[role="combobox"]` 是两个应用共有的表达。切到图片走媒体预览分支，
        再切到 .docx 走下载回退分支。
      */
      { kind: "click", target: { selector: '[role="combobox"]' } },
      { kind: "click", target: { role: "option", name: "diagram.png" } },
      { kind: "visible", target: { selector: 'img[alt="diagram.png"]' } },
      { kind: "click", target: { selector: '[role="combobox"]' } },
      { kind: "click", target: { role: "option", name: "report.docx" } },
      { kind: "visible", target: { text: "Word file" } },
      // 最后切到 .skill：replay Gateway 的用户是管理员，所以安装入口在两边都该出现。
      { kind: "click", target: { selector: '[role="combobox"]' } },
      { kind: "click", target: { role: "option", name: "helper.skill" } },
      { kind: "visible", target: { role: "button", name: "Install" } },
    ],
  },
];
