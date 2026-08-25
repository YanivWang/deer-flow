# React / Vue 可平替差异与执行清单

> 状态：第 5 节 58 个 ID **全部 DONE**——源码级差异已在本地关闭并留下可执行证据。
> 这**不等于**生产切流证据：公网 DNS/TLS、外层代理、真实 IdP 与目标环境验收仍属环境侧，
> 本文件不为它们背书。新发现的差异按第 4 节加 ID，不要因为「表里全是 DONE」就认为
> 本文件已经作废。
>
> 首次审计基线日期：2026-08-22。React 基线：`../frontend`；Vue 实现：当前目录 `frontend-vue`。
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

| ID          | 优先级 | 状态 | 工作包 | 未对齐点                                                              |
| ----------- | ------ | ---- | ------ | --------------------------------------------------------------------- |
| API-01      | P0     | DONE | WP-01  | Nuxt 代理会拒绝没有请求体和 `Content-Length` 的 DELETE                |
| AUTH-01     | P0     | DONE | WP-01  | OIDC callback 没有验证 session 和执行安全跳转                         |
| AUTH-02     | P0     | DONE | WP-01  | `/workspace` 仍是占位页，没有进入默认聊天页                           |
| AUTH-03     | P1     | DONE | WP-01  | Gateway 不可用被当成未登录，缺少离线/恢复状态                         |
| SEC-01      | P0     | DONE | WP-01  | 实际消息 Markdown 链接没有协议 allowlist                              |
| STREAM-01   | P0     | DONE | WP-02  | Vue 丢弃 task 与 `llm_retry` custom SSE 事件                          |
| STREAM-02   | P0     | DONE | WP-02  | Subtask 没有实时/历史 steps、模型与 token 展示                        |
| THREAD-01   | P1     | DONE | WP-02  | `/compact` 只显示建议，没有调用 compact API                           |
| THREAD-02   | P1     | DONE | WP-02  | prepared replay 丢失后端错误且缓存失效不完整                          |
| THREAD-03   | P0     | DONE | WP-02  | 主线程搜索结果没有过滤 sidecar 线程                                   |
| THREAD-04   | P0     | DONE | WP-02  | 删除主线程不级联删除 sidecar 线程                                     |
| THREAD-05   | P1     | DONE | WP-02  | 历史记录自动请求所有分页，没有按需加载                                |
| COMPOSER-01 | P1     | DONE | WP-03  | 草稿按 user/agent/thread 隔离，恢复时重新校验 skill                   |
| COMPOSER-02 | P1     | DONE | WP-03  | agent 默认模型、能力、mode、reasoning 与线程上下文已归一化            |
| COMPOSER-03 | P1     | DONE | WP-03  | 仅 run accepted 后清理；上传/发送失败保留并复用用户内容               |
| COMPOSER-04 | P1     | DONE | WP-03  | follow-up 显式决策；polish/goal/suggestion 使用 generation guard      |
| HIL-01      | P1     | DONE | WP-03  | required/checkbox/pending/error/thread 生命周期已接通                 |
| MESSAGE-01  | P1     | DONE | WP-03  | 现代与 legacy 已发送附件均在消息记录中渲染                            |
| MESSAGE-02  | P1     | DONE | WP-03  | 当前 React 未接入 feedback 操作；Vue 不显示点赞/踩，wire 字段无损保留 |
| MESSAGE-03  | P1     | DONE | WP-03  | `thread.values.todos` 已按权威状态渲染                                |
| MESSAGE-04  | P1     | DONE | WP-03  | models/thread token usage、total/per-turn/debug 偏好已消费            |
| MESSAGE-05  | P1     | DONE | WP-03  | user/assistant copy 与 citation source 详情已补齐                     |
| MESSAGE-06  | P0     | DONE | WP-03  | processing 步骤、工具结果、reasoning、等待态与 Markdown 层级已对齐    |
| MESSAGE-07  | P1     | DONE | WP-13  | 消息统一插件链，GFM 表格与复制/下载/全屏操作已对齐                    |
| SIDECAR-01  | P0     | DONE | WP-04  | 单一 session owner 串行 restore/create，拒绝过期结果回写              |
| SIDECAR-02  | P0     | DONE | WP-04  | sidecar 附件按最终 thread 上传并进入结构化发送请求                    |
| SIDECAR-03  | P0     | DONE | WP-04  | sidecar MessageList 已接入真实 thread/error/HIL 提交                  |
| BROWSER-01  | P0     | DONE | WP-05  | connecting 阶段丢导航，断线没有有界重连                               |
| BROWSER-02  | P0     | DONE | WP-05  | 缺 REST fallback、live/static 模式和 URL 同步                         |
| BROWSER-03  | P0     | DONE | WP-05  | 点击坐标、滚轮、键盘和 IME 行为未对齐                                 |
| ARTIFACT-01 | P0     | DONE | WP-06  | 显式类型/来源策略 fail closed；未知二进制不进入文本加载或 PUT         |
| ARTIFACT-02 | P1     | DONE | WP-06  | 单一 draft owner 统一保护切换、关闭、跨面板、路由与页面离开           |
| ARTIFACT-03 | P1     | DONE | WP-06  | save/discard/exit/copy/open/download/install 与错误/权限已接通        |
| ARTIFACT-04 | P1     | DONE | WP-06  | 正式与流式 HTML 仅在完整、未截断且结构闭合时进入 iframe preview       |
| SCHEDULE-01 | P1     | DONE | WP-07  | once/cron、DST 时区与 fresh/reuse 精确 payload 已接通                 |
| SCHEDULE-02 | P1     | DONE | WP-07  | 编辑、确认删除、recipes、类型与六状态筛选已接通                       |
| SCHEDULE-03 | P1     | DONE | WP-07  | 分页 run history、完整详情、轮询与错误收敛已接通                      |
| CHANNEL-01  | P1     | DONE | WP-08  | scoped connections 是状态/多账号唯一真相，provider 只保留能力         |
| CHANNEL-02  | P1     | DONE | WP-08  | URL/instruction/有限 expires poll 与全生命周期 cleanup 已接通         |
| CHANNEL-03  | P1     | DONE | WP-08  | 单 connection 与管理员 provider runtime 删除已明确分流并重读          |
| AGENT-01    | P1     | DONE | WP-09  | setup_agent 结果、有限可见性验证与 created/error/retry 已收敛         |
| AGENT-02    | P1     | DONE | WP-09  | Agent 设置已按模型能力构造精确 PUT 并清理 stale override              |
| AGENT-03    | P2     | DONE | WP-09  | Agent 卡片已精确展示 model、skills 与 tool groups                     |
| MEMORY-01   | P1     | DONE | WP-10  | 完整 export runtime schema、storage 校验、warning preview 已接通      |
| MEMORY-02   | P1     | DONE | WP-10  | 删除、清空与覆盖导入使用 pending-safe alert dialog 二次确认           |
| MEMORY-03   | P1     | DONE | WP-10  | confidence 0～1 编辑/diff、搜索、筛选与空态已接通                     |
| SETTINGS-01 | P1     | DONE | WP-10  | Skills/MCP 已按共享 session 区分读写权限、403 与通用失败              |
| SHELL-01    | P1     | DONE | WP-11  | 单例 Gateway banner、command palette、toast 与清理合同已接通          |
| SHELL-02    | P1     | DONE | WP-11  | Settings focus/aria/query/history/焦点归还已接通                      |
| SHELL-03    | P1     | DONE | WP-11  | share/export/updated time 与可见错误已接通                            |
| CHANGES-01  | P2     | DONE | WP-11  | 完整字段/reason、Query abort/stale、error/retry 已接通                |
| I18N-01     | P1     | DONE | WP-12  | 92 个产品 SFC 已接入单一 typed locale owner 与 AST source guard       |
| THEME-01    | P2     | DONE | WP-12  | system/explicit/forced route 已归单一 theme lifecycle owner           |
| SURFACE-01  | P1     | DONE | WP-13  | 聊天 header、侧栏菜单、消息操作与 token/export 入口已按调用点收口     |
| SURFACE-02  | P1     | DONE | WP-13  | follow-up 配置竞态已收敛为单一 Vue Query owner                        |
| SURFACE-03  | P1     | DONE | WP-13  | 消息尾部操作、耗时、底部留白与 composer 几何结构已对齐                |
| EDITOR-01   | P1     | DONE | WP-14  | Artifact 编辑视图已是 CodeMirror 6，语言/主题/只读与 Mod-S 已对齐     |
| SURFACE-04  | P2     | DONE | WP-14  | 模式选择器已有 hover/焦点说明浮层，主 composer 与 sidecar 共用一份    |
| AUTH-04     | P1     | DONE | WP-14  | Gateway 不可达时的登录/设置页就地恢复已确认存在并补上回归证据         |

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
- 线程存在性由 [`threads/thread-presence.ts`](app/core/threads/thread-presence.ts) 判定，不再绑定 checkpoint：`GET /threads/{id}` 与 `/state` 在上下文压缩后 404 属常态，而 `/messages/page` 仍完整返回历史。只有元数据 403/404 确认缺失、历史已问出结论且确实为空时才退回新会话；其余错误保持原地。合同见 `BEHAVIOR_CONTRACTS.md` S8，证据为 `tests/unit/threads/thread-presence.test.ts`、`tests/e2e/thread-without-checkpoint.spec.ts` 与 `tests/e2e-real/multi-run-order.spec.ts`（后者的 `test.fail()` 已摘除）。

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

