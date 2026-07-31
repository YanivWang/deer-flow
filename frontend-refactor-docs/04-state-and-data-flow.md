# 04 · 状态管理与数据流

## 4.1 五套状态载体

本项目**没有**全局状态库（无 Redux / Zustand / Jotai）。状态按性质分散在五处，
各有明确所有权：

| 载体 | 用途 | 实现 | 生命周期 |
| --- | --- | --- | --- |
| **TanStack Query** | 所有服务端状态（thread 列表、历史、models、skills、memory、agents…） | `QueryClientProvider` in [workspace-content.tsx](../frontend/src/app/workspace/workspace-content.tsx) | 进程内，带缓存失效 |
| **LangGraph `useStream`** | 当前 run 的活动流状态（messages / values / isLoading / error） | SDK hook，包在 `useThreadStream` 内 | 单个 thread 的流生命周期 |
| **React Context** | UI 局部共享状态（artifacts / sidecar / subtasks / browser-view / i18n / auth / theme / sidebar / prompt-input） | 各自 `createContext` | 组件树 |
| **localStorage** | 用户偏好（模型、通知、token 用量展示、每 thread 模型覆盖） | [core/settings/store.ts](../frontend/src/core/settings/store.ts) + `local.ts` | 跨会话持久 |
| **sessionStorage** | 标签页级临时状态（composer 草稿、SDK reconnect 记账、**产物面板状态**） | [core/threads/composer-draft.ts](../frontend/src/core/threads/composer-draft.ts)、`lg:stream:{threadId}`、`deerflow:artifacts:v1:{pathname}` | 标签页 |

另有 **cookie**：`locale`（i18n）、`sidebar_state`（侧栏展开）、
`access_token`（HttpOnly，Gateway 所有）、`csrf_token`（可读，Gateway 所有）。

## 4.2 TanStack Query 的 key 约定

Query key 采用数组前缀分域，主要几组：

| Key | 来源 |
| --- | --- |
| `["threads", "search", …]` | thread 搜索/列表缓存 |
| `INFINITE_THREADS_QUERY_KEY_PREFIX`（侧栏无限滚动，页大小 `INFINITE_THREADS_PAGE_SIZE = 50`） | `core/threads/hooks.ts` |
| `threadHistoryQueryKey(threadId)` | 持久化会话历史分页 |
| `threadTokenUsageQueryKey(threadId)` | token 用量 |
| 各领域自有 key | `core/{models,skills,mcp,memory,agents,channels,…}/hooks.ts` |

**缓存失效有集中入口**，不要各处手写 `invalidateQueries`：
- `invalidateStoppedThreadCaches(queryClient, threadId, isMock)` — 停止/完成/出错后统一失效
- `upsertThreadInSearchCache()` / `upsertThreadInInfiniteCache()` — 新建 thread 时乐观插入两处列表缓存
- `mapInfiniteThreadsCache()` / `filterInfiniteThreadsCache()` — 无限列表的增删改

## 4.3 localStorage 设置：手写 external store

[core/settings/store.ts](../frontend/src/core/settings/store.ts) 是一个手写的
`useSyncExternalStore` 兼容 store（`subscribe` / `getBaseSettingsSnapshot` /
`getThreadModelSnapshot`）：

- 监听 `window.addEventListener("storage")`，**跨标签页同步**（这是它不用普通
  `useState` 的原因）。
- `event.key === null`（clear）时整体重载并清空 thread 模型缓存。
- key 空间：`deerflow.local-settings`（`LOCAL_SETTINGS_KEY`）+
  `deerflow.thread-model.{threadId}`（`THREAD_MODEL_KEY_PREFIX`）。
- 每 thread 的模型覆盖单独存 key，通过 `applyThreadModelOverride()` 叠加到基础设置上。
- 所有读写走 `safeLocalStorage` 门面，**吞掉全部存储异常**——Safari 隐私模式、
  Firefox strict container、嵌入式 WebView、配额耗尽都会抛
  `SecurityError`/`QuotaExceededError`，不拦住会冒进 render handler 直接
  炸掉 composer 和设置面板。

`LocalSettings` 结构：
```ts
{
  notification: { enabled: boolean },
  tokenUsage: { headerTotal: boolean, inlineMode: TokenUsageInlineMode },
  context: { model_name?, mode?: "flash"|"thinking"|"pro"|"ultra", reasoning_effort? }
}
```

