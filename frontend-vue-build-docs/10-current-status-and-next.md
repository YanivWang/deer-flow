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

- **已完成并有当前 checkout 门禁证据：M-1、M0、M1、M2、M3、M4a、M4b、M5、M6、M8。**
- **当前执行游标：M7 带条件关闭；M8 已关闭。** 仓库内 M7 硬退出项已有直接证据；
  两项共享测试治理例外和目标环境激活门禁保持显式，不得解释为通过。
- Vue 已具备可运行的通用 Agent 聊天 UI、artifacts/workspace changes/sidecar，以及
  settings、browser、agents、channels、scheduled tasks、goal/mode/mobile 等剩余 L3 surface；
  数据流继续对齐当前 React `frontend` 并接现有 Gateway。
- M7 已按上述条件关闭。M8 已冻结 private L1 根导出、最小 L2 Markdown/Button 源码边界、
  隔离 consumer 与 L3 替换清单；没有创建伪通用 UI 包、没有发布 npm，也没有改变生产默认
  React 入口。M7 已落地 splitpanes H1-H8、sidebar/mobile/IME/a11y、
  auth 请求安全合同、真实 Gateway resume/gap/cancel、React-default/Vue-secondary
  hostname ingress、并发 fixture OIDC、四个特效、七状态视觉门禁与资产预算。Vue 已进入
  production Compose 的 secondary hostname，但仍不是默认前端；公网 DNS/TLS/外层代理、
  真实 IdP/runtime 仍是公开激活前的目标环境发布门禁。
- **不采用百分比进度。** M4b 是组件和页面工作量的主体，剩余里程碑的复杂度不均匀；
  用“完成了 6/10 个编号”推导 60% 会明显高估实际产品完成度。

## 3. 当前代码已经具备什么

| 层/里程碑    | 当前代码事实                                                                                                                    | 不能扩大解释成                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| M0 工程底座  | Nuxt 4 workspace、preview 代理与安全边界、认证/WS/OIDC/run-protocol 测试基础、独立 Makefile 命令面                              | 产品页面完成、默认生产部署完成                               |
| M1 core 搬迁 | `app/core/` 已落地 84 个 `COPIED`、24 个 `RETYPED`；provenance、i18n、测试迁移账本有守护                                        | 所有 React core 已迁完或已被页面消费                         |
| M2/M8 L1 内核 | `packages/agent-core/` 是当前唯一独立 workspace 包；14 个源码文件、7 个测试文件、93 个测试；M8 冻结 `m8` 根导出与 tarball 内容 | 包已发布 npm，或 L1 已证明任意后端产品集成                   |
| M3 Markdown  | `StreamMarkdown` 管线及其 Markdown 合同测试已落地，M4b/M5 产品路由已消费它                                                      | 所有 M6+ 页面均已迁移                                        |
| M4a 数据流   | `useThreadStream`、run/session/恢复/顺序语义和 M4a 浏览器门禁已落地                                                             | M6/M7 的全部业务入口已完成                                   |
| M4b Agent UI | 线程侧栏、history/pin/分页/虚拟列表、composer、Markdown、reasoning/tool/subtask、分支/编辑/重生成、human input 已落地           | 完整 DeerFlow sidecar/artifact 与生产切换已完成              |
| M5 L3 第一批 | artifacts 预览/编辑/流式草稿、workspace changes、sidecar 引用/独立子会话已接真实 Gateway；本窗口 6-spec/27-test 与真实 Gateway 通过 | M7 历史共享套件两项治理例外已经自动消失                      |
| M6 L3 其余   | settings/browser/agents/channels/scheduled tasks/goal/mode/mobile 已接现有 API；8-spec/27-test 和 browser 真实 Gateway 门禁通过 | M7 全合同、三面板或默认生产切流已完成                        |
| API 类型     | OpenAPI snapshot 与 `types.gen.ts` 生成一致性有门禁                                                                             | 生成类型已经接入所有 API 调用；当前没有业务消费者            |
| Vue 状态设施 | Pinia 与 vue-query 已配置，`stores/threads.ts` 承载 thread adapter；M5/M6 继续复用唯一 run/thread/stream 状态机                 | 已抽成通用 UI 包或默认生产切换已完成                         |
| M8 L2 契约   | 最小源码边界只含 Markdown、Button 与 `app/lib/utils.ts`；chat 是 L3 host adapter，artifact/sidecar 是单向扩展示例               | 已存在通用 `agent-ui-kit`，或可直接复制 DeerFlow chat 产品层 |

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
- M8 没有抽出带 DeerFlow store/API/type 依赖的 `AgentChat`、`MessageList`、`ChatComposer`、
  `HumanInputCard`。这些组件只冻结已验证的行为 seam，并明确为 L3 host adapter；L2 只保留
  无 DeerFlow 业务 import 的 Markdown/Button 源码集合。

