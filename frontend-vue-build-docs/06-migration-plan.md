# 06 · 执行计划

## 终态与顺序

**终态不变：与 `frontend/` 全域 1:1（功能、交互、视觉）。**

**变的是顺序：按「通用度」排，不只按依赖排。**

`frontend-vue` 的产品价值是[通用 agent 前端模板](08-agent-core-contract.md)——后续其他项目做 AI agent 时能最大程度复用。这个目标不通过缩小范围实现，而是通过**先做通用层、后做 DeerFlow 专有层**实现：

- 每个里程碑结束时都有一个「停在这里也有价值」的产出
- L2 边界在 M4b / M5 各抽一次，**不是全做完再抽**——那样一定会被磨掉（[08](08-agent-core-contract.md) 自己警告过）
- L3 建在 L2 之上的过程，反过来验证 L2 的扩展点设计对不对

## 两条底盘

**一、`core/` 是 1:1 的护城河。** 实测（`frontend/src/core/`，149 个文件 / 19,965 行）：

| | 文件数 | 行数 |
| --- | --- | --- |
| 纯 TS，**零改动可复制** | **99** | 9,856 |
| 纯 TS，**需改 import**（LangChain 类型 / `@/env` / 组件类型） | 24 | 4,744 |
| React 耦合 | 26 | 5,365 |

那 123 个纯 TS 里装着最难复现的东西：消息分组、run-duration 折叠、workspace-change 锚点、human-input v1/v2 协议校验、artifact HTML 结构预检、subtask 步骤模型、composer draft 分键。复制过去（import 路径都不用改，见 [03-project-shape.md](03-project-shape.md)），行为一致就从"人肉比对"变成结构性保证。

**二、组件按通用度分三档**（实测 `frontend/src/components/`）：

| 档 | 范围 | 文件 / 行 |
| --- | --- | --- |
| **L2 通用** | `elements/` 29 · `workspace/messages/` 13 · `chats/` 4 · `citations/` 3 · 根散件约 26 | ~75 / ~16,400 |
| **L3 DeerFlow** | `settings/` 15 · `artifacts/` 6 · `sidecar/` 5 · `browser-view/` 8 · `agents/` 5 · `channels/` 3 · `changes/` 3 · 根散件约 6 | ~51 / ~8,500 |
| 自写件 | `resizable` + 4 个特效 | 5 |

### ⚠️ 这些数字会漂，每个里程碑开头重算一次

统计时间是 2026-08-03。**复核时（次日）`workspace/` 已经从 103 文件 / 21,478 行变成 104 / 21,533** —— 一天就漂了。这不是统计错误，是"`frontend/` 在重写期间持续演进"这条风险的实证（近 3 个月 151 次提交）。

所以不要把上面的数字当常量。每个里程碑开始前跑一次：

```bash
cd frontend && for d in src/core src/components/ui src/components/ai-elements src/components/workspace; do printf "%-32s %s files  %s lines\n" "$d" "$(find $d -type f | wc -l)" "$(find $d -type f -exec cat {} + | wc -l)"; done
```

同时 diff 一次 `frontend/src/core/`，把增量补进 `app/core/`——把这一步写进里程碑清单，别靠记性。

## 里程碑总览

| # | 内容 | 停在这里的价值 |
| --- | --- | --- |
| **M0** | 骨架 | 能跑的空壳 |
| **M1** | `core/` 纯 TS 落地 | 单测全绿 = 业务语义保真 |
| **M2** | **L1 `packages/agent-core/`** ★ | **可整包搬走的协议无关内核，已被真实语料验证** |
| **M3** | Markdown 渲染层 | 与 React 版 DOM 结构一致 |
| **M4a** | 数据流：`threads/hooks.ts` 与 7 个 Context | 流式状态在 Vue 下跑通，带 gate |
| **M4b** | **通用 agent UI（L2 第一批）** ★ | **一个能跑的通用 agent 聊天应用——模板到此可用** |
| **M5** | L3 第一批：artifacts + sidecar | L2 扩展点被真实 L3 功能验证过 |
| **M6** | L3 其余：设置 / 侧栏 / browser / channels | 功能面完整 |
| **M7** | 交互收尾 + 全域验收 | **全域 1:1 达成** |
| **M8** | L2 契约收口 | 其他项目可上手复用 |

## 相对工作量与中止判定

绝对工期取决于投入人力，**这份文档不填死**——但相对量级和"什么情况下该停"必须先写清楚，否则中途只会靠感觉硬扛。

| 里程碑 | 相对量级 | 主要不确定性 |
| --- | --- | --- |
| M0 | 极小 | 四道 gate 里任何一条不过，都是当天就能知道的事 |
| M1 | 小（机械） | 126 个测试的 codemod；手写 Message 类型是否真等价 |
| M2 | **中，但方差最大** | 自研 SSE 的正确性；探针是否收敛 |
| M3 | 小 | 归一化 DOM 等价能否达成 |
| M4a | **中偏大** | `threads/hooks.ts` 3,169 行 + A/C 两组不变式 |
| M4b | **最大（约占全部组件工作量的一半）** | 75 个组件 / 16,400 行 + stick-to-bottom 自写 |
| M5 / M6 | 大 | 51 个 L3 组件；L2 接口会被反向修正 |
| M7 | 中 | H 组重写（spike 已降低方差）、全域验收 |
| M8 | 小 | 文档与契约收口 |