包含：`COMPOSER-01`～`COMPOSER-04`、`HIL-01`、`MESSAGE-01`～`MESSAGE-06`。

#### 当前代码事实

- [`useComposerDraft.ts`](app/composables/useComposerDraft.ts) 以真实 user + agent/lead-agent + 真实 thread 或稳定 `new` scope 持有 tab 草稿；skill catalog ready 后才恢复并降级已禁用 skill。成功登出和确认删除 thread 会按作用域清理草稿。
- [`ChatComposer.vue`](app/components/chat/ChatComposer.vue) 把 text、skill、files 与上传结果保留到 Gateway run handle 到达；创建失败、4xx、取消、路由切换继续可重试，成功上传文件不会重复上传，重复提交由单一 in-flight guard 丢弃。
- [`useModels.ts`](app/composables/useModels.ts)、[`models/capabilities.ts`](app/core/models/capabilities.ts) 与 [`useThreadSettings.ts`](app/composables/useThreadSettings.ts) 共同解析 agent 默认模型、thinking/mode/reasoning 能力与 thread/agent-scoped context；能力控制可见选择，最终 run context 保持 React 的 explicit effort → mode fallback 语义，provider capability 过滤归 Gateway model factory。
- follow-up 在非空草稿上显式提供 append-and-send、replace-and-send、cancel；[`async/generation.ts`](app/core/async/generation.ts) 统一阻止 polish、goal 与 post-run suggestion 在 stop、unmount 或 route/thread 变化后写回。
- [`HumanInputCard.vue`](app/components/chat/HumanInputCard.vue) 对 required checkbox=false、select/multi-select 与文本字段统一校验并暴露 aria-invalid；MessageList 在失败、thread error、路由切换与终态收敛 pending HIL。
- [`MessageAttachments.vue`](app/components/chat/MessageAttachments.vue) 从持久化消息读取现代 files 与 legacy upload tag；刷新后不依赖 composer 本地状态。
- [`messages/processing.ts`](app/core/messages/processing.ts) 与 `ProcessingMessageGroup.vue` 把 reasoning、assistant text、tool call/result/browser frame 投影为唯一步骤 UI；较早步骤折叠、最新工具和结果只出现一次、trailing reasoning 与其后答案顺序稳定。MessageList 另接入 run activity、一次性 reasoning 自动收起、React 等价 Markdown 基础元素、copy 与 citation。Gateway feedback 字段可随 history 行无损保留，但 React 当前调用点未启用可见 feedback 操作，Vue 同样不显示点赞/踩。
- AgentChat 渲染权威 `thread.values.todos`；[`useThreadTokenUsage.ts`](app/composables/useThreadTokenUsage.ts) 对响应 `thread_id` 二次校验，header total、per-turn/debug 与 off 偏好由统一 usage model 驱动。

#### 必须实现

1. 草稿按真实 user + thread/agent 隔离；登出、切用户、删除线程时不得泄漏。
2. 草稿恢复必须验证 skill 当前存在且启用。
3. 模型选择遵守 agent 默认值和 capabilities；可见选项按能力裁剪，最终 run context 的 explicit effort / mode fallback 与 React 请求一致，provider 不支持字段由 Gateway factory 过滤。
4. context overrides 是 thread-scoped；切线程、切 agent、创建新聊天时按 React 规则恢复或重置。
5. 只有发送被后台接受后才清空草稿；上传/发送失败必须恢复文本、skill 和仍可复用的文件。
6. follow-up 在已有草稿时提供 append/replace/cancel，不得静默覆盖。
7. polish、goal、follow-up 在 unmount、route change、thread change、用户 stop 后不能写回旧页面。
8. HIL 的 required、checkbox、提交中、失败、thread error、刷新恢复规则与 React 一致。
9. 人类消息渲染现代 files 字段和兼容的 legacy upload 内容。
10. AI 消息提供 copy、citation source 等等价操作；feedback 仅在 React 消息列表实际接入后重新纳入 UI 对齐。
11. 渲染 todos，并消费 models/thread token usage；尊重用户的 token 展示偏好。
12. processing 只渲染一份步骤投影；等待态、工具结果、reasoning disclosure、最终答案 Markdown 层级与 React 可观察流程一致。

#### Vue 实现建议

- 从 ChatComposer 拆出 `useComposerDraft`、`useModelCapabilities`、`useComposerCommands`、`useComposerSubmission`。
- 用递增 generation/token 或 effect scope 防止过期异步任务写回；销毁时统一 abort。
- MessageList 拆成 `HumanMessage`、`AssistantMessage`、`MessageAttachments`、`MessageActions`、`TodoList`、`HumanInputCard`。
- token usage 使用 Vue Query query；任何未来新增的服务端消息操作也必须使用精确 mutation/invalidation。

#### 验收与测试

- 两个用户、两个线程、agent/non-agent 的 draft 隔离测试。
- capability payload 参数快照必须与 React 语义一致。
- 上传 4xx、发送 4xx、取消、路由切换时输入不丢失且无过期写回。
- human message 的 image/file/legacy upload DOM 测试。
- 消息操作区测试必须证明不会出现 React 当前未启用的 feedback 入口。
- todo、token total、per-turn、隐藏偏好测试。

<!-- 历史记录：写的是**当时**跑了哪条命令，不改写。旧名到今天的对照见第 9 节。 -->
<!-- historical-commands:begin -->

