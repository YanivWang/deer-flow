# 02 · 技术栈

> 所有第三方包的维护状态已于 2026-08-03 通过 `npm view <pkg> time` 核实。**"上游是否活跃"是硬性选型条件**，被否决的候选见文末存档表。
>
> M-1 的部署、Gateway、认证、WS 和测试合同已经冻结；实现本技术栈时不得覆盖 [09-m1-contract-freeze.md](09-m1-contract-freeze.md) 的边界。

## 最终形态

```
Nuxt 4  +  shadcn-vue / Reka UI  +  Tailwind 4
    ↓
Agent 层：自研 SSE（照抄 gamma-project 的分层与判断，按 SSE 规范重写 transport）
    ↓
状态：L1 external store 管协议快照 · Vue/Pinia adapter 管 thread 作用域与 UI 派生状态
    ↓
Markdown：unified 管线保留 + hast-util-to-jsx-runtime(vue/jsx-runtime) + remend
    ↓
LangChain 依赖全部移除：自写 REST client + openapi-typescript 生成类型
```

## 为什么是 Nuxt 4 而不是裸 Vite + Vue

1. **营销页需要预渲染。** 价格页、关于我们、落地页最需要 SEO 与 OG 卡片，裸 Vite SPA 没有预渲染能力，等这些页面要做时就得二次迁移构建体系、路由和测试配置。
2. **Nuxt 支持逐路由混合渲染。** `routeRules` 让应用区 `ssr: false`、营销区 `prerender: true`。
3. **代理能进生产产物。** Nitro server catch-all 在 dev / preview / `node .output/server/index.mjs` 里都生效，与 Next 的 `next.config.js` rewrites 同构——这是 E2E 与生产行为一致的前提，裸 Vite 的 `server.proxy` 和 `nitro.devProxy` 都只管 dev。M0 实测还证明 `routeRules.proxy` 会先于自定义安全 guard 接管请求，因此生产转发必须由 handler 执行。见 [03-project-shape.md](03-project-shape.md#️-为什么生产代理必须进入-nitro-产物而不是-nitrodevproxy)。

> ⚠️ 预渲染有一个前提要写清楚：`prerender: true` 的产物在**构建期**定死，包括 locale；而 Next 版营销页是按 cookie 派生 locale 服务端渲染的。当前三页是占位页无所谓，但「将来替换真实内容零迁移成本」这句话只在单语言静态内容下成立。细节见 [03-project-shape.md](03-project-shape.md#️-营销页预渲染的前提)。

**关键认知：`ssr: false` 的路由里，Nuxt 就是一个带文件路由的 Vite。** 不会碰到任何服务端渲染的坑——cookie 读取全在客户端，i18n 就是普通 reactive store。

Vue 没有 RSC。Next 的"Server Components by default"边界无等价物，改用 `routeRules` + `defineAsyncComponent` 懒加载达到等价效果。

## 为什么是 shadcn-vue + Reka UI

这不是偏好，是**同构关系**：

| 现在                                    | 新             | 关系                                                                                                                               |
| --------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Radix UI（无样式行为原语）              | **Reka UI**    | Radix Vue 改名而来（`radix-vue` 止于 1.9.17 / 2025-02-28，v2 起改名）。同一套 `Root`/`Trigger`/`Content`/`Portal` 结构与无障碍实现 |
| shadcn/ui（Radix 上刷 Tailwind 的配方） | **shadcn-vue** | 逐组件对照移植，**cva 样式串可逐字复制**                                                                                           |
| Tailwind 4                              | Tailwind 4     | 纯 CSS 工具，本来就框架无关                                                                                                        |

**决定性理由**：shadcn 不是 npm 依赖，是复制进项目的源码——组件的全部视觉定义就是一坨 Tailwind class 串。`frontend/src/components/ui/button.tsx` 里那 30 行 `buttonVariants` cva，在 shadcn-vue 的 `Button.vue` 里用的是同一份定义，只是渲染层从 `<Comp>` 换成 Reka UI 的 `<Primitive>`。

**换成任何有主见的组件库（Element Plus / ant-design-vue / Naive UI），这 30 行 × 41 个组件都要推倒重来，且 3.4 万行业务组件的 Tailwind class 全部失去样式基准。**

同时可复用：`class-variance-authority`、`clsx`、`tailwind-merge`、`cn()`、`src/styles/` 的 453 行主题、`data-slot`/`data-variant` 属性约定。

## UI 层：41 个 `ui/` 组件的处置

> 括号内数字是该组件在 `frontend/src/components/workspace/` 下的实测引用次数。

> 实测：`frontend/src/components/ui/` 是 **44 个文件 / 5,573 行**，其中 40 `.tsx` + 1 `.jsx` + 3 `.css`（css 是 galaxy / magic-bento / spotlight-card 的伴生文件），**组件数为 41**。下面 30 + 5 + 6 = 41 对得上。

**A. shadcn-vue CLI 拉取（30 个）**

```
alert  avatar  badge  breadcrumb  button  button-group  card  collapsible
command  dialog  dropdown-menu  empty  hover-card  input  input-group  item
progress  scroll-area  select  separator  sheet  sidebar  skeleton  sonner
switch  tabs  textarea  toggle  toggle-group  tooltip
```

拉取后逐个对照 `frontend/src/components/ui/*.tsx` 的 cva 定义，**样式串逐字复制**。`item` / `empty` / `button-group` / `input-group` 是较新的 shadcn 组件，需核对 shadcn-vue 是否已提供；缺的照着 React 版手抄（class 串能直接抄，成本可控）。

**⚠️ `sidebar`（726 行，被 10 个文件依赖）** —— shadcn-vue 有对应实现，但它包含折叠、移动端 Sheet 降级、快捷键、cookie 持久化等复杂行为，**必须逐条比对而非直接采用**。

**B. 无对应物 / 必须自写**

| 组件              | 行数 | 说明                                                                                                                                                                               |
| ----------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resizable`（1）  | —    | → `splitpanes` 4.1.2。**这是重写不是替换**，`react-resizable-panels` 与它 API 完全不同，8 条约束见 [05-invariants.md](05-invariants.md) H 组。这是整套 UI 里唯一没有同构关系的组件 |
| `aurora-text`     | ~100 | workspace/welcome.tsx 使用                                                                                                                                                         |
| `flickering-grid` | 202  | login / setup 页背景                                                                                                                                                               |
| `shine-border`    | ~60  | subtask-card 使用                                                                                                                                                                  |
| `confetti-button` | ~40  | input-box 使用（保留 `canvas-confetti`）                                                                                                                                           |

**C. 不迁（6 个）**

`galaxy`、`magic-bento`、`number-ticker`、`terminal`（落地页独占）、`spotlight-card`、`carousel`（全库无引用的死代码）。

## Agent 通信层：自研 SSE（内核 + 适配层）

**终态不用 `@langchain/langgraph-sdk/react` 的 `useStream`，也不用 `./stream` 内核；但 M2 四类协议门禁通过前保留 SDK 作为 oracle/fallback。**

⚠️ **本层有第二个目标：可被后端非 LangGraph 的其他项目复用。** 因此切成协议无关内核与薄适配层，接口契约与禁入清单见 **[08-agent-core-contract.md](08-agent-core-contract.md)**。

```
packages/agent-core/   L1 协议无关内核（可整包复用）
  transport            SSE 分帧 + buffer 上限              ← 不决定请求方法
  session              RunProtocol + create/resume/cancel 状态机
  reducer              完整 TState + 消息动作              ← 纯函数，可单测
  merge                动作 → 写进 AgentMessage
  watchdog             停表规则                            ← 纯函数
  store                external store，无 Pinia
        ↑ 实现接口
core/agent-deerflow/   L3 协议适配层（随项目走）
  endpoints · run-protocol · event-map
  message-adapt · stream-mode · gap-recovery
```

**LangChain 依赖全部去掉：**

| 包                         | 体积       | 实际用量                                                                                                 | 处置    |
| -------------------------- | ---------- | -------------------------------------------------------------------------------------------------------- | ------- |
| `@langchain/langgraph-sdk` | 4.7 MB     | `Client` 的 **7 个方法 / 10 个调用点** + 类型                                                            | ❌ 移除 |
| `@langchain/core`          | **7.6 MB** | **1 处 type-only 引用**（`ToolCall`）；传递依赖含 `langsmith` / `js-tiktoken` / `mustache`，前端全用不到 | ❌ 移除 |

替代：

```
app/core/api/client.ts       ~180 行   7 个 REST 方法 + CSRF 头 + 错误规范化
app/core/api/types.gen.ts    生成      openapi-typescript ← Gateway /openapi.json
app/core/types/message.ts    ~120 行   手写 Message/AIMessage/ToolMessage/ToolCall
                                       + Thread/Run/ThreadState/ThreadsClient
```

⚠️ **URL 前缀保持 `/api/langgraph/*`**，与 `frontend/` 一致（对齐 `core/config/index.ts::getLangGraphBaseURL()`）。移除的是 SDK，不是路由约定——前缀是 nginx 侧 SSE 超时与 body 上限的挂载点，也是 E2E `mock-api.ts` 的拦截依据。理由见 [07-parallel-run.md](07-parallel-run.md#为什么必须保住这些-url)。

⚠️ **移除 LangChain 会波及 `core/` 里 17 个「纯 TS」文件**——它们 `import type { Message }` 之类。实测清单与工作量见 [06-migration-plan.md](06-migration-plan.md#m1--core-纯-ts-落地)。

Gateway 有 **102 处 `response_model`**，REST 信封类型可以生成且比 SDK 类型更准；但消息结构在后端是 `Any`，必须手写。

具体的移植边界、可直接搬的文件、以及 L1–L16 补强项，见 [04-architecture-decisions.md §4](04-architecture-decisions.md#4-agent-通信层自研-sse参照-gamma-project) 与 [05 L 组](05-invariants.md#l-自研-sse-transport-的补强项)。

## Markdown 渲染层

**核心发现：`hast-util-to-jsx-runtime` 官方支持 Vue，hast→vnode 那一层不用自己写。已在 `node_modules` 里核实。**

其 readme 有一整节 **"Example: Vue"**，给出可运行示例并带一条硬性要求：

```js
import { Fragment, jsx, jsxs } from "vue/jsx-runtime"; // vue@3.3+
toJsxRuntime(tree, { Fragment, jsx, jsxs, elementAttributeNameCase: "html" });
```

> 👉 you must set `elementAttributeNameCase: 'html'` for Vue.

同时实测确认 `streamdown@2.5.0` 的 dependencies 确实包含 `hast-util-to-jsx-runtime`、`remend`、`rehype-harden`、`marked`、`rehype-raw`、`rehype-sanitize`、`unified` —— 本方案的依赖考古成立。

**⚠️ `elementAttributeNameCase: 'html'` 的连带影响**：自定义组件覆盖拿到的 prop 是 **`class` 而不是 `className`**，components map 里每个覆盖都要按 `class` 写。

**`stylePropertyNameCase` 取 `'css'`**（默认是 `'dom'` 驼峰）。git 历史里有一份现成的 Vitest 探针用的就是这个值，可以直接取来当 M3 的起点：

```bash
git show 44309ae7:frontend-vue/tests/p0/jsx-runtime-hast.test.ts
```

它除了验可渲染性，还验了**流式追加兄弟节点时已有 DOM 不重新挂载**（`expect(wrapper.find("p").element).toBe(firstParagraph)`）——正是 [05 M4](05-invariants.md#m-vue-移植专有陷阱)「逐词动画 key 必须稳定」的底层前提。

**⚠️ streamdown 同时用了 `rehype-harden` 和 `rehype-sanitize`**，本方案早期只列了前者。在 `rehype-raw` 开启的前提下漏掉 `rehype-sanitize` 是安全降级，两个都要带。

React 侧的真实分层（由两边依赖对比得出）：

```
react-markdown = unified 管线 + hast-util-to-jsx-runtime(react/jsx-runtime)
Streamdown     = unified 管线 + hast-util-to-jsx-runtime + 流式层(marked/remend/mermaid)
```

两者**不互相依赖，但复用同一个 `hast-util-to-jsx-runtime`**。而该库的官方描述是 "hast utility to transform to preact, react, solid, svelte, **vue**, etc"，Vue 也确实提供 `vue/jsx-runtime` 入口（`exports` 中含 `./jsx-runtime`，带 types/import/require）。

| 层                                                              | 处置                                                                                    | 新代码      |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------- |
| unified 管线（remark/rehype 插件链）                            | **原样保留**，框架无关                                                                  | 0           |
| `preprocess.ts`（12 KB 嵌套截断 / LaTeX 归一化 / 系统标签剥离） | **原样搬**（389 行）                                                                    | 0           |
| 未完成 markdown 自愈                                            | **直接用 `remend`** 1.3.0（Streamdown 的 `parseIncompleteMarkdown` 的独立框架无关实现） | 0           |
| URL 安全过滤                                                    | **直接用 `rehype-harden`** 1.1.8 **+ `rehype-sanitize`** 6.0.0（streamdown 两个都用）   | 0           |
| hast → vnode                                                    | **`hast-util-to-jsx-runtime` + `vue/jsx-runtime`**                                      | ~30         |
| `rehypeStreamingListItems`                                      | 从 `plugins.ts` 里**摘出来**搬                                                          | ~50         |
| `plugins.ts` 其余部分                                           | **重写**（它 import 三个 React-only 包，见下）                                          | ~50         |
| `components.tsx` 组件覆盖 map                                   | **重写**（90 行 React）                                                                 | ~120        |
| `mermaid.ts` + `safe-children.ts`                               | **重写**（132 行 React）                                                                | ~150        |
| **代码块组件**（渲染 shiki tokens + 复制 + 语言标签 + 主题）    | **重写**（见下，它在 streamdown 内部）                                                  | ~250        |
| 分块 + memo                                                     | 自写（用 `marked`，同 Streamdown 策略）                                                 | ~100        |
| 逐词动画                                                        | 自写                                                                                    | ~120        |
| 错误边界                                                        | 自写（`onErrorCaptured`）                                                               | ~30         |
|                                                                 |                                                                                         | **~900 行** |

最易出错的部分——属性名转换、key 生成、raw HTML、URL 安全——仍然交给成熟库。但**整层的量是 ~900 行，不是早期写的 230 行**，三个实测事实把它顶了上去：

**① `core/streamdown/` 是 6 个文件 714 行，不是只有 `preprocess.ts`。**

| 文件               | 行  | 早期说法             | 实际                                                                                                                                                                                            |
| ------------------ | --- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `preprocess.ts`    | 389 | 原样搬               | ✅                                                                                                                                                                                              |
| `plugins.ts`       | 98  | **「原样搬，0 行」** | ❌ 它 `import { code } from "@streamdown/code"`、`import { mermaid } from "@streamdown/mermaid"`、`import type { StreamdownProps } from "streamdown"`。**只有 `rehypeStreamingListItems` 可搬** |
| `components.tsx`   | 90  | 未提及               | 重写                                                                                                                                                                                            |
| `mermaid.ts`       | 98  | 未提及               | 重写                                                                                                                                                                                            |
| `safe-children.ts` | 34  | 未提及               | 重写                                                                                                                                                                                            |

`plugins.ts` 还导出 `streamdownWordAnimation` / `streamdownSmoothStreamingAnimation`（`{ animation: "fadeIn", duration: 200, sep: "word", stagger: 0 }`）——那是 **Streamdown 自己的动画配置 API**。它们是「逐词动画要实现成什么样」的规格，不是可搬的代码。

**② 代码块 UI 在 `streamdown` 包里，不在 `@streamdown/code` 里。**

实测 `@streamdown/code` 的 dist 只有 **1,568 字节**——纯 **shiki tokenizer 插件**（语言别名归一化、highlighter 缓存、返回 tokens），零 DOM。真正的代码块渲染在 `streamdown` 的 `chunk-*.js`，**67,773 字节**。「保留 shiki」只解决高亮，组件本身要重写。

**③ ⚠️ `globals.css` 直接搬会静默丢样式。**

[`frontend/src/styles/globals.css:4-6`](../frontend/src/styles/globals.css)：

```css
@source "../../node_modules/streamdown/dist/index.js";
@source "../../node_modules/@streamdown/code/dist/*.js";
@source "../../node_modules/@streamdown/mermaid/dist/*.js";
```

Tailwind 4 靠这三行从 streamdown 的 dist 里扫 class。453 行主题搬到 `frontend-vue/` 后这些路径不存在，**只出现在 streamdown dist 里的 class 会被 purge**——表现是「样式莫名少一块」，不报错。搬的时候必须删掉这三行，并确认自写的代码块 / mermaid 组件把用到的 class 都写进自己的源码。

⚠️ **`hast-util-to-jsx-runtime` 最后发布 2025-03-05。** 它是 unified 生态的纯函数式工具库、无框架 peer、被 react-markdown 与 Streamdown 同时依赖，停在稳定态与"UI 库停更"性质不同，可接受。Vue 支持已按上文核实，[M3](06-migration-plan.md) 的 gate 只需 diff 输出。

## 逐库映射

### 框架与语言

| 现在                      | 新                                    |
| ------------------------- | ------------------------------------- |
| Next.js 16 App Router     | **Nuxt 4**（Vue 3.5 + Vite）          |
| React 19 / React DOM      | Vue 3.5（`<script setup>` + TS）      |
| `tsc --noEmit`            | `vue-tsc --noEmit`                    |
| Tailwind CSS 4（postcss） | Tailwind CSS 4（`@tailwindcss/vite`） |

### UI

| 现在                                                            | 新                                                                                                                   |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| shadcn/ui                                                       | **shadcn-vue**（`shadcn-nuxt` 模块）                                                                                 |
| `@radix-ui/*`（16 个）                                          | **reka-ui**                                                                                                          |
| `@radix-ui/react-slot`                                          | Reka UI `Primitive` + `as-child`                                                                                     |
| **`@radix-ui/react-icons`**（2 个消费文件）                     | **换成 `lucide-vue-next` 的等价图标**。早期版本漏了这一行——它与 `@radix-ui/*` 行为原语不是一回事，reka-ui 不提供图标 |
| `lucide-react`                                                  | `lucide-vue-next` 1.0.0                                                                                              |
| `sonner`                                                        | `vue-sonner`                                                                                                         |
| `next-themes`                                                   | `@nuxtjs/color-mode`（`classSuffix: ""`）                                                                            |
| `motion`（`motion/react`）                                      | `motion-v` 2.3.0                                                                                                     |
| `react-resizable-panels`                                        | `splitpanes` 4.1.2                                                                                                   |
| `cmdk`                                                          | shadcn-vue Command                                                                                                   |
| `use-stick-to-bottom`                                           | `@vueuse/core` + 自写，**估 250–400 行**（见下方 ⚠️）                                                                |
| `class-variance-authority` / `clsx` / `tailwind-merge` / `cn()` | **原样保留**                                                                                                         |

> ⚠️ **`use-stick-to-bottom` 的估算已上修。** 早期写的「约 80 行」是错的：实测该包 dist 共 **486 行**（`useStickToBottom.js` 403 + `StickToBottom.js` 81），里面是 spring 动画、`ResizeObserver`、内容增长时的 scroll anchoring、以及"用户主动上滚就解除吸底"的判定。
>
> 它有两处消费方——`ai-elements/conversation.tsx` 与 `workspace/messages/virtual-message-list.tsx`——且行为被 `tests/e2e/sidecar-chat.spec.ts` 的 no-animated-scroll 用例固定（见 [05-invariants.md](05-invariants.md) H5）。这不是"包个 `useScroll` 就完事"的组件，按 250–400 行估，并在 M4 单独留出时间。

### 数据

| 现在                                  | 新                                                                                                                                                                                                                          |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@tanstack/react-query`               | `@tanstack/vue-query` 5.101.4                                                                                                                                                                                               |
| `@tanstack/react-virtual`             | `@tanstack/vue-virtual` 3.13.35                                                                                                                                                                                             |
| `@langchain/langgraph-sdk/client`     | **移除** → 自写 `core/api/client.ts`（~180 行）                                                                                                                                                                             |
| `useStream`                           | **自研 SSE 分层**（见 §Agent 通信层）                                                                                                                                                                                       |
| `@t3-oss/env-nextjs`                  | Nuxt `runtimeConfig` + 手工 zod 校验                                                                                                                                                                                        |
| `src/app/api/memory/**` route handler | 删除——浏览器经 nginx 直连 `/api/memory`                                                                                                                                                                                     |
| —                                     | **Pinia（可选适配层）**：订阅 L1 external store，并承载 Vue UI 派生状态；不重做 reducer、续传或取消语义。作用域约束见 [04 §3](04-architecture-decisions.md#3-状态管理external-store-管协议状态vue-适配层管作用域与-ui-状态) |

### 内容渲染

| 现在                                                     | 新                                                                                                                                                                                                 |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `streamdown` `@streamdown/code` `@streamdown/mermaid`    | `hast-util-to-jsx-runtime` + `remend` + `rehype-harden` + 自写流式层                                                                                                                               |
| `unified` / `remark-*` / `rehype-*` / `unist-util-visit` | **原样保留**                                                                                                                                                                                       |
| `shiki` / `katex` / `mermaid`                            | 原样保留                                                                                                                                                                                           |
| `@uiw/react-codemirror`                                  | **直接封装 CodeMirror 6 `EditorView`**（约 60–80 行）—— ⚠️ 不要用 `vue-codemirror`，停更于 2022-08-27                                                                                              |
| `@codemirror/lang-*` / `@uiw/codemirror-theme-*`         | 原样保留（CM6 扩展，框架无关）                                                                                                                                                                     |
| `nextra` / `nextra-theme-docs`                           | 删除                                                                                                                                                                                               |
| `@xyflow/react`                                          | 删除。**连带 7 个 ai-elements canvas 组件一并不迁**（`canvas` `node` `edge` `connection` `controls` `panel` `toolbar`，共 310 行；实测它们在 `src/` 内零外部引用）→ ai-elements 手写量 29 → **22** |

### Next 专有 API → Vue 写法

这张表是逐文件机械改写的主要成本来源，**用量为实测**（`frontend/src/` 内的文件数）。写法先定死，避免 126 个组件里出现三种不同的改法。

| Next                   | 用量        | Vue / Nuxt                               | 语义差异（会咬人的地方）                                                                                                                                                                |
| ---------------------- | ----------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `next/navigation`      | **30 文件** | `useRouter()`(vue-router) · `useRoute()` | `usePathname()` → `route.path`；`useSearchParams()` → `route.query`（**已是解析好的对象，不是 `URLSearchParams`**）；`router.push` 返回 Promise                                         |
| `next/link`            | 14 文件     | `<NuxtLink>`                             | `prefetch` 语义不同；`replace` 是 prop 不是布尔属性                                                                                                                                     |
| `next/dynamic`         | 6 文件      | `defineAsyncComponent()`                 | `{ ssr: false }` → 包一层 `<ClientOnly>`；`loading` → `loadingComponent`                                                                                                                |
| `next/headers`         | 3 文件      | 删除                                     | 全部落在服务端 cookie 读取那 4 处，`ssr:false` 后改客户端读                                                                                                                             |
| `next/server`          | 4 文件      | 删除                                     | 只在被删掉的 route handler 里                                                                                                                                                           |
| `next/image`           | 1 文件      | `<img>` 或 `<NuxtImg>`                   | 一处而已，直接 `<img>`                                                                                                                                                                  |
| `useSyncExternalStore` | **4 文件**  | `shallowRef` + 手动订阅                  | ⚠️ browser-view 的 `LatestBrowserFrameBuffer` 直接依赖它做「每动画帧最多发布一次」（见 [05-invariants.md](05-invariants.md) I3）。Vue 没有等价 hook，要手写订阅 + `onScopeDispose` 清理 |
| `useDeferredValue`     | 2 文件      | 无等价物                                 | Vue 没有并发渲染。按实际用途改成 `debouncedRef` 或直接去掉，**逐处判断，不要机械替换**                                                                                                  |

**好消息**：实测 `Suspense`、`React.lazy`、`forwardRef`、`useOptimistic`、`useTransition`、`createPortal`、`flushSync` 在 `frontend/src/` 里**全是 0 处**。Vue 侧最难对齐的那几个 React 特性根本没被用到。

### 工程化

| 现在                                     | 新                                                                                                                                                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rstest（node + happy-dom 双 project）    | **Vitest 双 project：`node`（纯 TS）+ `nuxt`（composable）**。全部 unit 共 126 个，其中 core 83 个；按测试 manifest 分批 codemod，见 [03](03-project-shape.md#rstest-转-vitest按运行环境分组不把-126-个测试塞进-m1) |
| Playwright                               | **原样保留**，`webServer` 指向 Nuxt                                                                                                                                                                                 |
| ESLint 9 + `eslint-config-next`          | ESLint 9 + `@nuxt/eslint` + `eslint-plugin-vue` + typescript-eslint                                                                                                                                                 |
| Prettier + `prettier-plugin-tailwindcss` | 不变                                                                                                                                                                                                                |

> ⚠️ **测试要两个 project，不是一个。** 纯 TS 子集走 node；需要 Nuxt plugin/middleware/composable 上下文的测试走 Nuxt environment。普通 core 接收注入的 runtime options，不直接调用 `useRuntimeConfig()`。
>
> | project | environment                                        | 跑什么                                                |
> | ------- | -------------------------------------------------- | ----------------------------------------------------- |
> | `node`  | node                                               | `app/core/` 的纯 TS 子集、`packages/agent-core/` 内核 |
> | `nuxt`  | `@nuxt/test-utils/config` 的 `environment: 'nuxt'` | `app/composables/`、`middleware/`、plugin             |
>
> 参照 `nuxt-modern-starter` 的 `vitest.config.ts`（`defineVitestConfig({ test: { environment: 'nuxt' } })`）。代价是多一个 `@nuxt/test-utils` devDep 和更慢的启动——所以只让需要 Nuxt 上下文的那部分走它。

## 完整依赖清单

### 原样保留（框架无关）

```
zod                       date-fns            nanoid            uuid
best-effort-json-parser   tokenlens
shiki                     katex               mermaid           canvas-confetti
unified                   remark-gfm          remark-math       remark-rehype
rehype-katex              rehype-raw          rehype-slug
unist-util-visit          @types/hast
codemirror                @codemirror/language-data
@codemirror/lang-{css,html,javascript,json,markdown,python}
@uiw/codemirror-theme-{basic,monokai}
class-variance-authority  clsx                tailwind-merge    tw-animate-css
```

`ai`（Vercel AI SDK）**仅用于 3 个类型**：`FileUIPart`、`ChatStatus`、`LanguageModelUsage`。

**决策：内联定义，不装这个包。** 早期版本写「保留为 type-only 依赖或内联定义」两可，导致 [03 的 `package.json`](03-project-shape.md#packagejson) 里既没有它、正文又说保留。为 3 个类型挂一个 SDK 不划算，且它会把 React 相关的传递依赖带进来——写进 `app/core/types/message.ts` 即可（那里本来就要手写 Message 类型）。

**AI Elements 是 React-only，22 个组件必须手写**（不是 29，7 个 xyflow canvas 件不迁，见 [01](01-scope.md#4-xyflow-canvas-组件不迁)）。

### 新增

```
nuxt  vue  vue-router
shadcn-nuxt  reka-ui
@tailwindcss/vite
@tanstack/vue-query  @tanstack/vue-virtual
lucide-vue-next  vue-sonner  motion-v  splitpanes
@nuxtjs/color-mode  @vueuse/core  @vueuse/nuxt
pinia  @pinia/nuxt
marked                    分块
remend                    未完成 markdown 自愈
rehype-harden             URL 安全过滤
rehype-sanitize           HTML 净化（与 harden 配套，streamdown 两个都用）
hast-util-to-jsx-runtime  hast → vnode
openapi-typescript        从 Gateway /openapi.json 生成 REST 类型
@vue/test-utils  happy-dom  vue-tsc  vitest
@nuxt/test-utils          composable / middleware 测试的 nuxt project
@nuxt/eslint  eslint-plugin-vue
```

### 删除

```
nextra  nextra-theme-docs  @xyflow/react
embla-carousel-react   （唯一消费者 ui/carousel 是死代码）
gsap                   （仅 landing 的 magic-bento）
ogl                    （仅 landing 的 galaxy）
nuxt-og-image  h3  defu （src/ 内无引用，pnpm why 确认后移除）
@types/gsap
postcss                （Tailwind 4 走 Vite 插件后不再需要）
```

### ⚠️ 版本对齐约束

"原样搬 `core/` 123 个文件"这个前提要求依赖行为一致。**行为敏感包先精确对齐 `frontend/pnpm-lock.yaml` 的 resolved version，不是只复制 caret 声明。** 首轮 parity 后再逐个升级。

| 包               | frontend 现用                 | npm latest | 风险                                                                                                                                                                                                                                                                |
| ---------------- | ----------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **zod**          | `^3.24.2`                     | 4.4.3      | ⚠️ `core/auth/types.ts` 等被搬运的 `core/` 文件用了 zod，3→4 是破坏性变更。**注意别把 `core/auth/gateway-config.ts` 当理由**——它是纯服务端文件（读 `DEER_FLOW_INTERNAL_GATEWAY_BASE_URL` / `DEER_FLOW_TRUSTED_ORIGINS`），`ssr:false` 且删掉 server auth 后根本不迁 |
| **shiki**        | `3.23.0`（精确锁）            | 4.4.1      | ⚠️ 主版本跨越，高亮输出可能变 → 影响 1:1                                                                                                                                                                                                                            |
| **typescript**   | `^5.8.2`                      | 7.0.2      | ⚠️ TS 7 是 Go 重写版，`vue-tsc` 兼容性需验证                                                                                                                                                                                                                        |
| **nanoid**       | `^5.1.6`                      | 6.0.1      | 主版本跨越（`core/` 未使用，风险低）                                                                                                                                                                                                                                |
| katex            | `0.16.28`                     | 0.18.1     | 首轮精确锁定，输出结构进入视觉基线                                                                                                                                                                                                                                  |
| tailwindcss      | `4.1.18` resolved             | 4.3.3      | 同一 caret 也可能解析出不同 CSS 输出                                                                                                                                                                                                                                |
| marked / mermaid | `17.0.6` / `11.12.2` resolved | —          | Markdown/SVG 输出影响 DOM 与截图，首轮精确锁定                                                                                                                                                                                                                      |

`@langchain/langgraph-sdk` 与 `@langchain/core` **不再是依赖**（见上文），版本漂移问题随之消失。若要参考 SDK 1.9.0 的框架无关 `./stream` 实现，`npm pack` 下来读即可，不必装进项目。

## 被否决的候选（存档，避免重复讨论）

| 包                                        | 否决原因                                                                                                                                                                                                                                                                     |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `element-plus`                            | 曾一度选用。有主见的设计语言导致 44 个 `ui/` 组件的 cva 样式串全部作废、3.4 万行业务组件失去样式基准，"控件层视觉重建"的代价过大                                                                                                                                             |
| `ant-design-vue` + `@ant-design-vue/nuxt` | **有主见的设计语言**——与 Element Plus 同一个问题，41 个 `ui/` 组件的 cva 作废、3.4 万行业务组件失去 Tailwind 设计 token 基准。次要顾虑：上游停更 21 个月（4.2.6 / 2024-11-11）；cssinjs 与 Tailwind 4 `@layer` 共存未被验证过。**"Nuxt 4 集成不可行"这条已删除，见下方修正** |
| `naive-ui`                                | 技术上适配好，但同样是有主见的组件库，1:1 问题与 Element Plus 相同                                                                                                                                                                                                           |
| `vue-codemirror`                          | 停更近 4 年（6.1.1 / 2022-08-27）                                                                                                                                                                                                                                            |
| `streamdown-vue`                          | 社区移植（Saluana，Apache-2.0，1.0.29 / 2025-11-23）。思路正确、依赖栈高度重合，但 8 个多月未更新、定位 Nuxt 3、个人单人项目、**依赖里没有 `rehype-raw`**。渲染是核心链路，不接受该风险。**建议当参考实现读**                                                                |
| `vue-streamdown`                          | 0.0.1 / 2025-09-30，空壳                                                                                                                                                                                                                                                     |
| `markdown-it` 方案                        | 生态与现有 remark/rehype 插件链完全不兼容，`rehypeStreamingListItems` 等要重写，且输出 HTML 结构不同 → 内容层 1:1 失守。`gamma-project` 走的是这条路（markdown-it + 分块 + DOMPurify），可作为参照但不采用                                                                   |
| Inspira UI                                | 为 4 个简单特效组件引入整包依赖不划算                                                                                                                                                                                                                                        |

### ⚠️ 修正：`ant-design-vue` 的「Nuxt 4 集成不可行」不成立

早期版本把「Nuxt 模块仍依赖 `@nuxt/kit ^3.x`，集成需自行解决且无社区支持」列为否决理由之一。**这条已被反例推翻**：内部项目 `nuxt-modern-starter` 实测跑在 **Nuxt 4.4.8 + `@ant-design-vue/nuxt` 1.4.6 + `ant-design-vue` 4.2.6**，并开启了 `antd: { extractStyle: true }`。

结论不变，因为决定性理由只有一条且完全不受影响：**有主见的设计语言会让 41 个 `ui/` 组件的 cva 作废、3.4 万行业务组件失去设计 token 基准。**

但要留一个准确的限定：那个参照项目**完全没有用 Tailwind**（SCSS + 自建 design token），所以它并未验证「cssinjs 与 Tailwind 4 `@layer` 共存」——这条顾虑仍然未被证伪，只是不该再当主要论据。

> 保留这段修正是为了避免将来有人拿"Nuxt 4 装不上 antd"这个错误前提重开讨论。真正的理由是样式基准，不是集成可行性。
