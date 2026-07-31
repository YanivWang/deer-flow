# 05 · 会话流式管线

> 这是全系统最复杂的部分。`core/threads/hooks.ts`（3,072 行）+
> `core/messages/utils.ts`（861 行）+ `message-list.tsx`（1,423 行）+
> `message-group.tsx`（1,058 行）合计约 6,400 行都服务于这一条链路。
> **动这里之前请完整读本篇。**

## 5.1 分层

```
┌───────────────────────────────────────────────────────────────┐
│ 组件层   MessageList → MessageListItem → MessageGroup          │
│          + SubtaskCard / HumanInputCard / TodoList / GoalStatus │
├───────────────────────────────────────────────────────────────┤
│ 模型层   core/messages/utils.ts    消息 → MessageGroup[]        │
│          core/tasks/steps.ts       子任务 step 模型             │
│          core/messages/run-duration.ts / workspace-change-anchor│
├───────────────────────────────────────────────────────────────┤
│ 编排层   core/threads/hooks.ts::useThreadStream                 │
│          + useThreadHistory + useCoalescedStreamMessages        │
├───────────────────────────────────────────────────────────────┤
│ 传输层   core/api/api-client.ts    SDK 包装 + gap 恢复           │
│          core/api/stream-mode.ts   stream mode 白名单           │
├───────────────────────────────────────────────────────────────┤
│ SDK      @langchain/langgraph-sdk  useStream / runs.stream      │
└───────────────────────────────────────────────────────────────┘
```

## 5.2 传输层：SDK 包装（`api-client.ts`，471 行）

`getAPIClient()` 返回的**不是**裸 SDK client，而是打了四个补丁的包装：

### ① `injectCsrfHeader`（`onRequest` 钩子）
每次外发请求前从**活的** `csrf_token` cookie 读值注入 `X-CSRF-Token`。
逐请求读取（而非构造时烘进 `defaultHeaders`）是为了透明处理登录/登出/改密的
cookie 轮换。

### ② `runs.stream` 包装 —— 保持惰性 AsyncIterable
```ts
client.runs.stream = async function* (threadId, assistantId, payload) { … }
```
**必须是 generator**：SDK 的 `StreamManager` 用 `for await` 消费它，
所以 run 创建发生在首次迭代而非 `runs.stream()` 调用时。改成普通 async 函数会
提前触发 run 创建。

### ③ `runs.joinStream` 包装 —— 终态短路
重连前先 `client.runs.get()` 查状态，命中 `TERMINAL_RUN_STATUSES`
（`success` / `error` / `timeout` / `interrupted`）就**跳过 join** 直接返回。

原因：后端 `worker.py` 无条件 `publish_end` 后 60 秒回收 in-memory stream bridge。
在这个窗口后重连会永久阻塞在已排空的条件变量上，把 `isLoading` 钉死在 true，
于是提交按钮一直是停止按钮，reload 后第一条消息永远发不出去。

`interrupted` 也算终态，因为 DeerFlow 里它只由 `RunManager.cancel()`（用户主动停止）
写入；可恢复的 human-in-the-loop 走 `Command(goto=END)`，结束状态是 `success`。

**已知取舍**：`error`/`timeout` 也终态化后，60 秒窗口内 reload 不再重放缓冲的
error 事件，瞬时错误 toast 会丢。持久化的错误状态仍从 checkpoint 经
`useThreadHistory` 加载，所以只丢 toast——这是有意的，每次 reload 弹陈旧错误是噪音。

### ④ `runs.cancel` 包装 —— 吞掉终态 409
`isRunNotCancellableError()` 匹配 `"is not cancellable"` 的 409 并静默吞掉
（此时取消本就是 no-op），同时清掉过期的 reconnect key。

⚠️ **不匹配**兄弟分支 `"not active on this worker and cannot be cancelled"`——
那是多实例部署下 run 仍活在别的 worker 上，属于真实取消失败，必须保持可见。

> 这两个 409 分支目前靠**字符串匹配**区分（`isRunConflictError(error, ...needles)`，
> AND 语义），真相来源是 `backend/app/gateway/routers/thread_runs.py::_cancel_conflict_detail`。
> 后端一旦暴露结构化 error code，这里应当换掉。