- 本工作包实测：`make e2e-m4a` 4/4、`make e2e-m4a-stream` 6/6、`make e2e-m7` 130/130、`make e2e-m7-local` 8/8、`make e2e-m7-auth` 10/10、`make e2e-m7-real-protocol` 1/1、`make e2e-m7-visual` 7/7；视觉 baseline 未更新。
- `make migration-check` 通过；沙箱外 `make verify` 为 132 个 test files / 1203 tests 全绿并完成 Nuxt 生产构建。React `pnpm check` 通过，沙箱外 `pnpm test` 为 128 个 test files / 1001 tests 全绿。

<!-- historical-commands:end -->

### WP-04：Sidecar 完整会话

包含：`SIDECAR-01`～`SIDECAR-03`。

#### 当前代码事实

- [`app/composables/useSidecarSession.ts`](app/composables/useSidecarSession.ts) 是每个 `AgentChat` 唯一的 sidecar session owner：恢复完成且确认不存在后才创建，并在 main thread/context/scope 变化时拒绝旧结果回写。
- 主 composer 与 sidecar 共用 [`app/core/uploads/submission-files.ts`](app/core/uploads/submission-files.ts)，附件上传到最终 sidecar thread，完整成功的同一 `File` 可在 run 失败后复用。
- [`app/components/workspace/sidecar/SidecarPanel.vue`](app/components/workspace/sidecar/SidecarPanel.vue) 只渲染 session，并把真实 thread、stream error 与 HIL callback 传给共享 MessageList/HumanInputCard。
- SidecarPanel 只从 session 的 submission/stream 状态派生一个 `composerBusy`；form、textarea 与 submit 不得各自维护运行锁，面板隐藏/重开也不能提前恢复输入。
- session 位于面板组件之外；关闭或切换右侧面板不会销毁流，真实删除才清空 thread、草稿、附件与上传缓存。
- React [`src/components/workspace/sidecar/sidecar-panel.tsx`](../frontend/src/components/workspace/sidecar/sidecar-panel.tsx) 先 restore，再决定是否 create，并把附件/HIL 接入 sidecar run。

#### 必须实现

1. sidecar 初始化具有单一状态机：idle → restoring → ready/creating → ready/error。
2. 同一个 main thread + context 只允许一个有效 sidecar create 请求。
3. selected files 按与主 Composer 相同的验证、上传、payload 和失败恢复规则发送。
4. sidecar 可回答 HIL，pending/error/刷新恢复规则与主聊天一致。
5. 关闭/重开面板不能丢失正在执行的 sidecar run。
6. 提交接受后到 run settle 前 sidecar textarea 与 submit 必须保持禁用，form 同步暴露 busy 语义。

#### Vue 实现建议

- 用 `useSidecarSession(mainThreadId)` 统一 restore/create/run/files/HIL；组件不直接拼线程生命周期。
- restore/create 使用共享 Promise 或 mutation mutex 防重复。
- 主聊天和 sidecar 复用框架无关的 file payload 与 HIL validator，不复制业务规则。

#### 验收与测试

- WP-04 新增 4 个测试文件 / 17 个用例，覆盖延迟 restore 并发、create 去重、最终 sidecar thread 附件上传、失败重试复用、草稿/附件隔离、IME、关闭重开不中断 run，以及 HIL required/false-checkbox/pending/error/刷新恢复。
- React 共享 sidecar Playwright 7/7，抓包断言结构化附件目标为最终 sidecar thread，并覆盖活动 run 关闭/重开与 HIL 请求/响应。

<!-- 历史记录：写的是**当时**跑了哪条命令，不改写。旧名到今天的对照见第 9 节。 -->
<!-- historical-commands:begin -->

- 浏览器门禁实测：`make e2e-m4a` 4/4、`make e2e-m4a-stream` 6/6、`make e2e-m7` 130/130、`make e2e-m7-local` 8/8、`make e2e-m7-auth` 10/10、`make e2e-m7-real-protocol` 1/1、`make e2e-m7-visual` 7/7；视觉 baseline 未更新。
- `make migration-check` 通过；沙箱外 `make verify` 为 136 个 test files / 1220 tests 全绿并完成 Nuxt 生产构建。React `pnpm check` 通过，`pnpm test` 为 128 个 test files / 1001 tests 全绿。

<!-- historical-commands:end -->

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
- Vue-owned Playwright：`tests/e2e/browser-control.spec.ts` 3 个用例，覆盖 ToolMessage 静态帧自动打开、Gateway URL/title 收敛、输入 wire、Static REST 失败和同目标重试；该层使用 Mock Gateway/Mock WS，不冒充真实后端。
- Real-Gateway：`tests/e2e-browser/browser-panel.spec.ts` 使用本地真实 FastAPI Gateway 与真实 Playwright Chromium browser runtime 验证 REST 响应、二进制 WS 帧和 Vue UI 收敛；Gateway harness 的模型侧是 replay，不冒充生产模型/环境。
- 聚焦 TDD：7 个 Vue unit/DOM 文件、24/24 用例通过；新增 Vue-owned Playwright 3/3 通过。

<!-- 历史记录：写的是**当时**跑了哪条命令，不改写。旧名到今天的对照见第 9 节。 -->
<!-- historical-commands:begin -->

- 最终顺序门禁（2026-08-22）全部通过：`make e2e-m6-list` 9 files / 33 tests；`make e2e-m6` 33/33；`make e2e-m6-real-backend` 1/1；`make e2e-m4a` 4/4；`make e2e-m4a-stream` 6/6；`make e2e-m7` 26 files / 133/133；`make e2e-m7-local` 8/8；`make e2e-m7-auth` 10/10；`make e2e-m7-real-protocol` 1/1；`make e2e-m7-visual` 7/7（baseline 未更新）；`make migration-check` 通过；`make verify` 143 test files / 1244 tests、类型/格式/collection/i18n/OpenAPI/header/production build 全部通过。

<!-- historical-commands:end -->

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
- Vue-owned 浏览器合同覆盖 download-only、完整 D3 HTML 与 dirty switch/close（现属 `make e2e`）。正式截断 HTML 不创建 iframe/editor，并提供显式加载完整文件。
- `tests/e2e-real/artifact-write.spec.ts` 使用同一真实本地 FastAPI Gateway、Nuxt 与 Playwright Chromium 验证 206 Range/ETag、真实 PUT SHA/size、并发修改后的真实 412 与草稿保留、Office/archive/unknown 零文本 GET，以及 1.1 MiB HTML 截断边界。模型侧使用 replay，不等于生产模型、DNS/TLS、外层代理或真实 IdP 证明。

<!-- 历史记录：写的是**当时**跑了哪条命令，不改写。旧名到今天的对照见第 9 节。 -->
<!-- historical-commands:begin -->

- 最终顺序门禁（2026-08-22）全部通过：聚焦 WP-06 unit/DOM 7 files / 58 tests；`make e2e-m5-list` 6 files / 29 tests；`make e2e-m5` 29/29；`make e2e-m5-real-backend` 1/1；`make e2e-m4a` 4/4；`make e2e-m4a-stream` 6/6；`make e2e-m7-list` 26 files / 135 tests；`make e2e-m7` 135/135；`make e2e-m7-local` 8/8；`make e2e-m7-auth` 10/10；`make e2e-m7-real-protocol` 1/1；`make e2e-m7-visual` 7/7（baseline 未更新）；`make migration-check` 通过；`make verify` 150 test files / 1303 tests、landed 59 files / 561 tests、2 locales / 各 764 keys、205 file headers、类型/格式/OpenAPI/production build 全部通过。