## 5. 2026-08-13 实跑门禁矩阵

本表记录本窗口从当前 checkout 实跑的结果。没有重跑的历史前置门禁明确写成“未重跑”；
`passed` 只代表对应命令的断言范围，不代表其他套件也通过。

| 命令/范围                                 | 当前结果                                                                                                                              | 解释与边界                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `make verify`                             | **通过**：108 files / 1092 tests；59 migrated files / 560 tests；lint、format、typecheck、unit、build、provenance、i18n、OpenAPI、file header 通过 | lint 0 errors/35 warnings；默认大 chunk warning 保留                     |
| `make migration-check`                    | **通过**：provenance/test manifest 对账；58 个 codemod tests；24 个 `RETYPED`                                                         | 证明迁移账本一致，不证明业务 UI 完成                                     |
| `make consumer-check`                     | **通过**：真实 package pack、隔离 clean install、typecheck、esbuild、Node session runtime                                              | 自定义 `/sessions` 协议；不借父级 `node_modules`；包仍 private           |
| `make e2e-m0`                             | **本窗口未重跑**                                                                                                                      | 本轮没有 M0 基础设施改动                                                 |
| `make e2e-m4a`                            | **4/4 通过**                                                                                                                          | send/stream/stop/reload 顺序                                             |
| `make e2e-m4a-stream`                     | **3/3 通过**                                                                                                                          | 真实 chunked SSE、heartbeat、resume cursor/gap                           |
| `make e2e-external`                       | **本窗口未重跑；最近记录为 WebSocket 1/1、双 hostname 并发 OIDC 2/2**                                                                  | fixture IdP；不证明真实 provider/第三方 Cookie                           |
| `make e2e-list`                           | **本窗口未单独运行**                                                                                                                  | 最近 `make e2e-m7` 执行并确认 25 files / 120 tests                       |
| `make e2e-m4b`                            | **66/66 通过**                                                                                                                        | 精确列出的 11 个共享 spec                                                |
| `make e2e-m5-list`                        | **由 `make e2e-m5` 确认**：6 files / 27 tests                                                                                         | 精确 M5 inventory；其中 batched-stream 是协议修正后的本地等价 spec       |
| `make e2e-m5`                             | **27/27 通过**                                                                                                                        | 本窗口未复现 transition 监听时序失败；不改写 M7 历史全量结果             |
| `make e2e-m5-real-backend`                | **1/1 通过**                                                                                                                          | 真实回放 Gateway 的 write_file → artifact 自动打开与内容渲染             |
| `make e2e-real-backend`                   | **3/3 通过**                                                                                                                          | 固定 Vue 3101；auth-disabled、multi-run history、render                  |
| `make e2e-m6-list`                        | **本窗口未重跑；最近记录为 8 files / 27 tests**                                                                                        | 精确 M6 inventory，不等于全量共享套件                                    |
| `make e2e-m6`                             | **本窗口未重跑；最近记录为 27/27**                                                                                                    | M8 未改 M6 业务实现                                                     |
| `make e2e-m6-real-backend`                | **本窗口未重跑；最近记录为 1/1**                                                                                                      | M8 未改 browser REST/WS 实现                                             |
| `make e2e-m7-list`                        | **本窗口未单独运行**                                                                                                                  | 最近全量运行确认精确共享 inventory 为 25 files / 120 tests               |
| `make e2e-m7`                             | **本窗口未重跑；最近记录仍为 118/120**                                                                                                | batched-stream 协议不完整 + artifact transition 监听时序；均未伪写通过   |
| `make e2e-m7-local`                       | **本窗口未重跑；最近记录为 8/8**                                                                                                      | M8 未改交互实现                                                         |
| `make e2e-m7-auth`                        | **本窗口未重跑；最近记录为 7/7**                                                                                                      | M8 未改认证实现                                                         |
| `make e2e-m7-real-protocol`               | **1/1 通过**                                                                                                                          | 复用 replay Gateway 的 resume/gap/cancel 浏览器合同                      |
| `make e2e-auth`                           | **本窗口未重跑；最近记录为 2/2**                                                                                                      | 共享 setup-status recovery；不是全部认证语义                             |
| `cd frontend-vue && make container-smoke` | **本窗口未重跑；最近记录通过**                                                                                                        | M8 未改镜像或运行时依赖                                                 |
| `make dual-frontend-production-check`     | **本窗口未重跑；最近记录为 29/29**                                                                                                    | M8 未改 hostname、nginx 或 Compose                                      |
| `make e2e-m7-visual`                      | **本窗口未重跑；最近记录为 7/7**                                                                                                      | M8 没有视觉实现改动                                                     |
| `make asset-budget`                       | **本窗口未重跑；最近记录通过**                                                                                                        | M8 没有应用依赖或运行时加载图改动                                       |