## 5.3 SSE 重放缺口（gap）恢复

后端在 SSE 重放历史不足时发一个 **无 id 的 `gap` 控制帧**。上游 SDK 会**忽略未知
事件名并当作正常结束**，所以 `recoverStreamReplayGaps()` 必须自己拦：

```
收到 gap 帧
 ├─ 校验 gap.run_id 与当前 run 一致（不一致 → 抛错）
 ├─ recoveryAttempts >= MAX_STREAM_GAP_RECOVERIES(5) → 抛 StreamReplayGapError
 ├─ clearReconnectRun()  清掉过期 reconnect 记账
 ├─ yield custom 事件 { type: "stream_replay_gap", ...gap }   ← 内部控制事件
 ├─ await client.threads.getState()  重载持久 values
 ├─ yield { event: "values", data: durableState.values }
 └─ rememberReconnectRun() 后从 gap.latest_available_event_id 重新 join
```

- **预算语义**：原始 stream 不计数，5 次恢复重连 ⇒ 全 gap 耗尽路径最多 **6 次 stream 调用**。
- 包装对 `runs.stream`（首次）和 `runs.joinStream`（重连）**两条路径都生效**。
- reconnect 记账落在 `sessionStorage` 的 `lg:stream:{threadId}` key，
  所有存储访问都 try/catch 包住，失败不抛。
- `useThreadStream` 收到 `stream_replay_gap` custom 事件后：清空乐观/瞬态/子任务状态、
  失效持久历史缓存、弹本地化的恢复警告 toast。
- ❗ **绝不能**让 gap 落到"正常结束"分支，也不能因此取消仍在跑的后端 run。

## 5.4 Stream mode 白名单

[core/api/stream-mode.ts](../frontend/src/core/api/stream-mode.ts)：

- Gateway 支持集：`values`、`messages-tuple`、`updates`、`debug`、`tasks`、
  `checkpoints`、`custom`。
- 请求里含任何不支持的 mode → **HTTP 之前就 throw**，不做部分转发、
  不静默回落到 `values`。
- `messages` 和 `events` **不支持**，禁止转发。
- `streamResumable` 会被 thread hook 保留（供 SDK 侧 reconnect 记账），
  但在发 HTTP 前**剥掉**——Gateway 不接受该请求选项。真正的重放用
  SSE `Last-Event-ID` 游标。
- 未支持项的 warn 做了去重（`warnedUnsupportedStreamModes`），不会刷屏。

### custom 事件清单

| 事件 `type` | 来源 | 处理 |
| --- | --- | --- |
| `task_started` | 子任务开始，携带生效的 `model_name` | `taskEventToSubtaskUpdate()` → `updateSubtask()` |
| `task_running` | 每次 LLM 调用后，携带累计用量快照 + `message` + `message_index` | 追加 step（`messageToStep`），**累加而非覆盖** |
| `stream_replay_gap` | 由 `api-client.ts` 自己合成的内部控制事件 | 全量状态重置 + toast |
| `llm_retry` | 后端重试提示 | `toast(message)` |

`computeNextSubtask` 会**保留最大的累计总量**，这样重放或迟到的 SSE 帧不会重复计数、
也不会让折叠卡片的数字回退。

## 5.5 编排层：`useThreadStream`

签名（`ThreadStreamOptions`）：`threadId`、`displayThreadId`、`context`、`isMock`、
`onSend`、`onStart`、`onFinish`。

`useStream` 的关键配置：
```ts
{
  client: getAPIClient(isMock),
  assistantId: "lead_agent",     // 固定
  threadId: onStreamThreadId,
  reconnectOnMount: true,
  fetchStateHistory: { limit: 1 },
  throttle: true,                 // 只能布尔档，见 04-state-and-data-flow §4.7
}
```

### 它管理的本地状态（约 10 个）

