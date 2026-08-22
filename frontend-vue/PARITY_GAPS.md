# React / Vue 可平替差异与执行清单

> 状态：当前源码审计后的未完成清单。
>
> 基线日期：2026-08-22。
>
> React 基线：`../frontend`；Vue 实现：当前目录 `frontend-vue`。
>
> 核心目标：两个前端共用同一个 Gateway/API，可以在不改变后台的前提下互相替换。

## 1. 文档用途

本文档只记录两类事项：

1. React 当前已提供、属于应用本体范围，而 Vue 尚未实现或没有完整实现的行为；
2. 两端虽然调用了同一个 API，但 Vue 在请求参数、响应处理、错误、缓存、流式事件、状态或交互上没有与 React 对齐的事项。

本文档同时是后续开发窗口的执行入口。新窗口开始工作时：

1. 先执行 `git status --short`，不得覆盖已有改动；
2. 阅读本文档中准备处理的工作包；
3. 重新检查对应的当前 React/Vue 源码，行号可能变化，本文档不能替代源码；
4. 一次只把一个边界清晰的工作包改为 `IN PROGRESS`；
5. 实现、测试和门禁全部完成后，才可改为 `DONE`，并在“完成证据”中填写提交或测试；
6. 如果 React 后续改变了同一能力，必须重新审核 Vue 的请求、响应和可观察行为。

本文档不是要求复制 React 代码。对齐对象是产品和协议的可观察契约；Vue 必须采用 Vue/Nuxt 生态的主流实现方式。

### 当前文档所有权

- 本文件：未完成差异、优先级、执行顺序、验收和完成证据；
- [`ARCHITECTURE.md`](ARCHITECTURE.md)：长期架构和状态所有权边界；
- [`BEHAVIOR_CONTRACTS.md`](BEHAVIOR_CONTRACTS.md)：已经满足后必须持续保持、以及替换前必须达到的硬行为；
- [`REUSE.md`](REUSE.md)：L1/L2 复用边界，不负责证明 L3 产品完整性；
- [`README.md`](README.md) / [`README_zh.md`](README_zh.md)：运行和门禁入口；
- [`../docs/dual-frontend-production.md`](../docs/dual-frontend-production.md)：双 hostname 部署与回滚，不负责证明产品对齐。

历史 `frontend-vue-build-docs/**`、`frontend-refactor-docs/**` 已从当前仓库删除，它们是迁移
过程材料，不得恢复为当前完成状态依据。若其中仍有有效规则，应以当前源码重新验证后写入
上述现行文档，而不是恢复整份旧计划或旧“parity closure”结论。

## 2. 明确不需要对齐的范围

以下内容不进入本文档的待办，也不能因为“React 有”而重新搬进 Vue：

- React 营销落地页；Vue 的 `/`、`/pricing`、`/about` 可以继续作为公司自定义占位页；
- React 文档站、博客、Nextra 内容和相关依赖；
- `?mock=true`、`public/demo`、Next mock route handlers 等静态录制回放产品模式；
- 没有产品消费者的 `@xyflow/react` canvas 组件；
- Next Route Handler 与 Nuxt/Nitro server route 的框架实现形式；但它们产生的 HTTP 行为必须一致；
- landing 独占或已无消费者的组件和依赖；
- React 与 Vue 图标库、组件库内部 DOM、React Context/hook 的具体写法；
- 不影响布局、键盘、焦点、可访问性、测试选择器或外部集成的内部组件拆分差异。

仍需严格对齐：URL、method、query、headers、body、响应解析、错误信息、缓存失效、SSE/WS 事件、用户状态、页面能力、交互顺序、语义 DOM、键盘和焦点行为、响应式布局。

## 3. Vue 实现原则

- 服务端状态使用 `@tanstack/vue-query` 的 query/mutation/invalidation；不要用 Pinia 手写第二套服务端缓存。
- Pinia 只保存需要跨页面共享的客户端状态，例如工作区 UI；thread/session 等服务端真相只由 Vue Query/composable 持有。
- 组件内生命周期使用 `ref`、`computed`、`watch`、`onScopeDispose`、`provide/inject`；不要照搬 React hook/context 形状。
- 流式协议、文件类型策略、缓存 key、payload 归一化等框架无关规则应保留为纯 TypeScript，并由 Vue composable 调用。
- Dialog、Popover、Select 等优先使用 Reka UI 等 Vue 无障碍 primitives，保持焦点锁定、Escape、aria 和键盘语义。
- DOM 不要求字符级相同，但信息层级、操作入口、顺序、可访问名称、focus order、响应式布局必须产生等价用户结果。
- 不允许为了兼容 Vue 页面而发明后端字段、修改字段含义或维持 React/Vue 两套 API 语义。

## 4. 状态与优先级

状态：

- `TODO`：已确认差异，尚未实施；
- `IN PROGRESS`：当前只有一个窗口负责；
- `BLOCKED`：外部依赖阻塞，并且已记录可复现证据；
- `DONE`：源码、自动化测试和要求的门禁全部完成。

优先级：

- `P0`：安全、数据损坏、认证、核心流式协议或主要功能不可用，阻断 Vue 替换；
- `P1`：主要产品能力、请求/响应语义或状态不一致，替换前必须完成；
- `P2`：非阻断但需要对齐的交互、可访问性、展示或可维护性问题。

## 5. 总清单

