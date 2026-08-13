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

- **已完成并有门禁证据：M-1、M0、M1、M2、M3、M4a。**
- **当前执行游标：进入 M4b 前置修复，然后实施 M4b 通用 Agent UI。**
- **还没有完成 M4b，也不是可替代 React 前端的产品 UI。** 当前 `/workspace/chats/new`
  是 M4a 数据流验证壳：文本输入、Send/Stop、纯文本消息列表；它不是完整聊天页。
- M5、M6、M7、M8 均未完成。Vue 前端仍不在默认 Docker/Nginx 生产入口中；双前端生产
  readiness 仍归 M7。
- **不采用百分比进度。** M4b 是组件和页面工作量的主体，剩余里程碑的复杂度不均匀；
  用“完成了 6/10 个编号”推导 60% 会明显高估实际产品完成度。

## 3. 当前代码已经具备什么

| 层/里程碑    | 当前代码事实                                                                                       | 不能扩大解释成                                    |
| ------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| M0 工程底座  | Nuxt 4 workspace、preview 代理与安全边界、认证/WS/OIDC/run-protocol 测试基础、独立 Makefile 命令面 | 产品页面完成、默认生产部署完成                    |
| M1 core 搬迁 | `app/core/` 已落地 84 个 `COPIED`、24 个 `RETYPED`；provenance、i18n、测试迁移账本有守护           | 所有 React core 已迁完或已被页面消费              |
| M2 L1 内核   | `packages/agent-core/` 是当前唯一独立 workspace 包；14 个源码文件、7 个测试文件、92 个测试         | L2 组件包已经存在                                 |
| M3 Markdown  | `StreamMarkdown` 管线及其 Markdown 合同测试已落地                                                  | 产品聊天页已经使用 Markdown 渲染                  |
| M4a 数据流   | `useThreadStream`、run/session/恢复/顺序语义和 M4a 浏览器门禁已落地                                | 线程侧栏、完整 composer、消息卡片已完成           |
| API 类型     | OpenAPI snapshot 与 `types.gen.ts` 生成一致性有门禁                                                | 生成类型已经接入所有 API 调用；当前没有业务消费者 |
| Vue 状态设施 | Pinia 与 vue-query 已安装并配置了基础设施                                                          | 已存在 Pinia store；当前源码中没有 `defineStore`  |

补充规模口径：当前 `frontend-vue/app/core/` 有 140 个 TypeScript 文件，这个总数包含
`COPIED`、`RETYPED`、`ADAPTED`、`ADDED` 等分类，不能写成“140 个原样搬运文件”。

## 4. 当前产品层明确缺什么

以下不是推测，而是当前页面、路由和消费链的实际缺口：

- `/workspace/chats/new` 仍是 M4a 验证壳，没有 React 合同要求的 `#chat` 标题、完整消息卡片、
  本地化 AI disclaimer、toast、自动滚动与 follow-up suggestions。
- `StreamMarkdown` 虽已实现并有测试，但当前产品页没有消费它。
- workspace layout、workspace 首页、登录/初始化/callback 页面仍以骨架或占位流程为主，
  完整已认证产品体验尚未接线。
- auth middleware 当前仍以未认证状态的骨架决策为主，不能据此声称完整登录态 UI 已迁移。
- 线程侧栏、history/search/pin/infinite scroll/virtual list 尚未交付。
- 完整 composer、草稿、附件、语音、slash skill、clarification、人类输入卡片尚未交付。
- reasoning、subtask、branch/edit/regenerate、suggestions 等高级 Agent 交互尚未交付。
- L2 仍是设计边界，没有独立 package；M4b/M5 必须边迁边抽，不能等所有页面完成后再抽。

## 5. 2026-08-13 实跑门禁矩阵

本表记录的是本次从当前 checkout 实跑或重新收集的结果。`passed` 只代表对应命令的
断言范围，不代表其他套件也通过。

