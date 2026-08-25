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

export type ParityScenario = {
  /** 与 React spec 文件同名（去掉 .spec.ts），覆盖率棘轮靠它对齐。 */
  id: string;
  title: string;
  backend: "mock" | "gateway";
  /** 两个应用打开同一个路径。 */
  path: string;
  mock?: MockAPIOptions;
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
export function applyScenarioBackend(page: Page, scenario: ParityScenario) {
  if (scenario.backend === "mock") mockLangGraphAPI(page, scenario.mock);
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
  applyScenarioBackend(page, scenario);
  await applyDimension(page, base, dimension);
  await page.goto(`${base}${scenario.path}`);
  for (const step of scenario.settle) await runStep(page, step, timeout);
  for (const step of scenario.steps ?? []) await runStep(page, step, timeout);
  return page;
}

const MOCK_THREAD_ID = "00000000-0000-0000-0000-000000000001";
const MOCK_THREAD_ID_2 = "00000000-0000-0000-0000-000000000002";

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
];