| ID          | 优先级 | 状态 | 工作包 | 未对齐点                                                         |
| ----------- | ------ | ---- | ------ | ---------------------------------------------------------------- |
| API-01      | P0     | DONE | WP-01  | Nuxt 代理会拒绝没有请求体和 `Content-Length` 的 DELETE           |
| AUTH-01     | P0     | DONE | WP-01  | OIDC callback 没有验证 session 和执行安全跳转                    |
| AUTH-02     | P0     | DONE | WP-01  | `/workspace` 仍是占位页，没有进入默认聊天页                      |
| AUTH-03     | P1     | DONE | WP-01  | Gateway 不可用被当成未登录，缺少离线/恢复状态                    |
| SEC-01      | P0     | DONE | WP-01  | 实际消息 Markdown 链接没有协议 allowlist                         |
| STREAM-01   | P0     | DONE | WP-02  | Vue 丢弃 task 与 `llm_retry` custom SSE 事件                     |
| STREAM-02   | P0     | DONE | WP-02  | Subtask 没有实时/历史 steps、模型与 token 展示                   |
| THREAD-01   | P1     | DONE | WP-02  | `/compact` 只显示建议，没有调用 compact API                      |
| THREAD-02   | P1     | DONE | WP-02  | prepared replay 丢失后端错误且缓存失效不完整                     |
| THREAD-03   | P0     | DONE | WP-02  | 主线程搜索结果没有过滤 sidecar 线程                              |
| THREAD-04   | P0     | DONE | WP-02  | 删除主线程不级联删除 sidecar 线程                                |
| THREAD-05   | P1     | DONE | WP-02  | 历史记录自动请求所有分页，没有按需加载                           |
| COMPOSER-01 | P1     | DONE | WP-03  | 草稿按 user/agent/thread 隔离，恢复时重新校验 skill              |
| COMPOSER-02 | P1     | DONE | WP-03  | agent 默认模型、能力、mode、reasoning 与线程上下文已归一化       |
| COMPOSER-03 | P1     | DONE | WP-03  | 仅 run accepted 后清理；上传/发送失败保留并复用用户内容          |
| COMPOSER-04 | P1     | DONE | WP-03  | follow-up 显式决策；polish/goal/suggestion 使用 generation guard |
| HIL-01      | P1     | DONE | WP-03  | required/checkbox/pending/error/thread 生命周期已接通            |
| MESSAGE-01  | P1     | DONE | WP-03  | 现代与 legacy 已发送附件均在消息记录中渲染                       |
| MESSAGE-02  | P1     | DONE | WP-03  | feedback create/update/delete、错误回滚与刷新恢复已接通          |
| MESSAGE-03  | P1     | DONE | WP-03  | `thread.values.todos` 已按权威状态渲染                           |
| MESSAGE-04  | P1     | DONE | WP-03  | models/thread token usage、total/per-turn/debug 偏好已消费       |
| MESSAGE-05  | P1     | DONE | WP-03  | user/assistant copy 与 citation source 详情已补齐                |
| SIDECAR-01  | P0     | DONE | WP-04  | 单一 session owner 串行 restore/create，拒绝过期结果回写         |
| SIDECAR-02  | P0     | DONE | WP-04  | sidecar 附件按最终 thread 上传并进入结构化发送请求               |
| SIDECAR-03  | P0     | DONE | WP-04  | sidecar MessageList 已接入真实 thread/error/HIL 提交             |
| BROWSER-01  | P0     | DONE | WP-05  | connecting 阶段丢导航，断线没有有界重连                          |
| BROWSER-02  | P0     | DONE | WP-05  | 缺 REST fallback、live/static 模式和 URL 同步                    |
| BROWSER-03  | P0     | DONE | WP-05  | 点击坐标、滚轮、键盘和 IME 行为未对齐                            |
| ARTIFACT-01 | P0     | DONE | WP-06  | 显式类型/来源策略 fail closed；未知二进制不进入文本加载或 PUT    |
| ARTIFACT-02 | P1     | DONE | WP-06  | 单一 draft owner 统一保护切换、关闭、跨面板、路由与页面离开      |
| ARTIFACT-03 | P1     | DONE | WP-06  | save/discard/exit/copy/open/download/install 与错误/权限已接通   |
| ARTIFACT-04 | P1     | DONE | WP-06  | 正式与流式 HTML 仅在完整、未截断且结构闭合时进入 iframe preview  |
| SCHEDULE-01 | P1     | DONE | WP-07  | once/cron、DST 时区与 fresh/reuse 精确 payload 已接通            |
| SCHEDULE-02 | P1     | DONE | WP-07  | 编辑、确认删除、recipes、类型与六状态筛选已接通                  |
| SCHEDULE-03 | P1     | DONE | WP-07  | 分页 run history、完整详情、轮询与错误收敛已接通                 |
| CHANNEL-01  | P1     | DONE | WP-08  | scoped connections 是状态/多账号唯一真相，provider 只保留能力    |
| CHANNEL-02  | P1     | DONE | WP-08  | URL/instruction/有限 expires poll 与全生命周期 cleanup 已接通    |
| CHANNEL-03  | P1     | DONE | WP-08  | 单 connection 与管理员 provider runtime 删除已明确分流并重读     |
| AGENT-01    | P1     | TODO | WP-09  | 新 Agent 保存不识别 setup_agent 结果和 created 状态              |
| AGENT-02    | P1     | TODO | WP-09  | Agent 设置没有按模型能力归一化请求字段                           |
| AGENT-03    | P2     | TODO | WP-09  | Agent 卡片没有展示 tool groups                                   |
| MEMORY-01   | P1     | TODO | WP-10  | 导入 memory 没有运行时 schema 校验和预览确认                     |
| MEMORY-02   | P1     | TODO | WP-10  | 删除/清空 memory 没有二次确认                                    |
| MEMORY-03   | P1     | TODO | WP-10  | confidence 编辑、校验、搜索和筛选不完整                          |
| SETTINGS-01 | P1     | TODO | WP-10  | Skill/Tool 页面没有消费 admin-required 错误和权限                |
| SHELL-01    | P1     | TODO | WP-11  | 工作区缺 Gateway banner、command palette 和全局 toast            |
| SHELL-02    | P1     | TODO | WP-11  | SettingsDialog 缺 focus trap，关闭后不清理 query                 |
| SHELL-03    | P1     | TODO | WP-11  | 聊天列表缺 share/export/updated time                             |
| CHANGES-01  | P2     | TODO | WP-11  | workspace changes 响应字段和详情错误未完整展示                   |
| I18N-01     | P1     | TODO | WP-12  | 大量核心产品界面仍为英文硬编码                                   |
| THEME-01    | P2     | TODO | WP-12  | system theme 不监听操作系统主题变化                              |

## 6. 详细工作包

### WP-01：API 代理、认证与消息安全

包含：`API-01`、`AUTH-01`、`AUTH-02`、`AUTH-03`、`SEC-01`。

#### 当前代码事实

- Vue [`server/utils/gateway-proxy.ts`](server/utils/gateway-proxy.ts) 现在只在正 `Content-Length` 或 `Transfer-Encoding: chunked` 明确声明 body 时读取请求；无 body DELETE 原样通过，带 body 请求仍受 20 MiB 限制。
- Vue 当前 channels、feedback、memory、scheduled tasks、uploads、agents、sidecar/thread/goal DELETE 调用已由真实 Nitro route 回归测试逐项覆盖，URL/method/body 没有另造语义。
- [`app/pages/auth/callback.vue`](app/pages/auth/callback.vue) 通过共享 Vue Query session 查询验证 cookie session，复用 safe-next 规则，并区分成功、401 和 Gateway unavailable。
- React [`src/app/(auth)/auth/callback/page.tsx`](<../frontend/src/app/(auth)/auth/callback/page.tsx>) 请求 `/api/v1/auth/me`，验证安全 next path，并分别处理成功和失败跳转。
- [`app/pages/workspace/index.vue`](app/pages/workspace/index.vue) 在真实模式直接替换到 `/workspace/chats/new`，不恢复 static demo/mock 分支，与 React 默认入口一致。
- [`app/middleware/auth.global.ts`](app/middleware/auth.global.ts)、callback 和 [`app/components/workspace/GatewayStatusBanner.vue`](app/components/workspace/GatewayStatusBanner.vue) 共用一个 Vue Query key；只有明确 401 才去登录，Gateway 临时不可用时工作区保留可见重试和自动恢复路径。
- 实际聊天的 [`app/components/chat/MessageList.vue`](app/components/chat/MessageList.vue) 将所有 Markdown `<a>`、图片链接和 citation source 链接统一交给 Vue [`MarkdownLink.vue`](app/components/chat/MarkdownLink.vue)，并通过 provide/inject 取得 thread 上下文。
- [`app/core/markdown/links.ts`](app/core/markdown/links.ts) 在 artifact/citation 解析前执行协议 allowlist；相对链接、HTTPS、artifact、citation 和危险协议均由 MessageList 实际 components 路径回归测试覆盖。
- React [`src/components/workspace/messages/markdown-link.tsx`](../frontend/src/components/workspace/messages/markdown-link.tsx) 在普通链接和 citation 之前执行协议 allowlist，并解析 artifact 链接。

#### 必须实现

1. Nitro 代理只在请求确实声明了 body 时读取和限制 body；bodyless DELETE 必须正常转发。
2. 保留现有 body size、path traversal、SSE、cookie/header 安全边界。
3. callback 在客户端检查 session，使用已有 safe-next 逻辑，成功进入安全目标，失败进入明确登录错误。
4. `/workspace` 必须进入默认聊天创建页，不能留下产品占位页。
5. Gateway 不可用与未登录必须是不同状态；恢复后可以重新进入工作区，不需要清 cookie 或重载整个应用。
6. 所有消息 `<a>` 必须经过统一 Vue MarkdownLink 组件：只允许安全协议，支持 artifact/citation，外链具有正确的 `target`/`rel`。

