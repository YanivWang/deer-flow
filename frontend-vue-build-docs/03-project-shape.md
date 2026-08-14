# 03 · 项目形态

> **文档性质：冻结目标设计，不是当前目录快照。** 本文保留目标结构、命令设计与实施
> 决策；其中带“将建”“M0 必须”的段落属于当时的设计语境。续接任务必须先读
> [10-current-status-and-next.md](10-current-status-and-next.md)，再以当前目录和 Makefile
> 核实哪些条目已经落地。不要照着下面的树补齐空目录，也不要把目标文件清单当作现状。

项目位于仓库内的 `frontend-vue/`，与 `frontend/` 并存。并行运行与端口分配见 [07-parallel-run.md](07-parallel-run.md)。

> M-1 已冻结：开发端口为 3100、E2E preview 为 3101；生产使用两个独立 hostname 的同源 ingress。完整合同见 [09](09-m1-contract-freeze.md)。

> **M0 实施修正（2026-08-04）**：Nuxt 4.5.1/Nitro 2.13.4 的
> `routeRules.proxy` 会先于自定义 handler 接管请求，因而绕过 20 MiB 与
> traversal guard；两个重叠 wildcard 还会产生 `/api/langgraph/**` 遮蔽。
> 生产实现改为单一 `server/routes/api/[...path].ts` catch-all，统一完成
> guard、前缀 rewrite、`redirect:"manual"` 与 h3 流选项。渲染分区仍使用
> `routeRules`；`buildProxyRules(env)` 保留为四组合纯合同和目标映射单测，
> 不能重新 spread 回 `nuxt.config.ts`。Preview 的开启/关闭对照已证明两个
> 流选项的实际影响，见 [M0 证据](evidence/m0-verification.md)。

> 同一轮还确认 Nuxt 4.5.1 builder 在当前解析树调用 Vite 8 的 Oxc API；
> 强行降到早期冻结草案中的 Vite 7 会在 build 阶段缺少
> `transformWithOxc`。因此锁文件显式解析 Vite 8.2.0，并将这一实施后才可见
> 的 peer 例外写入 workspace 配置，而不是伪报 Vite 7 可运行。

## 目录结构

