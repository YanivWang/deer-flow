# app/core 溯源台账

`app/core/` 里**每个文件**都必须在下表有一行。新增文件不登记，`tests/guards/core-provenance.test.ts` 就红。

分类含义（[06 §1e](../../../frontend-vue-build-docs/06-migration-plan.md)）：

| 分类      | 含义                                                        | 是否校验 hash |
| --------- | ----------------------------------------------------------- | ------------- |
| `COPIED`  | 从 `frontend/src/core/` **零改动**复制                      | ✅ 强制       |
| `RETYPED` | 只改 import（去 LangChain 类型 / `@/env` / 依赖不迁的模块） | ❌            |
| `ADAPTED` | runtime / mock / React 耦合改写                             | ❌            |
| `ADDED`   | 无 React 对应物                                             | ❌            |

`COPIED` 那一档与 `baseline/core-sha256.json` 逐字节比对。**「顺手改一行」就会让 hash 对不上**——
这正是要点：真需要改，就把它降级成 `RETYPED`/`ADAPTED` 并在「说明」里写清理由，
而不是去改 baseline。降级要在 review 里被看见。

迁移全景（149 个源文件如何分类）见 `baseline/core-manifest.json`，由
`make baseline-refresh` 生成。本表只记录**已经落到 `app/core/` 的文件**。

## 台账

| 文件                              | 分类      | 来源                | 说明                                                                                                                                             |
| --------------------------------- | --------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `auth/decision.ts`                | `ADDED`   | —                   | M0 路由跳转纯函数。上游 `auth/auth-disabled-user.ts` 读 `process.env`，此处改为接收注入值，不是它的复制品。                                      |
| `types/message.ts`                | `ADDED`   | —                   | 替代 `@langchain/langgraph-sdk` 的 wire 类型，16 个 RETYPED 指向它（06 §M1 1b）。上游没有对应文件——它借的是 SDK 的类型。                         |
| `types/message.contract.ts`       | `ADDED`   | —                   | `AgentMessageContent` 联合的类型层护栏。放 `app/` 而不是 `tests/`，因为 `tests/` 不过 vue-tsc。                                                  |
| `scheduled-tasks/schedule.ts`     | `ADDED`   | —                   | `ScheduleValue` 从 React 组件文件搬进 core，纠正依赖方向（06 §M1 1b 的 `retype-component-type`）。                                               |
| `api/client.ts`                   | `ADDED`   | —                   | M2 自写的 7 个 REST 方法，替代 SDK `Client`（02 §249）。上游没有对应文件——那部分职责在 SDK 里。                                                  |
| `api/types.gen.ts`                | `ADDED`   | —                   | **生成物，勿手改。** `make gen-api-types` 从 `baseline/openapi.snapshot.json` 生成（02 §340 / 04 §267）。上游对应物是 SDK 借来的 REST 信封类型。 |
| `api/api-client.ts`               | `ADAPTED` | `api/api-client.ts` | M2 REWRITE。上游 471 行里大部分是给 SDK 打补丁，没有 SDK 就没有补丁的对象；有意不搬的三样写在文件头。                                            |
| `agent-deerflow/endpoints.ts`     | `ADDED`   | —                   | L3：run 相关 URL 与 `Content-Location` 解析（05 L12）。上游散在 SDK 内部。                                                                       |
| `agent-deerflow/event-map.ts`     | `ADDED`   | —                   | L3：wire 事件名 → 流走向，内核唯一的协议知识入口（08 §288）。                                                                                    |
| `agent-deerflow/gap.ts`           | `ADDED`   | —                   | L3：重放缺口载荷解析与 `gap → replay_gap` 映射。解析逻辑取自上游 `api-client.ts`，但落点与用途都变了。                                           |
| `agent-deerflow/run-protocol.ts`  | `ADDED`   | —                   | L3：内核 `RunProtocol` 的 DeerFlow 实现（create/resume/cancel/inspect）。                                                                        |
| `agent-deerflow/message-adapt.ts` | `ADDED`   | —                   | L3：wire 消息 ⇄ 内核归一化消息的双向适配（08 §111 点名的 round-trip）。上游没有这一层——它直接用 SDK 的 wire 类型当内存模型。                     |
| `agent-deerflow/reducer.ts`       | `ADDED`   | —                   | L3：wire 事件 → 归约动作（08 §事件与完整状态归约）。上游散在 SDK StreamManager 与组件生命周期里。                                                |
| `agent-deerflow/gap-recovery.ts`  | `ADDED`   | `api/api-client.ts` | L3：05 A4–A6 的 rejoin 预算。**不是** `recoverStreamReplayGaps` 的搬运——上游的 sessionStorage 重连簿记在这里没有对象，见文件头。                 |