#### Vue 实现建议

- 代理规则保留在 Nitro server util，并提取一个纯函数判断“方法是否允许 body”和“请求是否实际携带 body”。
- auth session 使用 Vue Query/composable 管理，路由中间件只做路由判定，不复制一份 session 状态。
- Markdown link 作为 Vue component 注入 `StreamMarkdown` components map；不要依赖未在实际消息路径启用的 rehype 插件。

#### 验收与测试

- 新增 proxy 测试：无 body DELETE、带 body DELETE、超限 body、chunked、SSE、traversal。
- 新增真实 Nuxt route 测试，证明 disconnect/delete 请求不返回 411。
- callback 测试覆盖成功、安全 next、外域 next、401、Gateway 失败。
- `/workspace` 路由测试覆盖默认跳转。
- MessageList DOM 测试覆盖 `javascript:`、`data:`、相对链接、https、artifact 和 citation。

### WP-02：流式事件、线程状态与历史

包含：`STREAM-01`、`STREAM-02`、`THREAD-01`～`THREAD-05`。

#### 当前实现事实

- [`app/core/tasks/custom-event.ts`](app/core/tasks/custom-event.ts) 是 task 生命周期、`task_running` steps、`llm_retry` 与 replay-gap 的单一 reducer；[`useThreadStream.ts`](app/composables/useThreadStream.ts) 负责 thread/scope 生命周期清理。
- [`SubtaskCard.vue`](app/components/chat/SubtaskCard.vue) 合并实时 state、终态 ToolMessage 与展开时的历史 `subagent.step` backfill，展示模型、累计 token、步骤、结果和可重试错误。
- [`ChatComposer.vue`](app/components/chat/ChatComposer.vue) 对已建立会话执行真实 `/compact`；在途 guard、AbortController、成功清草稿、4xx/409 保留输入与六类缓存失效均已接通。
- prepared replay 使用统一 [`api/errors.ts`](app/core/api/errors.ts) 保留 status/body/detail，并以 generation + abort 阻止旧 prepare/stream 写回新路由；所有退出路径收敛 guard、掩码和乐观态。
- [`useThreads.ts`](app/composables/useThreads.ts) 是 thread 列表唯一 server-state 所有者，复用 raw-offset sidecar 过滤 helper；旧 Pinia thread store 已删除。
- [`threads/delete.ts`](app/core/threads/delete.ts) 全量搜索 parent sidecar、并发删除后再删主 thread；部分失败保留主 thread、清除已成功项缓存并向侧栏暴露重试。
- [`useThreadHistory.ts`](app/composables/useThreadHistory.ts) 初次只请求最新一页，MessageList 按显式按钮或用户向上交互后的 sentinel 加载下一页并保持滚动锚点。

#### 必须实现

1. custom event 统一进入 task/retry/replay reducer；事件去重、顺序和终态规则必须与 React 相同。
2. Subtask 卡片同时支持实时 steps 和刷新后的历史 steps，不因页面刷新丢失时间线。
3. `/compact` 必须调用 compact API，显示 pending/success/error，并刷新当前 thread、history、search、token usage。
4. prepared replay 使用统一 response error parser，并执行完整 cache invalidation。
5. 所有主聊天列表/搜索必须排除 sidecar；分页 offset 必须按原始结果推进，不能因过滤重复请求。
6. 删除主线程时级联删除其 sidecar，部分失败要有可重试错误状态。
7. 历史默认按需分页，支持 sentinel 和显式“加载更多”，不能自动拉取整个线程。

#### Vue 实现建议

- 建立 `useThreadSession(threadId)`，用 `shallowRef`/纯 reducer 保存流状态，并通过 `onScopeDispose` 取消请求。
- Vue Query 维护 thread、history、tasks、token usage 的服务端状态；集中定义 query keys 和 invalidation helper。
- `SubtaskCard.vue` 独立于 MessageList，接受归一化 view model，不在模板中重新解释 wire event。

#### 验收与测试

- 使用与 React 相同的 task/retry/gap fixture 做 reducer 和 DOM 测试。
- E2E 覆盖实时 subtask、刷新后恢复、retry、终态和错误态。
- `/compact` 覆盖成功、409/4xx 错误文本、重复点击和 cache refresh。
- 搜索 fixture 同时返回主线程和 sidecar，断言 UI 只显示主线程且 raw offset 正确。
- 删除测试证明主线程和全部 sidecar 都被删除。
- 100+ 页历史 fixture 证明初次只请求第一页，滚动/按钮才请求下一页。

### WP-03：Composer、Human Input 与消息输出

包含：`COMPOSER-01`～`COMPOSER-04`、`HIL-01`、`MESSAGE-01`～`MESSAGE-05`。

#### 当前代码事实

- [`useComposerDraft.ts`](app/composables/useComposerDraft.ts) 以真实 user + agent/lead-agent + 真实 thread 或稳定 `new` scope 持有 tab 草稿；skill catalog ready 后才恢复并降级已禁用 skill。成功登出和确认删除 thread 会按作用域清理草稿。
- [`ChatComposer.vue`](app/components/chat/ChatComposer.vue) 把 text、skill、files 与上传结果保留到 Gateway run handle 到达；创建失败、4xx、取消、路由切换继续可重试，成功上传文件不会重复上传，重复提交由单一 in-flight guard 丢弃。
- [`useModels.ts`](app/composables/useModels.ts)、[`models/capabilities.ts`](app/core/models/capabilities.ts) 与 [`useThreadSettings.ts`](app/composables/useThreadSettings.ts) 共同解析 agent 默认模型、thinking/mode/reasoning 能力与 thread/agent-scoped context；不支持的字段不进入最终 payload。
- follow-up 在非空草稿上显式提供 append-and-send、replace-and-send、cancel；[`async/generation.ts`](app/core/async/generation.ts) 统一阻止 polish、goal 与 post-run suggestion 在 stop、unmount 或 route/thread 变化后写回。
- [`HumanInputCard.vue`](app/components/chat/HumanInputCard.vue) 对 required checkbox=false、select/multi-select 与文本字段统一校验并暴露 aria-invalid；MessageList 在失败、thread error、路由切换与终态收敛 pending HIL。
- [`MessageAttachments.vue`](app/components/chat/MessageAttachments.vue) 从持久化消息读取现代 files 与 legacy upload tag；刷新后不依赖 composer 本地状态。
- MessageList 已接入 feedback create/update/delete、失败回滚、复制 user/assistant 消息与 citation source 详情；反馈随 history 行恢复。
- AgentChat 渲染权威 `thread.values.todos`；[`useThreadTokenUsage.ts`](app/composables/useThreadTokenUsage.ts) 对响应 `thread_id` 二次校验，header total、per-turn/debug 与 off 偏好由统一 usage model 驱动。

#### 必须实现

1. 草稿按真实 user + thread/agent 隔离；登出、切用户、删除线程时不得泄漏。
2. 草稿恢复必须验证 skill 当前存在且启用。
3. 模型选择遵守 agent 默认值和模型 capabilities；不支持的 thinking/reasoning 字段必须归一化为 `null` 或不发送，与 React 请求一致。
4. context overrides 是 thread-scoped；切线程、切 agent、创建新聊天时按 React 规则恢复或重置。
5. 只有发送被后台接受后才清空草稿；上传/发送失败必须恢复文本、skill 和仍可复用的文件。
6. follow-up 在已有草稿时提供 append/replace/cancel，不得静默覆盖。
7. polish、goal、follow-up 在 unmount、route change、thread change、用户 stop 后不能写回旧页面。
8. HIL 的 required、checkbox、提交中、失败、thread error、刷新恢复规则与 React 一致。
9. 人类消息渲染现代 files 字段和兼容的 legacy upload 内容。
10. AI 消息提供 feedback、copy、citation source 等等价操作。
11. 渲染 todos，并消费 models/thread token usage；尊重用户的 token 展示偏好。

