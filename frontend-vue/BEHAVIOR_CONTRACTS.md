# Vue 前端行为合同

本文记录 `frontend-vue` 已满足后必须持续保持、以及为了替换 React 必须达到的产品和
协议行为。它不是完成清单，也不表示每一条当前都已实现；真实实现以当前源码为准，
未满足项及执行状态以 [PARITY_GAPS.md](PARITY_GAPS.md) 为准，验证入口以
[README.md](README.md) 和各测试配置为准。

全表 **A–N 共 14 组**。A–K 是产品行为，L 是 SSE/会话协议约束，M 是 Vue
框架语义约束，N 是需要跨浏览器或跨层验证的模块。修改相关代码时必须同时更新本合同、
差异清单和对应测试，不能用单次全绿替代逐项判断。

当前已确认仍违反或未完整覆盖的合同包括：

| 合同                             | 对应差异 ID                               |
| -------------------------------- | ----------------------------------------- |
| D3、D6～D8                       | `ARTIFACT-01`～`ARTIFACT-04`              |
| E1、E4～E8                       | `COMPOSER-01`～`COMPOSER-04`、`THREAD-01` |
| F6、F9～F10                      | `HIL-01`、`SIDECAR-03`                    |
| G1～G6                           | `STREAM-01`、`STREAM-02`                  |
| H8（未完整覆盖）                 | `MESSAGE-04`                              |
| I 组尚未覆盖的连接/导航/输入要求 | `BROWSER-01`～`BROWSER-03`                |
| K3、K5 的错误/状态消费           | `THREAD-02`、`SETTINGS-01`                |
| N1、N4 的产品接入                | `SIDECAR-02`、`MESSAGE-01`、`I18N-01`     |

该映射不是差异清单的替代品；新的未满足合同先加入 `PARITY_GAPS.md`，再补合同和测试。

---

## A. 流式与重连

> ⚠️ 本组原本由 LangGraph SDK 的 `useStream` 保证。改为**自研 SSE** 后，这些语义的实现方变成了自己——约束一条不减，另见 L 组的补强项。

| #   | 约束                                                                                                                       | 为什么                                                                                                                                                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | 同宏任务内的流事件要合并成一次通知，**不要用固定延时防抖**                                                                 | 这是 SDK `throttle: true`（boolean 档）的语义。数字档是尾部防抖，chunk 持续到达时会一直推迟，饿死 UI 更新                                                                             |
| A2  | 所有生产 run 创建入口必须请求 `values` `messages-tuple` `updates` `custom`；协议白名单还允许 `debug` `tasks` `checkpoints` | 字段缺失时 Gateway 会默认成 `values`-only：连接仍是 SSE，但回答失去文本分片，只能按完整状态成段刷新。含不支持模式时必须**在 HTTP 之前抛错**；`messages` 与 `events` 不被支持          |
| A3  | `streamResumable` **不得出现在请求里**                                                                                     | Gateway 不接受该选项。它原本是 SDK 侧的重连记账字段、由 `sanitizeRunStreamOptions` 剥离；自研 transport 后不再产生该字段，但剥离逻辑保留作为防御。重放一律走 SSE `Last-Event-ID` 游标 |
| A4  | SSE `gap` 帧要包住**初始流和 join 流两者**                                                                                 | 上游 SDK 会忽略未知事件名；包装器必须保持惰性 async iterable（SDK 用 `for await` 消费）                                                                                               |
| A5  | gap 恢复最多 5 次 rejoin（全 gap 路径共 6 次流调用）                                                                       | —                                                                                                                                                                                     |
| A6  | gap **不得当作正常流结束**，也**不得取消仍在运行的后端 run**                                                               | 会丢失正在进行的任务                                                                                                                                                                  |
| A7  | gap 发生时要清空乐观 / 瞬态 / subtask 状态、失效持久化历史缓存、显示本地化恢复警告                                         | —                                                                                                                                                                                     |
| A8  | Stop 后立即失效 4 类缓存（当前 thread、thread history、token usage、侧栏/搜索），并**再安排一次延迟 refetch**              | SDK 的 stop 可能在后端标题定稿提交前就以 abort + fire-and-forget cancel 结束                                                                                                          |

> 主要代码位置：`packages/agent-core/src/session/`、`packages/agent-core/src/transport/`、
> `app/core/agent-deerflow/`、`app/core/threads/cache-invalidation.ts` 和
> `app/composables/useThreadStream.ts`。

### A1 的实现形状

