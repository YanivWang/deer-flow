# 03 · 路由、布局与 Provider 树

## 3.1 路由表

| 路由 | 文件 | 类型 | 说明 |
| --- | --- | --- | --- |
| `/` | [app/page.tsx](../frontend/src/app/page.tsx) | Server | 落地页 |
| `/login` | [app/(auth)/login/page.tsx](../frontend/src/app/(auth)/login/page.tsx) | Client | 本地登录 + OAuth 入口 + "保持登录" |
| `/setup` | [app/(auth)/setup/page.tsx](../frontend/src/app/(auth)/setup/page.tsx) | Client | 首次初始化 / 补全账号 |
| `/auth/callback` | [app/(auth)/auth/callback/page.tsx](../frontend/src/app/(auth)/auth/callback/page.tsx) | Client | OAuth 回调落地 |
| `/workspace` | [app/workspace/page.tsx](../frontend/src/app/workspace/page.tsx) | — | 工作台首页 |
| `/workspace/chats` | [app/workspace/chats/page.tsx](../frontend/src/app/workspace/chats/page.tsx) | — | 会话列表 |
| `/workspace/chats/[thread_id]` | [.../[thread_id]/page.tsx](../frontend/src/app/workspace/chats/[thread_id]/page.tsx) | Client | **主聊天页**（453 行，全站核心） |
| `/workspace/agents` | [app/workspace/agents/page.tsx](../frontend/src/app/workspace/agents/page.tsx) | — | 自定义 agent 画廊 |
| `/workspace/agents/new` | [.../new/page.tsx](../frontend/src/app/workspace/agents/new/page.tsx) | Client | 新建 agent（455 行） |
| `/workspace/agents/[agent_name]/chats/[thread_id]` | [.../page.tsx](../frontend/src/app/workspace/agents/[agent_name]/chats/[thread_id]/page.tsx) | Client | 自定义 agent 聊天页（426 行，与主聊天页**高度重复**） |
| `/workspace/scheduled-tasks` | [.../scheduled-tasks/page.tsx](../frontend/src/app/workspace/scheduled-tasks/page.tsx) | Client | 定时任务（612 行） |
| `/blog`、`/blog/posts`、`/blog/tags/[tag]` | `app/blog/**` | Server | MDX 博客 |
| `/[lang]/docs/[[...mdxPath]]` | `app/[lang]/docs/**` | Server | Nextra 文档站（`en` / `zh`） |
| `/api/memory`、`/api/memory/[...path]` | `app/api/memory/**` | Route Handler | 唯一自有 BFF 转发 |
| `/mock/api/**` | `app/mock/api/**` | Route Handler | Mock 模式假后端（11 个） |

`next.config.js` 里另有 `i18n: { locales: ["en", "zh"], defaultLocale: "en" }`
（服务于文档站的 `[lang]` 段）。

## 3.2 布局链与 Provider 树

聊天页从根到叶的完整包裹顺序：

```
app/layout.tsx                          [Server]
├── CSS: katex / streamdown / globals
├── detectLocaleServer() → <html lang>
└── ThemeProvider (next-themes, attribute="class")
    └── I18nProvider (initialLocale from cookie)
        │
        └── app/workspace/layout.tsx     [Server, dynamic = "force-dynamic"]
            ├── getServerSideUser() → 五态分支（见 3.4）
            └── AuthProvider (initialUser)
                └── WorkspaceContent      [Server]
                    ├── QueryClientProvider          ← TanStack Query 根
                    │   └── SidebarProvider (defaultOpen ← sidebar_state cookie)
                    │       ├── WorkspaceSidebar
                    │       └── SidebarInset
                    │           ├── GatewayOfflineBanner
                    │           └── children
                    ├── CommandPalette
                    ├── SettingsDialogHost
                    ├── WorkspaceSettingsDeepLink
                    └── Toaster (sonner, top-center)
                    │
                    └── app/workspace/chats/[thread_id]/layout.tsx  [Server]
                        └── ChatProviders  ("use client")
                            └── SubtasksProvider
                                └── ArtifactsProvider
                                    └── BrowserViewProvider
                                        └── PromptInputProvider
                                            │
                                            └── page.tsx  ("use client")
                                                └── ThreadContext.Provider
                                                    └── SidecarProvider
                                                        └── ChatBox
```

**Provider 数量：11 层**。这是重构时值得关注的深度——其中 `SubtasksProvider`
必须在 `useThreadStream` 之上（流事件要写 subtask 状态），
`SidecarProvider` 必须在 page 内部（它需要 page 拿到的 `settings.context`），
所以嵌套顺序不是随意的。

## 3.3 Server / Client 边界

**Server Component（默认）**：
- `app/layout.tsx`、`app/workspace/layout.tsx`、`workspace-content.tsx`
- 落地页、blog、docs
- 服务端能力：`cookies()`（读 `locale`、`sidebar_state`、`access_token`）、
  `getServerSideUser()`（服务端直连 Gateway）、`redirect()`

**Client Component（`"use client"`）**：
- 所有 workspace 交互页面与组件
- `ChatProviders`、`I18nProvider`、`AuthProvider`、`ThemeProvider`
- `core/api/api-client.ts` 本身就标了 `"use client"`

**关键约束**：`app/workspace/layout.tsx` 声明了 `export const dynamic = "force-dynamic"`，
因为鉴权在 SSR 阶段完成，不能被静态化。

## 3.4 鉴权网关（SSR 五态）

[core/auth/server.ts](../frontend/src/core/auth/server.ts) 的 `getServerSideUser()`
返回一个 **tagged union**，`app/workspace/layout.tsx` 用 `switch` 穷尽处理
（末尾 `assertNever(result)` 兜底）：