#### Vue 实现建议

- 从 ChatComposer 拆出 `useComposerDraft`、`useModelCapabilities`、`useComposerCommands`、`useComposerSubmission`。
- 用递增 generation/token 或 effect scope 防止过期异步任务写回；销毁时统一 abort。
- MessageList 拆成 `HumanMessage`、`AssistantMessage`、`MessageAttachments`、`MessageActions`、`TodoList`、`HumanInputCard`。
- feedback 和 token usage 使用 Vue Query mutation/query，成功后精确更新或失效对应 key。

#### 验收与测试

- 两个用户、两个线程、agent/non-agent 的 draft 隔离测试。
- capability payload 参数快照必须与 React 语义一致。
- 上传 4xx、发送 4xx、取消、路由切换时输入不丢失且无过期写回。
- human message 的 image/file/legacy upload DOM 测试。
- feedback create/update/delete 与后端错误回滚测试。
- todo、token total、per-turn、隐藏偏好测试。
- 本工作包实测：`make e2e-m4a` 4/4、`make e2e-m4a-stream` 6/6、`make e2e-m7` 130/130、`make e2e-m7-local` 8/8、`make e2e-m7-auth` 10/10、`make e2e-m7-real-protocol` 1/1、`make e2e-m7-visual` 7/7；视觉 baseline 未更新。
- `make migration-check` 通过；沙箱外 `make verify` 为 132 个 test files / 1203 tests 全绿并完成 Nuxt 生产构建。React `pnpm check` 通过，沙箱外 `pnpm test` 为 128 个 test files / 1001 tests 全绿。

### WP-04：Sidecar 完整会话

包含：`SIDECAR-01`～`SIDECAR-03`。

#### 当前代码事实

- [`app/composables/useSidecarSession.ts`](app/composables/useSidecarSession.ts) 是每个 `AgentChat` 唯一的 sidecar session owner：恢复完成且确认不存在后才创建，并在 main thread/context/scope 变化时拒绝旧结果回写。
- 主 composer 与 sidecar 共用 [`app/core/uploads/submission-files.ts`](app/core/uploads/submission-files.ts)，附件上传到最终 sidecar thread，完整成功的同一 `File` 可在 run 失败后复用。
- [`app/components/workspace/sidecar/SidecarPanel.vue`](app/components/workspace/sidecar/SidecarPanel.vue) 只渲染 session，并把真实 thread、stream error 与 HIL callback 传给共享 MessageList/HumanInputCard。
- session 位于面板组件之外；关闭或切换右侧面板不会销毁流，真实删除才清空 thread、草稿、附件与上传缓存。
- React [`src/components/workspace/sidecar/sidecar-panel.tsx`](../frontend/src/components/workspace/sidecar/sidecar-panel.tsx) 先 restore，再决定是否 create，并把附件/HIL 接入 sidecar run。

#### 必须实现

1. sidecar 初始化具有单一状态机：idle → restoring → ready/creating → ready/error。
2. 同一个 main thread + context 只允许一个有效 sidecar create 请求。
3. selected files 按与主 Composer 相同的验证、上传、payload 和失败恢复规则发送。
4. sidecar 可回答 HIL，pending/error/刷新恢复规则与主聊天一致。
5. 关闭/重开面板不能丢失正在执行的 sidecar run。

#### Vue 实现建议

- 用 `useSidecarSession(mainThreadId)` 统一 restore/create/run/files/HIL；组件不直接拼线程生命周期。
- restore/create 使用共享 Promise 或 mutation mutex 防重复。
- 主聊天和 sidecar 复用框架无关的 file payload 与 HIL validator，不复制业务规则。

#### 验收与测试

- WP-04 新增 4 个测试文件 / 17 个用例，覆盖延迟 restore 并发、create 去重、最终 sidecar thread 附件上传、失败重试复用、草稿/附件隔离、IME、关闭重开不中断 run，以及 HIL required/false-checkbox/pending/error/刷新恢复。
- React 共享 sidecar Playwright 7/7，抓包断言结构化附件目标为最终 sidecar thread，并覆盖活动 run 关闭/重开与 HIL 请求/响应。
- 浏览器门禁实测：`make e2e-m4a` 4/4、`make e2e-m4a-stream` 6/6、`make e2e-m7` 130/130、`make e2e-m7-local` 8/8、`make e2e-m7-auth` 10/10、`make e2e-m7-real-protocol` 1/1、`make e2e-m7-visual` 7/7；视觉 baseline 未更新。
- `make migration-check` 通过；沙箱外 `make verify` 为 136 个 test files / 1220 tests 全绿并完成 Nuxt 生产构建。React `pnpm check` 通过，`pnpm test` 为 128 个 test files / 1001 tests 全绿。

### WP-05：Browser control

包含：`BROWSER-01`～`BROWSER-03`。

#### 当前代码事实

- Gateway 的真实 HTTP 合同是 `POST /api/threads/{thread_id}/browser/navigate`，请求只含 `{ url }`，响应是 `{ screenshot, url, title }`；WS 合同是同线程 `/browser/stream?frame_format=binary&seed=...`。后端没有 `live` / `static` mode 字段，前端不得伪造。
- [`app/core/browser/connection.ts`](app/core/browser/connection.ts) 是 WS、最后一次 pending navigate、6 次指数退避、stale generation 和 terminal fallback 交接的唯一 owner；[`useBrowserStream.ts`](app/components/workspace/browser-view/useBrowserStream.ts) 只把它适配成 Vue refs 和末帧 buffer。
- 切换 thread 会回收 frame/object URL 并使旧 socket 事件失效；关闭 Live 只停 transport，保留末帧供 Static 展示；关闭面板、feature 禁用或 scope dispose 会停止 timer/socket/REST。
- [`BrowserPanel.vue`](app/components/workspace/browser-view/BrowserPanel.vue) 以本地 `requestedLive` + 实际连接状态推导 Live/Connecting/Reconnecting/Static，REST 使用 Vue Query mutation。WS 不可用且有 pending navigate 时只交接一次 REST，不重复发送已接受导航。
- 当前 URL/title 只从 Gateway `url`/`tabs` 事件或 REST 响应收敛；REST 4xx/5xx 保留同一目标并提供可见重试，不使用任意时长 spinner 假装完成。
- [`AgentChat.vue`](app/components/chat/AgentChat.vue) 只从当前线程 ToolMessage 的 `additional_kwargs.browser_view` 恢复最新静态帧；新截图自动打开，已观察的旧消息帧不会覆盖新的 REST 权威截图，route `:key`、feature watch 和 panel close 保证旧 owner 销毁。
- pointer 几何由 [`geometry.ts`](app/core/browser/geometry.ts) 按 object-contain 内容盒计算；letterbox 外 click/move 不发送，move/wheel 逐动画帧合并。键盘只在 keydown 发送，URL 输入、IME 组合阶段和宿主快捷键留在本地，compositionend 以 `text` 发送一次。
- React 基线仍位于 [`use-browser-stream.ts`](../frontend/src/components/workspace/browser-view/use-browser-stream.ts) 和 [`browser-view-panel.tsx`](../frontend/src/components/workspace/browser-view/browser-view-panel.tsx)；WP-05 对齐其有效产品语义，但没有复制任意 spinner、失效 blob fallback 或会吞宿主快捷键的实现细节。

#### 必须实现

