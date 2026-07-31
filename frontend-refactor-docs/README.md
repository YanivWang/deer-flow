# DeerFlow 架构设计文档（前端重构基线）

本目录是**对当前代码库现状的架构提取**，作为前端重构的事实基线。所有结论均来自
`2026-07-30` 时点的 `main-wc` 分支源码（前端 `package.json` version `2.1.0`），
而非设计愿望或未来规划。

> 🔖 **新会话接手请先读 [HANDOFF.md](HANDOFF.md)** —— 含 25 项定稿决策（D1–D25）、
> 当前进度与全部实测数据，读完即可继续任务。
>
> 📌 **当前为方案 v3.5**（2026-07-31）：
> v2 完成「彻底修复」，修掉 10 处问题（2 处会导致落地卡住 → D13/D14；6 处记账不一致；2 处执行形态）；
> **v3 落地 D15 —— 弃用 Tailwind CSS 4，改用 SCSS**（用户决定）。
> **v3.1–v3.5 落地 D21–D25 —— `ai` / `@langchain/langgraph-sdk` / `@langchain/core` / `@tanstack/vue-query` 均不进 Vue manifest,D25 另删 9 个 React 迁移惯性/小众包**。
> 🔴 **D15 是第一笔改变对外口径的决策：`≈6–10` → `≈7–12 人月`。** 详见 HANDOFF §一 与 §七。

## 阅读顺序

| 文档 | 内容 | 适用场景 |
| --- | --- | --- |
| [HANDOFF.md](HANDOFF.md) | **交接文档**：决策记录、进度、阻塞项、实测数据速查 | 冷启动接手时第一篇 |
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
| [11-vue-parity-plan.md](11-vue-parity-plan.md) | **Vue/Nuxt 前端对标建设方案（草案 v3.5，待评审）** | 技术栈迁移决策与执行计划 |

## 当前进展

| | |
| --- | --- |
| 阶段 | 架构提取已完成；Vue 化方案 **草案 v3.5** 待用户评审。**尚未写代码** |
| 已定稿决策 | **D1–D25**（🔴 **Nuxt+按路由分级渲染（产品区全 CSR）** / Ant Design Vue / 自包含复制 / 冻结基线 `16ea3a4d` / 不写 aria / 砍 6 项 / 只改 `frontend-vue/` / 砍 sr-only / 砍 2,100 行零引用代码 / 可新建目录 / 不做 GitHub CI / 测试可只读 frontend / 溯源两层校验+拆分规格 / 验收拆两层 / 弃 Tailwind 改 SCSS / **团队有 Nuxt 经验** / **接受五条约束** / **autoOpen 切换即重置** / **预授权 resizable 自研** / 🔴 **产品区全 CSR** / 🔴 **`ai` 类型本地化** / 🔴 **流处理手写化,不装 LangGraph SDK** / 🔴 **`@langchain/core` 类型本地化** / 🔴 **`@tanstack/vue-query` 自研替代** / 🔴 **清掉 9 个 React 迁移惯性/小众包**）→ [详见 §0.4](11-vue-parity-plan.md)<br>⚠️ D1–D12、D15–D25 由用户拍板；**D13/D14 是授权后按最佳实践所定，可推翻** |
| 待决项 | ✅ **仅剩 O15**（v2 是否做共享包，远期，紧迫度已由 D12 下调）。O5/O6/O11/O17 已于 2026-07-31 定案为 D16–D19；O2 已转为**结论**（R18 需靠 React 版逐屏 diff → **P5 视觉签字前不得退役 `frontend/`**）|
| 阻塞项 | ✅ **无** —— O14 已由 D10（新建 `docker-vue/`）+ D11（不做 CI，改 `make verify`）关闭；v2 又修掉 2 处会导致落地卡住的设计缺陷，**可直接开 P0** |
| 目标量级 | 重写 ≈ 29,680 行（D9 后）；工期 🔴 **≈ 7–12 人月（3 人约 5–7.5 个月）** —— **v3 已含 D15 的 +3–6 周，旧口径 6–10 已作废**。别报到周，见 [§7.1](11-vue-parity-plan.md) |
| ⚠️ 口径警告 | 上面的 `7–12 人月` **含一笔未实测的样式估算**（D15 的 `+3–6 周`，`⚠️待P2校准`）——它决定了上界的 12.5%。**对外沟通时必须说明这一点**；P2 做完前 3 个页面后按 [§7 表下说明](11-vue-parity-plan.md) 用实测速率回推并同步三处 |
| 复用 vs 重写 | 🔴 **总表在 [§1.0](11-vue-parity-plan.md)，实现前先看这张**（此前散在 6 个章节）。四档：①逐字节复制 **19,017 行**（依赖清单见 §2.8.3，Vue manifest 为 **50 个直接依赖**）②改几行即可 **3,268 行** ③必须重写 **≈29,680 行 + 4 个自研基础件 + 4 个缺口件 + 37 个耦合包的替代** ④直接不做 **7,025 行 + 72 MDX**<br>继承占总工作面 **42.9%** |
| 实现确定度 | ✅ 目录结构（[§3.2](11-vue-parity-plan.md)，354 行完整树）/ 架构设计（§4 四个自研基础件 + §3.3.1 store 作用域）/ **技术栈与 `package.json`（[§2.8](11-vue-parity-plan.md)，50 个依赖；D21 删除纯类型 `ai`，D22 删除 `@langchain/langgraph-sdk`，D23 删除纯类型 `@langchain/core`，D24 删除 `@tanstack/vue-query`，D25 删除 9 个 React 迁移惯性/小众包）** 均已落地<br>✅ **依赖部分零遗留未决项**：CodeMirror 绑定与主题均定为自写薄封装/本地 `EditorView.theme`（[§2.8.5](11-vue-parity-plan.md)），版本与图标名已 npm 实核；P0 落盘时重跑严格 install 留证 |
| 样式方案 | 🔴 **SCSS**（D15，不用 Tailwind）。SFC `<style lang="scss" scoped>` + `theme-palette.json` 派生三路（SCSS 变量 / CSS 自定义属性 / antdv token）。**115 个 CSS 变量必须保留**——暗色切换是运行时的，见 [§2.3.3](11-vue-parity-plan.md) |
| 验收定义 | 🔴 **分两层（D14）**：① UI 层 25 个 E2E spec 全绿 ② 代理层 `proxy-policy` 6 条断言 + 4 个真后端 spec 全绿。<br>**只签①等于 Nitro 代理层零验证** —— 25 spec 走 `page.route()`，从未执行过代理 |
| 建议起手 | **不要先搭骨架**。先做五个「便宜、二元、失败即改架构」的实验：D22 stream fixture、D24 server-state fixture、resizable 判定、**SSE 能否不缓冲穿过 Nitro**、Nitro 鉴权中间件 PoC。见 HANDOFF §五 |

## 一句话架构

```
浏览器 ──▶ Nginx:2026 ──┬─▶ Next.js:3000（前端 SSR + 静态资源）
                        └─▶ Gateway:8001（REST + LangGraph 兼容运行时）
                                  └─▶ lead_agent ──┬─▶ Subagents
                                                    ├─▶ Tools / Skills / MCP
                                                    └─▶ Sandbox（按 thread 隔离）
```

前端是一个**有状态的流式聊天应用**：用户创建 thread → 发消息 → 接收后端 SSE
流的增量更新（React 现状经 LangGraph SDK；Vue 方案按 D22 手写 Gateway adapter）→ 渲染消息、产物（artifacts）、待办（todos）、目标（goal）、
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