| 状态 | 用途 |
| --- | --- |
| `optimisticMessages` / `optimisticThreadId` | 服务端流回应前的乐观消息 |
| `liveMessagesThreadId` | 活动流所属 thread（处理流中切换 thread） |
| `pendingSupersededRunIds` / `pendingSupersededMessageIds` | 编辑重跑/重生成时被顶替的内容遮罩 |
| `isUploading` | 提交前上传态 |
| `onStreamThreadId` | 实际传给 SDK 的 thread id |
| `threadIdRef` / `currentViewThreadIdRef` / `startedRef` | 跨异步回调的引用（避免重渲染） |
| `pendingUsageBaselineMessageIdsRef` | token 用量基线 |
| `pendingPreparedReplayRef` | 编辑重跑的准备态 |
| `transientHistoryBridgeRef` / `transientHistoryOrderRef` | 上下文压缩期间的瞬态桥接 |
| `renderedMessageSnapshotRef` / `messagesRef` / `summarizedRef` | 已渲染账本 / 消息镜像 / 已摘要集合 |

### 回调分工

| 回调 | 职责 |
| --- | --- |
| `onCreated(meta)` | `handleStreamStart` + 向两处列表缓存乐观 upsert 新 thread + （自定义 agent 时）写 `metadata.agent_name` |
| `onUpdateEvent(data)` | 处理 summarization middleware 消息、瞬态历史桥接、标题更新写缓存 |
| `onCustomEvent(event)` | 分派 `stream_replay_gap` / `task_*` / `llm_retry`（先一次性 narrow `event.type`，再分支） |
| `onError(error)` | 清空乐观与遮罩状态、错误 toast、重设用量基线、失效历史与用量缓存 |
| `onFinish(state)` | 触发外部 `onFinish`、重设用量基线、`invalidateStoppedThreadCaches` |

## 5.6 历史加载与合并（最难的一块）

`useThreadHistory` 从 `GET /api/threads/{id}/messages/page` 分页拉持久化历史，
**保留后端 thread 全局的 `seq`**。渲染时把 checkpoint / live 副本**叠加在各自
匹配的规范身份（canonical identity）上**——一个被摘要过的 checkpoint 可能同时
包含受保护的早期输入 + 最近的尾部。

参与合并的纯函数（都在 `core/threads/hooks.ts` 内，均已导出、可单测）：

| 函数 | 作用 |
| --- | --- |
| `parseThreadMessagesPageResponse` / `getThreadHistoryNextPageParam` / `buildThreadMessagesPageUrl` | 分页协议 |
| `flattenThreadHistoryPages` / `reconcileThreadHistoryRows` | 页 → 行 |
| `buildVisibleHistoryMessages` | 可见历史消息（并把 `run_id` 挂到内容消息上，供子任务卡解析 events 端点） |
| `mergeMessages` | 主合并 |
| `mergeRenderedMessageLedger` | run 级"已提交可见消息"账本 |
| `computeSummarizationTransientMessages` | 上下文压缩救援 |
| `resolveTransientHistoryBridge` / `mergeTransientHistoryBridge` / `mergeTransientHistoryBridgeOrder` / `resolveThreadTransientHistoryBridge` | 瞬态桥接 |
| `pruneConfirmedTransientMessages` | 确认后清理 |
| `getVisibleOptimisticMessages` / `areOptimisticMessagesConfirmed` / `countHumanMessagesExcludingSuperseded` | 乐观消息生命周期 |

### 必须保住的四条行为

1. **上下文压缩救援要 diff 每个保留的可见身份**，不能在第一个 anchor 处切片。
2. **保留 run 级账本**，使替换类更新和重复的滚动 checkpoint 窗口不会擦掉已显示的步骤。
3. **规范位置仍落在未加载游标页之后的 checkpoint/瞬态前缀要被抑制**，
   而不是在最近 anchor 之前把这段未知空隙折叠掉。
4. **乐观消息追加时不做时间戳重排**；历史失效时**保留已加载的页**，
   以免丢掉既成的排序位置。

## 5.7 消息分组模型

[core/messages/utils.ts](../frontend/src/core/messages/utils.ts) 的
`getMessageGroups(messages, { isCurrentTurnLoading })` → `MessageGroup[]`：

```ts
type MessageGroup =
  | HumanMessageGroup                  // "human"
  | AssistantProcessingGroup           // "assistant:processing"
  | AssistantMessageGroup              // "assistant"
  | AssistantPresentFilesGroup         // "assistant:present-files"
  | AssistantClarificationGroup        // "assistant:clarification"
  | AssistantSubagentGroup             // "assistant:subagent"
```