<!-- historical-commands:end -->

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
- Vue-owned [`tests/e2e/scheduled-tasks.spec.ts`](tests/e2e/scheduled-tasks.spec.ts) 为 9 tests：
  create/edit/pause/resume/trigger/delete、recipe、once/DST、六 task 状态、两种类型、running
  lock、错误展示/401 跳转、runs 50+5 分页和详细字段。

<!-- 历史记录：写的是**当时**跑了哪条命令，不改写。旧名到今天的对照见第 9 节。 -->
<!-- historical-commands:begin -->

- `make e2e-wp07-real-backend` 为 2/2：真实 FastAPI Gateway、SQLite repository/service、HTTP、
  Nuxt preview 与 Chromium 验证真实 once/cron create、Gateway 归一化与 422、context/thread
  权限、PATCH、pause/resume、trigger、runs 详细字段与 delete。手动 trigger 使用签入 replay
  model，真实 run 最终按 artifact delivery 策略收敛为 failed，Vue 和 HTTP 均保留同一终态与
  error；认证由 `DEER_FLOW_AUTH_DISABLED=1` 隔离。

<!-- historical-commands:end -->

- 该 real-backend gate 不等于生产 scheduler 的真实时间推进、生产模型、真实 IdP、DNS/TLS
  或外层代理证据；这些边界仍由目标环境负责。

<!-- 历史记录：写的是**当时**跑了哪条命令，不改写。旧名到今天的对照见第 9 节。 -->
<!-- historical-commands:begin -->

#### 最终顺序门禁

- 2026-08-22 全部通过：WP-07 unit/DOM 5 files / 33 tests；`make e2e-m7-list`
  26 files / 138 tests；`make e2e-m7` 138/138；`make e2e-wp07-real-backend` 2/2；
  `make e2e-m4a` 4/4；`make e2e-m4a-stream` 6/6；`make e2e-m7-local` 8/8；
  `make e2e-m7-auth` 10/10；`make e2e-m7-real-protocol` 1/1；`make e2e-m7-visual`
  7/7（baseline 未更新）；`make migration-check` 通过（58 个生成测试、20 个 RETYPED）；
  `make verify` 155 test files / 1337 tests、landed 59 files / 561 tests、2 locales / 各
  788 keys、216 file headers、类型/格式/OpenAPI/production build 全部通过。

<!-- historical-commands:end -->

- `make verify` 有 0 error，余下 warning 全部是既有的 `vue/html-self-closing` 与
  `vue/require-default-prop`（具体条数以命令输出为准，不抄进本文）；生产构建另有既有 chunk-size、Tailwind
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
- Vue-owned channels spec（现属 `make e2e`）覆盖 provider/connection 冲突、URL popup、
  instruction-only、多账号、有限过期、导航 dispose、pending/race、单 connection/provider
  删除、429 与 401。

<!-- 历史记录：写的是**当时**跑了哪条命令，不改写。旧名到今天的对照见第 9 节。 -->
<!-- historical-commands:begin -->

- `make e2e-wp08-real-backend` 为 3/3：真实 FastAPI Auth/CSRF/channel router/SQLite repository、
  connect code/deep-link response、用户隔离、多账号收敛、精确 DELETE、provider runtime revoke 与
  400/401/403/404/429。只有外部 Slack/Telegram worker 与 callback 使用签入的受控 fixture；不
  证明真实 IM 平台授权、生产凭据、deep-link handler、DNS/TLS、外层代理或真实 IdP。

<!-- historical-commands:end -->

### WP-09：Agents 创建与设置

包含：`AGENT-01`～`AGENT-03`。

#### 当前代码事实

- [`app/composables/useAgentCreationSession.ts`](app/composables/useAgentCreationSession.ts) 是
  idle/saving/verifying/created/error、隐藏 save、tool result、有限 visibility retry 与 cleanup
  的唯一 owner；只有关联的 setup_agent ToolMessage 显式 `status=success` 才能进入验证，
  assistant 文本和未匹配 result 不参与成功判断。
- Bootstrap 仍留在 `/workspace/agents/new`，但 [`AgentChat.vue`](app/components/chat/AgentChat.vue)
  把 prepared real thread 作为 `displayThreadId` 消费 live snapshot；run finish 显式传递 runner
  wire messages，避免 durable state 投影缺 messages 时丢失 tool result。
- [`app/composables/useAgents.ts`](app/composables/useAgents.ts) 与
  [`useModels.ts`](app/composables/useModels.ts) 分别独占 Agent/model Vue Query server state；feature
  未 ready/disabled 不查询，mutation success 同步并重读真实 list，Pinia 没有第二份缓存。
- [`agents/settings.ts`](app/core/agents/settings.ts) 按真实模型 capability 构造 exact PUT：default
  sentinel → `model:null`，thinking/reasoning 保留 true/false/null/inherit，unsupported 显式 null
  清 stale override，temperature 0–2、max_tokens 1–200000 整数且接受浏览器 number v-model。
- [`AgentCard.vue`](app/components/workspace/agents/AgentCard.vue) 通过
  [`agents/presentation.ts`](app/core/agents/presentation.ts) 展示 response model、skills 与
  tool_groups，保留顺序/重复；null 表示不限制 configured groups，空数组表示没有 configured groups。

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

- 严格 TDD 初始红灯覆盖缺少 creation owner/settings/card view、错误 tool 结果误判、无限/重复
  验证、capability stale 字段和 tool-groups DOM；实现后 WP-09 unit/DOM 覆盖 tool success/error、
  immediate/delayed/exhausted visibility、double save、Abort/scope cleanup、exact payload 与 card。
- Vue-owned Agent spec（现属 `make e2e`）覆盖精确 card、模型目录/错误无 retry storm、exact PUT/
  re-read、失败保留 dialog、隐藏 save、setup_agent 关联、误导性 prose、显式 retry 与既有 Agent chat。

<!-- 历史记录：写的是**当时**跑了哪条命令，不改写。旧名到今天的对照见第 9 节。 -->
<!-- historical-commands:begin -->

- `make e2e-wp09-real-backend` 为 3/3：真实 FastAPI Auth/CSRF/features/models/agents/thread-run、
  LangGraph、setup_agent、SQLite persistence、用户隔离、404/409/422、disabled 与 Vue UI 收敛。
  只有外部 LLM 使用受控模型；不证明生产 provider/凭据、真实 IdP、DNS/TLS、外层代理或部署。

<!-- historical-commands:end -->

### WP-10：Memory、Skill 与 Tool 设置

包含：`MEMORY-01`～`MEMORY-03`、`SETTINGS-01`。

#### 已实现合同

- [`useMemory.ts`](app/composables/useMemory.ts) 独占 Memory query/mutation/export 与 scoped abort；
  [`memory/schema.ts`](app/core/memory/schema.ts) 纯校验完整 HTTP export，拒绝 malformed、partial、
  storage-invalid fact 和重复 ID，保留 forward extra 与不同 ID 的重复 content 并在 preview 警告。
- [`MemorySettings.vue`](app/components/workspace/settings/MemorySettings.vue) 使用真实 revision/fact
  metadata、搜索与 confidence 筛选，create/edit 支持 `0..1`、`0.01` step 和显式 `0`，PATCH
  只发送 diff。delete、clear 与覆盖 import 使用统一 pending-safe alert dialog；失败保留当前
  dialog/preview 与 Gateway status/detail。