| 命令/范围                                                                   | 当前结果                                                                                                 | 解释与边界                                                                          |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `make verify`                                                               | **通过**：100 files / 1055 tests；lint、format、typecheck、unit、build、provenance、i18n、OpenAPI 等通过 | 有非阻塞 warning：一处未使用 eslint-disable、Tailwind sourcemap/H3 build warning    |
| `make migration-check`                                                      | **通过**：provenance/test manifest 对账；58 个 codemod tests；24 个 `RETYPED`                            | 证明迁移账本一致，不证明业务 UI 完成                                                |
| `make consumer-check`                                                       | **通过**：pack、clean install、typecheck、最小 session                                                   | 只验证 `@deerflow/agent-core` 的独立消费者边界                                      |
| `make e2e-m0`                                                               | **14/14 通过**                                                                                           | M0 基础设施合同；不是共享业务合同                                                   |
| `make e2e-m4a`                                                              | **4/4 通过**                                                                                             | 合成数据流的 send/stream/stop/reload 顺序                                           |
| `make e2e-m4a-stream`                                                       | **3/3 通过**                                                                                             | 真分块 SSE、heartbeat、resume cursor、gap                                           |
| `make ws-smoke`                                                             | **通过**                                                                                                 | 浏览器 WebSocket 外部门禁                                                           |
| `NO_PROXY=127.0.0.1,localhost make oidc-smoke`                              | **通过**                                                                                                 | 本机开 VPN/系统代理时必须让 loopback 绕过代理；当前 Makefile 还没有固化这个环境保护 |
| `make e2e-list`                                                             | **收集成功**：25 files / 120 tests                                                                       | `--list` 只证明共享合同可收集，不能写成 120 tests passed                            |
| M4b 代表性共享合同                                                          | **1/3 通过**                                                                                             | new-chat 输入可见通过；本地化 disclaimer 失败；发送消息失败                         |
| `NO_PROXY=127.0.0.1,localhost E2E_FRONTEND_PORT=3101 make e2e-real-backend` | **2/3 通过**                                                                                             | auth-disabled 与多 run 顺序/history 通过；render 因产品 UI 缺失而失败               |

`make handoff-check` 当前会正确显示 `contracts: failed` 与
`full-real-backend: failed`。在这两项变绿前，任何文档都不得写“共享合同已通过”或
“真实后端完整套件已通过”。

### VPN/代理结论

VPN 不影响代码审计和纯本地单元测试，但**会影响本地 OIDC/HTTP fixture**：当前环境中的
Python `httpx` 会读取代理环境，把 `127.0.0.1` 请求错误地送进代理。直接访问 loopback
本身正常，给 `NO_PROXY=127.0.0.1,localhost` 后 OIDC 全流程通过。因此：

- 本地测试服务必须显式绕过代理；
- 不能把这类失败误判成 OIDC 实现回归；
- 也不能因为手工加环境变量后通过，就声称 Makefile 已经具备抗代理能力。

## 6. M4b 开工前的 P0 前置任务

这四项应先完成，否则后续失败会混合“测试基础设施问题”和“Vue UI 未实现”，难以定位。
本轮只整理文档，尚未修改对应代码。

1. **修共享 mock 的 run handle 合同。**
   `frontend/tests/e2e/utils/mock-api.ts::handleRunStream` 当前返回 SSE body，却不返回
   `Content-Location`。Vue 的 `RunProtocol` 按真实 Gateway 合同 fail closed，因此发送用例
   报错：`Gateway did not return a Content-Location for the new run.`。先给共享 mock 补真实
   Gateway 已提供的 header，并保持 React 合同继续通过。
2. **修 real-backend 的端口接线。**
   Vue Playwright config 默认启动 3101，但共享 real-backend spec 默认读取 3000；当前
   `make e2e-real-backend` 没有设置 `E2E_FRONTEND_PORT`。把 3101 在命令面固定下来，避免
   意外命中本机另一个 3000 服务并产生假失败/假通过。