## 4.4 Context 清单与归属层

| Context | 定义位置 | 层 | 说明 |
| --- | --- | --- | --- |
| `ThemeProvider` | `components/theme-provider.tsx` | components | next-themes 封装 |
| `I18nContext` | [core/i18n/context.tsx](../frontend/src/core/i18n/context.tsx) | core | 只存 `locale` + setter，写 cookie |
| `AuthProvider` | [core/auth/AuthProvider.tsx](../frontend/src/core/auth/AuthProvider.tsx) | core | `useAuth()` / `useRequireAuth()` |
| `SubtasksProvider` | [core/tasks/context.tsx](../frontend/src/core/tasks/context.tsx) | core | 子任务字典 + `tasksRef` 镜像 |
| `ArtifactsProvider` | `components/workspace/artifacts/context.tsx` | components | 产物列表、选中项、面板开合。🔴 **按 pathname 水合并持久化到 sessionStorage**（见下） |
| `SidecarProvider` | `components/workspace/sidecar/context.tsx` | components | 副驾会话、引用/引文 |
| `BrowserViewProvider` | `components/workspace/browser-view/context.tsx` | components | 远程浏览器面板 |
| `ThreadContext` | `components/workspace/messages/context.ts` | components | 把 `{ thread, isMock }` 下发给消息子树 |
| `PromptInputProvider` | `components/ai-elements/prompt-input` | 生成件 | 输入框受控状态 |
| `SidebarProvider` | `components/ui/sidebar` | 生成件 | 侧栏开合 |

**观察**：i18n / auth / tasks 的 context 在 `core`，UI 面板类 context 在 `components`。
这个划分是"是否带业务语义"，但 `SubtasksProvider` 在 core 而
`ArtifactsProvider` 在 components 的边界并不完全一致——两者都是流事件的接收端。

## 4.5 `tasksRef` 模式（重要）

[core/tasks/context.tsx](../frontend/src/core/tasks/context.tsx) 的 `useUpdateSubtask`
把更新**应用在 `tasksRef`（最新状态的镜像）而不是闭包快照上**。原因：
`fetchSubtaskSteps` 的历史回填是异步的，如果基于闭包快照合并，
一个晚到的回填会覆盖期间通过 SSE 到达的 steps 或兄弟子任务。

这是一个通用模式，凡"异步回填 + 实时流并发写同一份状态"的地方都应照此处理。

## 4.6 完整数据流：从输入到渲染

```
① 用户输入
   ├── core/input-polish（可选：提交前重写草稿，POST /api/input-polish）
   ├── core/voice-input（可选：浏览器语音识别 → 本地草稿）
   └── core/threads/composer-draft（sessionStorage 草稿持久化）
            │
            ▼
② InputBox 提交拦截（components/workspace/input-box.tsx）
   ├── /goal、/goal clear、/goal <condition>  → GET/PUT/DELETE /api/threads/{id}/goal
   ├── /compact                              → POST /api/threads/{id}/compact
   └── 普通消息 / 斜杠技能                     → 继续 ③
            │
            ▼
③ core/threads/hooks.ts::useThreadStream
   ├── 上传附件（core/uploads::useUploadFilesOnSubmit）
   ├── buildThreadSubmitMessages()  组装提交消息
   ├── 乐观消息插入（optimisticMessages）
   └── SDK useStream().submit()
            │
            ▼
④ SSE 流（Gateway → Nginx → 浏览器）
   ├── values           → thread.values（title / messages / artifacts / todos / goal）
   ├── messages-tuple   → 增量消息 chunk
   ├── updates          → 节点级更新（含 summarization middleware）
   ├── custom           → task_started / task_running / stream_replay_gap / llm_retry
   └── gap（后端控制帧） → api-client.ts 的重放恢复（见 05）
            │
            ▼
⑤ 状态合并
   ├── useThreadHistory（GET /api/threads/{id}/messages/page）持久历史分页
   ├── mergeMessages / mergeRenderedMessageLedger / resolveTransientHistoryBridge
   ├── useCoalescedStreamMessages（STREAM_RENDER_COALESCE_MS = 80）
   └── TanStack Query 缓存失效
            │
            ▼
⑥ 渲染
   ├── core/messages/utils.ts::getMessageGroups()  → MessageGroup[]
   ├── MessageList → MessageListItem → MessageGroup
   ├── core/streamdown（流式 Markdown，含 code / mermaid 插件）
   └── 右侧面板：artifacts / sidecar / browser（共享一个 ResizablePanelGroup）
```

