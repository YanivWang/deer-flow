# M7 readiness 收尾证据

> 证据日期：2026-08-13
>
> 基线：`main-wc` / `aee8858b feat(frontend-vue): advance M7 production readiness`
>
> 结论：**M7 带条件关闭；M8 未开始。**

## 1. 结论与责任边界

当前 checkout 内可完成的 M7 业务正确性、安全、协议、双前端生产路由、容器、视觉和
资产预算退出项已有直接证据。Vue 继续 fail closed，React 继续是默认生产入口，Vue 只通过
次级 hostname 暴露；没有放松 auth、CSRF、OIDC、WebSocket、SSE 或 resume/gap/cancel
语义，也没有为门禁拆分 `ArtifactPanel`、重排依赖图或加入时序补丁。

M7 采用**带条件关闭**，不是 120/120 全绿：

1. 完整共享套件本轮是 **118/120**。两项红色均完成了代码、fixture、trace/screenshot 和
   真实 Gateway 交叉核对，归属共享门禁治理，不是 Vue 生产缺陷；原始失败必须保留可见。
2. 公网 DNS/TLS、外层 LB/CDN/WAF、真实 IdP/企业浏览器策略和真实 provider/channel 等
   没有目标环境或凭据，本轮标记 **unrun / target-environment blocked**。它们仍是公开激活
   Vue hostname 前的发布门禁，不能从本地 fixture 结果外推为通过。

除上述两类有记录的条件外，没有发现仍未实现的仓库内 M7 硬退出项。Vue 默认切流、正式
L2 契约收口、跨项目复用说明以及任何 M8 性能/架构工作均未开始。

## 2. 冷启动与范围核实

从仓库根目录执行：

```bash
make handoff-check
git status --short
git log -5 --oneline
```

结果：工作区干净；分支 `main-wc`；HEAD 为 `aee8858b`。随后完整读取根/模块指南、文档 10、
文档 06 的完整 M7 章节并在 M8 边界停止、文档 05/07、M7 三阶段 evidence 与双前端运维文档。
没有读取 M8 作为实现输入，也没有修改或读取凭据内容。

## 3. 两项共享红项的根因

### 3.1 `artifact-batched-stream`：fixture 协议不完整

`frontend/tests/e2e/artifact-batched-stream.spec.ts` 的测试服务器：

- 创建 run 的响应不发 `Content-Location`；
- 两秒后直接关闭响应，不发终止 `event: end`。

对照事实：

- 真实 Gateway `stream_run` 明确发 `Content-Location`；
- Gateway SSE 服务明确发终止 `end`；
- `frontend-vue/tests/m5/artifact-batched-stream.spec.ts` 只补齐这两个协议事实后 2/2 通过；
- Vue `run-protocol.ts` 只接受 `Content-Location`，缺失时 fail closed；
- `run-session.ts` 不把无 `end` 的意外 EOF 当作成功完成，而是进入恢复语义；
- 真实 Gateway 的 write-file artifact 门禁 1/1、resume/gap/cancel 门禁 1/1 均通过。

因此未修改只读共享 fixture，也未让 Vue 兼容错误协议。治理触发条件是共享 React fixture
由其所有者补齐真实 Gateway 的 `Content-Location` 与终止 `end`；届时重跑完整 M7 并移除
此例外。当前结果记录为失败并合理延后，**不是通过**。

### 3.2 `artifact-panel-resize`：监听安装晚于业务自动打开

`make e2e-m5` 连续运行三次，均为 **26/27**，相同失败是：

```text
frontend/tests/e2e/artifact-panel-resize.spec.ts:190
opening animates the width, dragging does not
expected transition properties to contain flex-grow; received []
```

trace/screenshot/视频帧显示 artifact 内容和面板状态正确。实际状态链是：tool-call 消息到达后，
`AgentChat.vue` 按产品行为自动打开 artifact；共享测试先等待 artifact 路径可见，之后才安装
`transitionrun` 监听，再点击该路径。六 worker 并行时自动打开已先发生，点击已打开项不会产生
第二次 opening transition，所以监听数组为空。单文件、单 worker、trace 开启时原测试 1/1
通过，说明断言受监听安装时机影响：

