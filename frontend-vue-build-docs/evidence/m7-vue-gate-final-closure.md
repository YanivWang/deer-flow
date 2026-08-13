# M7 Vue 独立门禁最终收口与目标环境核验

> 采集日期：2026-08-13（Asia/Shanghai）。本文记录本轮实际命令与边界；后续 checkout
> 必须重新运行门禁，不能把本文当作永久通过证明。

## 1. 冷启动基线

按顺序执行并阅读了 `make handoff-check`、`git status --short`、
`git log -5 --oneline`、根 `AGENTS.md`、`frontend-vue/README.md`、document 10、
M7/M8 evidence 及失败 spec、fixture、生产路由和运行配置。起始工作树干净，HEAD 为：

```text
fa2cde27728635d55a5a45de929e3f41259db524
feat(frontend-vue): complete M8 reusable contracts
```

没有 reset、clean、checkout 覆盖或修改 `.env`。

## 2. 118/120 的根因与正确所有者

### 2.1 batched stream

历史共享 React fixture 返回了分批 tool-call delta，却没有真实 Gateway create 响应必需的
`Content-Location`，也没有 terminal `end`。Vue 的 `RunProtocol` 正确地 fail closed；在 Vue
产品代码伪造 header 或把缺 `end` 当成功都会破坏生产协议。

最终所有权是：React 保留并验证自己的 fixture；Vue M5/M7 使用
`frontend-vue/tests/m5/artifact-batched-stream.spec.ts`，fixture 明确提供真实 Gateway header
和 `end`。`playwright.m7.config.ts` 按完整路径选择 spec，避免同 basename 的 React/Vue 文件
被错误合并；本机和 CI 都固定 `retries: 0`，CI 使用两个 worker，不用重试掩盖竞态。
生产 fail-closed 没有放宽。

### 2.2 artifact opening transition

历史共享 resize spec 在导航完成、Vue 已正确自动打开 artifact 后才安装
`transitionrun` 监听。为等测试而加的 120 ms `artifactOpenTimer` 把正确产品行为变成时序补丁；
`WorkspacePanels` 还重复实现 splitpanes 已提供的 keyboard/ARIA，并动态注入 React
`data-slot`/`data-separator`、固定 280 ms 动画计时和 `flexGrow` 宽度钉扎。

最终所有权是：删除延迟自动打开与 DOM/动画兼容层；artifact 由归一化消息立即、去重地自动
打开；面板只使用 splitpanes 原生 size、keyboard 和 ARIA，并在真实 release 后持久化或折叠。
Vue 自有 `artifact-panel-resize.spec.ts` 验证拖拽、反向拖拽、折叠/重开、宽度保持、history
自动打开和原生键盘缩放。共享 `artifact-preview` 的媒体请求观察改为在产品动作前安装；共享
sidecar 门禁改验稳定最终状态（`scroll-behavior:auto`、无 transform 动画），不再用 React
事件次数代理 Vue 实现。没有取消 artifact 自动打开，没有 sleep、扩大 timeout、retry、skip
或产品延迟。

### 2.3 其余兼容层清理

Gateway wire `AIMessageChunk` 等类型原先一路泄漏到 UI，迫使 `AgentChat` 和 `MessageList`
各做一次重复兼容映射。现在 `message-adapt.ts` 在 protocol adapter 边界一次性产出可渲染
`Message`，`thread-runner.ts` 只向组件发布归一化消息，两个组件的双轨映射已删除。

对 Vue 中 timer、DOM selector、chunk mapping 和组件拆分历史做了全量模式审计。保留的 timer
均有产品/传输所有权（HTTP/auth timeout、SSE 合帧与 reconnect、channel poll、voice restart、
通知、copy feedback/confetti 或 fixture pacing）；Markdown 异步边界是实际 build graph/asset
预算决定；Button/dialog 的 `data-slot` 属于真实 UI library。没有为本轮再拆组件、叠 wrapper
或增加兼容分支。guard test 会阻止本次删除的 React DOM、固定动画 timer 和 chunk 双映射回流。

## 3. Vue 独立门禁

M7 inventory 仍精确为 25 files / 120 tests，但使用完整路径表达所有权：框架无关的产品合同
可复用 `frontend/tests/e2e/**`；batched stream 与 panel resize 使用 Vue spec。Makefile 只通过
`playwright.m7.config.ts` 执行这份 inventory，CI workflow 也直接运行 `make e2e-m7`。这不是
复制一套 React DOM 实现，也不是用 basename 碰撞强迫两个框架一致。

