# frontend-vue 当前状态与下一步

> 状态快照：2026-08-14。本文是续接 `frontend-vue` 时唯一的当前状态入口。历史 evidence
> 只说明当时发生过什么；新窗口必须先运行根目录 `make handoff-check`，再相信当前 checkout。

## 1. 当前结论

- **M-1 至 M8 的仓库内非可选实现均已关闭；M7 现为无仓库例外的 GO。**
- Vue 自有 M7 inventory 精确为 **25 files / 130 tests**，已在同一 checkout 连续三次
  **130/130**。框架无关的产品合同可复用 React spec；框架特定的 batched-stream 和
  splitpanes/artifact panel 行为由 Vue spec 拥有，不再用 React DOM、动画事件或 basename
  碰撞约束 Vue 实现。
- 合并提交 `44832a5e` 带入的 React Browser Live、Lark app 切换、Buzz、public Showcase
  和同 run 重连排序已逐项显式迁入 Vue，并增加 10 个 Vue-owned 浏览器合同；不是把 React
  DOM spec 强塞给 Vue。Chat page/provider 拆分、`nanoid` 补丁与 OpenViking 英文文档没有可迁移
  的 Vue 产品语义，已审计但未制造对应兼容层。
- 历史 118/120 的两项治理例外已经真正关闭：协议不完整的 batched fixture 不再进入 Vue
  门禁；artifact transition 观察在产品动作前安装，或直接验证稳定最终产品状态。Vue 的
  production fail-closed 和正确自动打开均未削弱。
- M8 继续冻结 private `@deerflow/agent-core` 根 API、最小 L2 Markdown/Button 源码边界、
  隔离 custom-backend consumer 与 L3 replacement guide；没有 npm publish。
- 生产入口仍是 **React default / Vue secondary hostname**。公网 Vue hostname、DNS/TLS、
  外层 LB/CDN、真实 IdP 和目标 runtime 验证按用户明确要求不在本轮执行，状态为 **UNRUN**，
  不是 GO，也不阻塞本次仓库合并。

本轮逐项映射、命令、三连时间、warnings 和目标环境边界见
[React parity 收口 evidence](evidence/react-parity-closure-2026-08-14.md)。历史 118/120 根因见
[M7 Vue 最终收口 evidence](evidence/m7-vue-gate-final-closure.md)。

## 2. 代码与测试所有权

| 范围 | 当前所有权 | 禁止回流的做法 |
| --- | --- | --- |
| Run wire → UI message | `message-adapt.ts`/`thread-runner.ts` 在边界一次归一化 | 在 `AgentChat`、`MessageList` 重复识别 `AIMessageChunk` |
| Artifact 自动打开 | `AgentChat` 由归一化消息同步派生并按 thread/target 去重 | 为等测试加固定 timer、延迟正确产品行为 |
| Workspace panel | splitpanes 原生 size/keyboard/ARIA；release 后持久化/折叠 | 注入 React `data-slot`/`data-separator`、复制 keyboard、固定动画 timer、`flexGrow` 钉宽 |
| Batched stream | Vue protocol-complete fixture/spec | 在产品代码伪造 `Content-Location`/`end`，或接受不完整成功流 |
| Framework-neutral behavior | 可复用 `frontend/tests/e2e/**` | 要求 Vue 复刻 React DOM/transition event 次数 |
| Vue release behavior | `frontend-vue/tests/m7/**` 显式承接已迁移功能 | React 新功能自动扩大 Vue 门禁、为对齐而堆兼容层 |
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
| `make verify` | **通过**；110 files / 1101 tests；lint 0 errors/38 warnings | unit/type/build/i18n/OpenAPI/header/provenance |
| `make migration-check` | **通过**；58 generated tests、24 `RETYPED` | 迁移账本，不是 E2E |
| `make e2e-m4a` | **4/4** | send/stream/stop/reload |
| `make e2e-m4a-stream` | **3/3** | chunked SSE、heartbeat、resume cursor/gap |
| `make e2e-m4b` | **11 files / 73 tests，73/73** | 当前共享通用 Agent UI |
| `make e2e-m5` | **6 files / 27 tests，27/27** | Vue 自有 batched/panel spec + framework-neutral artifact/sidecar |
| `make e2e-m5-real-backend` | **1/1** | replay Gateway write-file artifact |
| `make e2e-m6` | **8 files / 30 tests，30/30** | Integrations 使用 Vue-owned spec；其余框架无关合同共享 |
| `make e2e-m6-real-backend` | **1/1** | Gateway browser REST/WS → binary frame |
| `make e2e-m7-list` | **25 files / 130 tests** | 精确完整路径 inventory |
| `make e2e-m7` | **130/130 × 3 连续** | 移除新增显式 timeout 后 33.7s、33.8s、33.7s；0 retries |
| `make e2e-m7-real-protocol` | **1/1** | create/resume/heartbeat/cancel/gap/recovery |
| `make e2e-real-backend` | **3/3** | auth-disabled、multi-run order、real render |
| `make asset-budget` | **通过**；CodeMirror 0；vendor-ui max 46.7 KiB | Integrations 按需加载后通过原预算 |

本次 main 合并的 React 来源侧回归：`pnpm check` 通过；相关 Rstest **6 files / 115 tests**；
agent-chat/channels/integrations/thread-history Playwright **40/40**。更早的 artifact preview +
sidecar **17/17**、React 自有 batched + resize/transition **7/7** 和 real-backend multi-run
**1/1** 仍保留为历史修复证据。

未在本轮重跑：fixture IdP/browser `e2e-external`、container smoke、七状态 visual。它们未被
当前代码范围修改，也没有被拿来冒充公网目标环境结果。

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

- verify 38 lint warnings，0 errors；Nuxt/Vite 仍有大 chunk、plugin timing、Tailwind sourcemap、
  H3 unused import warning；asset hard budgets 通过。
- 受限沙箱曾在 verify/M6 启动前报 `listen EPERM`；不计入产品失败，允许 loopback 后从 0
  重跑。M6 初次仍引用 React Integrations 文本定位，两个合法同文案节点导致 strict-mode
  失败；切换到等价 Vue-owned 6-test spec 后 30/30。没有删产品状态、sleep、retry 或扩大 timeout。
- 最终 verify 首轮发现 M6 guard 仍写死 27；同步守卫到 30 并明确排除 React Integrations
  spec 后完整 1101/1101 通过。
- 资产首次为 `vendor-ui.maxRaw 62388 > 60000`；没有调预算，改为按需加载 Integrations，最终
  max 46.7 KiB。
- 本机 `make doctor` 非绿：native nginx 未安装，`config.yaml` v31 < v32，web_capture 未配置；
  provider 本身配置并可用。没有修改用户 config 或 `.env`。

## 7. 下一步与禁止扩大解释

仓库内没有剩余必做迁移任务。公网目标环境已被用户明确排除本轮，保持 UNRUN，不能用仓库
fixture“补证明”。

未经独立授权不得：把 Vue 切成默认前端、删除 React、npm publish、push/PR、创建
`agent-ui-kit`、增加 CodeMirror、追新上游或开发新功能。下一窗口仍从
`make handoff-check`、当前 checkout 和本文件开始。