实现在 L1：`packages/agent-core/src/store/external-store.ts`。默认调度器是
`queueMicrotask`——微任务检查点就是「同一个宏任务」的边界，且发生在渲染之前。
合并的关键是一个 `pending` 短路：一个宏任务里派发一百次也只**登记一次**调度。
每次都重新排队就退化成尾部防抖了，那正是 A1 禁的。

三条回归钉在 `packages/agent-core/tests/store.test.ts`，用的是**真的**
`queueMicrotask` 与真的宏任务边界，不是注入的假调度器（假调度器只能证明
「代码调用了注入的函数」，证明不了默认档是合并还是防抖）：

| 断言                         | 合并档 | 同步档 | 固定延时防抖档 |
| ---------------------------- | ------ | ------ | -------------- |
| 一个宏任务里派发 50 次       | 1 次   | 50 次  | 0 次           |
| 三个宏任务、每个派发 5 次    | 3 次   | 15 次  | 0 次（被饿死） |
| 派发之后立刻 `getSnapshot()` | 最新   | 最新   | 最新           |

`getSnapshot()` 同步最新，合并的只有通知。`flushNotifications()` 给同步读者留出口。

### A2 的命名与边界

`stream-mode.ts` 位于 DeerFlow 应用适配层，不进入 `@deerflow/agent-core`。架构测试禁止
协议专有的 `messages-tuple` 泄漏到通用包。不要增加第二条 re-export 路径。

直接把 `sanitizeRunStreamOptions` 套在 wire 请求体上，校验不会生效。
它认的是 SDK 的 `streamMode` / `streamResumable`（camelCase），而 Gateway 收的是
`stream_mode` / `stream_resumable`（snake_case）——`"streamMode" in options` 恒为
false，**一声不响地放行**。适配层必须显式桥接两种命名再调它。这是被测试抓出来的，
两种命名各有一个回归用例在
`tests/unit/agent-deerflow/run-protocol.test.ts`。

生产模式定义在 `app/composables/useThreadStream.ts`，普通发送、重新生成和编辑后重跑
共享同一个常量，不能让某个入口省略后退回 Gateway 的 `values` 默认值。对应黑盒回归在
`tests/unit/threads/thread-stream.dom.test.ts`：它从 fake runner 的 submission 断言真实 wire
payload，而不是只测协议层能否转发一个由测试手工构造的 `stream_mode`。

---

## B. 消息渲染与分组

| #   | 约束                                                                                                                                                                                                                    | 为什么                                                                                                                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| B1  | 带 `tool_calls` 的 AI 消息里若有可见文本，必须作为 processing step 渲染                                                                                                                                                 | 保留 provider 的错误解释、"换个思路试试"这类文本                                                                             |
| B2  | 当前回合仍在 loading 时，最新可见 human 之后的纯内容 AI 消息**留在 processing 分组**                                                                                                                                    | provider 可能稍后往同一条消息追加 tool-call chunk；过早判定为终态气泡会让文本跳进步骤面板                                    |
| B3  | 前面已有 tool call 之后出现的纯内容 AI 消息，流式期间仍显示在最后一个 tool-call 步骤之后                                                                                                                                | 同上，它自己也可能再获得 tool call                                                                                           |
| B4  | **reasoning 必须在答案文本上方**，两个渲染组件都要（#4576）                                                                                                                                                             | 同一条消息在生命周期内由 `MessageGroup` 和 `MessageListItem` 先后渲染；两边不一致会导致回合settle瞬间两者互换位置            |
| B5  | reasoning 之**前**发出的 assistant 文本保持原位，只有 reasoning 产出的答案移到其下方                                                                                                                                    | —                                                                                                                            |
| B6  | run duration 折叠为一份，锚定在该 run 最后一个可见消息组之后                                                                                                                                                            | 兼容字段 `additional_kwargs.turn_duration` 在历史 AI 消息上重复出现                                                          |
| B7  | run duration 是**整个 run 的墙钟时间**，不是单条消息的思考时间；与 reasoning 披露分开渲染                                                                                                                               | —                                                                                                                            |
| B8  | workspace-change 卡片只挂在该 run 的**最后一个 assistant 气泡**（#4555）                                                                                                                                                | 卡片由 `(threadId, runId)` 解析，否则该 run 的每条 AI 消息都会渲染一份                                                       |
| B9  | 两个 anchor helper 的候选集合**故意不同**，不要统一                                                                                                                                                                     | run duration 由 `MessageList` 在每个组周围发出，接受任意类型；workspace-change 由 `MessageListItem` 发出，只接受 `assistant` |
| B10 | 每个 processing 组的 tool-result / browser-preview 查找表**每组只构建一次**                                                                                                                                             | 保留首个非空结果与首个带截图的 browser view，避免为每个 tool call 重扫全组                                                   |
| B11 | citation 链接的 `citation:` 标签要从**完整 children 树**推导                                                                                                                                                            | 流式期间 children 可能是元素或数组，不是纯字符串                                                                             |
| B12 | 消息视口贴底时，流式内容的每次尺寸增长都继续跟随底部；用户主动上滚后立即释放，回到底部时恢复                                                                                                                            | AI token 会持续追加在同一个消息组内，不能只监听组数量；语义与 React `use-stick-to-bottom` 的 resize/follow 行为一致          |
| B13 | 实际 `MessageList → StreamMarkdown` 的全部链接必须经过统一 MarkdownLink；协议 allowlist 先于 citation/artifact 分支，危险 href 降级为不可点击文本；HTTP(S) 外链与 artifact/citation 使用 `target="_blank"` 和安全 `rel` | 只在默认 Markdown pipeline 加 sanitizer 不能保护消息实际覆盖的 `components.a` 路径                                           |

