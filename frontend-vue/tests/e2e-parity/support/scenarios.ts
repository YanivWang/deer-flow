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
  | { kind: "press"; key: string }
  /*
    在 `scope` 子树里选中一段正文，并派发 mouseup —— 划词工具条的唯一入口。

    为什么必须是一条**新的步骤**而不是既有词汇的组合：选区是浏览器状态，不是
    DOM 状态，`click` / `press` 都造不出一个 Range 来。sidecar 面板的全部入口都
    挂在这条工具条上，所以在有这一步之前，`sidecar-chat` 只能挂在 pending 里
    （理由原文写在 baseline/parity-scenario-coverage.json 的 $pendingReasons）。

    实现照抄 frontend/tests/e2e/sidecar-chat.spec.ts:29 的 selectTextOnPage：
    走 TreeWalker 找到第一个包含该串的文本节点，建 Range，再在它的父元素上派发
    一个**真的 MouseEvent**（坑 76 的同一条机制：两个应用的处理器都挂在 mouseup 上，
    普通 Event 造不出 clientX/clientY，工具条的定位会拿到 0/0）。

    两个应用共用这段代码，因为它只碰浏览器 API，不碰任何一边的实现细节。
  */
  | { kind: "select-text"; scope: ParityTarget; text: string };

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
  if (step.kind === "select-text") {
    const scope = locateTarget(page, step.scope).first();
    await scope.waitFor({ state: "visible", timeout });
    return scope.evaluate((root, targetText) => {
      globalThis.getSelection?.()?.removeAllRanges();
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        const start = (node.textContent ?? "").indexOf(targetText);
        if (start >= 0) {
          const range = document.createRange();
          range.setStart(node, start);
          range.setEnd(node, start + targetText.length);
          const selection = globalThis.getSelection?.();
          selection?.removeAllRanges();
          selection?.addRange(range);
          const rect = range.getBoundingClientRect();
          node.parentElement?.dispatchEvent(
            new MouseEvent("mouseup", {
              bubbles: true,
              clientX: rect.left + rect.width / 2,
              clientY: rect.top + rect.height / 2,
            }),
          );
          return;
        }
        node = walker.nextNode();
      }
      throw new Error(`select-text 找不到这段文字：${targetText}`);
    }, step.text);
  }
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
/*
  八个 provider 各站一种状态，而不是八份同样的「已连接」。

  同形夹具下，侧栏里所有按钮的文案都一样，于是「连接态怎么算」这条判据整段测不到——
  把 isConnected 写死成 true 也一样绿。这里让每一支分支各有一行：enabled=false 的
  整行不该渲染；configured=false 走「先填运行时配置」；connection_status 非 connected
  的显示「连接」；**已连接但 runtime 不可用**的也必须显示「连接」——最后这条是
  provider.connection_status 与 unavailable_reason 的交叉点，两边的判据都是
  `!unavailable_reason && connection_status === "connected"`，少一半就红。

  Telegram 与 DingTalk 仍然可见，因为它们是 settle 锚点与几何锚点；这里顺手让
  Telegram 站在「未连接」一侧，DingTalk 站在「已连接」一侧，几何锚点于是同时覆盖
  两种按钮变体（secondary 与 outline+勾）的行高与行内布局。
*/
const CHANNEL_PROVIDERS = [
  { provider: "buzz", display_name: "Buzz", auth_mode: "binding_code" },
  {
    provider: "telegram",
    display_name: "Telegram",
    auth_mode: "deep_link",
    connection_status: "not_connected",
  },
  { provider: "slack", display_name: "Slack", auth_mode: "binding_code" },
  {
    provider: "discord",
    display_name: "Discord",
    auth_mode: "binding_code",
    enabled: false,
    configured: false,
    connectable: false,
    connection_status: "not_connected",
  },
  {
    provider: "feishu",
    display_name: "Feishu",
    auth_mode: "binding_code",
    configured: false,
    connectable: false,
    connection_status: "not_connected",
  },
  { provider: "dingtalk", display_name: "DingTalk", auth_mode: "binding_code" },
  {
    provider: "wechat",
    display_name: "WeChat",
    auth_mode: "binding_code",
    connectable: false,
    unavailable_reason: "WeChat runtime is not running.",
  },
  {
    provider: "wecom",
    display_name: "WeCom",
    auth_mode: "binding_code",
    connection_status: "revoked",
  },
].map((provider) => ({
  enabled: true,
  configured: true,
  connectable: true,
  connection_status: "connected",
  unavailable_reason: null,
  credential_fields: [
    { name: "token", label: "Token", type: "password", required: true },
  ],
  ...provider,
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
const SUBTASK_DONE_DESCRIPTION = "Summarize the release notes";
const SUBTASK_DONE_RESULT = "Three regressions were fixed this week.";

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
    /*
      browser 面板**本体**。这条场景原来只断言触发器可见，从来没打开过面板——
      于是整块头部（标题、前进后退、地址栏、Live 切换、关闭）一行台账都没有，
      而实测那里有六条 aria 差异和一整排几何差异（本仓的 URL 栏被挤到只剩 36.6px 宽，
      上游同一屏是 129.3）。

      **点击写在 settle 而不是 steps**：几何只取 settle 里的 visible 锚点
      （见 capture.ts 的 sampleGeometry），所以要让头部进几何取样，把面板打开的
      那一下必须排在这些锚点前面，也就是同在 settle 里。

      **锚点全部用两个应用共有的可访问名**，一条都不靠 data-testid（上游这个面板
      一个 testid 都没有）：
      - `/^Browser$/` 是面板标签那一格，上游画的是 `t.common.browser`；
      - Back / Forward 的名字上游来自 `title`，本仓也用 `title`；
      - 地址栏的名字来自 **placeholder**——本仓曾经挂 `aria-label` 把它顶掉，
        这条锚点就是那个 bug 的守卫，改回去当场取不到；
      - `/^…$/` 是 Live 切换在「请求了 Live 但还没连上」时的文案。mock 后端没有
        WS 端点，两个应用都停在这一态：实测 React 三轮四个时点恒定 "…"。
        本仓原来是四态（Connecting → Reconnecting n/6 → …），实测取样点
        settle+700ms 正好落在第一次重连定时器（800ms）前 100ms，
        **拿它当锚点就是一份会飘的门禁**——两态化之后才敢挂上来。
      - 关闭按钮的名字两边都有：上游那颗原来没有可访问名，是 WCAG 4.1.2 缺陷，
        已按「两边同改」补上 `t.common.closeBrowser`。

      空状态那条 heading 一并挂上：它证明取样落在「还没有画面」这一支，
      两个应用都到得了，不会静默退化成「两边都没渲染、台账照样 0」。
    */
    id: "browser-feature",
    title: "浏览器面板入口与面板本体",
    backend: "mock",
    path: `/workspace/chats/${MOCK_THREAD_ID}`,
    mock: {
      threads: [{ thread_id: MOCK_THREAD_ID, title: "Browser Enabled" }],
    },
    settle: [
      { kind: "visible", target: { testId: "browser-trigger" } },
      { kind: "click", target: { testId: "browser-trigger" } },
      { kind: "visible", target: { text: /^Browser$/ } },
      { kind: "visible", target: { role: "button", name: "Back" } },
      { kind: "visible", target: { role: "button", name: "Forward" } },
      {
        kind: "visible",
        target: { role: "textbox", name: "Enter a URL and press Enter" },
      },
      { kind: "visible", target: { role: "button", name: /^…$/ } },
      { kind: "visible", target: { role: "button", name: "Close browser" } },
      {
        kind: "visible",
        target: { role: "heading", name: "Connecting to live browser…" },
      },
    ],
  },
  {
    /*
      sidecar 面板的**草稿态**：选中正文 → 点「Ask in side chat」→ 面板打开，
      但还没有 sidecar thread。这一屏原来两个应用差得最远，而台账一行都没有，
      因为在这条场景进来之前，sidecar 面板从来没有被取样过。

      **夹具自证**：最后四条 visible 全是被测对象自己的锚点——头部标题、头部副标题、
      空状态的标题与说明。四条在两个应用上都必须渲染出来，缺一条整轮当场红，
      不会悄悄退化成「两边都没有、台账照样 0」。挂上去的时候本仓四条全缺
      （标题读错词条、副标题整行不存在、空状态那一支根本没写），正是它们把
      SidecarPanel.vue 的四处分叉逼出来的。

      工具条本身**不在取样里**：两个应用点完之后都会把选区清掉
      （React setSelectionToolbar(null) / 本仓 selection.value = null），
      所以稳定态里没有它。它自身的差异见提交说明里「台账测不到」那一节。
    */
    id: "sidecar-chat",
    title: "划词开启 side chat 的草稿态",
    backend: "mock",
    path: `/workspace/chats/${MOCK_THREAD_ID}`,
    mock: {
      threads: [
        {
          thread_id: MOCK_THREAD_ID,
          title: "Main conversation",
          messages: [
            {
              type: "human",
              id: "parent-human-1",
              content: [{ type: "text", text: "Plan the feature." }],
            },
            {
              type: "ai",
              id: "parent-ai-1",
              content: "Build it as a side conversation.",
            },
          ],
        },
      ],
    },
    settle: [
      { kind: "visible", target: { text: "Build it as a side conversation." } },
    ],
    steps: [
      {
        kind: "select-text",
        scope: { testId: "main-message-list" },
        text: "Build it as a side conversation.",
      },
      { kind: "click", target: { role: "button", name: "Ask in side chat" } },
      { kind: "visible", target: { testId: "sidecar-panel" } },
      { kind: "visible", target: { text: "Side chat" } },
      { kind: "visible", target: { text: "1 selected text fragment" } },
      { kind: "visible", target: { text: "Ask a follow-up" } },
      {
        kind: "visible",
        target: { text: "Ask a follow-up grounded in the referenced text." },
      },
    ],
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
    /*
      喂一份**混合**状态,而不是 replay Gateway 那份全 Pending 的默认值。

      默认值只走得到「什么都没装」这一支:四格全 Pending、下一步是「先装技能包」、
      权限面板与换应用面板都不渲染、安装按钮写 Install。这个域真正长代码的地方
      全在另一侧——已装/CLI 就绪/已授权之后才出现的那些分支。台账对它们一行都报不出来,
      不是因为两边一致,是因为取样根本走不到。

      这一份同时点亮:已装版本行 + 可更新提示 + 运行时版本不匹配、权限面板(22 个域
      按钮与自定义 scope)、换应用按钮、连接成功的下一步 Alert、授权格的 **verified**
      分支(念账号名而不是「已为 X 配置」)、以及 sandbox runtime 格**没有就绪**时的
      Pending 徽标——四格里另外三格都是 Ready,只有它是 Pending,一格漏了徽标就会显出来。

      注意这里量的是「两个应用拿同一份响应会不会渲染成同一个样子」,所以不能把状态
      写成两边各自的期望值;它就是 Gateway 契约里的一种真实状态。
    */
    routes: [
      {
        pattern: "**/api/integrations/lark/status",
        json: {
          installed: true,
          version: "v1.0.65",
          manifest_version: "v1.0.65",
          latest_available_version: "v1.0.70",
          runtime_version_mismatch: true,
          app_configured: true,
          app_id: "cli_parity_mock",
          app_brand: "feishu",
          skills_expected: 27,
          skills_installed: 4,
          installed_skills: [
            "lark-doc",
            "lark-im",
            "lark-shared",
            "lark-sheets",
          ],
          enabled_skills: ["lark-doc", "lark-im", "lark-shared", "lark-sheets"],
          install_path: "/mock/integrations/skills/lark-cli",
          cli: {
            available: true,
            path: "/usr/bin/lark-cli",
            version: "lark-cli version v1.0.65",
            error: null,
          },
          auth: {
            status: "authenticated",
            message: "Lark authorization is live-verified.",
            user: "Alice",
            verified: true,
          },
          sandbox_runtime_mode: "init-container",
          sandbox_runtime_ready: false,
          sandbox_runtime_detail:
            "The provisioner has no lark-cli init image configured (LARK_CLI_INIT_IMAGE).",
        },
      },
    ],
    /*
      锚点必须与语言无关,否则加不了 zh-CN 维度:对话框标题在中文下是「设置」,
      卡片标题是「Lark / 飞书 CLI」(两个应用的词典里都翻译了,不是漏翻)。
      改用两边都有的结构锚点——`[data-slot=card-title]` 是 shadcn CardTitle 的合同,
      本仓的 CardTitle 逐行照抄了它。
    */
    settle: [
      { kind: "visible", target: { selector: "[role=dialog]" } },
      { kind: "visible", target: { selector: '[data-slot="card-title"]' } },
    ],
    dimensions: [
      DEFAULT_DIMENSION,
      { viewport: "desktop", theme: "light", locale: "zh-CN" },
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
            /*
              这条 interrupt 是**故意**挂在 branch-thread 上的，不是另起一个场景：
              场景 id 受棘轮约束（baseline/parity-scenario-coverage.json 只钉 id），
              但夹具数据不受约束，而换夹具比加交互步骤划算——夹具不引入任何时序。

              两边的分组逻辑逐字相同（core/messages/utils.ts 的
              isClarificationToolMessage + assistant:clarification 分支实测 diff 为空），
              所以 `name: "ask_clarification"` + `artifact.human_input` 在两个应用里
              都会长出一个独立的 clarification 组。前一条是不带 tool_calls 的 ai，
              形成 `assistant` 组，`lastOpenGroup()` 因此返回 null——这条 tool 消息
              只进独立组，不会同时被塞进 processing 组里渲染两次。

              必须放在**最后**：`deriveHumanInputThreadState` 有一条 legacy 兜底，
              请求之后再出现任何可见的 human 消息就把它当成「已答」，卡片会从
              active 掉成 answered，取样到的就不是打开态了。

              choice_with_other 一次覆盖到卡片的大部分表面：标题、context 与问题的
              markdown、选项按钮网格、sr-only 标签 + Textarea 的「其它答案」表单、
              以及页脚提交按钮。
            */
            {
              type: "tool",
              id: "tool-clarify-1",
              name: "ask_clarification",
              content: "Waiting for clarification",
              artifact: {
                human_input: {
                  version: 1,
                  kind: "human_input_request",
                  source: "ask_clarification",
                  request_id: "parity-clarification-1",
                  tool_call_id: "call-parity-1",
                  question: "Which environment should I deploy to?",
                  context: "Need the target environment.",
                  input_mode: "choice_with_other",
                  options: [
                    {
                      id: "option-1",
                      label: "development",
                      value: "development",
                    },
                    { id: "option-2", label: "staging", value: "staging" },
                  ],
                },
              },
            },
          ],
        },
      ],
    },
    /*
      第二条锚点让这个夹具**自证**：settle 步骤在两个应用上都要跑通，所以哪一边
      没把卡片渲染出来，整轮就当场红，而不是悄悄退化成「两边都没有、台账照样是 0」。
    */
    settle: [
      { kind: "visible", target: { text: "First answer" } },
      {
        kind: "visible",
        target: { text: "Which environment should I deploy to?" },
      },
    ],
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
                /*
                  第二个子任务带工具结果，于是走的是**另一条**渲染路径：
                  derivePendingSubtaskStatus 看到有结果就给 in_progress，真状态由
                  parseSubtaskResult 从 additional_kwargs 读出来（completed）。
                  一条 ai 消息里两个 task 调用还顺手覆盖了组头的复数分支
                  （`executing(2)` 才会插数字和 "in parallel"）。

                  没有第三种状态的卡片：in_progress 要么当前回合还在跑、要么工具结果
                  的形状没被认出来，前者静态夹具做不到，后者是「契约变了」的降级路径，
                  拿它当常态样本会把一条本该刺眼的兜底渲染钉成基线。
                */
                {
                  id: "call-completed-subtask",
                  name: "task",
                  args: {
                    subagent_type: "general-purpose",
                    description: SUBTASK_DONE_DESCRIPTION,
                    prompt: "Read the changelog and summarize what shipped.",
                  },
                  type: "tool_call",
                },
              ],
              invalid_tool_calls: [],
            },
            {
              type: "tool",
              id: "msg-tool-completed-subtask",
              name: "task",
              tool_call_id: "call-completed-subtask",
              content: `Task Succeeded. Result: ${SUBTASK_DONE_RESULT}`,
              additional_kwargs: {
                subagent_status: "completed",
                subagent_result_brief: SUBTASK_DONE_RESULT,
                subagent_model_name: "deerflow-basic",
                subagent_token_usage: {
                  input_tokens: 800,
                  output_tokens: 400,
                  total_tokens: 1200,
                },
              },
            },
          ],
        },
      ],
    },
    /*
      三个锚点都在折叠态和展开态下同时可见，所以既能当 settle 断言又能量几何
      （sampleGeometry 只取 settle 里的 visible，但量的是**跑完 steps 之后**的状态）。
      组头那一行是这一轮新增的，单独给它一个锚点：它的 pt-2 与外层 gap 的关系
      决定了整组的纵向节奏，量它比量卡片更早发现问题。
    */
    settle: [
      { kind: "visible", target: { text: SUBTASK_DESCRIPTION } },
      { kind: "visible", target: { text: SUBTASK_DONE_DESCRIPTION } },
      { kind: "visible", target: { text: "Executing 2 subtasks in parallel" } },
    ],
    /*
      展开一张卡片。展开区里的一切——prompt 的 markdown、终态步骤、失败原因——
      折叠着的时候两边都在 DOM 之外，台账一行都看不到；aria 快照是在所有 steps
      跑完之后取的，所以这一步把整个展开面板纳入了比对。
    */
    steps: [
      { kind: "click", target: { text: SUBTASK_DESCRIPTION } },
      {
        kind: "visible",
        target: {
          text: "Investigate why the stopped subtask card should not remain running after reload.",
        },
      },
    ],
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
    /*
      夹具刻意不是「一个全新的任务」。这一页有好几支只由**数据**决定的分叉，一次
      页面加载就能全部走到，不需要任何交互，也就不引入任何时序：

      - `context_mode: reuse_thread` 走详情里 `Thread:` 那一支（fresh 模式走的是
        `Last thread:`，两者二选一）；
      - `last_run_at` / `last_run_id` / `last_error` 都不为空，于是时间戳格式、id
        与失败原因都进树，而不是三个 `—`；
      - 第二个任务是 `once` + `paused`，列表行的措辞「One-time · Paused」才有样本；
      - 预置两条运行（一条成功一条失败），运行列表、`trigger · status` 的措辞、
        run id、计划时刻与错误行才有样本——否则永远只比得到「No runs yet」。

      再跑一份 zh-CN：这一页的词典两边逐字相同，但「用的是不是同一个 key」只有
      换一种语言才看得出来，时间戳的 locale 分支同理。
    */
    mock: {
      threads: [],
      scheduledTasks: [
        {
          id: "task-1",
          thread_id: "thread-1",
          context_mode: "reuse_thread",
          last_thread_id: "thread-9",
          title: "Daily summary",
          prompt: "Summarize thread",
          schedule_type: "cron",
          schedule_spec: { cron: "0 9 * * *" },
          timezone: "UTC",
          status: "enabled",
          next_run_at: "2026-07-02T01:00:00+00:00",
          last_run_at: "2026-07-01T01:00:00+00:00",
          last_run_id: "run-42",
          last_error: "Upstream model timed out",
          run_count: 2,
          created_at: "2026-07-01T00:00:00+00:00",
          updated_at: "2026-07-01T00:00:00+00:00",
        },
        {
          id: "task-2",
          thread_id: null,
          title: "One-off cleanup",
          prompt: "Clean up the workspace",
          schedule_type: "once",
          schedule_spec: { run_at: "2026-08-01T09:00:00+00:00" },
          timezone: "UTC",
          status: "paused",
          next_run_at: "2026-08-01T09:00:00+00:00",
          last_run_at: null,
          last_run_id: null,
          last_error: null,
          run_count: 0,
          created_at: "2026-07-01T00:00:00+00:00",
          updated_at: "2026-07-01T00:00:00+00:00",
        },
      ],
      scheduledTaskRuns: {
        "task-1": [
          {
            id: "run-b",
            task_id: "task-1",
            thread_id: "thread-1",
            run_id: "run-42",
            scheduled_for: "2026-07-01T01:00:00+00:00",
            trigger: "scheduled",
            status: "failed",
            error: "Upstream model timed out",
            started_at: "2026-07-01T01:00:01+00:00",
            finished_at: "2026-07-01T01:00:30+00:00",
            created_at: "2026-07-01T01:00:00+00:00",
          },
          {
            id: "run-a",
            task_id: "task-1",
            thread_id: "thread-1",
            run_id: null,
            scheduled_for: "2026-06-30T01:00:00+00:00",
            trigger: "manual",
            status: "success",
            error: null,
            started_at: "2026-06-30T01:00:01+00:00",
            finished_at: "2026-06-30T01:00:20+00:00",
            created_at: "2026-06-30T01:00:00+00:00",
          },
        ],
      },
    },
    settle: [
      { kind: "visible", target: { role: "button", name: /Daily summary/i } },
    ],
    dimensions: [
      DEFAULT_DIMENSION,
      { viewport: "desktop", theme: "light", locale: "zh-CN" },
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
    dimensions: [
      DEFAULT_DIMENSION,
      { viewport: "desktop", theme: "light", locale: "zh-CN" },
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
      两个锚点：消息正文 + 图本身。

      正文那条确定「这条历史消息已经从 messages/page 加载并渲染完了」。

      图那条是 wave 10 加的，此前**故意没加**，理由是「让锚点兼任断言的话，一边
      渲染不出来时得到的是超时而不是台账里那一行」——那条理由在 Vue 侧还画不出
      工具栏时成立，因为那 15 行差异正是当时的产出。现在两边都画得出来，剩下的
      只有时序，而时序不加锚点就是掷骰子：实测 React 侧从 `runScenario` 返回到
      图渲染完要 418 / 431 / 631 / 728ms（2026-08-31 四次，机器空闲），而
      captureScenario 的静置窗口是 700ms。也就是说不等这一条，同一份代码会在
      「0 行」和「15 行 ariaOnlyVue」之间随机跳——一份随机变红的台账等于没有台账。

      现在一边真的渲染不出来时得到的是超时。那比 15 行来路不明的差异更准确：
      它指向「图没出来」这一件事，而不是让人去逐行读那 15 行再反推同一个结论。
    */
    settle: [
      { kind: "visible", target: { text: "Here is a relationship diagram." } },
      { kind: "visible", target: { selector: '[data-streamdown="mermaid"]' } },
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
