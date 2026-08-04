# 05 · 必须保留的行为不变式

**这是本方案里最重要的一份文档。**

`frontend/AGENTS.md` 记录的大量约束都是线上问题修复后沉淀下来的（#4465、#4555、#4576 等）。它们不会跟着组件自动迁移，是"看起来做完了但行为不对"的主要来源。

移植每个模块前先读对应小节；实现完成后逐条对照。原始表述以 `frontend/AGENTS.md` 为准，本文是移植视角的提取。

全表 **A–N 共 14 组**。A–K 来自 `frontend/AGENTS.md`；**L 组**是参照 `gamma-project` 实现自研 SSE 时必须补齐的规范差距；**M 组**是 React → Vue 的语义差异，与业务无关但同样会造成"看起来搬对了、行为不对"；**N 组**是已知的覆盖空白，需要在动到对应模块前先读源码补上。

---

## A. 流式与重连

> ⚠️ 本组原本由 LangGraph SDK 的 `useStream` 保证。改为**自研 SSE** 后，这些语义的实现方变成了自己——约束一条不减，另见 L 组的补强项。

| # | 约束 | 为什么 |
| --- | --- | --- |
| A1 | 同宏任务内的流事件要合并成一次通知，**不要用固定延时防抖** | 这是 SDK `throttle: true`（boolean 档）的语义。数字档是尾部防抖，chunk 持续到达时会一直推迟，饿死 UI 更新 |
| A2 | stream 请求模式白名单：`values` `messages-tuple` `updates` `debug` `tasks` `checkpoints` `custom` | 含不支持模式时必须**在 HTTP 之前抛错**，不能部分转发、也不能静默降级为 `values`。`messages` 与 `events` 不被支持。**`core/agent-deerflow/stream-mode.ts` 原样保留**（75 行纯 TS，落在适配层而非内核——stream mode 是 LangGraph 概念），校验时机从「SDK 调用前」改为「适配层构造请求时」——把契约固定在一个有测试覆盖的模块里，比依赖每个调用点自觉可靠 |
| A3 | `streamResumable` **不得出现在请求里** | Gateway 不接受该选项。它原本是 SDK 侧的重连记账字段、由 `sanitizeRunStreamOptions` 剥离；自研 transport 后不再产生该字段，但剥离逻辑保留作为防御。重放一律走 SSE `Last-Event-ID` 游标 |
| A4 | SSE `gap` 帧要包住**初始流和 join 流两者** | 上游 SDK 会忽略未知事件名；包装器必须保持惰性 async iterable（SDK 用 `for await` 消费） |
| A5 | gap 恢复最多 5 次 rejoin（全 gap 路径共 6 次流调用） | — |
| A6 | gap **不得当作正常流结束**，也**不得取消仍在运行的后端 run** | 会丢失正在进行的任务 |
| A7 | gap 发生时要清空乐观 / 瞬态 / subtask 状态、失效持久化历史缓存、显示本地化恢复警告 | — |
| A8 | Stop 后立即失效 4 类缓存（当前 thread、thread history、token usage、侧栏/搜索），并**再安排一次延迟 refetch** | SDK 的 stop 可能在后端标题定稿提交前就以 abort + fire-and-forget cancel 结束 |

> 参考实现：`frontend/src/core/api/api-client.ts`、`core/api/stream-mode.ts`、`core/threads/hooks.ts`

---

## B. 消息渲染与分组