> 主要代码位置：`app/core/messages/utils.ts`、`app/core/messages/run-duration.ts`、
> `app/core/messages/workspace-change-anchor.ts`、`app/components/chat/MessageList.vue`。

B12 由 `MessageList.vue` 的内容 `ResizeObserver` 驱动。主会话按 React 默认值平滑跟随，
sidecar 与 React 一样使用即时跟随；真实分块 SSE 回归位于
`tests/m4a-stream/real-stream.spec.ts`，同时固定贴底和用户主动上滚两条路径。

---

## C. 历史加载与顺序

| #   | 约束                                                                                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | 历史分页保留后端的 **thread 全局 `seq`**；渲染时按规范身份叠加 checkpoint / live 副本                                                                                        |
| C2  | 上下文压缩救援要 diff **每一个保留的可见身份**，不能在第一个锚点处切片                                                                                                       |
| C3  | 维护 run 作用域的已提交可见消息账本，使替换更新与滚动 checkpoint 窗口不会抹掉已显示的步骤                                                                                    |
| C4  | 对于规范位置仍落在未加载游标页之后的 checkpoint / 瞬态前缀，**抑制**而非在最近锚点前折叠该未知间隙                                                                           |
| C5  | 添加乐观消息时**不要按时间戳重排序**                                                                                                                                         |
| C6  | 历史失效时**保留已加载的页**，不要丢弃已确立的顺序位置                                                                                                                       |
| C7  | 动态上下文会把提交的用户消息从 `X` 重新键为 `X__user`；UI 身份匹配**只对 human message** 归一化该保留后缀                                                                    |
| C8  | 本地提交的回合要记录 pre-submit 身份基线：若 `messages-tuple` 先于 `values` 发布新的 AI/tool 步骤，只把非基线的可见步骤移到新 human 之后，不动历史、隐藏控制消息和重连的 run |
| C9  | 该本地顺序锚点要**保持到 finish / stop / stream error**；下次本地提交时替换，切换 thread 或 replay-gap 恢复时清除                                                            |
| C10 | 历史初次只请求最新一页；只有显式按钮或用户向上交互后的 sentinel 才取下一页。重复触发要合并，前插旧消息后保持可见内容的滚动锚点                                               |

> 主要代码位置集中在 `app/core/threads/history.ts`、`message-merge.ts`、
> `local-turn-order.ts`、`cache-invalidation.ts` 以及 `app/composables/useThreadHistory.ts`、
> `useThreadStream.ts`。这些纯函数和生命周期测试必须一起维护。

---

## D. Artifacts