隐藏的控制消息名：`summary`、`loop_warning`、`todo_reminder`、
`todo_completion_reminder`（`HIDDEN_CONTROL_MESSAGE_NAMES`）。

### 四条分组不变量（易被"优化"破坏）

1. **带 `tool_calls` 的 AI 消息也可能有用户可见文本**。这类 turn 归入
   `assistant:processing`，`message-group.tsx` 必须把可见文本渲染成一个处理步骤，
   而不是当纯工具元数据丢掉——否则会丢掉 provider 的错误解释或"换个思路"说明。
2. **当前 turn 仍在 loading 时**，最新可见 human 输入之后的"纯内容"AI 消息
   **继续留在 processing 组**里。provider 可能稍后往同一条消息追加 tool-call chunk，
   过早判定为终态 assistant 气泡会让文本跳进步骤面板。
3. **同理适用于已有 tool call 之后**：流式期间，位于当前最后一个 tool-call 步骤
   之后的纯内容 AI 消息保持可见，因为它自己也可能在 turn 结束前再长出一个 tool call。
4. 🔴 **reasoning 必须排在答案文本之上，且两个渲染组件都要满足**（上游 #4576，
   2026-07-31 随 D4-a 基线并入）。**同一条消息在生命周期内由两个不同组件渲染**：
   流式期间是 `MessageGroup`，turn 落定后是 `MessageListItem`。后者把已定型气泡的
   `<Reasoning>` 披露渲染在正文之上，因此 `MessageGroup` 也必须把尾部 reasoning 披露
   放在其后的助手文本之上，且 `convertToSteps` 要先产出某条消息的 reasoning step
   再产出它的 content step —— **否则 turn 落定的瞬间，两者会上下互换**。
   ⚠️ 例外：在该 reasoning **之前**发出的助手文本保持原位，只有"由这段 reasoning 产出的答案"下移。

> 🔴 **对 Vue 重写的意义（第 4 条）**：这是一条**跨组件**不变量，不是单个组件内部的排序问题。
> 迁移时若把 `MessageGroup` 与 `MessageListItem` 拆给不同人／不同阶段做，
> 单看任一侧都是"对的"，只有把流式与落定态连起来看才会暴露。
> 建议在 Vue 侧补一条等价 E2E —— React 版已有 `tests/e2e/streaming-reasoning-order.spec.ts`
> （180 行 / 2 用例，覆盖"流式中"与"已落定"两态），**它已计入 D6 保留的 25 个 spec**。

### `MessageGroup` 的查表优化
`MessageGroup` 在把消息转成 steps **之前**，对每个 processing 组**只建一次**
tool-result 与 browser-preview 查表：保留每个 tool-call ID 的**首个非空结果**和
**首个带截图的 browser view**。不要退回成"为每个 tool call 重扫整组"。

## 5.8 run 级展示的 anchor 机制

有些展示是 **run 级**而非 message 级，若挂在每条消息上就会渲染出多份副本：

| 展示 | anchor 助手 | 渲染点 | 接受的组类型 |
| --- | --- | --- | --- |
| run 时长 | [core/messages/run-duration.ts](../frontend/src/core/messages/run-duration.ts) | `MessageList`（围绕每个 group 发出） | **任意**类型 |
| workspace 变更卡 | [core/messages/workspace-change-anchor.ts](../frontend/src/core/messages/workspace-change-anchor.ts) | `MessageListItem` | 仅 `assistant`（#4555） |

两个 helper **有意**接受不同的候选集合——anchor 只在它实际渲染的位置才有意义。
新增 run 级展示时，把候选集配到自己的渲染点，**不要**把两者统一。

`run_duration` 说明：兼容字段 `additional_kwargs.turn_duration` 会重复出现在历史
AI 消息上，`run-duration.ts` 把这些副本折叠成一个、锚定在该 run 最后一个可见组之后。
它是 **run 总墙钟时间**，不是单条消息的思考时间；reasoning 披露与 run 活动/时长
分开渲染。`MessageList` 持有刚完成 turn 的临时客户端时长，直到权威历史到达。

