# 03 · 项目形态

项目位于仓库内的 `frontend-vue/`，与 `frontend/` 并存。并行运行与端口分配见 [07-parallel-run.md](07-parallel-run.md)。

## 目录结构

```
frontend-vue/
├── nuxt.config.ts
├── package.json                  # 完整内容见下方
├── tsconfig.json                 # extends ./.nuxt/tsconfig.json
├── components.json               # shadcn-vue CLI 配置
├── vitest.config.ts              # 双 project：node（纯 TS）+ nuxt（composable）
├── playwright.config.ts          # webServer 指向 nuxt preview :3100
├── playwright.auth.config.ts     # 对应 frontend/ 的 auth 套件
├── eslint.config.mjs
├── openapi.snapshot.json         # Gateway /openapi.json 的签入快照 → gen:api-types
├── pnpm-workspace.yaml           # ★ 嵌套 workspace，只含本目录 —— 见「agent-core 怎么被解析」
├── .prettierrc
├── .gitignore
├── README.md
│
├── config/                       # ★ 构建期配置的单一来源，被 nuxt.config.ts 消费
│   └── routes.ts                 #   proxy / ssr:false / prerender 三份路由规则 + 纯函数
│                                 #   —— 修改须同步 tests/unit/config/routes.test.ts
│
├── scripts/
│   └── i18n-manager.mjs          # ★ 词典体检：check / diff / unused（2,256 行词典，必须有工具）
│
├── packages/                     # ★ 可复用产物，与 app/ 平级
│   └── agent-core/               #   L1 协议无关内核 —— 其他项目整包搬走即可
│       ├── package.json          #   独立包，被 app/ 以 workspace:* 引用
│       ├── src/
│       │   ├── transport/
│       │   │   ├── sse-buffer.ts        # 分帧（CRLF 归一化 + buffer 上限）
│       │   │   ├── parse-sse-event.ts   # 解析 event/data/id（只剥一个空格）
│       │   │   └── stream-reader.ts     # 连接 / 重试 / 指数退避 / abort
│       │   ├── cursor/strategy.ts       # CursorStrategy 接口（协议差异最大处）
│       │   ├── reducer/create-reducer.ts# 泛型骨架 + 通用归属规则，纯函数
│       │   ├── merge/merge-message.ts   # 增量合并（禁模块级可变状态）
│       │   ├── watchdog/stream-watchdog.ts
│       │   ├── store/create-agent-store.ts # 工厂，非单例
│       │   └── types/contract.ts        # AgentMessage / SseFrame / 错误分类
│       ├── adapters/
│       │   └── use-stream-compat.ts     # M2 探针产物：用 L1 实现 SDK useStream 形状
│       └── tests/                       # 内核自己的单测，随包搬走
│
├── app/                          # Nuxt 4 srcDir —— @/* 与 ~/* 均指向此处
│   ├── app.vue
│   ├── assets/
│   │   └── css/
│   │       └── main.css          # ← 由 frontend/src/styles/ 直接搬（Tailwind 4 + CSS 变量主题）
│   │
│   ├── core/                     # ★ 由 frontend/src/core/ 原样搬，99 个零改动 + 24 个改 import
│   │   │
│   │   ├── agent-deerflow/       #   ★ L3 协议适配层 —— 随项目走，不可复用
│   │   │   ├── endpoints.ts             # /threads/:id/runs/stream · join · cancel
│   │   │   ├── cursor-last-event-id.ts  # CursorStrategy 实现
│   │   │   ├── event-map.ts             # values/messages-tuple/updates/custom → 动作
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
│   │   │   └── plugins.ts                # ← 原样搬（含 rehypeStreamingListItems）
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
│   ├── stores/                   # ← 新增：由 createAgentStore() 工厂生成，非全局单例
│   │   └── register.ts                  # 把 deerflow 适配层接到内核 store 工厂
│   │
│   ├── components/
│   │   ├── ui/                   # shadcn-vue CLI 生成（30 个）+ 手写（resizable + 4 特效）
│   │   ├── elements/             # ← 原 ai-elements/，29 个手写
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
├── server/                       # 目前为空；营销页需要接口时再加 Nitro route
├── public/                       # 仅 favicon + logo（demo 资产 15 MB 全删）
│
└── tests/
    ├── architecture.test.ts      # ★ 依赖方向与内核禁入清单的自动守护（M0 就建）
    ├── structural-diff.spec.ts   # ★ 自有 E2E：同一脚本对两个 baseURL 各跑一遍，
    │                             #   dump 归一化 DOM 做 diff（见 04 §7）。不碰 frontend/
    ├── fixtures/
    │   └── threads/              # ← 由 frontend/public/demo/threads/ 拷入
    │                             #   13 个真实会话 / 516 条真实消息，M2 差分测试语料
    └── unit/                     # Vitest，镜像 app/ 结构
        ├── core/                 # ← 由 frontend/tests/unit/core/ 原样搬（126 个测试文件）
        ├── config/
        │   └── routes.test.ts    # ★ 锁定代理前缀优先级与渲染分区（M0 G0-1 的永久回归）
        ├── middleware/
        │   └── auth.test.ts      # ★ 锁定鉴权决策纯函数（M0 G0-3 的永久回归）
        └── agent-deerflow/       # ← 适配层测试（内核自己的测试在 packages/agent-core/tests/）
```