| #   | 约束                                                                                                                                   | 为什么                                                                                                                                                      |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | 文件工具的 artifact 自动打开必须在 **effect 内**执行并带 timer 清理                                                                    | 渲染 `write_file` / `str_replace` / 暂存写入更新时**绝不能在渲染期间起定时器**                                                                              |
| D2  | `write_file` / `str_replace` 可在 loading 时打开流式草稿 URL；`finalize_artifact_write` **只在工具返回 `OK` 后**打开真实 artifact 路径 | —                                                                                                                                                           |
| D3  | HTML 预览要过与 `app/core/artifacts/preview.ts` 相同的轻量文档完整性检查                                                               | 已完成的 `.html`/`.htm` 草稿若 `html`/`body` 标签缺失或错序、或 `head`/`style`/`script` 不配对，**留在代码视图**而不是塞进 iframe。文档仍在组装时允许前缀块 |
| D4  | `ThreadState.artifacts` 是**权威列表**；provider 只持久化 thread 作用域的面板 UI 状态（open、选中路径、刷新引导缓存）                  | 历史加载完成前，**初始的空流值不得覆盖已恢复的状态**                                                                                                        |
| D5  | run 结束时刷新一次正式 artifact 内容；瞬态 `write-file:` 预览保持消息驱动                                                              | —                                                                                                                                                           |
| D6  | 显式编辑**只对 `/mnt/user-data/outputs` 下已打开的正式 UTF-8 文本 artifact** 开放                                                      | 草稿留在 provider 内存直到保存，切换右侧面板不丢；受已加载的 SHA-256 修订保护，不被远程刷新覆盖                                                             |
| D7  | run 进行中禁止保存；修订变化时保留草稿并提示冲突，**不得覆盖 agent 输出**                                                              | —                                                                                                                                                           |
| D8  | 常规 artifact 文本加载最多通过 HTTP byte range 请求**前 1 MiB**                                                                        | 截断预览必须保持轻量并提供显式的"加载完整文件"操作；在用户请求并拿到完整内容之前**不要挂载 CodeMirror**                                                     |

---

## E. Composer / 输入框

| #   | 约束                                                                                                                                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | Composer 草稿是 **tab 作用域**：只把文本 + 选中的 slash 技能名存 `sessionStorage`，按 user / agent / 逻辑会话作用域分键                                                    |
| E2  | 新会话页用固定作用域 `"new"`（其运行时 `threadId` 每次刷新都是新 UUID）；已建立的会话用真实 thread ID                                                                      |
| E3  | 附件、sidecar 引用、语音状态、polish 撤销状态**不持久化**                                                                                                                  |
| E4  | `InputBox` 要等技能列表就绪后再恢复技能 chip；技能缺失或被禁用时**降级为可编辑的斜杠文本**                                                                                 |
| E5  | 只有在发送通过 in-flight 守卫之后，才通过 `SendMessageOptions.onSent` 清除草稿                                                                                             |
| E6  | `/goal` 与 `/compact` 是**内置命令，不是技能激活**；在正常聊天提交前拦截                                                                                                   |
| E7  | `/goal <condition>` 除设置目标外还要把条件文本作为下一个用户任务提交（立即开跑）；查询状态与 clear 不启动 run                                                              |
| E8  | goal / compact 请求绑定当前 `threadId` 并带 `AbortController`：切换 thread 或卸载 composer 要中止在途请求，防止过期响应污染新 thread                                       |
| E9  | 选中技能 chip 后，在旁边的可编辑文本里输入 `/` 要能**重新打开**技能列表；选中条目是**替换 chip 而非追加**（wire 格式只允许一个前导 `/skill`）                              |
| E10 | 已选中 chip 时**不提供内置命令**（`/goal` 会被当作聊天文本提交）                                                                                                           |
| E11 | 斜杠**只在输入起始位置**打开列表（`getLeadingSlashSkillQuery`）—— 由 `tests/e2e/chat.spec.ts` 固定                                                                         |
| E12 | established thread 的 `/compact` 只允许一个在途请求；成功清草稿并失效 thread/history/search/token 六个 key，4xx/409 保留输入并显示 Gateway 原始 `detail`；新会话不调用 API |

---

## F. Human input 协议

| #   | 约束                                                                                                                                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | **请求侧有版本，回复侧固定 v1。** v1 = `free_text` / `choice_with_other`；v2 增加 `form`                                                                                      |
| F2  | 表单卡片提交 `response_kind: "text"`，值为"人类可读摘要 + 一个以稳定字段名为键的 JSON 块"（`buildHumanInputFormSubmissionValue`）                                             |
| F3  | 校验器要拒绝未知版本 / 模式，以及与 `Object.prototype` 成员冲突的字段名 → 降级为纯文本 ToolMessage                                                                            |
| F4  | 表单值只走 own-property 读取（`readHumanInputFormValue`）                                                                                                                     |
| F5  | select 字段从空字符串占位状态起就是受控的                                                                                                                                     |
| F6  | checkbox 用原生 `<input type="checkbox">`，显式初始化为 `false`（`buildInitialHumanInputFormValues`）；**不加 HTML `required` 属性**（原生约束校验会拦截自定义提交路径）      |
| F7  | 表单控件需 label/`for`、`aria-required` + 视觉隐藏的本地化"必填"标记、`aria-invalid` 与错误关联；只要还有字段无效，错误节点保持挂载                                           |
| F8  | **Composer 绕过闭合**：可见的普通 human 消息只回答"在它之前打开的最新一个未回答请求"——只关最新一个。更早的请求重新成为活动卡片                                                |
| F9  | 已回答状态从**原始 `thread.messages`** 推导（回复是隐藏的）；pending 卡片在隐藏回复出现、派发被丢弃、或新的 `thread.error` 报告异步流失败时清除                               |
| F10 | 页面级卡片提交回调发普通 human 消息，把 `hide_from_ui: true` 与响应载荷放在 `sendMessage` 第 4 个参数的 `additionalKwargs`；第 3 个参数仍是 run 上下文（如 `{ agent_name }`） |
| F11 | 有未答请求时 composer 入口**保持可用**；普通可见消息会绕过卡片并启动下一个 run                                                                                                |

