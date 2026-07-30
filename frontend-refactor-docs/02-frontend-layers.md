# 02 · 前端分层与目录职责

## 2.1 技术栈基线

| 项 | 版本 / 选型 |
| --- | --- |
| 框架 | Next.js `^16.2.11`（App Router，Turbopack dev） |
| UI 运行时 | React `^19.0.0` |
| 语言 | TypeScript `^5.8.2`（`strict: true`，`noUncheckedIndexedAccess: true`，`verbatimModuleSyntax: true`，但 `noImplicitAny: false`） |
| 样式 | Tailwind CSS `^4.0.15`（`@import` 语法 + CSS 变量主题） |
| 包管理 | pnpm `10.26.2`（Node 22+） |
| Agent 编排 | `@langchain/langgraph-sdk` `^1.5.3` + `@langchain/core` `^1.1.15` |
| 服务端状态 | `@tanstack/react-query` `^5.90.17` |
| 单元测试 | `@rstest/core` `^0.10.6`（node + happy-dom 双 project） |
| E2E | `@playwright/test` `^1.59.1`（Chromium） |
| Markdown 流式渲染 | `streamdown` `2.5.0` + `@streamdown/code` + `@streamdown/mermaid` |
| 代码编辑器 | CodeMirror 6（`@uiw/react-codemirror`） |
| 图 / 动效 | `@xyflow/react`、`motion`、`gsap`、`ogl` |
| 面板布局 | `react-resizable-panels` `^4.4.1` |
| 文档站 | `nextra` `^4.6.1` + `nextra-theme-docs` |

## 2.2 五层结构

```
src/
├── app/         ← 路由层：App Router、layout、page、route handler
├── components/  ← 展示层：React 组件（UI 原语 / 业务组件）
├── core/        ← 业务逻辑层：36 个领域模块，应用的心脏
├── hooks/       ← 跨领域共享 hook（仅 2 个文件）
├── lib/         ← 纯工具（cn()、IME 判定）
├── content/     ← MDX 内容（blog、docs，双语）
├── styles/      ← 全局 CSS（Tailwind v4 + CSS 变量）
└── typings/     ← 环境声明
根文件：env.js（环境变量校验）、dev-origins.js、mdx-components.ts、version.ts
```

### 依赖方向（现状）

```
app  ──▶ components ──▶ core ──▶ lib
 │           │            │
 └───────────┴────────────┘   （app / components 均可直接依赖 core）
```

- `core` **不依赖** `components` / `app`——这条规则目前基本成立，是分层的主要资产。
  例外是 `core/streamdown/components.tsx`（渲染层配置，含 JSX）和
  `core/utils/files.tsx`（返回图标 ReactNode）。
- `components/workspace/*` 内部有自己的局部 context（artifacts / sidecar /
  browser-view），这些 context 定义在 `components` 而非 `core`，属于**有意的**
  UI 局部状态划分，但也造成了 core/components 边界的模糊点，见
  [10-refactor-hotspots.md](10-refactor-hotspots.md)。
- `components/ui/**` 与 `components/ai-elements/**` 是**registry 生成物**，
  ESLint 忽略、禁止手改。

## 2.3 `src/app/` — 路由层

39 个文件。详见 [03-routing-and-pages.md](03-routing-and-pages.md)。要点：

- 默认 **Server Component**，只在需要交互时标 `"use client"`。
- `app/api/memory/**` 是唯一的**自有** route handler（BFF 转发）。
- `app/mock/api/**` 是 Mock 模式的假后端，11 个 route handler。

## 2.4 `src/components/` — 展示层

189 个文件，6 个分组：

