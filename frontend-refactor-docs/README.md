# DeerFlow 架构设计文档（前端重构基线）

本目录是**对当前代码库现状的架构提取**，作为前端重构的事实基线。所有结论均来自
`2026-07-30` 时点的 `main-wc` 分支源码（前端 `package.json` version `2.1.0`），
而非设计愿望或未来规划。

## 阅读顺序

| 文档 | 内容 | 适用场景 |
| --- | --- | --- |
| [01-system-overview.md](01-system-overview.md) | 服务拓扑、请求路径、四种运行模式 | 先读这篇，理解前端在整个系统中的位置 |
| [02-frontend-layers.md](02-frontend-layers.md) | `src/` 分层、目录职责、依赖方向 | 判断新代码该放哪一层 |
| [03-routing-and-pages.md](03-routing-and-pages.md) | App Router 路由表、布局链、Provider 树、Server/Client 边界 | 改路由、加页面、调 Provider |
| [04-state-and-data-flow.md](04-state-and-data-flow.md) | 五套状态载体、各自所有权、数据流全链路 | 决定状态放哪里 |
| [05-streaming-pipeline.md](05-streaming-pipeline.md) | 会话流式管线（系统最复杂的部分） | 动 `useThreadStream` / 消息渲染前必读 |
| [06-backend-api-contract.md](06-backend-api-contract.md) | 消费的后端接口全表、鉴权与 CSRF 契约 | 加接口、排查 401/403 |
| [07-core-modules.md](07-core-modules.md) | `core/*` 36 个领域模块清单 | 查某个能力的实现落点 |
| [08-components-and-ui.md](08-components-and-ui.md) | 组件分层、生成目录、右侧面板布局所有权 | 改 UI、加面板 |
| [09-tooling-and-quality.md](09-tooling-and-quality.md) | 构建、测试双环境、Lint、环境变量 | 提交前的质量门禁 |
| [10-refactor-hotspots.md](10-refactor-hotspots.md) | 重构热点、必须保留的不变量、风险清单 | 制定重构计划时的输入 |

## 一句话架构

```
浏览器 ──▶ Nginx:2026 ──┬─▶ Next.js:3000（前端 SSR + 静态资源）
                        └─▶ Gateway:8001（REST + LangGraph 兼容运行时）
                                  └─▶ lead_agent ──┬─▶ Subagents
                                                    ├─▶ Tools / Skills / MCP
                                                    └─▶ Sandbox（按 thread 隔离）
```

前端是一个**有状态的流式聊天应用**：用户创建 thread → 发消息 → 通过 LangGraph SDK
的 SSE 流接收增量更新 → 渲染消息、产物（artifacts）、待办（todos）、目标（goal）、
子任务（subtasks）。

## 规模基线

| 指标 | 数值 |
| --- | --- |
| `src/` 手写 TS/TSX 行数（排除 `ui/`、`ai-elements/`） | ~45,663 行 |
| `src/core/` 文件数 / 目录数 | 142 / 36 |
| `src/components/` 文件数 | 189（含 44 个 `ui/` + 28 个 `ai-elements/` 生成件） |
| `src/app/` 路由文件数 | 39 |
| 单元测试文件数（Rstest） | 97 |
| E2E 规格文件数（Playwright） | 31 |
| 最大单文件 | `core/threads/hooks.ts` 3,072 行 |

## 与仓库既有文档的关系

- [frontend/AGENTS.md](../frontend/AGENTS.md) 是**规范来源**（约定、禁止项、责任归属），
  更新代码时必须同步维护它。
- 本目录是**结构快照**，用于重构期间的对照和讨论，不替代 `AGENTS.md`。
- 两者冲突时以 `AGENTS.md` 为准，并回来修正本目录。
