# frontend-vue 当前状态与下一步

> 状态快照：2026-08-13。本文是续接 `frontend-vue` 迁移任务时唯一的当前状态入口。
> 里程碑 evidence 记录的是当时的验收事实，不会随着后续实现重写；看到旧数字或旧红项时，
> 必须先以当前 checkout 和 `make handoff-check` 的结果为准。

## 1. 续接任务时的证据优先级

按下面的顺序判断现状，后面的文档不能覆盖前面的事实：

1. 当前 checkout 的代码、配置和测试定义；
2. 当前运行生成的 Playwright 状态与命令输出，先执行仓库根目录的 `make handoff-check`；
3. 本文记录的最近一次完整核验；
4. [06-migration-plan.md](06-migration-plan.md) 的里程碑目标与
   [08-agent-core-contract.md](08-agent-core-contract.md) 的冻结架构合同；
5. `evidence/` 下的历史里程碑证据，仅用于回答“当时为什么通过、当时还缺什么”。

若本文与代码或新跑出的结果冲突，应先修正文档，不能为了维持本文结论而解释代码。

## 2. 直接结论

- **已完成并有当前 checkout 门禁证据：M-1、M0、M1、M2、M3、M4a、M4b、M5、M6。**
- **当前执行游标：M7 进行中（phase 3）；M8 未进入。** M-1 至 M6 仍已关闭。
- Vue 已具备可运行的通用 Agent 聊天 UI、artifacts/workspace changes/sidecar，以及
  settings、browser、agents、channels、scheduled tasks、goal/mode/mobile 等剩余 L3 surface；
  数据流继续对齐当前 React `frontend` 并接现有 Gateway。
- M7、M8 未完成。M7 phase 3 已落地 splitpanes H1-H8、sidebar/mobile/IME/a11y、
  auth 请求安全合同、真实 Gateway resume/gap/cancel、React-default/Vue-secondary
  hostname ingress、并发 fixture OIDC、四个特效、七状态视觉门禁与资产预算。Vue 已进入
  production Compose 的 secondary hostname，但仍不是默认前端；公网 DNS/TLS/外层代理、
  真实 IdP/runtime 与共享红项仍归 M7。
- **不采用百分比进度。** M4b 是组件和页面工作量的主体，剩余里程碑的复杂度不均匀；
  用“完成了 6/10 个编号”推导 60% 会明显高估实际产品完成度。

## 3. 当前代码已经具备什么

| 层/里程碑    | 当前代码事实                                                                                                                    | 不能扩大解释成                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| M0 工程底座  | Nuxt 4 workspace、preview 代理与安全边界、认证/WS/OIDC/run-protocol 测试基础、独立 Makefile 命令面                              | 产品页面完成、默认生产部署完成                         |
| M1 core 搬迁 | `app/core/` 已落地 84 个 `COPIED`、24 个 `RETYPED`；provenance、i18n、测试迁移账本有守护                                        | 所有 React core 已迁完或已被页面消费                   |
| M2 L1 内核   | `packages/agent-core/` 是当前唯一独立 workspace 包；14 个源码文件、7 个测试文件、92 个测试                                      | L2 组件包已经存在                                      |
| M3 Markdown  | `StreamMarkdown` 管线及其 Markdown 合同测试已落地，M4b/M5 产品路由已消费它                                                      | 所有 M6+ 页面均已迁移                                  |
| M4a 数据流   | `useThreadStream`、run/session/恢复/顺序语义和 M4a 浏览器门禁已落地                                                             | M6/M7 的全部业务入口已完成                             |
| M4b Agent UI | 线程侧栏、history/pin/分页/虚拟列表、composer、Markdown、reasoning/tool/subtask、分支/编辑/重生成、human input 已落地           | 完整 DeerFlow sidecar/artifact 与生产切换已完成        |
| M5 L3 第一批 | artifacts 预览/编辑/流式草稿、workspace changes、sidecar 引用/独立子会话已接真实 Gateway；6-spec/27-test 专项门禁通过           | settings/browser/agents/channels 或生产切换已完成      |
| M6 L3 其余   | settings/browser/agents/channels/scheduled tasks/goal/mode/mobile 已接现有 API；8-spec/27-test 和 browser 真实 Gateway 门禁通过 | M7 全合同、三面板、生产 readiness 或 M8 复用收口已完成 |
| API 类型     | OpenAPI snapshot 与 `types.gen.ts` 生成一致性有门禁                                                                             | 生成类型已经接入所有 API 调用；当前没有业务消费者      |
| Vue 状态设施 | Pinia 与 vue-query 已配置，`stores/threads.ts` 承载 thread adapter；M5/M6 继续复用唯一 run/thread/stream 状态机                 | M7/M8 或默认生产切换已完成                             |

