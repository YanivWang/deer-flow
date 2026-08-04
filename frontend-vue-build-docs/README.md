# DeerFlow 前端 Vue 重写方案

在仓库内新建 `frontend-vue/`，以 Vue 技术栈重写 `frontend/`（Next.js 16 + React 19）。两个前端并行运行、共用同一套后端接口。

**产品目标：产出一套可被其他项目复用的 agent 前端架构。** 后续项目做 AI agent 时能最大程度复用其逻辑，而它们的后端未必是 LangChain / LangGraph。

**验证手段与终态：与 `frontend/` 全域对标。** 能用抽出来的层重建一个成熟的 agent 应用，才证明这些层是完整的。

这两条不冲突，靠**顺序**解决：先做通用层（L1 → L2），再做 DeerFlow 专有层（L3），L2 边界逐模块抽取而不是最后再抽。分层定义见 [08-agent-core-contract.md](08-agent-core-contract.md)，里程碑见 [06-migration-plan.md](06-migration-plan.md)。

> 本目录是方案文档，不是实施记录。所有统计数字均来自对 `frontend/` 现有代码的实测（统计时间：2026-08-03，分支 `main-wc`）。第三方包的维护状态同期通过 `npm view` 核实。

## 一页纸结论

**一个 Nuxt 4 应用。`/workspace` 与认证页走 `ssr: false` 纯客户端渲染，营销页 `prerender: true` 静态预渲染。不做 mock、不做文档站、不做落地页动效。**

```
Nuxt 4  +  shadcn-vue / Reka UI  +  Tailwind 4
    ↓
Agent 层：自研 SSE（照抄 gamma-project 的分层与判断，按 SSE 规范重写 transport）
    ↓
状态：Pinia 管流式状态 · provide/inject 管 thread 作用域 UI 状态
    ↓
Markdown：unified 管线保留 + hast-util-to-jsx-runtime(vue/jsx-runtime) + remend
    ↓
LangChain 依赖全部移除：自写 REST client + openapi-typescript 生成类型
```

| 维度 | 结论 |
| --- | --- |
| 框架 | Nuxt 4（Vue 3.5 + Vite），端口 **3100** |
| 运行方式 | `cd frontend-vue && pnpm dev`，`routeRules` 代理直连 Gateway（**不是 `devProxy`**，它只管 dev）。**零仓库改动** |
| L1 内核 | **`frontend-vue/packages/agent-core/`** —— 独立包，可整包搬走 |
| 组件库 | **shadcn-vue + Reka UI + Tailwind 4** —— cva 样式串可逐字复制 |
| 服务端状态 | `@tanstack/vue-query` |
| Agent 通信 | **自研 SSE 分层**，参照 `gamma-project`；**不依赖 LangChain 任何包** |
| 状态管理 | Pinia（流式）+ provide/inject（thread 作用域 UI） |
| Markdown | unified 管线保留，渲染层用 `hast-util-to-jsx-runtime` + `remend` |
| 测试 | Vitest 双 project（`node` 纯 TS + `nuxt` composable）；Playwright E2E **共用 `frontend/tests/e2e/`，不复制** |
| 工程规约 | `config/routes.ts` 单一来源 · 中间件切纯函数 · 文件头六段式（带【对应 frontend/】栏）· `i18n:check` |

## 验收口径

| 维度 | 要求 | 验收方式 |
| --- | --- | --- |
| 功能 | **一致** | Playwright E2E，**同一份 spec 跑两个 app**（25 个硬合同 spec，不复制、`testDir` 指过去） |
| 交互逻辑与体验 | **一致** | Playwright E2E + [05-invariants.md](05-invariants.md) 逐条勾选（A–N 共 14 组） |
| 页面结构（DOM） | **一致** | E2E 选择器 + 逐页面 DOM 比对 |
| 视觉样式 | 允许少许差异 | 关键页面人工回归，**不做像素级 diff** |

采用 shadcn-vue 使结构与样式对标成为可能——曾评估过 Element Plus / ant-design-vue / Naive UI，它们都会让 41 个 `ui/` 组件的 cva 样式串作废、3.4 万行业务组件失去设计 token 基准。详见 [02-stack.md](02-stack.md) 的否决存档表。

## 规模底数

| 范围 | 文件数 | 行数 | 处置 |
| --- | --- | --- | --- |
| `src/core/` 纯 TS，**零改动** | 99 | 9,856 | **原样复制**（含 import 路径） |
| `src/core/` 纯 TS，**需改 import** | 24 | 4,744 | 去 LangChain 类型 / `@/env` / 组件类型 |
| `src/core/` React 耦合 | 26 | 5,365 | 改写为 composable |
| `src/components/ui/` | 44（41 组件） | 5,573 | 30 个走 shadcn-vue CLI，5 个自写，6 个不迁 |
| `src/components/ai-elements/` | 29 | 5,417 | 手工重写 |
| `src/components/workspace/` | 103 → **104** | 21,478 → **21,533** | 手工重写（**工作量主体**） |
| `src/components/auth/` | 1 | — | 手工重写 |
| `src/components/landing/` | 12 | 1,754 | 不迁 |
| `src/components/docs/` | 4 | — | 不迁 |
| `src/content/`（72 MDX + 14 `_meta.ts`） | 88 | 9,043 | 不迁 |
| `src/app/mock/` | 12 route handler | — | 不迁 |
| `public/demo/` + demo 封面图 | — | 约 15 MB | 不迁 |

