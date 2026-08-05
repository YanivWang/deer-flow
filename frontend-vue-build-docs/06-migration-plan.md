# 06 · 执行计划

> M-1 已完成并通过；冻结结果、运行探针和追踪矩阵见 [09-m1-contract-freeze.md](09-m1-contract-freeze.md)。本计划从 M0 起必须按该合同实施。

## 终态与顺序

**终态：功能与交互合同一致；关键视觉状态受截图门禁保护。** 不承诺 React 与 Vue 的全页面逐像素相同，也不再用“视觉 1:1”与“允许少许差异”两套冲突口径。精确定义见 [04 §7](04-architecture-decisions.md#7-验收分层功能合同与关键视觉门禁)。

**变的是顺序：按「通用度」排，不只按依赖排。**

`frontend-vue` 的产品价值是[通用 agent 前端模板](08-agent-core-contract.md)——后续其他项目做 AI agent 时能最大程度复用。这个目标不通过缩小范围实现，而是通过**先做通用层、后做 DeerFlow 专有层**实现：

- 每个里程碑结束时都有一个「停在这里也有价值」的产出
- L2 边界在 M4b / M5 各抽一次，**不是全做完再抽**——那样一定会被磨掉（[08](08-agent-core-contract.md) 自己警告过）
- L3 建在 L2 之上的过程，反过来验证 L2 的扩展点设计对不对

## 两条底盘

**一、`core/` 是 1:1 的护城河。** 实测（`frontend/src/core/`，149 个文件 / 19,965 行）：

|                                                               | 文件数 | 行数  |
| ------------------------------------------------------------- | ------ | ----- |
| 纯 TS，初筛为**零 import 改动候选**                           | **99** | 9,856 |
| 纯 TS，**需改 import**（LangChain 类型 / `@/env` / 组件类型） | 24     | 4,744 |
| React 耦合                                                    | 26     | 5,365 |

那 123 个纯 TS 里装着最难复现的东西：消息分组、run-duration 折叠、workspace-change 锚点、human-input v1/v2 协议校验、artifact HTML 结构预检、subtask 步骤模型、composer draft 分键。能进入最终 `COPIED` 集的文件由 hash 把行为一致从“人肉比对”变成结构性保证；99 只是静态初筛候选，不是最终 provenance 数量。

**二、组件按通用度分三档**（实测 `frontend/src/components/`）：

| 档              | 范围                                                                                                                         | 文件 / 行     |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------- |
| **L2 通用**     | `elements/` 22（已扣除 7 个 xyflow canvas）· `workspace/messages/` 13 · `chats/` 4 · `citations/` 3 · 根散件约 26            | ~68 / ~16,100 |
| **L3 DeerFlow** | `settings/` 15 · `artifacts/` 6 · `sidecar/` 5 · `browser-view/` 8 · `agents/` 5 · `channels/` 3 · `changes/` 3 · 根散件约 6 | ~51 / ~8,500  |
| 自写件          | `resizable` + 4 个特效                                                                                                       | 5             |

### 冻结基线与上游同步策略

**对标对象是 `27a425b0f1078baf8b2a361103a2b136ee342ab5`，已冻结。**

```
27a425b0  2026-08-04 13:50:46 +0800  Merge branch 'main' into main-wc
```

建议打个 tag，让基线在文档之外也有可执行载体：

```bash
git tag frontend-vue-baseline-v2 27a425b0
```

**为什么必须冻结**：`frontend/` 近 3 个月 **239 次提交**（约 2.6 次/天）。对标是逐文件的，M0–M7 期间上游会再累积数百次提交——追 moving `main` 做不到。

**冻结的直接收益：上面所有数字变成常量。** 在 `27a425b0` 处实测 `core` 149 / `ui` 44 / `ai-elements` 29 / `workspace` 104 / `app` 39，与本文档记录值完全一致。因此：

- ~~「这些数字会漂，每个里程碑开头重算一次」~~ —— **已作废**
- ~~「每个里程碑开始前 diff 一次 `frontend/src/core/`」~~ —— **改为不 diff**

| 时机         | 动作                                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------- |
| 里程碑进行中 | **完全不看上游。** 对标对象只有 `27a425b0`                                                                          |
| 里程碑收尾   | `git diff 27a425b0..<候选新基线> -- frontend/src/core frontend/src/components` 评估增量，决定「跟」还是「记进待办」 |
| 决定跟       | 更新本节基线值，把增量补进 `app/core/`，重跑 [M1 的 `COPIED` hash 守护](#1e-provenance-台账与-copied-hash-守护)     |

`app/core/` 最终归入 `COPIED` 的文件增量**不需要人工 diff**——hash 守护会在换基线时直接指出哪几个文件对不上。组件层的增量按里程碑范围人工判断，超出当前范围的记进待办，不即时跟。

> ⚠️ **E2E spec 是个例外，注意这个不对称。** [03 的共享 `testDir`](03-project-shape.md#e2e共用-frontendtestse2e不复制) 指向的是工作区**当前**的 `frontend/tests/e2e/`，不是基线那一份。上游改了 spec，Vue 侧会立刻感知——这是好事（合同保鲜），但意味着「代码对标 `27a425b0`、合同对标 `HEAD`」。换基线时把两者对齐一次。

## 里程碑总览

| #       | 内容                                                | 停在这里的价值                                                      |
| ------- | --------------------------------------------------- | ------------------------------------------------------------------- |
| **M-1** | **契约冻结**：协议矩阵、测试 manifest、生产入口决策 | 任何实现开始前消除歧义                                              |
| **M0**  | 骨架                                                | 能跑的空壳                                                          |
| **M1**  | `core/` 纯 TS 落地                                  | 单测全绿 = 业务语义保真                                             |
| **M2**  | **L1 `packages/agent-core/`** ★                     | **协议无关内核，已被 raw trace、fake upstream 与真实 Gateway 验证** |
| **M3**  | Markdown 渲染层                                     | 与 React 版 DOM 结构一致                                            |
| **M4a** | 数据流：`threads/hooks.ts` 与 7 个 Context          | 流式状态在 Vue 下跑通，带 gate                                      |
| **M4b** | **通用 agent UI（L2 第一批）** ★                    | **一个能跑的通用 agent 聊天应用——模板到此可用**                     |
| **M5**  | L3 第一批：artifacts + sidecar                      | L2 扩展点被真实 L3 功能验证过                                       |
| **M6**  | L3 其余：设置 / 侧栏 / browser / channels           | 功能面完整                                                          |
| **M7**  | 交互收尾 + 完整验收                                 | **功能/交互合同与关键视觉状态达成**                                 |
| **M8**  | L2 契约收口                                         | 其他项目可上手复用                                                  |

## 相对工作量与中止判定

绝对工期取决于投入人力，**这份文档不填死**——但相对量级和"什么情况下该停"必须先写清楚，否则中途只会靠感觉硬扛。

| 里程碑  | 相对量级                             | 主要不确定性                                                                                             |
| ------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| M-1     | 中                                   | 协议、认证和生产入口需要跨前后端做明确决策并冻结测试位置                                                 |
| M0      | **中偏大、风险密度高**               | 十道 gate 包含 clean CI、preview 代理、真实认证、WS、OIDC、供应链与生产入口安全，不是普通脚手架工作      |
| M1      | 中（机械量大）                       | 149 个 core 文件要分类、83 个 core 测试要按 node/DOM/composable 分组；富 Message 类型是否等价            |
| M2      | **中偏大，方差最大**                 | 自研 SSE 的正确性；探针是否收敛。transport 层有现成起点，但 run session/gap/cancel 不能按普通 fetch 估算 |
| M3      | **中偏大**（早期估「小」是错的）     | ~790 行而非 230，另加一个未估的 mermaid 组件；代码块组件要从零写；归一化 DOM 等价能否达成                |
| M4a     | **中偏大**                           | `threads/hooks.ts` 3,169 行 + C 组 9 条 + 从 M2 顺延来的 A7/A8（缓存失效与恢复警告，随 vue-query 一起做） |
| M4b     | **最大（约占全部组件工作量的一半）** | 68 个组件 / ~16,100 行 + stick-to-bottom 自写 + 19 个 `src/app/` 文件 / 3,215 行                         |
| M5 / M6 | 大                                   | 51 个 L3 组件；L2 接口会被反向修正                                                                       |
| M7      | 中                                   | H 组重写（spike 已降低方差）、完整验收                                                                   |
| M8      | 小                                   | 文档与契约收口                                                                                           |

**中止 / 降级判定点**（触发任一条就停下来重新决策，不要默默继续）：

| 触发条件                                      | 在哪个阶段 | 该考虑的降级                                                                                                          |
| --------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------- |
| M0 十道 gate 有一条修不掉                     | M0         | 先修，修不掉就改接线方式（例如增加 nginx 入口），**不要带着坏掉的验收体系往下走**                                     |
| raw trace/session/real Gateway 任一门禁不等价 | M2         | 保留 `@langchain/langgraph-sdk` 作为运行时 fallback，缩小 L1 范围；不能只看最终消息放行                               |
| M3 归一化 DOM 等价达不成                      | M3         | 接受 Markdown 层的差异清单并冻结它，或退回评估 `streamdown-vue` 当参考实现重写                                        |
| M4a 的 gate 反复红                            | M4a        | 流式语义没吃透就往上堆 126 个组件是本方案最大的浪费形态。停下来补单测，**不要进 M4b**                                 |
| 豁免登记表超过 5 条                           | M4b 起     | 说明功能/交互选择器合同正在失守。停下来评估是继续对齐，还是正式缩小合同范围                                           |
| `structural-diff` 报告的差异类别持续增长      | M4b 起     | **这是诊断不是门禁**，不阻塞。但若差异类别本身在涨（而不只是数量），说明 shadcn-vue 的 DOM 复刻假设有问题，值得回头看 |

---

## 验收项归属：05 全表 × 里程碑

**规则：验收项归属于「拥有它那一层」的里程碑，不引用 05 的组名。**

[05](05-invariants.md) 的 A–K 组是从 `frontend/AGENTS.md` 提取的，那是一个**没有分层的
React 应用**，所以它按**话题**聚类（"流式与重连""消息渲染"）。本文档的里程碑按**层**切
（L1 内核 / L3 适配 / 数据流 / 组件 / L3 业务）。两套切法不同构——用组名当验收单位，
等于假设"一个话题只落在一层"，而 A、C、F、H、J、K 六个组都横跨里程碑。

早期版本正是这么写的，结果是三处实锤错误：M2 被要求交付需要 vue-query 的 A7/A8；
C 组同时被 §M2（经 A 组）、§M4a（"hooks.ts 独自承载 A 组与 C 组"）和 §M4b 认领；
J 组（认证与存储）被挂在"通用 agent UI"下，而它其实在 M0 就已经验完了。

下表是**唯一的归属来源**，各里程碑的「验收清单」只引用它。

| 条目            | 落在哪一层                                        | 验收里程碑                       | 依据                                                                       |
| --------------- | ------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------- |
| **A1**          | L1 store                                          | M2 ✅                            | `packages/agent-core/src/store/external-store.ts`                          |
| **A2 A3**       | L3 请求构造                                       | M2 ✅                            | `agent-deerflow/run-protocol.ts`                                           |
| **A4 A5 A6**    | L3 会话 / gap 恢复                                | M2 ✅                            | `agent-deerflow/gap-recovery.ts`                                           |
| **A7 A8**       | **Pinia + vue-query 缓存层**                      | **M4a**                          | 二者都要求"失效缓存"；vue-query plugin 在 M4a 才引入                       |
| **B1–B11**      | 组件（消息分组与渲染）                            | M4b                              | `workspace/messages/`                                                      |
| **C1–C9**       | **数据流（`threads/hooks.ts`，REWRITE 未落地）**  | **M4a**                          | §M4a 原文「hooks.ts 独自承载 A 组与 C 组」；gate 跑两个 ordering/history spec |
| **D1–D8**       | L3 artifacts                                      | M5                               | —                                                                          |
| **E1–E11**      | 组件 composer                                     | M4b                              | —                                                                          |
| **F1–F7**       | core 纯 TS（`messages/human-input.ts`，M1 已落地） | **M1**（单测）                   | RETYPED 已落地，语义由随搬的单测固定                                       |
| **F8–F11**      | 组件 human-input 卡片                             | M4b                              | —                                                                          |
| **G1–G6**       | 组件 subtask 卡片 + 事件回填                      | M4b                              | —                                                                          |
| **H1–H6**       | 面板编排（splitpanes 重写）                       | **M7**                           | 05 H 组自述「M7 仍需实现 H3/H4/H5 与业务状态镜像」                         |
| **H7 H8**       | **组件 + 查询**（context-usage / token-usage）    | **M4b**                          | §M4b 组件清单里就有这两个散件                                              |
| **I1–I5**       | L3 browser view                                   | M6                               | —                                                                          |
| **J1–J4**       | 认证与存储                                        | **M0 ✅**（G0-3 / G0-5）         | 与"通用 agent UI"无关                                                      |
| **J5 J6**       | 生产 OIDC / 并发 state                            | **M0 ✅**（G0-7）+ **M7** 生产 readiness | 单前端验完，双 hostname 并发留 M7                                    |
| **K1**          | core 纯 TS（`threads/utils.ts`，M1 已落地）        | **M1**                           | RETYPED 已落地                                                             |
| **K2 K3**       | 编辑并重跑                                        | **M4b**，⚠️ **无专门 E2E spec**   | 25 个 spec 里没有 edit-regenerate；只能靠单测 + 手验                       |
| **K4**          | 重命名 409                                        | **M6**                           | `sidebar.spec.ts`                                                          |
| **K5**          | 设置 > 工具的 MCP 开关                            | **M6**                           | `settings/`                                                                |
| **K6**          | **后端行为**                                      | **不是前端验收项**               | 05 原文「后端行为，前端不要伪造」                                          |
| **L1–L16**      | L1 transport + session                            | M2 ✅                            | —                                                                          |
| **M1 M2**       | `provide` / `inject`                              | **M4a**                          | 7 个业务 Context 在 M4a 转 provide/inject                                  |
| **M3 M4 M6**    | Markdown 渲染语义                                 | **M3**                           | `elementAttributeNameCase`、动画 key、`onErrorCaptured`                    |
| **M5**          | `watch` 惰性                                      | **每个写 Vue 代码的里程碑**（M3 起），首查 M4a | 它不对应业务域；A7/D1/D4 都踩在它上面                        |
| **N1**          | `uploads/hooks.ts`（REWRITE 未落地）              | **M4a**                          | 05 N1：pre-submit 上传状态归 `threads/hooks.ts` 所有                       |
| **N2**          | `notification/hooks.ts`（REWRITE 未落地）         | **M6**                           | `settings-notification.spec.ts`                                            |
| **N3**          | `voice-input/`（COPIED 已落地）                   | **M4b**                          | composer 的一部分                                                          |
| **N4**          | `i18n/cookies.ts`（REWRITE 未落地）               | **M4a**                          | i18n plugin 在 M4a                                                         |

三点读法：

1. **N 组不是约束清单，是"移植前先去读源码补齐约束"的登记**（05 原话）。它的验收
   动作是「补完这一格并把结论写回 05」，不是「跑通某个断言」。
2. **M 组不属于任何单一里程碑。** M5（`watch` 惰性）在每个写 Vue 代码的里程碑都要查一遍；
   把它塞进某一个里程碑的清单，等于宣布其余里程碑不用查。
3. **M7 的「全表逐条勾选」是复核，不是首次验收。** 每条都该在上表指定的里程碑先验过一次；
   M7 复核的是"是否还成立"，不是"是否做过"。

---

## M-1 · 契约冻结（先改方案，再写应用）

**状态：已通过（2026-08-04）。** 以下七项已在 [09](09-m1-contract-freeze.md) 逐项给出源码证据、测试/运行证据与后续 gate。

这一阶段的产出全部是可执行清单，不写 Vue 业务组件：

1. 从当前 Gateway 路由生成 run protocol matrix：create、resume、join、cancel、cancel-then-drain 的方法、路径、header、状态码。
2. 记录 Nuxt proxy 前后 `Content-Location`、`Location`、`Last-Event-ID` 的真实值，冻结 [08](08-agent-core-contract.md) 的 DeerFlow `RunProtocol`。
3. 生成测试 manifest：83 个 core、其余 43 个 unit test、27 个 mock E2E、1 个 auth E2E、3 个 real-backend E2E，标明各里程碑归属。
4. 决定 browser-view 的最终 WS 路径：Nuxt WS proxy、Gateway 显式 origin 白名单或 nginx 对称入口，三选一，不能留到 M6。
5. 决定生产双前端的 public origin 与 OIDC 回跳策略；若当前阶段只交付本地开发，必须显式写成非生产交付，不得称“可直接部署”。
6. 冻结 6–10 个关键视觉截图状态和阈值。
7. 确认根级改动范围：pnpm runner、workflow、README/AGENTS；这些是正常集成，不再宣称“零仓库改动”。

**Gate 结果**：通过。上述七项都有明确决定与测试位置；允许进入 M0，但不代表任一 M0 命令已经通过。

---

## M0 · 骨架

- Nuxt 4 初始化，按 [03-project-shape.md](03-project-shape.md) 建目录
- **`frontend-vue/Makefile`** —— 唯一开发者入口，`package.json` 的 `scripts` 只留 `postinstall`（见 [03](03-project-shape.md#makefile--唯一开发者入口)）
- 扩展根 `scripts/pnpm.py --dir frontend-vue` 并补 `backend/tests/test_pnpm_script.py`，Vue Makefile 不绕过仓库 pnpm runner
- **`packages/agent-core/` 目录与 `architecture.test.ts` 第一天就建**——边界守护要先于代码存在，否则 M2 写的时候一定会渗
- `frontend-vue/pnpm-workspace.yaml`（嵌套 workspace，让 `agent-core` 是真包）
- **`config/routes.ts` + `tests/unit/config/routes.test.ts`** —— 代理规则、`ssr:false` 分区、prerender 分区的单一来源。`buildProxyRules(env)` 写成接受注入 env 的纯函数，好让 G0-1 变成永久回归而不是一次性检查
- `nuxt.config.ts`（从 `config/routes.ts` 取渲染 `routeRules`、端口 3100、`authDisabled`、关闭业务组件自动导入）；生产 API 转发由 Nitro catch-all 消费同一模块的前缀/安全合同
- `Dockerfile` / `.dockerignore` / `/health`：Node 22 多阶段构建、runtime 只带 `.output`、非 root 用户；容器健康检查和 SIGTERM 退出在 CI smoke 验证
- Tailwind 4 接入，`frontend/src/styles/globals.css`（453 行）→ `app/assets/css/main.css`
- `shadcn-nuxt` 初始化，CLI 拉取 30 个基础组件
- 3 个营销占位页 + 三个 layout
- Vitest **双 project**（`node` 纯 TS + `nuxt` composable）/ Playwright / ESLint / Prettier
- **文件头注释规约**（六段式 + 【对应 frontend/】栏）从第一个文件就开始写，见 [04 §6](04-architecture-decisions.md#配套文件头注释规约)。这条补不回来——等 126 个组件写完再回头加，等于重读一遍
- **行为敏感依赖精确对齐 `frontend/pnpm-lock.yaml` resolved version**，不要只复制 caret 声明（见 [02-stack.md](02-stack.md#️-版本对齐约束)）

**根级集成是交付的一部分**：M0 同步 workflow、`scripts/pnpm.py`、对应测试、根 Makefile/serve 脚本、README/AGENTS；M7 同步双 hostname nginx/compose/health-check。现有 `make dev` 保持 React 默认，新增显式 `dev-vue`/`dev-dual`，不能为了维持“零改动”口号牺牲可运行性。

**产出**：clean checkout 下 `make verify` 通过，`localhost:3100` 可访问，十道 gate 全绿。

### M0 的十道 Gate

这些 gate 都必须在空壳阶段完成。**全过了才进 M1。**

| #        | Gate                                         | 怎么验                                                                                                                                                                                                                                                                                                                                                                                                                                | 没过的后果                                                                                                         |
| -------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **G0-0** | **clean checkout CI**                        | workflow 先用根 runner frozen-install `frontend/`，确认共享 Playwright 存在，再安装 `frontend-vue/`；设置完整基线历史或改用签入 hash manifest；跑 `verify`/E2E                                                                                                                                                                                                                                                                        | 本机 node_modules 掩盖 dangling `link:`，或 provenance 在 shallow checkout 失败                                    |
| **G0-1** | **`nuxt preview` 下代理生效 + SSE 不被缓冲** | `nuxt build && nuxt preview`，分别请求 `/api/langgraph/**` 与 `/api/**`，确认前者 rewrite 到 Gateway `/api/**`、后者原样透传，且 SSE token 逐条到达。**顺带验 `sendStream` / `streamRequest` 两个 flag 的有无差异**（见 [03](03-project-shape.md#️-为什么生产代理必须进入-nitro-产物而不是-nitrodevproxy)）。`tests/unit/config/routes.test.ts` 穷举两个 `NUXT_PUBLIC_*` 设/不设的 4 种合同组合；preview 测试锁定真正的 catch-all 行为 | E2E webServer 跑的就是 preview。这条不过，`e2e-auth` / `e2e-real-backend` 全不可用，合同 spec 的未 mock 请求会 404 |
| **G0-2** | **共用 testDir 能收集到用例**                | 先运行 React collection 得到当前总基线 **27 files / 130 tests**；Vue config 排除两个 React-only spec 后，clean install 的 `make e2e-list` 得 **25 / 120**。collection 不是 pass，后续还须 `make e2e`                                                                                                                                                                                                                                  | `@playwright/test` 双实例会让用例收集为 0 或直接报错                                                               |
| **G0-3** | **鉴权可关**                                 | 带 `NUXT_PUBLIC_AUTH_DISABLED=1` 起 preview，直接访问 `/workspace` 不跳 `/login`。决策逻辑写成纯函数 + 单测（见 [M4a](#m4a--数据流)），别只靠这一次手工验                                                                                                                                                                                                                                                                             | 25 个合同 spec 全红，且失败信息指向"页面没渲染"而不是真实原因                                                      |
| **G0-4** | **shadcn-vue 视觉基准**                      | `Button` 与原版 React `Button` 并排截图 + 暗色切换                                                                                                                                                                                                                                                                                                                                                                                    | 样式基准没对齐，后面 41 个组件的 cva 复制全部建在流沙上                                                            |
| **G0-5** | **真实 Cookie + CSRF**                       | 经 3101 preview 同源代理完成 setup/register/login、带 CSRF 的写请求、刷新 `/auth/me`、logout                                                                                                                                                                                                                                                                                                                                          | 只测 auth-disabled 无法证明 Set-Cookie、credentials 和 CSRF 代理正确                                               |
| **G0-6** | **WebSocket 冻结路径**                       | 开发用 `ws://localhost:8001` + `GATEWAY_CORS_ORIGINS=http://localhost:3100,http://localhost:3101` 完成真实 Origin+Cookie upgrade；生产用每个 hostname 的同源 nginx/ingress Upgrade                                                                                                                                                                                                                                                    | 默认 Gateway 会拒绝 `localhost:3100 → localhost:8001` 的 Origin；Nitro routeRules 不能被假定支持 Upgrade           |
| **G0-7** | **OIDC 回跳**                                | 生产两个独立 hostname 各自同源代理；`frontend_base_url` 与 provider `redirect_uri` 同时留空；IdP 注册两 callback；分别验证从 React/Vue 发起后回原入口，并负测同 hostname 不同端口的并发 state-cookie 覆盖                                                                                                                                                                                                                             | 单值绝对 URL 会把 Vue 用户送回 React；同 hostname 两端口并发登录会覆盖 state cookie                                |
| **G0-8** | **Run session 协议**                         | 记录 create 响应头、run handle、resume GET + Last-Event-ID、cancel、heartbeat、gap；固化 raw trace                                                                                                                                                                                                                                                                                                                                    | 自研 transport 可能重复 POST、漏续传或把 abort 当 cancel                                                           |
| **G0-9** | **依赖、代理与镜像安全**                     | 锁定 Nuxt/Nitro/h3 resolved version；`make audit` 对 moderate+ 公告失败；编码 traversal 不能逃出 `/api/langgraph/**`；生产入口实测 20 MiB body limit；镜像以非 root 启动、只含 `.output`、`/health` 与 SIGTERM smoke 通过                                                                                                                                                                                                             | wildcard proxy 可能 scope bypass；独立 Nuxt 入口会丢 nginx body limit；开发镜像直接上线会带源码/权限/存活探针缺口  |

> G0-0～G0-3 建立验收基础；G0-5～G0-8 建立真实 backend 基础；G0-9 建立供应链与入口安全底线。任一未通过时，可以继续做纯 UI spike，但不能批准 M1/M2 主线。

#### G0-0 · CI workflow 对齐

`.github/workflows/frontend-vue-verify.yml` 已经提前存在，但 `frontend-vue/` 尚未落地。workflow 必须同时满足“现在修改它不因目录缺失而红”和“首个 Vue 提交在干净环境可跑”：

1. 先用一个不依赖 Node/pnpm 的检测 step 检查 `frontend-vue/package.json`，后续 step 读取其 output；目录不存在时 workflow 成功跳过并给出说明。
2. 日常 CI 只读签入的 `baseline/core-sha256.json`，使用浅 checkout 即可，不调用 `git show`。只有更新基线的维护 job 才拉完整历史。
3. 先在仓库根执行 `python3 scripts/pnpm.py install --frozen-lockfile` 安装 `frontend/`，提供共享 spec 使用的 Playwright 实例。
4. 再执行 `python3 scripts/pnpm.py --dir frontend-vue install --frozen-lockfile --strict-peer-dependencies`。
5. 显式断言 `frontend/node_modules/@playwright/test/package.json` 存在，再运行 Vue `make verify`、`make audit`、`make container-smoke`、`make e2e-list`、`make e2e`。
6. mock/auth/visual 可在同一个前端 job 顺序执行，real-backend smoke 单独 job；真实后端 job 不能永远缺席，并且 backend 协议/fixture 变化也要触发本 workflow。
7. timeout 至少 60 分钟；缓存只能在 runner/Corepack 顺序被 CI 实测后再开，不能让 setup-node 的 pnpm cache 早于 Corepack 导致找不到可执行文件。

`playwright.vue.config.ts` 不保留，Vue 侧使用与现有命名平行的 `playwright.config.ts`、`playwright.auth.config.ts`、`playwright.real-backend.config.ts`。

#### 三个可直接取用的现成探针

上一轮实现虽已删除，但 git 历史里有三份**经得起推敲**的探针，取回比重做便宜：

```bash
git show 44309ae7:frontend-vue/tests/p0/jsx-runtime-hast.test.ts     # M3 gate
git show 44309ae7:frontend-vue/scripts/p0-nitro-proxy-sse.mjs        # G0-1 的 SSE 半条
git show 44309ae7:frontend-vue/tests/e2e/global-setup.ts             # Nuxt 冷启动预热
```

| 探针                       | 直接取用                                                                                                                                                                                                                                                                 | 必须改                                                                                                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `jsx-runtime-hast.test.ts` | 验 `toJsxRuntime` + `vue/jsx-runtime` 可渲染，**且流式追加兄弟节点时已有 DOM 不重新挂载**（正是 [05 M4](05-invariants.md#m-vue-移植专有陷阱) 的底层前提）。它用的是 `stylePropertyNameCase: "css"`——[02 说"需显式决定"](02-stack.md#markdown-渲染层)的那个值，从这里起步 | 无                                                                                                                                                                                                         |
| `p0-nitro-proxy-sse.mjs`   | 自起假 SSE upstream（带 `id:` 字段）+ Nuxt，断言帧逐条到达                                                                                                                                                                                                               | ① 它起的是 `nuxt dev`，**G0-1 的全部意义在于验 preview**，改成 `build && preview`；② 假 upstream 只发 `\n\n`，加一段 `\r\n\r\n` 用例，顺手把 [L1](05-invariants.md#l-自研-sse-transport-的补强项) 一起验了 |
| `global-setup.ts`          | Playwright 的 Nuxt 冷启动预热                                                                                                                                                                                                                                            | 无。Nuxt 首次 preview 编译慢，不预热第一个 spec 会假红                                                                                                                                                     |

**明确不要取用**上一轮的 `playwright.vue.config.ts`——它把 webServer 定在 **3001**，正是 [07 明令不能用的端口](07-parallel-run.md#️-不要用-3001)，且 `reuseExistingServer: true` 无条件开。

### M0/M1 期间插入：splitpanes spike

三面板编排（[05-invariants.md](05-invariants.md) H 组）是**整套 UI 里唯一没有同构关系的部分**，却排在最后的 M7。这与本计划在 M2 上「高风险前置」的原则矛盾，所以在这里补一个一天的 spike：

**只验三件事**，不做完整实现：

1. splitpanes 能否表达 H1（三个右侧面板共用一个面板组）
2. H2 的「用 `collapse()` / `resize()` 而非条件渲染」在 splitpanes 上怎么表达——它是**声明式**的（`:size` 绑定），**没有命令式句柄**，而 [`chat-box.tsx:260`](../frontend/src/components/workspace/chats/chat-box.tsx) 用的正是 `sidePanelRef.current?.collapse()`
3. H6 的「只在 pointer 释放后镜像 `0%`」能否映射到 splitpanes 的 `@resize`（拖拽中）vs `@resized`（释放后）

结论写进 [05-invariants.md](05-invariants.md) H 组，把那 8 条**用 splitpanes 的词汇重写一遍**。spike 失败就意味着要换库或自写，那是必须在 M7 之前知道的事。

> git 历史里有一份 `tests/p0/splitpanes-go-no-go.test.ts`（`git show 44309ae7:frontend-vue/tests/p0/splitpanes-go-no-go.test.ts`），但**它只断言 `splitpanes` 源码里出现过 `"resize"` 和 `"resized"` 两个字符串**——没验 H1、没验 H2、没验真实拖拽手势。**不能拿它当 spike 结论**，该花的一天还得花。列在这里是为了避免有人翻到它以为已经验过。

---

## M1 · `core/` 纯 TS 落地

**1a. 对 99 个初筛候选逐个分类，只复制真正零改动的集合。** 最终数量由 provenance manifest 生成，不能在分类前写死。

> ⚠️ **「零改动」有一个例外要先挑出来。** 实测 `core/` 里有 2 个文件读 `process.env`，Nuxt 客户端产物里没有这个全局：
>
> | 文件                              | 读什么                                                              | 处置                                                                                                                                      |
> | --------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
> | `core/auth/auth-disabled-user.ts` | `DEER_FLOW_AUTH_DISABLED`                                           | 改为接收 Nuxt plugin 注入的普通 `DeerFlowRuntimeOptions.authDisabled`；纯 core 不调用 `useRuntimeConfig()`。见 [M0 G0-3](#m0-的十道-gate) |
> | `core/auth/gateway-config.ts`     | `DEER_FLOW_INTERNAL_GATEWAY_BASE_URL` / `DEER_FLOW_TRUSTED_ORIGINS` | **不迁**。纯服务端文件，`ssr:false` + 删掉 server auth 后无消费方                                                                         |
>
> 量很小，但第一个正好卡在验收体系上，别等到 M4 跑 E2E 时才发现。

**1b. 处理剩下 24 个（4,744 行）**：

| 原因                                                | 文件数 | 处置                                                                                                               |
| --------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------ |
| `import type { … } from "@langchain/langgraph-sdk"` | 17     | 改指向 `@/core/types/message`                                                                                      |
| `import { env } from "@/env"`                       | 2      | `config/index.ts` 接收普通 runtime options；`static-mode.ts` 不迁。Nuxt composable 只在 plugin/middleware 边界调用 |
| `import type … from "@/components/…"`               | 1      | `scheduled-tasks/recipes.ts` 的 `ScheduleValue` → 移进 `core/`                                                     |
| mock / static 分支                                  | 其余   | 删分支（见 [01-scope.md](01-scope.md)）                                                                            |

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

**1c. 迁移测试 manifest 中的 M1 子集。** 当前 `frontend/tests/unit/core/` 是 83 个文件，不是 126 个；先排除依赖 React DOM、组件、hook 或尚未存在 Nuxt adapter 的测试。其余测试分别进入 M4a、M4b–M6、M7。

**先写 codemod，不逐个手改。** 每批转换后生成 collected-test 报告，与 manifest 对账；不能以“某些测试暂时不收集”换取 M1 全绿。

**1d. 建 `scripts/i18n-manager.mjs`**（`diff` / `unused` / `check`，见 [03](03-project-shape.md#scriptsi18n-managermjs词典体检)）。**已完成**：基线 `baseline/i18n-keys.json` 共 751 个 key，`make i18n-check` 已进 `make verify`。

词典正是在这一步搬进来的（`core/i18n/locales/` 三个文件共 3,170 行）。工具要在**开始重写组件之前**就位——`i18n:diff` 的基线要在词典还是原样的时候取，此后每次组件重写都能立刻看出漏了哪个 key。等 M4b 写完再补，基线就没了。

### 1e. PROVENANCE 台账与 `COPIED` hash 守护

[04 §6](04-architecture-decisions.md#配套文件头注释规约) 的六段式文件头解决「这个文件为什么长这样」，但解决不了「它还是不是上游那一份」。M1 建立最终 `COPIED` 集之后，这个问题立刻变成主要风险。

建 `app/core/PROVENANCE.md` —— `app/core/` 每个文件一行，标来源分类：

| 分类      | 含义                                                                              | 数量             |
| --------- | --------------------------------------------------------------------------------- | ---------------- |
| `COPIED`  | 从 `frontend/src/core/` **零改动**复制                                            | M1 manifest 生成 |
| `RETYPED` | 只改 import（去 LangChain 类型 / `@/env` / 依赖不迁的模块）                       | M1 manifest 生成 |
| `BLOCKED` | 内容零改动，但 import 指向 `REWRITE` 档（M4 才存在）；**随被依赖方一起落地**      | M1 manifest 生成 |
| `ADAPTED` | runtime/mock/React 耦合改写                                                       | 随 M1/M4a 生成   |
| `ADDED`   | 无 React 对应物（`agent-deerflow/`、`markdown/`、`api/client.ts`）                | —                |
| `DROPPED` | 明确不迁（`static-demo.ts`、`static-mode.ts`、`gateway-config.ts`、`core/blog/`） | —                |

> `BLOCKED` 是 M1 落地时补的一档，因为 7 个 barrel（`agents/index.ts` 那类）落在了
> `COPIED` 与 `RETYPED` 中间：内容一个字节都不用改（所以不是 `RETYPED`），
> 但里面的 `export * from "./hooks"` 指向 `REWRITE` 档，现在落地就是个悬空引用
> （所以也不是 `COPIED`）。详见
> [evidence/m1-retyped-landing.md](evidence/m1-retyped-landing.md)。

**`RETYPED` 删掉的 import 必须声明进台账。** 依赖闭包按上游 import 图算，而
`DROPPED` 档永远不落地——于是「依赖 `static-mode.ts`」的文件和测试会被判成
**永远搬不了**，靠推进里程碑解不开。但 1b 早就写了处置方式（删分支），删完那条边根本不存在。
所以 `core-provenance.mjs` 有一份 `RETYPE_DROPS`，产出 manifest 的 `droppedImports` /
`landedDeps`，闭包读后者。这一条直接决定了 5 个测试是「解锁」还是「记为不迁」——
实测是前者，且测试文件一个字节没改。

配套 `tests/guards/core-provenance.test.ts`：

1. `app/core/` 里每个文件都必须在台账里有分类，新增文件不登记就红
2. **`COPIED` 那一档与签入的 `baseline/core-sha256.json` 比对**；manifest 记录 baseline commit、source path 和 SHA-256

普通 CI 不依赖历史对象是否存在。只有显式的 `make baseline-refresh BASELINE=<commit>` 维护命令读取 git object、重建 manifest；该命令必须在完整 clone 中运行并把 diff 交 review。

> 这也是 `COPIED` 这一档必须真的零改动的原因——只要有人「顺手改一行」，hash 就废了，该文件的护城河属性随之消失。真需要改，就把它降级成 `RETYPED`/`ADAPTED` 并写明理由。

**验收清单**（依据[归属表](#验收项归属05-全表--里程碑)）：**F1–F7** 与 **K1** ——
两者的纯 TS 实现（`messages/human-input.ts`、`threads/utils.ts`）在本里程碑随单测一起落地，
语义由随搬的单测固定。**C 组不在这里**：它的实现主体 `threads/hooks.ts` 是 `REWRITE` 档，
M1 一行都没搬，验收在 M4a。

**产出**：单测全绿 = 业务语义已保真。1b 的 24 个改完仍全绿，说明手写类型与 SDK 类型确实等价——比"能编译"强得多的信号。`make i18n-check` 通过，`core-provenance` 守护全绿。

---

## M2 · L1 `packages/agent-core/` ★ 模板的第一份可交付资产

这是其他项目真正要拿走的东西。它有独立 manifest、公共 exports、测试和临时 consumer 验证，通过 `workspace:*` 被应用引用；L1 不包含 Pinia、Vue 或 React adapter。完整接口只认 [08-agent-core-contract.md](08-agent-core-contract.md)。

按 [08-agent-core-contract.md](08-agent-core-contract.md) 实现两层：

```
packages/agent-core/          L1 协议无关内核  ← 可整包复用
app/core/agent-deerflow/      L3 协议适配层    ← 随项目走
```

**顺序：先把 M0 捕获的协议事实写成 L3 测试，再实现 L1 抽象，最后让 L3 测试通过。** 不是先凭空写一个“通用”内核，也不是先把 endpoint 塞进内核。

### ⚠️ transport 层不要从零写，git 历史里有一份更好的起点

上一轮实现的 SSE transport **已经满足 [05 L 组](05-invariants.md#l-自研-sse-transport-的补强项)的前三条**，比 `gamma-project` 那份更接近规范：

```bash
git show 44309ae7:frontend-vue/app/core/api/stream/transport/sse-buffer.ts
git show 44309ae7:frontend-vue/app/core/api/stream/transport/parse-sse-event.ts
git show 44309ae7:frontend-vue/app/core/api/stream/transport/sse-event.ts
```

| L 组条目                                       | gamma                        | 上一轮实现                                                   |
| ---------------------------------------------- | ---------------------------- | ------------------------------------------------------------ |
| **L1 CRLF 归一化**                             | ❌ 只找 `\n\n`               | ✅ `/\r?\n\r?\n/` 分帧，`/\r?\n/` 拆行                       |
| **L2 保留 `id:` 字段**                         | ❌ 只解析 `event:` / `data:` | ✅ 解析并带出 `id`                                           |
| **L3 `data:` 只剥一个前导空格**                | ❌ 用了 `.trim()`            | ✅ `rawValue.startsWith(" ") ? rawValue.slice(1) : rawValue` |
| **心跳注释帧**（以 `:` 开头）                  | ❌ 未处理                    | ✅ 归为 `{ kind: "heartbeat" }`，不当事件                    |
| 无冒号的字段行                                 | ❌                           | ✅ 按规范当作空值字段                                        |
| 流末残留数据                                   | ❌                           | ✅ `flushSseRemainder`                                       |
| L4 指数退避 / L5 重试总量上限 / L6 buffer 上限 | ❌                           | ❌ **仍要自己补**                                            |

**结论：只把这三个文件当 `packages/agent-core/transport/` 的分帧起点**，然后补 L4/L5/L6。连接重试必须按 [08 的 RunProtocol](08-agent-core-contract.md#run-session禁止把创建-post-当普通重试请求) 重写，不能让一个 generic reader 重放 create POST。

⚠️ 它的 `stream-error.ts` 不照搬；错误类型和 `gap` 到通用 `replay_gap` 的映射以 08 为准。

### 验证方式：两条并行，一次性探针 + 永久回归

**A. 一次性探针：git worktree 里把 `useStream` 换成 L1** ★ 最强信号

`frontend/` 可以改来做验证，但**绝不能提交**（它是 GitHub 上游在维护的项目）。直接在工作区里改会让 `main` → `main-wc` 的合并变得痛苦，而且随时可能误提交。正确做法是用 **git worktree 开一个一次性分支**：

```bash
git worktree add ../deer-flow-sse-probe -b probe/sse-validation
```

主工作区保持干净，探针分支永不推送，验证完 `git worktree remove` 即可。物理上不可能污染 `frontend/`。

探针内容刻意做小——不重写 `core/threads/hooks.ts`，只在 worktree 内写兼容层：

```
probe/use-stream-compat.ts   用 L1 + DeerFlow adapter 实现 SDK useStream 的返回形状
```

在 worktree 里改一行 import，然后跑当前 React unit/E2E。全绿是强信号，但这个探针**不得复制回 `packages/agent-core/`**，避免 React 类型进入 L1。

这是所有验证手段里信号最强的一个：同一个应用、同一份合同、只换传输层。

> ⚠️ **但它必须定时间盒（建议 3 天），而且不能当门禁。** 早期版本估「~200 行」并把 A 定为门禁，这两点都要改：
>
> - SDK `useStream` 的返回形状不止流本身——`messages` / `isLoading` / `error` / `submit` / `stop` / `joinStream` / branch 与 checkpoint 处理都在里面。200 行大概率不够，而"再补一点就跑通了"正是兔子洞的形状
> - 把它当门禁，等于让一个**可选的加分验证**卡住主线
>
> 探针定 3 天时间盒，是加分项而不是门禁。门禁由下面四类长期证据组成，不能由 516 条最终消息替代。

**B. 永久回归：四类证据分工**

| 资产 | 断言 |
| --- | --- | --- |
| 13 个 checkpoint / 516 条最终消息 | 富内容 adapter round-trip、最终 thread state、导出输入与旧实现等价；**不声称覆盖时序** |
| `tests/fixtures/streams/*.sse` raw golden | chunk merge、namespace、heartbeat、gap、error/end、event id 与完整 state action 序列 |
| fake upstream | LF/CRLF、跨 chunk、buffer 上限、异常 EOF、create POST 只一次、resume 切 GET、退避/abort/cancel 分离 |
| real Gateway smoke | Nuxt proxy 后两个 location header、run handle、Last-Event-ID、cancel、真实 Cookie/CSRF |

raw trace 第一批来自 M0 的真实录制；每个 fixture 有 schema/version/source commit。
**去敏必须是脚本做的，不是手工做的**——手工去敏无法复跑，也无法证明下一次录制去干净了。
当前实现是 `tests/m0-real-backend/run-protocol.spec.ts::redactRawBody`，只改随机 id、
时间戳与 sandbox 路径前缀；每个 uuid 映射到**各自的**占位符而不是压成一个常量，
否则「gap 报的是不是当前这个 run」这条关系就永远测不了。

#### 「四类全绿才允许删 SDK」到底 gate 住什么

M2 一度卡在这句话上，因为 `frontend-vue` **从来没装过 SDK**，「删」在它这里没有对象。
两种自然读法都不对，正确的是第三种：

| 读法                         | 为什么不对                                                                                                                                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 「删 `frontend-vue` 的依赖」 | 它从来没装过。02 §372 逐字写了「不必装进项目」                                                                                                                                                       |
| 「允许 `frontend/` 下线」    | M2 阶段 Vue 应用一行都还没接线，oracle 无从退役。下线是 [07](07-parallel-run.md) 并行运行的事，要到 M7，且额外要求共享 E2E parity                                                                    |
| ✅ **「L1 定稿」**           | 四类全绿 = transport / session 的语义不再改，接口可以冻结。这正是 [08 §测试资产](08-agent-core-contract.md) 已经写好的拆法：「M2 的长期门禁必须同时包含前 3 类；第 4 类进入专门的 real-backend job」 |

所以 M2 的验收范围是**前 3 类进 `make verify`/单测、第 4 类留在 real-backend job**，
不包含任何「下线 `frontend/`」的动作。这条以前没写清，两种读法对 M2 的验收范围差别很大。

### 其余产出

- `core/api/client.ts` ~180 行（7 个 REST 方法 + CSRF 头 + 错误规范化），URL 前缀保持 `/api/langgraph/*`
- `core/api/types.gen.ts` —— `openapi-typescript` 从签入的 `openapi.snapshot.json` 生成
- `make gen-api-types-check` 在 CI 临时生成并 diff；OpenAPI 不承担 SSE schema
- `architecture.test.ts` 全绿：内核里没有任何 endpoint 路径、stream mode 概念、DeerFlow 业务词
- 临时 consumer workspace clean install/typecheck/test 全绿，证明包的 dependencies/exports 完整

> **落地对照（M2 收口）**：快照在 `frontend-vue/baseline/openapi.snapshot.json`
> （103 条路径 / 128 个 schema），刷新命令与它受哪个环境变量影响见同目录的
> `openapi.snapshot.README.md`。`make gen-api-types` 生成、`make gen-api-types-check`
> 查漂移（已进 `make verify`）、`make consumer-check` 做 08 §54 的可移植性验收
> （**不**进 verify，它要联网）。
>
> `gen-api-types-check` 检的是**幂等性**（同一份快照生成两次结果一致），
> 不是「和线上后端对不对得上」。让 CI 去 curl 一个跑着的 Gateway，门禁就会随
> 部署状态变色——那是环境问题不是代码问题。后者由 real-backend job 与
> raw trace 契约承担。

**验收清单**（依据[归属表](#验收项归属05-全表--里程碑)）：

- **A1–A6** + **L1–L16 全部**；
- **接缝**：新模块之间至少一条组合路径有测试——`gap-recovery` 合成的 durable 帧要真的
  走进 reducer 与 store。模块各自全绿不能替代它：「每个模块都对、合起来不对」正是
  这一层最典型的失效形状，而它在 M4a 的 3,169 行 `hooks.ts` 里归因要贵一个数量级。

**A7 / A8 不在 M2**（早期版本写的是"A 组全部"，那是错的）。两条都要求"失效持久化缓存"
与"本地化恢复警告"，依赖 Pinia 与 `@tanstack/vue-query`，而 vue-query plugin 在 M4a 才引入。
M2 已经为 A7 留好唯一接口：gap 恢复时合成一帧 `values` 交给 reducer（全量替换正是
gap 之后要的 durable 语义），UI 侧的清空与警告挂在这一帧上。

**必须在这里停下来验证。** 不要带着未验证的流式实现进入组件迁移。

---

## M3 · Markdown 渲染层

**Gate**（已从「能不能用」降级为「输出是否一致」）：

`hast-util-to-jsx-runtime@2.3.6` 的 readme 有一整节 "Example: Vue"，明确要求 `elementAttributeNameCase: 'html'`（见 [02-stack.md](02-stack.md#markdown-渲染层)）。

**起点不是空白**——git 历史里有一份现成的 Vitest 用例，它已经验过可渲染性，还多验了一件事：

```bash
git show 44309ae7:frontend-vue/tests/p0/jsx-runtime-hast.test.ts
```

```ts
const firstParagraph = wrapper.find("p").element;
expanded.value = true; // hast 树追加一个兄弟 <p>
await nextTick();
expect(wrapper.findAll("p")).toHaveLength(2);
expect(wrapper.find("p").element).toBe(firstParagraph); // 同一个 DOM 节点，没重挂载
```

这条正是 [05 M4](05-invariants.md#m-vue-移植专有陷阱)（逐词动画 key 必须稳定）的底层前提。**同时它替本方案做掉了一个待定决策**：它用的是 `stylePropertyNameCase: "css"`——[02 说「需显式决定用 `'css'` 还是保持默认 `'dom'`」](02-stack.md#markdown-渲染层)的那个值，从 `"css"` 起步。

所以 M3 的 gate 直接进入输出等价阶段：

> 拿一段带代码块、表格、数学公式、raw HTML 的 markdown，用
> `toJsxRuntime(tree, { Fragment, jsx, jsxs, elementAttributeNameCase: "html", stylePropertyNameCase: "css" })`
> 渲染，把输出与 React 版做 **归一化 DOM 等价比对**：两边各自 parse 成 DOM 树，
> 逐节点比 `tagName`、属性集合（无序 map）、文本、子节点顺序。
>
> 重点：`style` 属性（`stylePropertyNameCase` 默认 `'dom'`）、raw HTML 透传、**自定义组件覆盖收到的是 `class` 而非 `className`**。
>
> ⚠️ **判据不是字符级一致**（早期版本这么写，已推翻）。Vue 与 React 在布尔属性序列化、
> `style` 属性顺序、自闭合写法、空白处理上本来就不同，`@vue/server-renderer` 还会吐
> `<!--[-->` 这类 fragment 锚点注释——字符级判据一定会红然后被人为放宽，gate 就废了。
> 理由与允许的差异类型见 [04 §1](04-architecture-decisions.md#️-gate-的判据是归一化-dom-等价不是字符级一致)。

**验收清单**（依据[归属表](#验收项归属05-全表--里程碑)）：**M3**（自定义组件收到 `class`
而非 `className`）、**M4**（逐词动画 key 稳定）、**M6**（`onErrorCaptured` 要显式返回
`false`）。这三条是本里程碑**首次**有对象可验——在此之前没有 Vue 渲染路径。
**M5**（`watch` 惰性）从这里开始每个里程碑都查一遍。

| 部分                                                    | 处置                                           | 量               |
| ------------------------------------------------------- | ---------------------------------------------- | ---------------- |
| remark / rehype 插件链                                  | **原样复用**                                   | 0                |
| `preprocess.ts`（嵌套截断、LaTeX 归一化、系统标签剥离） | **原样搬**                                     | 0（389 行）      |
| 未完成 markdown 自愈                                    | **直接用 `remend`**                            | 0                |
| URL 安全过滤 + HTML 净化                                | **`rehype-harden` + `rehype-sanitize`**        | 0                |
| hast → vnode                                            | `hast-util-to-jsx-runtime` + `vue/jsx-runtime` | ~30 行           |
| `rehypeStreamingListItems`                              | 从 `plugins.ts` 里**摘出来**搬（见下）         | ~50 行           |
| `plugins.ts` 的其余部分                                 | **重写** —— 它 import 了三个 React-only 包     | ~50 行           |
| `components.tsx` 的组件覆盖 map                         | **重写**（90 行 React）                        | ~120 行          |
| `mermaid.ts`（`normalizeMermaidMarkdown`）              | **已按 `COPIED` 落地**（零 import 纯函数）     | 0                |
| `safe-children.ts`                                      | **重写**（34 行 React）                        | ~40 行           |
| **mermaid 渲染组件**                                    | **新写** —— 与代码块同源，见下                 | **未估**         |
| **代码块组件**（shiki 高亮 + 复制 + 语言标签 + 主题）   | **重写** —— 见下，这块在 streamdown 内部       | ~250 行          |
| 分块 + memo                                             | 自写（用 `marked`）                            | ~100 行          |
| 逐词动画（**不要用 per-word rehype 插件**）             | 自写                                           | ~120 行          |
| 错误边界（`onErrorCaptured`）                           | 自写                                           | ~30 行           |
|                                                         |                                                | **合计 ~790 行 + mermaid 组件（未估）** |

### ⚠️ 早期的「约 230 行」是错的，实测低估了 3–4 倍

三条实测把这个数字顶了上去：

**① `core/streamdown/` 不是「只有 preprocess.ts」，是 6 个文件 714 行。**

| 文件               | 行  | 早期方案的说法       | 实际                                                                                                                                                                                                               |
| ------------------ | --- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `preprocess.ts`    | 389 | 原样搬               | ✅ 原样搬                                                                                                                                                                                                          |
| `plugins.ts`       | 98  | **「原样搬，0 行」** | ❌ 它 `import { code } from "@streamdown/code"`、`import { mermaid } from "@streamdown/mermaid"`、`import type { StreamdownProps } from "streamdown"` —— 全是 React-only。**只有 `rehypeStreamingListItems` 可搬** |
| `components.tsx`   | 90  | 未提及               | React 组件覆盖 map，重写                                                                                                                                                                                           |
| `mermaid.ts`       | 98  | 未提及               | ✅ **零 import 的纯函数**，M1 已按 `COPIED` 逐字节落地。早期与 `safe-children.ts` 合并写成「132 行 React」是错的——React 的只有后者那 34 行                                                                          |
| `safe-children.ts` | 34  | 未提及               | 重写                                                                                                                                                                                                               |
| `index.ts`         | 5   | 未提及               | —                                                                                                                                                                                                                  |

`plugins.ts` 还导出 `streamdownWordAnimation` / `streamdownSmoothStreamingAnimation`（`{ animation: "fadeIn", duration: 200, sep: "word", stagger: 0 }`）——那是 **Streamdown 自己的动画配置 API**，Vue 侧没把动画引擎重建出来之前，这两个常量没有消费方。它们是「要实现什么」的规格说明，不是可搬的代码。

**② 代码块的渲染在 `streamdown` 包内部，不在 `@streamdown/code` 里。**

实测 `@streamdown/code` 的 dist 只有 **1,568 字节**——它是个纯 **shiki tokenizer 插件**（语言别名归一化、highlighter 缓存、返回 tokens），不含任何 DOM。真正的代码块 UI（渲染 tokens、复制按钮、语言标签、明暗主题切换）在 `streamdown` 的 `chunk-*.js` 里，那个文件 **67,773 字节**。

所以「保留 shiki」只解决了高亮，代码块组件本身要重写。

**`@streamdown/mermaid` 是同一个形状，更极端：dist 只有 489 字节**，mermaid 的渲染 UI
也在同一个 67,773 字节的 chunk 里。这一条是 M2 收尾核对台账时才发现的，它同时纠正了
两个方向的错：`core/streamdown/mermaid.ts` 那 98 行是**纯函数、0 行工作量**（不是要重写的
React），而**真正要新写的 mermaid 组件此前根本没被列进来**。

**③ `globals.css` 直接搬会静默丢样式。**

[`frontend/src/styles/globals.css:4-6`](../frontend/src/styles/globals.css)：

```css
@source "../../node_modules/streamdown/dist/index.js";
@source "../../node_modules/@streamdown/code/dist/*.js";
@source "../../node_modules/@streamdown/mermaid/dist/*.js";
```

Tailwind 4 靠这三行从 streamdown 的 dist 里扫 class。453 行主题搬到 `frontend-vue/` 后这些路径不存在，**凡是只出现在 streamdown dist 里的 class 会被 purge**——表现是「样式莫名少一块」，不报错。搬 `globals.css` 时必须删掉这三行，并确认自写的代码块 / mermaid 组件把用到的 class 都写在自己的源码里。

**⚠️ 分块策略的连带责任**：`capBlockquoteNesting` / `capListNesting` 必须一并搬（marked 的递归 tokenizer 约 2000 层爆栈，会把整个聊天路由变成错误页，见 issue #3393）。

**这一层按 L2 候选写**：不引用任何 DeerFlow 业务概念，M8 收口时直接升为 L2。

---

## M4a · 数据流

**从 M4 里拆出来单列，因为它的风险密度和其余约 68 个通用组件不在一个量级。**

| 内容                                                                                        | 量                                                                                                       |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 26 个 React 耦合 core → composable                                                          | 26 文件 / 5,365 行                                                                                       |
| L1 external store → 每 thread 一个 Vue/Pinia adapter；7 个业务 Context → `provide`/`inject` | 见 [04 §3](04-architecture-decisions.md#3-状态管理external-store-管协议状态vue-适配层管作用域与-ui-状态) |
| `@tanstack/vue-query` plugin、i18n plugin                                                   | —                                                                                                        |
| `auth.global.ts` + 4 处服务端 cookie 读改客户端                                             | 见下方「鉴权中间件切成纯函数」                                                                           |

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

**为什么值得这么切**：[M0 G0-3](#m0-的十道-gate) 验的是「`NUXT_PUBLIC_AUTH_DISABLED=1` 时不跳 `/login`」，而 25 个合同 spec 全部依赖它。Nuxt plugin 先读取 runtime config，再把普通布尔值传给纯决策函数；core 不直接调用 `useRuntimeConfig()`。

同理适用于登录后回跳的 `redirect` query：它天然是个"不可信输入 → 安全校验"的场景，纯函数形式才好穷举测试。

**其中 `core/threads/hooks.ts` 一个文件就值得单独立项**：

- **3,169 行**——实测全仓最大的文件
- 是 `useStream` 的唯一消费方，M2 自研 transport 的所有语义在这里落地
- 是 [05-invariants.md](05-invariants.md) **A7/A8 与 C 组（历史加载与顺序）**的载体——C 组文档自己标注为"全文档最容易在重写中丢失的部分"。
  （早期版本这里写的是"独自承载 A 组与 C 组"，与 §M2 的"A 组全部"直接打架。准确说法是：
  **A1–A6 已由 M2 的 L1+L3 交付，`hooks.ts` 是它们的消费方而不是实现方**；
  `hooks.ts` 自己实现的是 A7/A8 与 C 组）
- `isMock` 在里面出现 **23 次**，删掉 mock 分支后结构会变，等于边搬边改

**验收清单**（依据[归属表](#验收项归属05-全表--里程碑)）：**A7 A8**、**C1–C9**、
**M1 M2**（`provide` 必须传 ref）、**M5**、**N1**（uploads）、**N4**（i18n）。

C 组落在这里而不是 M4b：它的实现主体 `threads/hooks.ts` 就在这个里程碑重写，
而下面 gate 里的两个 spec（`chat-thread-init-ordering` / `thread-history`）验的正是 C 组。
A7/A8 落在这里，是因为 `@tanstack/vue-query` plugin 在这个里程碑引入——它们是本里程碑
**唯一**从 M2 顺延过来的项，M2 已把接口留好（gap 恢复合成的那帧 `values`）。

**Gate**：这个文件改完后，先只接一个最小可用的聊天页（发消息 → 流式 → 停止 → 刷新恢复顺序），跑通 `chat` / `chat-thread-init-ordering` / `thread-history` 三个 spec，再往下做组件。**不要在 126 个组件都堆上来之后才发现流式顺序是错的**——那时候归因成本会高一个数量级。

**⚠️ 全程对照 [05-invariants.md](05-invariants.md) 的 M 组**（Vue 移植专有陷阱）。M1（`provide` 必须传 ref）和 M5（`watch` 默认惰性）在这个阶段最容易翻车，而 A7 / D4 那类"初始状态不得被覆盖"的约束正好踩在 M5 上。

---

## M4b · 通用 agent UI（L2 第一批）★ 模板价值兑现点

**范围约 68 个组件 / 16,100 行，再加 19 个 `src/app/` layout/page/providers 文件 / 3,215 行**：

| 批次                                        | 内容                                                                                                                                                                                                                                                                                  | 量         |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `elements/`                                 | message、loader、code-block、reasoning、prompt-input…（**22 个，不是 29**——7 个 xyflow canvas 件不迁，见 [01](01-scope.md#4-xyflow-canvas-组件不迁)）                                                                                                                                 | 22 / 5,107 |
| `workspace/messages/`                       | 消息列表、分组、卡片、human-input 卡片、subtask 卡片                                                                                                                                                                                                                                  | 13 / 5,017 |
| `workspace/chats/` + `citations/`           | chat-box、input-box、引用                                                                                                                                                                                                                                                             | 7 / 970    |
| 通用散件                                    | streaming-indicator、token-usage-indicator、context-usage-badge、todo-list、welcome、command-palette、thread-list-virtualizer、recent-chat-list、workspace-{container,header,sidebar,nav-*}、gateway-offline-{banner,fallback}、copy-button、code-editor、overscroll、export-trigger… | ~26        |
| **`src/app/` 的 layout / page / providers** | 6 个 `layout.tsx` 归并到 `layouts/{default,auth,workspace}.vue` 或路由壳；`workspace-content.tsx`、`chats/[thread_id]/providers.tsx`、各目标 `page.tsx` → `pages/**`。**早期版本完全漏了这一栏**                                                                                      | 19 / 3,215 |

**⚠️ 这一批里藏着一个被低估的自写件**：`use-stick-to-bottom` 的替代。实测原包 dist **486 行**（spring 动画、`ResizeObserver`、内容增长时的 scroll anchoring、用户上滚解除吸底），两处消费方（`elements/conversation`、`messages/virtual-message-list`），且行为被 `sidecar-chat.spec.ts` 的 no-animated-scroll 用例固定。早期估的"约 80 行"不成立，**按 250–400 行单独留时间**。

**做完立刻抽 L2 边界并写进 [08](08-agent-core-contract.md)**，不等最后。这一批抽出来的接口，是 M5/M6 建 L3 时要用的。

**验收清单**（依据[归属表](#验收项归属05-全表--里程碑)）：**B1–B11**、**E1–E11**、
**F8–F11**、**G1–G6**、**H7 H8**、**K2 K3**、**N3**（voice-input）。

三处与早期版本不同，都是实锤订正：

- **C 组移到 M4a**（实现主体 `threads/hooks.ts` 在 M4a 重写，两个 ordering spec 也在 M4a 的 gate 上）；
- **J 组整组移出**（认证与存储；J1–J4 在 M0 的 G0-3/G0-5 就验完了，J5/J6 是 G0-7 + M7 生产 readiness。它与"通用 agent UI"没有关系）；
- **F 组拆开**：F1–F7 是 `messages/human-input.ts` 的协议语义，M1 随单测已落地；这里只验 F8–F11 的卡片交互。

⚠️ **K2/K3（编辑并重跑）在 25 个 spec 里没有对应的 E2E**——`branch-thread` 不覆盖它。
这一条只能靠单测加手验，属于已知覆盖缺口，不要因为"E2E 全绿"就认为它验过了。

**E2E**：`chat` `streaming-reasoning-order` `user-message-plain-text` `thread-history` `thread-history-mermaid` `chat-thread-init-ordering` `agent-chat` `branch-thread` `subtask-card` `thread-list-infinite-scroll` `thread-list-pin`

（其中 `chat` / `chat-thread-init-ordering` / `thread-history` 三个在 [M4a](#m4a--数据流) 的 gate 上已经跑过一轮。）

**产出**：**一个能跑的通用 agent 聊天应用。** 停在这里，模板已经可用——L1 内核 + L2 通用 UI + 一个证明它们能工作的壳。

---

## M5 · L3 第一批：artifacts + sidecar

**范围**：`artifacts/` 6 + `sidecar/` 5 + `changes/` 3 = 14 个 / 3,395 行。

选这两个先做，是因为它们是**「L3 如何挂到 L2 上」最有代表性的样例**——artifacts 有流式草稿、面板状态、外部文件加载；sidecar 是子会话。复用方照着它们接自己的业务面板。

**这一步会反向修正 M4b 抽的 L2 接口**——这是预期的，也是不把 L2 抽取推到最后的理由。

**验收清单**（依据[归属表](#验收项归属05-全表--里程碑)）：**D1–D8**，外加复查 **M5**
（`watch` 惰性）——D1 与 D4 都是"初始状态不得被覆盖"，正好踩在这条上。

**E2E**：`artifact-preview` `artifact-stream-state` `artifact-batched-stream` `artifact-panel-resize` `workspace-changes` `sidecar-chat`

---

## M6 · L3 其余

**范围**：`settings/` 15 + `browser-view/` 8 + `agents/` 5 + `channels/` 3 + 剩余散件（`goal-status`、`scheduled-task-*`、`thread-channel-source`、`workspace-settings-deep-link`、`mode-hover-guide`）≈ 37 个 / 5,100 行。

**验收清单**（依据[归属表](#验收项归属05-全表--里程碑)）：**I1–I5**、**K4**（重命名 409）、
**K5**（MCP 开关）、**N2**（notification）。

**K 组不整组归这里**：K1 是 `threads/utils.ts` 的纯 TS，M1 已落地；K2/K3 是编辑并重跑，
属于 M4b；**K6 根本不是前端验收项**——05 原文就写着「后端行为，前端不要伪造」，
把它放进任何前端清单都只能勾一个假的钩。

**E2E**：`sidebar` `settings-notification` `integrations` `channels` `scheduled-tasks` `browser-feature` `agents-feature-disabled` `ui-polish-mobile`

---

## M7 · 交互收尾 + 完整验收

- 三面板 resizable 编排（`splitpanes`），逐条对照 **H 组 8 条** —— 这是重写而非替换。**可行性已在 [M0/M1 的 spike](#m0m1-期间插入splitpanes-spike) 里验过**，这里做的是完整实现，不是探路
- `sidebar` 与 shadcn-vue 版本逐条比对（折叠、移动端 Sheet 降级、快捷键、cookie 持久化）
- 4 个手写特效（aurora-text / flickering-grid / shine-border / confetti-button）
- 键盘、IME、无障碍属性复核

**完整验收**（口径见 [04 §7](04-architecture-decisions.md#7-验收分层功能合同与关键视觉门禁)）：

- Playwright E2E 全绿——25 个硬合同 spec，清单与豁免见 [03](03-project-shape.md#真实规模)
- **豁免登记表复核**：[03 的 EX 表](03-project-shape.md#选择器失效时的口径spec-只读--豁免登记)有几条、每条的替代验证手段是否真的存在。这张表的长度就是合同被侵蚀的程度
- `tests/e2e-auth/` 全绿；M0 已先跑过真实 Cookie/CSRF smoke，这里跑完整认证套件
- `tests/e2e-real-backend/` 三个 spec 全绿，并补 run resume/gap/cancel 契约用例
- **本里程碑首次验收的项**：**H1–H6**（splitpanes 三面板编排，重写而非替换）、
  **J5 J6** 的双 hostname 并发部分（M0 G0-7 只覆盖了单前端往返）
- [05-invariants.md](05-invariants.md) 全表**复核**（A–N 共 14 组）——注意这是复核不是首次验收：
  每条都该在[归属表](#验收项归属05-全表--里程碑)指定的里程碑先验过一次，
  M7 查的是"是否还成立"。**若某条到这里才第一次被检查，说明归属表漏了它**，
  应当回头补进对应里程碑而不是在 M7 补做
- `tests/structural-diff.spec.ts` 继续作为诊断报告，不比较全页面 DOM
- 关键视觉状态截图门禁全绿：空聊天、流式消息、reasoning/tool、artifact、settings、mobile、dark mode；动态时间、光标、动画区域使用固定数据或有限 mask
- 生产 readiness gate 全绿：选定 public origin、SSE timeout/buffering/body limit、WS Upgrade、HTTPS Cookie、OIDC 回跳、非 root 最小镜像、health check、SIGTERM/优雅退出、进程启动和回滚说明
- 性能基线：**不能直接用 `pnpm perf:check`**（见下）

> `frontend/scripts/measure-route-assets.mjs` 读 `.next/static`，且靠 `NEXT_PUBLIC_STATIC_WEBSITE_ONLY=true` 构建来测 workspace 路由——本方案同时删掉了 static-demo 和 Next。需要写一份读 `.output/public/_nuxt/` 的等价脚本，或明确放弃这一项。**先决定，不要默认沿用。**

### 性能基线：先分包，再统计

直接去数 `.output/public/_nuxt/` 里的 hash 文件名意义不大——Rollup 默认的自动分包会把 chunk 切得又碎又不稳定，同一份代码改一行就可能重排，统计出来的"路由资产"没有可比性。

参照 `nuxt-modern-starter` 的做法：先用 `vite.build.rollupOptions.output.manualChunks` 把大依赖显式切开，再统计。本项目该切的几块是明确的：

| chunk               | 内容                                                                | 为什么单切                                                                                |
| ------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `vendor-vue`        | `vue` / `@vue/*` / `vue-router` / `pinia`                           | 框架底座，所有路由共用                                                                    |
| `vendor-markdown`   | `shiki` / `katex` / `mermaid` / `unified` / `remark-*` / `rehype-*` | **最大的一块**，且只有聊天路由需要                                                        |
| `vendor-codemirror` | `codemirror` / `@codemirror/*` / `@uiw/codemirror-theme-*`          | 只有 artifacts 编辑用得上（对应 [D8](05-invariants.md)：拿到完整内容前不挂载 CodeMirror） |
| `vendor-ui`         | `reka-ui` / `lucide-vue-next` / `motion-v`                          | 控件层                                                                                    |

切完之后再定基线，并且 `chunkSizeWarningLimit` 要显式放宽——默认 500 KB 对一个内置 Markdown 渲染 + 代码编辑器的应用没有意义，真正的预算靠上面这张表管。

这一步顺带回答了「要不要写等价脚本」：**要写，但先分包**。分包稳定之后，脚本只需按 chunk 名统计，比逐路由追 hash 文件简单得多。

---

## M8 · L2 契约收口

把 M4b / M5 逐步抽出的 L2 边界整理成正式契约，写进 [08-agent-core-contract.md](08-agent-core-contract.md)，并产出一份「其他项目如何复用」的上手文档：

- `packages/agent-core/` 怎么接自己的后端协议（`RunProtocol` + `EventReducer` + `message-adapt`）
- L2 通用 UI 的扩展点在哪（M5 的 artifacts 是活的参考实现）
- 哪些必须替换（L3 清单）

---

## 风险登记

| 风险                                                | 影响                                                             | 缓解                                                                                                                                                                 |
| --------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **自研 SSE 正确性不足**                             | 消息丢失、乱序、重复创建 run                                     | 最终 checkpoint、raw trace、fake upstream、real Gateway 四类证据同时过门禁；516 条消息不冒充时序语料                                                                 |
| **手写 Message 类型与 SDK 不等价**                  | 24 个 core 文件编得过但语义变了，B1 / B11 静默走形               | M1b 单测全绿才算通过；`MessageContent` 联合类型必须完整保留                                                                                                          |
| **L2 边界被磨掉**                                   | 做完只剩一个 DeerFlow 克隆，模板目标落空                         | L2 在 M4b / M5 各抽一次，不推到最后；`architecture.test.ts` 从 M0 起守护                                                                                             |
| `hast-util-to-jsx-runtime` 输出与 React 版有差异    | Markdown 视觉走形                                                | M3 gate 做**归一化 DOM 等价**比对（不是字符级）；`elementAttributeNameCase: 'html'`；允许的差异类型显式登记                                                          |
| 面板编排回归                                        | 分隔条失去拖拽、动画期间列表跳动（#4465 重现）                   | H 组 8 条逐条实现；跑 `sidecar-chat.spec.ts`                                                                                                                         |
| 历史顺序语义丢失                                    | 消息位置错乱，用户可感知但难复现                                 | M1 原样复制 + 单测全绿                                                                                                                                               |
| **依赖版本漂移**                                    | DOM/Markdown/CSS 行为与 React 基线不同                           | 首轮精确对齐现有 lockfile resolved version，parity 后逐包升级                                                                                                        |
| **`frontend/` 在重写期间持续演进**                  | `core/` 副本与上游偏离（近 3 个月 **239** 次提交，约 2.6 次/天） | **基线冻结在 `27a425b0`**，里程碑内部完全不跟上游；`COPIED` hash 守护在换基线时自动指出要跟进的文件（[1e](#1e-provenance-台账与-copied-hash-守护)）。不再靠人工 diff |
| **孤儿 CI workflow**                                | 第一次 push 直接红，失败信息指不到真实原因                       | [G0-0](#g0-0--ci-workflow-对齐)，M0 第一件事                                                                                                                         |
| **Markdown 层被低估 3–4 倍**                        | M3 从「小」变「中偏大」，排期失真                                | 已重估为 ~790 行 + 未估的 mermaid 组件；代码块组件、`plugins.ts` 重写部分、`globals.css` 的 `@source` 陷阱都已列明（[M3](#m3--markdown-渲染层)）                                           |
| **`src/app/` 目标文件曾未进工作量表**               | 19 个 / 3,215 行的 layout / page / providers 无人认领            | 已并入 [M4b](#m4b--通用-agent-uil2-第一批-模板价值兑现点)                                                                                                            |
| **WebSocket 直连被 Origin 拒绝或生产 Upgrade 丢失** | browser-view 不可用                                              | M-1 已冻结开发直连+精确 allowlist、生产同源 ingress；[G0-6](#m0-的十道-gate) 用真实浏览器 Origin/cookie 验证                                                         |
| **结构 diff 门禁无界**                              | 与「视觉 98%」同一种失败形状：门禁工作量超过功能本身             | 已降为诊断报告、不做门禁、只覆盖固定少数容器（[04 §7](04-architecture-decisions.md#页面结构一致靠诊断报告不做门禁)）                                                 |
| shadcn-vue 组件与 React 版有偏差                    | 视觉不一致                                                       | 逐个对照 cva 定义；M0 先做 Button 并排截图 gate                                                                                                                      |
| E2E 选择器强依赖 React DOM                          | 验收合同失效                                                     | shadcn-vue 复刻同样的 `data-slot` 约定；**spec 只读**，差异由 Vue 侧消化，实在不行进豁免登记表并复核该表长度                                                         |
| **代理只在 dev 生效**                               | auth/real-backend E2E 请求 404                                   | 用编译进 Nitro 的 server catch-all，并由 [M0 G0-1](#m0-的十道-gate) 在 preview 实测；不要改回会绕过 guard 的 `routeRules.proxy`                                      |
| **鉴权关不掉或真实 Cookie/CSRF 失败**               | mock E2E 全红或生产登录不可用                                    | [G0-3/G0-5](#m0-的十道-gate) 分别验证测试开关和真实认证                                                                                                              |
| **`@playwright/test` 双实例或 link target 不存在**  | 共用 testDir 无法收集                                            | clean CI 先安装 `frontend`，再安装 Vue；[G0-0/G0-2](#m0-的十道-gate)                                                                                                 |
| **OIDC 固定回 React 的绝对 URL**                    | Vue 发起 SSO 后落回错误前端，或同 hostname 并发 state 被覆盖     | M-1 已冻结独立 hostname + 双 callback + 相对回跳；[G0-7](#m0-的十道-gate) 实测可信代理与 cookie 范围                                                                 |
| **Nuxt wildcard proxy 或 body limit 未锁定**        | 编码路径逃逸代理 scope，或绕过 20 MiB 上传限制                   | [G0-9](#m0-的十道-gate) 锁 resolved dependency、audit、恶意路径回归与生产入口限制                                                                                    |
| **splitpanes 表达不了 H 组**                        | 最后一个里程碑才发现要换库或自写                                 | M0/M1 插入一天的 spike，只验 H1 / H2 / H6                                                                                                                            |
| **M2 探针变成兔子洞**                               | `useStream` 兼容层越写越大                                       | 探针只在 worktree、定 3 天；长期门禁是四类协议证据                                                                                                                   |
| 跨源直连 Gateway 丢认证 cookie                      | 登录态莫名失效，且容易误判成 Vue 版 auth 写错                    | 默认走同源 Nitro handler 代理；`NUXT_PUBLIC_*_BASE_URL` 留空。见 [07](07-parallel-run.md#️-跨源会丢认证-cookie--不要轻易绕开同源代理)                                 |
| 自写件工作量被低估                                  | 排期失真（`use-stick-to-bottom` 实测 486 行 vs 早期估 80 行）    | M4b 单独留时间；其余自写件动手前先量一次原实现的真实行数                                                                                                             |

---

## 不做的事

- **不提交对 `frontend/` 与 `backend/` 的任何修改。** 它们是 GitHub 上游在维护的项目。需要改动来做验证时，走 `git worktree` 开一次性分支（见 [M2](#m2--l1-packagesagent-core--模板的第一份可交付资产)），验证完删除，永不推送。主工作区里的 `frontend/` / `backend/` 保持干净。
- **不改仓库根的配置文件**（`Makefile`、`nginx`、`compose`、`scripts/`）—— 需要时先征得同意。**唯一的例外是 [G0-0 的 CI workflow 对齐](#g0-0--ci-workflow-对齐)**，它是上一轮实现的遗留物、不处理就会持续变红，处理它同样需要先征得同意。
- **不要在移植过程中改行为。** 可以划 L2/L3 边界（那是本次的产品目标），但不要改交互——任何行为改动都会让 E2E 失去判定能力。
- **不要重新设计 `core/` 的纯 TS 实现。** 它们看起来啰嗦的地方通常对应一个已修复的线上问题。
- **不要恢复 mock / static demo。** 若未来需要案例展示，在 API client 那一层做干净的 adapter。
- **不要直接复制 gamma-project 的 transport 代码。** 它绑定另一套后端协议，且有 8 处规范差距。把那 272 行当 checklist 用，不当库用。
