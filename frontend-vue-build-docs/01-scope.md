# 01 · 范围界定

## 做什么

只重写**应用本体**：

- `/workspace/**` —— 聊天、自定义智能体、定时任务、artifacts、sidecar、browser view、设置
- 认证流 —— `/login`、`/setup`、`/auth/callback`
- 三个**营销占位页** —— `/`、`/pricing`、`/about`（当前为占位，未来替换为公司自定义内容）

## 不做什么

### 1. 落地页（不迁）

| 项 | 量 |
| --- | --- |
| `frontend/src/components/landing/` | 12 文件 / 1,754 行 |
| `frontend/src/app/page.tsx` | 改为占位页 |
| landing 独占特效组件 | `galaxy`(.jsx+.css)、`magic-bento`(.tsx+.css)、`number-ticker`、`terminal` |

**随之消失的依赖**：`gsap`（仅 magic-bento 使用）、`ogl`（仅 galaxy 使用）。

**顺带发现的死代码**（当前 `frontend/` 里已无引用，不要迁）：
- `src/components/ui/spotlight-card.tsx` + `.css`
- `src/components/ui/carousel.tsx` —— 是 `embla-carousel-react` 的唯一消费者

**仍需移植的 4 个特效组件**（它们不属于落地页，shadcn-vue 也不提供，全部手写）：

| 组件 | 使用方 |
| --- | --- |
| `aurora-text` | `src/components/workspace/welcome.tsx` |
| `flickering-grid` | `src/app/(auth)/login/page.tsx`、`setup/page.tsx` |
| `shine-border` | `src/components/workspace/messages/subtask-card.tsx` |
| `confetti-button`（→ 保留 `canvas-confetti`） | `src/components/workspace/input-box.tsx` |

这 4 个都是"CSS 渐变文字 / canvas 网格 / 边框动画 / 调一次 confetti"级别，手写即可，**不需要引入 Inspira UI 之类的整包依赖**。