**需要手工重写的业务组件：133 个。** 这是工作量主体。

> ⚠️ **这些数字会漂。** 复核时（统计次日）`workspace/` 就已经从 103 / 21,478 变成 104 / 21,533——`frontend/` 近 3 个月有 151 次提交。不要把它们当常量，每个里程碑开头用 [06 里的那条命令](06-migration-plan.md#️-这些数字会漂每个里程碑开头重算一次)重算，并 diff 一次 `frontend/src/core/`。

## 文档索引

| 文档 | 内容 |
| --- | --- |
| [01-scope.md](01-scope.md) | 范围界定：做什么、不做什么、砍掉部分的量化清单 |
| [02-stack.md](02-stack.md) | 技术栈逐库映射 + 完整依赖清单 + 版本对齐约束 + 否决存档 |
| [03-project-shape.md](03-project-shape.md) | 目录结构、`nuxt.config.ts`、路由映射表 |
| [04-architecture-decisions.md](04-architecture-decisions.md) | 七个关键架构决策及其理由 |
| [05-invariants.md](05-invariants.md) | **必须保留的行为不变式** —— A–N 共 14 组 |
| [06-migration-plan.md](06-migration-plan.md) | **M0–M8 里程碑**、按通用度排的执行顺序、风险登记 |
| [07-parallel-run.md](07-parallel-run.md) | 与 `frontend/` 并行运行、共用后端的接线方式（零仓库改动） |
| [08-agent-core-contract.md](08-agent-core-contract.md) | **★ 产品定义** —— L1/L2/L3 分层、接口契约、禁入清单、依赖方向。**其他项目复用时读这份** |

## 阅读顺序建议

动手前至少读 [08](08-agent-core-contract.md)（产品定义）、[04](04-architecture-decisions.md) 和 [05](05-invariants.md)。

[05-invariants.md](05-invariants.md) 尤其重要：`frontend/AGENTS.md` 里记录的约束大多是线上问题修复后沉淀的（#4465、#4555、#4576 等），不会跟着组件自动迁移，是"看起来做完了但行为不对"的主要来源。其中 **A 组（流式与重连）与 L 组（自研 SSE 补强）** 在改用自研 SSE 后风险最高，必须有单测覆盖。

**N 组是「已知的覆盖空白」**：uploads / notification / voice-input / i18n 这四个模块在 `frontend/AGENTS.md` 里几乎没有条目，但代码是存在的。动到它们之前先去读源码把约束补上，别默认"没写就是没约束"。

## 前置 Gate

**M0 的四道 gate 加起来大约半天，但每一条不过都会让后面几个月的工作作废。** 明细见 [06-migration-plan.md](06-migration-plan.md#m0-的四道-gate)。

| Gate | 位置 | 决定什么 |
| --- | --- | --- |
| **G0-1 `nuxt preview` 下代理生效** | M0 | E2E 的 webServer 跑的就是 preview。**`nitro.devProxy` 只管 dev**，用它会让 `e2e-auth` / `e2e-real-backend` 直接不可用 → 必须用 `routeRules` |
| **G0-2 共用 testDir 能收集到用例** | M0 | `playwright test --list` 列不出 25 个，说明撞上 `@playwright/test` 双实例——整套验收手段的前提 |
| **G0-3 鉴权可关** | M0 | Next 版靠 `DEER_FLOW_AUTH_DISABLED=1`，**25 个合同 spec 全依赖它**；Vue 版必须有等价开关 |
| **G0-4 shadcn-vue 视觉基准** | M0 | Button 并排截图 + 暗色切换。样式基准没对齐就不该往下走 |
| splitpanes spike | M0/M1 | 三面板编排是**唯一没有同构关系**的组件，却原本排在最后的 M7。先花一天验 H1/H2/H6 能否表达 |
| `hast-util-to-jsx-runtime` 输出比对 | M3 | **Vue 支持已核实**（readme 有 "Example: Vue"，需 `elementAttributeNameCase: 'html'`；且已实测它不用 `dangerouslySetInnerHTML`）。判据是**归一化 DOM 等价**，不是字符级一致 |

## 工作区边界

**所有产出只落在 `frontend-vue/` 与 `frontend-vue-build-docs/`。**

- `frontend/` 与 `backend/` 是 GitHub 上游在维护的项目——**对它们的任何修改都不提交**。需要改动来做验证时走 `git worktree` 开一次性分支，验证完删除（见 [06 M2](06-migration-plan.md)）
- 仓库根的配置文件（`Makefile`、`docker/nginx/`、`docker-compose`、`scripts/`）**不改**，需要时先征得同意。当前方案设计为零改动：`.gitignore` 放 `frontend-vue/` 内，启动用 `cd frontend-vue && pnpm dev`
- **共用的 E2E spec 视为只读合同。** 选择器对不上时由 Vue 侧消化（复刻 `data-slot` 约定），不改 `frontend/tests/e2e/*.spec.ts`、也不给 React 组件加 `data-testid`；实在不行进[豁免登记表](03-project-shape.md#选择器失效时的口径spec-只读--豁免登记)。这条曾与 04 §7 的"两边同步改"冲突，已统一为本口径
