# 09 · 工程化、测试与质量门禁

## 9.1 命令

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | 开发服务器（Turbopack，`localhost:3000`） |
| `pnpm build` | 生产构建 |
| `pnpm check` | **提交前必跑** = `eslint . --ext .ts,.tsx && tsc --noEmit` |
| `pnpm lint` / `pnpm lint:fix` | ESLint |
| `pnpm format` / `pnpm format:write` | Prettier |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | 单元测试（Rstest） |
| `pnpm test:e2e` | E2E（Playwright / Chromium） |
| `pnpm start` | 生产服务器 |
| `pnpm preview` | `build && start` |

**宿主侧 pnpm 必须走 `scripts/pnpm.py`**（仓库根约定）。
`frontend/Makefile` 里 `PNPM = python3 ../scripts/pnpm.py`：
runner 保留直接 `pnpm`/`pnpm.cmd` 优先级，回落到 `corepack pnpm`，
并从 `frontend/` 目录调用以让 Corepack 读到项目锁定的 pnpm 版本（`10.26.2`）。

静态站点构建有专门目标：
```bash
cd frontend && make build-static
```
（`NEXT_CONFIG_BUILD_OUTPUT=standalone SKIP_ENV_VALIDATION=1 NEXT_PUBLIC_STATIC_WEBSITE_ONLY=true`，
并手动把 `.next/static` 拷进 standalone 输出。）

## 9.2 单元测试：Rstest 双 project

[rstest.config.ts](../frontend/rstest.config.ts) 定义两个 project，**这个划分必须保持**：

| project | 匹配 | 环境 | 用途 |
| --- | --- | --- | --- |
| `node` | `tests/unit/**/*.test.ts(x)`，排除 `**/*.dom.test.*` | Node | 纯逻辑，**占全套绝大多数** |
| `dom` | `tests/unit/**/*.dom.test.ts(x)` | happy-dom | 需要 document 的：`renderHook` 驱动的 hook、组件 |

> **DOM 环境的运行时约为 node 的 3 倍**，所以不渲染的测试不要 opt-in。
> 反过来：行为只在真实 React 下成立的 hook（effect 顺序、卸载清理、
> store 变更触发重渲染）应该写成 `.dom.test.*`，
> 而**不是**写成 mock 掉 `react` 本身的 node 测试。

共享配置：`pluginReact()`、`@` → `src` 别名、
`bundleDependencies: ["streamdown", "katex"]`（Streamdown 副作用式 import KaTeX CSS，
必须让 Rsbuild 处理这个 CSS import，否则 Node 会试图加载它）。

### 测试布局镜像 `src/`

```
tests/unit/core/          71 个测试   ← 重心在 core
tests/unit/components/    21 个测试
tests/unit/hooks/          2 个
tests/unit/content/        1 个
```

`tests/unit/core/api/stream-mode.test.ts` 测 `src/core/api/stream-mode.ts`——
路径一一对应。源模块通过 `@/` 别名导入。

**这个 71:21 的比例反映了架构意图**：业务逻辑抽成 `core/` 的纯函数，
所以能用便宜的 node 测试覆盖。重构时若把逻辑挪回组件，会把测试推向昂贵的 DOM 侧。

## 9.3 E2E：四套 Playwright 配置

| 配置 | 目录 | 后端 | 用途 |
| --- | --- | --- | --- |
| [playwright.config.ts](../frontend/playwright.config.ts) | `tests/e2e/`（26 个 spec） | **全 mock**（`page.route()` 网络拦截） | 主力套件 |
| [playwright.auth.config.ts](../frontend/playwright.auth.config.ts) | `tests/e2e-auth/` | — | 鉴权/初始化恢复 |
| [playwright.real-backend.config.ts](../frontend/playwright.real-backend.config.ts) | `tests/e2e-real-backend/` | **真实 Gateway + `ReplayChatModel`**（确定性重放，无需 API key） | 契约级验证 |
| [playwright.record.config.ts](../frontend/playwright.record.config.ts) | `tests/e2e-record/` | 录制 | 生成重放素材 |

主配置要点：`fullyParallel`、CI 下 `retries: 2` + `workers: 1`、
`timeout: 30s`、`trace: "on-first-retry"`、locale 固定 `en-US`；
webServer 用 `next build && next start`（不是 dev），
env 带 `SKIP_ENV_VALIDATION=1` + `DEER_FLOW_AUTH_DISABLED=1`。
可用 `PLAYWRIGHT_SKIP_WEB_SERVER=1` + `PLAYWRIGHT_BASE_URL` 指向已有实例。

### 主套件的 26 个 spec（即重构的回归护栏）

```
chat / agent-chat / chat-thread-init-ordering / user-message-plain-text
thread-history / thread-history-mermaid / thread-list-infinite-scroll / thread-list-pin
branch-thread / subtask-card / workspace-changes / sidecar-chat
artifact-preview / artifact-panel-resize / artifact-batched-stream / artifact-stream-state
browser-feature / agents-feature-disabled / channels / integrations
scheduled-tasks / settings-notification / sidebar / command-palette 相关
landing / docs-localized-links / ui-polish-mobile
```