<!-- COPIED:BEGIN 由 `make land-copied` 生成，勿手改 -->

| `agents/api.ts` | `COPIED` | `agents/api.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `agents/feature-cache.ts` | `COPIED` | `agents/feature-cache.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `agents/types.ts` | `COPIED` | `agents/types.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `api/errors.ts` | `COPIED` | `api/errors.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `api/feedback.ts` | `COPIED` | `api/feedback.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `api/fetcher.ts` | `COPIED` | `api/fetcher.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `api/index.ts` | `COPIED` | `api/index.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `api/stream-mode.ts` | `COPIED` | `api/stream-mode.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
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
| `channels/api.ts` | `COPIED` | `channels/api.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `channels/connect-poll.ts` | `COPIED` | `channels/connect-poll.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `channels/open-connect-url.ts` | `COPIED` | `channels/open-connect-url.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `channels/provider-state.ts` | `COPIED` | `channels/provider-state.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
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
| `mcp/api.ts` | `COPIED` | `mcp/api.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `mcp/index.ts` | `COPIED` | `mcp/index.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `mcp/types.ts` | `COPIED` | `mcp/types.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `memory/api.ts` | `COPIED` | `memory/api.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `memory/index.ts` | `COPIED` | `memory/index.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `memory/types.ts` | `COPIED` | `memory/types.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `messages/workspace-change-anchor.ts` | `COPIED` | `messages/workspace-change-anchor.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `models/index.ts` | `COPIED` | `models/index.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `models/types.ts` | `COPIED` | `models/types.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `scheduled-tasks/api.ts` | `COPIED` | `scheduled-tasks/api.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `scheduled-tasks/cron.ts` | `COPIED` | `scheduled-tasks/cron.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `scheduled-tasks/types.ts` | `COPIED` | `scheduled-tasks/types.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `settings/local.ts` | `COPIED` | `settings/local.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `settings/store.ts` | `COPIED` | `settings/store.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `sidecar/api.ts` | `COPIED` | `sidecar/api.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `sidecar/index.ts` | `COPIED` | `sidecar/index.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `sidecar/reference-metadata.ts` | `COPIED` | `sidecar/reference-metadata.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `sidecar/reference-state.ts` | `COPIED` | `sidecar/reference-state.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `sidecar/thread.ts` | `COPIED` | `sidecar/thread.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `skills/api.ts` | `COPIED` | `skills/api.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `skills/index.ts` | `COPIED` | `skills/index.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `skills/slash.ts` | `COPIED` | `skills/slash.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `skills/type.ts` | `COPIED` | `skills/type.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
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
| `threads/api.ts` | `COPIED` | `threads/api.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
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
| `workspace-changes/api.ts` | `COPIED` | `workspace-changes/api.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `workspace-changes/summary.ts` | `COPIED` | `workspace-changes/summary.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
| `workspace-changes/types.ts` | `COPIED` | `workspace-changes/types.ts` | 所有 import 在 frontend-vue 中同形可解析，零改动复制。 |
<!-- COPIED:END -->

<!-- RETYPED:BEGIN 由 `make land-retyped` 生成，勿手改 -->