```bash
E2E_M5_PORT=3105 PLAYWRIGHT_BASE_URL=http://localhost:3105 \
node scripts/with-loopback-no-proxy.mjs -- \
python3 ../scripts/pnpm.py --dir frontend-vue exec playwright test \
  -c playwright.m5.config.ts \
  ../frontend/tests/e2e/artifact-panel-resize.spec.ts \
  --grep "opening animates" --workers=1 --trace=on
```

本轮没有延长 timeout、添加 sleep/retry/布尔锁、强制刷新、重复状态机，也没有继续拆
`ArtifactPanel`。产品证据包括本地协议正确 artifact 2/2、真实 Gateway artifact 1/1、截图中
面板正确自动打开，以及同套件其余 26 项通过。治理触发条件是共享 spec 在触发业务动作前
安装监听，或断言“已自动打开”和“从关闭到打开”两个合法初态；在共享所有者修订前保留红色。

## 4. 本窗口准确门禁结果

涉及构建的命令均串行执行。沙箱禁止 loopback 的首轮只记为未启动；允许本机回环后得到
以下完整结果：

| 命令                                           | 结果                                                            | 证据边界                                                                                  |
| ---------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `cd frontend-vue && make verify`               | **通过**；108 files / 1088 tests，59 migrated files / 560 tests | lint 0 errors（35 warnings）、format、types、unit、i18n 两份 751-key 字典、OpenAPI、build |
| `cd frontend-vue && make migration-check`      | **通过**                                                        | baseline/provenance、58 generated tests、24 `RETYPED`                                     |
| `cd frontend-vue && make e2e-m4b`              | **66/66 通过**                                                  | 精确 11 files                                                                             |
| `cd frontend-vue && make e2e-m5`               | **26/27，三次相同**                                             | `artifact-panel-resize` 监听时序红项；未伪写绿色                                          |
| M5 单文件单 worker trace                       | **1/1 通过**                                                    | 只用于根因定位，不替代完整 26/27                                                          |
| `cd frontend-vue && make e2e-m5-real-backend`  | **1/1 通过**                                                    | 真实回放 Gateway write_file → artifact                                                    |
| `cd frontend-vue && make e2e-m6`               | **27/27 通过**                                                  | 精确 8 files                                                                              |
| `cd frontend-vue && make e2e-m6-real-backend`  | **1/1 通过**                                                    | 真实 Gateway REST/WS → binary browser frame                                               |
| `cd frontend-vue && make e2e-m7`               | **118/120**                                                     | 精确 25 files；上述两项红色                                                               |
| `cd frontend-vue && make e2e-m7-local`         | **8/8 通过**                                                    | interaction、IME、a11y、H7/H8                                                             |
| `cd frontend-vue && make e2e-m7-auth`          | **7/7 通过**                                                    | auth request/storage/CSRF/OIDC 路由安全                                                   |
| `cd frontend-vue && make e2e-auth`             | **2/2 通过**                                                    | 共享 setup-status recovery                                                                |
| `cd frontend-vue && make e2e-real-backend`     | **3/3 通过**                                                    | auth-disabled、multi-run order、真实渲染                                                  |
| `cd frontend-vue && make e2e-m7-real-protocol` | **1/1 通过**                                                    | create/resume/gap/cancel/heartbeat                                                        |
| `cd frontend-vue && make e2e-external`         | **WS 1/1；OIDC 2/2 通过**                                       | 本地 browser runtime 与 fixture IdP；不代表真实 IdP                                       |
| `make dual-frontend-production-check`          | **29/29 通过**                                                  | React default、Vue hostname、共用 API/SSE/WS、headers、Compose cleanup                    |
| `cd frontend-vue && make container-smoke`      | **通过**                                                        | 构建镜像、non-root、health、最小输出、SIGTERM；根 Makefile 没有同名 target                |
| `cd frontend-vue && make e2e-m7-visual`        | **7/7 通过**                                                    | empty、streaming、reasoning/tool、artifact、settings、mobile、dark                        |
| `cd frontend-vue && make asset-budget`         | **通过**                                                        | 见下方准确预算值                                                                          |

