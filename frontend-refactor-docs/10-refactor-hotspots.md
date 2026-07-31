# 10 · 重构热点、不变量与风险清单

> 本篇是**现状记录**，不是重构方案。它回答两个问题：
> 「哪里最值得动」和「动的时候什么绝对不能破」。

## 10.1 热点排序（体量 × 修改频率）

churn 取最近 400 次提交中触及 `frontend/src` 的文件计数。

| 文件 | 行数 | churn | 判读 |
| --- | --- | --- | --- |
| `core/threads/hooks.ts` | **3,072** | 68 | 🔴 **第一优先级**。全站唯一的超大逻辑文件，改动最频繁 |
| `components/workspace/input-box.tsx` | **2,859** | 48 | 🔴 单一组件承载 composer 全部职责 |
| `components/workspace/messages/message-list.tsx` | 1,423 | 43 | 🟠 消息渲染 + 多种卡片状态判定 |
| `components/workspace/messages/message-group.tsx` | 1,058 | 26 | 🟠 |
| `components/workspace/messages/message-list-item.tsx` | 758 | 45 | 🟠 churn 高于体量预期 |
| `app/workspace/chats/[thread_id]/page.tsx` | 453 | 52 | 🔴 churn 极高，且与 agent 页成对修改 |
| `app/workspace/agents/[agent_name]/chats/[thread_id]/page.tsx` | 426 | 28 | 🔴 与上一行重复 |
| `core/messages/utils.ts` | 861 | 26 | 🟡 纯函数、已有测试覆盖，风险较低 |
| `core/i18n/locales/{en-US,zh-CN,types}.ts` | 1123/1072/888 | 92/92/81 | ⚪ churn 最高但属**结构性成本**，非坏味道 |
| `components/workspace/settings/memory-settings-page.tsx` | 993 | 12 | 🟡 体量大但稳定 |
| `components/workspace/sidecar/sidecar-panel.tsx` | 975 | — | 🟡 |
| `components/workspace/artifacts/artifact-file-detail.tsx` | 802 | 33 | 🟠 |

## 10.2 五处结构性问题

### ① `core/threads/hooks.ts` — 3,072 行里塞了六种东西

它同时是：
1. **流编排**（`useThreadStream`，约 1,060 行，含 10+ 个本地状态和 5 个 SDK 回调）
2. **历史合并的纯函数库**（约 15 个已导出的纯函数：`mergeMessages`、
   `resolveTransientHistoryBridge`、`computeSummarizationTransientMessages`…）
3. **分页协议**（`parseThreadMessagesPageResponse`、`buildThreadMessagesPageUrl`…）
4. **TanStack Query 缓存操作**（`upsertThreadInSearchCache`、
   `invalidateStoppedThreadCaches`、`mapInfiniteThreadsCache`…）
5. **thread CRUD hooks**（`useThreads`、`useInfiniteThreads`、`useDeleteThread`、
   `useRenameThread`、`usePinThread`、`useBranchThread`、`useThreadMetadata`、
   `useThreadRuns`、`useRunDetail`、`useThreadTokenUsage`）
6. **渲染合并**（`useCoalescedStreamMessages` + `decideCoalesce`）

**有利条件**：第 2、3、4、6 类**已经是导出的纯函数**，并且被单测覆盖
（`tests/unit/core/threads/` 下多个文件）。按职责拆文件是低风险操作。

**难点**：`useThreadStream` 内部十余个 ref 与 state 相互耦合
（`threadIdRef` / `currentViewThreadIdRef` / `messagesRef` /
`renderedMessageSnapshotRef` / `transientHistoryBridgeRef` / `summarizedRef` /
`pendingUsageBaselineMessageIdsRef` / `pendingPreparedReplayRef`），
这部分不能机械切分。

### ② `input-box.tsx` — 2,859 行的 composer

它承载：普通提交、`/goal` 三态命令、`/compact`、斜杠技能选择与降级、
附件上传、语音输入、草稿恢复、input-polish、建议拉取、模型/模式切换、
IME 处理、in-flight guard、AbortController 生命周期。