> `src/components/ui/` 41 个组件的完整处置（哪些走 shadcn-vue CLI、哪些必须自写）见 [02-stack.md](02-stack.md#ui-层41-个-ui-组件的处置)。

### 2. 文档站与博客（不迁）

| 项 | 量 |
| --- | --- |
| `src/content/` | 72 个 MDX + 14 个 `_meta.ts`，共 88 文件 / 9,043 行 |
| `src/app/[lang]/docs/**`、`src/app/blog/**` | 5 个路由文件 |
| `src/components/docs/` | 4 文件 |
| `src/core/blog/` | — |
| `nextra` 引用点 | 21 处 |

**随之消失的依赖**：`nextra`、`nextra-theme-docs`。

Nextra 没有 Vue 移植，重建需要自写文档主题；当前不在范围内。未来若需要，用 Nuxt Content v3 + MDC 在同一个 app 内实现。

### 3. Mock / 静态 demo 模式（不迁）

这是"把真实 agent 会话录制成静态文件、无后端回放"的展示模式，由落地页 Case Studies 卡片进入（`href = pathOfThread(threadId) + "?mock=true"`）。落地页不做后，唯一入口消失。

| 项 | 量 |
| --- | --- |
| `src/app/mock/**` route handlers | 12 个 |
| `src/core/threads/static-demo.ts` + `src/core/static-mode.ts` | 198 行 |
| `frontend/scripts/save-demo.js` + `demo:save` script | 61 行 |
| `public/demo/`（13 段会话）+ 6 张封面图 | 约 15 MB |
| `NEXT_PUBLIC_STATIC_WEBSITE_ONLY` 环境变量 | env schema + `perf:check` 分支 |
| 单测 | `tests/unit/app/mock/static-artifact-route.test.ts`、`tests/unit/core/threads/static-demo.test.ts` |

**真正的收益：27 个文件可以直接写"干净版本"。**

`isMock` 与 `STATIC_WEBSITE_ONLY` 两个开关的条件分支散布在 27 个文件里（已排除落地页的 3 个）：

- **`core/` 10 个**：`api/api-client.ts`、`artifacts/{editing,hooks,loader,utils}.ts`、`config/index.ts`、`sidecar/api.ts`、`threads/hooks.ts`、`static-mode.ts`、`threads/static-demo.ts`
- **`components/workspace/` 14 个**：`artifacts/artifact-file-detail.tsx`、`artifacts/context.tsx`、`chats/chat-box.tsx`、`chats/use-thread-chat.ts`、`input-box.tsx`、`messages/context.ts`、`messages/message-group.tsx`、`sidecar/context.tsx`、`sidecar/sidecar-panel.tsx`、`workspace-header.tsx`、`recent-chat-list.tsx`、`settings/{skill,tool,integrations}-settings-page.tsx`
- **页面 3 个**：`workspace/page.tsx` 及两个 chat 页

其中 `src/core/threads/hooks.ts` 里 `isMock` 出现 **23 次** —— 这正是最难移植的文件（`useStream` 所在）。少掉 mock 分支后 `getAPIClient()` 退化为无参单例，该 composable 会干净很多。

### 4. xyflow canvas 组件（不迁）

`ai-elements/` 里有 7 个组件只服务于 `@xyflow/react` 的画布：

| 文件 | 行 |
| --- | --- |
| `canvas.tsx` `node.tsx` `edge.tsx` `connection.tsx` `controls.tsx` `panel.tsx` `toolbar.tsx` | 共 310 |

实测这 7 个在 `frontend/src/` 内**零外部引用**——`@xyflow/react` 的全部引用点就是它们自己。删掉依赖，它们随之不用写。

**`ai-elements/` 的手写量因此是 22 个 / 5,107 行，不是 29 个 / 5,417 行。**

### 5. `src/app/` 的处置（早期版本漏了这一节）

`frontend/src/app/` 实测 **39 个文件 / 4,143 行**，此前不在任何一张工作量表里。

| 分类 | 数 | 处置 |
| --- | --- | --- |
| `mock/api/**` route handlers | 12 | 不迁（见上文 §3） |
| `[lang]/docs/**`、`blog/**` | 5 | 不迁（见上文 §2） |
| `api/memory/**` route handlers | 2 | 删除——浏览器经代理直连 `/api/memory` |
| **`layout.tsx`（根 + `(auth)` + `workspace` + 各级嵌套）** | 6 | → `layouts/{default,auth,workspace}.vue` |
| **`page.tsx` / `providers.tsx` / `workspace-content.tsx`** | 14 | → `pages/**`，见 [03 的路由映射](03-project-shape.md#路由映射) |

**需要改写的是 20 个 layout/page + 2 个不迁 = 22 个进 [M4b](06-migration-plan.md#m4b--通用-agent-uil2-第一批--模板价值兑现点)。**

其中两个值得单独留意：

- `workspace/workspace-content.tsx` —— 服务端读 cookie，`ssr:false` 后改客户端（见 [03 的服务端边界变化](03-project-shape.md#服务端边界的变化)）
- `workspace/chats/[thread_id]/providers.tsx` —— 7 个业务 Context 的挂载点之一，对应 [04 §3](04-architecture-decisions.md#3-状态管理pinia-管流式状态provideinject-管-ui-状态) 的 `provide`/`inject` 改写

### 6. `@radix-ui/react-icons`（换掉，不是删掉）

实测 2 个消费文件。它与 `@radix-ui/*` 那 16 个**行为原语**不是一回事——reka-ui 只接手原语，不提供图标。改用 `lucide-vue-next` 的等价图标，逐处替换。

## ⚠️ 一个不能跟着删的东西

`frontend/tests/e2e/utils/mock-api.ts` **必须保留**。

它是 Playwright 的 `page.route()` 网络拦截，与产品内的 static demo 模式无关 —— 作用是让 E2E 能在没有后端的情况下测试真实交互。这套 E2E 是验证 Vue 版与 Next 版 1:1 的**唯一客观手段**：同一份 spec 两个 app 都跑绿，才算对标成功。

⚠️ **它实测有 39 个 `page.route()`**：7 个在 `**/api/langgraph/*`（threads、threads/\*、/history、/state、/search、runs/stream、threads/\*/runs/stream），**另外 32 个在裸 `/api/*`**——`/api/v1/auth/*`、`/api/threads/*`（含正则）、`/api/scheduled-tasks/*`、`/api/features`、`/api/models`、`/api/skills`、`/api/agents`、`/api/integrations/lark/*`、`/api/channels/*` 等。

因此 Vue 版发出的 **API URL 必须逐字一致，不只是保住一个前缀**——这是 [07-parallel-run.md](07-parallel-run.md) 里"用 `routeRules` 复刻 nginx 的前缀重写"那条决策的首要理由。

⚠️ 同样重要：`frontend/playwright.config.ts` 起 webServer 时传 `DEER_FLOW_AUTH_DISABLED=1`，**25 个合同 spec 全部依赖鉴权被关掉**。Vue 版必须有等价开关，见 [03-project-shape.md](03-project-shape.md#️-e2e-必须能关掉鉴权)。

## 范围变化时的回归点

若未来需要在公司营销页上展示"真实案例"，不要恢复旧的 static demo 实现（它在 27 个组件里插条件分支）。正确做法是在 `getAPIClient()` 那一层做一个干净的 mock adapter，或直接用录屏 / GIF / 截图，成本低得多。
