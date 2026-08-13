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

- **已完成并有当前 checkout 门禁证据：M-1、M0、M1、M2、M3、M4a、M4b、M5。**
- **当前执行游标：M5 已关闭；下一里程碑是 M6，但本轮没有进入 M6。**
- Vue 已具备可运行的通用 Agent 聊天 UI，以及真实接通的 artifacts、workspace changes
  与 sidecar 子会话；界面和交互对齐当前 React `frontend`。
- M6、M7、M8 均未完成。Vue 前端仍不在默认 Docker/Nginx 生产入口中；双前端生产
  readiness 仍归 M7。
- **不采用百分比进度。** M4b 是组件和页面工作量的主体，剩余里程碑的复杂度不均匀；
  用“完成了 6/10 个编号”推导 60% 会明显高估实际产品完成度。

## 3. 当前代码已经具备什么

| 层/里程碑    | 当前代码事实                                                                                                          | 不能扩大解释成                                    |
| ------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| M0 工程底座  | Nuxt 4 workspace、preview 代理与安全边界、认证/WS/OIDC/run-protocol 测试基础、独立 Makefile 命令面                    | 产品页面完成、默认生产部署完成                    |
| M1 core 搬迁 | `app/core/` 已落地 84 个 `COPIED`、24 个 `RETYPED`；provenance、i18n、测试迁移账本有守护                              | 所有 React core 已迁完或已被页面消费              |
| M2 L1 内核   | `packages/agent-core/` 是当前唯一独立 workspace 包；14 个源码文件、7 个测试文件、92 个测试                            | L2 组件包已经存在                                 |
| M3 Markdown  | `StreamMarkdown` 管线及其 Markdown 合同测试已落地，M4b/M5 产品路由已消费它                                            | 所有 M6+ 页面均已迁移                             |
| M4a 数据流   | `useThreadStream`、run/session/恢复/顺序语义和 M4a 浏览器门禁已落地                                                   | M6/M7 的全部业务入口已完成                        |
| M4b Agent UI | 线程侧栏、history/pin/分页/虚拟列表、composer、Markdown、reasoning/tool/subtask、分支/编辑/重生成、human input 已落地 | 完整 DeerFlow sidecar/artifact 与生产切换已完成   |
| M5 L3 第一批 | artifacts 预览/编辑/流式草稿、workspace changes、sidecar 引用/独立子会话已接真实 Gateway；6-spec/27-test 专项门禁通过 | settings/browser/agents/channels 或生产切换已完成 |
| API 类型     | OpenAPI snapshot 与 `types.gen.ts` 生成一致性有门禁                                                                   | 生成类型已经接入所有 API 调用；当前没有业务消费者 |
| Vue 状态设施 | Pinia 与 vue-query 已配置，`stores/threads.ts` 承载 thread adapter                                                    | M5/M6 的项目专用状态已迁移                        |

补充规模口径：当前 `frontend-vue/app/core/` 有 140 个 TypeScript 文件，这个总数包含
`COPIED`、`RETYPED`、`ADAPTED`、`ADDED` 等分类，不能写成“140 个原样搬运文件”。

## 4. M5 完成边界

- artifacts 从真实 tool-call/stream/history 派生，文件读写走 Gateway GET/PUT；
  workspace changes 走 thread/run API，不是静态按钮。
- sidecar 是带父线程 metadata 的真实隐藏 thread，复用唯一 run protocol、history 和
  `useThreadStream`，引用通过隐藏 input message 进入同一提交路径。
- 共享 batched-stream fixture 缺真实 Gateway 必需的 `Content-Location` 与终止
  `end`；M5 使用只补这两项协议事实的本地等价 spec，不削弱生产 fail-closed 路径。
- UI 对齐限于 M5 artifacts/tools/sidecar/changes；M6 settings/browser/agents/channels、
  M7 认证与生产入口不在本结论内。

## 5. 2026-08-13 实跑门禁矩阵

本表记录本次从当前 checkout 实跑的结果，以及明确标注为沿用的当前 checkout 最近
证据。`passed` 只代表对应命令的断言范围，不代表其他套件也通过。

| 命令/范围                  | 当前结果                                                                                                 | 解释与边界                                                         |
| -------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `make verify`              | **通过**：102 files / 1064 tests；lint、format、typecheck、unit、build、provenance、i18n、OpenAPI 等通过 | 有非阻塞 lint/build warning，无 error                              |
| `make migration-check`     | **通过**：provenance/test manifest 对账；58 个 codemod tests；24 个 `RETYPED`                            | 证明迁移账本一致，不证明业务 UI 完成                               |
| `make consumer-check`      | **通过**：pack、clean install、typecheck、最小 session                                                   | 只验证 `@deerflow/agent-core` 的独立消费者边界                     |
| `make e2e-m0`              | **14/14 通过**                                                                                           | M0 基础设施合同；不是共享业务合同                                  |
| `make e2e-m4a`             | **4/4 通过**                                                                                             | 合成数据流的 send/stream/stop/reload 顺序                          |
| `make e2e-m4a-stream`      | **3/3 通过**                                                                                             | 真分块 SSE、heartbeat、resume cursor、gap                          |
| `make e2e-external`        | **最近证据通过**：WebSocket 1/1，OIDC 1/1                                                                | 沿用 M4b 当前 checkout 证据；M5 收口后未重跑                       |
| `make e2e-list`            | **最近证据仅收集**：25 files / 120 tests                                                                 | 本轮未重跑；`--list` 不能写成 120 tests passed                     |
| `make e2e-m4b`             | **66/66 通过**                                                                                           | 精确列出的 11 个共享 spec                                          |
| `make e2e-m5-list`         | **收集成功**：6 files / 27 tests                                                                         | 精确 M5 inventory；其中 batched-stream 是协议修正后的本地等价 spec |
| `make e2e-m5`              | **27/27 通过**                                                                                           | artifacts、workspace changes、sidecar 专项退出门禁                 |
| `make e2e-m5-real-backend` | **1/1 通过**                                                                                             | 真实回放 Gateway 的 write_file → artifact 自动打开与内容渲染       |
| `make e2e-real-backend`    | **3/3 通过**                                                                                             | 固定 Vue 3101；auth-disabled、multi-run history、render            |

## 6. M5 退出结论

React 14-file/3,395-line 源范围、Vue 落点、共享合同和真实 Gateway 调用链均已逐项清点。
精确 6-spec/27-test 门禁、M5 真实后端 1/1、M4b 66/66、M4a、M0、verify、
migration/consumer 与真实后端 3/3 均保持通过。退出命令、修复过程和未扩大边界见
[M5 evidence](evidence/m5-artifacts-sidecar.md)。

## 7. M5 之后

顺序仍按冻结计划执行：M6 settings/browser/agents/channels 等剩余 L3 → M7 完整工作区、
认证与双前端生产验收 → M8 资产、性能、复用文档与最终收口。本轮到 M5 为止，
没有实现、试接或提前声明任何 M6 功能。

## 8. 每次交接前必须做什么

1. 从仓库根目录运行 `make handoff-check`，不要只读上一次文字总结；
2. 运行与改动范围相称的门禁，记录“执行了什么”和“没有执行什么”；
3. 更新本文的日期、结果矩阵、当前执行游标和已知红项；
4. 新里程碑结论写入 `evidence/`，并明确它是历史快照；
5. 检查根 `AGENTS.md`、根 `README.md`、`frontend-vue/README.md` 是否仍指向本文；
6. 不得用旧 evidence 的通过结论覆盖当前失败 artifact。
