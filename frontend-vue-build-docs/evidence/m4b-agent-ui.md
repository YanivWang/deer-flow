# M4b 通用 Agent UI 验收证据

> 快照日期：2026-08-13。本文只记录当时 checkout 的命令结果和人工观察。

## 实现范围

- 将 M4a 验证壳收敛为唯一产品聊天路径，继续使用 `useThreadStream` 状态机。
- 完成 thread Pinia store、侧栏、history/pin/分页/虚拟列表、聊天与 agent 路由。
- 完成 Markdown/Mermaid/citation、reasoning、tool/subtask、human input、follow-up、branch/edit/regenerate。
- 完成草稿、附件、slash skill、goal/polish、voice、send/stop 等 composer 交互。
- 按当前 React `frontend` 源码对齐聊天工作区：256px 侧边栏、48px 顶栏、816px 消息/composer 宽度、消息链、welcome 布局、follow-up 和底部 disclaimer。

## P0 修复

1. 共享 SSE mock 按真实 Gateway 合同返回 `Content-Location`，并有单测。
2. `make e2e-real-backend` 固定 `E2E_FRONTEND_PORT=3101`。
3. `scripts/with-loopback-no-proxy.mjs` 在保留现有代理配置的同时合并 loopback 绕过。
4. `playwright.m4b.config.ts` 和 inventory 精确锁定 11 个 spec / 66 个 tests。

## 顺序验收结果

| 命令 | 结果 |
| --- | --- |
| `make verify` | 通过：102 files / 1063 tests，lint、format、types、unit、provenance、i18n、OpenAPI、Nuxt build 通过 |
| `make migration-check` | 通过 |
| `make consumer-check` | 通过：pack、clean install、typecheck、minimal session |
| `make e2e-m4b` | 通过：11 specs / 66 tests |
| `make e2e-m0` | 通过：14/14 |
| `make e2e-m4a` | 通过：4/4 |
| `make e2e-m4a-stream` | 通过：3/3 |
| `make e2e-external` | 通过：WebSocket 1/1，OIDC 1/1 |
| `make e2e-real-backend` | 通过：3/3 |

`make verify` 在受限 sandbox 中首次执行时，12 个需要本地 listener 的单测因
`listen EPERM` 失败；在有本地回环权限的同一 checkout 重跑后 1063 项全绿。
`consumer-check` 在受限网络中首次遇到 DNS 失败，允许使用正常网络后全绿。
这两项都未被记作通过，表中结果来自后续完整重跑。

## 人工 UI 核验

使用真实 Gateway replay 渲染后检查 Chromium 截图：侧边栏、聊天顶栏、消息宽度和顺序、
tool 行、follow-up pills、悬浮 composer 与 disclaimer 均按 React 聊天工作区层级显示。

## 未扩大的结论

- M5 artifacts/tools、M6 sidecar/skills、M7 完整认证工作区与双前端生产入口未实施。
- `make e2e-list` 的 25 files / 120 tests 仍只是全量共享合同收集数，本文不宣称 120 项全绿。
- 构建输出仍有 chunk size、Tailwind sourcemap 和 H3 unused import 等非阻塞 warning。
