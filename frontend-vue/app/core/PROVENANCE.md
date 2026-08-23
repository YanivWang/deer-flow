# app/core 溯源台账

`app/core/` 里**每个文件**都必须在下表有一行。新增文件不登记，`tests/guards/core-provenance.test.ts` 就红。

分类含义如下；分层与依赖方向见 [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md)：

| 分类      | 含义                                                        | 是否校验 hash |
| --------- | ----------------------------------------------------------- | ------------- |
| `COPIED`  | 从 `frontend/src/core/` **零改动**复制                      | ✅ 强制       |
| `RETYPED` | 只改 import（去 LangChain 类型 / `@/env` / 依赖不迁的模块） | ❌            |
| `ADAPTED` | runtime / mock / React 耦合改写                             | ❌            |
| `ADDED`   | 无 React 对应物                                             | ❌            |

`COPIED` 那一档与 `baseline/core-sha256.json` 逐字节比对。**「顺手改一行」就会让 hash 对不上**——
这正是要点：真需要改，就把它降级成 `RETYPED`/`ADAPTED` 并在「说明」里写清理由，
而不是去改 baseline。降级要在 review 里被看见。

完整来源清单见 `baseline/core-manifest.json`，由
`make baseline-refresh` 生成。本表只记录**已经落到 `app/core/` 的文件**。

## 台账