> 主要代码位置：`app/core/messages/human-input.ts`、`app/components/chat/HumanInputCard.vue`。

---

## G. Subtask（子智能体）

| #   | 约束                                                                                                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | `Subtask.steps[]` 从 `task_running` 事件**累加**（`mergeSteps` 追加，不是覆盖）                                                                                                  |
| G2  | 历史 run 展开时用 `fetchSubtaskSteps` 回填：按单个 task 分页拉 `GET /runs/{runId}/events?event_types=subagent.step&task_id=…&after_seq=…` 直到短页，避免 run 级 limit 截断时间线 |
| G3  | `computeNextSubtask` 保留**最大**累计用量，使重放或迟到的 SSE 帧不会重复计数或让卡片回退                                                                                         |
| G4  | `useUpdateSubtask` 针对镜像最新 state 的 `tasksRef` 应用更新（**不是闭包快照**），使迟到的回填不会覆盖 SSE 步骤或兄弟 subtask                                                    |
| G5  | `stepsForDisplay` 保留 tool 步骤与有文本的 AI 步骤；完成后丢弃末尾的 final-answer AI 步骤（它已作为 `result` 显示）                                                              |
| G6  | 重新加载后从终态 ToolMessage 元数据（`subagent_model_name` / `subagent_token_usage`）恢复，**不需要**逐卡片拉事件                                                                |
| G7  | `task_started/running/completed/failed/cancelled/timed_out` 进入同一个 reducer；`message_index` 去重排序，迟到进度不得把终态回滚                                                 |
| G8  | `llm_retry` 必须显示 Gateway 提供的用户文案，并在下一条有效进度、普通 update、finish、error 或 replay-gap 时清除                                                                 |
| G9  | Subtask 卡片的折叠按钮保持 `aria-expanded`/`aria-controls` 与键盘焦点；历史步骤失败要显示可重试错误                                                                              |

---

## H. 面板与布局

Vue 前端使用 `splitpanes`。它通过响应式 `:size` 和 `@resize` / `@resized` 驱动，
没有命令式 collapse 句柄；面板状态必须按下面的声明式合同维护。

| #   | 约束                                                                                                                                             | 为什么                                                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1  | **三个右侧面板（artifacts / sidecar / browser）共用同一个面板组**，不要按面板种类分叉出非可调整尺寸的分支                                        | 分叉正是 artifacts 分隔条静默失去拖拽手柄的原因（#4465）                                                                                                                                                              |
| H2  | 开关靠**改绑定的 `:size`（→ 0 / → 上次正值）**，**不是 `v-if` 条件渲染**                                                                         | React 版用 `collapse()` / `resize()` 命令式句柄；splitpanes 没有，等价做法是驱动响应式 size。目的相同：只有面板元素一直在 DOM 里，宽度才能动画过渡                                                                    |
| H3  | 尺寸过渡作用在**面板库自己的面板元素**上（React 版是 `[&>[data-panel]]:transition-[flex-grow]`；splitpanes 对应 `.splitpanes__pane`）            | 被 flex 布局的是库的元素，不是 `class` 落到的子节点                                                                                                                                                                   |
| H4  | 过渡**只在开关进行中**启用，拖拽时不启用                                                                                                         | 否则拖拽会被逐帧插值                                                                                                                                                                                                  |
| H5  | 动画期间面板内容按最终宽度固定并裁剪                                                                                                             | 重排的消息列表会重跑滚动到底（由 `tests/e2e/sidecar-chat.spec.ts` 的 no-animated-scroll 测试固定），重新换行的 composer 会改变显示哪些响应式标签                                                                      |
| H6  | 拖拽中（`@resize`）记录最后的正值尺寸，但拥有状态的 `sidecar` / `browserView` / `artifactsOpen` **只能在 `@resized`（pointer 释放后）镜像 `0%`** | 在第一个 `0%` 帧就关闭，会破坏"拖到边缘再拖回来才松手"的连续手势。**这一条恰好能干净映射到 splitpanes 的两个事件**——`@resize` / `@resized` 的语义分界正是 React 版靠 `onResize` vs `onLayoutChanged` 手工维持的那条线 |
| H7  | 上下文窗口控件**故意常驻**：`context_usage` 不可用时渲染仪表占位而不是卸载                                                                       | —                                                                                                                                                                                                                     |
| H8  | `useThreadTokenUsage` 只在响应的 `thread_id` 仍匹配当前路由时保留占位数据                                                                        | 同 thread 刷新不闪烁，跨 thread 导航永不显示上一个会话的用量                                                                                                                                                          |