| # | 约束 | 为什么 |
| --- | --- | --- |
| B1 | 带 `tool_calls` 的 AI 消息里若有可见文本，必须作为 processing step 渲染 | 保留 provider 的错误解释、"换个思路试试"这类文本 |
| B2 | 当前回合仍在 loading 时，最新可见 human 之后的纯内容 AI 消息**留在 processing 分组** | provider 可能稍后往同一条消息追加 tool-call chunk；过早判定为终态气泡会让文本跳进步骤面板 |
| B3 | 前面已有 tool call 之后出现的纯内容 AI 消息，流式期间仍显示在最后一个 tool-call 步骤之后 | 同上，它自己也可能再获得 tool call |
| B4 | **reasoning 必须在答案文本上方**，两个渲染组件都要（#4576） | 同一条消息在生命周期内由 `MessageGroup` 和 `MessageListItem` 先后渲染；两边不一致会导致回合settle瞬间两者互换位置 |
| B5 | reasoning 之**前**发出的 assistant 文本保持原位，只有 reasoning 产出的答案移到其下方 | — |
| B6 | run duration 折叠为一份，锚定在该 run 最后一个可见消息组之后 | 兼容字段 `additional_kwargs.turn_duration` 在历史 AI 消息上重复出现 |
| B7 | run duration 是**整个 run 的墙钟时间**，不是单条消息的思考时间；与 reasoning 披露分开渲染 | — |
| B8 | workspace-change 卡片只挂在该 run 的**最后一个 assistant 气泡**（#4555） | 卡片由 `(threadId, runId)` 解析，否则该 run 的每条 AI 消息都会渲染一份 |
| B9 | 两个 anchor helper 的候选集合**故意不同**，不要统一 | run duration 由 `MessageList` 在每个组周围发出，接受任意类型；workspace-change 由 `MessageListItem` 发出，只接受 `assistant` |
| B10 | 每个 processing 组的 tool-result / browser-preview 查找表**每组只构建一次** | 保留首个非空结果与首个带截图的 browser view，避免为每个 tool call 重扫全组 |
| B11 | citation 链接的 `citation:` 标签要从**完整 children 树**推导 | 流式期间 children 可能是元素或数组，不是纯字符串 |

> 参考实现：`core/messages/utils.ts`、`core/messages/run-duration.ts`、`core/messages/workspace-change-anchor.ts`、`components/workspace/messages/message-group.tsx`

---

## C. 历史加载与顺序

| # | 约束 |
| --- | --- |
| C1 | 历史分页保留后端的 **thread 全局 `seq`**；渲染时按规范身份叠加 checkpoint / live 副本 |
| C2 | 上下文压缩救援要 diff **每一个保留的可见身份**，不能在第一个锚点处切片 |
| C3 | 维护 run 作用域的已提交可见消息账本，使替换更新与滚动 checkpoint 窗口不会抹掉已显示的步骤 |
| C4 | 对于规范位置仍落在未加载游标页之后的 checkpoint / 瞬态前缀，**抑制**而非在最近锚点前折叠该未知间隙 |
| C5 | 添加乐观消息时**不要按时间戳重排序** |
| C6 | 历史失效时**保留已加载的页**，不要丢弃已确立的顺序位置 |
| C7 | 动态上下文会把提交的用户消息从 `X` 重新键为 `X__user`；UI 身份匹配**只对 human message** 归一化该保留后缀 |
| C8 | 本地提交的回合要记录 pre-submit 身份基线：若 `messages-tuple` 先于 `values` 发布新的 AI/tool 步骤，只把非基线的可见步骤移到新 human 之后，不动历史、隐藏控制消息和重连的 run |
| C9 | 该本地顺序锚点要**保持到 finish / stop / stream error**；下次本地提交时替换，切换 thread 或 replay-gap 恢复时清除 |

> 这一组是全文档最容易在重写中丢失的部分。建议原样复制 `core/threads/` 与 `core/messages/` 的纯 TS 实现及其单测，不要重新设计。

---

## D. Artifacts

