# React 最新合并到 Vue 的逐项对齐证据（2026-08-14）

## 1. 冷启动基线与范围

- 仓库：`/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow`
- 分支：`main-wc`
- 起始 HEAD：`44832a5e732de5a078773a399b3555c507c43497`，`Merge origin/main into main-wc`
- merge parents：`fea229c2`（Vue M7 收口）+ `e4a7a047`（最新 main）
- `44832a5e^1..44832a5e` 中 `frontend/` 共 42 个变更文件。
- 开始时依次执行并阅读了 `make handoff-check`、`git status --short`、
  `git log -5 --oneline`、根 `AGENTS.md`、`frontend-vue/README.md`、document 10、M7/M8
  evidence，以及下列功能对应的 React/Vue 源码、fixture、路由和测试。
- 起始工作树干净；整个过程没有 reset、clean、checkout 覆盖，也没有读取、删除或修改 `.env`。
- 用户随后明确排除公网目标环境，本证据只覆盖仓库和本机真实 Gateway 门禁。

## 2. React 变更逐项结论

| React 增量 | React 行为来源 | Vue 对齐与所有者 | 验证 |
| --- | --- | --- | --- |
| 同 run 重连消息排序 | thread hooks/merge 单测 | `local-turn-order.ts` 只在无本地 baseline 的 reconnect 中，以 same-run 或 runless sandwich 证据恢复顺序；不重排已完成/无关历史 | Vue unit + real-backend multi-run；React Rstest |
| Public Showcase | `/showcase/[thread_id]`、13 个 demo、静态 artifact | Vue `showcase` layout/page/shared allowlist/Nitro artifact redirect；未知 thread、未列 artifact 和 traversal 均 404；demo 只读且不访问生产 thread/run API | Vue unit + M7 thread-history |
| Custom Agent Browser Live | 已有 thread、feature enabled、非 mock；tool groups unrestricted 或包含 browser | `AgentChat` 获取 agent metadata 后按同一产品条件决定 Browser；新 thread、mock、feature off、非 browser tool group 均隐藏 | Vue M7 6 个 Browser cases + M6 real browser |
| Lark/Feishu app 切换 | install/config/auth generations、credentials switch、retained permissions | Vue-owned `core/integrations/lark/flow.ts` 与 `IntegrationsSettings.vue`；AbortController + generation 防陈旧完成；仅后端 504 在授权期限内轮询 | Vue M7 integrations 6/6 + unit/type/build |
| Buzz channel | label、icon、连接文案 | Vue channel source label、Apache-licensed Buzz icon、provider icon 和 settings copy | Vue unit + M7 channels |
| Chat page/providers 拆分 | React 组件边界重构 | Vue 原有 reusable `AgentChat` 已具相同职责边界，无产品语义需要复制 | 源码审计；未制造空壳兼容层 |
| `nanoid` 修补 | React dependency/工具链 | Vue 没有对应运行时缺口 | 审计，未迁入无关依赖 |
| OpenViking 英文文档 | React/项目文档 | 无 Vue UI 或 Gateway 合同变化 | 审计，不制造功能 |

Showcase 静态资源仍由 React 仓库中的签入 demo/image 作为单一内容源，Vue build 只显式挂载/复制；
Vue 没有复制第二份 demo 数据。生产 artifact URL 继续走 Gateway，只有显式 `isMock` 才能使用
`/mock/api/...`，因此没有在 Vue 产品代码伪造 Gateway 协议字段。

## 3. 架构清理与独立门禁

- M7 使用完整路径 inventory。框架无关 spec 继续共享；agent-chat、channels、integrations、
  thread-history、batched-stream、splitpanes/artifact panel 使用 Vue-owned spec。
- M4b 的最新共享合同事实为 11 files / 73 tests；M6 将 React Integrations DOM spec 替换为
  等价 Vue-owned 6-test spec，最终为 8 files / 30 tests。
- 没有把 React `data-slot`、separator DOM、transition 次数或组件拆分方式移植到 Vue。
- 没有添加 sleep、扩大 timeout、Playwright retry、条件跳过、豁免或产品等待测试的时序补丁。
- Artifact 仍会在产品状态满足时立即自动打开；测试在动作前观察或验证稳定最终状态。
- Vue production streaming 仍要求真实 `Content-Location` 和终止 `end`，fail-closed 未削弱。
- Integrations 面板改为 Vue `defineAsyncComponent` 按需加载。资产门禁首次测得
  `vendor-ui.maxRaw 62388 > 60000`；没有提高预算，拆分后 max 为 46.7 KiB。