1. connecting 时保留最后一次导航 intent，连接成功后发送。
2. close/error 使用有上限的指数退避；切线程、关闭面板和组件销毁必须停止重连。
3. WS 不可用时使用同一后台 REST navigate API；错误状态可重试。
4. live/static 模式、当前 URL、页面 title/状态按后端事件收敛。
5. click/move 坐标映射到实际图像内容区域，忽略 letterbox 外点击。
6. wheel、keyboard、组合输入、浏览器快捷键阻止规则与 React 一致。

#### Vue 实现建议

- 已按该边界实现：纯连接状态机、geometry、keyboard、frame/protocol 位于 `app/core/browser/`；composable 和组件只负责 Vue 生命周期与展示接线。
- Browser REST 保持 L3 DeerFlow endpoint，使用生成的 `BrowserNavigateResponse` 类型和统一 Gateway error 解析，不进入 L1/L2。
- Vue 运行时没有引入 React 组件、hook/context、DOM shim 或双 API 兼容分支。

#### 验收与测试

- Vue unit/DOM：`tests/unit/wp05/` 共 7 个文件 / 24 个用例，覆盖 connecting pending、退避上限、seed 归一化、stale thread、二进制/legacy frame、消息帧/REST 所有权、REST 错误、live/static、竖屏 letterbox、move/wheel、keyboard/IME 与 cleanup。
- Vue-owned Playwright：`tests/m6/browser-control.spec.ts` 3 个用例，覆盖 ToolMessage 静态帧自动打开、Gateway URL/title 收敛、输入 wire、Static REST 失败和同目标重试；该层使用 Mock Gateway/Mock WS，不冒充真实后端。
- Real-Gateway：`tests/m6-real-backend/browser-panel.spec.ts` 使用本地真实 FastAPI Gateway 与真实 Playwright Chromium browser runtime 验证 REST 响应、二进制 WS 帧和 Vue UI 收敛；Gateway harness 的模型侧是 replay，不冒充生产模型/环境。
- 聚焦 TDD：7 个 Vue unit/DOM 文件、24/24 用例通过；新增 Vue-owned Playwright 3/3 通过。
- 最终顺序门禁（2026-08-22）全部通过：`make e2e-m6-list` 9 files / 33 tests；`make e2e-m6` 33/33；`make e2e-m6-real-backend` 1/1；`make e2e-m4a` 4/4；`make e2e-m4a-stream` 6/6；`make e2e-m7` 26 files / 133/133；`make e2e-m7-local` 8/8；`make e2e-m7-auth` 10/10；`make e2e-m7-real-protocol` 1/1；`make e2e-m7-visual` 7/7（baseline 未更新）；`make migration-check` 通过；`make verify` 143 test files / 1244 tests、类型/格式/collection/i18n/OpenAPI/header/production build 全部通过。
- 首次聚焦 Playwright 和首次完整 Vitest 在受限 sandbox 分别命中 `listen EPERM`；均未改代码/命令语义，在允许 `127.0.0.1` 回环监听后原样通过。`make verify` 仍报告仓库既有 lint warnings，但 0 errors。

### WP-06：Artifacts 文件策略与编辑生命周期

包含：`ARTIFACT-01`～`ARTIFACT-04`。

#### 当前代码事实

- [`app/core/artifacts/policy.ts`](app/core/artifacts/policy.ts) 以扩展名与来源显式区分 text/code、browser media、PDF、skill archive 和 download-only；未知、无扩展名、SVG、Office、archive 与其他二进制 fail closed，MIME 不提升能力。
- 正式文本仍使用 Gateway GET Range，默认上限 1 MiB；只有显式加载完整、未截断且取得内容 SHA-256 后，`/mnt/user-data/outputs` 下的正式 UTF-8 文件才进入 editor/PUT。瞬态 write-file 草稿和 skill artifact 不冒充正式可写文件。
- [`app/composables/useArtifactDraft.ts`](app/composables/useArtifactDraft.ts) 是 baseline/remote/draft/dirty/conflict/edit 的唯一 owner；切文件、关面板、切 sidecar/browser、切 thread、路由离开与仅 dirty 时的 `beforeunload` 都走同一确认合同。
- 保存发送精确 `expected_sha256`；成功以 Gateway 返回的 SHA/size 更新 baseline，远程刷新和 412 都保留本地草稿。403/404/409/412/413/415 与 install 权限错误保持可见，discard/exit edit 可预测。
- [`app/core/artifacts/preview-policy.ts`](app/core/artifacts/preview-policy.ts) 要求正式 HTML 完整、未截断且文档有序配对；仍在组装的 write-file 只允许安全前缀，工具返回 `OK` 后同样必须完整才进入 iframe。
- [`ArtifactFileList.vue`](app/components/workspace/artifacts/ArtifactFileList.vue)、[`ArtifactEditor.vue`](app/components/workspace/artifacts/ArtifactEditor.vue)、[`ArtifactPreview.vue`](app/components/workspace/artifacts/ArtifactPreview.vue) 和 [`ArtifactActions.vue`](app/components/workspace/artifacts/ArtifactActions.vue) 分离列表、编辑、预览与操作；面板根只编排当前路径的 abort/generation 和 I/O。自动历史打开不会覆盖用户或持久化选择。
- copy/open/download/install-skill 由策略显式控制；open/download 先执行认证 GET 一字节 Range 预检，精确接受空文件 `416 + Content-Range: bytes */0`，其他 Gateway 错误不伪装成功；install 只对真实 skill artifact + admin 开放。

#### 已实现

1. 显式文件策略覆盖 text/code、safe preview、browser media、PDF、skill archive 与 download-only；未知类型默认 download-only。
2. doc/docx/xls/xlsx/ppt/pptx/zip/无扩展名/未知二进制不会经过文本 loader 或文本 PUT。
3. dirty 状态在切文件、关闭 panel、跨 sidecar/browser/thread、关闭页面和路由离开时使用同一确认合同。
4. 保存成功/失败、远程刷新、412 conflict、discard 与 exit edit 的 draft 状态由纯 reducer 固化并覆盖测试。
5. copy/open/download/install-skill 均由分类与权限矩阵控制，预检和 Gateway 错误保持可见。
6. truncated 或结构不完整的 HTML 不会进入 iframe preview；流式 write-file 仅在满足 D3 完整性后预览。

#### Vue 实现落点

- 文件策略为纯 TypeScript `classifyArtifact(path, metadata)`，组件只消费分类结果。
- 拆分 `ArtifactFileList`、`ArtifactEditor`、`ArtifactPreview`、`ArtifactActions` 和 `useArtifactDraft`。
- 使用 Vue Router leave guard + `beforeunload`，只在 dirty 时注册。

#### 验收与测试

- `tests/unit/wp06/` 共 7 个文件 / 58 个用例，覆盖文本、代码、图片、音频、视频、PDF、SVG、Office、archive、无扩展名、未知二进制、来源与权限矩阵；未知/二进制不进入 loader/PUT。
- unit/DOM 覆盖 dirty switch/close/sidecar/browser/thread/route/beforeunload、save success、403/404/409/412/413/415、远程刷新、discard/exit、run guard、stale load/save/action 和 text→write transition。
- Vue-owned M5 新增 download-only、完整 D3 HTML、dirty switch/close 浏览器合同；清单为 6 files / 29 tests。正式截断 HTML 不创建 iframe/editor，并提供显式加载完整文件。
- `tests/m5-real-backend/artifact-write.spec.ts` 使用同一真实本地 FastAPI Gateway、Nuxt 与 Playwright Chromium 验证 206 Range/ETag、真实 PUT SHA/size、并发修改后的真实 412 与草稿保留、Office/archive/unknown 零文本 GET，以及 1.1 MiB HTML 截断边界。模型侧使用 replay，不等于生产模型、DNS/TLS、外层代理或真实 IdP 证明。
- 最终顺序门禁（2026-08-22）全部通过：聚焦 WP-06 unit/DOM 7 files / 58 tests；`make e2e-m5-list` 6 files / 29 tests；`make e2e-m5` 29/29；`make e2e-m5-real-backend` 1/1；`make e2e-m4a` 4/4；`make e2e-m4a-stream` 6/6；`make e2e-m7-list` 26 files / 135 tests；`make e2e-m7` 135/135；`make e2e-m7-local` 8/8；`make e2e-m7-auth` 10/10；`make e2e-m7-real-protocol` 1/1；`make e2e-m7-visual` 7/7（baseline 未更新）；`make migration-check` 通过；`make verify` 150 test files / 1303 tests、landed 59 files / 561 tests、2 locales / 各 764 keys、205 file headers、类型/格式/OpenAPI/production build 全部通过。