| # | 约束 | 为什么 |
| --- | --- | --- |
| D1 | 文件工具的 artifact 自动打开必须在 **effect 内**执行并带 timer 清理 | 渲染 `write_file` / `str_replace` / 暂存写入更新时**绝不能在渲染期间起定时器** |
| D2 | `write_file` / `str_replace` 可在 loading 时打开流式草稿 URL；`finalize_artifact_write` **只在工具返回 `OK` 后**打开真实 artifact 路径 | — |
| D3 | HTML 预览要过与 `core/artifacts/preview.ts` 相同的轻量文档完整性检查 | 已完成的 `.html`/`.htm` 草稿若 `html`/`body` 标签缺失或错序、或 `head`/`style`/`script` 不配对，**留在代码视图**而不是塞进 iframe。文档仍在组装时允许前缀块 |
| D4 | `ThreadState.artifacts` 是**权威列表**；provider 只持久化 thread 作用域的面板 UI 状态（open、选中路径、刷新引导缓存） | 历史加载完成前，**初始的空流值不得覆盖已恢复的状态** |
| D5 | run 结束时刷新一次正式 artifact 内容；瞬态 `write-file:` 预览保持消息驱动 | — |
| D6 | 显式编辑**只对 `/mnt/user-data/outputs` 下已打开的正式 UTF-8 文本 artifact** 开放 | 草稿留在 provider 内存直到保存，切换右侧面板不丢；受已加载的 SHA-256 修订保护，不被远程刷新覆盖 |
| D7 | run 进行中禁止保存；修订变化时保留草稿并提示冲突，**不得覆盖 agent 输出** | — |
| D8 | 常规 artifact 文本加载最多通过 HTTP byte range 请求**前 1 MiB** | 截断预览必须保持轻量并提供显式的"加载完整文件"操作；在用户请求并拿到完整内容之前**不要挂载 CodeMirror** |

---

## E. Composer / 输入框

| # | 约束 |
| --- | --- |
| E1 | Composer 草稿是 **tab 作用域**：只把文本 + 选中的 slash 技能名存 `sessionStorage`，按 user / agent / 逻辑会话作用域分键 |
| E2 | 新会话页用固定作用域 `"new"`（其运行时 `threadId` 每次刷新都是新 UUID）；已建立的会话用真实 thread ID |
| E3 | 附件、sidecar 引用、语音状态、polish 撤销状态**不持久化** |
| E4 | `InputBox` 要等技能列表就绪后再恢复技能 chip；技能缺失或被禁用时**降级为可编辑的斜杠文本** |
| E5 | 只有在发送通过 in-flight 守卫之后，才通过 `SendMessageOptions.onSent` 清除草稿 |
| E6 | `/goal` 与 `/compact` 是**内置命令，不是技能激活**；在正常聊天提交前拦截 |
| E7 | `/goal <condition>` 除设置目标外还要把条件文本作为下一个用户任务提交（立即开跑）；查询状态与 clear 不启动 run |
| E8 | goal / compact 请求绑定当前 `threadId` 并带 `AbortController`：切换 thread 或卸载 composer 要中止在途请求，防止过期响应污染新 thread |
| E9 | 选中技能 chip 后，在旁边的可编辑文本里输入 `/` 要能**重新打开**技能列表；选中条目是**替换 chip 而非追加**（wire 格式只允许一个前导 `/skill`） |
| E10 | 已选中 chip 时**不提供内置命令**（`/goal` 会被当作聊天文本提交） |
| E11 | 斜杠**只在输入起始位置**打开列表（`getLeadingSlashSkillQuery`）—— 由 `tests/e2e/chat.spec.ts` 固定 |

---

## F. Human input 协议

| # | 约束 |
| --- | --- |
| F1 | **请求侧有版本，回复侧固定 v1。** v1 = `free_text` / `choice_with_other`；v2 增加 `form` |
| F2 | 表单卡片提交 `response_kind: "text"`，值为"人类可读摘要 + 一个以稳定字段名为键的 JSON 块"（`buildHumanInputFormSubmissionValue`） |
| F3 | 校验器要拒绝未知版本 / 模式，以及与 `Object.prototype` 成员冲突的字段名 → 降级为纯文本 ToolMessage |
| F4 | 表单值只走 own-property 读取（`readHumanInputFormValue`） |
| F5 | select 字段从空字符串占位状态起就是受控的 |
| F6 | checkbox 用原生 `<input type="checkbox">`，显式初始化为 `false`（`buildInitialHumanInputFormValues`）；**不加 HTML `required` 属性**（原生约束校验会拦截自定义提交路径） |
| F7 | 表单控件需 label/`for`、`aria-required` + 视觉隐藏的本地化"必填"标记、`aria-invalid` 与错误关联；只要还有字段无效，错误节点保持挂载 |
| F8 | **Composer 绕过闭合**：可见的普通 human 消息只回答"在它之前打开的最新一个未回答请求"——只关最新一个。更早的请求重新成为活动卡片 |
| F9 | 已回答状态从**原始 `thread.messages`** 推导（回复是隐藏的）；pending 卡片在隐藏回复出现、派发被丢弃、或新的 `thread.error` 报告异步流失败时清除 |
| F10 | 页面级卡片提交回调发普通 human 消息，把 `hide_from_ui: true` 与响应载荷放在 `sendMessage` 第 4 个参数的 `additionalKwargs`；第 3 个参数仍是 run 上下文（如 `{ agent_name }`） |
| F11 | 有未答请求时 composer 入口**保持可用**；普通可见消息会绕过卡片并启动下一个 run |