## 6. M6 退出结论

React/Vue 页面、共享合同与 Gateway 调用链已逐项清点。M6 计划退出项 I1-I5、K4、K5、
N2，最近一次精确 8-spec/27-test 门禁和真实 Gateway browser 1/1 满足退出条件；本 M8
窗口没有重跑 M6 专项。M6 当时的
inventory、前置门禁、首轮失败、根因、修复和未扩大边界见
[M6 evidence](evidence/m6-remaining-l3.md)；该历史退出记录不能替代本窗口的 M8 风险门禁。

## 7. M7 收尾结论（带条件关闭）

- 实际全量运行精确执行 25 files / 120 tests，结果是 **118/120**，不是全绿。共享
  `artifact-batched-stream` 缺 `Content-Location` 和终止 `end`；共享 resize spec 在产品
  已自动打开 artifact 后才安装 `transitionrun` 监听。两项均已复现、交叉验证和登记治理
  触发条件，生产 fail-closed、自动打开和组件所有权未被削弱。
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
- A-N 已做本轮 group-level 复核；D8 CodeMirror 仍未安装/消费，不能把未来编辑器增强写成
  已完成。J/L/N 的真实 provider、公网部署与真实浏览器边界没有目标环境/凭据，保持 unrun。
- 仓库内业务正确性、安全、协议、生产路由、容器、视觉与预算硬退出项都有直接证据，因此
  M7 **带条件关闭**。条件是上述两个共享门禁治理例外保持可见，以及公网 Vue hostname
  只有在目标环境 DNS/TLS/外层代理/真实 IdP 清单通过后才能激活。不得写成 120/120，
  不得写成公网已验，也不得写成 Vue 已默认切换。
- 准确命令、两项根因、预算数字、未运行项与触发条件见
  [M7 收尾 evidence](evidence/m7-readiness-closure.md)。

## 8. M8 收尾结论

- L1 的唯一支持入口是 `@deerflow/agent-core` 根导出，合同版本为 `m8`；精确 value/type symbol
  snapshot、`exports`、`files: ["src"]`、private 状态与无框架/DeerFlow import 都有结构门禁。
- checked-in consumer 使用非 LangGraph `/sessions` wire，自带 message adapter、`RunProtocol`、
  reducer 和 fake fetch；`make consumer-check` 从真实 tarball 隔离安装并执行完整 session。
- L2 最终源码集合只含 `app/core/markdown/**`、`app/components/markdown/**`、
  `app/components/ui/button/**`、`app/lib/utils.ts`。chat/reasoning/tool/composer/human-input 的当前
  组件仍为 L3 host adapter；artifact/sidecar 只作为扩展方向参考。
- 六段式文件头守护现覆盖 154 个 maintained source，84 个 `COPIED` 按 provenance 跳过；本轮
  补齐缺失头，不改运行时业务逻辑。
- 本窗口所有 M8 风险门禁均通过；准确 API、L2/L3 边界、命令与异常见
  [M8 evidence](evidence/m8-reusable-contracts.md) 和 [复用指南](../frontend-vue/REUSE.md)。
- M8 **GO**。该结论仅批准仓库内复用合同收口，不批准 npm 发布、默认生产切流、真实公网
  部署、新功能、上游追新或 React 删除。

## 9. 后续边界

共享 fixture/spec 由其所有者按 evidence 的触发条件治理；公开激活 Vue hostname 时执行
目标环境清单。这两类后续不能通过修改 Vue 生产语义换绿。M8 已关闭；后续若要发布 npm、
抽出新的通用 UI 包、切换默认生产入口或接真实公网环境，必须另行授权和定义独立里程碑。
下一次开工仍须先运行 `make handoff-check`，并按实际改动风险重跑门禁。

## 10. 每次交接前必须做什么

1. 从仓库根目录运行 `make handoff-check`，不要只读上一次文字总结；
2. 运行与改动范围相称的门禁，记录“执行了什么”和“没有执行什么”；
3. 更新本文的日期、结果矩阵、当前执行游标和已知红项；
4. 新里程碑结论写入 `evidence/`，并明确它是历史快照；
5. 检查根 `AGENTS.md`、根 `README.md`、`frontend-vue/README.md` 是否仍指向本文；
6. 不得用旧 evidence 的通过结论覆盖当前失败 artifact。