### WP-07：Scheduled tasks

包含：`SCHEDULE-01`～`SCHEDULE-03`。

#### 当前代码事实

- Gateway 当前只接受 `schedule_type=once|cron`；create body 为 context、title、prompt、
  schedule type/spec 和 timezone。PATCH 只允许 context、thread、title、prompt、spec、timezone，
  不允许修改 schedule type；enabled/paused 只通过 pause/resume endpoint 改变。客户端不提交
  `context.non_interactive`。
- [`app/core/scheduled-tasks/form.ts`](app/core/scheduled-tasks/form.ts) 是表单与 wire payload 的
  唯一 owner：支持 hourly/daily/weekly/monthly/custom cron、浏览器默认但可编辑的 IANA
  timezone、DST-safe once wall time → UTC，以及 fresh/reuse thread 规则。编辑保持原 schedule
  type，recipes 只回填同一表单并保留 `{{repo}}` 等占位符。
- [`app/composables/useScheduledTasks.ts`](app/composables/useScheduledTasks.ts) 与
  [`app/core/scheduled-tasks/query-keys.ts`](app/core/scheduled-tasks/query-keys.ts) 独占全局列表、
  thread 列表、detail、分页 runs 和 mutation invalidation。queryFn 从自己的 key 取 task/thread，
  AbortSignal 与 observer scope 负责取消；只有看到 queued/running run 才轮询。
- 页面只编排 route 默认值、筛选与 selection；Form、Filters、List、Detail、RunList 分工。类型
  筛选覆盖 once/cron，状态筛选覆盖 enabled/paused/running/completed/failed/cancelled；删除后二次
  确认，筛选或删除使 selection 不可见时确定性回到首项/空值。
- run history 使用 `limit/offset` 与显式加载更多，展示 trigger、六种 run status、scheduled/
  started/finished time、thread/run ID 与 error。running 和 mutation pending 状态禁用冲突/重复
  操作；403/404/409/422/502 保留 Gateway detail，401 遵循共享 fetcher 的登录跳转合同。

#### 验收与测试

- 严格 TDD 红灯起步：新增 `tests/unit/wp07/` 后首先因 form/query-key/view-model/composable/API
  缺失而 5 files 全部失败；最终聚焦 unit/DOM 为 5 files / 33 tests，覆盖精确 payload、cron
  presets、browser timezone、DST gap/fold、fresh/reuse、PATCH 禁止字段、全部错误码、query
  invalidation、stale task/runs 与 observer dispose。
- Vue-owned [`tests/m7/scheduled-tasks.spec.ts`](tests/m7/scheduled-tasks.spec.ts) 为 9 tests：
  create/edit/pause/resume/trigger/delete、recipe、once/DST、六 task 状态、两种类型、running
  lock、错误展示/401 跳转、runs 50+5 分页和详细字段；完整 M7 清单为 26 files / 138 tests。
- `make e2e-wp07-real-backend` 为 2/2：真实 FastAPI Gateway、SQLite repository/service、HTTP、
  Nuxt preview 与 Chromium 验证真实 once/cron create、Gateway 归一化与 422、context/thread
  权限、PATCH、pause/resume、trigger、runs 详细字段与 delete。手动 trigger 使用签入 replay
  model，真实 run 最终按 artifact delivery 策略收敛为 failed，Vue 和 HTTP 均保留同一终态与
  error；认证由 `DEER_FLOW_AUTH_DISABLED=1` 隔离。
- 该 real-backend gate 不等于生产 scheduler 的真实时间推进、生产模型、真实 IdP、DNS/TLS
  或外层代理证据；这些边界仍由目标环境负责。

#### 最终顺序门禁

- 2026-08-22 全部通过：WP-07 unit/DOM 5 files / 33 tests；`make e2e-m7-list`
  26 files / 138 tests；`make e2e-m7` 138/138；`make e2e-wp07-real-backend` 2/2；
  `make e2e-m4a` 4/4；`make e2e-m4a-stream` 6/6；`make e2e-m7-local` 8/8；
  `make e2e-m7-auth` 10/10；`make e2e-m7-real-protocol` 1/1；`make e2e-m7-visual`
  7/7（baseline 未更新）；`make migration-check` 通过（58 个生成测试、20 个 RETYPED）；
  `make verify` 155 test files / 1337 tests、landed 59 files / 561 tests、2 locales / 各
  788 keys、216 file headers、类型/格式/OpenAPI/production build 全部通过。
- `make verify` 有 59 个 lint warning、0 error；生产构建另有既有 chunk-size、Tailwind
  sourcemap 与 unused external import warning。沙箱内首轮完整 Vitest 因
  `listen EPERM 127.0.0.1` 令 12 个 fake-upstream 用例超时，完全相同命令在允许回环监听的
  环境原样重跑后 1337/1337 通过。

### WP-08：Channels 连接生命周期

包含：`CHANNEL-01`～`CHANNEL-03`。

#### 当前代码事实

- [`app/composables/useChannelConnections.ts`](app/composables/useChannelConnections.ts) 是按认证
  user scope 隔离的 providers/connections Vue Query、四类 mutation、poll 与 cleanup 唯一 owner；
  旧模块级 `useChannels` ref 缓存已删除，Pinia 没有复制 server state。
- [`app/core/channels/state.ts`](app/core/channels/state.ts) 只从 connections 响应推导用户状态和
  多账号列表；provider 的 `connection_status` 即使冲突也不会覆盖它。
- connect 同时消费 `url`、`instruction`、`expires_in`。poll 有有限 deadline、expired 状态和
  AbortSignal；cancel/unmount/scope switch 都清理，旧 scope 只能写旧 key。新增账号还会忽略
  发起绑定前已 connected 的 ID，避免旧账号让新绑定误判成功。
- Settings 按稳定 connection ID 展示并断开单个账号；管理员 provider runtime 删除单独标识、
  二次确认，并按 Gateway 语义撤销实例级 provider 配置。两类成功都重读 providers/connections。
- Gateway 实际合同为 `GET /providers`、`GET /connections`、`POST /{provider}/connect`、
  `DELETE /connections/{connection_id}` 与管理员 `DELETE /{provider}/runtime-config`。真实响应的
  400/401/403/404/429 detail 由共享 fetch/error 边界保留。

#### 必须实现

1. provider 能力和用户 connection 实例分离；连接状态以 connections 响应为准。
2. connect 响应存在 `url` 时安全打开/跳转；instruction 作为补充，不得代替 URL。
3. 按 `expires_in` 有界轮询，成功、过期、取消、卸载都停止。
4. 支持断开单个 connection/provider，成功后重新读取真实状态。
5. 多账号、多 connection provider 的 DOM 和操作目标明确。