| `artifacts/loader.ts` | `RETYPED` | `artifacts/loader.ts` | SDK 类型改指向自写 @/core/types/message（06 §M1 1b 的 17 个）。（@langchain/langgraph-sdk/react → @/core/types/message） |
| `artifacts/utils.ts` | `RETYPED` | `artifacts/utils.ts` | 依赖不迁的模块（static-mode.ts），该 import 必须删除或改写。 删掉 isStaticWebsiteOnly 早返回与随之无消费方的 staticDemoArtifactURL。 |
| `auth/auth-disabled-user.ts` | `RETYPED` | `auth/auth-disabled-user.ts` | 读 process.env；Nuxt 客户端产物没有该全局，改为接收注入的 runtime options。 |
| `config/index.ts` | `RETYPED` | `config/index.ts` | 改为接收普通 runtime options，纯 core 不调用 useRuntimeConfig()。（@/env → runtime options） |
| `i18n/locales/en-US.ts` | `RETYPED` | `i18n/locales/en-US.ts` | 图标包换 Vue 版；LucideIcon 与所用图标名在 lucide-vue-next 中同名（已实测）。（lucide-react → lucide-vue-next） |
| `i18n/locales/types.ts` | `RETYPED` | `i18n/locales/types.ts` | 图标包换 Vue 版；LucideIcon 与所用图标名在 lucide-vue-next 中同名（已实测）。（lucide-react → lucide-vue-next） |
| `i18n/locales/zh-CN.ts` | `RETYPED` | `i18n/locales/zh-CN.ts` | 图标包换 Vue 版；LucideIcon 与所用图标名在 lucide-vue-next 中同名（已实测）。（lucide-react → lucide-vue-next） |
| `messages/derived-state.ts` | `RETYPED` | `messages/derived-state.ts` | SDK 类型改指向自写 @/core/types/message（06 §M1 1b 的 17 个）。（@langchain/langgraph-sdk → @/core/types/message） |
| `messages/human-input.ts` | `RETYPED` | `messages/human-input.ts` | SDK 类型改指向自写 @/core/types/message（06 §M1 1b 的 17 个）。（@langchain/langgraph-sdk → @/core/types/message） |
| `messages/run-duration.ts` | `RETYPED` | `messages/run-duration.ts` | SDK 类型改指向自写 @/core/types/message（06 §M1 1b 的 17 个）。（@langchain/langgraph-sdk → @/core/types/message） |
| `messages/usage-model.ts` | `RETYPED` | `messages/usage-model.ts` | SDK 类型改指向自写 @/core/types/message（06 §M1 1b 的 17 个）。（@langchain/langgraph-sdk → @/core/types/message） |
| `messages/usage.ts` | `RETYPED` | `messages/usage.ts` | SDK 类型改指向自写 @/core/types/message（06 §M1 1b 的 17 个）。（@langchain/langgraph-sdk → @/core/types/message） |
| `messages/utils.ts` | `RETYPED` | `messages/utils.ts` | SDK 类型改指向自写 @/core/types/message（06 §M1 1b 的 17 个）。（@langchain/langgraph-sdk → @/core/types/message） |
| `models/api.ts` | `RETYPED` | `models/api.ts` | 依赖不迁的模块（static-mode.ts），该 import 必须删除或改写。 删掉 isStaticWebsiteOnly 早返回与随之无消费方的 STATIC_MODELS_RESPONSE。 |
| `scheduled-tasks/recipes.ts` | `RETYPED` | `scheduled-tasks/recipes.ts` | 被引用的类型搬进 core（例：recipes.ts 的 ScheduleValue）。（@/components/workspace/scheduled-task-schedule-input → @/core/…） |
| `sidecar/context.ts` | `RETYPED` | `sidecar/context.ts` | SDK 类型改指向自写 @/core/types/message（06 §M1 1b 的 17 个）。（@langchain/langgraph-sdk → @/core/types/message） |
| `tasks/subtask-result.ts` | `RETYPED` | `tasks/subtask-result.ts` | SDK 类型改指向自写 @/core/types/message（06 §M1 1b 的 17 个）。（@langchain/langgraph-sdk → @/core/types/message） |
| `tasks/types.ts` | `RETYPED` | `tasks/types.ts` | SDK 类型改指向自写 @/core/types/message（06 §M1 1b 的 17 个）。（@langchain/langgraph-sdk → @/core/types/message） |
| `threads/export.ts` | `RETYPED` | `threads/export.ts` | SDK 类型改指向自写 @/core/types/message（06 §M1 1b 的 17 个）。（@langchain/langgraph-sdk → @/core/types/message） |
| `threads/thread-search-query.ts` | `RETYPED` | `threads/thread-search-query.ts` | SDK 类型改指向自写 @/core/types/message（06 §M1 1b 的 17 个）。（@langchain/langgraph-sdk/client → @/core/types/message） |
| `threads/types.ts` | `RETYPED` | `threads/types.ts` | SDK 类型改指向自写 @/core/types/message（06 §M1 1b 的 17 个）。（@langchain/langgraph-sdk → @/core/types/message） |
| `threads/utils.ts` | `RETYPED` | `threads/utils.ts` | SDK 类型改指向自写 @/core/types/message（06 §M1 1b 的 17 个）。（@langchain/langgraph-sdk → @/core/types/message） |
| `tools/utils.ts` | `RETYPED` | `tools/utils.ts` | SDK 类型改指向自写 @/core/types/message（06 §M1 1b 的 17 个）。（@langchain/core/messages → @/core/types/message） SDK 类型改指向自写 @/core/types/message（06 §M1 1b 的 17 个）。（@langchain/langgraph-sdk → @/core/types/message） |
| `uploads/prompt-input-files.ts` | `RETYPED` | `uploads/prompt-input-files.ts` | Vercel AI SDK 的类型内联进 @/core/types/message，不装这个包（02 §321）。（ai → @/core/types/message） |
<!-- RETYPED:END -->