## 5.9 子任务（subagent）时间线

[core/tasks/](../frontend/src/core/tasks/) 六个文件构成一套完整模型：

| 文件 | 角色 |
| --- | --- |
| `types.ts` | `Subtask`（status / subagent_type / modelName / usage / steps / result / error / stopReason） |
| `steps.ts` | **纯 step 模型**：`messageToStep`（实时）、`eventsToSteps`（reload）、`mergeSteps`（按 `message_index` 去重）、`stepsForDisplay`（卡片实际渲染的内容） |
| `lifecycle.ts` | `taskEventToSubtaskUpdate` 归一化增量事件 |
| `context.tsx` | `SubtasksProvider` + `useSubtask` / `useUpdateSubtask`（`tasksRef` 模式） |
| `api.ts` | `fetchSubtaskSteps` 历史回填 |
| `presentation.ts` / `subtask-result.ts` / `subtask-update.ts` | 展示与结果解析 |

数据来源三条：
1. **实时**：`task_running` 事件 → `mergeSteps` 追加（不是覆盖）。
2. **展开历史 run 时回填**：`fetchSubtaskSteps` 分页拉
   `GET /runs/{runId}/events?event_types=subagent.step&task_id=…&after_seq=…`
   直到出现短页——这样 run 级的 limit 不会截断时间线。
3. **reload 后**：终态 ToolMessage 的 metadata（`subagent_model_name` /
   `subagent_token_usage`）从普通历史恢复同样的值，**无需**逐卡片拉 events。

`stepsForDisplay` 的规则：保留 tool steps + 有文本的 AI steps；
completed 时**丢掉尾部的 final-answer AI step**（它已作为 `result` 展示）。

## 5.10 Human Input 协议

结构化消息协议，叠加在普通聊天历史之上：

- **载荷位置**：`ToolMessage.artifact.human_input`
- **运行时校验/类型**：[core/messages/human-input.ts](../frontend/src/core/messages/human-input.ts)（588 行）
- **卡片组件**：[components/workspace/messages/human-input-card.tsx](../frontend/src/components/workspace/messages/human-input-card.tsx)（588 行）

### 版本策略：只在**请求**侧版本化
| 版本 | 支持的 mode |
| --- | --- |
| v1 | `free_text`、`choice_with_other` |
| v2 | 追加 `form`（typed fields：text / textarea / number / select / multi_select / checkbox / date，卡片内做必填校验） |

**回复侧刻意停留在 v1 协议**：form 卡片提交的是 `response_kind: "text"`，
值 = 人类可读摘要 + 一个以稳定 field name 为键的 JSON 块
（`buildHumanInputFormSubmissionValue`）。
> 为什么不能只发可读部分：label/value 里可能含分隔符，纯可读文本有歧义。
> 为什么不引入结构化 response kind：保持与只懂 v1 的旧前端兼容。

校验器拒绝未知版本/mode（以及与 `Object.prototype` 成员冲突的 field name），
使未来的协议升级**降级为纯文本 ToolMessage 兜底**，而不是渲染出破损卡片。

### 表单实现细节（无障碍 + 正确性）
- 表单值只走 own-property 读取（`readHumanInputFormValue`）。
- select 从空串 placeholder 态起就是受控的。
- checkbox 是原生 `<input type="checkbox">`，由
  `buildInitialHumanInputFormValues` 播种显式 `false`，
  这样未触碰的 checkbox 提交为"否"，而 `required` checkbox 保留"必须同意"语义。
  **不加 HTML `required` 属性**——原生约束校验会截断自定义提交路径。
- 控件带 label/`htmlFor`、`aria-required` + 视觉隐藏的本地化"必填"标记、
  `aria-invalid` 与错误关联；只要还有字段无效，错误节点保持挂载。

### Composer 绕过闭环
`deriveHumanInputThreadState` 把一条可见的普通 human 消息视为**回答了在它之前
打开的最近一个未回答请求**——**只有最近那一个**。
> 为什么不关掉所有：没有任何机制保证跨 run 只有一个未决请求，全关会静默吞掉
> 更早的决策；一个仍开着的更早请求会自然重新成为活动卡片。

