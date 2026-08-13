# React/Vue 最终门禁收口（2026-08-14）

## 1. 冷启动基线与范围

本轮从当前 checkout 重新验证，没有把旧窗口总结当成事实：

- 分支：`main-wc`；冷启动 HEAD：`b4652555 feat(frontend-vue): align latest React product behavior`；
- `make handoff-check`、`git status --short`、`git log -5 --oneline` 依次执行；工作树起始干净；
- 重新阅读根 `AGENTS.md`、`frontend/AGENTS.md`、`frontend-vue/README.md`、当前状态文档、
  M7/M8 与 main 合并/React parity evidence，以及直接相关 fixture、spec、路由和容器配置；
- 保留 React 默认生产入口和 Vue secondary hostname；没有改动 `.env`；
- 公网目标环境由用户明确排除，以下 localhost/fixture/replay 结果不冒充公网验证。

## 2. 118/120 历史问题与正确所有者

历史两项失败不是 Vue 产品缺陷：

1. React batched-stream fixture 缺 Gateway 成功流必须携带的 `Content-Location` 和终止 `end`。
   Vue production 继续 fail closed，不在产品代码补造字段；协议完整的 Vue fixture/spec 由 Vue
   自有门禁负责。
2. React artifact transition spec 在产品已经正确自动打开后才安装 `transitionrun` 监听。
   Vue 不延迟自动打开来等待测试；Vue spec 在动作前观察，或验证稳定最终 panel 状态。

框架无关合同仍复用 React spec；React DOM、transition 事件次数、splitpanes 内部结构和 basename
碰撞不再作为 Vue 门禁。最新 React 功能只有在 Vue 产品语义显式实现并由 Vue-owned spec 覆盖后
才进入 inventory。当前 inventory 因 Browser Live、Lark、Buzz、Showcase 等合同为 25 files /
130 tests；这不是修改数字掩盖旧失败，而是独立 Vue 门禁的事实清单。

## 3. 本轮补强

- `frontend-vue/tests/unit/vue/showcase.test.ts` 现在从 React 的共享静态 demo fixture 目录读取
  13 个真实 thread，并逐文件核对 Vue thread allowlist 和 artifact manifest。React 新增或删除
  Showcase fixture 时，Vue 不会静默漏打包。
- `frontend-vue/scripts/container-smoke.sh` 除 non-root、health、最小产物与 SIGTERM 外，新增生产
  镜像内 Showcase JSON/HTML/image 存在性、实际 HTTP 可读性、artifact redirect，以及 unknown
  demo、未列名 artifact、编码 traversal 必须 404 的验证。
- 容器脚本最初用 `curl | grep -q`，在 `pipefail` 下因 grep 提前退出令大 JSON 的 curl 收到 broken
  pipe（exit 23）。改为让 grep 消费完整输入；没有 sleep、retry、扩大 timeout 或产品兼容层。

这些修改只加固测试所有权和生产镜像验收，没有修改 React/Vue 产品逻辑、provider/runtime 语义，
也没有削弱 artifact 自动打开或 Gateway 协议校验。

## 4. Vue 最终验证