```
frontend-vue/
├── Makefile                      # ★ 唯一开发者入口（对齐 backend/Makefile 的做法）
├── nuxt.config.ts
├── package.json                  # 只留 postinstall，不放开发者脚本；完整内容见下方
├── Dockerfile                    # Node 22 多阶段构建；runtime 只复制 .output，非 root 用户
├── .dockerignore                 # 排除 node_modules/.nuxt/.output/test-results 与本地 env
├── tsconfig.json                 # extends ./.nuxt/tsconfig.json
├── components.json               # shadcn-vue CLI 配置
├── vitest.config.ts              # 双 project：node（纯 TS）+ nuxt（composable）
├── playwright.config.ts          # webServer 指向 nuxt preview :3101（独立端口）
├── playwright.m0.config.ts       # M0 infra/proxy/auth/WS/OIDC/run-protocol 专用，不依赖业务页面
├── playwright.auth.config.ts     # 对应 frontend/ 的 auth 套件
├── playwright.real-backend.config.ts # 真实 Gateway：认证、续传、并发 run
├── playwright.visual.config.ts   # 6–10 个关键状态截图门禁
├── eslint.config.mjs
├── openapi.snapshot.json         # Gateway /openapi.json 的签入快照 → make gen-api-types
├── baseline/
│   └── core-sha256.json          # 冻结基线的 COPIED 文件 hash；CI 不依赖 git 历史对象
├── pnpm-workspace.yaml           # ★ 嵌套 workspace，只含本目录 —— 见「agent-core 怎么被解析」
├── .prettierrc
├── .gitignore
├── README.md
├── REUSE.md                     # M8：其他项目接 L1/L2、替换 L3 的上手指南
│
├── examples/
│   └── agent-core-consumer/     # M8：可复制的非 LangGraph consumer，隔离门禁直接运行
│
├── config/                       # ★ 构建期配置的单一来源，被 nuxt.config.ts 消费
│   └── routes.ts                 #   proxy / ssr:false / prerender 三份路由规则 + 纯函数
│                                 #   —— 修改须同步 tests/unit/config/routes.test.ts
│
├── scripts/
│   ├── i18n-manager.mjs          # ★ 词典体检：check / diff / unused（2,256 行词典，必须有工具）
│   ├── check-file-headers.mjs     # M8：六段式文件头；从 PROVENANCE 跳过 COPIED
│   ├── consumer-check.mjs         # pack → isolated install → typecheck → runtime
│   ├── check-api-types.mjs       # 临时生成 OpenAPI 类型并与签入产物 diff
│   └── container-smoke.sh        # 动态回环端口起容器、探 /health、发 SIGTERM、trap 清理
│
├── packages/                     # ★ 可复用产物，与 app/ 平级
│   └── agent-core/               #   L1 协议无关内核 —— 其他项目整包搬走即可
│       ├── package.json          #   独立包，被 app/ 以 workspace:* 引用
│       ├── src/
│       │   ├── index.ts                 # 唯一公共导出面
│       │   ├── transport/
│       │   │   ├── sse-buffer.ts        # 分帧（CRLF 归一化 + buffer 上限）
│       │   │   ├── parse-sse-event.ts   # 解析 event/data/id（只剥一个空格）
│       │   │   └── frame-reader.ts      # 只读 Response body，不决定 endpoint/method
│       │   ├── session/
│       │   │   ├── run-protocol.ts      # create/resume/cancel 协议接口
│       │   │   └── run-session.ts       # POST→handle→GET 状态机、退避、watchdog
│       │   ├── reducer/create-reducer.ts# 完整 TState + 消息动作，纯函数
│       │   ├── merge/merge-message.ts   # 增量合并（禁模块级可变状态）
│       │   ├── watchdog/stream-watchdog.ts
│       │   ├── store/create-external-store.ts # 框架无关 subscribe/getSnapshot
│       │   └── types/contract.ts        # AgentMessage / SseFrame / 错误分类
│       └── tests/                       # 内核自己的单测；tarball 只打包 src，不带 tests
│
├── app/                          # Nuxt 4 srcDir —— @/* 与 ~/* 均指向此处
│   ├── app.vue
│   ├── assets/
│   │   └── css/
│   │       └── main.css          # ← 由 frontend/src/styles/ 直接搬（Tailwind 4 + CSS 变量主题）
│   │
│   ├── core/                     # ★ 由 frontend/src/core/ 分类迁移；99/24/26 是初筛组，最终数量看 provenance
│   │   ├── PROVENANCE.md         #   ★ 每个文件标 COPIED/RETYPED/ADAPTED/ADDED/DROPPED
│   │   │                         #     COPIED 一档由 tests/core-provenance.test.ts 做 hash 守护
│   │   │
│   │   ├── agent-deerflow/       #   ★ L3 协议适配层 —— 随项目走，不可复用
│   │   │   ├── endpoints.ts             # create/resume/cancel/cancel-then-drain
│   │   │   ├── run-protocol.ts          # Content-Location handle + Last-Event-ID
│   │   │   ├── event-map.ts             # 完整事件全集 → state/message/session 动作
│   │   │   ├── message-adapt.ts         # LangGraph Message ⇄ AgentMessage
│   │   │   ├── stream-mode.ts           # ← 白名单属于适配层（LangGraph 概念）
│   │   │   └── gap-recovery.ts          # gap 控制帧处理与 rejoin
│   │   │
│   │   ├── markdown/             #   ← 新增：替代 core/streamdown/
│   │   │   ├── pipeline.ts              # unified 管线装配
│   │   │   ├── render.ts                # hast → vnode（hast-util-to-jsx-runtime）
│   │   │   ├── blocks.ts                # marked 分块 + memo key
│   │   │   ├── animate.ts               # 逐词淡入
│   │   │   ├── preprocess.ts            # ← 原样搬（嵌套截断 / LaTeX 归一化 / 系统标签剥离）
│   │   │   └── plugins.ts               # ← 重写；只有 rehypeStreamingListItems 能搬
│   │   ├── api/                  #   ← 改写：不再依赖 LangChain SDK
│   │   │   ├── client.ts                # 7 个 REST 方法 + CSRF 头 + 错误规范化（~180 行）
│   │   │   └── types.gen.ts             # openapi-typescript 生成，勿手改
│   │   ├── agents/  artifacts/  auth/  channels/  config/
│   │   ├── messages/             #   消息分组、run-duration、workspace-change 锚点、human-input 协议
│   │   ├── threads/              #   创建、状态、composer draft、导出
│   │   ├── tasks/  todos/  tools/  skills/  mcp/  models/
│   │   ├── i18n/                 #   自研词典（en-US / zh-CN），保留不换 vue-i18n
│   │   ├── memory/  settings/  sidecar/  suggestions/  notification/
│   │   ├── integrations/  input-polish/  voice-input/  uploads/
│   │   ├── workspace-changes/  rehype/  utils/
│   │
│   ├── stores/                   # ← Vue/Pinia 适配层；L1 本身不依赖 Pinia
│   │   ├── create-thread-store.ts       # 每 thread/sidecar 一实例
│   │   └── registry.ts                  # 生命周期与销毁，不保存业务协议
│   │
│   ├── components/
│   │   ├── ui/                   # shadcn-vue CLI 生成（30 个）+ 手写（resizable + 4 特效）
│   │   ├── elements/             # ← 原 ai-elements/，22 个手写（7 个 xyflow canvas 件不迁）
│   │   ├── workspace/            # 104 个 —— 工作量主体
│   │   │   ├── messages/
│   │   │   ├── artifacts/
│   │   │   ├── sidecar/
│   │   │   ├── browser-view/
│   │   │   ├── chats/
│   │   │   └── settings/
│   │   ├── auth/
│   │   └── marketing/            # ← 新增：营销占位页组件
│   │
│   ├── composables/              # 原 src/hooks/ + core 中 26 个改写件
│   ├── layouts/
│   │   ├── default.vue           # 营销页
│   │   ├── auth.vue
│   │   └── workspace.vue
│   ├── middleware/
│   │   └── auth.global.ts        # 替代 Next 的 layout 内鉴权
│   ├── plugins/
│   │   ├── deerflow-runtime.ts          # useRuntimeConfig() → 纯 RuntimeOptions 注入
│   │   ├── vue-query.ts
│   │   └── i18n.ts
│   ├── lib/
│   │   └── utils.ts              # cn()
│   └── pages/
│       ├── index.vue             # 营销占位
│       ├── pricing.vue           # 营销占位
│       ├── about.vue             # 营销占位
│       ├── login.vue
│       ├── setup.vue
│       ├── auth/
│       │   └── callback.vue
│       └── workspace/
│           ├── index.vue         # redirect → /workspace/chats/new
│           ├── scheduled-tasks.vue
│           ├── chats/
│           │   ├── index.vue
│           │   └── [thread_id].vue
│           └── agents/
│               ├── index.vue
│               ├── new.vue
│               └── [agent_name]/
│                   └── chats/
│                       └── [thread_id].vue
│
├── server/
│   └── routes/health.get.ts      # Nuxt 自身存活探针；不代理 Gateway、不泄露配置
├── public/                       # 仅 favicon + logo（demo 资产 15 MB 全删）
│
└── tests/
    ├── architecture.test.ts      # ★ L1 禁入 + M8 精确 L2 集合/依赖方向守护
    ├── core-provenance.test.ts   # ★ app/core/PROVENANCE.md 台账守护；COPIED 一档
    │                             #   对签入 baseline/core-sha256.json 比对（见 06 M1 1e）
    ├── global-setup.ts           # ★ Playwright 的 Nuxt 冷启动预热（不预热首个 spec 假红）
    ├── structural-diff.spec.ts   # ★ 自有 E2E：同一脚本对两个 baseURL 各跑一遍，
    │                             #   提取选择器契约做 diff → 产出报告。
    │                             #   ⚠️ 是诊断不是门禁，见 04 §7。不碰 frontend/
    ├── m0/                       # ★ M0 独有的网络/运行合同，不复制 React 业务 spec
    │   ├── proxy.spec.ts         # @proxy：preview handler、SSE、20 MiB 边界
    │   ├── auth-disabled.spec.ts # @auth-disabled：空壳 workspace 的守卫决策
    │   ├── visual-seed.spec.ts   # @visual-seed：Button/light/dark 基准
    │   ├── ws.spec.ts            # @ws：真实 Origin+Cookie Upgrade
    │   ├── oidc.spec.ts          # @oidc：双 callback、state 与 forwarded header
    │   └── run-protocol.spec.ts  # @run-protocol：create/resume/cancel/gap/heartbeat
    ├── visual/                   # 关键状态截图：确定性 fixture + 受审 mask
    │   └── critical-states.spec.ts
    ├── fixtures/
    │   ├── threads/              # 13 个最终 checkpoint / 516 条消息：只验最终状态
    │   └── streams/              # raw SSE golden trace：chunk/id/heartbeat/gap/reconnect
    └── unit/                     # Vitest，镜像 app/ 结构
        ├── core/                 # ← frontend/tests/unit/core/ 共 83 个；按运行环境分批迁
        ├── config/
        │   └── routes.test.ts    # ★ 锁定代理前缀优先级与渲染分区（M0 G0-1 的永久回归）
        ├── middleware/
        │   └── auth.test.ts      # ★ 锁定鉴权决策纯函数（M0 G0-3 的永久回归）
        └── agent-deerflow/       # ← 适配层测试（内核自己的测试在 packages/agent-core/tests/）
```

