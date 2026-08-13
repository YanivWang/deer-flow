# frontend-vue 当前状态与下一步

> 状态快照：2026-08-14。本文是续接 `frontend-vue` 时唯一的当前状态入口。历史 evidence
> 只说明当时发生过什么；新窗口必须先运行根目录 `make handoff-check`，再相信当前 checkout。

## 1. 当前结论

- **M-1 至 M8 的仓库内非可选实现均已关闭；M7 现为无仓库例外的 GO。**
- Vue 自有 M7 inventory 精确为 **25 files / 120 tests**，已在同一 checkout 连续三次
  **120/120**。框架无关的产品合同可复用 React spec；框架特定的 batched-stream 和
  splitpanes/artifact panel 行为由 Vue spec 拥有，不再用 React DOM、动画事件或 basename
  碰撞约束 Vue 实现。
- `origin/main@e4a7a047` 新增 React Browser Live、Lark、showcase 等行为后，旧共享收集会
  漂到 130。Vue 没有把期望值强改成 130，也没有叠产品兼容层；agent-chat、channels、
  integrations、thread-history 已冻结为 Vue 自有 spec，React 后续功能按显式迁移决定是否进入。
- 历史 118/120 的两项治理例外已经真正关闭：协议不完整的 batched fixture 不再进入 Vue
  门禁；artifact transition 观察在产品动作前安装，或直接验证稳定最终产品状态。Vue 的
  production fail-closed 和正确自动打开均未削弱。
- M8 继续冻结 private `@deerflow/agent-core` 根 API、最小 L2 Markdown/Button 源码边界、
  隔离 custom-backend consumer 与 L3 replacement guide；没有 npm publish。
- 生产入口仍是 **React default / Vue secondary hostname**。公网 Vue hostname、DNS/TLS、
  外层 LB/CDN、真实 IdP 和目标 runtime 验证按用户明确要求不在本轮执行，状态为 **UNRUN**，
  不是 GO，也不阻塞本次仓库合并。

完整根因、命令、三连时间、warnings 和目标环境矩阵见
[M7 Vue 最终收口 evidence](evidence/m7-vue-gate-final-closure.md)。

## 2. 代码与测试所有权

| 范围 | 当前所有权 | 禁止回流的做法 |
| --- | --- | --- |
| Run wire → UI message | `message-adapt.ts`/`thread-runner.ts` 在边界一次归一化 | 在 `AgentChat`、`MessageList` 重复识别 `AIMessageChunk` |
| Artifact 自动打开 | `AgentChat` 由归一化消息同步派生并按 thread/target 去重 | 为等测试加固定 timer、延迟正确产品行为 |
| Workspace panel | splitpanes 原生 size/keyboard/ARIA；release 后持久化/折叠 | 注入 React `data-slot`/`data-separator`、复制 keyboard、固定动画 timer、`flexGrow` 钉宽 |
| Batched stream | Vue protocol-complete fixture/spec | 在产品代码伪造 `Content-Location`/`end`，或接受不完整成功流 |
| Framework-neutral behavior | 可复用 `frontend/tests/e2e/**` | 要求 Vue 复刻 React DOM/transition event 次数 |
| Vue release behavior | `frontend-vue/tests/m7/**` 冻结 Vue 当前范围 | React 新功能自动扩大 Vue 门禁、为对齐而堆兼容层 |
| M7 inventory | 完整路径清单 + `playwright.m7.config.ts` | 仅用 basename 让 React/Vue 同名 spec 碰撞 |

`tests/guards/e2e-command-contract.test.ts` 固定上述边界；CI 的
`frontend-vue-verify.yml` 直接执行 `make e2e-m7`。

## 3. 当前功能边界

Vue 已接现有 Gateway 的 chat/thread/run/stream、history、reasoning/tool/subtask、human input、
artifacts/workspace changes/sidecar、settings、browser、agents、channels、scheduled tasks、
goal/mode/mobile、auth/CSRF/OIDC request path。只有一套 run/thread/stream 状态机。

L1/L2/L3 边界保持：

- L1：private `@deerflow/agent-core`，框架和 DeerFlow wire 无关；
- L2：Markdown、Button、`app/lib/utils.ts` 最小源码集合；
- L3：DeerFlow chat/artifact/sidecar/browser/settings 等 host adapter；不伪装成通用 UI kit。

当前 `app/core/` 规模包含 `COPIED`、`RETYPED`、`ADAPTED`、`ADDED`，不能把总文件数写成
“原样搬运数”。M1 provenance、generated tests、type budget、headers 和 OpenAPI snapshot
仍是各自事实来源。