## 4.7 三处"节流/合并"机制（不要混淆）

| 机制 | 位置 | 值 | 作用 |
| --- | --- | --- | --- |
| SDK `throttle: true` | `useStream` 配置 | 布尔档 | 同一 macrotask 内的流事件合并成一次 React 通知 |
| `STREAM_RENDER_COALESCE_MS` | `core/threads/hooks.ts` | `80` | `useCoalescedStreamMessages` 的渲染合并窗口 |
| 右面板动画 | `chat-box.tsx` | `RIGHT_PANEL_ANIMATION_MS = 280` | 面板开合过渡时长 |

⚠️ **`throttle` 只能用布尔档**。SDK 的数字档是**尾部去抖**（trailing debounce），
在 chunk 持续到达快于窗口时会让 UI 更新饿死。代码注释明确写了
"SDK types claim @default true, but runtime uses `throttle ?? false`"，
所以这个 `true` 必须显式写着，不能删。

## 4.8 停止（stop）的缓存处理

`stopThreadAndInvalidateCaches()` + `STOP_THREAD_FINALIZATION_REFETCH_DELAY_MS = 1500`：

停止时**立即**失效 current-thread / thread-history / token-usage / 侧栏搜索缓存，
**并额外安排一次 1.5 秒后的补拉**。原因：SDK 的 stop 可能通过 abort +
fire-and-forget cancel 完成，早于后端把标题 finalize 落库——只失效一次会拿到旧标题。

## 4.9 Composer 草稿的存储契约

[core/threads/composer-draft.ts](../frontend/src/core/threads/composer-draft.ts)：

- **只存**文本 + 选中的斜杠技能名，存 `sessionStorage`（标签页级）。
- key 维度：`user + agent + 逻辑会话 scope`。
- 新会话页传固定 scope `"new"`（而不是运行时 `threadId`，后者每次 reload 都是新 UUID）。
- `InputBox` 会**等 enabled skills 加载完**再恢复技能 chip；技能缺失/被禁用时
  降级成可编辑的斜杠文本。
- 草稿只在通过 in-flight guard 后、经 `SendMessageOptions.onSent` 回调清除。
- **不持久化**：附件、sidecar 引用、语音状态、polish 撤销状态。

## 4.10 产物面板的存储契约（2026-07-31 随 D4-a 基线并入，上游 #4580 / #4584）

[components/workspace/artifacts/context.tsx](../frontend/src/components/workspace/artifacts/context.tsx)：

- **`ThreadState.artifacts` 始终是产物列表的权威来源**；sessionStorage 里的那份
  只是**刷新引导缓存**（refresh bootstrap cache），不是第二数据源。
- key 为 `deerflow:artifacts:v1:{encodeURIComponent(pathname)}`。
  ⚠️ **按 pathname 而非 threadId 分区** —— 聊天路由是 `/workspace/chats/[thread_id]`，
  两者在聊天页等价；换成不含 thread id 的路由就不再等价。
- 持久化字段仅 `{ artifacts, selectedArtifact, open }`；读取时逐字段做类型校验，
  任一不合法即整体丢弃（`readPersistedState` 返回 `null`）。
- 🔴 **pathname 水合 effect 同时承担 thread 切换重置**：重设
  `artifacts` / `selectedArtifact` / `open` / `autoOpen`（→ `true`）/ `autoSelect`。
  这是 §3.3.1 里 O17（`autoOpen` 跨 thread 粘滞）被上游关闭的原因。
- 🔴 **初始空流值不得覆盖已恢复的状态**：[chat-box.tsx:88](../frontend/src/components/workspace/chats/chat-box.tsx)
  用 `if (threadArtifacts && threadArtifacts.length > 0)` 守卫，
  历史加载完成前的空数组不会写回 provider。**去掉这个守卫会导致刷新后面板闪空。**
- 正式产物内容在 **run 结束时刷新一次**（[core/artifacts/hooks.ts:44](../frontend/src/core/artifacts/hooks.ts)
  的 `wasLoading && !thread.isLoading` 边沿触发）；`write-file:` 临时预览不走这条，
  始终由消息驱动（`loadArtifactContentFromToolCall`）。