- [`useSettingsPermissions.ts`](app/composables/useSettingsPermissions.ts) 从共享 session query 与
  auth-disabled Gateway 语义派生权限，不建立 static role。Skills 对普通用户保持可读、禁用写；
  MCP 对已知 non-admin 零 GET/PATCH。`useSkillSettings` 与 `useMCPConfig` 分别独占共享 query
  key，精确发送 `{enabled}` / `{server_name, enabled}`，不 optimistic，成功后 authoritative re-read。
- Vue-owned Settings spec（现属 `make e2e`）覆盖 import preview/无效数据零请求、失败保留、CRUD/
  搜索/筛选/二次确认和 auth-disabled admin；auth 套件（现属 `make e2e-auth`）覆盖普通用户零
  MCP I/O、真实 403 分类与 mutation 401 登录边界。

<!-- 历史记录：写的是**当时**跑了哪条命令，不改写。旧名到今天的对照见第 9 节。 -->
<!-- historical-commands:begin -->

- `make e2e-wp10-real-backend` 为 5/5：真实 Auth/CSRF/FastAPI、用户隔离 DeerMem 与独立 Noop
  manager，精确覆盖 400/404/duplicate 409/revision-conflict 409/422/corrupted 500/unsupported
  501；同时证明 Skills GET/admin PUT、MCP admin GET/PATCH、atomic config write/cache reload、
  secret masking、Nuxt/Chromium 与 UI 收敛。fixture 只 seed operator-owned skill/MCP 文件，并仅
  暴露本轮临时 home 以损坏后恢复隔离 manifest；不证明 Mem0/Honcho/OpenViking、真实外部
  MCP、生产 SkillScan/LLM/IdP/凭据、DNS/TLS、外层代理或部署。

<!-- historical-commands:end -->

### WP-11：Workspace shell、导航和 changes

包含：`SHELL-01`～`SHELL-03`、`CHANGES-01`。

#### 已实现合同

- [`app/layouts/workspace.vue`](app/layouts/workspace.vue) 单例挂载 command palette、settings host、
  Gateway banner 与 toast owner；全局 listener/timer 随 scope 清理。快捷键精确覆盖 React 当前
  K/Shift-N/comma/slash/B，拒绝 repeat、IME、Alt、双 modifier 和 editable 冲突。
- Settings 使用 Reka Dialog 的 modal/focus trap/初始焦点/Escape/焦点归还；有效 route query 是
  open section 真相，关闭只移除 `settings`，保留其余 query/hash，back/forward 可重放。
- recent-thread 独立 action menu 接通 rename/pin/share/export/delete；share 仍是纯客户端稳定 URL，
  export 从真实 thread state 加载并在异常时也清理浏览器资源。聊天列表从 `updated_at` 渲染相对时间。
- [`useWorkspaceChanges.ts`](app/composables/useWorkspaceChanges.ts) 独占 summary/detail Query；完整
  key 和 AbortSignal 阻止 thread/run 切换后的 stale 回写。组件显示 truncated、四种 status、五种
  unavailable reason、保真 Gateway detail 与 retry。

#### 验收与测试

- WP-11 unit/DOM 覆盖 shortcuts、toast/recovery、settings query/focus、thread action、export cleanup、
  workspace status/reason/error/retry 与真实 stale/abort owner。
- Vue-owned shell scenarios（现属 `make e2e`）由真实 Chromium 覆盖
  快捷键清理、settings deep-link/history/focus、share/export/updated time 与 changes 可见/重试。

<!-- 历史记录：写的是**当时**跑了哪条命令，不改写。旧名到今天的对照见第 9 节。 -->
<!-- historical-commands:begin -->

- `make e2e-wp11-real-backend` 通过 production Auth/CSRF/owner check、thread/checkpoint、run/event
  store 与 workspace-changes response builder，覆盖 401、跨用户 404、include flags、真实 state
  export 和 unavailable→真实 session 恢复。fixture 只写本轮隔离 event；唯一 503 是明确网络注入，
  不证明生产 IdP、DNS/TLS、外层代理或部署。

<!-- historical-commands:end -->

### WP-12：国际化与主题

包含：`I18N-01`、`THEME-01`。

#### 已实现合同

- 全量 158 个 Vue SFC 由可执行 inventory 固定：156 个产品 SFC 进入扫描，仅精确排除 2 个
  `app/pages/__m0` 测试 fixture。产品文案、aria/title/placeholder、empty/error/loading、toast
  与 dialog 均从单一 typed locale owner 消费；backend/user/code/file/URL/protocol 动态值保持原样。
- `app/plugins/i18n.ts` 独占 locale ref/computed、cookie 与 `document.lang`。`en-US`/`zh-CN`
  各 987 个精确 leaf key，150 个 audited unused key；key/unused drift 与 Vue/TypeScript AST source
  guard 共同阻止字典或产品消费回退，只允许精确品牌/技术/快捷键/内部 token。
- `app/plugins/theme.ts` 创建唯一应用级 controller；它独占 storage、preference/resolved/forced、
  唯一 `matchMedia` listener、根 class/color-scheme 与幂等 cleanup。system 实时跟随，显式主题
  忽略 media，切回 system 立即同步，非法 storage 回退。
- `theme/bootstrap.ts` 在 mount 前使用同一规则设置 class/color-scheme，不注册第二 listener。
  与 React `ThemeProvider`/root forced behavior 一致，`/` 仅强制当前 dark，不覆写用户已保存的 light。

#### 验收与测试

- WP-12 unit/DOM 4 files / 14 tests；真实 Chromium 覆盖 locale 即时切换/刷新/非法 cookie、
  动态内容不翻译、system light→dark→light、explicit 忽略、切回 system、早期 bootstrap、
  非法 storage、`/` forced dark 与离开恢复。
- visual 全部通过，新增 zh-CN dark settings baseline，并更新
  这次文案改变对应的唯一 mobile baseline。i18n key/unused/source guard、migration、build 与
  asset budget 同时全绿。

### WP-13：工作区可见产品表面收口

包含：`MESSAGE-07`、`SURFACE-01`、`SURFACE-02`、`SURFACE-03`。

#### 已实现合同

- 保持第 2 节的明确例外不变；`/`、`/pricing`、`/about`、静态 demo/mock 与 landing 不进入
  本工作包。Vue 运行时不再从 sibling React 项目挂载静态资源，独立项目所需资产归
  `frontend-vue/public` 自己所有。
- 当前 React `MessageList` 没有向 `MessageListItem` 传入 feedback，Vue 因此移除点赞/踩及其
  独有 mutation；静态 guard 会在 React 调用点仍未接通期间阻止该入口重新出现。
- `MessageMarkdown.vue` 统一消息、reasoning 与 processing 的 GFM/math/streaming 插件链；表格
  组件提供 React Streamdown 同等的复制 Markdown/CSV/TSV、下载 CSV/Markdown 和全屏查看。
- 聊天 header 改为 React 可见顺序，普通 thread 才显示定时任务，自定义 Agent 提供 New chat、
  不显示 thread 定时任务；browser trigger 同一按钮开/关。header 只提供 export，不额外提供 share。
- token usage 使用带说明的 radio menu；run duration 恢复时钟图标。侧栏 Settings-and-more 精确
  保留 Settings、官网、GitHub、Report issue、Contact、About，移除 Vue 独有的快捷主题/语言；
  非静态工作区品牌文字不再成为 Vue 独有链接，sidebar channel 不额外显示 React 没有的状态行。
