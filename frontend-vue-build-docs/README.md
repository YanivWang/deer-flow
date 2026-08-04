# DeerFlow 前端 Vue 重写方案

在仓库内新建 `frontend-vue/`，以 Vue 技术栈重写 `frontend/`（Next.js 16 + React 19）。两个前端并行运行、共用同一套后端接口。

**产品目标：产出一套可被其他项目复用的 agent 前端架构。** 后续项目做 AI agent 时能最大程度复用其逻辑，而它们的后端未必是 LangChain / LangGraph。

**验证手段与终态：功能/交互合同一致，关键视觉状态受截图门禁保护。** 不承诺框架内部 DOM 或全页面逐像素相同。

这两条不冲突，靠**顺序**解决：先做通用层（L1 → L2），再做 DeerFlow 专有层（L3），L2 边界逐模块抽取而不是最后再抽。分层定义见 [08-agent-core-contract.md](08-agent-core-contract.md)，里程碑见 [06-migration-plan.md](06-migration-plan.md)。

> **实施状态：M-1 已通过；M0 十道 Gate 中九道通过、`make e2e-m0` 与 `make ws-smoke` 均为真实绿色，但 G0-7 未通过，不允许开始 M1。** 当前逐项结果见 [evidence/m0-verification.md](evidence/m0-verification.md)。G0-7 已定位到必须先修的代理转发头缺口（Nitro 代理不传递 client-facing origin，Gateway 推导出的 OIDC `redirect_uri` 指向自己）；独立 hostname 与 DNS/TLS 仍属 M7。双前端 production readiness 仍在 M7 验收，不能把“工程可运行”写成“可以直接上线”。

> 本目录是实施规格，不是完成记录。第三方包存在性与 peer 关系按 2026-08-04 核实；行为敏感包使用现有 `frontend/pnpm-lock.yaml` 的 resolved version，不能把“当前 latest”当迁移目标。

## ★ 冻结基线

**对标对象是 `27a425b0f1078baf8b2a361103a2b136ee342ab5`，已冻结。**

```
27a425b0  2026-08-04 13:50:46 +0800  Merge branch 'main' into main-wc
```

`frontend/` 近 3 个月 **239 次提交**（约 2.6 次/天）。追 moving `main` 做不到——对标是逐文件的，而 M0–M7 期间上游会再累积数百次提交。