#### Vue 实现建议

- `useChannelConnections` 使用 Vue Query + effect scope 管理 poll timer。
- 复用已有 provider-state、connect-poll、open-connect-url 纯函数。

#### 验收与测试

- 严格 TDD 红灯起步：新增测试首先因 `query-keys`、`state`、`useChannelConnections` 缺失，且
  旧 poll 没有 AbortSignal、expired callback、有限上界而失败；最终 WP-08 unit/DOM 为
  4 files / 21 tests，连同既有 channels/guard 聚焦门禁为 9 files / 55 tests。
- Vue-owned M7 channels 为 11 tests：覆盖 provider/connection 冲突、URL popup、instruction-only、
  多账号、有限过期、导航 dispose、pending/race、单 connection/provider 删除、429 与 401；完整
  M7 清单更新为 26 files / 144 tests。
- `make e2e-wp08-real-backend` 为 3/3：真实 FastAPI Auth/CSRF/channel router/SQLite repository、
  connect code/deep-link response、用户隔离、多账号收敛、精确 DELETE、provider runtime revoke 与
  400/401/403/404/429。只有外部 Slack/Telegram worker 与 callback 使用签入的受控 fixture；不
  证明真实 IM 平台授权、生产凭据、deep-link handler、DNS/TLS、外层代理或真实 IdP。

### WP-09：Agents 创建与设置

包含：`AGENT-01`～`AGENT-03`。

#### 当前代码事实

- [`app/components/chat/AgentChat.vue`](app/components/chat/AgentChat.vue) 的 Save 发送普通可见消息，之后只做一次 getAgent，没有识别 setup_agent tool result、重试和 created UI。
- React [`src/app/workspace/agents/new/page.tsx`](../frontend/src/app/workspace/agents/new/page.tsx) 在 run finish 后检查 setup_agent，有限重试读取 agent，并进入 created 状态。
- [`app/pages/workspace/agents/index.vue`](app/pages/workspace/agents/index.vue) 使用自由文本模型字段，并直接提交 thinking/reasoning。
- React [`src/components/workspace/agents/agent-settings-dialog.tsx`](../frontend/src/components/workspace/agents/agent-settings-dialog.tsx) 按模型 capabilities 将不支持字段归一化。
- Vue agent 卡片只展示 model/skills，不展示 tool groups。

#### 必须实现

1. Save 使用与 React 等价但不污染聊天记录的保存指令。
2. run finish 检测 setup_agent 结果；有限重试 getAgent；成功进入 created 状态并提供导航。
3. 重复点击、失败重试和刷新不能创建多个 Agent。
4. Agent 设置使用后台模型列表和 capabilities；payload 空值与 React 一致。
5. 卡片展示 tool groups 和 skills，feature disabled/permission/error 状态清楚。

#### Vue 实现建议

- 抽出 `useAgentCreationSession` 管理 idle/saving/verifying/created/error。
- 设置表单用 schema/computed 根据 selected model capabilities 动态启用字段。

#### 验收与测试

- setup_agent 成功、延迟可见、永久失败、重复 save 测试。
- 每类模型 capability 的 update payload contract 测试。
- card tool groups/skills DOM 测试。

### WP-10：Memory、Skill 与 Tool 设置

包含：`MEMORY-01`～`MEMORY-03`、`SETTINGS-01`。

#### 当前代码事实

- [`app/components/workspace/settings/MemorySettings.vue`](app/components/workspace/settings/MemorySettings.vue) 将 JSON 直接断言为 UserMemory 并立即导入。
- delete/clear 没有确认；新增 confidence 固定为 `0.8`，缺完整编辑和校验。
- React [`src/components/workspace/settings/memory-settings-page.tsx`](../frontend/src/components/workspace/settings/memory-settings-page.tsx) 有运行时验证、导入预览确认、删除/清空确认、confidence 和搜索筛选。
- Vue Skill/Tool 页面捕获通用错误，没有消费 API 层已定义的 admin-required 错误/角色语义。

#### 必须实现

1. 导入前做运行时 schema 校验，展示合法/非法项和确认，不得直接信任 TypeScript assertion。
2. 删除单项、清空全部、覆盖导入必须二次确认。
3. confidence 的范围、步进、错误与后台合同一致；支持编辑、搜索、筛选。
4. Skill/Tool 对 admin-required、只读用户、请求失败使用不同状态；无权限时禁用 mutation。

#### Vue 实现建议

- 使用 schema validator 或显式 type guard；解析和验证保持纯函数。
- destructive dialog 使用统一 Vue dialog primitive。
- permissions 从 session/query 派生，不在每个设置组件重复猜测。

#### 验收与测试

- malformed/partial/extra-field/重复 memory import 测试。
- 所有 destructive action 的 cancel/confirm/request failure 测试。
- non-admin/admin 的 skill/tool DOM 和“不得发送 mutation”测试。

### WP-11：Workspace shell、导航和 changes

包含：`SHELL-01`～`SHELL-03`、`CHANGES-01`。

#### 当前代码事实

- [`app/layouts/workspace.vue`](app/layouts/workspace.vue) 只挂载 sidebar、main 和 settings。
- React [`src/app/workspace/workspace-content.tsx`](../frontend/src/app/workspace/workspace-content.tsx) 还挂载 Gateway unavailable banner、command palette、settings deep-link 和 toaster。
- Vue SettingsDialog 只处理 overlay/Escape，没有 focus trap；关闭后保留 settings query。
- [`app/components/workspace/ThreadSidebar.vue`](app/components/workspace/ThreadSidebar.vue) 菜单只有 rename/pin/delete。
- [`app/core/threads/export.ts`](app/core/threads/export.ts) 的导出函数没有消费者；聊天列表也缺 updated time。
- [`app/components/workspace/changes/WorkspaceChangesBadge.vue`](app/components/workspace/changes/WorkspaceChangesBadge.vue) 没有完整显示 `truncated`、file status、`diff_unavailable_reason`，详情加载没有明确 catch/error UI。

#### 必须实现

1. 工作区提供 Gateway unavailable/恢复、全局 toast 和 React 当前快捷操作的等价 command palette。
2. 快捷键不与输入框、IME、浏览器快捷键冲突。
3. SettingsDialog 具有 focus trap、初始焦点、焦点归还、Escape、aria；关闭清理 query，浏览器前进/后退可恢复深链。
4. sidebar/chat list 提供 share/export，并显示 updated time；请求、剪贴板和下载错误可见。
5. changes 展示 summary truncated、每个 file status、无法 diff 的具体原因以及 detail error/retry。

#### Vue 实现建议

- Workspace providers 用 layout-level composables/provide，不需要复制 React Provider 树。
- Dialog/command palette 使用 Vue 无障碍 primitive。
- export 调用已有纯函数；菜单状态和网络状态留在独立 action component。

#### 验收与测试

- Gateway 断开/恢复、toast、Meta/Ctrl-K、Shift-N 等快捷键测试。
- Settings focus cycle、Escape、焦点归还、query/back-forward 测试。
- share/export/updated_at 测试。
- changes 的 truncated、binary、large、sensitive、symlink、error/retry fixture 测试。

### WP-12：国际化与主题

包含：`I18N-01`、`THEME-01`。

#### 当前代码事实

- 当前 Vue 产品 `.vue` 文件中只有少数组件显式接入 i18n；聊天消息、Agent、channels、browser、artifacts、sidecar、多个 settings 页面仍有大量英文硬编码。WP-07 直接触及的 scheduled-task 表单、筛选、详情、run history 与反馈已进入当前 en-US/zh-CN 字典。
- [`app/components/workspace/settings/AppearanceSettings.vue`](app/components/workspace/settings/AppearanceSettings.vue) 在 system 模式只读取一次 `matchMedia`，没有监听系统主题变化。
- 词典 key 检查通过只能证明两个 locale key 集合一致，不能证明产品组件使用了词典。