> 参考实现：`core/messages/human-input.ts`、`components/workspace/messages/human-input-card.tsx`

---

## G. Subtask（子智能体）

| # | 约束 |
| --- | --- |
| G1 | `Subtask.steps[]` 从 `task_running` 事件**累加**（`mergeSteps` 追加，不是覆盖） |
| G2 | 历史 run 展开时用 `fetchSubtaskSteps` 回填：按单个 task 分页拉 `GET /runs/{runId}/events?event_types=subagent.step&task_id=…&after_seq=…` 直到短页，避免 run 级 limit 截断时间线 |
| G3 | `computeNextSubtask` 保留**最大**累计用量，使重放或迟到的 SSE 帧不会重复计数或让卡片回退 |
| G4 | `useUpdateSubtask` 针对镜像最新 state 的 `tasksRef` 应用更新（**不是闭包快照**），使迟到的回填不会覆盖 SSE 步骤或兄弟 subtask |
| G5 | `stepsForDisplay` 保留 tool 步骤与有文本的 AI 步骤；完成后丢弃末尾的 final-answer AI 步骤（它已作为 `result` 显示） |
| G6 | 重新加载后从终态 ToolMessage 元数据（`subagent_model_name` / `subagent_token_usage`）恢复，**不需要**逐卡片拉事件 |

---

## H. 面板与布局