**React 业务合同 E2E 不在 `frontend-vue/tests/` 下重建**：继续共用 `frontend/tests/e2e/`。`structural-diff.spec.ts` 是诊断，`tests/m0/` 是 Vue/Nitro 独有的基础设施 gate，二者都不是共享业务 spec 的副本。见下文 [E2E 一节](#e2e共用-frontendtestse2e不复制)。

### `packages/agent-core/` 怎么被解析

方案要求它「整包搬走后只改包名/接线配置」，因此它必须是一个**真包**而不是一个被相对路径 import 的目录。仓库根没有 `pnpm-workspace.yaml`，`frontend-vue/` 自己建立嵌套 workspace：

```yaml
# frontend-vue/pnpm-workspace.yaml
packages:
  - "."
  - "packages/*"
```

然后应用根 `package.json` **必须**用 `"@deerflow/agent-core": "workspace:*"` 引用；这行必须出现在下方完整 manifest 中，不能只写在正文。

包本身的最小 manifest：

```json
{
  "name": "@deerflow/agent-core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "files": ["src"],
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "import": "./src/index.ts"
    }
  },
  "types": "./src/index.ts",
  "sideEffects": false
}
```

M8 再加两道真实消费守卫：包内 architecture test 精确快照 `src/index.ts` 的全部
value/type exports，应用侧 architecture test 拒绝深路径 import；
`examples/agent-core-consumer/` 由 `make consumer-check` 放进系统临时目录 clean install，
不能借仓库上层 `node_modules` 兜底。当前包仍为 private，未发布 npm。

M2 增加临时 consumer workspace 做 clean install/typecheck/test；若将来发布 npm 包，再增加 build 产物与 files 清单，应用侧不得依赖未导出的源码路径。

**不这么做的后果**（早期版本写的「通过相对路径引用，不需要 workspace 协议」是错的）：

- `packages/agent-core/package.json` 里声明的依赖**不会被安装**——pnpm 只装 `frontend-vue/package.json`
- 它的 `exports` / `types` 字段不生效，消费方得写 `~~/packages/agent-core/src/index` 这种深路径
- 「搬走零改动」的承诺随即不成立：复用方拿到的包，其依赖清单从没被验证过

### Rstest 转 Vitest：按运行环境分组，不把 126 个测试塞进 M1

当前真实清单是：`tests/unit/core/` 83 个、`components/` 35 个、`app/` 2 个、`hooks/` 2 个、`content/` 1 个、`scripts/` 1 个，另有 2 个根级测试，共 126 个。**126 是全部 unit tests，不是 core tests。**

先生成 manifest，按依赖分组：

| 批次   | 范围                                                   | 进入条件                                        |
| ------ | ------------------------------------------------------ | ----------------------------------------------- |
| M1     | 83 个 core 中不依赖 React DOM、组件、hook 的纯 TS 子集 | `node` project 可独立运行                       |
| M4a    | core 中的 DOM/composable、hooks                        | Nuxt test environment 和 runtime adapter 已存在 |
| M4b–M6 | components/app/content                                 | 对应 Vue 组件已经迁移                           |
| M7     | scripts 和剩余集成测试                                 | 完整验收                                        |

每批用同一 codemod 转 import/mock，再人工复核 mock 语义。测试 manifest 和实际收集数量由脚本生成，文档只记录基线，不把手写数量当永久事实。

### `scripts/i18n-manager.mjs`：词典体检

frontend-vue 保留自研 i18n（[04 §5](04-architecture-decisions.md#5-i18n-保留自研不引-vue-i18n)），搬过来的是：

| 文件                         | 行数  |
| ---------------------------- | ----- |
| `core/i18n/locales/en-US.ts` | 1,155 |
| `core/i18n/locales/zh-CN.ts` | 1,101 |
| `core/i18n/locales/types.ts` | 914   |

**两千多条文案、两份词典、零工具。** 重写 126 个组件期间最容易发生的就是漏 key、两份词典不同步、留下一堆再没人用的 key——而这三类问题**编译器都不会报**（`types.ts` 只约束结构，不约束"每个 key 都被用到"）。

照 `nuxt-modern-starter` 的 `i18n-manager.mjs` 做一个，三个子命令：

| 命令               | 作用                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------- |
| `make i18n-diff`   | 列出 `en-US` 与 `zh-CN` 的 key 差集——**任一边缺 key 就该红**                              |
| `make i18n-unused` | 扫 `app/` 找出没有任何引用的 key。移植期间用来确认"这个 key 是不是跟着不迁的模块一起废了" |
| `make i18n-check`  | 上面两项的 CI 形态，是 `make verify` 的前置目标之一                                       |

差别：那个项目的词典是 JSON，这里是 TS 模块，扫描要走 AST（或直接 `import` 后遍历对象，反正是纯数据）。

### 为什么 `core/` 放在 `app/core/`

Nuxt 4 的 `srcDir` 默认是 `app/`，且 `@` 与 `~` 别名都指向 `srcDir`。

因此 `app/core/` 让现有的 `@/core/...`、`@/components/...`、`@/lib/...` **import 路径完全不变**——14,600 行纯 TS 连 import 语句都不用改。这是把移植风险压到最低的关键安排。

注意：`app/core/utils/` 与 Nuxt 的自动导入目录 `app/utils/` 不冲突（后者不存在）。

## E2E：共用 `frontend/tests/e2e/`，不复制

E2E 是 1:1 的验收合同。**复制一份 spec 到 `frontend-vue/` 会漂移，合同随即失效**，所以不复制——Vue 版的 playwright config 直接把 `testDir` 指向 Next 版的目录：

```ts
// frontend-vue/playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

// ⚠️ E2E 专用端口，不是 3100。见下方「为什么 E2E 不能用 3100」。
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3101";

export default defineConfig({
  testDir: "../frontend/tests/e2e",
  // 两个明确豁免项（Vue 版故意不做的东西）——在本文件里排除，
  // 不去动 frontend/ 的任何文件。
  testIgnore: ["**/landing.spec.ts", "**/docs-localized-links.spec.ts"],

  // Nuxt 首次 preview 编译很慢，不预热第一个 spec 会假红。
  // 现成实现：git show 44309ae7:frontend-vue/tests/e2e/global-setup.ts
  globalSetup: "./tests/global-setup.ts",

  // ↓↓↓ 以下六项逐字镜像 frontend/playwright.config.ts —— 见下方说明 ↓↓↓
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "html",
  timeout: 30_000,
  use: {
    baseURL,
    locale: "en-US", // ★ 漏掉这条会大面积假红，见下
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // ↑↑↑ 到这里 ↑↑↑

  webServer: {
    command:
      "./node_modules/.bin/nuxt build && PORT=3101 ./node_modules/.bin/nuxt preview",
    url: baseURL,
    reuseExistingServer: false, // ★ 不是 !CI，见下
    timeout: 240_000,
    env: {
      // 对应 frontend/playwright.config.ts:38 的 DEER_FLOW_AUTH_DISABLED=1
      NUXT_PUBLIC_AUTH_DISABLED: "1",
    },
  },
});
```

`page.route()` 在浏览器侧拦截，不经过 nginx，所以 E2E 直接打自己的端口即可——前提是应用发出的 URL 与 Next 版一致（见 [07-parallel-run.md](07-parallel-run.md)）。

### ⚠️ spec 是合同，config 也是合同的一部分

上面标注「逐字镜像」的六项不是抄写洁癖。**spec 只读、但 spec 的运行条件由 config 决定**，config 不同等于合同条件不同：

| 字段                        | 漏掉的后果                                                                                                                                                                                                                                                                                                                    |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`use.locale: "en-US"`**   | **最危险的一条。** 25 个 spec 里绝大多数断言英文文案（`getByRole("button", { name: "Regenerate" })`、`getByPlaceholder(/how can i assist you/i)`…），而 `chat.spec.ts` 有一个用例主动写 `document.cookie = "locale=zh-CN"` 再 reload。不锁 locale，Vue 版会跟随宿主机语言（本机是 zh-CN），**大面积假红且失败信息毫无指向性** |
| `timeout: 30_000`           | Next 版 30 s；Vue 版用 Playwright 默认 30 s 恰好相同，但显式写出来才不会在将来漂                                                                                                                                                                                                                                              |
| `fullyParallel` / `workers` | 并发度不同会改变 spec 之间的竞态暴露程度，两边跑出不同结果时无法归因                                                                                                                                                                                                                                                          |
| `retries`                   | CI 上 Next 版重试 2 次。Vue 版不重试会显得更不稳，不是真实差异                                                                                                                                                                                                                                                                |
| `projects: [chromium]`      | 不写会用默认 project，`devices["Desktop Chrome"]` 的 viewport / UA / deviceScaleFactor 都不一样——`ui-polish-mobile.spec.ts` 这类断言尺寸的 spec 直接失真                                                                                                                                                                      |

### ⚠️ 为什么 E2E 不能用 3100，以及为什么 `reuseExistingServer: false`

这两条是同一个问题的两面。

[G0-1](06-migration-plan.md#m0-的十道-gate) 的全部论证是「生产 Nitro handler 在 preview 下生效而 `devProxy` 不生效，所以必须验 preview」。但如果 E2E 用 3100 且 `reuseExistingServer: !CI`，那么**本地只要有一个 `make dev` 正跑在 3100，Playwright 就直接复用那个 dev server，preview 根本没被启动过**——G0-1 的论证被完整架空，而且没有任何报错。

所以：**E2E 用独立端口 3101，且 `reuseExistingServer: false`。** 代价是每次 E2E 都要重新 build（`timeout` 已放到 240 s），换来的是「跑的确实是 preview 产物」这个前提成立。

> Next 版用 3000 + `reuseExistingServer: !CI` 有同样的隐患，但它的 `rewrites()` 在 dev 与 start 下行为一致，所以复用 dev server 不影响结论。Vue 版没有这个豁免。

### ⚠️ M0 必须先验证 spec 能被收集到

好消息先说：实测 27 个 spec **只 import 两样东西**——`@playwright/test` 和 `./utils/mock-api`，没有任何 `@/` 别名依赖。所以不需要为共用 testDir 配 tsconfig paths。

但有一个必须先验证的：`frontend/tests/e2e/*.spec.ts` 解析 `@playwright/test` 时会沿目录上溯命中 **`frontend/node_modules`**，而 runner 在 `frontend-vue/node_modules`。两个物理实例注册到不同的 registry，典型症状是 `Playwright Test did not expect test() to be called here`，或者干脆收集到 0 个用例——**两边都声明 `^1.59.1` 也不行，pnpm 装的是两份**。

M0 花几分钟先跑这一条：

```bash
cd frontend-vue && make e2e-list
```

历史 M0 期望是 25 个 spec 文件 / 120 个 `test()`。最终落地后，Vue M7 使用完整路径 inventory，
框架无关合同复用，框架特定行为由 Vue-owned spec 拥有；当前硬合同为 **25 个 spec 文件 /
130 个 `test()`**，并已连续三次 130/130。数量由 `playwright test --list` 在 CI 中实时打印，
后续增量不靠手改本文。

> ⚠️ 早期版本写的是「列不出 **25 个用例**」——`--list` 列的是 test case 不是 spec 文件，按 25 去比对会在第一次跑的时候直接把人带偏。

共享 spec 位于 `frontend/`，模块解析会从那里命中 `frontend/node_modules`；runner 位于 `frontend-vue/`。两边必须是同一个物理 Playwright 实例。采用以下方案：

```json
"@playwright/test": "link:../frontend/node_modules/@playwright/test"
```

这意味着 **clean checkout 必须先安装 `frontend/`，再安装 `frontend-vue/`**。本机已有 `frontend/node_modules` 不能算成功证据；workflow 必须显式完成两次 frozen install，并在 Vue install 前断言 link target 存在。若未来不接受双安装成本，应把合同 spec 和 Playwright runner 抽到仓库级共享 harness，而不是再发明 symlink 技巧。

### 选择器失效时的口径：spec 只读 + 豁免登记

Reka UI 与 Radix 的内部结构在个别组件上有出入，一定会有选择器对不上的时候。此时**不改 `frontend/`**——[06-migration-plan.md](06-migration-plan.md) 的「不做的事」是硬约束，而改 spec 或给 React 组件加 `data-testid` 都落在 `frontend/` 里。

采用的口径：

1. **spec 视为只读合同。** 差异由 Vue 侧消化——主动复刻 `data-slot` / `data-variant` 属性约定，让原选择器天然对上。这是选 shadcn-vue 的直接收益，绝大多数情况够用。
2. 实在对不上的，**记进豁免登记表**（下表），标编号、原因、影响的断言范围。
3. **豁免表只增不减地公开。** 它是「合同被侵蚀了多少」的唯一可见指标——一旦这张表开始变长，说明结构 1:1 正在失守，该停下来看而不是继续豁免。

| 编号                   | spec / 断言                    | 原因                                     | 替代验证手段 |
| ---------------------- | ------------------------------ | ---------------------------------------- | ------------ |
| EX-01                  | `landing.spec.ts`              | 落地页不迁（[01-scope.md](01-scope.md)） | 无需         |
| EX-02                  | `docs-localized-links.spec.ts` | 文档站不迁（[01-scope.md](01-scope.md)） | 无需         |
| _（后续新增在此追加）_ |                                |                                          |              |

### 真实规模

`frontend/` 的 E2E 不是两个 spec，实测是 **32 个 spec 文件 + 4 个 playwright config**：

| 目录                      | spec 数 | config                              | 是否进合同                             |
| ------------------------- | ------- | ----------------------------------- | -------------------------------------- |
| `tests/e2e/`              | 27      | `playwright.config.ts`              | ✅ 除下面两条豁免外全部                |
| `tests/e2e-auth/`         | 1       | `playwright.auth.config.ts`         | ✅ 需要对应的 Nuxt webServer           |
| `tests/e2e-real-backend/` | 3       | `playwright.real-backend.config.ts` | 当前已 3/3；完整边界见 [10](10-current-status-and-next.md) |
| `tests/e2e-record/`       | 1       | `playwright.record.config.ts`       | ❌ 录制工具，不是验收                  |

**明确豁免的 2 个**（测的是 Vue 版故意不做的东西，见 [01-scope.md](01-scope.md)）：

- `landing.spec.ts` —— 落地页不迁
- `docs-localized-links.spec.ts` —— 文档站不迁

最终 25 个完整路径 spec 是硬合同。已按模块分批挂到 [M4b / M5 / M6 / M7](06-migration-plan.md#里程碑总览)
并收口，不再依赖 basename 碰撞或 React DOM 细节。

## Makefile —— 唯一开发者入口

**决策：所有开发者命令走 `make`，`package.json` 的 `scripts` 只留 `postinstall`。**

理由有三条：

1. **与 `backend/` 对齐。** `backend/Makefile` 已经是这个形态（`dev` / `test` / `lint` / `format` / `migrate-rev`），仓库里已有先例。`frontend/` 用 pnpm 脚本是 create-t3-app 模板带来的，不是这个仓库的偏好
2. **CI 已经在调 `make verify`。** 仓库里那个 workflow 就是这么写的（见 [06 G0-0](06-migration-plan.md#g0-0--ci-workflow-对齐)），入口统一后不用两头改
3. **一个入口，不用记两套名字。** 不同时维护 `make ...` 与 `pnpm ...` 两套同义脚本，避免 CI 和本地命令漂移

```makefile
# frontend-vue/Makefile
#
# 唯一开发者入口。package.json 的 scripts 只保留 postinstall。
#
# 仓库 pnpm runner 在 M0 扩展 --dir 参数；默认行为仍指向 frontend/。
# 统一入口保证 direct pnpm 优先、Corepack fallback 和版本选择逻辑只有一份。

.PHONY: help install dev build preview start generate \
        lint lint-fix typecheck format format-write audit \
        docker-build container-smoke proxy-security \
        test test-watch e2e e2e-list e2e-auth e2e-real-backend e2e-visual e2e-preflight e2e-install \
        proxy-smoke auth-disabled-smoke visual-baseline-smoke ws-smoke oidc-smoke run-protocol-smoke \
        i18n-check i18n-diff i18n-unused \
        verify gen-api-types gen-api-types-check

PYTHON ?= python3
PNPM = $(PYTHON) ../scripts/pnpm.py --dir frontend-vue
EXEC  = $(PNPM) exec

DEV_PORT     ?= 3100
E2E_PORT     ?= 3101
IMAGE        ?= deer-flow-frontend-vue:ci

help:
	@echo "frontend-vue commands:"
	@echo "  make install        - Install dependencies"
	@echo "  make dev            - Nuxt dev server (port $(DEV_PORT))"
	@echo "  make build          - Production build (.output/)"
	@echo "  make preview        - Preview the build (port $(DEV_PORT))"
	@echo "  make verify         - Offline code gate: lint + format + types + i18n + build + unit tests"
	@echo "  make audit          - Fail on moderate-or-higher dependency advisories"
	@echo "  make container-smoke - Build the production image and verify health/SIGTERM"
	@echo "  make test           - Unit tests (Vitest, both projects)"
	@echo "  make e2e            - Contract E2E against ../frontend/tests/e2e"
	@echo "  make e2e-list       - Collect and print the shared contract inventory"
	@echo "  make e2e-auth       - Auth recovery contract"
	@echo "  make e2e-real-backend - Replay Gateway integration contract"
	@echo "  make e2e-visual     - Critical-state screenshot gate"
	@echo "  make proxy-smoke    - M0 preview HTTP/SSE proxy contract"
	@echo "  make ws-smoke       - M0 browser WebSocket contract"
	@echo "  make oidc-smoke     - M0 dual-origin OIDC contract"
	@echo "  make run-protocol-smoke - M0 create/resume/cancel/gap/heartbeat contract"
	@echo "  make gen-api-types  - Regenerate REST types from openapi.snapshot.json"

install:
	$(PNPM) install

## Dev / build
dev:
	$(EXEC) nuxt dev --port $(DEV_PORT)

build:
	$(EXEC) nuxt build

preview:
	PORT=$(DEV_PORT) $(EXEC) nuxt preview

start:
	node .output/server/index.mjs

generate:
	$(EXEC) nuxt generate

## Quality
lint:
	$(EXEC) eslint .

lint-fix:
	$(EXEC) eslint . --fix

typecheck:
	$(EXEC) vue-tsc --noEmit

format:
	$(EXEC) prettier --check .

format-write:
	$(EXEC) prettier --write .

audit:
	$(PNPM) audit --audit-level moderate

docker-build:
	docker build --tag $(IMAGE) .

container-smoke: docker-build
	./scripts/container-smoke.sh "$(IMAGE)"

proxy-security:
	$(EXEC) vitest run tests/unit/config/proxy-security.test.ts

## Tests
test:
	$(EXEC) vitest run

test-watch:
	$(EXEC) vitest

# testDir 指向 ../frontend/tests/e2e —— spec 是只读合同，见本文档 E2E 一节。
e2e: e2e-preflight
	$(EXEC) playwright test

e2e-list: e2e-preflight
	$(EXEC) playwright test --list

e2e-visual:
	$(EXEC) playwright test -c playwright.visual.config.ts

e2e-auth: e2e-preflight
	$(EXEC) playwright test -c playwright.auth.config.ts

e2e-real-backend: e2e-preflight
	$(EXEC) playwright test -c playwright.real-backend.config.ts

e2e-preflight:
	test -f ../frontend/node_modules/@playwright/test/package.json

e2e-install:
	$(EXEC) playwright install --with-deps chromium

# M0 专用 config 的 testDir=tests/m0；每个文件带唯一 tag，命令与 gate 一一对应。
proxy-smoke: e2e-preflight
	$(EXEC) playwright test -c playwright.m0.config.ts --grep @proxy

auth-disabled-smoke: e2e-preflight
	$(EXEC) playwright test -c playwright.m0.config.ts --grep @auth-disabled

visual-baseline-smoke: e2e-preflight
	$(EXEC) playwright test -c playwright.m0.config.ts --grep @visual-seed

ws-smoke: e2e-preflight
	$(EXEC) playwright test -c playwright.m0.config.ts --grep @ws

oidc-smoke: e2e-preflight
	$(EXEC) playwright test -c playwright.m0.config.ts --grep @oidc

run-protocol-smoke: e2e-preflight
	$(EXEC) playwright test -c playwright.m0.config.ts --grep @run-protocol

## i18n 词典体检
i18n-check:
	node scripts/i18n-manager.mjs check

i18n-diff:
	node scripts/i18n-manager.mjs diff

i18n-unused:
	node scripts/i18n-manager.mjs unused

## 门禁：CI 调的就是这个
verify: lint format typecheck i18n-check gen-api-types-check build test

## 由签入的 openapi.snapshot.json 生成 REST 类型（不依赖 Gateway 在线）
gen-api-types:
	$(EXEC) openapi-typescript ./openapi.snapshot.json -o ./app/core/api/types.gen.ts

gen-api-types-check:
	node scripts/check-api-types.mjs
```

> `verify` 用的是 make 的前置依赖（`verify: lint format typecheck ...`）而不是 `&&` 串联——任一目标失败即整体失败，且 `make -k` 可以一次跑完看全部问题。它保持可离线复跑；需要 registry/advisory 网络的 `make audit` 由 CI 另行执行，二者共同构成 M0 gate。

### 扩展 `scripts/pnpm.py`，不绕过仓库规则

M0 同步扩展根 runner：新增 `--dir frontend|frontend-vue`，默认仍为 `frontend`，并拒绝绝对路径、`..`、不存在目录和没有 `package.json` 的目录。`backend/tests/test_pnpm_script.py` 增加默认兼容、Vue 目录、非法目录三组测试。

这样现有 Makefile/doctor/check 行为不变，Vue 侧也遵守根 `AGENTS.md` 的 host pnpm 约束。不得用“新目录不属于既有流程”解释掉 source-of-truth。

## package.json

> 版本状态核实于 2026-08-03/04。**共享包一律对齐 `frontend/` 的版本**，理由见 [02-stack.md](02-stack.md#️-版本对齐约束)——`core/` 是原样搬过来的，依赖行为必须一致。

```json
{
  "name": "deer-flow-frontend-vue",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "postinstall": "nuxt prepare"
  },
  "dependencies": {
    "@deerflow/agent-core": "workspace:*",
    "@codemirror/lang-css": "^6.3.1",
    "@codemirror/lang-html": "^6.4.11",
    "@codemirror/lang-javascript": "^6.2.4",
    "@codemirror/lang-json": "^6.0.2",
    "@codemirror/lang-markdown": "^6.5.0",
    "@codemirror/lang-python": "^6.2.1",
    "@codemirror/language-data": "^6.5.2",
    "@tanstack/vue-query": "^5.101.4",
    "@tanstack/vue-virtual": "^3.13.35",
    "@types/hast": "^3.0.4",
    "@uiw/codemirror-theme-basic": "^4.25.4",
    "@uiw/codemirror-theme-monokai": "^4.25.4",
    "@vueuse/core": "^14.4.0",
    "best-effort-json-parser": "^1.2.1",
    "canvas-confetti": "^1.9.4",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "codemirror": "^6.0.2",
    "date-fns": "^4.1.0",
    "hast-util-to-jsx-runtime": "^2.3.6",
    "katex": "0.16.28",
    "lucide-vue-next": "^1.0.0",
    "marked": "17.0.6",
    "mermaid": "11.12.2",
    "motion-v": "^2.3.0",
    "nanoid": "^5.1.6",
    "pinia": "^4.0.2",
    "rehype-harden": "1.1.8",
    "rehype-katex": "7.0.1",
    "rehype-raw": "7.0.0",
    "rehype-sanitize": "6.0.0",
    "rehype-slug": "6.0.0",
    "reka-ui": "^2.10.1",
    "remark-gfm": "4.0.1",
    "remark-math": "6.0.0",
    "remark-parse": "11.0.0",
    "remark-rehype": "11.1.2",
    "remend": "^1.3.0",
    "shiki": "3.23.0",
    "splitpanes": "^4.1.2",
    "tailwind-merge": "^3.4.0",
    "tokenlens": "^1.3.1",
    "unified": "11.0.5",
    "unist-util-visit": "^5.0.0",
    "uuid": "^14.0.0",
    "vue": "3.5.40",
    "vue-router": "5.2.0",
    "vue-sonner": "^2.0.9",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@nuxt/eslint": "^1.16.0",
    "@nuxt/test-utils": "^4.0.3",
    "@nuxtjs/color-mode": "^4.0.1",
    "@pinia/nuxt": "^1.0.1",
    "@playwright/test": "link:../frontend/node_modules/@playwright/test",
    "@tailwindcss/vite": "4.1.18",
    "@types/node": "^22.19.0",
    "@vue/test-utils": "^2.4.11",
    "@vueuse/nuxt": "^14.4.0",
    "eslint": "^9.23.0",
    "eslint-plugin-vue": "^10.10.0",
    "happy-dom": "^20.11.1",
    "nuxt": "4.5.1",
    "openapi-typescript": "^7.13.0",
    "prettier": "^3.5.3",
    "prettier-plugin-tailwindcss": "^0.6.11",
    "shadcn-nuxt": "^2.8.1",
    "tailwindcss": "4.1.18",
    "tw-animate-css": "^1.4.0",
    "typescript": "^5.8.2",
    "typescript-eslint": "^8.27.0",
    "vitest": "^4.1.10",
    "vue-tsc": "^3.3.9"
  },
  "packageManager": "pnpm@10.26.2"
}
```

### 版本选择说明

**行为敏感依赖对齐 `frontend/pnpm-lock.yaml` 的 resolved version，不只对齐 caret 声明。** Tailwind、Markdown、KaTeX、Shiki 的输出会进入 DOM/截图；首轮达到 parity 后再逐包升级。

| 包                            | 采用                                   | npm latest | 原因                                                                                                                                                           |
| ----------------------------- | -------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nuxt` / `vue` / `vue-router` | `4.5.1` / `3.5.40` / `5.2.0`（精确锁） | —          | Nuxt 4.5.1 的官方 manifest 依赖 `vue-router ^5.2.0` 且要求 Node `^22.19.0`；不能再直依赖 Router 4 或 Node 20 类型                                              |
| `zod`                         | `^3.24.2`                              | 4.4.3      | 被搬运的 `core/` 文件（`core/auth/types.ts` 等）用了 zod，3→4 是破坏性变更。`core/auth/gateway-config.ts` 虽也用 zod，但它是纯服务端文件、本次不迁，不构成理由 |
| `shiki`                       | `3.23.0`（精确锁）                     | 4.4.1      | 高亮输出结构变化会破坏关键视觉截图基线                                                                                                                         |
| `typescript`                  | `^5.8.2`                               | 7.0.2      | TS 7 是 Go 重写版，`vue-tsc` 兼容性未验证                                                                                                                      |
| `katex`                       | `0.16.28`                              | 0.18.1     | 精确对齐现有 lockfile；输出结构变化会破坏视觉基线                                                                                                              |
| `nanoid`                      | `^5.1.6`                               | 6.0.1      | 与 `frontend/` 保持一致                                                                                                                                        |
| `tailwindcss`                 | `4.1.18`                               | 4.3.3      | 对齐当前 `frontend` lockfile；不能用同一 caret 代替相同行为                                                                                                    |
| `marked`                      | `17.0.6`                               | 18.0.7     | 对齐 Streamdown 当前解析结果；升 18 需重跑 raw Markdown fixture                                                                                                |
| `mermaid`                     | `11.12.2`                              | —          | 对齐当前 Streamdown 传递依赖，避免首轮直接跳到不同 SVG 输出                                                                                                    |

版本与代理假设的官方复核入口：[`nuxt@4.5.1` manifest](https://github.com/nuxt/nuxt/blob/v4.5.1/packages/nuxt/package.json)、[`@nuxt/nitro-server@4.5.1` manifest](https://github.com/nuxt/nuxt/blob/v4.5.1/packages/nitro-server/package.json)、[`h3@1.15.x` proxy implementation](https://github.com/unjs/h3/blob/v1.15.11/src/utils/proxy.ts)、[Nitro route-rule normalization](https://github.com/nitrojs/nitro/blob/v2.13.4/src/config/resolvers/route-rules.ts)。lockfile 落地后仍以 `pnpm why nuxt nitropack h3 vue-router` 的 resolved 结果和 `make audit` 为准，不能只信顶层 manifest。

wildcard proxy 必须覆盖 Nitro 已公开的 [proxy scope bypass advisory](https://github.com/nitrojs/nitro/security/advisories/GHSA-5w89-w975-hf9q) 与 [protocol-relative redirect advisory](https://github.com/nitrojs/nitro/security/advisories/GHSA-9phm-9p8f-hw5m)；即使 resolved version 已修复，也保留恶意编码路径回归，防止以后降级或换代理实现时复发。

**移除的包**

`@langchain/langgraph-sdk` 与 `@langchain/core` 的终态是移除，但必须等 M2 的 checkpoint/raw trace/fake upstream/real Gateway 四类证据全绿。此前 SDK 保留为开发期 oracle/fallback。终态替代为自写 REST client、生成的 REST 类型、富 Message 类型和显式 RunProtocol。

`openapi.snapshot.json` 是 Gateway `/openapi.json` 的签入快照，并在相邻 metadata 中记录 backend commit 与生成命令。`make gen-api-types-check` 临时生成后 diff，避免签入 spec 和 `types.gen.ts` 静默漂移。后端契约变更时二者同一提交更新；SSE 动态事件另走 raw trace contract，不能假装被 OpenAPI 覆盖。

**新增的直接依赖（原先由 streamdown 传递提供）**

`unified`、`remark-parse`、`remark-rehype`、`mermaid`、`marked` —— 自建 Markdown 层后需要直接声明。

**`@playwright/test` 用 `link:` 而不是版本号**

因为 `testDir` 指向 `../frontend/tests/e2e`，那些 spec 解析 `@playwright/test` 时会命中 `frontend/node_modules`。runner 与 spec 必须是**同一个物理实例**，否则收集不到用例。`link:` 让两边指向同一份安装，比声明同一个版本号可靠——后者装出来仍是两份。

代价：`frontend/` 必须已经 `pnpm install` 过。M0 的验证步骤里写清楚这个前置。

**需要留意的两个包**

| 包                               | 最后发布   | 判断                                                                                                                                                                                                                                                                                  |
| -------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hast-util-to-jsx-runtime` 2.3.6 | 2025-03-05 | 纯函数式工具库、无框架 peer、被 react-markdown 与 Streamdown 同时依赖，停在稳定态可接受。Vue 支持已核实（readme 有 "Example: Vue"，需 `elementAttributeNameCase: 'html'`）。**另已实测其 `lib/index.js` 不使用 `dangerouslySetInnerHTML`**——这是 Vue 移植最容易出问题的地方，它不存在 |
| `vue-sonner` 2.0.9               | 2025-10-01 | 小体量 toast 移植，功能面窄，风险可控                                                                                                                                                                                                                                                 |

**明确不使用**

`vue-codemirror`（停更 2022-08-27）—— 改为直接封装 CodeMirror 6 的 `EditorView`，约 60–80 行。CM6 内核本身活跃且框架无关。

## nuxt.config.ts

渲染路由规则本身不写在这里，全部来自 `config/routes.ts`（见下节）；
API 转发由 `server/routes/api/[...path].ts` 进入同一模块约束的 handler：

```ts
import tailwindcss from "@tailwindcss/vite";
import { csrRoutes, prerenderRoutes } from "./config/routes";

export default defineNuxtConfig({
  compatibilityDate: "2026-08-03",

  modules: [
    "shadcn-nuxt",
    "@nuxtjs/color-mode",
    "@pinia/nuxt",
    "@vueuse/nuxt",
    "@nuxt/eslint",
  ],

  css: ["~/assets/css/main.css"],
  vite: { plugins: [tailwindcss()] },

  // 关闭业务组件自动导入：126 个嵌套组件的自动命名会失控
  // （WorkspaceMessagesMessageList…），显式 import 才能与 frontend/ 的结构
  // 一一对应，迁移期间保持可追溯。
  components: { dirs: [] },

  colorMode: { classSuffix: "" }, // .dark 挂在 html 上，对齐 Tailwind
  shadcn: { prefix: "", componentDir: "./app/components/ui" },

  devServer: { port: 3100 }, // 与 frontend/(3000) 并行，见 07-parallel-run.md

  // 渲染规则全部来自 config/routes.ts，这里只做映射。
  // API proxy 不放在 routeRules：它会抢先于自定义安全 guard 接管请求。
  routeRules: {
    ...Object.fromEntries(csrRoutes.map((r) => [r, { ssr: false }])),
    ...Object.fromEntries(prerenderRoutes.map((r) => [r, { prerender: true }])),
  },

  runtimeConfig: {
    public: {
      // 留空 = 从 window.location.origin 拼 /api/langgraph，对齐
      // frontend/src/core/config/index.ts::getLangGraphBaseURL()。
      // 客户端 base URL 可由 NUXT_PUBLIC_* 运行时覆盖。
      langgraphBaseUrl: "",
      backendBaseUrl: "",

      // ⚠️ 对应 frontend 的 DEER_FLOW_AUTH_DISABLED —— E2E 合同的前置条件。
      // 见下方「E2E 必须能关掉鉴权」。
      authDisabled: "",

      // frontend 里还有两个 NEXT_PUBLIC_* 在用（实测 APP_VERSION 3 处、API_URL 1 处）
      appVersion: "",
      apiUrl: "",
    },
  },

  typescript: { typeCheck: false }, // 交给 make typecheck 里的 vue-tsc
});
```

### `config/routes.ts`：渲染分区与代理合同的单一来源

**路由规则不散在 `nuxt.config.ts` 里，抽成一个有单测的 config 模块。**

```ts
// frontend-vue/config/routes.ts

/** 产品区：纯客户端渲染 */
export const csrRoutes = [
  "/workspace/**",
  "/login",
  "/setup",
  "/auth/**",
] as const;

/** 营销区：构建期预渲染。⚠️ locale 在构建期定死，见「营销页预渲染的前提」 */
export const prerenderRoutes = ["/", "/pricing", "/about"] as const;

/**
 * 条件分支逐条复刻 frontend/next.config.js:30-79：显式配了外部地址就不再本地代理。
 * 该纯函数固定两个前缀到 upstream 的合同映射；生产 handler 复用相同前缀语义，
 * 但不能把返回值直接展开回 nuxt routeRules。
 */
export const buildProxyRules = (env = process.env) => {
  const gateway =
    env.DEER_FLOW_INTERNAL_GATEWAY_BASE_URL ?? "http://127.0.0.1:8001";
  return {
    ...(env.NUXT_PUBLIC_LANGGRAPH_BASE_URL
      ? {}
      : {
          "/api/langgraph/**": {
            proxy: { to: `${gateway}/api/**`, ...streamOpts },
          },
        }),
    ...(env.NUXT_PUBLIC_BACKEND_BASE_URL
      ? {}
      : { "/api/**": { proxy: { to: `${gateway}/api/**`, ...streamOpts } } }),
  };
};

/**
 * ⚠️ Nuxt 4.5.1 → nitropack 2.13.x → h3 1.15.x 会把这两个 flag 传给
 * proxyRequest。不带 streamRequest，h3 会先把整个请求体读进内存；sendStream
 * 则明确保持响应流式发送。G0-1 要带/不带各跑一遍确认差异。
 *
 * 但这两个 flag 不提供 body 上限。现有 nginx 的 client_max_body_size 20M 不会
 * 自动跟到独立 Nuxt 入口；生产必须由外层 nginx/ingress 重建同等限制，或改用
 * 有流式字节计数的受测 server handler，不能把“不会缓冲”误当成“有大小保护”。
 */
const streamOpts = { sendStream: true, streamRequest: true } as const;
```

> `buildProxyRules` 返回对象形式是为了让四组合单测显式固定 `to`、
> `sendStream`、`streamRequest` 合同；生产调用点是 `gateway-proxy.ts` 内的
> `proxyRequest`，不是 Nuxt `routeRules.proxy`。这两个字段和 production body
> limit 都由 preview E2E 实测。

**为什么值得多这一个文件**（做法参照内部项目 `nuxt-modern-starter` 的 `config/routes.ts`）：

1. **[M0 G0-1](06-migration-plan.md#m0-的十道-gate) 那条合同有地方放了。** 「`/api/langgraph/**` rewrite、`/api/**` 透传」原本只能人工验一次；现在 `buildProxyRules` 接受注入的 `env`，是个纯函数，可以直接单测，真正的 handler 行为再由 preview E2E 固定。
2. **两个 `NUXT_PUBLIC_*` 的条件分支能被穷举测。** 设 / 不设共 4 种组合，手工验容易漏。
3. **渲染分区是一份可读的清单**，不用在 `nuxt.config.ts` 里翻。将来加 `/workspace/settings` 之类的新路由时，改一处。

配套约定：`config/routes.ts` 的文件头写明「修改须同步 `tests/unit/config/routes.test.ts`」。

### ⚠️ 为什么生产代理必须进入 Nitro 产物而不是 `nitro.devProxy`

早期版本用的是 `nitro.devProxy`。**这是错的**——`devProxy` 只在 `nuxt dev` 生效，而本项目的 E2E `webServer` 跑的是 `nuxt build && nuxt preview`，那个进程里没有任何代理。

对照 Next 版：[`frontend/next.config.js:30-79`](../frontend/next.config.js) 的 `rewrites()` 在 `next start` 下**同样生效**，所以 Next 版在 E2E、preview、生产三种形态下的网络行为是一致的。用 devProxy 会让 Vue 版只在 dev 下正确，具体后果：

| 场景                      | devProxy 的后果                                                                                                                         |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 25 个合同 spec            | 靠 `page.route()` 侥幸能跑，但落在 mock-api 39 个 pattern **之外**的请求会 404，而 Next 版是打到 Gateway 的 —— 行为不等价，失败信息误导 |
| `tests/e2e-auth/`         | 直接不可用（M7 明确要接）                                                                                                               |
| `tests/e2e-real-backend/` | 直接不可用                                                                                                                              |
| production build 手工验证 | 全部 404                                                                                                                                |

M0 最终使用编译进 Nitro 产物的 server catch-all；dev / preview /
`node .output/server/index.mjs` 三种形态共用同一实现。最初计划的
`routeRules.proxy` 虽也会进产物，但实测会绕过 handler guard，因此不再作为
生产转发器。该修正不改变两个 public prefix 的合同。

**四个 M0 必须实测的点**（不要假设）：

1. **前缀语义** —— catch-all 必须先识别 `/api/langgraph/**` 并 rewrite 为 Gateway `/api/**`，普通 `/api/**` 原样透传。M0 要用两类真实 preview 请求确认，而不是靠源码推断。
2. **SSE 是否被缓冲** —— nginx 侧靠 `proxy_buffering off` 保证首字节即时到达。M0 用一个真实 run 确认 token 是逐条到达而不是攒到最后。现成脚本：`git show 44309ae7:frontend-vue/scripts/p0-nitro-proxy-sse.mjs`（它自起假 SSE upstream + Nuxt 断言帧到达；**但它跑的是 `nuxt dev`，要改成 `build && preview`**，并补一段 `\r\n\r\n` 分隔的用例，顺手把 [L1](05-invariants.md#l-自研-sse-transport-的补强项) 一起验了）。
3. **`sendStream` / `streamRequest` 的有无差异** —— 带与不带各跑一遍，确认 (a) SSE 逐帧到达 (b) 20 MB 上传不整个进内存。
4. **WebSocket 最终路径**（[G0-6](06-migration-plan.md#m0-的十道-gate)）——先测 routeRules；不支持 Upgrade 时必须落实已选的 Nuxt handler、Gateway origin 白名单或 nginx 入口，并用真实浏览器 Origin 验证。

### ⚠️ E2E 必须能关掉鉴权

[`frontend/playwright.config.ts:38`](../frontend/playwright.config.ts) 起 webServer 时传 `DEER_FLOW_AUTH_DISABLED: "1"`，由 [`frontend/src/core/auth/auth-disabled-user.ts:15`](../frontend/src/core/auth/auth-disabled-user.ts) 读 `process.env` 消费。`playwright.auth.config.ts` 的注释写明了原因：不关掉的话页面会在 `page.route()` 生效前就被重定向走。

**25 个合同 spec 全部依赖这个开关。** Vue 版把鉴权改成客户端 `middleware/auth.global.ts`，若无同等物，一进 `/workspace` 就跳 `/login`，全部红。

因此 `runtimeConfig.public.authDisabled` 从 M0 就要存在，由 `NUXT_PUBLIC_AUTH_DISABLED` 运行时注入，`auth.global.ts` 第一行判它。

`useRuntimeConfig()` 只能出现在 Nuxt plugin/middleware/setup 边界。`plugins/deerflow-runtime.ts` 启动时把三个值转换成普通 `DeerFlowRuntimeOptions` 注入；`core/config/index.ts`、API client 和测试只接收该普通对象，不能在纯函数或事件回调里临时调用 Nuxt composable。

> **连带的事实修正**：`auth-disabled-user.ts` 读 `process.env`，Nuxt 客户端产物里没有 `process.env`——它虽然落在 99 个初筛候选中，却**不能进入最终 `COPIED` 集**。实测 `core/` 里碰 `process.env` 的只有 2 个文件（另一个是 `auth/gateway-config.ts`，纯服务端，Vue 版不迁），量很小，但这一个正好在 E2E 的关键路径上。

### ⚠️ 营销页预渲染的前提

`prerender: true` 的产物在**构建期**定死，包括 locale。而 Next 版营销页是按 cookie 派生 locale 服务端渲染的。

当前三个页面是占位页，无所谓。但 [02-stack.md](02-stack.md) 里「将来替换真实内容时零迁移成本」这句话是有条件的——真营销页若需要多语言或个性化，要么改成 `swr` / `isr` 路由规则，要么改成客户端补水。**不是零成本，是「换一条 routeRule」的成本**，写清楚以免将来误判。

### 关于 `components: { dirs: [] }`

这条只关掉**用户目录**的自动导入。`shadcn-nuxt` 是通过 `components:dirs` hook 注册自己的目录的，因此 `ui/` 下的 shadcn 组件**可能仍然自动导入** —— M0 起项目时实测确认一次，然后在本文件记录结论。

无论结论是哪种都不影响方案：React 版本来就是显式 import，业务组件全部显式引用即可。写清楚是为了避免把 shadcn-nuxt 的默认行为误判成配置坏了。

## 路由映射

| 现在（Next App Router）                                        | 新（Nuxt pages）                                              | 渲染        |
| -------------------------------------------------------------- | ------------------------------------------------------------- | ----------- |
| `app/page.tsx`（落地页）                                       | `pages/index.vue` **占位**                                    | prerender   |
| —                                                              | `pages/pricing.vue` **占位**                                  | prerender   |
| —                                                              | `pages/about.vue` **占位**                                    | prerender   |
| `app/(auth)/login/page.tsx`                                    | `pages/login.vue`                                             | `ssr:false` |
| `app/(auth)/setup/page.tsx`                                    | `pages/setup.vue`                                             | `ssr:false` |
| `app/(auth)/auth/callback/page.tsx`                            | `pages/auth/callback.vue`                                     | `ssr:false` |
| `app/workspace/page.tsx`                                       | `pages/workspace/index.vue` → redirect `/workspace/chats/new` | `ssr:false` |
| `app/workspace/chats/page.tsx`                                 | `pages/workspace/chats/index.vue`                             | `ssr:false` |
| `app/workspace/chats/[thread_id]/page.tsx`                     | `pages/workspace/chats/[thread_id].vue`                       | `ssr:false` |
| `app/workspace/agents/page.tsx`                                | `pages/workspace/agents/index.vue`                            | `ssr:false` |
| `app/workspace/agents/new/page.tsx`                            | `pages/workspace/agents/new.vue`                              | `ssr:false` |
| `app/workspace/agents/[agent_name]/chats/[thread_id]/page.tsx` | `pages/workspace/agents/[agent_name]/chats/[thread_id].vue`   | `ssr:false` |
| `app/workspace/scheduled-tasks/page.tsx`                       | `pages/workspace/scheduled-tasks.vue`                         | `ssr:false` |
| `app/api/memory/**`                                            | **删除** —— 浏览器经 nginx 直连 `/api/memory`                 | —           |
| `app/mock/**`（12 个）                                         | **删除**                                                      | —           |
| `app/[lang]/docs/**`、`app/blog/**`                            | **删除**                                                      | —           |

`layout.tsx`（根 + `(auth)` + `workspace` + 各级嵌套）→ `layouts/{default,auth,workspace}.vue`，页面用 `definePageMeta({ layout: "workspace" })` 声明。

> `pathOfThread()` 对自定义 agent 名和 thread ID 做百分号编码——构造 Web UI 路径必须走它，不要手拼字符串。见 [05-invariants.md](05-invariants.md) K1。

## 服务端边界的变化

原有的服务端 cookie 读取只有 4 处，全部改为客户端读取（Nuxt 的 `useCookie` 或 `@vueuse/core`）：

| 文件                                      | 用途                          |
| ----------------------------------------- | ----------------------------- |
| `src/core/auth/server.ts`                 | 服务端读认证 cookie           |
| `src/core/i18n/server.ts`                 | 服务端派生 locale             |
| `src/core/i18n/cookies.ts:45`             | 动态 `import("next/headers")` |
| `src/app/workspace/workspace-content.tsx` | 服务端读 cookie               |

随之消失的两块复杂设计（`ssr: false` 下不再需要）：

1. **静态根边界约束** —— "根 layout 不得读 cookie、不得引 KaTeX/Streamdown 样式"，其唯一动机是保持落地页静态
2. **i18n 的双词典分裂** —— "公开服务端路由只加载一份词典、交互式 provider 持两份因为函数不能跨 RSC 边界"。客户端渲染下两份词典直接持有即可