#### 必须实现

1. 所有范围内产品界面文本进入统一 i18n；动态后端文本、代码、文件名和用户内容不得错误翻译。
2. aria-label、title、empty/error/loading、toast、dialog 文本也必须翻译。
3. system theme 监听 `prefers-color-scheme` change；切换到显式 light/dark 时解绑或忽略系统变化。
4. SSR/hydration 不出现主题闪烁或 server/client 不一致。

#### Vue 实现建议

- 按功能域组织 key，但继续使用现有 i18n plugin 和 locale 类型检查。
- 创建轻量 source guard，阻止新的核心模板直接加入英文产品文本；允许测试 fixture、代码、协议常量。
- theme listener 封装 composable，并在 `onScopeDispose` 移除监听。

#### 验收与测试

- zh-CN/en-US 对 chat、agents、scheduled、settings、browser、artifacts 的关键页面 E2E。
- i18n key/unused/source guard 全绿。
- system theme change、显式主题不跟随、销毁解绑和 hydration 测试。

## 7. 推荐实施顺序

必须按依赖推进，不建议多个窗口同时修改 `AgentChat.vue`、`ChatComposer.vue`、`MessageList.vue` 或 `useThreadStream.ts`。

1. **阶段 A：安全与入口**：WP-01。
2. **阶段 B：协议和线程状态**：WP-02。
3. **阶段 C：聊天输入输出**：WP-03，然后 WP-04。
4. **阶段 D：高风险工作区面板**：WP-05、WP-06；两者可由不同窗口并行。
5. **阶段 E：业务页面**：WP-07、WP-08、WP-09；避免同时修改公共 query key。
6. **阶段 F：设置与壳层**：WP-10、WP-11。
7. **阶段 G：全局收口**：WP-12、完整视觉/真实后端/双前端验证。

每个工作包完成后，都要重新搜索本文档列出的“已存在但没有消费者”的 API/helper，不能保留新的双轨实现。

## 8. 每个工作包的完成定义

一个 ID 只有同时满足以下条件才可改为 `DONE`：

- 当前 React 行为和后台合同已从源码重新确认；
- Vue 使用 Vue/Nuxt 方案实现，没有引入 React 运行时或复制 React 状态容器；
- 请求的 URL/method/query/headers/body 与共享后台合同一致；
- 成功、空数据、4xx、5xx、取消、超时、重试和路由切换均有明确处理；
- Vue unit/DOM 测试覆盖纯逻辑与组件状态；
- 关键用户路径有 E2E，必要时包含真实 Gateway/真实 Nuxt proxy；
- 无障碍交互包含键盘、焦点、aria、IME；
- 相关旧实现、孤儿 helper 或重复状态路径被移除；
- `make verify` 通过；
- 根据变更范围运行下方专项门禁；
- `git diff --check` 通过，工作区没有无关改动；
- 本文档状态和完成证据已更新。

## 9. 验证命令

从 `frontend-vue` 目录运行：

```bash
make verify
make migration-check
make e2e-m7
make e2e-m7-auth
make e2e-m7-real-protocol
make e2e-m7-visual
make asset-budget
make container-smoke
```

按工作包至少增加：

- WP-01：proxy/security/auth、真实 Nuxt route；
- WP-02～WP-04：stream、thread history、chat、sidecar E2E；
- WP-05：browser unit + real backend；
- WP-06：artifact write + binary/truncated/dirty guard；
- WP-07：scheduled tasks API contract + E2E；
- WP-08：channels poll/deep-link/disconnect；
- WP-09～WP-11：agents/settings/workspace E2E；
- WP-12：i18n、theme、visual。

React 基线也必须保持：

```bash
cd ../frontend
pnpm check
pnpm test
```

本基线审计时结果：React 1001/1001 tests 通过；Vue 1100/1100 tests、类型检查、格式检查、OpenAPI 检查和 Nuxt production build 通过。现有门禁通过不等于上述差异已完成，因为多数差异尚无对应测试。

## 10. 后续窗口交接模板

完成或暂停一个工作包时，在任务回复和本文档中留下：

```text
工作包：WP-xx
处理 ID：XXX-01, XXX-02
状态：DONE / BLOCKED / IN PROGRESS
React 基线：文件 + symbol/行号
Vue 改动：文件列表
API 对齐：method/path/query/headers/body/response/error/cache
交互对齐：DOM/键盘/焦点/响应式/异常态
新增测试：测试文件 + 用例名称
已运行门禁：命令 + 结果
未运行门禁：命令 + 原因
剩余风险：明确事实，不猜测后台
提交：commit hash（如果用户授权提交）
```

## 11. 本次审计覆盖与证据边界

- 已机械通读 `frontend` 与 `frontend-vue` 的 1,088 个受控代码/配置文件，共 231,034 行。
- API 定义层已有较高复用度；主要缺口集中在 Vue 页面/composable 对响应和 helper 的实际消费，而不是缺少 TypeScript 函数声明。
- 已确认的孤儿能力包括 compact、subtask steps/task presentation、scheduled update/delete、channel disconnect/deep-link、thread export、skill install 等；完成工作包时应优先接通现有正确实现，避免再造一套。
- 本文档只记录当前源码能够证明的前端差异。真实 IdP、外部 channel provider、真实浏览器控制后端等仍需用对应环境做最终验收；没有运行的真实环境门禁不得写成“已验证”。
- 初始基线审计没有修改业务代码；后续工作包的实现、测试和完成证据以本表状态及 git diff 为准，工作树中的用户改动必须继续保留。

## 12. 完成证据

在此追加，不删除历史记录：

| 日期       | 工作包/ID                                                 | 证据                                                                                                                                                                                                                                                                                 | 备注                                                   |
| ---------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| 2026-08-21 | 基线审计                                                  | React tests 1001/1001；Vue tests 1100/1100；Vue production build 通过                                                                                                                                                                                                                | 所有 ID 初始状态为 TODO                                |
| 2026-08-21 | WP-01：`API-01`、`AUTH-01`～`AUTH-03`、`SEC-01`           | 定向 Vitest 62/62；`make proxy-security`：Nitro 12/12、options 2/2、unit 36/36；`make e2e-m7-auth` 10/10；`make oidc-smoke` 2/2；`make verify` 1138/1138 且 production build 通过                                                                                                    | 本机回环监听环境重跑通过；本地提交、未 push            |
| 2026-08-21 | WP-02：`STREAM-01`、`STREAM-02`、`THREAD-01`～`THREAD-05` | `make e2e-m4a` 4/4；`make e2e-m4a-stream` 6/6；`make e2e-m7` 130/130；`make e2e-m7-real-protocol` 1/1；`make migration-check` 通过；`make verify` 1166/1166 且 production build 通过；React `pnpm check` 与 `pnpm test` 1001/1001                                                    | 回环门禁在允许本机监听的环境重跑；未 commit、未 push   |
| 2026-08-22 | WP-08：`CHANNEL-01`～`CHANNEL-03`                         | WP-08 unit/DOM 21/21；聚焦 Vitest 55/55；M7 channels 11/11、全量 144/144；real Gateway 3/3；WP-07 real 2/2；M4a 4/4、stream 6/6；M7 local 8/8、auth 10/10、real protocol 1/1、visual 7/7；`make migration-check` 通过；`make verify` 159 files / 1358 tests 且 production build 通过 | 真实 IM/IdP/DNS/TLS/外层代理未验证；未 commit、未 push |