> ⚠️ 本组是**重写而非替换**：`react-resizable-panels` → `splitpanes`（shadcn-vue Resizable 的底层），两者 API 完全不同。下列 8 条全部要在 splitpanes 上重新实现一遍。**这是整套 UI 里唯一没有同构关系的组件**——其余 30 个都能从 shadcn-vue 拿到对应实现并逐字复制 cva 样式串。
>
> ⚠️ **最关键的 API 差异：`react-resizable-panels` 是命令式的，`splitpanes` 是声明式的。**
> React 版实测用了 [`chat-box.tsx:260`](../frontend/src/components/workspace/chats/chat-box.tsx) 的 `sidePanelRef.current?.collapse()` 和 `:431` 的 `onLayoutChanged`；splitpanes **没有对应的命令式句柄**，只有 `:size` 绑定 + `@resize`（拖拽中）/ `@resized`（释放后）两个事件。
>
> 所以下面 H2 / H6 的**字面表述在 splitpanes 上不成立**，已按 splitpanes 的词汇重写。可行性由 [M0/M1 的 spike](06-migration-plan.md#m0m1-期间插入splitpanes-spike) 先验证，spike 的结论回填到本节。

| # | 约束 | 为什么 |
| --- | --- | --- |
| H1 | **三个右侧面板（artifacts / sidecar / browser）共用同一个面板组**，不要按面板种类分叉出非可调整尺寸的分支 | 分叉正是 artifacts 分隔条静默失去拖拽手柄的原因（#4465） |
| H2 | 开关靠**改绑定的 `:size`（→ 0 / → 上次正值）**，**不是 `v-if` 条件渲染** | React 版用 `collapse()` / `resize()` 命令式句柄；splitpanes 没有，等价做法是驱动响应式 size。目的相同：只有面板元素一直在 DOM 里，宽度才能动画过渡 |
| H3 | 尺寸过渡作用在**面板库自己的面板元素**上（React 版是 `[&>[data-panel]]:transition-[flex-grow]`；splitpanes 对应 `.splitpanes__pane`） | 被 flex 布局的是库的元素，不是 `class` 落到的子节点 |
| H4 | 过渡**只在开关进行中**启用，拖拽时不启用 | 否则拖拽会被逐帧插值 |
| H5 | 动画期间面板内容按最终宽度固定并裁剪 | 重排的消息列表会重跑滚动到底（由 `tests/e2e/sidecar-chat.spec.ts` 的 no-animated-scroll 测试固定），重新换行的 composer 会改变显示哪些响应式标签 |
| H6 | 拖拽中（`@resize`）记录最后的正值尺寸，但拥有状态的 `sidecar` / `browserView` / `artifactsOpen` **只能在 `@resized`（pointer 释放后）镜像 `0%`** | 在第一个 `0%` 帧就关闭，会破坏"拖到边缘再拖回来才松手"的连续手势。**这一条恰好能干净映射到 splitpanes 的两个事件**——`@resize` / `@resized` 的语义分界正是 React 版靠 `onResize` vs `onLayoutChanged` 手工维持的那条线 |
| H7 | 上下文窗口控件**故意常驻**：`context_usage` 不可用时渲染仪表占位而不是卸载 | — |
| H8 | `useThreadTokenUsage` 只在响应的 `thread_id` 仍匹配当前路由时保留占位数据 | 同 thread 刷新不闪烁，跨 thread 导航永不显示上一个会话的用量 |

---

## I. Browser view

| # | 约束 |
| --- | --- |
| I1 | 每次物理指针点击只转发**一个** `click` 输入；不要为同一手势同时发 `down`/`up`（远端 Playwright 点击会执行两次） |
| I2 | 请求二进制 JPEG 帧（`frame_format=binary`）；状态、URL、标签页、导航拒绝消息保持 JSON |
| I3 | 帧缓冲只保留**最新的一个**待处理帧，每个动画帧最多发布一次，并负责 object-URL 回收 |
| I4 | 保留 Gateway 的旧版 JSON/base64 帧路径以兼容老客户端 |
| I5 | Workspace Browser 触发器与右侧面板由 `/api/features -> browser_control.enabled` 控制；默认/失败的特性发现要**隐藏**该控件 |

---

## J. 认证与存储

| # | 约束 |
| --- | --- |
| J1 | 登录页的"保持登录"只向 Gateway 提交 `remember_me`，本地**只能持久化邮箱地址** |
| J2 | **密码与 token 绝不能进前端存储**；`HttpOnly access_token` 与可读的 `csrf_token` cookie 归 Gateway 所有 |
| J3 | auth-disabled 只用于 mock 合同；真实认证必须经 Nuxt preview 同源代理验证 register/login、Set-Cookie、CSRF 写请求、refresh 与 logout |
| J4 | `localhost` cookie 不按端口隔离：React 与 Vue 会共享登录/退出状态，不能用两个端口模拟两个不同用户 |
| J5 | 生产 OIDC 必须保证“从哪个前端发起就回哪个合法前端”；相对回跳方案要求 `frontend_base_url` 与 provider `redirect_uri` 同时留空、IdP 注册两个 callback URI、可信代理正确传 Host/Proto。若必须用任一单值绝对 URL，就要以后端签名 state + allowlist 扩展解决，未解决前属于发布阻断 |
| J6 | OIDC state cookie 不按端口隔离，cookie 名又只按 provider 区分；同一 hostname 的 React/Vue 两个端口不能并发发起同一 provider 登录。生产认证隔离使用独立 hostname，G0-7 必须覆盖并发/覆盖风险 |

---

## K. 路由与其他

| # | 约束 |
| --- | --- |
| K1 | Web UI 会话路径必须通过 `core/threads/utils.ts::pathOfThread()` 构造 —— 它会对自定义 agent 名和 thread ID 做百分号编码后再插入路由段 |
| K2 | 编辑并重跑**只限最新回合**：仅当记录空闲且最近的可见回合以终态 assistant 消息结尾时才暴露（`getLatestEditableTurn()`） |
| K3 | 编辑并重跑走 `POST /api/threads/{id}/runs/edit-regenerate/prepare`，用与 regenerate 相同的流路径提交返回的替换消息/checkpoint/元数据，乐观隐藏被取代的消息 id，持久化替换到达后清除乐观态 |
| K4 | 重命名走同一条序列化状态写入路由；活动 run 返回 409 时对话框保持打开并显示服务端错误 |
| K5 | 设置 > 工具的 MCP 开关调用定向的 `PATCH /api/mcp/config`；在该 mutation 的成功 refetch 完成前禁用开关；通过 toast 显示后端错误 `detail`；**成功后才**失效 `["mcpConfig"]` |
| K6 | 定时后台运行是**非交互**的：`context.non_interactive=true` 时 lead-agent 工具集排除 `ask_clarification`。该键只对内部认证的调用方生效，客户端提交的会被丢弃（后端行为，前端不要伪造） |

---

## L. 自研 SSE transport 的补强项

本组不是从 `frontend/AGENTS.md` 提取的，而是**参照 `gamma-project` 实现时必须补齐的差距**。gamma 的实现质量很高（见 [04 §4](04-architecture-decisions.md#4-agent-通信层自研-sse参照-gamma-project) 列出的 8 条可继承判断），但它只面向一个已知后端；DeerFlow 要经 nginx 且依赖 SSE `Last-Event-ID` 做重放。

| # | 补强项 | 为什么 |
| --- | --- | --- |
| L1 | **CRLF 归一化** | gamma 的 `sse-buffer.ts` 只找 `\n\n`，注释也承认"本层不负责 CRLF 归一化"。SSE 规范允许 `\r\n\r\n`。经 nginx 或其他代理时若出现 CRLF，buffer 会永远攒不出完整事件 |
| L2 | **保留 `id:` 字段** | gamma 的 `parseSseEvent` 只解析 `event:` 和 `data:`，它的游标是业务字段 `message_id`。**DeerFlow 的重放依赖 SSE `Last-Event-ID`**——解析器必须保留 `id:`，transport 重连时必须带 `Last-Event-ID` 请求头 |
| L3 | **`data:` 只剥一个前导空格** | gamma 用了 `.trim()`。SSE 规范只要求去掉字段名后的**一个**空格。JSON 载荷无所谓，但流式 token 文本里的前导空格有意义，`trim()` 会丢字符 |
| L4 | **重试加指数退避** | gamma 是 `maxRetries = 3` 立即重试。网络抖动时三次快速重试大概率连续失败 |
| L5 | **重试计数需要总量上限** | gamma 在每段成功后 `retries = 0`，持续抖动的连接理论上可无限重连。DeerFlow 的长任务要加总次数上限 |
| L6 | **buffer 需要上限保护** | 后端一直不发分隔空行时 buffer 会无限增长。长报告场景值得加保护 |
| L7 | **看门狗阈值重定** | gamma 是固定 15 秒。DeerFlow 的 agent 会跑很长的工具调用（sandbox 执行、浏览器操作、子 agent），15 秒静默完全正常。需重定阈值或改成按事件类型动态判断 |
| L8 | **不要模块级可变状态** | gamma 的 `merge-message.ts` 用了模块级 `imageBuffer` / `imageBufferMessageId`。DeerFlow 有 sidecar 子会话与多 thread 并存，必须改为放进 message 自身或 per-stream context |
| **L9** | **心跳注释帧要识别、且不能当事件** | SSE 规范里以 `:` 开头的行是注释，常被代理与后端用作 keep-alive（`: ping`）。gamma 的解析器没处理这一类，会把它当成一个 `data` 为空的事件或直接丢掉。**两个后果**：一是可能产生空事件污染归约；二是**看门狗（L7）会把有心跳的连接误判成静默**。正确做法是解析成独立的 `heartbeat` 帧——不进 reducer，但**要重置看门狗计时** |
| **L10** | **create POST 最多一次** | 初始请求创建 run；响应头前断网且后端没有 idempotency key 时必须 fail closed，不能自动重放 POST |
| **L11** | **续传必须切到既有 run 的 GET stream** | 拿到 run handle 后，网络中断调用 `resume()` 并带 `Last-Event-ID`；不得复用 create URL/method/body |
| **L12** | **Content-Location 与 Location 分开验证** | Gateway create 明确发 `Content-Location`；当前 SDK 的 metadata 与 reconnect 读取不同 header。Nuxt proxy 前后都要记录，不能假定二者等价 |
| **L13** | **abort 不等于 cancel** | 本地停止读取只能释放连接；用户点 stop 时必须显式调用 Gateway cancel/cancel-then-drain，并观察最终 session 状态 |
| **L14** | **最终 checkpoint 不是流式 oracle** | 516 条消息只能验证最终 adapter/state；raw SSE trace 才验证 chunk、id、namespace、heartbeat、gap 与重连时序 |
| **L15** | **完整 state 与消息同一次归约** | `values` 会带 messages、artifacts、todos、goal 等；不能只维护 message map，再让组件各自补业务状态 |
| **L16** | **cancel 结果不能压成 `void`** | UI stop 先进入 `stopping`；200 SSE 要 drain 尾帧，202 accepted 要轮询 durable run，204/已确认终态才能显示 stopped。创建阶段无 handle 的断开是“不确定”，不是“已取消” |

同时，A 组（流式与重连）的全部约束仍然适用——自研 transport 不代表可以放弃那些语义，只是实现方从 SDK 变成了自己。

> gamma 的 transport 用例只能作为分帧起点。L1–L16 必须分别落到 raw trace、fake upstream、session 状态机和 real Gateway 测试，不能只移植四个旧用例。

### ⚠️ 不要从 gamma 那份开始写 —— git 历史里有更好的起点

上一轮实现的 SSE transport **已经满足 L1 / L2 / L3 / L9**，比 gamma 那份更接近规范：

```bash
git show 44309ae7:frontend-vue/app/core/api/stream/transport/sse-buffer.ts
git show 44309ae7:frontend-vue/app/core/api/stream/transport/parse-sse-event.ts
```

| 条目 | gamma | 上一轮实现 |
| --- | --- | --- |
| L1 CRLF 归一化 | ❌ 只找 `\n\n` | ✅ `/\r?\n\r?\n/` 分帧、`/\r?\n/` 拆行 |
| L2 保留 `id:` | ❌ | ✅ |
| L3 只剥一个前导空格 | ❌ 用了 `.trim()` | ✅ `startsWith(" ") ? slice(1) : raw` |
| L9 心跳注释帧 | ❌ | ✅ 归为 `{ kind: "heartbeat" }` |
| 无冒号的字段行 | ❌ | ✅ 按规范当空值字段 |
| 流末残留数据 | ❌ | ✅ `flushSseRemainder` |
| **L4 / L5 / L6**（退避、重试上限、buffer 上限） | ❌ | ❌ **仍要自己补** |

**只把这两个文件当分帧起点**。run session 必须按 L10–L16 另写协议状态机。

⚠️ 它的 `stream-error.ts` 不照搬。以 [08 的错误与 watchdog](08-agent-core-contract.md#错误与-watchdog)为准。

---

## M. Vue 移植专有陷阱

本组不是从 `frontend/AGENTS.md` 提取的，而是 React → Vue 语义差异导致的、**代码看起来搬对了但行为不对**的地方。

| # | 约束 | 为什么 |
| --- | --- | --- |
| M1 | `provide()` 必须传 **ref / reactive / computed**，不能传普通对象或裸值 | Vue 的 `inject` 在 setup 期间**一次性解析**，拿到的是当时那个引用；React Context 每次渲染重读。照搬 React 里 `provide(ctx, { open, setOpen })` 的写法，`open` 变化不会传播到消费方。[04 §3](04-architecture-decisions.md) 的 7 个业务 Context 全部适用 |
| M2 | `inject()` 只能在 setup 同步阶段调用 | `await` 之后或回调里调用会拿不到值。React 的 `useContext` 无此限制 |
| M3 | 自定义 Markdown 组件覆盖接收的是 **`class`** 而不是 `className` | `hast-util-to-jsx-runtime` 对 Vue 必须设 `elementAttributeNameCase: 'html'`（见 [02-stack.md](02-stack.md#markdown-渲染层)） |
| M4 | 逐词动画的 key 必须稳定 | 与 B 组无关，是 Vue 的 diff 语义：key 变化会重新挂载节点并重播动画。铁律仍是**不要用 per-word rehype 插件** |
| M5 | `watch` 默认是**惰性**的，React 的 `useEffect` 默认首次就跑 | 搬 effect 时若原逻辑依赖挂载即执行，要显式 `{ immediate: true }`。A7、D1、D4 这类"初始状态不得被覆盖"的约束最容易在这里翻车 |
| M6 | `onErrorCaptured` 返回 `false` 才阻止错误继续冒泡 | 与 React ErrorBoundary 的语义不同，Markdown 错误边界要显式返回 |

---

## N. 上传 / 通知 / 语音 / i18n —— 覆盖空白点

前面 A–M 组是从 `frontend/AGENTS.md` 与 gamma 差距里提取的，覆盖不到下面这几个模块——它们在 AGENTS.md 里几乎没有条目，但代码是实实在在存在的。**本组不是已确立的约束清单，而是「移植前必须先去读源码补齐约束」的登记**，动到对应模块时先把这一格填上。

| # | 模块 | 已知的（实测） | 移植前要确认什么 |
| --- | --- | --- | --- |
| N1 | `core/uploads/`（5 文件 / 417 行） | `api.ts` · `file-validation.ts` · `hooks.ts` · `prompt-input-files.ts`；`AGENTS.md` 明确 **pre-submit 上传状态归 `core/threads/hooks.ts` 所有**，不是 `InputBox`；E2E 里有 `**/api/threads/*/uploads/limits` | 限额从哪里来、超限怎么降级、`file-validation.ts` 的规则是否与后端一致；上传中切换 thread 会怎样（对照 E3：附件**不持久化**） |
| N2 | `core/notification/hooks.ts` | 单文件 | 通知权限申请时机、页面不可见时的行为、是否与 run 生命周期绑定 |
| N3 | `core/voice-input/speech-recognition.ts` | 单文件，浏览器 SpeechRecognition API | 权限与不支持时的降级路径；**E3 已定：语音状态不持久化** |
| N4 | `core/i18n/`（9 文件） | locale 存 cookie，名为 **`locale`**，1 年有效期（`cookies.ts:6,34`） | 切换 locale 后是否需要重载、cookie 写入时机、`ssr:false` 下首帧闪烁（Next 版靠服务端派生 locale 避免，Vue 版没有这一层）。⚠️ 这是 [03](03-project-shape.md) 说「i18n 双词典分裂随之消失」时**没提到的代价**——省掉了复杂度，但换来了一个首帧问题 |

---

## 使用建议

1. 移植 `app/core/` 时**连同单测一起搬**。C 组（历史与顺序）和 F 组（human input 协议）的语义几乎全部由单测固定，测试全绿 = 语义已保真。
2. 组件层的约束（B、D、H 组）没有单测覆盖的部分，靠 Playwright E2E 兜底。
3. A 组与 L 组是自研 SSE 的正确性基线，必须有对应单测，**不能只靠 E2E**——流式的时序问题在 E2E 里既难复现也难定位。
4. M 组（Vue 专有陷阱）在**每个**模块都适用，不对应某一个业务域——M4（数据流 + 通用 UI）与 M5/M6（L3 组件）尤其要留意 M1 / M5。
5. 每完成一个模块，回到本文档对应小节逐条勾选。