已有 `input-box-helpers.ts`（286 行）承接纯逻辑——**这个模式已经存在，只是没做够**。

### ③ 两个聊天页高度重复

按去空白后逐行 diff，`chats/[thread_id]/page.tsx`（453 行）与
`agents/[agent_name]/chats/[thread_id]/page.tsx`（426 行）
共有 **173 行差异**，即约 **60% 完全相同**。

差异集中在：run context 是否带 `agent_name`、welcome 区域内容、
agent 相关的元数据展示。两者的 branch / edit-regenerate / human-input / goal /
面板接线几乎逐字重复，churn 数据也印证它们成对修改。

⚠️ 抽公共壳时必须保住 [03-routing-and-pages.md §3.6](03-routing-and-pages.md#36-页面级职责归属不可下沉到组件)
列出的「页面级职责」——`AGENTS.md` 明确要求这些逻辑留在页面层，
因为页面必须保留普通 / 自定义 agent 的 run context 差异。

### ④ 三个运行模式开关散落各处

`isMock`、`isStaticWebsiteOnly()`、`env.NEXT_PUBLIC_STATIC_WEBSITE_ONLY === "true"`
在同一个文件里以不同形式反复出现。仅 `chats/[thread_id]/page.tsx` 一个文件里
`env.NEXT_PUBLIC_STATIC_WEBSITE_ONLY === "true"` 就出现 **5 次**，
且总是与 `isMock`、`isNewThread`、`isUploading`、`thread.isLoading` 组成
布尔表达式来喂 `canRegenerate` / `canEdit` / `canBranch` / `disabled`。

这些能力判定表达式本身就是重复的（`canRegenerate` 和 `canBranch` 的条件几乎相同，
`canEdit` 多两个条件）。

### ⑤ core / components 的 context 归属不一致

`SubtasksProvider` 在 `core/tasks/`，而 `ArtifactsProvider` / `SidecarProvider` /
`BrowserViewProvider` 在 `components/workspace/*`。三者都是流事件的接收端，
划分依据（"是否带业务语义"）在这里说不通。

同类问题：`core/streamdown/components.tsx` 和 `core/utils/files.tsx` 含 JSX，
是 `core` 不依赖 `components` 这条规则的两个例外。

## 10.3 必须保留的不变量（红线清单）

按"破坏后的症状"排列。每一条都对应一个已修的真实缺陷或代码里的显式警告。

### 传输层

| # | 不变量 | 破坏后症状 |
| --- | --- | --- |
| T1 | `client.runs.stream` 包装必须是 **generator**（惰性 AsyncIterable） | run 创建时机提前，SDK `StreamManager` 行为改变 |
| T2 | `joinStream` 前必须做终态短路（`TERMINAL_RUN_STATUSES`） | reload 后 `isLoading` 永久 true，提交按钮变停止按钮，第一条消息发不出 |
| T3 | `gap` 控制帧必须被拦截并走恢复流程 | SDK 忽略未知事件名 → 报告为"正常结束"，历史静默丢失 |
| T4 | gap 恢复预算：原始 stream 不计数，最多 5 次重连（共 6 次 stream 调用） | 无限重连或过早放弃 |
| T5 | 终态取消 409 可吞，"活在别的 worker"409 不可吞 | 吞错 → 真实取消失败被隐藏；不吞 → 停止时出现 unhandled rejection |
| T6 | stream mode 白名单：超出即 throw，不静默回落 `values` | 部分转发 / 意外降级 |
| T7 | `streamResumable` 必须在发 HTTP 前剥掉 | Gateway 拒绝该请求选项 |
| T8 | 两条通道的 CSRF 注入判定必须一致 | 403 |

### 编排与状态

| # | 不变量 | 破坏后症状 |
| --- | --- | --- |
| S1 | `throttle: true` **只能用布尔档**，且必须显式写 | 数字档是尾部去抖 → chunk 持续到达时 UI 更新饿死；不写则运行时默认 `false` |
| S2 | 首次提交后改 URL 必须用 `history.replaceState`，**不能**用 Next router | 组件重挂载，丢失全部流式状态 |
| S3 | `isNewThread=true` 期间不能把 thread id 传给 SDK | SDK eagerly fetch `/history`，thread 不存在 → 报错（#2746） |
| S4 | 不能把字面量 `"new"` 传给 `useStream` | 422 |
| S5 | 停止后需**立即失效 + 1.5s 后补拉一次** | 拿到 finalize 之前的旧标题 |
| S6 | `useUpdateSubtask` 必须基于 `tasksRef` 而非闭包快照 | 晚到的 `fetchSubtaskSteps` 回填覆盖 SSE steps 或兄弟子任务 |
| S7 | `computeNextSubtask` 保留最大累计用量 | 重放/迟到 SSE 帧导致重复计数或数字回退 |
| S8 | 上下文压缩救援要 diff **每个**保留的可见身份，不能在首个 anchor 切片 | 已显示的步骤被擦掉 |
| S9 | 历史失效时保留已加载的页 | 丢失既成排序位置 |
| S10 | 乐观消息追加不做时间戳重排 | 顺序错乱 |
| S11 | `safeLocalStorage` 必须吞掉全部存储异常 | Safari 隐私模式 / 配额满 → 异常冒进 render，composer 和设置面板炸掉 |
| S12 | goal / compact 请求必须绑 `threadId` + `AbortController` | 切换 thread 后过期响应污染新 thread 的 composer |

### 渲染层

| # | 不变量 | 破坏后症状 |
| --- | --- | --- |
| R1 | 带 `tool_calls` 的 AI 消息的可见文本必须渲染成处理步骤 | 丢掉 provider 的错误解释 / "换个思路"说明 |
| R2 | loading 中的纯内容 AI 消息留在 processing 组 | 文本跳进步骤面板（provider 可能稍后追加 tool call） |
| R3 | 产物自动打开必须在带清理的 effect 里；渲染流式写入时不排定时器 | 渲染期副作用 / 定时器泄漏 |
| R4 | HTML 预览须过 `preview.ts` 的文档完整性检查 | 截断的 HTML 被塞进 iframe 渲染 |
| R5 | 不得重新引入"逐词包裹"的 rehype 插件 | 增长块重新解析 → 旧词重挂载并重播动画 |
| R6 | 引文标签须从完整 `ReactNode` children 树推导 | 流式期间 children 是 element/数组时标签错误 |
| R7 | run 级展示（时长 / workspace 变更卡）必须用 anchor，不能挂每条消息 | 渲染出多份重复副本（#4555） |
| R8 | 两个 anchor helper 的候选集**有意不同**，不要统一 | anchor 落在不渲染它的位置上 |
| R9 | `MessageGroup` 的 tool-result / browser-preview 查表每组只建一次 | 每个 tool call 重扫整组，性能退化 |

### 面板布局（issue #4465 区）

| # | 不变量 | 破坏后症状 |
| --- | --- | --- |
| P1 | 三个右面板共用一个 `ResizablePanelGroup`，不按种类分叉 | artifacts 分隔线静默丢掉拖拽手柄 |
| P2 | 开合用 `collapse()`/`resize()`，不用条件渲染 | 宽度无法动画 |
| P3 | 过渡加在 group 上（`[&>[data-panel]]`），且只在开合进行中 | 加在子元素上无效；常驻则拖拽被逐帧插值 |
| P4 | 动画期间内容锁定在最终宽度（`cqw`）并裁剪 | 消息列表回流触发 scroll-to-bottom；composer 重排改变响应式标签 |
| P5 | 只从 `onLayoutChanged` 镜像 `0%`，不从 `onResize` | "拖到边缘再拖回来"的连续手势被中断 |
| P6 | `BrowserViewPanel` 每个手势只发一个 `click` | 远端 Playwright 点击执行两次 |

### 协议与安全

| # | 不变量 | 破坏后症状 |
| --- | --- | --- |
| A1 | human-input 回复侧保持 v1（`response_kind: "text"` + JSON 块） | 旧 v1 前端不兼容 |
| A2 | 校验器拒绝未知版本/mode（及 `Object.prototype` 冲突字段名） | 渲染出破损卡片而非降级为纯文本 |
| A3 | form checkbox 不加 HTML `required` 属性 | 原生约束校验截断自定义提交路径 |
| A4 | composer 绕过只关闭**最近一个**未回答请求 | 静默吞掉更早的决策 |
| A5 | 页面级 human-input 提交：`hide_from_ui` + 响应放**第四个**参数 `additionalKwargs`，第三个仍是 run context | 参数错位 |
| A6 | 密码 / token 绝不进前端存储；只允许持久化邮箱 | 安全事故 |
| A7 | 编辑重跑**只允许最新 turn**（`getLatestEditableTurn` 的双条件） | 历史一致性破坏 |
| A8 | 前端不请求 subgraph 流 | 委派 subagent 的 `values` 快照替换整个 thread 视图（#4399） |
| A9 | 聊天路径必须经 `pathOfThread()` 构造 | agent 名 / thread id 未 percent-encode |

## 10.4 回归护栏映射

重构各区域时，对应的现成测试：

| 区域 | 单元测试 | E2E |
| --- | --- | --- |
| 流编排 / 历史合并 | `tests/unit/core/threads/**` | `chat.spec.ts`、`thread-history.spec.ts`、`chat-thread-init-ordering.spec.ts` |
| stream mode / gap | `tests/unit/core/api/**` | — |
| 消息分组 | `tests/unit/core/messages/**` | `user-message-plain-text.spec.ts`、`thread-history-mermaid.spec.ts` |
| 子任务 | `tests/unit/core/tasks/**` | `subtask-card.spec.ts` |
| 产物 | `tests/unit/core/artifacts/**` | `artifact-{preview,panel-resize,batched-stream,stream-state}.spec.ts` |
| 面板布局 | — | `artifact-panel-resize.spec.ts`、`sidecar-chat.spec.ts` |
| 设置 / 存储 | `tests/unit/core/settings/**` | `settings-notification.spec.ts` |
| 鉴权 | `tests/unit/core/auth/**` | `tests/e2e-auth/`、`tests/e2e-real-backend/auth-disabled-contract.spec.ts` |
| 定时任务 | `tests/unit/core/scheduled-tasks/**` | `scheduled-tasks.spec.ts` |
| i18n | `tests/unit/core/i18n/**` | `docs-localized-links.spec.ts` |

**空白区**：`input-box.tsx`（2,859 行）没有专门的组件级单测，
只有 `tests/unit/components/workspace/` 下的间接覆盖和 E2E 的黑盒验证。
拆它之前建议先补测试。

## 10.5 待核实项

以下是探查中发现但**未下结论**的点，重构前值得确认：

1. **`nuxt-og-image`、`h3`、`defu` 在 `src/` / `tests/` / `scripts/` 中没有直接
   import**。它们出现在生产依赖里，可能是某个包的 peer 要求（`nuxt-og-image`
   依赖 `h3` 和 `defu`），也可能是遗留。移除前需确认构建产物无变化。
2. **`eslint-config-next@^15.2.3` 落后于 `next@^16.2.11`** 一个主版本。
3. **`app/api/memory/**` 是唯一的自建 BFF route handler**，其余领域都直连 REST。
   统一之前需确认这层没承担额外职责。
4. **`core/agents/feature-cache.ts` 与 `core/features/`** 两处都在做功能可用性缓存，
   是否可合并待确认。
5. **`skills/type.ts`** 用单数，与其余模块的 `types.ts` 不一致（纯命名问题）。

## 10.6 使用本文档的方式

制定重构计划时：
1. 从 [§10.1 热点排序](#101-热点排序体量--修改频率) 挑目标。
2. 到 [§10.3 红线清单](#103-必须保留的不变量红线清单) 找该区域涉及的不变量，
   逐条确认新设计不破坏。
3. 到 [§10.4 回归护栏](#104-回归护栏映射) 确认有测试兜底；没有的先补。
4. 改完同步更新 [frontend/AGENTS.md](../frontend/AGENTS.md) 和本目录。