| tag | 处理 |
| --- | --- |
| `authenticated` | 渲染 `AuthProvider` + `WorkspaceContent` |
| `needs_setup` | `redirect("/setup")` |
| `system_setup_required` | `redirect("/setup")` |
| `unauthenticated` | `redirect("/login")` |
| `gateway_unavailable` | 渲染 `GatewayOfflineFallback`（自带 AuthProvider）+ 降级工作台 |
| `config_error` | `throw new Error(message)` |

判定流程：
1. 静态站点模式 → 直接返回 `STATIC_WEBSITE_USER`
2. 免鉴权模式（`DEER_FLOW_AUTH_DISABLED=1`）→ 返回 `AUTH_DISABLED_USER`
3. 无 `access_token` cookie → 查 `GET /api/v1/auth/setup-status`，
   `needs_setup` 则 `system_setup_required`，否则 `unauthenticated`
4. 有 cookie → `GET /api/v1/auth/me`（带 `Cookie` 头），
   用 zod `userSchema.safeParse` 校验；响应畸形 → `gateway_unavailable`
5. 所有 Gateway 请求带 `AUTH_REQUEST_TIMEOUT_MS` 超时 + `AbortController`

**安全约束**（来自 `AGENTS.md`，重构时不可破坏）：
`HttpOnly access_token` 和可读 `csrf_token` cookie 由 **Gateway 拥有**；
前端只允许通过 [core/auth/remember-login.ts](../frontend/src/core/auth/remember-login.ts)
持久化**邮箱地址**。密码和 token 绝不能进前端存储。

🔴 **登录后跳转必须过白名单校验**（上游 #4587，2026-07-31 随 D4-a 并入）：
`/login` 与 `/auth/callback` 的 `next` 参数一律经 [core/auth/next-path.ts](../frontend/src/core/auth/next-path.ts) 归一化，
`validateAuthNextPath()` 四条拒绝规则：不以 `/` 开头、以 `//` 开头（协议相对 URL）、
含 `\`、含 `:`。最后一条同时挡掉绝对 URL 与 `javascript:` 伪协议，
**代价是含冒号的合法站内路径也会被拒**，回落到 `DEFAULT_AUTH_NEXT_PATH = "/workspace"`。
Vue 侧迁移时这条不能省 —— 它是 open-redirect 防护，不是 UI 细节；
且该文件是纯 TS、无 React 依赖，属 **Tier 1 逐字节复制**。

## 3.5 聊天页的 thread id 生命周期

这是一个容易踩坑的机制，由 [use-thread-chat.ts](../frontend/src/components/workspace/chats/use-thread-chat.ts) 管理：

1. 路由是 `/workspace/chats/new` 时，前端**本地生成 UUID**（`newThreadIdRef`），
   后端此时还没有这个 thread。
2. `isNewThread=true` 会阻止 SDK 拉 `/history`——SDK 一拿到 thread id 就会
   eagerly fetch history 并假定 thread 已存在（issue #2746）。
3. 首次提交后 `onStart(createdThreadId)` 回调里用
   **`history.replaceState`（原生 History API）而不是 Next router** 改 URL。
   > ⚠️ 用 `router.push/replace` 会导致组件重挂载、丢掉全部流式状态。
   > 这条注释在 `page.tsx:124` 有显式标注，重构时必须保留此行为。
4. 原生 History 改了 URL 但保留路由树，所以 `useParams()` 可能仍返回过期的
   `"new"`——`use-thread-chat.ts` 显式跳过这种情况，避免把 `"new"` 传给
   `useStream` 触发 422。
5. 删除当前 thread 时通过 `window` 自定义事件 `deer-flow:thread-chat-reset`
   （`resetThreadChatAfterDelete`）通知本 hook 重置到新 thread——
   跨组件通信这里用的是 DOM 事件而非 React 状态。

## 3.6 页面级职责归属（不可下沉到组件）

`AGENTS.md` 明确规定了以下逻辑**由页面拥有**，组件只做检测和渲染。重构拆分时
不能把它们搬进 `MessageList`：

| 职责 | 归属页面 |
| --- | --- |
| composer 忙碌态接线 | `chats/[thread_id]/page.tsx` |
| 分支（branch-from-turn）提交与导航 | `chats/[thread_id]/page.tsx`（sidecar 内的 `MessageList` 不接收该 action） |
| 编辑重跑（edit-and-rerun）提交接线 | 主聊天页 + agent 聊天页（页面须保留普通/自定义 agent 的 run context） |
| Workspace Browser 触发器与右面板的 feature gate | `chats/[thread_id]/page.tsx`（读 `/api/features → browser_control.enabled`） |
| 活动 goal 的展示状态 | 主聊天页 + agent 聊天页 |
| human-input 卡片的 answered/latest/pending 判定 | `components/workspace/messages/message-list.tsx`（**这一项归组件**，页面只把回答翻译成 `sendMessage`） |

## 3.7 主聊天页与 agent 聊天页的重复

`chats/[thread_id]/page.tsx`（453 行）与
`agents/[agent_name]/chats/[thread_id]/page.tsx`（426 行）结构近乎平行：
两者都要装配 `ThreadContext` → `SidecarProvider` → `ChatBox` → header/MessageList/InputBox，
都要接线 branch / edit-regenerate / human-input / goal。差异只在 run context 里
是否带 `agent_name`、以及 welcome 区域的内容。

**这是当前前端最大的一处结构性重复**，churn 数据也印证了它们总是成对修改
（52 次 vs 28 次）。详见 [10-refactor-hotspots.md](10-refactor-hotspots.md)。