## 4. 2026-08-14 当前 checkout 实跑矩阵

| 命令/范围 | 当前结果 | 边界 |
| --- | --- | --- |
| `make verify` | **通过**；108 files / 1095 tests；lint 0 errors/35 warnings | unit/type/build/i18n/OpenAPI/header/provenance |
| `make migration-check` | **通过**；58 generated tests、24 `RETYPED` | 迁移账本，不是 E2E |
| `make e2e-m4a` | **4/4** | send/stream/stop/reload |
| `make e2e-m4a-stream` | **3/3** | chunked SSE、heartbeat、resume cursor/gap |
| `make e2e-m4b` | **11 files / 66 tests，66/66** | 通用 Agent UI |
| `make e2e-m5` | **6 files / 27 tests，27/27** | Vue 自有 batched/panel spec + framework-neutral artifact/sidecar |
| `make e2e-m5-real-backend` | **1/1** | replay Gateway write-file artifact |
| `make e2e-m7-list` | **25 files / 120 tests** | 精确完整路径 inventory |
| `make e2e-m7` | **120/120 × 3 连续** | 合并 `origin/main@e4a7a047` 后 36.5s、36.9s、36.7s；0 retries |
| `make e2e-m7-real-protocol` | **1/1** | create/resume/heartbeat/cancel/gap/recovery |
| `make e2e-real-backend` | **3/3** | auth-disabled、multi-run order、real render |
| `make asset-budget` | **通过**；CodeMirror 0 | build graph raw/gzip hard budgets |

本次 main 合并的 React 侧回归：`pnpm check` 通过；Vitest **128 files / 1001 tests**；
agent-chat/channels/integrations/thread-history Playwright **40/40**。更早的 artifact preview +
sidecar **17/17**、React 自有 batched + resize/transition **7/7** 和 real-backend multi-run
**1/1** 仍保留为历史修复证据。

未在本轮重跑：M6 专项、fixture IdP/browser `e2e-external`、container smoke、七状态 visual。
它们未被当前代码范围修改，也没有被拿来冒充公网目标环境结果。

## 5. 真实运行环境结论

本机真实 MiniMax-M3 最小 Gateway run 已成功：HTTP 200、真实 `Content-Location`、分块输出、
0 error、1 end、durable success；探针数据已删除。这只证明本机 model bootstrap/create/stream。

公网目标 **UNRUN（用户明确排除本轮）**：

- `.env` 没有 `DEER_FLOW_VUE_HOSTNAME`，Compose 只有默认 `vue.localhost`；
- CORS 只列 localhost/127.0.0.1；
- Helm `deer-flow.example.com` 是示例，且当前 chart 只部署 React frontend；
- `config.yaml` 没有 OIDC，scheduler disabled，启动时 0/0 ready channels；
- 因无实际域名/endpoint/账号，DNS、TLS/SNI/证书链、HTTPS redirect、LB Host、外层 SSE
  buffering、WS Upgrade、真实 IdP、目标 Gateway/provider、Channel/OAuth、scheduler trigger、
  browser 长运行均为 UNRUN。

本轮不执行这些公网检查，也不以 fixture、replay、localhost、自签名或无登录浏览器替代。
若将来单独激活，仍须用用户 Chrome 的现有登录态完成双 hostname 登录/回跳/刷新/登出。

## 6. 已知 warnings 与非通过项

- verify 35 lint warnings，0 errors；Nuxt/Vite 仍有大 chunk、plugin timing、Tailwind sourcemap、
  H3 unused import warning；asset hard budgets 通过。
- 受限沙箱曾在测试启动前报 `listen EPERM`；不计入三连，允许 loopback 后从 0 重跑三次。
- real-backend 首轮 multi-run 2/3；加入 seed 后同一 thread-global page 的 200/4-row 前置断言后
  最终 3/3。没有 sleep、retry 或扩大 timeout。
- 本机 `make doctor` 非绿：native nginx 未安装，`config.yaml` v31 < v32，web_capture 未配置；
  provider 本身配置并可用。没有修改用户 config 或 `.env`。

## 7. 下一步与禁止扩大解释

仓库内没有剩余必做迁移任务。公网目标环境已被用户明确排除本轮，保持 UNRUN，不能用仓库
fixture“补证明”。

未经独立授权不得：把 Vue 切成默认前端、删除 React、npm publish、push/PR、创建
`agent-ui-kit`、增加 CodeMirror、追新上游或开发新功能。下一窗口仍从
`make handoff-check`、当前 checkout 和本文件开始。