| 命令 | 结果 |
| --- | --- |
| `cd frontend-vue && make verify` | PASS；110 files / 1102 tests；lint 0 errors / 38 warnings；type/build/i18n/OpenAPI/header/provenance 通过 |
| `cd frontend-vue && make migration-check` | PASS；58 generated tests、24 `RETYPED` |
| `cd frontend-vue && make e2e-m0` | PASS；proxy 7/7、OPTIONS 2/2、auth-disabled 1/1、visual seed 1/1、splitpanes 1/1、auth-cookie 1/1、run-protocol 1/1 |
| `cd frontend-vue && make e2e-m4a` | PASS 4/4 |
| `cd frontend-vue && make e2e-m4a-stream` | PASS 3/3 |
| `cd frontend-vue && make e2e-m4b` | PASS 11 files / 73 tests |
| `cd frontend-vue && make e2e-m5` | PASS 6 files / 27 tests |
| `cd frontend-vue && make e2e-m5-real-backend` | PASS 1/1 |
| `cd frontend-vue && make e2e-m6` | PASS 8 files / 30 tests |
| `cd frontend-vue && make e2e-m6-real-backend` | PASS 1/1 binary browser frame |
| `cd frontend-vue && make e2e-m7-list` | PASS；精确 25 files / 130 tests |
| `cd frontend-vue && make e2e-m7-local` | PASS 8/8 |
| `cd frontend-vue && make e2e-m7-auth` | PASS 7/7 |
| `cd frontend-vue && make e2e-m7-real-protocol` | PASS 1/1 create/resume/heartbeat/cancel/gap/recovery |
| `cd frontend-vue && make e2e-real-backend` | PASS 3/3 |
| `cd frontend-vue && make e2e-m7-visual` | PASS 7/7；既有 baseline 未变化 |
| `cd frontend-vue && make e2e-external` | PASS；browser WS 1/1、fixture IdP OIDC 2/2；仅 hermetic 环境 |
| `cd frontend-vue && make asset-budget` | PASS；CodeMirror 0；vendor-ui raw 91.4 KiB / gzip 29.9 KiB / max 46.7 KiB |
| `cd frontend-vue && make container-smoke` | PASS；含生产镜像 Showcase 正/负路径、non-root、health、SIGTERM |
| `make dual-frontend-production-check` | PASS 30/30；React default / Vue secondary 合同保持 |

同一代码 checkout、默认 6 workers、`retries: 0` 的三次连续完整 M7：

1. `2026-08-14T05:48:33+08:00` 开始：25 files / 130 tests，130 passed，50.4s；
2. `2026-08-14T05:49:36+08:00` 开始：25 files / 130 tests，130 passed，49.9s；
3. `2026-08-14T05:50:39+08:00` 开始：25 files / 130 tests，130 passed，53.1s。

三次均无 failure、skip、retry；M7 仓库结论为 **GO**。

## 5. React 来源侧验证

- `python3 scripts/pnpm.py --dir frontend check`：PASS；
- message merge、static demo、thread utils、Lark API、channel provider icon DOM、i18n
  translations：Rstest **6 files / 115 tests，115/115**；
- `agent-chat.spec.ts`、`channels.spec.ts`、`integrations.spec.ts`、`thread-history.spec.ts`：
  Playwright **40/40**（49.2s）。

React mock Playwright 没启动 Gateway，token usage、workspace changes、browser stream 的可选代理请求
打印 `127.0.0.1:8001 ECONNREFUSED`；40 个合同仍全部通过，此日志没有被写成真实 Gateway 通过。
本轮未修改 React 产品代码。

## 6. Warnings、失败重跑与未执行

- 受限沙箱第一次运行 verify/Rstest/M7-local/real-backend 等本机服务时出现 `listen EPERM` 或
  uv cache `Operation not permitted`；授予回环端口/本机缓存权限后，完全相同命令从头通过。
- Nuxt/Vite 保留既有 large chunk、plugin timing、Tailwind sourcemap、H3 unused import；verify
  保留 38 lint warnings、0 errors。replay Gateway 保留测试短 HMAC key、GitHub webhook 未配置和
  auth-disabled 警告。Docker 构建保留慢 tarball、pnpm 更新和 ignored build scripts 提示。
- 公网 DNS、TLS/SNI/证书链、HTTPS redirect、LB/CDN Host、SSE buffering、WS Upgrade、真实
  IdP/provider、Channel OAuth、scheduler、模型 bootstrap 和 browser 长运行：**UNRUN，用户明确
  排除本轮**。没有用 fixture、replay、localhost 或自签名环境伪写通过。

## 7. 交付边界

- React 仍是默认生产前端；Vue 仍仅由 secondary hostname 选择；
- 没有 npm publish、默认切流、删除 React、创建 `agent-ui-kit`、增加 CodeMirror 或开发新功能；
- 没有 push、PR；仅创建本地提交；
- 仓库内非可选任务完成，公网目标环境保持用户排除的 UNRUN。