资产结果：

| 分组                | chunks |         raw |       gzip |                       最大单块 |
| ------------------- | -----: | ----------: | ---------: | -----------------------------: |
| `vendor-vue`        |      9 |   351.2 KiB |   73.8 KiB |                      185.6 KiB |
| `vendor-markdown`   |      6 |   958.4 KiB |  291.5 KiB |                      322.9 KiB |
| `vendor-codemirror` |      0 |           0 |          0 |                              0 |
| `vendor-ui`         |      5 |    88.9 KiB |   28.2 KiB |                       44.3 KiB |
| all client JS       |    437 | 12839.0 KiB | 2844.9 KiB | 761.6 KiB raw / 224.7 KiB gzip |

默认 Vite `>500 kB` warning 保留可见；没有放宽 warning 或预算，也没有配置
`manualChunks`/`codeSplitting`。CodeMirror 仍未安装/消费，不能把未来 D8 编辑器增强写成完成。

本窗口没有因当前文档收尾改动重跑 `consumer-check`、M0、M4a、M4a-stream：没有改动 L1、
M0 基础设施或数据流代码，且 M7 共享/真实协议/构建门禁已经覆盖本轮风险。它们不是失败，
也不计为本窗口通过。

## 5. A–N 与生产边界复核

| 分类                | 复核结论                                                                                                                                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 硬退出项            | A–I、K、M 的当前业务/状态/协议实现由 verify、M4b/M5/M6、真实 Gateway 与 M7 local 直接覆盖；J 的 auth/CSRF/OIDC 请求安全、L 的 SSE/WS/resume/gap/cancel/fail-closed、H 的 splitpanes/context 均有直接门禁；生产路由保持 React default / Vue secondary。 |
| 当前阶段适用缺陷    | 两项共享红项已复现并定位；均未发现产品缺陷，因此没有生产代码结构性修复。`ArtifactPanel` 保持同步边界，`MessageList` 的异步 Markdown 保持真实业务加载边界。                                                                                             |
| 阶段不适用/环境边界 | D8 CodeMirror 预算为零，只证明未过早引入，不宣称未来编辑器增强；真实 provider/channel/scheduler/model/browser 长运行、真实浏览器权限、真实 IdP 和公网基础设施均不能由 hermetic/replay fixture 证明。                                                   |

## 6. 目标环境未运行项与触发条件

以下项目没有给定 public origin、DNS 区域、证书、外层代理配置、真实 IdP client/凭据或
第三方账号，因此没有使用用户 Chrome，也没有编造通过证据：

- 两个 hostname 的公网 DNS A/AAAA/CNAME、TLS 签发/续期与真实 HTTPS Cookie；
- 外层 LB/CDN/WAF 对 Host、`X-Forwarded-*`、SSE buffering/长连接 timeout、WS Upgrade、
  20 MiB body limit 的真实行为；
- 真实 IdP callback 白名单、同 provider 双 hostname 并发、第三方 Cookie 与企业策略；
- 真实 Chrome 权限弹窗、扩展/组织策略及 Chromium 之外的首帧字体/locale/视觉差异；
- 真实 provider、channel/OAuth、scheduler daemon、模型 bootstrap、browser 长运行。

触发条件：存在明确目标环境和授权凭据后，按
`docs/dual-frontend-production.md` 的激活清单执行；登录态或浏览器权限验证优先使用用户
Chrome。任何一项失败都阻止公开激活 Vue hostname，但不要求修改当前 fail-closed 协议。

## 7. 最终里程碑状态

- **M7：带条件关闭。** 仓库内硬退出能力 GO；共享套件的两个治理例外和目标环境发布门禁
  保持显式、可复现、不可被解释为通过。
- **默认生产入口：React。** Vue 仍是次级 hostname，没有切流。
- **M8：未开始。** 后续只有在用户另行授权时才能进入。