- suggestions config 由 `useSuggestionsConfig.ts` 的 Vue Query 独占；首次 run 完成早于配置返回时，
  等待同一 query 后再请求 follow-up，不维护组件内第二份配置状态。
- 主 composer 的附件入口改为 React 等价的真实语义 button；自定义 Agent 的 Save 只在初始
  design conversation 成功且 send owner 完整释放后启用，不再与 bootstrap run 竞争 runner。
- `AssistantTurnActions.vue` 独占 assistant 尾部操作的视觉规格：所有可用动作复用共享
  `Button` 的 `ghost/icon-sm` 合同，按钮为 32 px、间距 4 px；不再由 `MessageList` 直接画裸图标。
  消息滚动区采用 React `use-stick-to-bottom` 同款双侧稳定 scrollbar gutter，内容内边距、动作到
  耗时的 8 px 与 32 px 行间距保持可解释；72 px 消息尾部空间归内容 wrapper 的 padding，长历史
  虚拟窗口偏移归语义 `<ul>` 的 padding，布局留白不再通过 spacer DOM 伪装成消息列表项。
- `ComposerSurface` 不再提供隐式 padding 或 padded 双轨，而以 `input-group-header/body/footer`
  data-slot 作为主会话和 sidecar 的统一几何合同：单行 body 最小 64 px，footer 50 px，边框后空态
  surface 为 116 px；主会话与 sidecar disclaimer 绝对定位，不再额外占据 24 px 布局高度。
- `tests/parity/product-surface.test.ts` 固定三条长期边界：Vue 页面不得超出 React 与明确
  route 例外；React 未启用 feedback 时 Vue 不得显示；Nuxt 不得运行时挂载 sibling React 资产；
  主 composer 的附件入口必须保持为语义 button。

#### 验收与测试

- unit/DOM 固定 feedback 缺席、MessageMarkdown 默认插件链、表格三项操作、token radio menu、
  header export、suggestions Query owner、操作按钮规格、滚动条 gutter、语义纯净的尾部 padding 与
  composer disclaimer 脱离布局流。
- Vue-owned 浏览器合同（现属 `make e2e`）固定 settings 菜单、非链接品牌、Agent header/browser
  开关和完成后 suggestions。
- thread-history 浏览器合同直接测量 assistant 操作按钮、横向步进、动作到耗时、消息尾部结构、
  滚动视口到 composer 与 viewport bottom inset；真实双端天气长对话另做同 viewport 几何比对。
- 同一真实天气 thread 必须在两端显示同一处理步骤、reasoning、GFM 表格与消息操作集合；模型
  输出文案、token 数和耗时不是 UI parity 判据。

### WP-14：Artifact 代码编辑器、模式说明与认证页离线恢复

包含：`EDITOR-01`、`SURFACE-04`、`AUTH-04`。

#### 当前代码事实

- Vue [`ArtifactEditor.vue`](app/components/workspace/artifacts/ArtifactEditor.vue) 之前是一个
  23 行的裸 `<textarea>`：没有语法高亮、没有语言概念、没有键盘保存。React
  [`code-editor.tsx`](../frontend/src/components/workspace/code-editor.tsx) 与
  [`code-editor-extensions.ts`](../frontend/src/components/workspace/code-editor-extensions.ts)
  在 `@uiw/react-codemirror` 上提供 7 值语言归一 + 6 个动态加载的语法包。
- Vue 现在在 `@codemirror/state` + `@codemirror/view` 上自建 [`app/core/code-editor/`](app/core/code-editor/)
  与 L2 [`CodeEditor.vue`](app/components/ui/code-editor/CodeEditor.vue)，不引入 React 包装器的
  Vue 对等物。归一规则与 React 逐条相同（`vue`/`bash`/`go` 这类同样落到纯文本）。
- React [`mode-hover-guide.tsx`](../frontend/src/components/workspace/mode-hover-guide.tsx) 在
  `input-box.tsx` 与 `sidecar/sidecar-panel.tsx` 里包住模式触发器。Vue 之前只有主 composer 上
  一个原生 `title`，sidecar 什么都没有。
- React [`gateway-offline-fallback.tsx`](../frontend/src/components/workspace/gateway-offline-fallback.tsx)
  解决的是 `(auth)` 布局服务端探活失败后只剩裸 HTML、没有 AuthProvider/QueryClientProvider
  的死锁。Vue 的 [`auth.vue`](app/layouts/auth.vue) 不做服务端探活，
  [`login.vue`](app/pages/login.vue) 与 [`setup.vue`](app/pages/setup.vue) 各自持有
  setup 探测与重试；[`auth.global.ts`](app/middleware/auth.global.ts) 只对 `/workspace` 取
  session。**该死锁在 Vue 结构上不存在**，不需要为对齐文件名再造一个组件。

#### 必须实现

1. 编辑视图使用 CodeMirror 6：语言识别、只读/可编辑、主题跟随、焦点与键盘，
   全部按可观察行为对齐，不照搬 React DOM。
2. 语法包动态加载，首屏不加载；`vendor-codemirror` 预算按实测值更新并保持在 CI 门禁里。
3. `Mod-S` 复用 `ArtifactPanel` 现有的 revision 保存路径，不新建保存入口。
4. 模式触发器的说明浮层建在 `ui/tooltip` 上，主 composer 与 sidecar 共用同一实现。
5. 认证页在 Gateway 不可达时的可用性与就地恢复必须有机器证据，而不是「搜不到同名文件」。

#### Vue 实现建议

- 框架无关规则留在纯 TS（语言表、配色、EditorView 句柄），Vue 组件只做接线。
- 语言/主题/只读用 Compartment reconfigure，不重建 `EditorView`。
- 说明浮层不要手搓：延迟、焦点入口、Escape、portal 层级和读屏器投影属于 primitive 层。

#### 验收与测试

- 纯 TS：语言归一表逐条钉住，并与 `artifacts/policy.ts` 的产出交叉验证。
- L2 DOM：用**真实** `EditorView` 证明 v-model 不自激、只读切换保留文档、
  换主题不丢光标、语言切换真的换了语法、Mod-S 转成 save。
- 浏览器：`tests/e2e/artifact-code-editor.spec.ts` 证明语法 chunk 真的经 HTTP 加载并着色、
  `prefers-color-scheme` 翻转会重着色、键盘保存发出与按钮相同的 PUT。
- 浏览器：`tests/e2e/mode-hover-guide.spec.ts` 同时证明浮层出现**和**下拉仍能打开。
- 浏览器：`tests/e2e-auth/gateway-unreachable-auth-pages.spec.ts` 在整个 `/api/**`
  连接失败下证明登录/设置页仍可用，并且恢复过程没有整页重载。

## 7. 推荐实施顺序

必须按依赖推进，不建议多个窗口同时修改 `AgentChat.vue`、`ChatComposer.vue`、`MessageList.vue` 或 `useThreadStream.ts`。