| 文件                                  | 分类      | 来源                                                           | 说明                                                                                                                                                                                   |
| ------------------------------------- | --------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth/decision.ts`                    | `ADDED`   | —                                                              | M0 路由跳转纯函数。上游 `auth/auth-disabled-user.ts` 读 `process.env`，此处改为接收注入值，不是它的复制品。                                                                            |
| `auth/callback.ts`                    | `ADAPTED` | `app/(auth)/auth/callback/page.tsx`                            | WP-01：把 React callback 的 session 判定与 safe-next 跳转收敛成 Vue 可测纯函数，明确区分成功、401 与 Gateway 不可用。                                                                  |
| `auth/client-state.ts`                | `ADAPTED` | `core/auth/AuthProvider.tsx`                                   | 认证主体切换的唯一浏览器状态清理边界；整树清空不含 user id 的 Query 缓存与 composer 草稿，防止换账号后短暂显示上一用户数据。                                                           |
| `auth/session.ts`                     | `ADDED`   | —                                                              | M7 Gateway session 探针；明确区分 401 未登录、合法用户与 Gateway/响应不可用，供 Nuxt middleware 使用。                                                                                 |
| `auth/session-query.ts`               | `ADAPTED` | `core/auth/AuthProvider.tsx`                                   | WP-01：以 TanStack Vue Query 统一 middleware、callback 和 workspace 的 session server state；不复制 React context。                                                                    |
| `browser/connection.ts`               | `ADAPTED` | `components/workspace/browser-view/use-browser-stream.ts`      | WP-05：把 React effect 内连接逻辑收敛为可测的唯一 WS owner，补齐 pending navigate、有界退避、generation 清理和 REST fallback 交接。                                                    |
| `browser/frame.ts`                    | `ADAPTED` | `components/workspace/messages/message-list.tsx`               | WP-05：只从当前线程 Gateway ToolMessage 的 `browser_view` 元数据恢复静态帧，不从 UI 或 artifact 名称推断，并防止已观察的旧消息帧覆盖新的 REST 权威截图。                               |
| `browser/geometry.ts`                 | `ADAPTED` | `components/workspace/browser-view/browser-view-panel.tsx`     | WP-05：提取 object-contain 内容盒坐标和 wheel delta 归一化，显式拒绝 letterbox 外指针。                                                                                                |
| `browser/keyboard.ts`                 | `ADAPTED` | `components/workspace/browser-view/keyboard.ts`                | WP-05：保留 React 的远端 text/key 语义，并补齐 keyup、IME 与宿主浏览器/系统快捷键边界。                                                                                                |
| `browser/protocol.ts`                 | `ADAPTED` | `components/workspace/browser-view/use-browser-stream.ts`      | WP-05：集中声明 Gateway 已存在的 browser 输入、tab 与连接状态；不发明 live/static wire 字段。                                                                                          |
| `artifacts/actions.ts`                | `ADAPTED` | `components/workspace/artifacts/artifact-file-detail.tsx`      | WP-06：open/download 在浏览器动作前通过既有 GET + Range 预检，保留 Gateway status/detail，不伪造成功。                                                                                 |
| `artifacts/draft.ts`                  | `ADAPTED` | `core/artifacts/editing.ts`                                    | WP-06：将 baseline、latest remote、dirty draft 与 412 冲突收敛成纯状态机，远端刷新不覆盖用户草稿。                                                                                     |
| `artifacts/loader.ts`                 | `ADAPTED` | `core/artifacts/loader.ts`                                     | WP-06：加载受显式 text policy 约束，去掉 `.skill` 隐式文本分支，保留 Gateway detail，并接受 AbortSignal。                                                                              |
| `artifacts/policy.ts`                 | `ADAPTED` | `core/utils/files.tsx`                                         | WP-06：显式 allowlist 分类和加载/保存/install 能力；未知、无扩展名、SVG、Office 与归档 fail closed。                                                                                   |
| `artifacts/preview-policy.ts`         | `ADAPTED` | `core/artifacts/preview.ts`                                    | WP-06：正式 HTML 必须完整且未截断才可 iframe；write_file 的流式前缀和完成态 D3 边界分离。                                                                                              |
| `async/generation.ts`                 | `ADDED`   | —                                                              | WP-03：route/thread/generation 的框架无关 stale guard；由 composer 与 post-run suggestions 共用，替代散落的 mounted flag。                                                             |
| `input/ime.ts`                        | `ADAPTED` | `lib/ime.ts`                                                   | M7 输入法保护纯函数；去掉 React `nativeEvent` 包装，保留 composition state、`isComposing` 与 Safari keyCode 229 三重判定。                                                             |
| `input/keyboard.ts`                   | `ADDED`   | —                                                              | M7 全局键盘边界；识别 input/textarea/select/contenteditable，防止 sidebar 快捷键劫持合法文本输入。                                                                                     |
| `integrations/lark/flow.ts`           | `ADAPTED` | `integrations/lark/api.ts`                                     | 当前 Gateway generation 与凭据切换合同的 Vue 所有者；保留冻结 COPIED 文件不动，避免兼容层或伪造字段。                                                                                  |
| `types/message.ts`                    | `ADDED`   | —                                                              | 替代 `@langchain/langgraph-sdk` 的 wire 类型，16 个 RETYPED 指向它（06 §M1 1b）。上游没有对应文件——它借的是 SDK 的类型。                                                               |
| `types/message.contract.ts`           | `ADDED`   | —                                                              | `AgentMessageContent` 联合的类型层护栏。放 `app/` 而不是 `tests/`，因为 `tests/` 不过 vue-tsc。                                                                                        |
| `scheduled-tasks/schedule.ts`         | `ADDED`   | —                                                              | `ScheduleValue` 从 React 组件文件搬进 core，纠正依赖方向（06 §M1 1b 的 `retype-component-type`）。                                                                                     |
| `scheduled-tasks/api.ts`              | `ADAPTED` | `scheduled-tasks/api.ts`                                       | WP-07：增加可取消的详情与 limit/offset runs 查询，并把 create/PATCH payload 收窄到 Gateway 实际字段。                                                                                  |
| `scheduled-tasks/form.ts`             | `ADAPTED` | `app/workspace/scheduled-tasks/page.tsx`                       | WP-07：把 create/edit/context/recipe payload 与 DST 严格往返从 React 页面和组件收敛成可测纯逻辑。                                                                                      |
| `scheduled-tasks/query-keys.ts`       | `ADAPTED` | `core/scheduled-tasks/hooks.ts`                                | WP-07：用集中 key/invalidation 合同替代 React hook 内分散失效，runs 只绑定对应 task。                                                                                                  |
| `scheduled-tasks/view-model.ts`       | `ADAPTED` | `app/workspace/scheduled-tasks/page.tsx`                       | WP-07：完整覆盖 Gateway 六种 task status、两种 schedule type 和确定性 selection 恢复。                                                                                                 |
| `channels/api.ts`                     | `ADAPTED` | `channels/api.ts`                                              | WP-08：给用户 scope 查询和全部 lifecycle mutation 透传 AbortSignal，错误仍统一走 Gateway 保真解析。                                                                                    |
| `channels/connect-poll.ts`            | `ADAPTED` | `channels/connect-poll.ts`                                     | WP-08：有限 deadline、显式 expired、在途 abort，并忽略发起绑定前已有账号，避免多账号新增误判成功。                                                                                     |
| `channels/provider-state.ts`          | `ADAPTED` | `channels/provider-state.ts`                                   | WP-08：connectability 只描述 provider capability；删除以 provider summary status 阻止新增多账号的旧分支。                                                                              |
| `channels/query-keys.ts`              | `ADDED`   | —                                                              | WP-08：providers/connections 按认证用户 scope 隔离的唯一 Vue Query key 合同。                                                                                                          |
| `channels/state.ts`                   | `ADAPTED` | `settings/channels-settings-page.tsx`                          | WP-08：provider 只保留能力/配置；用户展示状态和多账号列表只从 connections 响应推导。                                                                                                   |
| `i18n/locales/en-US.ts`               | `ADAPTED` | `i18n/locales/en-US.ts`                                        | WP-07–12 的 Vue-owned scheduled tasks、channels、Agents、Settings、workspace shell 与完整产品面英文词典扩展。                                                                          |
| `i18n/locales/types.ts`               | `ADAPTED` | `i18n/locales/types.ts`                                        | WP-07–12 逐键声明对应 Vue-owned 词典扩展与 formatter，不放宽其他翻译类型。                                                                                                             |
| `i18n/locales/zh-CN.ts`               | `ADAPTED` | `i18n/locales/zh-CN.ts`                                        | WP-07–12 的匹配中文文案，逐键对齐英文并保留动态参数。                                                                                                                                  |
| `threads/export.ts`                   | `ADAPTED` | `threads/export.ts`                                            | WP-11 保留 React 序列化/文件名/MIME 合同，并用 finally 保证下载 click 抛错时仍移除临时 anchor、回收 object URL。                                                                       |
| `threads/thread-actions.ts`           | `ADAPTED` | `components/workspace/recent-chat-list.tsx`                    | WP-11：share 仅生成稳定 URL 并写剪贴板；export 从真实 thread state 加载消息，不发明 share API。                                                                                        |
| `threads/updated-time.ts`             | `ADAPTED` | `core/utils/datetime.ts`                                       | WP-11：以 Gateway `updated_at` 的绝对时间差生成 locale-aware 相对时间；缺失/非法值不渲染。                                                                                             |
| `workspace-changes/api.ts`            | `ADAPTED` | `workspace-changes/api.ts`                                     | WP-11：透传 Query AbortSignal，并复用保真 Gateway status/detail 错误解析。                                                                                                             |
| `workspace-changes/presentation.ts`   | `ADAPTED` | `components/workspace/changes/workspace-change-panel.tsx`      | WP-11：完整映射四种 status 与五种 diff unavailable reason；null 使用明确 fallback。                                                                                                    |
| `workspace-changes/query-keys.ts`     | `ADAPTED` | `workspace-changes/hooks.ts`                                   | WP-11：thread/run/include_files/include_diff 共同构成唯一 Vue Query identity，隔离 summary/detail 与 stale response。                                                                  |
| `workspace-shell/gateway-recovery.ts` | `ADAPTED` | `components/workspace/gateway-offline-banner.tsx`              | WP-11：只在 unavailable 到 authenticated 的真实边沿发恢复通知，初始健康状态不误报。                                                                                                    |
| `workspace-shell/settings-query.ts`   | `ADAPTED` | `components/workspace/workspace-settings-deep-link.tsx`        | WP-11：集中校验 settings section，并在用户关闭时只移除 settings query、保留其他 query/hash。                                                                                           |
| `workspace-shell/shortcuts.ts`        | `ADAPTED` | `hooks/use-global-shortcuts.ts`                                | WP-11：精确匹配跨平台 K/Shift-N/comma/slash/B，拒绝 repeat、IME、Alt、双 command modifier，并识别 editable targets。                                                                   |
| `workspace-shell/toast.ts`            | `ADAPTED` | `app/workspace/workspace-content.tsx`                          | WP-11：workspace layout 单例可访问 toast owner，统一 success/error、dismiss 与 timer 清理。                                                                                            |
| `theme/bootstrap.ts`                  | `ADAPTED` | `components/theme-provider.tsx`                                | WP-12：按 React `next-themes` 的 `class`/`system`/storage 可观察合同生成 head 首屏脚本，只负责 mount 前 class 与 color-scheme，不建立第二个 listener。                                 |
| `theme/controller.ts`                 | `ADAPTED` | `components/theme-provider.tsx`                                | WP-12：Nuxt 应用级唯一 theme owner；校验三态 storage，system 实时同步 media，显式主题稳定，并提供幂等 listener cleanup。                                                               |
| `api/client.ts`                       | `ADDED`   | —                                                              | M2 自写的 7 个 REST 方法，替代 SDK `Client`（02 §249）。上游没有对应文件——那部分职责在 SDK 里。                                                                                        |
| `api/errors.ts`                       | `ADAPTED` | `api/errors.ts`                                                | WP-02：统一全部 Gateway REST 错误解析，兼容旧导出同时保留 HTTP status、结构化 body 与原始正文。                                                                                        |
| `api/stream-mode.ts`                  | `ADAPTED` | `api/stream-mode.ts`                                           | 本地 Docker 真实模型验收：保留共享 stream-mode 白名单校验，删除对 SDK run option 的静默剥离；Vue wire 生产者显式跟随 React/backend 的 non-resumable + continue 语义。                  |
| `api/types.gen.ts`                    | `ADDED`   | —                                                              | **生成物，勿手改。** `make gen-api-types` 从 `baseline/openapi.snapshot.json` 生成（02 §340 / 04 §267）。上游对应物是 SDK 借来的 REST 信封类型。                                       |
| `api/api-client.ts`                   | `ADAPTED` | `api/api-client.ts`                                            | M2 REWRITE。上游 471 行里大部分是给 SDK 打补丁，没有 SDK 就没有补丁的对象；有意不搬的三样写在文件头。                                                                                  |
| `agent-deerflow/endpoints.ts`         | `ADDED`   | —                                                              | L3：run 相关 URL 与 `Content-Location` 解析（05 L12）。上游散在 SDK 内部。                                                                                                             |
| `agent-deerflow/event-map.ts`         | `ADDED`   | —                                                              | L3：wire 事件名 → 流走向，内核唯一的协议知识入口（08 §288）。                                                                                                                          |
| `agent-deerflow/gap.ts`               | `ADDED`   | —                                                              | L3：重放缺口载荷解析与 `gap → replay_gap` 映射。解析逻辑取自上游 `api-client.ts`，但落点与用途都变了。                                                                                 |
| `agent-deerflow/run-protocol.ts`      | `ADDED`   | —                                                              | L3：内核 `RunProtocol` 的 DeerFlow 实现（create/resume/cancel/inspect）。                                                                                                              |
| `agent-deerflow/message-adapt.ts`     | `ADDED`   | —                                                              | L3：wire 消息 ⇄ 内核归一化消息的双向适配（08 §111 点名的 round-trip）。上游没有这一层——它直接用 SDK 的 wire 类型当内存模型。                                                           |
| `agent-deerflow/reducer.ts`           | `ADDED`   | —                                                              | L3：wire 事件 → 归约动作（08 §事件与完整状态归约）。上游散在 SDK StreamManager 与组件生命周期里。                                                                                      |
| `agent-deerflow/gap-recovery.ts`      | `ADDED`   | `api/api-client.ts`                                            | L3：05 A4–A6 的 rejoin 预算。**不是** `recoverStreamReplayGaps` 的搬运——上游的 sessionStorage 重连簿记在这里没有对象，见文件头。                                                       |
| `markdown/plugins.ts`                 | `ADAPTED` | `streamdown/plugins.ts`                                        | M3 REWRITE。上游 98 行里只有 `rehypeStreamingListItems` 能搬（逐字），其余 import 了 `@streamdown/code` / `@streamdown/mermaid` / `streamdown`。另补上 Streamdown 内建默认链的等价物。 |
| `markdown/pipeline.ts`                | `ADDED`   | —                                                              | M3：unified 管线装配。上游没有对应文件——这段在 `streamdown` 包内部（它 fork 了 react-markdown）。装配顺序从其 dist 读出。                                                              |
| `markdown/blocks.ts`                  | `ADDED`   | —                                                              | M3：marked 分块 + 块 key。同上，上游在包内部。                                                                                                                                         |
| `markdown/render.ts`                  | `ADDED`   | —                                                              | M3：hast → Vue vnode，含逐词动画的稳定 key 注入。上游那一步是 `toJsxRuntime(react/jsx-runtime)`，没有独立文件。                                                                        |
| `markdown/animate.ts`                 | `ADDED`   | —                                                              | M3：切词的纯计算。上游把动画交给 Streamdown 的 `animated` prop，没有对应源码。                                                                                                         |
| `markdown/links.ts`                   | `ADAPTED` | `components/workspace/messages/markdown-link.tsx`              | WP-01：提取 React MarkdownLink 的协议 allowlist 与外链判定，保留可观察安全语义，由 Vue 组件处理 artifact/citation。                                                                    |
| `markdown/safe-markdown.ts`           | `ADAPTED` | `streamdown/safe-children.ts`                                  | M3 REWRITE。上游 34 行里 30 行是 React（children 联合类型 + 两个 `useMemo`），真正的逻辑是一行组合；记忆化归组件的 `computed`，不进 core。                                             |
| `messages/attachments.ts`             | `ADAPTED` | `components/workspace/messages/message-list-item.tsx`          | WP-03：集中校验现代 `files` 并兼容持久化的 current/legacy upload 标签，历史刷新不依赖 composer 本地状态。                                                                              |
| `models/capabilities.ts`              | `ADAPTED` | `components/workspace/input-box.tsx`                           | WP-03：把 agent 默认模型、thinking mode 与 reasoning effort 的能力归一化抽成纯函数；不支持字段按 Gateway 语义省略。                                                                    |
| `threads/message-identity.ts`         | `ADAPTED` | `threads/hooks.ts`                                             | M4a 消息身份/去重；WP-03 进一步把 Gateway 历史行上的 run feedback 携带到渲染消息，刷新后仍可恢复反馈状态。                                                                             |
| `threads/history.ts`                  | `ADAPTED` | `threads/hooks.ts`                                             | M4a：历史分页协议（05 C1/C6）。相对上游多一个显式的 `origin` 参数，理由见文件头。                                                                                                      |
| `threads/message-merge.ts`            | `ADAPTED` | `threads/hooks.ts`                                             | M4a：三路归并与压缩瞬态桥（05 C1–C4）。**函数体有意逐字**，05 C 组原话「不要重新设计」。                                                                                               |
| `threads/local-turn-order.ts`         | `ADAPTED` | `threads/hooks.ts`                                             | M4a：C8 的排序规则。基线的生命周期（C9）留在 `useThreadStream`，分家理由见文件头。                                                                                                     |
| `threads/coalesce.ts`                 | `ADAPTED` | `threads/hooks.ts`                                             | M4a：渲染合帧判定。**不是 05 A1**（那条在 L1 的 external store），是它之上的第二层。                                                                                                   |
| `threads/infinite.ts`                 | `ADAPTED` | `threads/hooks.ts`                                             | M4a：侧栏无限列表的取数与缓存镜像。本仓第一处 import `@tanstack/vue-query`。                                                                                                           |
| `threads/cache-invalidation.ts`       | `ADAPTED` | `threads/hooks.ts`                                             | M4a：05 A7/A8。相对上游删掉 `isMock` 形参（M4a 删 mock 分支），metadata key 少一段；A8 的 6 个 key 提成 `THREAD_CACHE_KEYS` 一张表。                                                   |
| `threads/submit.ts`                   | `ADAPTED` | `threads/hooks.ts`                                             | M4a 合并两处 run context；WP-03 在最终 payload 前按实际模型能力规范化 mode/effort，并对不支持的 reasoning 字段执行省略语义。                                                           |
| `threads/composer-draft-lifecycle.ts` | `ADAPTED` | `threads/composer-draft.ts`                                    | WP-03：在既有 draft key 之上集中提供按 user/agent/thread 枚举清理，供成功退出登录与确认删除线程后的生命周期收口。                                                                      |
| `threads/goal.ts`                     | `ADAPTED` | `components/workspace/input-box-helpers.ts`                    | M6：保留 React 的 `/goal` 命令边界、4000 字符限制与错误正文规则；去掉 React 提交动作类型，只导出 Vue composer 和 goal 状态组件共用的纯函数。                                           |
| `threads/api.ts`                      | `ADAPTED` | `threads/api.ts`                                               | WP-02：`/compact` 等 Gateway 写操作统一使用 Vue 的保真响应错误，保留 HTTP status、detail 与原始正文。                                                                                  |
| `threads/compact-command.ts`          | `ADDED`   | —                                                              | WP-02：`/compact` 与 `/context compact` 的完整命令识别，避免把普通消息误判为内建命令。                                                                                                 |
| `threads/delete.ts`                   | `ADAPTED` | `threads/hooks.ts`                                             | WP-02：全量搜索 parent sidecar、并发删除、主 thread 后删，并将部分失败 ID 交给可见重试 UI。                                                                                            |
| `sidecar/session-lifecycle.ts`        | `ADDED`   | —                                                              | WP-04：每个主 thread 的 restore-before-create 状态机、并发合流、错误与 stale/dispose 边界；不保存模块级 session 状态。                                                                 |
| `uploads/submission-files.ts`         | `ADDED`   | —                                                              | WP-04：主 composer 与 sidecar 共用的最终 thread 上传、FileInMessage 映射和成功上传重试缓存。                                                                                           |
| `threads/thread-snapshot.ts`          | `ADAPTED` | `threads/hooks.ts`                                             | WP-02：列表稀疏快照与已缓存详细 thread state 的稳定合并。                                                                                                                              |
| `tasks/custom-event.ts`               | `ADAPTED` | `threads/hooks.ts`                                             | WP-02：统一归约 task 生命周期、步骤、模型、token、llm_retry 与 replay-gap；终态和累计用量单调。                                                                                        |
| `tasks/view-model.ts`                 | `ADAPTED` | `components/workspace/messages/subtask-card.tsx`               | WP-02：将实时步骤、历史 backfill 与 terminal tool result 合并成 Vue SubtaskCard 的纯展示模型。                                                                                         |
| `agent-deerflow/thread-runner.ts`     | `ADDED`   | —                                                              | M4a：L1 内核 + L3 协议的装配层，M2 内核的第一个真实调用方。上游对应物在 SDK 内部（StreamManager），没有源文件。                                                                        |
| `i18n/resolve.ts`                     | `ADDED`   | —                                                              | M4a：按点分路径取文案。上游没有对应物——它的 core 与 React 同处一层，直接写属性访问；这里 core 只发字典 key（A7），取文案在 UI 边界。                                                   |
| `i18n/cookies.ts`                     | `ADAPTED` | `i18n/cookies.ts`                                              | M4a REWRITE（05 N4）。持久化格式逐字保留（改名 = 老用户丢语言偏好）；上游第三个函数 `getLocaleFromCookieServer` import `next/headers`，不迁。                                          |
| `markdown/index.ts`                   | `ADAPTED` | `streamdown/index.ts`                                          | M3：公共导出面。不导出 `./components`（Vue 组件不进 core），并从 `../streamdown/` 转出 COPIED 的 preprocess / mermaid，让调用方只认一个入口。                                          |
| `agents/api.ts`                       | `ADAPTED` | `agents/api.ts`                                                | WP-09：接入认证 fetch、统一 Gateway status/detail，并为 Vue Query 与创建验证提供 AbortSignal；不再由组件持有 server state。                                                            |
| `agents/creation-session.ts`          | `ADAPTED` | `app/workspace/agents/new/page.tsx`                            | WP-09：仅用真实 setup_agent call ID 与 ToolMessage.status 判定保存结果，并生成 hide_from_ui 保存提交。                                                                                 |
| `agents/presentation.ts`              | `ADAPTED` | `components/workspace/agents/agent-card.tsx`                   | WP-09：保留 model、skills、tool_groups 的真实响应顺序，并区分 null 不限制与空 whitelist。                                                                                              |
| `agents/query-keys.ts`                | `ADDED`   | —                                                              | WP-09：集中声明 Agent list/detail Vue Query identity，供创建、更新与删除统一同步。                                                                                                     |
| `agents/settings.ts`                  | `ADAPTED` | `components/workspace/agents/agent-settings-dialog-helpers.ts` | WP-09：按真实模型 capability 生成 exact PUT body，保留 false/0/null 并校验温度与 max_tokens。                                                                                          |
| `mcp/api.ts`                          | `ADAPTED` | `mcp/api.ts`                                                   | WP-10：接入可取消的唯一 query owner 与保真 Gateway 错误，显式分类 admin-required 403。                                                                                                 |
| `mcp/query-keys.ts`                   | `ADDED`   | —                                                              | WP-10：MCP config 的唯一 Vue Query identity。                                                                                                                                          |
| `memory/api.ts`                       | `ADAPTED` | `memory/api.ts`                                                | WP-10：全部 Memory 请求可取消且保留 Gateway status/detail，完整响应回填单一缓存。                                                                                                      |
| `memory/query-keys.ts`                | `ADDED`   | —                                                              | WP-10：Memory document 的唯一 Vue Query identity。                                                                                                                                     |
| `memory/schema.ts`                    | `ADAPTED` | `components/workspace/settings/memory-settings-page.tsx`       | WP-10：把 React import guard 提升为完整运行时 schema；extra 保留并警告，duplicate ID 拒绝，duplicate content 显式保留。                                                                |
| `memory/types.ts`                     | `ADAPTED` | `memory/types.ts`                                              | WP-10：复用生成 Fact 合同并保留 response/import 的 metadata 与 forward fields。                                                                                                        |
| `memory/view-model.ts`                | `ADAPTED` | `components/workspace/settings/memory-settings-page.tsx`       | WP-10：集中 fact 表单、显式 0、PATCH omission 与 search/filter/empty 规则。                                                                                                            |
| `settings/permissions.ts`             | `ADAPTED` | `core/auth/AuthProvider.tsx`                                   | WP-10：从唯一 session/auth-disabled synthetic admin 派生 Skills read/manage 与 MCP admin-only 权限，不引入 static-only 假角色。                                                        |
| `skills/api.ts`                       | `ADAPTED` | `skills/api.ts`                                                | WP-10：catalog/toggle 可取消，GET 与 admin-only PUT 的错误语义分离。                                                                                                                   |
| `skills/type.ts`                      | `ADAPTED` | `skills/type.ts`                                               | WP-10：按真实 Gateway SkillResponse 把 license 收窄为 string 或 null。                                                                                                                 |

<!-- COPIED:BEGIN 由 `make land-copied` 生成，勿手改 -->

| `agents/feature-cache.ts` | `COPIED` | `agents/feature-cache.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `agents/types.ts` | `COPIED` | `agents/types.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `api/feedback.ts` | `COPIED` | `api/feedback.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `api/fetcher.ts` | `COPIED` | `api/fetcher.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `api/index.ts` | `COPIED` | `api/index.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `artifacts/api.ts` | `COPIED` | `artifacts/api.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `artifacts/editing.ts` | `COPIED` | `artifacts/editing.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `artifacts/index.ts` | `COPIED` | `artifacts/index.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `artifacts/preview.ts` | `COPIED` | `artifacts/preview.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `auth/constants.ts` | `COPIED` | `auth/constants.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `auth/next-path.ts` | `COPIED` | `auth/next-path.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `auth/proxy-policy.ts` | `COPIED` | `auth/proxy-policy.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `auth/remember-login.ts` | `COPIED` | `auth/remember-login.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `auth/setup.ts` | `COPIED` | `auth/setup.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `auth/static-user.ts` | `COPIED` | `auth/static-user.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `auth/types.ts` | `COPIED` | `auth/types.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `channels/open-connect-url.ts` | `COPIED` | `channels/open-connect-url.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `channels/types.ts` | `COPIED` | `channels/types.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `citations/sources.ts` | `COPIED` | `citations/sources.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `clipboard.ts` | `COPIED` | `clipboard.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `features/api.ts` | `COPIED` | `features/api.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `i18n/client-translations.ts` | `COPIED` | `i18n/client-translations.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `i18n/index.ts` | `COPIED` | `i18n/index.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `i18n/locale.ts` | `COPIED` | `i18n/locale.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `i18n/locales/index.ts` | `COPIED` | `i18n/locales/index.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `i18n/translations.ts` | `COPIED` | `i18n/translations.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `input-polish/api.ts` | `COPIED` | `input-polish/api.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `integrations/lark/api.ts` | `COPIED` | `integrations/lark/api.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `integrations/lark/types.ts` | `COPIED` | `integrations/lark/types.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `mcp/index.ts` | `COPIED` | `mcp/index.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `mcp/types.ts` | `COPIED` | `mcp/types.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `memory/index.ts` | `COPIED` | `memory/index.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `messages/workspace-change-anchor.ts` | `COPIED` | `messages/workspace-change-anchor.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `models/index.ts` | `COPIED` | `models/index.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `models/types.ts` | `COPIED` | `models/types.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `scheduled-tasks/cron.ts` | `COPIED` | `scheduled-tasks/cron.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `scheduled-tasks/types.ts` | `COPIED` | `scheduled-tasks/types.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `settings/local.ts` | `COPIED` | `settings/local.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `settings/store.ts` | `COPIED` | `settings/store.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `sidecar/api.ts` | `COPIED` | `sidecar/api.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `sidecar/index.ts` | `COPIED` | `sidecar/index.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `sidecar/reference-metadata.ts` | `COPIED` | `sidecar/reference-metadata.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `sidecar/reference-state.ts` | `COPIED` | `sidecar/reference-state.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `sidecar/thread.ts` | `COPIED` | `sidecar/thread.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `skills/index.ts` | `COPIED` | `skills/index.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `skills/slash.ts` | `COPIED` | `skills/slash.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `streamdown/mermaid.ts` | `COPIED` | `streamdown/mermaid.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `streamdown/preprocess.ts` | `COPIED` | `streamdown/preprocess.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `suggestions/api.ts` | `COPIED` | `suggestions/api.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `suggestions/placeholders.ts` | `COPIED` | `suggestions/placeholders.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `tasks/api.ts` | `COPIED` | `tasks/api.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `tasks/index.ts` | `COPIED` | `tasks/index.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `tasks/lifecycle.ts` | `COPIED` | `tasks/lifecycle.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `tasks/presentation.ts` | `COPIED` | `tasks/presentation.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `tasks/steps.ts` | `COPIED` | `tasks/steps.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `tasks/subtask-update.ts` | `COPIED` | `tasks/subtask-update.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `threads/composer-draft.ts` | `COPIED` | `threads/composer-draft.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `threads/index.ts` | `COPIED` | `threads/index.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `threads/thread-list-model.ts` | `COPIED` | `threads/thread-list-model.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `threads/token-usage.ts` | `COPIED` | `threads/token-usage.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `todos/index.ts` | `COPIED` | `todos/index.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `todos/types.ts` | `COPIED` | `todos/types.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `uploads/api.ts` | `COPIED` | `uploads/api.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `uploads/file-validation.ts` | `COPIED` | `uploads/file-validation.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `utils/json.ts` | `COPIED` | `utils/json.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `utils/markdown.ts` | `COPIED` | `utils/markdown.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `utils/uuid.ts` | `COPIED` | `utils/uuid.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `voice-input/speech-recognition.ts` | `COPIED` | `voice-input/speech-recognition.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `workspace-changes/summary.ts` | `COPIED` | `workspace-changes/summary.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `workspace-changes/types.ts` | `COPIED` | `workspace-changes/types.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
<!-- COPIED:END -->

<!-- RETYPED:BEGIN 由 `make land-retyped` 生成，勿手改 -->

| `artifacts/utils.ts` | `RETYPED` | `artifacts/utils.ts` | 依赖不迁的模块（static-mode.ts），该 import 必须删除或改写。 删掉 isStaticWebsiteOnly 早返回与随之无消费方的 staticDemoArtifactURL。 |
| `auth/auth-disabled-user.ts` | `RETYPED` | `auth/auth-disabled-user.ts` | 读 process.env；Nuxt 客户端产物没有该全局，改为接收注入的 runtime options。 |
| `config/index.ts` | `RETYPED` | `config/index.ts` | 改为接收普通 runtime options，纯 core 不调用 useRuntimeConfig()。（@/env → runtime options） |
| `messages/derived-state.ts` | `RETYPED` | `messages/derived-state.ts` | SDK 类型改指向自写 @/core/types/message（06 §M1 1b 的 17 个）。（@langchain/langgraph-sdk → @/core/types/message） |
| `messages/human-input.ts` | `RETYPED` | `messages/human-input.ts` | SDK 类型改指向自写 @/core/types/message（06 §M1 1b 的 17 个）。（@langchain/langgraph-sdk → @/core/types/message） |
| `messages/run-duration.ts` | `RETYPED` | `messages/run-duration.ts` | SDK 类型改指向自写 @/core/types/message（06 §M1 1b 的 17 个）。（@langchain/langgraph-sdk → @/core/types/message） |
| `messages/usage-model.ts` | `RETYPED` | `messages/usage-model.ts` | SDK 类型改指向自写 @/core/types/message（06 §M1 1b 的 17 个）。（@langchain/langgraph-sdk → @/core/types/message） |
| `messages/usage.ts` | `RETYPED` | `messages/usage.ts` | SDK 类型改指向自写 @/core/types/message（06 §M1 1b 的 17 个）。（@langchain/langgraph-sdk → @/core/types/message） |
| `messages/utils.ts` | `RETYPED` | `messages/utils.ts` | SDK 类型改指向自写 @/core/types/message（06 §M1 1b 的 17 个）。（@langchain/langgraph-sdk → @/core/types/message） |
| `models/api.ts` | `RETYPED` | `models/api.ts` | 依赖不迁的模块（static-mode.ts），该 import 必须删除或改写。 删掉 isStaticWebsiteOnly 早返回与随之无消费方的 STATIC_MODELS_RESPONSE。 WP-09 uses abortable authenticated fetch and throws the shared lossless Gateway error for non-2xx model discovery. |
| `scheduled-tasks/recipes.ts` | `RETYPED` | `scheduled-tasks/recipes.ts` | 被引用的类型搬进 core（例：recipes.ts 的 ScheduleValue）。（@/components/workspace/scheduled-task-schedule-input → @/core/…） |
| `sidecar/context.ts` | `RETYPED` | `sidecar/context.ts` | SDK 类型改指向自写 @/core/types/message（06 §M1 1b 的 17 个）。（@langchain/langgraph-sdk → @/core/types/message） |
| `tasks/subtask-result.ts` | `RETYPED` | `tasks/subtask-result.ts` | SDK 类型改指向自写 @/core/types/message（06 §M1 1b 的 17 个）。（@langchain/langgraph-sdk → @/core/types/message） |
| `tasks/types.ts` | `RETYPED` | `tasks/types.ts` | SDK 类型改指向自写 @/core/types/message（06 §M1 1b 的 17 个）。（@langchain/langgraph-sdk → @/core/types/message） |
| `threads/thread-search-query.ts` | `RETYPED` | `threads/thread-search-query.ts` | SDK 类型改指向自写 @/core/types/message（06 §M1 1b 的 17 个）。（@langchain/langgraph-sdk/client → @/core/types/message） |
| `threads/types.ts` | `RETYPED` | `threads/types.ts` | SDK 类型改指向自写 @/core/types/message（06 §M1 1b 的 17 个）。（@langchain/langgraph-sdk → @/core/types/message） |
| `threads/utils.ts` | `RETYPED` | `threads/utils.ts` | SDK 类型改指向自写 @/core/types/message（06 §M1 1b 的 17 个）。（@langchain/langgraph-sdk → @/core/types/message） WP-12 allows Vue UI callers to inject the active locale's untitled label while non-UI export consumers retain the React default. |
| `tools/utils.ts` | `RETYPED` | `tools/utils.ts` | SDK 类型改指向自写 @/core/types/message（06 §M1 1b 的 17 个）。（@langchain/core/messages → @/core/types/message） SDK 类型改指向自写 @/core/types/message（06 §M1 1b 的 17 个）。（@langchain/langgraph-sdk → @/core/types/message） |
| `uploads/prompt-input-files.ts` | `RETYPED` | `uploads/prompt-input-files.ts` | Vercel AI SDK 的类型内联进 @/core/types/message，不装这个包（02 §321）。（ai → @/core/types/message） |
<!-- RETYPED:END -->