测试必须等待响应式 flush/rAF，不能在 click/mousemove 返回的同一 tick 读取状态。

---

## I. Browser view

| #   | 约束                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------- |
| I1  | 每次物理指针点击只转发**一个** `click` 输入；不要为同一手势同时发 `down`/`up`（远端 Playwright 点击会执行两次）           |
| I2  | 请求二进制 JPEG 帧（`frame_format=binary`）；状态、URL、标签页、导航拒绝消息保持 JSON                                     |
| I3  | 帧缓冲只保留**最新的一个**待处理帧，每个动画帧最多发布一次，并负责 object-URL 回收                                        |
| I4  | 保留 Gateway 的旧版 JSON/base64 帧路径以兼容老客户端                                                                      |
| I5  | Workspace Browser 触发器与右侧面板由 `/api/features -> browser_control.enabled` 控制；默认/失败的特性发现要**隐藏**该控件 |

---

## J. 认证与存储

| #   | 约束                                                                                                                                                                                                                                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J1  | 登录页的"保持登录"只向 Gateway 提交 `remember_me`，本地**只能持久化邮箱地址**                                                                                                                                                                                                 |
| J2  | **密码与 token 绝不能进前端存储**；`HttpOnly access_token` 与可读的 `csrf_token` cookie 归 Gateway 所有                                                                                                                                                                       |
| J3  | auth-disabled 只用于 mock 合同；真实认证必须经 Nuxt preview 同源代理验证 register/login、Set-Cookie、CSRF 写请求、refresh 与 logout                                                                                                                                           |
| J4  | `localhost` cookie 不按端口隔离：React 与 Vue 会共享登录/退出状态，不能用两个端口模拟两个不同用户                                                                                                                                                                             |
| J5  | 生产 OIDC 必须保证“从哪个前端发起就回哪个合法前端”；相对回跳方案要求 `frontend_base_url` 与 provider `redirect_uri` 同时留空、IdP 注册两个 callback URI、可信代理正确传 Host/Proto。若必须用任一单值绝对 URL，就要以后端签名 state + allowlist 扩展解决，未解决前属于发布阻断 |
| J6  | OIDC state cookie 不按端口隔离，cookie 名又只按 provider 区分；同一 hostname 的 React/Vue 两个端口不能并发发起同一 provider 登录。生产认证隔离使用独立 hostname，G0-7 必须覆盖并发/覆盖风险                                                                                   |
| J7  | OIDC callback 必须通过同源 `/api/v1/auth/me` 验证 session，复用 `next-path.ts` 拒绝开放重定向，并分别收敛 authenticated、401、Gateway unavailable 的状态与 replace 跳转                                                                                                       |
| J8  | Gateway session 只由统一 Vue Query key/composable 持有；middleware 与 workspace 不能各存一套用户真相。401 才跳登录，unavailable 保留当前工作区、显示状态并提供后台/手动重试，恢复 authenticated 后原地继续                                                                    |
| J9  | 真实模式的 `/workspace` 固定进入 `/workspace/chats/new`；不得恢复已排除的 static demo/mock 分支                                                                                                                                                                               |

---

## K. 路由与其他