补充规模口径：当前 `frontend-vue/app/core/` 有 144 个 TypeScript 文件，这个总数包含
`COPIED`、`RETYPED`、`ADAPTED`、`ADDED` 等分类，不能写成“140 个原样搬运文件”。

## 4. M5/M6 完成边界

- artifacts 从真实 tool-call/stream/history 派生，文件读写走 Gateway GET/PUT；
  workspace changes 走 thread/run API，不是静态按钮。
- sidecar 是带父线程 metadata 的真实隐藏 thread，复用唯一 run protocol、history 和
  `useThreadStream`，引用通过隐藏 input message 进入同一提交路径。
- 共享 batched-stream fixture 缺真实 Gateway 必需的 `Content-Location` 与终止
  `end`；M5 使用只补这两项协议事实的本地等价 spec，不削弱生产 fail-closed 路径。
- UI 对齐限于 M5 artifacts/tools/sidecar/changes；M6 settings/browser/agents/channels、
  M7 认证与生产入口不在本结论内。
- M6 精确范围由 8 个共享 spec、I1-I5/K4/K5/N2 与实际调用链共同确定；Settings 九个
  section、Browser REST/WS、Channels、Scheduled Tasks、Agents、Goal/Mode 与 mobile surface
  均真实接线，没有第二套 run/stream 状态机。
- M6 不包含 H1-H6 完整三面板、25-file/120-test 全量合同、生产双 hostname/认证 readiness
  或 M8 L2 契约收口。真实第三方 channel/OAuth、scheduler daemon、真实模型 bootstrap 与
  公网 browser 长运行仍是未由本轮 hermetic/replay 门禁证明的运行时边界。

## 5. 2026-08-13 实跑门禁矩阵

本表记录本次从当前 checkout 实跑的结果，以及明确标注为沿用的当前 checkout 最近
证据。`passed` 只代表对应命令的断言范围，不代表其他套件也通过。

| 命令/范围                  | 当前结果                                                                                                                              | 解释与边界                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `make verify`              | **通过**：108 files / 1088 tests；59 migrated files / 560 tests；lint、format、typecheck、unit、build、provenance、i18n、OpenAPI 通过 | M7 phase 3 实跑；沙箱 loopback 首跑 EPERM，允许 loopback 后通过    |
| `make migration-check`     | **通过**：provenance/test manifest 对账；58 个 codemod tests；24 个 `RETYPED`                                                         | 证明迁移账本一致，不证明业务 UI 完成                               |
| `make consumer-check`      | **通过**：pack、clean install、typecheck、最小 session                                                                                | 只验证 `@deerflow/agent-core` 的独立消费者边界                     |
| `make e2e-m0`              | **14/14 通过**                                                                                                                        | M0 基础设施合同；不是共享业务合同                                  |
| `make e2e-m4a`             | **4/4 通过**                                                                                                                          | 合成数据流的 send/stream/stop/reload 顺序                          |
| `make e2e-m4a-stream`      | **3/3 通过**                                                                                                                          | 真分块 SSE、heartbeat、resume cursor、gap                          |
| `make e2e-external`        | **通过**：WebSocket 1/1，双 hostname 并发 OIDC 2/2                                                                                    | fixture IdP；不证明真实 provider/第三方 Cookie                      |
| `make e2e-list`            | **仅收集**：25 files / 120 tests                                                                                                      | 本轮重跑 collection；`--list` 不能写成 120 tests passed            |
| `make e2e-m4b`             | **66/66 通过**                                                                                                                        | 精确列出的 11 个共享 spec                                          |
| `make e2e-m5-list`         | **收集成功**：6 files / 27 tests                                                                                                      | 精确 M5 inventory；其中 batched-stream 是协议修正后的本地等价 spec |
| `make e2e-m5`              | **最近完整运行 26/27**                                                                                                                | 并行 UI animation/scroll 时序红；不为门禁继续拆业务组件             |
| `make e2e-m5-real-backend` | **1/1 通过**                                                                                                                          | 真实回放 Gateway 的 write_file → artifact 自动打开与内容渲染       |
| `make e2e-real-backend`    | **3/3 通过**                                                                                                                          | 固定 Vue 3101；auth-disabled、multi-run history、render            |
| `make e2e-m6-list`         | **收集成功**：8 files / 27 tests                                                                                                      | 精确 M6 inventory，不等于全量共享套件                              |
| `make e2e-m6`              | **27/27 通过**                                                                                                                        | settings/browser/agents/channels/scheduled/mobile 专项门禁         |
| `make e2e-m6-real-backend` | **1/1 通过**                                                                                                                          | 真实 Gateway browser navigate + WS binary frame → Vue panel        |
| `make e2e-m7-list`         | **仅收集**：25 files / 120 tests                                                                                                      | 精确共享 inventory；不能写成 120 passed                            |
| `make e2e-m7`              | **119/120**；唯一红项仍为 protocol-incomplete `artifact-batched-stream`                                                              | 未改共享 spec，生产 fail-closed 未削弱                             |
| `make e2e-m7-local`        | **8/8 通过**                                                                                                                          | sidebar/mobile/keyboard/IME/a11y 与 H7/H8 context usage            |
| `make e2e-m7-auth`         | **7/7 通过**                                                                                                                          | login/register/setup/SSO/change-password/路由与浏览器存储安全       |
| `make e2e-m7-real-protocol`| **1/1 通过**                                                                                                                          | 复用 replay Gateway 的 resume/gap/cancel 浏览器合同                |
| `make e2e-auth`            | **2/2 通过**                                                                                                                          | 共享 setup-status recovery；不是全部认证语义                        |
| `make container-smoke`     | **通过**                                                                                                                              | non-root、health、SIGTERM；性能大 chunk warning 仍存在              |
| `make dual-frontend-production-check` | **29/29 通过**                                                                                                               | hostname/default、单一 API/SSE/WS、headers、compose 与 cleanup      |
| `make e2e-m7-visual`       | **7/7 通过**                                                                                                                          | 七个确定性 Chromium/Darwin 产品状态                                 |
| `make asset-budget`        | **通过**                                                                                                                              | `.output/public/_nuxt` named raw/gzip hard budgets；Vite warning 保留 |