这允许现有用户用普通输入框绕过结构化表单，也保留了对把 v2 请求降级成纯文本的
旧 v1 前端的兼容。

`MessageList` 拥有可见卡片的 answered/latest/pending 状态，但 **answered
判定读的是原始 `thread.messages`**（因为回复是隐藏的）。pending 卡片在
隐藏回复出现、派发被丢弃、或新的 `thread.error` 报告异步流失败时清除。

页面级卡片提交回调必须发一条**普通 human 消息**，并把 `hide_from_ui: true`
和响应载荷放进 `sendMessage(..., options)` 的**第四个参数** `options.additionalKwargs`；
第三个参数仍是 run context（如 `{ agent_name }`）。

## 5.11 编辑重跑（edit-and-rerun）

**刻意只允许最新 turn**：
- `core/messages/utils.ts::getLatestEditableTurn()` 只在
  「transcript 空闲」且「最近的可见 turn 以终态 assistant 消息结尾」时暴露 human turn。
- `core/threads/hooks.ts::editAndRegenerateMessage()`：
  `POST /api/threads/{id}/runs/edit-regenerate/prepare` → 把返回的
  替换消息/checkpoint/metadata 走**与 regenerate 相同**的 LangGraph stream 路径提交 →
  乐观隐藏被顶替的 message id → 持久化替换到达后清除乐观替换。

## 5.12 内置 composer 命令（不是技能激活）

`/goal` 与 `/compact` 由 [input-box.tsx](../frontend/src/components/workspace/input-box.tsx)
在**普通聊天提交之前**拦截：

| 命令 | 调用 | 附加行为 |
| --- | --- | --- |
| `/goal` | `GET /api/threads/{id}/goal` | 仅查询状态，不起 run |
| `/goal clear` | `DELETE /api/threads/{id}/goal` | 不起 run |
| `/goal <condition>` | `PUT /api/threads/{id}/goal` | **同时**把条件文本作为下一个用户任务提交，agent 立即开跑 |
| `/compact` | `POST /api/threads/{id}/compact` | 摘要较早的活动上下文，**完整可见聊天历史保持不变**；新/空 thread 跳过；run 进行中服务端拒绝 |

两类请求都绑定当前 `threadId` 并挂 `AbortController`——切换 thread 或卸载 composer
会中止在途请求，过期响应无法污染新 thread 的 composer 状态。

thread 改名走**同一条串行化状态写路由**：run 活动时返回 409，改名对话框保持打开
并展示服务端错误。

## 5.13 流式 Markdown 渲染

[core/streamdown/](../frontend/src/core/streamdown/) 拥有全部渲染配置：

- 用 Streamdown 的 `animated` / `isAnimating` API 做逐词增量动画。
- 共享的 `streamdownRenderingPlugins` 配置注册 Streamdown 2.5 需要的
  具名 code-highlighting 与 Mermaid 插件。
- ⚠️ **不要**重新引入"给每个词加包裹"的 rehype 插件：重新解析一个增长中的块会
  重挂载旧词并重播它们的动画。
- 消息与产物 Markdown 中的引文链接必须从**完整的 `ReactNode` children 树**推导
  `citation:` 标签——流式期间 Streamdown 给的 children 可能是 element 或数组，
  不是纯字符串。

## 5.14 产物（artifact）写入的自动打开与预览

- 文件工具的产物自动打开逻辑**必须在带清理的 effect 里跑**；
  渲染流式 `write_file` / `str_replace` / 暂存产物写入更新时**绝不能**排定定时器。
- `write_file` / `str_replace` 可以在 loading 中打开一个**流式草稿 URL**；
  `finalize_artifact_write` 只在工具返回 `OK` 后打开真实产物路径。
- HTML 预览要过 [core/artifacts/preview.ts](../frontend/src/core/artifacts/preview.ts)
  的轻量文档完整性检查：已完成的 `.html`/`.htm` 草稿若缺失或顺序错乱的
  `html`/`body` 标签，或在出现 `head`/`style`/`script` 区域时标签不配对，
  **留在代码视图**而不是塞进 iframe 渲染。文档仍在组装中的前缀 chunk 是允许的；
  最终产物由后端做结构与本地渲染资源存在性校验后才写入目标文件。