| 目录 | 文件数 | 职责 | 可否手改 |
| --- | --- | --- | --- |
| `ui/` | 44 | Shadcn UI + MagicUI + React Bits 原语 | ❌ registry 生成 |
| `ai-elements/` | 28 | Vercel AI SDK elements（`prompt-input`、`message`、`reasoning`、`task`…） | ❌ registry 生成 |
| `workspace/` | ~100 | 聊天工作台全部业务组件（消息、产物、设置、面板…） | ✅ |
| `landing/` | 12 | 落地页 section | ✅ |
| `docs/` | 4 | MDX / 文档渲染辅助 | ✅ |
| `auth/` | 1 | `remember-session-option` | ✅ |
| 根 | 2 | `query-client-provider.tsx`、`theme-provider.tsx` | ✅ |

`workspace/` 自身按功能再分子目录：`agents/`、`artifacts/`、`browser-view/`、
`changes/`、`channels/`、`chats/`、`citations/`、`messages/`、`settings/`、`sidecar/`。

## 2.5 `src/core/` — 业务逻辑层

142 个文件、36 个领域目录。模块内部的**惯例文件命名**（不是强制，但覆盖率很高）：

| 文件名 | 角色 |
| --- | --- |
| `api.ts` | 该领域的 HTTP 调用（用 `fetchWithAuth`） |
| `hooks.ts` | TanStack Query 的 `useQuery` / `useMutation` 封装 |
| `types.ts` / `type.ts` | 领域类型（注意 `skills/` 用的是单数 `type.ts`） |
| `index.ts` | 对外 re-export 门面 |
| 其他 | 纯函数模型（如 `steps.ts`、`lifecycle.ts`、`preview.ts`、`summary.ts`） |

这套 `api / hooks / types / index` 四件套是本项目最一致的结构约定，重构时应保持。
完整模块清单见 [07-core-modules.md](07-core-modules.md)。

## 2.6 `src/hooks/` 与 `src/lib/` — 极薄

- `hooks/use-global-shortcuts.ts`、`hooks/use-mobile.ts`
- `lib/utils.ts`（`cn()` = clsx + tailwind-merge）、`lib/ime.ts`（中文输入法组合态判定）

**观察**：这两层只有 4 个文件。大量 hook 实际住在 `core/*/hooks.ts`（领域内）
或 `components/workspace/*` 内（UI 局部），这是有意的——`hooks/` 只放真正跨领域、
无业务语义的东西。重构时不要把领域 hook 往这里搬。

## 2.7 代码风格约束（ESLint 强制）

来自 [eslint.config.js](../frontend/eslint.config.js)：

- **import 排序强制**：`builtin → external → internal(@/**) → parent → sibling →
  index → object`，组间空行，组内按字母序（不区分大小写）。这是 `error` 级别。
- **类型导入用 inline 形式**：`import { type Foo }`（`consistent-type-imports`，
  `fixStyle: inline-type-imports`，warn 级）。
- **未使用变量前缀 `_`**（`argsIgnorePattern: "^_"`）。
- 关闭了一批 `no-unsafe-*` 规则（`no-unsafe-assignment` / `-call` / `-member-access` /
  `-argument` / `-return`）——意味着**类型安全在边界处依赖人工审查**，
  这是重构时可以逐步收紧的空间。
- `no-misused-promises` 开着但 `checksVoidReturn.attributes: false`，
  所以 JSX 属性里可以直接写 async handler。
- 路径别名统一 `@/*` → `src/*`（tsconfig + rstest 均已配）。

## 2.8 命名与文件组织惯例

- 文件名一律 **kebab-case**（`message-list-item.tsx`、`use-thread-chat.ts`），
  唯一例外是 `core/auth/AuthProvider.tsx`。
- 组件导出用 **PascalCase 具名导出**，页面组件用 `default export`。
- 复杂组件把纯逻辑抽到同名 `-helpers.ts`：`input-box.tsx` / `input-box-helpers.ts`、
  `goal-status.tsx` / `goal-status-helpers.ts`、
  `gateway-offline-banner.tsx` / `-helpers.ts`、
  `agent-settings-dialog.tsx` / `-helpers.ts`。
  **这是本项目对"大组件"的既有拆分模式，重构时应沿用并扩大使用。**