| #   | 约束                                                                                                                                                                                      |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K1  | Web UI 会话路径必须通过 `app/core/threads/utils.ts::pathOfThread()` 构造 —— 它会对自定义 agent 名和 thread ID 做百分号编码后再插入路由段                                                  |
| K2  | 编辑并重跑**只限最新回合**：仅当记录空闲且最近的可见回合以终态 assistant 消息结尾时才暴露（`getLatestEditableTurn()`）                                                                    |
| K3  | 编辑并重跑走 `POST /api/threads/{id}/runs/edit-regenerate/prepare`，用与 regenerate 相同的流路径提交返回的替换消息/checkpoint/元数据，乐观隐藏被取代的消息 id，持久化替换到达后清除乐观态 |
| K4  | 重命名走同一条序列化状态写入路由；活动 run 返回 409 时对话框保持打开并显示服务端错误                                                                                                      |
| K5  | 设置 > 工具的 MCP 开关调用定向的 `PATCH /api/mcp/config`；在该 mutation 的成功 refetch 完成前禁用开关；通过 toast 显示后端错误 `detail`；**成功后才**失效 `["mcpConfig"]`                 |
| K6  | 定时后台运行是**非交互**的：`context.non_interactive=true` 时 lead-agent 工具集排除 `ask_clarification`。该键只对内部认证的调用方生效，客户端提交的会被丢弃（后端行为，前端不要伪造）     |
| K7  | prepared replay 的 prepare 与 stream 共用 generation/AbortController；重复提交、切路由、stop、error、cancel 和成功都必须清掉 guard、乐观态与 superseded masks                             |
| K8  | Gateway 非成功响应统一保留 HTTP status、FastAPI `detail`、结构化 body 与原始正文，不能在 prepared replay 或 compact 路径换成通用错误                                                      |
| K9  | 所有主 thread 列表按**原始后端行数**推进 offset，再过滤 sidecar；Pinia 不保存第二份 server-state 列表                                                                                     |
| K10 | 删除主 thread 时先全量搜索并并发删除 sidecar，sidecar 全成功后才删主 thread；部分失败保留主 thread、清掉已成功缓存并暴露失败 ID 的可见重试                                                |

> K6 是后端合同。前端只验证请求中不会伪造 `context.non_interactive`；后端的工具集裁剪
> 由后端测试负责。

---

## L. SSE transport 与会话协议

DeerFlow 经 Nginx/Nitro 代理流式响应，并使用 SSE `Last-Event-ID` 重放。通用实现位于
`packages/agent-core/src/transport/` 和 `session/`，DeerFlow 协议适配位于
`app/core/agent-deerflow/`。

| #       | 补强项                                    | 为什么                                                                                                                                                                                                                   |
| ------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| L1      | **CRLF 归一化**                           | SSE 规范允许 `\r\n\r\n`；只找 `\n\n` 时，代理链产生 CRLF 会让 buffer 无法完成分帧                                                                                                                                        |
| L2      | **保留 `id:` 字段**                       | DeerFlow 重放依赖 SSE `Last-Event-ID`；解析器必须保留 `id:`，resume 请求必须携带该游标                                                                                                                                   |
| L3      | **`data:` 只剥一个前导空格**              | SSE 规范只要求去掉字段名后的一个可选空格；对流式 token 使用 `trim()` 会丢失有意义的前导空格                                                                                                                              |
| L4      | **重试加指数退避**                        | 立即连续重试会在短时网络抖动期间集中失败                                                                                                                                                                                 |
| L5      | **重试计数需要总量上限**                  | 局部成功后清零重试预算会让持续抖动的长连接无限重连                                                                                                                                                                       |
| L6      | **buffer 需要上限保护**                   | 后端一直不发分隔空行时 buffer 会无限增长。长报告场景值得加保护                                                                                                                                                           |
| L7      | **看门狗阈值重定**                        | DeerFlow 的 sandbox、浏览器和子智能体调用可能长时间没有业务帧，不能用固定的短静默阈值误杀正常 run                                                                                                                        |
| L8      | **不要模块级可变状态**                    | sidecar 子会话与多个 thread 可并存，消息缓冲必须属于 message 或 per-stream context                                                                                                                                       |
| **L9**  | **心跳注释帧要识别、且不能当事件**        | 以 `:` 开头的 SSE 注释是 keep-alive；它不能进入 reducer，但必须重置看门狗计时                                                                                                                                            |
| **L10** | **create POST 最多一次**                  | 初始请求创建 run；响应头前断网且后端没有 idempotency key 时必须 fail closed，不能自动重放 POST                                                                                                                           |
| **L11** | **续传必须切到既有 run 的 GET stream**    | 拿到 run handle 后，网络中断调用 `resume()` 并带 `Last-Event-ID`；不得复用 create URL/method/body                                                                                                                        |
| **L12** | **Content-Location 与 Location 分开验证** | Gateway create 明确发 `Content-Location`；当前 SDK 的 metadata 与 reconnect 读取不同 header。Nuxt proxy 前后都要记录，不能假定二者等价                                                                                   |
| **L13** | **abort 不等于 cancel**                   | 本地停止读取只能释放连接；用户点 stop 时必须显式调用 Gateway cancel/cancel-then-drain，并观察最终 session 状态                                                                                                           |
| **L14** | **最终 checkpoint 不是流式 oracle**       | 516 条消息只能验证最终 adapter/state；raw SSE trace 才验证 chunk、id、namespace、heartbeat、gap 与重连时序                                                                                                               |
| **L15** | **完整 state 与消息同一次归约**           | `values` 会带 messages、artifacts、todos、goal 等；不能只维护 message map，再让组件各自补业务状态                                                                                                                        |
| **L16** | **cancel 结果不能压成 `void`**            | UI stop 先进入 `stopping`；200 SSE 要 drain 尾帧，202 accepted 要轮询 durable run，204/已确认终态后再按 Gateway durable status 映射为 `cancelled`/`completed`/`failed`。创建阶段无 handle 的断开是“不确定”，不是“已取消” |