历史 118/120 两项治理例外保持真正关闭：不完整 batched fixture 已由 Vue protocol-complete
fixture/spec 取代；Artifact transition 不再要求产品延迟正确自动打开等待监听器。

## 4. Vue 验证结果

| 命令 | 结果 |
| --- | --- |
| `cd frontend-vue && make verify` | PASS；110 files / 1101 tests；lint 0 errors / 38 warnings；build PASS |
| `cd frontend-vue && make migration-check` | PASS；58 generated tests；24 RETYPED |
| `cd frontend-vue && make e2e-m4a` | PASS 4/4 |
| `cd frontend-vue && make e2e-m4a-stream` | PASS 3/3 |
| `cd frontend-vue && make e2e-m4b` | PASS 11 files / 73 tests |
| `cd frontend-vue && make e2e-m5` | PASS 6 files / 27 tests |
| `cd frontend-vue && make e2e-m5-real-backend` | PASS 1/1 |
| `cd frontend-vue && make e2e-m6` | PASS 8 files / 30 tests |
| `cd frontend-vue && make e2e-m6-real-backend` | PASS 1/1 binary browser frame |
| `cd frontend-vue && make e2e-m7-list` | PASS，精确 25 files / 130 tests |
| `cd frontend-vue && make e2e-m7-real-protocol` | PASS 1/1 create/resume/heartbeat/cancel/gap/recovery |
| `cd frontend-vue && make e2e-real-backend` | PASS 3/3 |
| `cd frontend-vue && make asset-budget` | PASS；vendor-ui raw 91.4 KiB / gzip 29.9 KiB / max 46.7 KiB；CodeMirror 0 |

完整 M7 在同一 checkout、默认并行、`retries: 0` 下连续运行：

1. 25 files / 130 tests，130 passed，33.7s；
2. 25 files / 130 tests，130 passed，33.8s；
3. 25 files / 130 tests，130 passed，33.7s。

所以本轮 M7 的稳定结论是 **130/130 × 3，GO**，不是把旧的 120 期望值直接改大来掩盖
失败，而是 10 个已实现的 Vue 行为合同（6 Browser + 3 Lark + 1 Showcase）进入事实清单。
三次结果均在删除本轮新增的 4 处显式 15 秒等待后取得，使用 Playwright 默认等待。

## 5. React 来源侧验证

- `python3 scripts/pnpm.py --dir frontend check`：PASS。
- React 相关 Rstest：6 files / 115 tests，115/115：message merge、static demo、thread utils、
  Lark API、channel provider icon DOM、i18n translations。
- React Playwright：`agent-chat.spec.ts`、`channels.spec.ts`、`integrations.spec.ts`、
  `thread-history.spec.ts`，40/40 PASS（32.3s）。未启动 Gateway 的 mock suite 打印了预期的
  `127.0.0.1:8001 ECONNREFUSED` proxy 日志，但测试全部通过。
- 本轮没有修改 React 产品代码；React 仍是默认生产入口。

## 6. 失败、warnings 与未执行

- 受限沙箱首次执行 verify/M6 时本地监听报 `EPERM`；允许回环端口后从头重跑通过。
- M6 第一次收集显示旧 27 期望对最新 30 个合同；校正事实 inventory 后，React Integrations
  spec 又因两个合法的同文案节点触发 strict locator。没有删产品文案，改由 Vue-owned 等价
  spec 负责此框架相关合同，最终 30/30。
- 最终 verify 首次运行发现 M6 guard 仍写死 27；同步钉住 30 和 Vue Integrations 所有权后，
  完整 verify 110 files / 1101 tests 通过。
- Nuxt/Vite 保留既有大 chunk、plugin timing、Tailwind sourcemap、H3 unused import warnings；
  real-backend 保留 test JWT 短 key 和 LangGraph unknown-channel warnings。均已记录，未当作静默通过。
- `e2e-external`、container smoke、七状态 visual 本轮未重跑；修改范围未触及其所有者。
- 公网 DNS/TLS/SNI/HTTPS redirect/LB Host/SSE buffering/WS Upgrade、真实 IdP、真实公网
  provider、Channel OAuth、scheduler、模型 bootstrap 与 browser 长运行：**UNRUN，用户明确排除**。
  localhost、fixture、replay 和自签名结果没有写成公网证据。

## 7. 发布与路由声明

- React 仍为默认生产前端；Vue 仍只通过 secondary hostname 选择。
- 没有 npm publish、push、PR、生产发布或默认切流。
- 没有删除 React、创建新 `agent-ui-kit`、增加 CodeMirror、追新上游或扩展无关功能。