三次连续完整运行之间没有代码修改或插入其他测试：

| 开始时间 | 命令 | 结果 |
| --- | --- | --- |
| `2026-08-13T23:46:56+08:00` | `cd frontend-vue && make e2e-m7` | **25 files / 120 tests，120 passed (39.4s)** |
| `2026-08-13T23:47:46+08:00` | 同上 | **25 files / 120 tests，120 passed (38.2s)** |
| `2026-08-13T23:48:42+08:00` | 同上 | **25 files / 120 tests，120 passed (36.5s)** |

此前一次第三轮在测试启动前因受限环境拒绝监听 `127.0.0.1:3101`（`listen EPERM`）退出，
没有计入三连；随后在允许 loopback listener 的同一 checkout 从第 1 次重新计数。

## 4. 仓库验证结果

| 命令/范围 | 实测结果 |
| --- | --- |
| `cd frontend-vue && make verify` | **通过**；lint 0 errors/35 warnings，Vitest 108 files / 1095 tests，59 migrated files / 560 tests，type/build/i18n/OpenAPI/header/provenance 全通过 |
| `make migration-check` | **通过**；58 generated tests、24 `RETYPED` 与账本一致 |
| `make e2e-m4a` | **4/4** |
| `make e2e-m4a-stream` | **3/3**；chunked SSE、heartbeat、resume cursor/gap |
| `make e2e-m4b` | **11 files / 66 tests，66/66** |
| `make e2e-m5` | **6 files / 27 tests，27/27** |
| `make e2e-m5-real-backend` | **1/1** |
| `make e2e-m7-list` | **25 files / 120 tests** |
| `make e2e-m7-real-protocol` | **1/1**；create/resume/heartbeat/cancel/gap/recovery |
| `make e2e-real-backend` | 首轮 **2/3**；seed 后浏览器读取前置未被证明。增加同一 thread-global messages page 的 200/4-row setup 断言后，最终 **3/3** |
| `make asset-budget` | **通过**；CodeMirror 0；Vue 351.2/73.8 KiB、Markdown 956.0/290.7、UI 88.9/28.2、全 client JS 12836.5/2844.1（raw/gzip）均在各自 hard limit 内 |

共享所有者的 React 侧验证：修改后的 artifact preview + sidecar **17/17**；React 自有 batched
stream + resize/transition **7/7**；real-backend multi-run setup 修复 **1/1**。因此共享 spec
修复没有只让 Vue 变绿，也没有把 React 行为改成 Vue DOM。

## 5. 真实 provider 与目标环境

### 5.1 本机真实 provider（非公网证明）

本机 `config.yaml` 配置 MiniMax-M3，`.env` 有对应凭据。临时启动真实 FastAPI Gateway 后：

- 首次探针把 `recursion_limit` 人为设成 20；真实模型已经返回内容，但 run 以
  `GraphRecursionError` 结束，明确记为失败，不计通过；
- 按仓库文档默认 100 重跑：HTTP 200，真实 `Content-Location`，分块输出包含 `OK`，
  `error_events=0`、`end_events=1`，Gateway durable run 状态为 `success`；
- 两次均命中 `https://api.minimaxi.com/v1/chat/completions` 的 HTTP 200；
- 两条探针 thread 随后通过精确 `DELETE /api/threads/{id}` 删除，均返回 200；临时目录已删除。

这证明当前本机真实 model bootstrap/create/stream，不证明公网 hostname、TLS、LB、真实登录，
也不把 replay 的 resume/cancel/gap 冒充 provider 环境结果。

### 5.2 公网目标矩阵

仓库和本机只读检查没有找到可用的 Vue 公网 hostname：`.env` 未设置
`DEER_FLOW_VUE_HOSTNAME`，Compose 默认 `vue.localhost`，CORS 只有 localhost/127.0.0.1，
Helm 的 `deer-flow.example.com` 是示例且 chart 当前只部署 React frontend；`config.yaml`
没有 OIDC 配置。故不能负责任地发起 DNS/TLS/Chrome 登录验收。