3. **固化 loopback 代理绕过。**
   给本地 Gateway、fixture IdP、Playwright webServer 使用的命令明确传递/合并
   `NO_PROXY=127.0.0.1,localhost`，并补一个能暴露代理污染的回归检查。
4. **建立精确的 M4b Playwright project/命令。**
   不能靠测试名 substring 临时挑用例；要精确列出 M4b 的 11 个 spec，防止误收 sidecar
   或把“收集成功”当作“执行通过”。

## 7. M4b 实施顺序

### Slice 1：真实聊天页外壳

- 建立共享合同需要的页面结构、`#chat` 标题、本地化 disclaimer、toast 与滚动容器；
- 保留 M4a 已验证的数据流，不另起一套临时消息状态；
- 把 M4a 验证壳收敛到最终页面，不保留双入口兼容层。

### Slice 2：消息渲染与 Markdown 消费链

- 接入 `StreamMarkdown`、rich content slots、tool/reasoning/subtask message primitives；
- 用浏览器覆盖流式增量渲染、Mermaid、citation、代码块与消息分组；
- M3 的 renderer 在这里第一次成为真实产品消费者。

### Slice 3：Composer 与发送生命周期

- 完整实现 draft、send、stop、retry/error、plain-text user message；
- 补 slash skill、附件、voice、clarification/human-input 的组件合同；
- 保持 create POST、run handle、resume GET、cancel 的 M2/M4a 协议路径唯一。

### Slice 4：线程导航

- 线程列表、history/search/pin、infinite scroll、virtual list、初始化顺序；
- 这里开始兑现每 thread 的 Vue/Pinia adapter，并把通用状态边界抽入 L2；
- 不得把 DeerFlow endpoint、stream mode 或业务字段渗入 L1。

### Slice 5：高级 Agent 交互与收口

- branch、edit、regenerate、follow-up suggestions、reasoning/subtask 展示；
- 对照 [05-invariants.md](05-invariants.md) 的 M4b 条目逐项验收；
- 更新 L2 契约和豁免表，不能用临时兼容层绕过共享合同。

## 8. M4b 的硬退出条件

M4b 只有同时满足以下条件才可标记完成：

- 精确列出的 11 个共享 spec、当前 66 个 tests 全绿：
  `agent-chat`、`branch-thread`、`chat`、`chat-thread-init-ordering`、
  `streaming-reasoning-order`、`user-message-plain-text`、`thread-history`、
  `thread-history-mermaid`、`subtask-card`、`thread-list-infinite-scroll`、
  `thread-list-pin`；
- `make verify`、`make migration-check`、`make consumer-check`、`make e2e-m0`、
  `make e2e-m4a`、`make e2e-m4a-stream` 全部保持绿；
- 修正端口后的 `make e2e-real-backend` 3/3 全绿，不再依赖本机恰好运行的 3000 服务；
- K2/K3 等缺少共享 E2E 的行为有明确单测和人工验收记录；
- 新增 M4b evidence，记录命令、实测数量、红项和未验证边界；
- 本文、[README.md](README.md)、[06-migration-plan.md](06-migration-plan.md) 同步更新。

## 9. M4b 之后

顺序仍按冻结计划执行：M5 DeerFlow artifacts/tools → M6 sidecar/skills → M7 完整工作区、
认证与双前端生产验收 → M8 资产、性能、复用文档与最终收口。除非出现
[06-migration-plan.md](06-migration-plan.md) 定义的中止条件，不应跳过 M4b 先做 M7 外壳。

## 10. 每次交接前必须做什么

1. 从仓库根目录运行 `make handoff-check`，不要只读上一次文字总结；
2. 运行与改动范围相称的门禁，记录“执行了什么”和“没有执行什么”；
3. 更新本文的日期、结果矩阵、当前执行游标和已知红项；
4. 新里程碑结论写入 `evidence/`，并明确它是历史快照；
5. 检查根 `AGENTS.md`、根 `README.md`、`frontend-vue/README.md` 是否仍指向本文；
6. 不得用旧 evidence 的通过结论覆盖当前失败 artifact。