## 6. M6 退出结论

React/Vue 页面、共享合同与 Gateway 调用链已逐项清点。M6 计划退出项 I1-I5、K4、K5、
N2，精确 8-spec/27-test 门禁和真实 Gateway browser 1/1 均满足；M0、M4a、M4b、M5、
verify、migration/consumer、real-backend 与 external 同时保持通过。inventory、首轮失败、
根因、修复和未扩大边界见 [M6 evidence](evidence/m6-remaining-l3.md)。

## 7. M7 当前 phase 3（未关闭）

- `make e2e-m7-list` 精确固定 25 files / 120 tests；实际全量运行是 **119/120**，唯一红项是
  共享 `artifact-batched-stream` 缺 `Content-Location` 和终止 `end`，生产 fail-closed 未削弱。
- H1-H6 已由单一 splitpanes group、声明式 size、pane 元素动画、内容宽度固定与 release-only
  collapse 实现；H7/H8 的常驻 context gauge、同 thread 保留与跨 thread 清空已有浏览器合同。
- sidebar/mobile/keyboard/IME/a11y 精确 **8/8**；auth request/storage/SSO/CSRF 精确 **7/7**；
  共享 auth recovery **2/2**。真实 Gateway resume/gap/cancel **1/1**，真实后端 **3/3**，
  WS **1/1**、OIDC **1/1**，容器 smoke 通过。
- production Compose 已同时构建两前端；Nginx default/unknown Host 仍到 React，仅指定
  `DEER_FLOW_VUE_HOSTNAME` 到 Vue。API/SSE/WS/auth 共用 Gateway，结构门禁 29/29；并发
  fixture OIDC 2/2。公网 DNS/TLS/外层 LB/CDN 与真实 IdP 仍未验证。
- AuroraText、FlickeringGrid、ShineBorder、ConfettiButton 已接真实页面并支持 reduced motion；
  七状态视觉门禁 7/7。
- MessageList 的 Markdown 是产品边界上的异步加载；ArtifactPanel 未为门禁拆分。构建只命名
  已生成 chunk，不手工重排图；raw/gzip hard budget 通过，Shiki language/WASM 的默认大块
  warning 保留。
- A-N 已做本轮 group-level 复核；D8 CodeMirror 仍未安装/消费，J/L/N 仍受真实 provider、
  公网部署与真实浏览器边界限制。共享 fixture 仍 119/120；最近 M5 完整并行运行 26/27。
  详见 [phase 3 evidence](evidence/m7-phase-3-production-visual-performance.md)。不得写成
  M7 complete，也不得写成 Vue 已默认生产切换。

## 8. M7 后续顺序

下一步只处理剩余 M7：合法治理共享 fixture、确认 M5 并行时序、目标环境 DNS/TLS/外层代理/
真实 IdP 与浏览器验收，以及 A-N 未证实边界。全部退出项满足后才允许进入 M8 L2 契约/
复用收口。下一次开工仍须先运行 `make handoff-check` 并重跑精确 inventories。

## 9. 每次交接前必须做什么

1. 从仓库根目录运行 `make handoff-check`，不要只读上一次文字总结；
2. 运行与改动范围相称的门禁，记录“执行了什么”和“没有执行什么”；
3. 更新本文的日期、结果矩阵、当前执行游标和已知红项；
4. 新里程碑结论写入 `evidence/`，并明确它是历史快照；
5. 检查根 `AGENTS.md`、根 `README.md`、`frontend-vue/README.md` 是否仍指向本文；
6. 不得用旧 evidence 的通过结论覆盖当前失败 artifact。