**E2E 不在 `frontend-vue/tests/` 下重建**（`structural-diff.spec.ts` 除外，它是自有的结构比对，不是合同 spec）。见下文 [E2E 一节](#e2e共用-frontendtestse2e不复制)。

### `packages/agent-core/` 怎么被解析

方案要求它「整包搬走、零改动」，因此它必须是一个**真包**而不是一个被相对路径 import 的目录。仓库根没有 `pnpm-workspace.yaml`（已确认），但 `frontend-vue/` 可以有自己的一份——这仍然是零仓库改动，因为文件落在本目录内：

```yaml
# frontend-vue/pnpm-workspace.yaml
packages:
  - "."
  - "packages/*"
```

然后 `app/` 用 `"@deerflow/agent-core": "workspace:*"` 引用。

**不这么做的后果**（早期版本写的「通过相对路径引用，不需要 workspace 协议」是错的）：

- `packages/agent-core/package.json` 里声明的依赖**不会被安装**——pnpm 只装 `frontend-vue/package.json`
- 它的 `exports` / `types` 字段不生效，消费方得写 `~~/packages/agent-core/src/index` 这种深路径
- 「搬走零改动」的承诺随即不成立：复用方拿到的包，其依赖清单从没被验证过

### Rstest 转 Vitest：先写 codemod，不要手改

M1 要搬 126 个测试文件。两者的 `describe` / `it` / `expect` 兼容，但 mock 层不同（`rstest.mock` / `rstest.fn` / `rstest.spyOn` ↔ `vi.*`），以及 `import { rstest } from "@rstest/core"` 这一行本身。

先写一个 codemod + 一张对照表跑一遍，剩下的手工收尾。逐个手改 126 个文件既慢又容易在替换 mock 语义时引入静默差异——而这批测试正是 [05-invariants.md](05-invariants.md) C / F 组语义的唯一保真手段，不能带伤。

### `scripts/i18n-manager.mjs`：词典体检

frontend-vue 保留自研 i18n（[04 §5](04-architecture-decisions.md#5-i18n-保留自研不引-vue-i18n)），搬过来的是：

| 文件 | 行数 |
| --- | --- |
| `core/i18n/locales/en-US.ts` | 1,155 |
| `core/i18n/locales/zh-CN.ts` | 1,101 |
| `core/i18n/locales/types.ts` | 914 |

**两千多条文案、两份词典、零工具。** 重写 133 个组件期间最容易发生的就是漏 key、两份词典不同步、留下一堆再没人用的 key——而这三类问题**编译器都不会报**（`types.ts` 只约束结构，不约束"每个 key 都被用到"）。

照 `nuxt-modern-starter` 的 `i18n-manager.mjs` 做一个，三个子命令：

| 命令 | 作用 |
| --- | --- |
| `i18n:diff` | 列出 `en-US` 与 `zh-CN` 的 key 差集——**任一边缺 key 就该红** |
| `i18n:unused` | 扫 `app/` 找出没有任何引用的 key。移植期间用来确认"这个 key 是不是跟着不迁的模块一起废了" |
| `i18n:check` | 上面两项的 CI 形态，进 `pnpm quality` |

差别：那个项目的词典是 JSON，这里是 TS 模块，扫描要走 AST（或直接 `import` 后遍历对象，反正是纯数据）。

### 为什么 `core/` 放在 `app/core/`

Nuxt 4 的 `srcDir` 默认是 `app/`，且 `@` 与 `~` 别名都指向 `srcDir`。

因此 `app/core/` 让现有的 `@/core/...`、`@/components/...`、`@/lib/...` **import 路径完全不变**——14,600 行纯 TS 连 import 语句都不用改。这是把移植风险压到最低的关键安排。

注意：`app/core/utils/` 与 Nuxt 的自动导入目录 `app/utils/` 不冲突（后者不存在）。

## E2E：共用 `frontend/tests/e2e/`，不复制

E2E 是 1:1 的验收合同。**复制一份 spec 到 `frontend-vue/` 会漂移，合同随即失效**，所以不复制——Vue 版的 playwright config 直接把 `testDir` 指向 Next 版的目录：

```ts
// frontend-vue/playwright.config.ts
export default defineConfig({
  testDir: "../frontend/tests/e2e",
  // 两个明确豁免项（Vue 版故意不做的东西）——在本文件里排除，
  // 不去动 frontend/ 的任何文件。
  testIgnore: ["**/landing.spec.ts", "**/docs-localized-links.spec.ts"],
  use: { baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100" },
  webServer: {
    command: "./node_modules/.bin/nuxt build && ./node_modules/.bin/nuxt preview --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      // 对应 frontend/playwright.config.ts:38 的 DEER_FLOW_AUTH_DISABLED=1
      NUXT_PUBLIC_AUTH_DISABLED: "1",
    },
  },
});
```

`page.route()` 在浏览器侧拦截，不经过 nginx，所以 E2E 直接打 :3100 即可——前提是应用发出的 URL 与 Next 版一致（见 [07-parallel-run.md](07-parallel-run.md)）。

### ⚠️ M0 必须先验证 spec 能被收集到

好消息先说：实测 27 个 spec **只 import 两样东西**——`@playwright/test` 和 `./utils/mock-api`，没有任何 `@/` 别名依赖。所以不需要为共用 testDir 配 tsconfig paths。

但有一个必须先验证的：`frontend/tests/e2e/*.spec.ts` 解析 `@playwright/test` 时会沿目录上溯命中 **`frontend/node_modules`**，而 runner 在 `frontend-vue/node_modules`。两个物理实例注册到不同的 registry，典型症状是 `Playwright Test did not expect test() to be called here`，或者干脆收集到 0 个用例——**两边都声明 `^1.59.1` 也不行，pnpm 装的是两份**。

M0 花几分钟先跑这一条：

```bash
cd frontend-vue && pnpm exec playwright test --list
```

列不出 25 个用例就立刻处理。最省事的修法是让两边指向同一份物理安装：

```json
"@playwright/test": "link:../frontend/node_modules/@playwright/test"
```

（这是 `frontend-vue/package.json` 里的一行，仍属零仓库改动。）

### 选择器失效时的口径：spec 只读 + 豁免登记

Reka UI 与 Radix 的内部结构在个别组件上有出入，一定会有选择器对不上的时候。此时**不改 `frontend/`**——[06-migration-plan.md](06-migration-plan.md) 的「不做的事」是硬约束，而改 spec 或给 React 组件加 `data-testid` 都落在 `frontend/` 里。

采用的口径：

1. **spec 视为只读合同。** 差异由 Vue 侧消化——主动复刻 `data-slot` / `data-variant` 属性约定，让原选择器天然对上。这是选 shadcn-vue 的直接收益，绝大多数情况够用。
2. 实在对不上的，**记进豁免登记表**（下表），标编号、原因、影响的断言范围。
3. **豁免表只增不减地公开。** 它是「合同被侵蚀了多少」的唯一可见指标——一旦这张表开始变长，说明结构 1:1 正在失守，该停下来看而不是继续豁免。

| 编号 | spec / 断言 | 原因 | 替代验证手段 |
| --- | --- | --- | --- |
| EX-01 | `landing.spec.ts` | 落地页不迁（[01-scope.md](01-scope.md)） | 无需 |
| EX-02 | `docs-localized-links.spec.ts` | 文档站不迁（[01-scope.md](01-scope.md)） | 无需 |
| _（后续新增在此追加）_ | | | |

### 真实规模

`frontend/` 的 E2E 不是两个 spec，实测是 **32 个 spec 文件 + 4 个 playwright config**：

| 目录 | spec 数 | config | 是否进合同 |
| --- | --- | --- | --- |
| `tests/e2e/` | 27 | `playwright.config.ts` | ✅ 除下面两条豁免外全部 |
| `tests/e2e-auth/` | 1 | `playwright.auth.config.ts` | ✅ 需要对应的 Nuxt webServer |
| `tests/e2e-real-backend/` | 3 | `playwright.real-backend.config.ts` | ⏸ M7 再接，需真实后端 |
| `tests/e2e-record/` | 1 | `playwright.record.config.ts` | ❌ 录制工具，不是验收 |

**明确豁免的 2 个**（测的是 Vue 版故意不做的东西，见 [01-scope.md](01-scope.md)）：

- `landing.spec.ts` —— 落地页不迁
- `docs-localized-links.spec.ts` —— 文档站不迁

其余 25 个是硬合同。按模块分批挂到 [M4b / M5 / M6](06-migration-plan.md#里程碑总览) 上，不要攒到 M7 一次性跑。

## package.json

> 版本状态核实于 2026-08-03/04。**共享包一律对齐 `frontend/` 的版本**，理由见 [02-stack.md](02-stack.md#️-版本对齐约束)——`core/` 是原样搬过来的，依赖行为必须一致。

```json
{
  "name": "deer-flow-frontend-vue",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "nuxt dev --port 3100",
    "build": "nuxt build",
    "preview": "nuxt preview --port 3100",
    "start": "node .output/server/index.mjs",
    "generate": "nuxt generate",
    "postinstall": "nuxt prepare",
    "check": "eslint . && vue-tsc --noEmit",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "typecheck": "vue-tsc --noEmit",
    "format": "prettier --check .",
    "format:write": "prettier --write .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "i18n:check": "node scripts/i18n-manager.mjs check",
    "i18n:diff": "node scripts/i18n-manager.mjs diff",
    "i18n:unused": "node scripts/i18n-manager.mjs unused",
    "quality": "pnpm lint && pnpm format && pnpm typecheck && pnpm i18n:check && pnpm build && pnpm test",
    "gen:api-types": "openapi-typescript ./openapi.snapshot.json -o ./app/core/api/types.gen.ts"
  },
  "dependencies": {
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
    "katex": "^0.16.28",
    "lucide-vue-next": "^1.0.0",
    "marked": "^17.0.1",
    "mermaid": "^11.16.0",
    "motion-v": "^2.3.0",
    "nanoid": "^5.1.6",
    "pinia": "^4.0.2",
    "rehype-harden": "^1.1.8",
    "rehype-katex": "^7.0.1",
    "rehype-raw": "^7.0.0",
    "rehype-sanitize": "^6.0.0",
    "rehype-slug": "^6.0.0",
    "reka-ui": "^2.10.1",
    "remark-gfm": "^4.0.1",
    "remark-math": "^6.0.0",
    "remark-parse": "^11.0.0",
    "remark-rehype": "^11.1.2",
    "remend": "^1.3.0",
    "shiki": "3.23.0",
    "splitpanes": "^4.1.2",
    "tailwind-merge": "^3.4.0",
    "tokenlens": "^1.3.1",
    "unified": "^11.0.5",
    "unist-util-visit": "^5.0.0",
    "uuid": "^14.0.0",
    "vue": "^3.5.40",
    "vue-router": "^4.5.0",
    "vue-sonner": "^2.0.9",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@nuxt/eslint": "^1.16.0",
    "@nuxt/test-utils": "^4.0.3",
    "@nuxtjs/color-mode": "^4.0.1",
    "@pinia/nuxt": "^1.0.1",
    "@playwright/test": "link:../frontend/node_modules/@playwright/test",
    "@tailwindcss/vite": "^4.0.15",
    "@types/node": "^20.14.10",
    "@vue/test-utils": "^2.4.11",
    "@vueuse/nuxt": "^14.4.0",
    "eslint": "^9.23.0",
    "eslint-plugin-vue": "^10.10.0",
    "happy-dom": "^20.11.1",
    "nuxt": "^4.5.1",
    "openapi-typescript": "^7.13.0",
    "prettier": "^3.5.3",
    "prettier-plugin-tailwindcss": "^0.6.11",
    "shadcn-nuxt": "^2.8.1",
    "tailwindcss": "^4.0.15",
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

**刻意对齐 `frontend/`（不用 latest）**

| 包 | 采用 | npm latest | 原因 |
| --- | --- | --- | --- |
| `zod` | `^3.24.2` | 4.4.3 | 被搬运的 `core/` 文件（`core/auth/types.ts` 等）用了 zod，3→4 是破坏性变更。`core/auth/gateway-config.ts` 虽也用 zod，但它是纯服务端文件、本次不迁，不构成理由 |
| `shiki` | `3.23.0`（精确锁） | 4.4.1 | 高亮输出结构变化会直接破坏视觉 1:1 |
| `typescript` | `^5.8.2` | 7.0.2 | TS 7 是 Go 重写版，`vue-tsc` 兼容性未验证 |
| `katex` | `^0.16.28` | 0.18.1 | 输出结构变化会破坏 1:1 |
| `nanoid` | `^5.1.6` | 6.0.1 | 与 `frontend/` 保持一致 |
| `tailwindcss` | `^4.0.15` | 4.3.3 | caret 范围内自动取新 4.x，与 `frontend/` 声明一致 |
| `marked` | `^17.0.1` | 18.0.7 | 对齐 Streamdown 内部使用的版本。`preprocess.ts` 的嵌套截断阈值是针对该版本的递归行为调的（见 issue #3393），升 18 需重新验证 |

**移除的包**

`@langchain/langgraph-sdk`（4.7 MB）与 `@langchain/core`（7.6 MB）全部移除，理由见 [04 §4](04-architecture-decisions.md#langchain-依赖全部去掉)。替代为自写的 `core/api/client.ts` + `openapi-typescript` 生成的 REST 类型 + 手写的 Message 类型。

`openapi.snapshot.json` 是 Gateway `/openapi.json` 的签入快照，避免类型生成依赖 Gateway 在线。后端契约变更时重新拉取并提交。

**新增的直接依赖（原先由 streamdown 传递提供）**

`unified`、`remark-parse`、`remark-rehype`、`mermaid`、`marked` —— 自建 Markdown 层后需要直接声明。

**`@playwright/test` 用 `link:` 而不是版本号**

因为 `testDir` 指向 `../frontend/tests/e2e`，那些 spec 解析 `@playwright/test` 时会命中 `frontend/node_modules`。runner 与 spec 必须是**同一个物理实例**，否则收集不到用例。`link:` 让两边指向同一份安装，比声明同一个版本号可靠——后者装出来仍是两份。

代价：`frontend/` 必须已经 `pnpm install` 过。M0 的验证步骤里写清楚这个前置。

**需要留意的两个包**

| 包 | 最后发布 | 判断 |
| --- | --- | --- |
| `hast-util-to-jsx-runtime` 2.3.6 | 2025-03-05 | 纯函数式工具库、无框架 peer、被 react-markdown 与 Streamdown 同时依赖，停在稳定态可接受。Vue 支持已核实（readme 有 "Example: Vue"，需 `elementAttributeNameCase: 'html'`）。**另已实测其 `lib/index.js` 不使用 `dangerouslySetInnerHTML`**——这是 Vue 移植最容易出问题的地方，它不存在 |
| `vue-sonner` 2.0.9 | 2025-10-01 | 小体量 toast 移植，功能面窄，风险可控 |

**明确不使用**

`vue-codemirror`（停更 2022-08-27）—— 改为直接封装 CodeMirror 6 的 `EditorView`，约 60–80 行。CM6 内核本身活跃且框架无关。

## nuxt.config.ts

路由规则本身不写在这里，全部来自 `config/routes.ts`（见下节）：

```ts
import tailwindcss from "@tailwindcss/vite";
import { buildProxyRules, csrRoutes, prerenderRoutes } from "./config/routes";

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

  // 关闭业务组件自动导入：133 个嵌套组件的自动命名会失控
  // （WorkspaceMessagesMessageList…），显式 import 才能与 frontend/ 的结构
  // 一一对应，迁移期间保持可追溯。
  components: { dirs: [] },

  colorMode: { classSuffix: "" },   // .dark 挂在 html 上，对齐 Tailwind
  shadcn: { prefix: "", componentDir: "./app/components/ui" },

  devServer: { port: 3100 },        // 与 frontend/(3000) 并行，见 07-parallel-run.md

  // 三份规则全部来自 config/routes.ts，这里只做映射。
  // ⚠️ 顺序有意义：代理规则在前，见 config/routes.ts 的说明。
  routeRules: {
    ...buildProxyRules(),
    ...Object.fromEntries(csrRoutes.map((r) => [r, { ssr: false }])),
    ...Object.fromEntries(prerenderRoutes.map((r) => [r, { prerender: true }])),
  },

  runtimeConfig: {
    public: {
      // 留空 = 从 window.location.origin 拼 /api/langgraph，对齐
      // frontend/src/core/config/index.ts::getLangGraphBaseURL()。
      // 运行时可由 NUXT_PUBLIC_LANGGRAPH_BASE_URL / NUXT_PUBLIC_BACKEND_BASE_URL 覆盖
      // ——这点比 Next 的构建期内联 NEXT_PUBLIC_* 更灵活。
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

  typescript: { typeCheck: false },   // 交给 pnpm check 里的 vue-tsc
});
```

### `config/routes.ts`：渲染分区与代理的单一来源

**路由规则不散在 `nuxt.config.ts` 里，抽成一个有单测的 config 模块。**

```ts
// frontend-vue/config/routes.ts

/** 产品区：纯客户端渲染 */
export const csrRoutes = ["/workspace/**", "/login", "/setup", "/auth/**"] as const;

/** 营销区：构建期预渲染。⚠️ locale 在构建期定死，见「营销页预渲染的前提」 */
export const prerenderRoutes = ["/", "/pricing", "/about"] as const;

const gateway =
  process.env.DEER_FLOW_INTERNAL_GATEWAY_BASE_URL ?? "http://127.0.0.1:8001";

/**
 * 条件分支逐条复刻 frontend/next.config.js:30-79：显式配了外部地址就不再本地代理。
 * ⚠️ 插入顺序：langgraph 前缀必须在 /api/** 兜底之前 —— 与 next.config.js 里那条
 * NOTE 同源。Nitro 按具体度匹配，但这是本方案的命门，由单测锁定而不是靠推断。
 */
export const buildProxyRules = (env = process.env) => ({
  ...(env.NUXT_PUBLIC_LANGGRAPH_BASE_URL
    ? {}
    : { "/api/langgraph/**": { proxy: `${gateway}/api/**` } }),
  ...(env.NUXT_PUBLIC_BACKEND_BASE_URL
    ? {}
    : { "/api/**": { proxy: `${gateway}/api/**` } }),
});
```

**为什么值得多这一个文件**（做法参照内部项目 `nuxt-modern-starter` 的 `config/routes.ts`）：

1. **[M0 G0-1](06-migration-plan.md#m0-的四道-gate) 那条断言有地方放了。** 「`/api/langgraph/**` 是否比 `/api/**` 优先命中」原本只能人工验一次；现在 `buildProxyRules` 接受注入的 `env`，是个纯函数，可以直接单测——G0-1 从一次性检查变成永久回归。
2. **两个 `NUXT_PUBLIC_*` 的条件分支能被穷举测。** 设 / 不设共 4 种组合，手工验容易漏。
3. **渲染分区是一份可读的清单**，不用在 `nuxt.config.ts` 里翻。将来加 `/workspace/settings` 之类的新路由时，改一处。

配套约定：`config/routes.ts` 的文件头写明「修改须同步 `tests/unit/config/routes.test.ts`」。

### ⚠️ 为什么代理必须是 `routeRules` 而不是 `nitro.devProxy`

早期版本用的是 `nitro.devProxy`。**这是错的**——`devProxy` 只在 `nuxt dev` 生效，而本项目的 E2E `webServer` 跑的是 `nuxt build && nuxt preview`，那个进程里没有任何代理。

对照 Next 版：[`frontend/next.config.js:30-79`](../frontend/next.config.js) 的 `rewrites()` 在 `next start` 下**同样生效**，所以 Next 版在 E2E、preview、生产三种形态下的网络行为是一致的。用 devProxy 会让 Vue 版只在 dev 下正确，具体后果：

| 场景 | devProxy 的后果 |
| --- | --- |
| 25 个合同 spec | 靠 `page.route()` 侥幸能跑，但落在 mock-api 39 个 pattern **之外**的请求会 404，而 Next 版是打到 Gateway 的 —— 行为不等价，失败信息误导 |
| `tests/e2e-auth/` | 直接不可用（M7 明确要接） |
| `tests/e2e-real-backend/` | 直接不可用 |
| production build 手工验证 | 全部 404 |

`routeRules` 的 `proxy` 编译进 Nitro 产物，dev / preview / `node .output/server/index.mjs` 三种形态共用同一份规则，与 Next 的 `rewrites` 同构。

**两个 M0 必须实测的点**（不要假设）：

1. **匹配优先级** —— Nitro 的 routeRules 走 radix 匹配，理论上 `/api/langgraph/**` 比 `/api/**` 更具体因而胜出。但这是本方案的命门（前缀语义反了会静默把 SSE 打到错误路径），M0 要用真实请求确认，而不是靠推断。
2. **SSE 是否被缓冲** —— nginx 侧靠 `proxy_buffering off` 保证首字节即时到达。Nitro 的代理理论上是流式转发，M0 用一个真实 run 确认 token 是逐条到达而不是攒到最后。

### ⚠️ E2E 必须能关掉鉴权

[`frontend/playwright.config.ts:38`](../frontend/playwright.config.ts) 起 webServer 时传 `DEER_FLOW_AUTH_DISABLED: "1"`，由 [`frontend/src/core/auth/auth-disabled-user.ts:15`](../frontend/src/core/auth/auth-disabled-user.ts) 读 `process.env` 消费。`playwright.auth.config.ts` 的注释写明了原因：不关掉的话页面会在 `page.route()` 生效前就被重定向走。

**25 个合同 spec 全部依赖这个开关。** Vue 版把鉴权改成客户端 `middleware/auth.global.ts`，若无同等物，一进 `/workspace` 就跳 `/login`，全部红。

因此 `runtimeConfig.public.authDisabled` 从 M0 就要存在，由 `NUXT_PUBLIC_AUTH_DISABLED` 运行时注入，`auth.global.ts` 第一行判它。

> **连带的事实修正**：`auth-disabled-user.ts` 读 `process.env`，Nuxt 客户端产物里没有 `process.env`——它**不能算进「99 个零改动」**。实测 `core/` 里碰 `process.env` 的只有 2 个文件（另一个是 `auth/gateway-config.ts`，纯服务端，Vue 版不迁），量很小，但这一个正好在 E2E 的关键路径上。

### ⚠️ 营销页预渲染的前提

`prerender: true` 的产物在**构建期**定死，包括 locale。而 Next 版营销页是按 cookie 派生 locale 服务端渲染的。

当前三个页面是占位页，无所谓。但 [02-stack.md](02-stack.md) 里「将来替换真实内容时零迁移成本」这句话是有条件的——真营销页若需要多语言或个性化，要么改成 `swr` / `isr` 路由规则，要么改成客户端补水。**不是零成本，是「换一条 routeRule」的成本**，写清楚以免将来误判。

### 关于 `components: { dirs: [] }`

这条只关掉**用户目录**的自动导入。`shadcn-nuxt` 是通过 `components:dirs` hook 注册自己的目录的，因此 `ui/` 下的 shadcn 组件**可能仍然自动导入** —— M0 起项目时实测确认一次，然后在本文件记录结论。

无论结论是哪种都不影响方案：React 版本来就是显式 import，业务组件全部显式引用即可。写清楚是为了避免把 shadcn-nuxt 的默认行为误判成配置坏了。

## 路由映射

| 现在（Next App Router） | 新（Nuxt pages） | 渲染 |
| --- | --- | --- |
| `app/page.tsx`（落地页） | `pages/index.vue` **占位** | prerender |
| — | `pages/pricing.vue` **占位** | prerender |
| — | `pages/about.vue` **占位** | prerender |
| `app/(auth)/login/page.tsx` | `pages/login.vue` | `ssr:false` |
| `app/(auth)/setup/page.tsx` | `pages/setup.vue` | `ssr:false` |
| `app/(auth)/auth/callback/page.tsx` | `pages/auth/callback.vue` | `ssr:false` |
| `app/workspace/page.tsx` | `pages/workspace/index.vue` → redirect `/workspace/chats/new` | `ssr:false` |
| `app/workspace/chats/page.tsx` | `pages/workspace/chats/index.vue` | `ssr:false` |
| `app/workspace/chats/[thread_id]/page.tsx` | `pages/workspace/chats/[thread_id].vue` | `ssr:false` |
| `app/workspace/agents/page.tsx` | `pages/workspace/agents/index.vue` | `ssr:false` |
| `app/workspace/agents/new/page.tsx` | `pages/workspace/agents/new.vue` | `ssr:false` |
| `app/workspace/agents/[agent_name]/chats/[thread_id]/page.tsx` | `pages/workspace/agents/[agent_name]/chats/[thread_id].vue` | `ssr:false` |
| `app/workspace/scheduled-tasks/page.tsx` | `pages/workspace/scheduled-tasks.vue` | `ssr:false` |
| `app/api/memory/**` | **删除** —— 浏览器经 nginx 直连 `/api/memory` | — |
| `app/mock/**`（12 个） | **删除** | — |
| `app/[lang]/docs/**`、`app/blog/**` | **删除** | — |

`layout.tsx`（根 + `(auth)` + `workspace` + 各级嵌套）→ `layouts/{default,auth,workspace}.vue`，页面用 `definePageMeta({ layout: "workspace" })` 声明。

> `pathOfThread()` 对自定义 agent 名和 thread ID 做百分号编码——构造 Web UI 路径必须走它，不要手拼字符串。见 [05-invariants.md](05-invariants.md) K1。

## 服务端边界的变化

原有的服务端 cookie 读取只有 4 处，全部改为客户端读取（Nuxt 的 `useCookie` 或 `@vueuse/core`）：

| 文件 | 用途 |
| --- | --- |
| `src/core/auth/server.ts` | 服务端读认证 cookie |
| `src/core/i18n/server.ts` | 服务端派生 locale |
| `src/core/i18n/cookies.ts:45` | 动态 `import("next/headers")` |
| `src/app/workspace/workspace-content.tsx` | 服务端读 cookie |

随之消失的两块复杂设计（`ssr: false` 下不再需要）：

1. **静态根边界约束** —— "根 layout 不得读 cookie、不得引 KaTeX/Streamdown 样式"，其唯一动机是保持落地页静态
2. **i18n 的双词典分裂** —— "公开服务端路由只加载一份词典、交互式 provider 持两份因为函数不能跨 RSC 边界"。客户端渲染下两份词典直接持有即可