**中止 / 降级判定点**（触发任一条就停下来重新决策，不要默默继续）：

| 触发条件 | 在哪个阶段 | 该考虑的降级 |
| --- | --- | --- |
| M0 四道 gate 有一条修不掉 | M0 | 先修，修不掉就改接线方式（例如申请 nginx 加入口），**不要带着坏掉的验收体系往下走** |
| 差分测试（M2 门禁）跑不到等价 | M2 | 退回用 `@langchain/langgraph-sdk` 的 `./stream` 内核，L1 只保留 transport 层。产品目标打折，但主线保住 |
| M3 归一化 DOM 等价达不成 | M3 | 接受 Markdown 层的差异清单并冻结它，或退回评估 `streamdown-vue` 当参考实现重写 |
| M4a 的 gate 反复红 | M4a | 流式语义没吃透就往上堆 133 个组件是本方案最大的浪费形态。停下来补单测，**不要进 M4b** |
| 豁免登记表超过 5 条 | M4b 起 | 说明结构 1:1 正在失守。停下来评估是继续 shadcn-vue 逐字对齐，还是正式放宽 DOM 一致这一条验收口径 |

---

## M0 · 骨架

- Nuxt 4 初始化，按 [03-project-shape.md](03-project-shape.md) 建目录
- **`packages/agent-core/` 目录与 `architecture.test.ts` 第一天就建**——边界守护要先于代码存在，否则 M2 写的时候一定会渗
- `frontend-vue/pnpm-workspace.yaml`（嵌套 workspace，让 `agent-core` 是真包）
- **`config/routes.ts` + `tests/unit/config/routes.test.ts`** —— 代理规则、`ssr:false` 分区、prerender 分区的单一来源。`buildProxyRules(env)` 写成接受注入 env 的纯函数，好让 G0-1 变成永久回归而不是一次性检查
- `nuxt.config.ts`（从 `config/routes.ts` 取 `routeRules`、端口 3100、`authDisabled`、关闭业务组件自动导入）
- Tailwind 4 接入，`frontend/src/styles/globals.css`（453 行）→ `app/assets/css/main.css`
- `shadcn-nuxt` 初始化，CLI 拉取 30 个基础组件
- 3 个营销占位页 + 三个 layout
- Vitest **双 project**（`node` 纯 TS + `nuxt` composable）/ Playwright / ESLint / Prettier
- **文件头注释规约**（六段式 + 【对应 frontend/】栏）从第一个文件就开始写，见 [04 §6](04-architecture-decisions.md#配套文件头注释规约)。这条补不回来——等 133 个组件写完再回头加，等于重读一遍
- **依赖版本对齐 `frontend/`**，不要用 `latest` 起项目（见 [02-stack.md](02-stack.md#️-版本对齐约束)）

**零仓库改动**：`.gitignore` 放 `frontend-vue/.gitignore`，启动用 `cd frontend-vue && pnpm dev`。不改根 `Makefile` / nginx / compose / `scripts/`。

**产出**：`pnpm check` 通过，`localhost:3100` 可访问。

### M0 的四道 Gate

这四条都便宜，但每一条都能让后面几个月的工作作废。**全过了才进 M1。**

| # | Gate | 怎么验 | 没过的后果 |
| --- | --- | --- | --- |
| **G0-1** | **`nuxt preview` 下代理生效** | `nuxt build && nuxt preview`，请求 `/api/features` 拿到 Gateway 真实响应；再发一个真实 run，确认 `/api/langgraph/**` 比 `/api/**` 优先命中、且 SSE token 逐条到达不被缓冲。**同时把这两条断言沉进 `tests/unit/config/routes.test.ts`**，含两个 `NUXT_PUBLIC_*` 设/不设的 4 种组合 | E2E webServer 跑的就是 preview。这条不过，`e2e-auth` / `e2e-real-backend` 全不可用，合同 spec 的未 mock 请求会 404 |
| **G0-2** | **共用 testDir 能收集到用例** | `cd frontend-vue && pnpm exec playwright test --list` 列出 25 个 | `@playwright/test` 双实例会让用例收集为 0 或直接报错。整套验收手段的前提 |
| **G0-3** | **鉴权可关** | 带 `NUXT_PUBLIC_AUTH_DISABLED=1` 起 preview，直接访问 `/workspace` 不跳 `/login`。决策逻辑写成纯函数 + 单测（见 [M4a](#m4a--数据流)），别只靠这一次手工验 | 25 个合同 spec 全红，且失败信息指向"页面没渲染"而不是真实原因 |
| **G0-4** | **shadcn-vue 视觉基准** | `Button` 与原版 React `Button` 并排截图 + 暗色切换 | 样式基准没对齐，后面 41 个组件的 cva 复制全部建在流沙上 |

> G0-1 / G0-2 / G0-3 加起来大概半天，但它们是**整个验收体系能否成立**的前提——比 G0-4 更早暴露问题。

### M0/M1 期间插入：splitpanes spike

三面板编排（[05-invariants.md](05-invariants.md) H 组）是**整套 UI 里唯一没有同构关系的部分**，却排在最后的 M7。这与本计划在 M2 上「高风险前置」的原则矛盾，所以在这里补一个一天的 spike：

**只验三件事**，不做完整实现：

1. splitpanes 能否表达 H1（三个右侧面板共用一个面板组）
2. H2 的「用 `collapse()` / `resize()` 而非条件渲染」在 splitpanes 上怎么表达——它是**声明式**的（`:size` 绑定），**没有命令式句柄**，而 [`chat-box.tsx:260`](../frontend/src/components/workspace/chats/chat-box.tsx) 用的正是 `sidePanelRef.current?.collapse()`
3. H6 的「只在 pointer 释放后镜像 `0%`」能否映射到 splitpanes 的 `@resize`（拖拽中）vs `@resized`（释放后）

结论写进 [05-invariants.md](05-invariants.md) H 组，把那 8 条**用 splitpanes 的词汇重写一遍**。spike 失败就意味着要换库或自写，那是必须在 M7 之前知道的事。

---

## M1 · `core/` 纯 TS 落地

**1a. 零改动复制 99 个文件**（连 import 路径都不用改）。

> ⚠️ **「零改动」有一个例外要先挑出来。** 实测 `core/` 里有 2 个文件读 `process.env`，Nuxt 客户端产物里没有这个全局：
>
> | 文件 | 读什么 | 处置 |
> | --- | --- | --- |
> | `core/auth/auth-disabled-user.ts` | `DEER_FLOW_AUTH_DISABLED` | **改读 `runtimeConfig.public.authDisabled`**。它在 E2E 关键路径上——25 个合同 spec 全依赖这个开关（见 [M0 G0-3](#m0-的四道-gate)） |
> | `core/auth/gateway-config.ts` | `DEER_FLOW_INTERNAL_GATEWAY_BASE_URL` / `DEER_FLOW_TRUSTED_ORIGINS` | **不迁**。纯服务端文件，`ssr:false` + 删掉 server auth 后无消费方 |
>
> 量很小，但第一个正好卡在验收体系上，别等到 M4 跑 E2E 时才发现。

**1b. 处理剩下 24 个（4,744 行）**：

| 原因 | 文件数 | 处置 |
| --- | --- | --- |
| `import type { … } from "@langchain/langgraph-sdk"` | 17 | 改指向 `@/core/types/message` |
| `import { env } from "@/env"` | 2 | `config/index.ts`、`static-mode.ts` → Nuxt `runtimeConfig` |
| `import type … from "@/components/…"` | 1 | `scheduled-tasks/recipes.ts` 的 `ScheduleValue` → 移进 `core/` |
| mock / static 分支 | 其余 | 删分支（见 [01-scope.md](01-scope.md)） |

那 17 个正是 B / C / F / G 组语义的载体：

```
messages/utils.ts        messages/run-duration.ts   messages/human-input.ts
messages/derived-state.ts messages/usage.ts         messages/usage-model.ts
threads/utils.ts         threads/types.ts           threads/export.ts
threads/thread-search-query.ts                      tasks/types.ts
tasks/subtask-result.ts  tools/utils.ts             sidecar/context.ts
artifacts/loader.ts      api/api-client.ts          threads/static-demo.ts(不迁)
```

导入的符号只有 8 个，**除 2 处外全是 type-only**：`Message`(18 次)、`AIMessage`、`Thread`、`Run`、`ThreadState`、`ThreadsClient`、`BaseStream`、`ToolCall`。机械替换，但**手写类型必须结构等价**：

> ⚠️ SDK 的 `MessageContent = string | MessageContentComplex[]`（`text` / `image_url` 联合）。塌成 `string` 会让 B1（带 tool_calls 的可见文本）与 B11（citation 从完整 children 树推导）静默走形。`core/types/message.ts` 因此估 ~120 行而非 80 行。

**1c. 复制单测**（126 个测试文件），切到 Vitest。不迁 `static-demo.ts`、`static-mode.ts`、`core/blog/`。

**先写 codemod，不要手改 126 个文件。** Rstest 与 Vitest 的 `describe` / `it` / `expect` 兼容，差异集中在 import 行和 mock 层（`rstest.mock` / `rstest.fn` / `rstest.spyOn` ↔ `vi.*`）。这批测试是 [05-invariants.md](05-invariants.md) C / F 组语义的唯一保真手段——手工替换 mock 语义最容易引入静默差异，而这类差异恰好是单测抓不到的。

**1d. 建 `scripts/i18n-manager.mjs`**（`diff` / `unused` / `check`，见 [03](03-project-shape.md#scriptsi18n-managermjs词典体检)）。

词典正是在这一步搬进来的（`core/i18n/locales/` 三个文件共 3,170 行）。工具要在**开始重写组件之前**就位——`i18n:diff` 的基线要在词典还是原样的时候取，此后每次组件重写都能立刻看出漏了哪个 key。等 M4b 写完再补，基线就没了。

**产出**：单测全绿 = 业务语义已保真。1b 的 24 个改完仍全绿，说明手写类型与 SDK 类型确实等价——比"能编译"强得多的信号。`pnpm i18n:check` 通过。

---

## M2 · L1 `packages/agent-core/` ★ 模板的第一份可交付资产

这是**其他项目真正要拿走的东西**。落点在 `frontend-vue/packages/agent-core/`，有自己的 `package.json` 与测试，通过 **`workspace:*`** 被 `app/` 引用（不是相对路径，理由见 [08](08-agent-core-contract.md#l1-为什么是独立包)）——将来整个目录搬走即可，零改动。

按 [08-agent-core-contract.md](08-agent-core-contract.md) 实现两层：

```
packages/agent-core/          L1 协议无关内核  ← 可整包复用
app/core/agent-deerflow/      L3 协议适配层    ← 随项目走
```

**顺序：先写内核再写适配层。** 反过来做，DeerFlow 的协议假设一定会渗进内核。

### 验证方式：两条并行，一次性探针 + 永久回归

**A. 一次性探针：git worktree 里把 `useStream` 换成 L1** ★ 最强信号

`frontend/` 可以改来做验证，但**绝不能提交**（它是 GitHub 上游在维护的项目）。直接在工作区里改会让 `main` → `main-wc` 的合并变得痛苦，而且随时可能误提交。正确做法是用 **git worktree 开一个一次性分支**：

```bash
git worktree add ../deer-flow-sse-probe -b probe/sse-validation
```

主工作区保持干净，探针分支永不推送，验证完 `git worktree remove` 即可。物理上不可能污染 `frontend/`。

探针内容**刻意做小**——不重写 `core/threads/hooks.ts`（3,169 行），只写一个兼容层：

```
packages/agent-core/adapters/use-stream-compat.ts   用 L1 内核实现 SDK useStream 的返回形状
```

在 worktree 里改一行 import，然后跑 `frontend/` 现成的 **32 个 E2E spec + 126 个单测**。全绿 = 传输层在真实 React 应用、真实时序下是对的。

这是所有验证手段里信号最强的一个：同一个应用、同一份合同、只换传输层。

> ⚠️ **但它必须定时间盒（建议 3 天），而且不能当门禁。** 早期版本估「~200 行」并把 A 定为门禁，这两点都要改：
>
> - SDK `useStream` 的返回形状不止流本身——`messages` / `isLoading` / `error` / `submit` / `stop` / `joinStream` / branch 与 checkpoint 处理都在里面。200 行大概率不够，而"再补一点就跑通了"正是兔子洞的形状
> - 把它当门禁，等于让一个**可选的加分验证**卡住主线
>
> **改为：B（差分测试）是门禁，A 是加分项。** A 在时间盒内跑通就收下这个信号，跑不通就记录卡在哪里、删掉 worktree 继续走——B 的 516 条真实消息差分已经能覆盖归约与合并的正确性。

> 副产品：这个兼容层如果跑通，本身就是「L1 与框架无关」最硬的证据——同一个内核既能撑 React 也能撑 Vue。可以留在 `packages/agent-core/adapters/` 里作为复用示例。⚠️ 但要注意它会给「协议无关内核」带上 **React 类型依赖**：要么明确它只活在 worktree 探针分支里，要么把 `@types/react` 列为 optional devDep 并在 [08](08-agent-core-contract.md) 的禁入清单里开一条显式白名单——现在那份清单只禁了 `.vue` 文件，没说 React。

**B. 永久回归：真实语料差分测试**（留在仓库里长期跑）

| 层 | 语料 | 断言 |
| --- | --- | --- |
| reducer / merge / message-adapt | `frontend/public/demo/threads/*/thread.json` —— **13 个真实会话、516 条真实消息**（`ai` / `tool` / `human` / `system`，含 `additional_kwargs`、`response_metadata`、完整 `checkpoint` 结构） | 同一份输入喂给 M1 复制过来的旧实现（`core/messages/utils.ts` 等）与新的 L1 + 适配层，**输出必须等价** |
| SSE 分帧 / 解析 / 游标 | `frontend/tests/e2e/utils/mock-api.ts` 的 SSE 事件构造（只读引用其线格式） | [05](05-invariants.md) L 组 8 条 + gamma 的 4 个 transport 用例 |
| 真实时序 / 断线续传 | 直连 Gateway 发起一个 run | 完整流 + `Last-Event-ID` 正确续传 |

**B 是门禁**（过了才进 M3），同时也是**长期资产**（语料拷进 `frontend-vue/tests/fixtures/`，此后每次改 L1 都跑）。A 是时间盒内的加分验证，跑通则收下信号，跑不通不阻塞主线。

### 其余产出

- `core/api/client.ts` ~180 行（7 个 REST 方法 + CSRF 头 + 错误规范化），URL 前缀保持 `/api/langgraph/*`
- `core/api/types.gen.ts` —— `openapi-typescript` 从签入的 `openapi.snapshot.json` 生成
- `architecture.test.ts` 全绿：内核里没有任何 endpoint 路径、stream mode 概念、DeerFlow 业务词

**验收清单**：[05-invariants.md](05-invariants.md) 的 **A 组全部** + **L 组 8 条**。

**必须在这里停下来验证。** 不要带着未验证的流式实现去写 133 个组件。

---

## M3 · Markdown 渲染层

**Gate**（已从「能不能用」降级为「输出是否一致」）：

`hast-util-to-jsx-runtime@2.3.6` 的 readme 有一整节 "Example: Vue"，明确要求 `elementAttributeNameCase: 'html'`（见 [02-stack.md](02-stack.md#markdown-渲染层)）。所以：

> 拿一段带代码块、表格、数学公式、raw HTML 的 markdown，用
> `toJsxRuntime(tree, { Fragment, jsx, jsxs, elementAttributeNameCase: "html" })`
> 渲染，把输出与 React 版做 **归一化 DOM 等价比对**：两边各自 parse 成 DOM 树，
> 逐节点比 `tagName`、属性集合（无序 map）、文本、子节点顺序。
>
> 重点：`style` 属性（`stylePropertyNameCase` 默认 `'dom'`）、raw HTML 透传、**自定义组件覆盖收到的是 `class` 而非 `className`**。
>
> ⚠️ **判据不是字符级一致**（早期版本这么写，已推翻）。Vue 与 React 在布尔属性序列化、
> `style` 属性顺序、自闭合写法、空白处理上本来就不同，`@vue/server-renderer` 还会吐
> `<!--[-->` 这类 fragment 锚点注释——字符级判据一定会红然后被人为放宽，gate 就废了。
> 理由与允许的差异类型见 [04 §1](04-architecture-decisions.md#️-gate-的判据是归一化-dom-等价不是字符级一致)。

| 部分 | 处置 | 量 |
| --- | --- | --- |
| remark / rehype 插件链 | **原样复用** | 0 |
| `preprocess.ts`（嵌套截断、LaTeX 归一化、系统标签剥离） | **原样搬** | 0（389 行） |
| `rehypeStreamingListItems` | **原样搬** | 0 |
| hast → vnode | `hast-util-to-jsx-runtime` + `vue/jsx-runtime` | ~30 行 |
| 未完成 markdown 自愈 | **直接用 `remend`** | 0 |
| URL 安全过滤 + HTML 净化 | **`rehype-harden` + `rehype-sanitize`** | 0 |
| 分块 + memo | 自写（用 `marked`） | ~100 行 |
| 逐词动画（**不要用 per-word rehype 插件**） | 自写 | ~70 行 |
| 错误边界（`onErrorCaptured`） | 自写 | ~30 行 |

**⚠️ 分块策略的连带责任**：`capBlockquoteNesting` / `capListNesting` 必须一并搬（marked 的递归 tokenizer 约 2000 层爆栈，会把整个聊天路由变成错误页，见 issue #3393）。

**这一层按 L2 候选写**：不引用任何 DeerFlow 业务概念，M8 收口时直接升为 L2。

---

## M4a · 数据流

**从 M4 里拆出来单列，因为它的风险密度和其余 75 个组件不在一个量级。**

| 内容 | 量 |
| --- | --- |
| 26 个 React 耦合 core → composable | 26 文件 / 5,365 行 |
| 7 个业务 Context → `provide`/`inject` | 见 [04 §3](04-architecture-decisions.md#3-状态管理pinia-管流式状态provideinject-管-ui-状态) |
| `@tanstack/vue-query` plugin、i18n plugin | — |
| `auth.global.ts` + 4 处服务端 cookie 读改客户端 | 见下方「鉴权中间件切成纯函数」 |

### 鉴权中间件切成纯函数 + 薄包装

`auth.global.ts` 不要写成一坨 `defineNuxtRouteMiddleware`。切法参照 `nuxt-modern-starter` 的 `app/middleware/auth.ts`：

```ts
// 纯函数：只做决策，不碰路由、不发请求、不读全局
export const resolveAuthDecision = (input: {
  authDisabled: boolean;      // ← NUXT_PUBLIC_AUTH_DISABLED
  hasSession: boolean;
  fullPath: string;
}): { type: "allow" } | { type: "redirect"; location: RouteLocationRaw } => { … };

// 薄包装：只负责取输入、执行副作用
export default defineNuxtRouteMiddleware(async (to) => {
  const decision = resolveAuthDecision({ … });
  if (decision.type === "redirect") return navigateTo(decision.location);
});
```

**为什么值得这么切**：[M0 G0-3](#m0-的四道-gate) 验的是「`NUXT_PUBLIC_AUTH_DISABLED=1` 时不跳 `/login`」，而 25 个合同 spec 全部依赖它。切成纯函数后这条能被单测钉死；不切的话，它退化成一次性手工验证——将来某次改动把开关判断挪错位置，要等整套 E2E 变红才发现，而那时的失败信息是"页面没渲染"，指不到真实原因。

同理适用于登录后回跳的 `redirect` query：它天然是个"不可信输入 → 安全校验"的场景，纯函数形式才好穷举测试。

**其中 `core/threads/hooks.ts` 一个文件就值得单独立项**：

- **3,169 行**——实测全仓最大的文件
- 是 `useStream` 的唯一消费方，M2 自研 transport 的所有语义在这里落地
- 独自承载 [05-invariants.md](05-invariants.md) **A 组（流式与重连）与 C 组（历史加载与顺序）**——C 组文档自己标注为"全文档最容易在重写中丢失的部分"
- `isMock` 在里面出现 **23 次**，删掉 mock 分支后结构会变，等于边搬边改

**Gate**：这个文件改完后，先只接一个最小可用的聊天页（发消息 → 流式 → 停止 → 刷新恢复顺序），跑通 `chat` / `chat-thread-init-ordering` / `thread-history` 三个 spec，再往下做组件。**不要在 133 个组件都堆上来之后才发现流式顺序是错的**——那时候归因成本会高一个数量级。

**⚠️ 全程对照 [05-invariants.md](05-invariants.md) 的 M 组**（Vue 移植专有陷阱）。M1（`provide` 必须传 ref）和 M5（`watch` 默认惰性）在这个阶段最容易翻车，而 A7 / D4 那类"初始状态不得被覆盖"的约束正好踩在 M5 上。

---

## M4b · 通用 agent UI（L2 第一批）★ 模板价值兑现点

**范围约 75 个组件 / 16,400 行**：

| 批次 | 内容 | 量 |
| --- | --- | --- |
| `elements/` | message、loader、code-block、reasoning、prompt-input… | 29 / 5,417 |
| `workspace/messages/` | 消息列表、分组、卡片、human-input 卡片、subtask 卡片 | 13 / 5,017 |
| `workspace/chats/` + `citations/` | chat-box、input-box、引用 | 7 / 970 |
| 通用散件 | streaming-indicator、token-usage-indicator、context-usage-badge、todo-list、welcome、command-palette、thread-list-virtualizer、recent-chat-list、workspace-{container,header,sidebar,nav-*}、gateway-offline-{banner,fallback}、copy-button、code-editor、overscroll、export-trigger… | ~26 |

**⚠️ 这一批里藏着一个被低估的自写件**：`use-stick-to-bottom` 的替代。实测原包 dist **486 行**（spring 动画、`ResizeObserver`、内容增长时的 scroll anchoring、用户上滚解除吸底），两处消费方（`elements/conversation`、`messages/virtual-message-list`），且行为被 `sidecar-chat.spec.ts` 的 no-animated-scroll 用例固定。早期估的"约 80 行"不成立，**按 250–400 行单独留时间**。

**做完立刻抽 L2 边界并写进 [08](08-agent-core-contract.md)**，不等最后。这一批抽出来的接口，是 M5/M6 建 L3 时要用的。

**验收清单**：B、C、E、F、G、J 组。

**E2E**：`chat` `streaming-reasoning-order` `user-message-plain-text` `thread-history` `thread-history-mermaid` `chat-thread-init-ordering` `agent-chat` `branch-thread` `subtask-card` `thread-list-infinite-scroll` `thread-list-pin`

（其中 `chat` / `chat-thread-init-ordering` / `thread-history` 三个在 [M4a](#m4a--数据流) 的 gate 上已经跑过一轮。）

**产出**：**一个能跑的通用 agent 聊天应用。** 停在这里，模板已经可用——L1 内核 + L2 通用 UI + 一个证明它们能工作的壳。

---

## M5 · L3 第一批：artifacts + sidecar

**范围**：`artifacts/` 6 + `sidecar/` 5 + `changes/` 3 = 14 个 / 3,395 行。

选这两个先做，是因为它们是**「L3 如何挂到 L2 上」最有代表性的样例**——artifacts 有流式草稿、面板状态、外部文件加载；sidecar 是子会话。复用方照着它们接自己的业务面板。

**这一步会反向修正 M4b 抽的 L2 接口**——这是预期的，也是不把 L2 抽取推到最后的理由。

**验收清单**：D 组（8 条）。

**E2E**：`artifact-preview` `artifact-stream-state` `artifact-batched-stream` `artifact-panel-resize` `workspace-changes` `sidecar-chat`

---

## M6 · L3 其余

**范围**：`settings/` 15 + `browser-view/` 8 + `agents/` 5 + `channels/` 3 + 剩余散件（`goal-status`、`scheduled-task-*`、`thread-channel-source`、`workspace-settings-deep-link`、`mode-hover-guide`）≈ 37 个 / 5,100 行。

**验收清单**：I 组（browser view）、K 组（路由与其他）。

**E2E**：`sidebar` `settings-notification` `integrations` `channels` `scheduled-tasks` `browser-feature` `agents-feature-disabled` `ui-polish-mobile`

---

## M7 · 交互收尾 + 全域验收

- 三面板 resizable 编排（`splitpanes`），逐条对照 **H 组 8 条** —— 这是重写而非替换。**可行性已在 [M0/M1 的 spike](#m0m1-期间插入splitpanes-spike) 里验过**，这里做的是完整实现，不是探路
- `sidebar` 与 shadcn-vue 版本逐条比对（折叠、移动端 Sheet 降级、快捷键、cookie 持久化）
- 4 个手写特效（aurora-text / flickering-grid / shine-border / confetti-button）
- 键盘、IME、无障碍属性复核

**全域 1:1 验收**（口径见 [04 §7](04-architecture-decisions.md#7-验收全域-11结构与交互严格样式放宽)）：

- Playwright E2E 全绿——25 个硬合同 spec，清单与豁免见 [03](03-project-shape.md#真实规模)
- **豁免登记表复核**：[03 的 EX 表](03-project-shape.md#选择器失效时的口径spec-只读--豁免登记)有几条、每条的替代验证手段是否真的存在。这张表的长度就是合同被侵蚀的程度
- 接上 `tests/e2e-auth/`（需要对应的 Nuxt webServer）。⚠️ 它依赖 [M0 G0-1](#m0-的四道-gate) 的 preview 代理——`nitro.devProxy` 方案下这一项根本跑不起来
- [05-invariants.md](05-invariants.md) 全表逐条勾选（A–N 共 14 组）
- **结构一致靠 `tests/structural-diff.spec.ts` 自动比对**，不是人肉逐页面看——133 个组件人工比对不可能可靠。做法见 [04 §7](04-architecture-decisions.md#页面结构一致必须可执行不能靠人肉)。样式允许少许差异，**不做像素级 diff**
- 性能基线：**不能直接用 `pnpm perf:check`**（见下）

> `frontend/scripts/measure-route-assets.mjs` 读 `.next/static`，且靠 `NEXT_PUBLIC_STATIC_WEBSITE_ONLY=true` 构建来测 workspace 路由——本方案同时删掉了 static-demo 和 Next。需要写一份读 `.output/public/_nuxt/` 的等价脚本，或明确放弃这一项。**先决定，不要默认沿用。**

### 性能基线：先分包，再统计

直接去数 `.output/public/_nuxt/` 里的 hash 文件名意义不大——Rollup 默认的自动分包会把 chunk 切得又碎又不稳定，同一份代码改一行就可能重排，统计出来的"路由资产"没有可比性。

参照 `nuxt-modern-starter` 的做法：先用 `vite.build.rollupOptions.output.manualChunks` 把大依赖显式切开，再统计。本项目该切的几块是明确的：

| chunk | 内容 | 为什么单切 |
| --- | --- | --- |
| `vendor-vue` | `vue` / `@vue/*` / `vue-router` / `pinia` | 框架底座，所有路由共用 |
| `vendor-markdown` | `shiki` / `katex` / `mermaid` / `unified` / `remark-*` / `rehype-*` | **最大的一块**，且只有聊天路由需要 |
| `vendor-codemirror` | `codemirror` / `@codemirror/*` / `@uiw/codemirror-theme-*` | 只有 artifacts 编辑用得上（对应 [D8](05-invariants.md)：拿到完整内容前不挂载 CodeMirror） |
| `vendor-ui` | `reka-ui` / `lucide-vue-next` / `motion-v` | 控件层 |

切完之后再定基线，并且 `chunkSizeWarningLimit` 要显式放宽——默认 500 KB 对一个内置 Markdown 渲染 + 代码编辑器的应用没有意义，真正的预算靠上面这张表管。

这一步顺带回答了「要不要写等价脚本」：**要写，但先分包**。分包稳定之后，脚本只需按 chunk 名统计，比逐路由追 hash 文件简单得多。

---

## M8 · L2 契约收口

把 M4b / M5 逐步抽出的 L2 边界整理成正式契约，写进 [08-agent-core-contract.md](08-agent-core-contract.md)，并产出一份「其他项目如何复用」的上手文档：

- `packages/agent-core/` 怎么接自己的后端协议（`CursorStrategy` + `EventReducer` + `message-adapt`）
- L2 通用 UI 的扩展点在哪（M5 的 artifacts 是活的参考实现）
- 哪些必须替换（L3 清单）

---

## 风险登记

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| **自研 SSE 正确性不足** | 消息丢失、乱序、重连重复 —— 后期极难定位 | M2 单独验证；差分测试用 516 条真实消息；A + L 组必须有单测 |
| **手写 Message 类型与 SDK 不等价** | 24 个 core 文件编得过但语义变了，B1 / B11 静默走形 | M1b 单测全绿才算通过；`MessageContent` 联合类型必须完整保留 |
| **L2 边界被磨掉** | 做完只剩一个 DeerFlow 克隆，模板目标落空 | L2 在 M4b / M5 各抽一次，不推到最后；`architecture.test.ts` 从 M0 起守护 |
| `hast-util-to-jsx-runtime` 输出与 React 版有差异 | Markdown 视觉走形 | M3 gate 做**归一化 DOM 等价**比对（不是字符级）；`elementAttributeNameCase: 'html'`；允许的差异类型显式登记 |
| 面板编排回归 | 分隔条失去拖拽、动画期间列表跳动（#4465 重现） | H 组 8 条逐条实现；跑 `sidecar-chat.spec.ts` |
| 历史顺序语义丢失 | 消息位置错乱，用户可感知但难复现 | M1 原样复制 + 单测全绿 |
| **依赖版本漂移** | 搬过来的 `core/` 编不过或行为变化（zod 3→4 尤其） | M0 对齐 `frontend/` 版本，跑通 M1 后再逐个升级 |
| **`frontend/` 在重写期间持续演进** | `core/` 副本与上游偏离（近 3 个月 151 次提交） | 每个里程碑开始前 diff 一次 `frontend/src/core/`，把增量补进来；把 diff 纳入里程碑清单 |
| shadcn-vue 组件与 React 版有偏差 | 视觉不一致 | 逐个对照 cva 定义；M0 先做 Button 并排截图 gate |
| E2E 选择器强依赖 React DOM | 验收合同失效 | shadcn-vue 复刻同样的 `data-slot` 约定；**spec 只读**，差异由 Vue 侧消化，实在不行进豁免登记表并复核该表长度 |
| **代理只在 dev 生效** | E2E webServer（preview）无代理，`e2e-auth` / `e2e-real-backend` 不可用，合同 spec 的未 mock 请求 404 | 用 `routeRules` 而不是 `nitro.devProxy`；[M0 G0-1](#m0-的四道-gate) 在 preview 下实测 |
| **鉴权关不掉** | 25 个合同 spec 全红，且失败信息指向"页面没渲染" | `NUXT_PUBLIC_AUTH_DISABLED` 从 M0 就存在；[M0 G0-3](#m0-的四道-gate) |
| **`@playwright/test` 双实例** | 共用 testDir 收集不到用例，整套验收手段落空 | `link:` 到 `frontend/node_modules`；[M0 G0-2](#m0-的四道-gate) 用 `--list` 验 |
| **splitpanes 表达不了 H 组** | 最后一个里程碑才发现要换库或自写 | M0/M1 插入一天的 spike，只验 H1 / H2 / H6 |
| **M2 探针变成兔子洞** | `useStream` 兼容层越写越大，卡住主线 | 探针定 3 天时间盒；**门禁改为差分测试（B）**，探针只是加分项 |
| 跨源直连 Gateway 丢认证 cookie | 登录态莫名失效，且容易误判成 Vue 版 auth 写错 | 默认走同源 `routeRules` 代理；`NUXT_PUBLIC_*_BASE_URL` 留空。见 [07](07-parallel-run.md#️-跨源会丢认证-cookie--不要轻易绕开同源代理) |
| 自写件工作量被低估 | 排期失真（`use-stick-to-bottom` 实测 486 行 vs 早期估 80 行） | M4b 单独留时间；其余自写件动手前先量一次原实现的真实行数 |

---

## 不做的事

- **不提交对 `frontend/` 与 `backend/` 的任何修改。** 它们是 GitHub 上游在维护的项目。需要改动来做验证时，走 `git worktree` 开一次性分支（见 [M2](#m2--l1-packagesagent-core--模板的第一份可交付资产)），验证完删除，永不推送。主工作区里的 `frontend/` / `backend/` 保持干净。
- **不改仓库根的配置文件**（`Makefile`、`nginx`、`compose`、`scripts/`）—— 需要时先征得同意。当前方案设计为**零仓库改动**。
- **不要在移植过程中改行为。** 可以划 L2/L3 边界（那是本次的产品目标），但不要改交互——任何行为改动都会让 E2E 失去判定能力。
- **不要重新设计 `core/` 的纯 TS 实现。** 它们看起来啰嗦的地方通常对应一个已修复的线上问题。
- **不要恢复 mock / static demo。** 若未来需要案例展示，在 API client 那一层做干净的 adapter。
- **不要直接复制 gamma-project 的 transport 代码。** 它绑定另一套后端协议，且有 8 处规范差距。把那 272 行当 checklist 用，不当库用。