**冻结的直接收益：源码迁移规模有稳定基线。** 在 `27a425b0` 处实测的 `core` 149 / `ui` 44 / `ai-elements` 29 / `workspace` 104 / `app` 39 可作为口径。共享 E2E 刻意跟随当前 HEAD，因此测试数量不是冻结常量，CI 每次输出实时 inventory。同步策略见 [06](06-migration-plan.md#冻结基线与上游同步策略)。

## 一页纸结论

**一个 Nuxt 4 应用。`/workspace` 与认证页走 `ssr: false` 纯客户端渲染，营销页 `prerender: true` 静态预渲染。不做 mock、不做文档站、不做落地页动效。**

```
Nuxt 4  +  shadcn-vue / Reka UI  +  Tailwind 4
    ↓
Agent 层：SSE 分帧 + 显式 RunProtocol（create POST → handle → resume GET）
    ↓
状态：L1 external store 管协议状态 · Vue/Pinia adapter 管 thread 作用域
    ↓
Markdown：unified 管线保留 + hast-util-to-jsx-runtime(vue/jsx-runtime) + remend
    ↓
LangChain 依赖在 M2 四类协议门禁通过后移除
```

| 维度 | 结论 |
| --- | --- |
| 框架 | Nuxt 4（Vue 3.5 + Vite），端口 **3100** |
| 运行方式 | 开发：Next `3000`、Vue `3100`、共享 Gateway `8001`；生产：两个独立 hostname 的对称 nginx/ingress，共享 Gateway |
| L1 内核 | **`frontend-vue/packages/agent-core/`** —— 独立包，可整包搬走 |
| 组件库 | **shadcn-vue + Reka UI + Tailwind 4** —— cva 样式串可逐字复制 |
| 服务端状态 | `@tanstack/vue-query` |
| Agent 通信 | raw SSE + `RunProtocol`；create、resume、cancel 分请求，禁止重放 create POST |
| 状态管理 | L1 框架无关 external store + Vue/Pinia adapter + provide/inject |
| Markdown | unified 管线保留，渲染层用 `hast-util-to-jsx-runtime` + `remend` |
| 测试 | Vitest 双 project（`node` 纯 TS + `nuxt` composable）；Playwright E2E **共用 `frontend/tests/e2e/`，不复制** |
| 工程规约 | `config/routes.ts` 单一来源 · 中间件切纯函数 · 文件头六段式（带【对应 frontend/】栏）· `make i18n-check` |

## 验收口径

| 维度 | 要求 | 验收方式 | 是否门禁 |
| --- | --- | --- | --- |
| 功能 | **一致** | Playwright E2E；当前 mock 总基线 27 files / 130 tests，Vue 硬合同排除两个 React-only spec 后为 25 / 120 | ✅ |
| 交互逻辑与体验 | **一致** | Playwright E2E + [05-invariants.md](05-invariants.md) 逐条勾选（A–N 共 14 组） | ✅ |
| 页面结构（DOM） | 选择器契约一致 | E2E 选择器；`structural-diff` 只作**诊断报告** | ❌ 不做门禁 |
| 关键视觉状态 | 基线阈值内一致 | 6–10 个确定性截图状态 | ✅ |
| 非关键装饰/框架内部 DOM | 允许受控差异 | structural report + 人工回归 | ❌ |

> 全页面 DOM/像素 diff 仍然无界，所以不做；有限关键状态截图是有界门禁，用来避免“口头视觉一致、实际无人验收”。详见 [04 §7](04-architecture-decisions.md#7-验收分层功能合同与关键视觉门禁)。

采用 shadcn-vue 使结构与样式对标成为可能——曾评估过 Element Plus / ant-design-vue / Naive UI，它们都会让 41 个 `ui/` 组件的 cva 样式串作废、3.4 万行业务组件失去设计 token 基准。详见 [02-stack.md](02-stack.md) 的否决存档表。

## 规模底数

| 范围 | 文件数 | 行数 | 处置 |
| --- | --- | --- | --- |
| `src/core/` 纯 TS，初筛零-import 改动候选 | 99 | 9,856 | 逐个归类；只有真正零改动者进 `COPIED` hash 集，最终数量由 manifest 生成 |
| `src/core/` 纯 TS，**需改 import** | 24 | 4,744 | 去 LangChain 类型 / `@/env` / 组件类型 |
| `src/core/` React 耦合 | 26 | 5,365 | 改写为 composable |
| `src/components/ui/` | 44（41 组件） | 5,573 | 30 个走 shadcn-vue CLI，5 个自写，6 个不迁 |
| `src/components/ai-elements/` | 29 → **22** | 5,417 → **5,107** | 手工重写（7 个 xyflow canvas 件不迁，见 [01](01-scope.md#4-xyflow-canvas-组件不迁)） |
| `src/components/workspace/` | 103 → **104** | 21,478 → **21,533** | 手工重写（**工作量主体**） |
| `src/components/auth/` | 1 | — | 手工重写 |
| **`src/app/`（layout / page / providers）** | 39 → **19** | 4,143 → **3,215** | **改写为 Nuxt pages / layouts**（mock 12 + docs/blog 6 + memory route 2 不迁）。早期版本漏了这一栏 |
| `src/core/streamdown/` | 6 | 714 | 只有 `preprocess.ts`(389) 能原样搬，其余 325 行要重写，见 [02](02-stack.md#markdown-渲染层) |
| `src/components/landing/` | 12 | 1,754 | 不迁 |
| `src/components/docs/` | 4 | — | 不迁 |
| `src/content/`（72 MDX + 14 `_meta.ts`） | 88 | 9,043 | 不迁 |
| `src/app/mock/` | 12 route handler | — | 不迁 |
| `public/demo/` + demo 封面图 | — | 约 15 MB | 不迁 |

**需要手工重写的业务组件：126 个**（104 workspace + 22 ai-elements）**，外加 19 个 `src/app/` 的 layout / page / providers。合计 145 个文件。** 这是工作量主体；UI 基础件与 auth 组件另按各自行计入。

> 这些数字取自冻结基线 `27a425b0`，**是常量**。里程碑期间不重算、不 diff 上游——理由与同步策略见 [06](06-migration-plan.md#冻结基线与上游同步策略)。

## 文档索引

| 文档 | 内容 |
| --- | --- |
| [01-scope.md](01-scope.md) | 范围界定：做什么、不做什么、砍掉部分的量化清单 |
| [02-stack.md](02-stack.md) | 技术栈逐库映射 + 完整依赖清单 + 版本对齐约束 + 否决存档 |
| [03-project-shape.md](03-project-shape.md) | 目录结构、`nuxt.config.ts`、路由映射表 |
| [04-architecture-decisions.md](04-architecture-decisions.md) | 七个关键架构决策及其理由 |
| [05-invariants.md](05-invariants.md) | **必须保留的行为不变式** —— A–N 共 14 组 |
| [06-migration-plan.md](06-migration-plan.md) | **M-1–M8 里程碑**、按通用度排的执行顺序、风险登记 |
| [07-parallel-run.md](07-parallel-run.md) | 与 `frontend/` 并行运行、共用后端的接线方式（端口、代理、WebSocket） |
| [08-agent-core-contract.md](08-agent-core-contract.md) | **★ 产品定义** —— L1/L2/L3 分层、接口契约、禁入清单、依赖方向。**其他项目复用时读这份** |
| [09-m1-contract-freeze.md](09-m1-contract-freeze.md) | **★ M-1 冻结结论** —— 双前端部署、Gateway/SSE/WS、认证、测试、视觉与根级集成追踪矩阵 |

## 阅读顺序建议

动手前先读 [09](09-m1-contract-freeze.md)（冻结合同），再读 [08](08-agent-core-contract.md)（产品定义）、[04](04-architecture-decisions.md) 和 [05](05-invariants.md)。

[05-invariants.md](05-invariants.md) 尤其重要：`frontend/AGENTS.md` 里记录的约束大多是线上问题修复后沉淀的（#4465、#4555、#4576 等），不会跟着组件自动迁移，是"看起来做完了但行为不对"的主要来源。其中 **A 组（流式与重连）与 L 组（自研 SSE 补强）** 在改用自研 SSE 后风险最高，必须有单测覆盖。

**N 组是「已知的覆盖空白」**：uploads / notification / voice-input / i18n 这四个模块在 `frontend/AGENTS.md` 里几乎没有条目，但代码是存在的。动到它们之前先去读源码把约束补上，别默认"没写就是没约束"。

## 前置 Gate

先完成 M-1 契约冻结，再完成 M0 十道 gate。明细见 [06-migration-plan.md](06-migration-plan.md#m0-的十道-gate)。

| Gate | 位置 | 决定什么 |
| --- | --- | --- |
| **G0-0 clean checkout CI** | M0 | 先安装 `frontend` 的共享 Playwright，再安装 Vue；目录未创建时 workflow 安全跳过；provenance 不依赖偶然存在的 git object |
| **G0-1 `nuxt preview` 下代理生效 + SSE 不被缓冲** | M0 | E2E 的 webServer 跑的就是 preview。**`nitro.devProxy` 只管 dev**；生产使用 Nitro server catch-all，并实测 `sendStream` / `streamRequest` 两个 flag。`routeRules.proxy` 因会绕过 body/path guard 而只保留为纯合同映射测试，见 [03](03-project-shape.md#️-为什么生产代理必须进入-nitro-产物而不是-nitrodevproxy) |
| **G0-2 共用 testDir 能收集到用例** | M0 | 先用当前可执行命令确认 React mock 总基线 27 files / 130 tests；Vue config 明确排除两个 React-only spec 后列出 25 / 120。收集成功不等于测试通过 |
| **G0-3 鉴权可关** | M0 | Next 版靠 `DEER_FLOW_AUTH_DISABLED=1`，**25 个合同 spec 全依赖它**；Vue 版必须有等价开关 |
| **G0-4 shadcn-vue 视觉基准** | M0 | Button 并排截图 + 暗色切换。样式基准没对齐就不该往下走 |
| **G0-5 真实 Cookie/CSRF** | M0 | 经 preview 完成 register/login、写请求、refresh、logout |
| **G0-6 WebSocket 最终路径** | M0 | 开发冻结为直连 `ws://localhost:8001` + 精确 Origin allowlist；生产冻结为各 hostname 同源 nginx/ingress Upgrade。真实 Cookie+Origin 握手必须通过 |
| **G0-7 OIDC 双回跳** | M0 | 生产使用独立 hostname；IdP 注册两个 callback，`frontend_base_url` 与 provider `redirect_uri` 同时留空；开发同 host 不同端口的 state-cookie 覆盖必须有负测 |
| **G0-8 Run session 协议** | M0 | create POST 一次、捕获 run handle、resume GET + Last-Event-ID、cancel/gap/heartbeat 全部录成 trace |
| **G0-9 依赖与代理安全** | M0 | 锁 Nuxt/Nitro/h3 resolved version，moderate+ audit、编码路径逃逸回归与生产 20 MiB body limit 全部通过 |
| splitpanes spike | M0/M1 | 三面板编排是**唯一没有同构关系**的组件，却原本排在最后的 M7。先花一天验 H1/H2/H6 能否表达 |
| `hast-util-to-jsx-runtime` 输出比对 | M3 | **Vue 支持已核实**（readme 有 "Example: Vue"，需 `elementAttributeNameCase: 'html'`；且已实测它不用 `dangerouslySetInnerHTML`）。判据是**归一化 DOM 等价**，不是字符级一致 |

## 工作区边界

业务实现主要落在 `frontend-vue/`；仓库集成必须同步更新 source-of-truth。

- `frontend/` 产品代码和共享 E2E spec 保持只读；一次性 React oracle 探针走 worktree
- 根 `scripts/pnpm.py`、对应测试、workflow、README/AGENTS 属于 M0 必需集成；Vue 自身 Dockerfile/health 属于生产基础产物；冻结的 dual profile 要在 M7 同步完成 nginx/compose/health-check
- `backend/` 默认不改；只有 OIDC 双 origin 无法通过相对回跳解决时，才以受签名 state + allowlist 的方式扩展，并补安全测试
- **共用的 E2E spec 视为只读合同。** 选择器对不上时由 Vue 侧消化（复刻 `data-slot` 约定），不改 `frontend/tests/e2e/*.spec.ts`、也不给 React 组件加 `data-testid`；实在不行进[豁免登记表](03-project-shape.md#选择器失效时的口径spec-只读--豁免登记)。这条曾与 04 §7 的"两边同步改"冲突，已统一为本口径