| 项目 | 结果 | 缺少的外部资源/负责人动作 |
| --- | --- | --- |
| Vue secondary hostname 公网 DNS | **BLOCKED/UNRUN** | 运维提供实际 Vue hostname，并创建 A/AAAA 或受控 CNAME |
| TLS/SNI/HTTPS redirect/chain | **BLOCKED/UNRUN** | 运维/证书平台签发覆盖该 hostname 的受信证书并提供 443 endpoint |
| LB/CDN/反代 Host forwarding | **BLOCKED/UNRUN** | 平台负责人部署本 checkout，保留真实 Host、覆盖可信 `X-Forwarded-*` |
| `/api/**`、`/api/langgraph/**`、SSE no-buffer、WS Upgrade | **BLOCKED/UNRUN** | 需要上述公网 endpoint；仓库内 nginx 静态合同通过但不是外层链路证明 |
| 真实 IdP 登录/回跳/刷新/登出/双 host 隔离 | **BLOCKED/UNRUN** | IdP 管理员提供 client、两个精确 redirect URI；随后使用用户 Chrome 现有会话验收 |
| 真实目标 Gateway/provider create/stream/heartbeat/resume/cancel/gap | **BLOCKED/UNRUN** | 部署负责人提供目标 URL、测试账号/provider；本机 provider 和 replay 结果不能替代 |
| 第三方 Channel/OAuth | **BLOCKED/UNRUN** | 当前启动日志为 0/0 ready channels；需真实用户连接和 provider 授权 |
| scheduler daemon 实际触发 | **UNRUN（未启用）** | 当前 `scheduler.enabled: false`；启用并部署 daemon 后再创建一次性任务验收 |
| model bootstrap | **本机 GO；公网 BLOCKED** | 本机 MiniMax 成功；目标部署仍不存在 |
| browser runtime 长连接/长运行 | **BLOCKED/UNRUN** | 需要公网部署、可用 sandbox/browser capacity 与测试账号 |

目标资源到位后的最小只读/验收命令：

```bash
export VUE_HOST='vue.example.com'
export REACT_HOST='react.example.com'
dig +short A "$VUE_HOST"
dig +short AAAA "$VUE_HOST"
curl -sSIL "http://$VUE_HOST/"
openssl s_client -connect "$VUE_HOST:443" -servername "$VUE_HOST" -showcerts </dev/null
curl -sS -D - -o /dev/null "https://$VUE_HOST/"
curl -sS -D - -o /dev/null "https://$VUE_HOST/api/health"
curl -sS -N --max-time 90 "https://$VUE_HOST/api/langgraph/threads/<thread>/runs/<run>/stream"
```

WebSocket、OIDC 和真实 Agent run 需要目标账号/凭据；使用用户 Chrome 验证两个 hostname，
不能用无登录替代浏览器或 fixture IdP。

## 6. Warnings、失败与未运行

- `make verify`：35 个现有 lint warnings（void element self-closing、一个 stale disable），0 errors。
- Nuxt/Vite：默认 >500 kB chunk、plugin timing、Tailwind sourcemap、H3 unused import warnings；
  asset hard budgets 仍通过。
- Node：`NO_COLOR` 与 `FORCE_COLOR` 同设 warning。
- replay Gateway：auth disabled、GitHub webhook 未配置、测试 HMAC 16-byte、LangGraph unknown
  channel warning；均只属于本地/replay 环境。
- React mock：未 mock 的 token-usage/workspace-change 会代理到 8001 并产生 `ECONNREFUSED` warning，
  相关 17 项仍通过；不作为生产网络证据。
- `make doctor`：**失败**，因为本机未安装 native nginx；另报 `config.yaml` v31 < v32、
  web_capture 未配置。Docker nginx 路由合同与 provider probe 不受其替代性解释。
- 本轮没有重跑 M6 专项、fixture IdP/browser external gate、container smoke、visual gate；这些
  未被当前改动触及，且没有拿历史结果冒充本轮目标环境通过。

## 7. 终态边界

- 仓库内 M7：**GO**；两项历史治理例外已经由 Vue 独立所有权和正确共享观察时序真正关闭。
- 公网目标环境：**BLOCKED**，不是 GO，也不是失败断言。
- React 仍是 default/unknown Host 的默认生产前端；Vue 仅可由 secondary hostname 选择。
- 没有 npm publish、push、PR、React 删除、Vue 默认切流、CodeMirror、新 `agent-ui-kit`、
  上游追新或新功能扩展。