**重构时这套 spec 是主要安全网。** 特别是：
- `artifact-panel-resize.spec.ts` 钉住右面板拖拽手柄（issue #4465 的回归测试）
- `sidecar-chat.spec.ts` 的 no-animated-scroll 测试钉住面板动画期间不得回流消息列表
- `chat-thread-init-ordering.spec.ts` 钉住新 thread 初始化顺序
- `artifact-stream-state.spec.ts` / `artifact-batched-stream.spec.ts` 钉住流式产物状态机

## 9.4 TypeScript 配置要点

来自 [tsconfig.json](../frontend/tsconfig.json)：

| 选项 | 值 | 影响 |
| --- | --- | --- |
| `strict` | `true` | 基线严格 |
| `noUncheckedIndexedAccess` | `true` | 索引访问返回 `T \| undefined`（代码里大量 `?.` / `.at(-1)` 源于此） |
| `noImplicitAny` | **`false`** | ⚠️ 严格性的缺口 |
| `verbatimModuleSyntax` | `true` | 强制 `import type` / inline type import |
| `isolatedModules` | `true` | — |
| `moduleResolution` | `Bundler` | — |
| `target` / `lib` | `es2022` / dom + dom.iterable + ES2022 | — |
| `paths` | `@/*` → `./src/*` | — |

**可收紧的空间**：`noImplicitAny: false` + ESLint 关掉的一批 `no-unsafe-*` 规则
（`no-unsafe-assignment` / `-call` / `-member-access` / `-argument` / `-return`）
共同构成类型安全的软肋，集中在 SSE 事件、SDK 返回值、JSON 解析这些边界上。
重构时可以逐模块打开（用 overrides），而不是一次性全开。

## 9.5 环境变量

### 客户端（`NEXT_PUBLIC_*`，经 `src/env.js` zod 校验）
| 变量 | 说明 |
| --- | --- |
| `NEXT_PUBLIC_BACKEND_BASE_URL` | 可选。设了就直连 Gateway（需 CORS） |
| `NEXT_PUBLIC_LANGGRAPH_BASE_URL` | 可选。同上，且会关掉 `/api/langgraph` rewrite |
| `NEXT_PUBLIC_STATIC_WEBSITE_ONLY` | `"true"` 启用静态站点模式 |

### 服务端
| 变量 | 说明 |
| --- | --- |
| `NODE_ENV` | `development` / `test` / `production` |
| `GITHUB_OAUTH_TOKEN` | 可选 |
| `DEER_FLOW_INTERNAL_GATEWAY_BASE_URL` | SSR / rewrites 用的内部 Gateway 地址，默认 `http://127.0.0.1:8001` |
| `DEER_FLOW_TRUSTED_ORIGINS` | 受信来源 |
| `DEER_FLOW_DEV_ALLOWED_ORIGINS` | **仅开发**。非 localhost 访问必须配，否则 `/_next/*` 403、页面永不 hydrate |
| `DEER_FLOW_AUTH_DISABLED` | `1` 跳过鉴权（E2E） |
| `SKIP_ENV_VALIDATION` | 跳过 env 校验（Docker 构建） |
| `NEXT_CONFIG_BUILD_OUTPUT` | `standalone` 时输出 standalone |

**规则**：新增环境变量必须同时更新 `src/env.js`（schema + `runtimeEnv`）
和 `.env.example`。`emptyStringAsUndefined: true`，所以空串等于未设置。

## 9.6 提交前检查清单

```bash
cd frontend && pnpm check
```

完整流程（对应 `AGENTS.md` 的贡献约定）：
1. 遵循既有 `src/` 结构
2. 加 TypeScript 类型和错误处理
3. 单元测试写在 `tests/unit/`（`pnpm test`），E2E 写在 `tests/e2e/`（`pnpm test:e2e`）
4. `pnpm check` 通过
5. **架构 / 命令 / 约定变更同步更新 [frontend/AGENTS.md](../frontend/AGENTS.md)**

仓库根另有 pre-commit hook（`.pre-commit-config.yaml`）。
后端 CI 强制 `ruff format --check`；前端侧靠 `pnpm check` + Prettier。

## 9.7 依赖治理观察

前端有 **~75 个生产依赖**。其中几组值得在重构时评估：

| 组 | 包 | 备注 |
| --- | --- | --- |
| 动效（3 套并存） | `motion` `gsap` `ogl` | 主要服务落地页视觉件 |
| CodeMirror | 7 个 `@codemirror/*` + `@uiw/*` 3 个 | 产物代码编辑/高亮 |
| Markdown 链路 | `streamdown` + `@streamdown/{code,mermaid}` + `shiki` + 5 个 `remark`/`rehype` + `katex` | 流式渲染核心，不可轻动 |
| 图 | `@xyflow/react` | agent/plan 可视化 |
| 疑似可疑项 | `nuxt-og-image`、`h3`、`hast`、`dotenv`、`defu` | `nuxt-og-image` / `h3` 属于 Nuxt 生态，出现在 Next 项目里值得核实是否为间接需要 |
| 版本不一致 | `eslint-config-next@^15.2.3` 而 `next@^16.2.11` | 主版本落后一档 |

> 上面两条只是**记录观察**，不构成本文档的行动建议——是否处理由重构计划决定。