同时，A 组全部约束仍然适用。L1–L16 分别由 transport 单测、session 状态机测试、
raw trace、代理 smoke 和 replay Gateway 浏览器测试覆盖，不能只依赖最终 checkpoint。

---

## M. Vue 框架语义

| #   | 约束                                                                   | 为什么                                                                                                                      |
| --- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| M1  | `provide()` 必须传 **ref / reactive / computed**，不能传普通对象或裸值 | Vue 的 `inject` 在 setup 期间**一次性解析**，拿到的是当时那个引用；传裸值时后续变化不会传播到消费方                         |
| M2  | `inject()` 只能在 setup 同步阶段调用                                   | `await` 之后或回调里调用会拿不到值。React 的 `useContext` 无此限制                                                          |
| M3  | 自定义 Markdown 组件覆盖接收的是 **`class`** 而不是 `className`        | `hast-util-to-jsx-runtime` 对 Vue 必须设 `elementAttributeNameCase: 'html'`                                                 |
| M4  | 逐词动画的 key 必须稳定                                                | 与 B 组无关，是 Vue 的 diff 语义：key 变化会重新挂载节点并重播动画。铁律仍是**不要用 per-word rehype 插件**                 |
| M5  | `watch` 默认是**惰性**的，React 的 `useEffect` 默认首次就跑            | 搬 effect 时若原逻辑依赖挂载即执行，要显式 `{ immediate: true }`。A7、D1、D4 这类"初始状态不得被覆盖"的约束最容易在这里翻车 |
| M6  | `onErrorCaptured` 返回 `false` 才阻止错误继续冒泡                      | 与 React ErrorBoundary 的语义不同，Markdown 错误边界要显式返回                                                              |

---

## N. 上传 / 通知 / 语音 / i18n

| #   | 模块                                                 | 持续合同                                                                                                 |
| --- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| N1  | `app/core/uploads/`、`app/composables/useUploads.ts` | 上传限制来自 Gateway；附件属于提交前状态，切换 thread 或提交后不得错误复用；前端校验与后端限制要同步验证 |
| N2  | `app/composables/useNotifications.ts`                | 只在浏览器支持且用户授权时发通知；页面可见性与 run 生命周期变化不得产生重复通知                          |
| N3  | `app/core/voice-input/speech-recognition.ts`         | 不支持 SpeechRecognition 或权限失败时必须可恢复；语音状态不持久化                                        |
| N4  | `app/core/i18n/`、`app/plugins/i18n.ts`              | locale cookie 名与期限必须保持兼容；切换语言、首帧解析和字典完整性由 i18n gate 验证                      |

---

## 使用建议

1. 修改 `app/core/` 时连同单测和调用方一起检查；通用包变更还要运行 `make consumer-check`。
2. 组件层的约束（B、D、H 组）没有单测覆盖的部分，靠 Playwright E2E 兜底。
3. A 组与 L 组是自研 SSE 的正确性基线，必须有对应单测，**不能只靠 E2E**——流式的时序问题在 E2E 里既难复现也难定位。
4. M 组适用于所有 Vue 组件和 composable，不属于某一个业务域。
5. 每次改变产品行为、Gateway 合同或框架边界，都要回到对应小节更新约束和测试路径。