1. **阶段 A：安全与入口**：WP-01。
2. **阶段 B：协议和线程状态**：WP-02。
3. **阶段 C：聊天输入输出**：WP-03，然后 WP-04。
4. **阶段 D：高风险工作区面板**：WP-05、WP-06；两者可由不同窗口并行。
5. **阶段 E：业务页面**：WP-07、WP-08、WP-09；避免同时修改公共 query key。
6. **阶段 F：设置与壳层**：WP-10、WP-11。
7. **阶段 G：全局收口**：WP-12、完整视觉/真实后端/双前端验证。
8. **阶段 H：持续产品表面审计**：WP-13；只覆盖第 2 节以外的可观察入口。
9. **阶段 I：剩余产品能力补齐**：WP-14；编辑器、模式说明与认证页离线恢复彼此独立，可分窗口进行。

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
make asset-budget
make e2e-mock
make e2e-backend
make e2e-visual
make container-smoke
```

按工作包至少增加对应套件：

- WP-01：`make e2e-infra`、`make e2e-proxy-options`、`make e2e-auth`；
- WP-02～WP-04：`make e2e-stream`、`make e2e`、`make e2e-real`；
- WP-05：browser unit + `make e2e-browser`；
- WP-06：`make e2e`、`make e2e-real`（artifact write + binary/truncated/dirty guard）；
- WP-07：`make e2e-scheduled`；
- WP-08：`make e2e-channels`；
- WP-09：`make e2e-agents`；
- WP-10：`make e2e-settings`；
- WP-11：`make e2e-shell`；
- WP-12：`make e2e`、`make e2e-visual`；
- WP-14：`make e2e`、`make e2e-auth`、`make asset-budget`。

### 旧套件名对照

`1209651f` 把 E2E 套件按**用途**重命名，并删掉了整套迁移台账。第 6 节和第 12 节里
按当时名字记录的证据是既成事实，不改写；下表只提供解码器，方便对照今天该跑哪一条。
文档里所有**可执行**的命令由 `tests/guards/doc-references.test.ts` 校验必须真实存在。

| 旧名                                                               | 今天                                                                   |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `e2e-m0`                                                           | 拆成 `e2e-infra` / `e2e-proxy-options` / `e2e-protocol` / `e2e-visual` |
| `e2e-m4a`、`e2e-m4b`、`e2e-m5`、`e2e-m6`、`e2e-m7`、`e2e-m7-local` | 合并进 `e2e`                                                           |
| `e2e-m4a-stream`                                                   | `e2e-stream`                                                           |
| `e2e-m5-real-backend`、`e2e-real-backend`                          | `e2e-real`                                                             |
| `e2e-m6-real-backend`                                              | `e2e-browser`                                                          |
| `e2e-m7-auth`                                                      | `e2e-auth`                                                             |
| `e2e-m7-real-protocol`、`run-protocol-smoke`                       | `e2e-protocol`                                                         |
| `e2e-m7-visual`                                                    | `e2e-visual`                                                           |
| `e2e-wp07-real-backend`                                            | `e2e-scheduled`                                                        |
| `e2e-wp08-real-backend`                                            | `e2e-channels`                                                         |
| `e2e-wp09-real-backend`                                            | `e2e-agents`                                                           |
| `e2e-wp10-real-backend`                                            | `e2e-settings`                                                         |
| `e2e-wp11-real-backend`                                            | `e2e-shell`                                                            |
| `oidc-smoke`、`ws-smoke`                                           | `e2e-external`                                                         |
| `*-list`                                                           | `e2e-list`（一次列出全部套件）                                         |
| `migration-check`                                                  | 已删除：迁移台账、baseline 与 codemod 工具随 `1209651f` 一起移除       |

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

<!-- 历史记录：写的是**当时**跑了哪条命令，不改写。旧名到今天的对照见第 9 节。 -->
<!-- historical-commands:begin -->

| 日期       | 工作包/ID                                                     | 证据                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 备注                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-21 | 基线审计                                                      | React tests 1001/1001；Vue tests 1100/1100；Vue production build 通过                                                                                                                                                                                                                                                                                                                                                                                                                                         | 所有 ID 初始状态为 TODO                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-08-21 | WP-01：`API-01`、`AUTH-01`～`AUTH-03`、`SEC-01`               | 定向 Vitest 62/62；`make proxy-security`：Nitro 12/12、options 2/2、unit 36/36；`make e2e-m7-auth` 10/10；`make oidc-smoke` 2/2；`make verify` 1138/1138 且 production build 通过                                                                                                                                                                                                                                                                                                                             | 本机回环监听环境重跑通过；本地提交、未 push                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-08-21 | WP-02：`STREAM-01`、`STREAM-02`、`THREAD-01`～`THREAD-05`     | `make e2e-m4a` 4/4；`make e2e-m4a-stream` 6/6；`make e2e-m7` 130/130；`make e2e-m7-real-protocol` 1/1；`make migration-check` 通过；`make verify` 1166/1166 且 production build 通过；React `pnpm check` 与 `pnpm test` 1001/1001                                                                                                                                                                                                                                                                             | 回环门禁在允许本机监听的环境重跑；未 commit、未 push                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-08-22 | WP-08：`CHANNEL-01`～`CHANNEL-03`                             | WP-08 unit/DOM 21/21；聚焦 Vitest 55/55；M7 channels 11/11、全量 144/144；real Gateway 3/3；WP-07 real 2/2；M4a 4/4、stream 6/6；M7 local 8/8、auth 10/10、real protocol 1/1、visual 7/7；`make migration-check` 通过；`make verify` 159 files / 1358 tests 且 production build 通过                                                                                                                                                                                                                          | 真实 IM/IdP/DNS/TLS/外层代理未验证；未 commit、未 push                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-08-22 | WP-09：`AGENT-01`～`AGENT-03`                                 | WP-09 unit/DOM 8 files / 61 tests；backend focused 56/56；M7 agents 18/18、全量 150/150；real Gateway 3/3；WP-08 real 3/3；WP-07 real 2/2；M4a 4/4、stream 6/6；M7 local 8/8、auth 10/10、real protocol 1/1、visual 7/7；`make migration-check` 通过；`make verify` 165 files / 1394 tests 且 production build 通过                                                                                                                                                                                           | 外部 LLM、生产 provider/凭据、真实 IdP/DNS/TLS/外层代理未验证；未 commit、未 push                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-08-23 | WP-10：`MEMORY-01`～`MEMORY-03`、`SETTINGS-01`                | WP-10 unit/DOM 5 files / 59 tests；backend focused 210/210；Ruff check/format 通过；M7 settings 6/6、全量 156/156；WP-10 real Gateway 5/5（DeerMem + Noop，400/404/409/422/500/501）；WP-09 real 3/3；WP-08 real 3/3；WP-07 real 2/2；M4a 4/4、stream 6/6；M7 local 8/8、auth 13/13、real protocol 1/1、visual 7/7；`make migration-check` 通过；`make verify` 170 files / 1454 tests 且 production build 通过                                                                                                | Mem0/Honcho/OpenViking、外部 MCP/LLM、生产 IdP/凭据/DNS/TLS/外层代理未验证；未 commit、未 push                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-08-23 | WP-11：`SHELL-01`～`SHELL-03`、`CHANGES-01`                   | WP-11 unit/DOM + guard 9 files / 58 tests；M7 workspace shell 4/4、全量 160/160；M7 local 8/8、auth 13/13、real protocol 1/1、visual 7/7（baseline 无差异）；WP-11 real Gateway/Nuxt 1/1；WP-10 real 5/5；M4a 4/4、stream 6/6；`make migration-check` 通过；`make verify` 178 files / 1497 tests 且 production build 通过；asset budget、container smoke、backend 11313 passed / 72 skipped；`git diff --check` 通过                                                                                          | real gate 保留生产 Auth/CSRF/owner/event-store/changes router；seed event 与恢复 503 为受控 fixture；生产 IdP/DNS/TLS/外层代理未验证；本地提交 `a1ef9a2f`、未 push                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-08-23 | WP-12：`I18N-01`、`THEME-01`                                  | WP-12 unit/DOM 4 files / 14 tests；i18n 各 978 keys / 180 unused 与 AST guard 通过；M7 i18n/theme 5/5、全量 165/165；M7 local 8/8、auth 13/13、real protocol 1/1、visual 8/8；WP-10 real 5/5、WP-11 real 1/1；M4a 4/4、stream 6/6；`make migration-check`、`make verify`、asset budget、container smoke、React check/test 1001/1001、dual-frontend production check 34/34 通过                                                                                                                                | 两个视觉 baseline 因预期文案/新增 zh-CN 状态精确更新；生产 IdP/DNS/TLS/外层代理与目标环境切流未验证；未暂存、未提交、未 push                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-08-24 | WP-03：`MESSAGE-06`                                           | 天气流程定向 Vitest 5 files / 31 tests；`make verify` 186 files / 1528 tests 且 production build 通过；`make migration-check`；`make e2e-m4a` 4/4、真实分片 stream 6/6；`make e2e-m7` 29 files / 166/166；M7 visual 中本轮相关 streaming 与 reasoning/tool 2/2；`git diff --check` 通过；真实双端分别提交“今天的天气”，完成态均为单次 web search、reasoning 收起、无 raw `<think`、无重复工具结果、列表标记恢复；Vue 交叉渲染 React 已完成线程保持同一结构与正文                                              | 外部模型两次独立采样的搜索词、token 和最终文案不要求逐字相同；wire context 由 production stream test 固定为同 mode/effort。M7 visual 全量 6/8，失败的 mobile/dark 是本轮未改的欢迎页快捷按钮旧 baseline，未刷新；仅改 `frontend-vue`，未暂存、未提交、未 push                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-08-24 | WP-13：`MESSAGE-02`、`MESSAGE-07`、`SURFACE-01`、`SURFACE-02` | `make verify` 190 files / 1537 tests 且 production build 通过；`make migration-check`；`make e2e-m4a` 4/4、真实分片 stream 6/6；`make e2e-m7` 29 files / 168/168；product-surface guard 固定 route 例外、feedback 缺席、独立资产与附件语义入口；同一真实天气 thread 双端均显示处理步骤、reasoning、GFM 表格及复制/下载/全屏，Vue 不再显示点赞/踩，header/sidebar/message/composer 操作集合按 React 调用点收口                                                                                                 | 第 2 节明确排除的 landing、docs/blog、静态 demo/mock 与框架内部实现仍不要求同构；模型文案、token 与耗时不作为 UI parity 判据；仅改 `frontend-vue`，未暂存、未提交、未 push                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-08-24 | WP-13 follow-up：`SURFACE-03`                                 | 定向 unit/DOM 4 files / 25 tests；thread-history 几何合同通过；`make e2e-m7` 29 files / 168/168；`make verify` 190 files / 1537 tests 且 production build 通过；1280×720 真实双端测量：操作按钮均 32×32 px、横向步进 36 px、图标 16/16/12 px、操作到耗时 8 px、composer 均 816×116 px 且距 viewport 底部 16 px，React/Vue 耗时到 composer 分别为 71.5/72 px                                                                                                                                                   | 使用共享 `Button`、独立 `AssistantTurnActions`、显式消息尾部 spacer、双侧稳定 scrollbar gutter 与统一 `ComposerSurface` slot 合同完成结构收口；main/sidecar 共用同一几何 owner；仅改 `frontend-vue`，未暂存、未提交、未 push                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-08-24 | React/Vue 对话流程根因收口                                    | Vue 定向 unit/DOM 2 files / 10 tests；locale production hydration 压测 10/10；`make e2e-m4a` 4/4、真实分片 stream 6/6、`make e2e-m7` 29 files / 169/169、`make migration-check`、`make verify` 190 files / 1540 tests 与 production build 通过；React `pnpm check`、130 files / 1006 unit、全量 E2E 143/143 通过；真实 Gateway 同一 thread 完成 React→Vue 读取、Vue 流式续聊与 React 回读                                                                                                                     | 消息尾部/虚拟高度由结构 padding owner 持有，run activity 独立于语义 list；sidecar 用单一 `composerBusy` 锁定提交；React streaming 按钮暴露 Stop；Playwright 固定独占端口且不复用未知服务；locale/theme 测试只经产品 owner；当前修复未暂存、未提交、未 push                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-08-25 | WP-14：`EDITOR-01`、`SURFACE-04`、`AUTH-04`                   | `make verify` 192 files / 1577 tests 且 production build 通过（新增 code-editor 语言表 26 条、L2 CodeEditor DOM 9 条）；`make e2e-mock` 5 套件 240 tests（230 → 240：artifact 编辑器 4 条、mode guide 4 条、认证页离线 2 条）；`make e2e-backend` 8 套件 21 tests；`make e2e-visual` 8/8 且**无需重生成基线**；`make asset-budget` 通过，`vendor-codemirror` 由刻意为零改为实测 raw 555_743 / gzip 199_712 / maxRaw 199_773，整包上限同步抬到 14_800_000 / 3_400_000；`make standalone-check` BLOCKING 仍为 0 | 三条新用例已在父提交 `b02fd587` 上逐条验证：artifact 编辑器 4 条与 mode guide 4 条全红，认证页离线 2 条**全绿**——后者证明 React `gateway-offline-fallback.tsx` 针对的死锁在 Vue 结构上不存在，它是回归护栏而不是新能力。视觉基线未变的原因是 `artifact` 快照走的是 write-file 预览、从不进入编辑态，不是被 `maxDiffPixelRatio` 吞掉；composer 几何由 sidecar-chat 的实测断言守着。`PARITY_GAPS.md` 的文档级 `../frontend` 引用因新增 WP-14 的 React 基线链接由 4 处增至 8 处。仅改 `frontend-vue/`；生产 IdP/DNS/TLS/外层代理与目标环境切流仍未验证。                                                                                                                                                                                                                                                                                                    |
| 2026-08-25 | 文档引用彻底修复                                              | `make verify` 193 files / 1587 tests 且 production build 通过；新增 `tests/guards/doc-references.test.ts` 10 条；文档中 34 个 make 命令逐条 `make -n` 验证可解析（31 个本模块 + 3 个仓库根）；`make e2e-list` 15 个 config 全部收集成功                                                                                                                                                                                                                                                                       | `1209651f` 按用途重命名 E2E 套件并删除迁移台账后，文档整整落后一个版本：README/README_zh/ARCHITECTURE/REUSE/PARITY_GAPS §9 与两处测试文件里共 20 个已删除 target、上百处引用，敲下去全是 `No rule to make target`，而所有门禁一路全绿——没有任何一条检查读过文档。同类腐烂一并清掉：`app/core/PROVENANCE.md` 死链、`tests/m5-real-backend`/`tests/m6`/`tests/m6-real-backend`/`tests/m7`/`tests/m0-real-backend` 等改名前路径、`tests/guards/product-surface-parity.test.ts` 与 ARCHITECTURE L3 行里已不存在的 `app/stores/`。第 6、12 节的历史证据按当时名字保留，用 `<!-- historical-commands -->` 显式圈出，旧名到今天的对照见第 9 节。新门禁以四类变异实测会红：文档写死名字、README 漏列套件、Makefile 加套件不写文档、死链；恢复后全绿。README 不再抄写 test 数，改为指向 `make e2e-list`——抄进散文的数字正是最先过期的东西。仅改 `frontend-vue/`。 |

<!-- historical-commands:end -->
