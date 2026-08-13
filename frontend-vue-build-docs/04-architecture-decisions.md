# 04 · 关键架构决策

> **文档性质：冻结架构决策，不是当前实现状态。** 哪些决策已经落地、哪些仍待 M4b+
> 实现，以 [10-current-status-and-next.md](10-current-status-and-next.md) 和代码为准。

七个决策，每个都直接影响目标能否达成。

跨组件的 M-1 部署/协议/认证/测试结论已经冻结在 [09-m1-contract-freeze.md](09-m1-contract-freeze.md)；本文的库与 UI 决策不得改变那些合同。

---

## 1. Markdown 渲染：保留 unified 管线，渲染层用现成库而非自写

**决策：不换 markdown-it。保留现有 remark/rehype 插件链，hast→vnode 用 `hast-util-to-jsx-runtime` + `vue/jsx-runtime`。**

`streamdown` + `@streamdown/code` + `@streamdown/mermaid` 是 React-only，但下游整条管线框架无关：`unified` / `remark-gfm` / `remark-math` / `remark-rehype` / `rehype-katex` / `rehype-raw` / `rehype-slug` / `unist-util-visit`，以及 `frontend/src/core/streamdown/preprocess.ts`（12 KB 纯 TS）。

### 关键发现：不需要自己写 hast→vnode

由依赖对比得出的 React 侧真实分层：

```
react-markdown = unified 管线 + hast-util-to-jsx-runtime(react/jsx-runtime)
Streamdown     = unified 管线 + hast-util-to-jsx-runtime + 流式层
```

两者**不互相依赖，但复用同一个 `hast-util-to-jsx-runtime`**。该库官方描述为 "hast utility to transform to preact, react, solid, svelte, **vue**, etc"，且 Vue 提供 `./jsx-runtime` 导出入口。

顺带两个可直接使用的框架无关包：

| 包                        | 作用                                                                                                                               |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **`remend`** 1.3.0        | "Self-healing markdown. Intelligently parses and styles incomplete Markdown blocks." —— 即 Streamdown 的 `parseIncompleteMarkdown` |
| **`rehype-harden`** 1.1.8 | 按前缀白名单过滤 URL 的安全插件                                                                                                    |

### 为什么这是 1:1 的关键

输出的 DOM 结构与 class 名与 React 版一致 → 现有 CSS 全部复用 → 样式天然对齐。换成 markdown-it 会产生不同的 AST 与 HTML 结构，样式与行为都要重调。

消息正文是用户注视时间最长的区域，其功能、Markdown 子树和关键视觉状态都在硬性验收范围内（见 [§7](#7-验收分层功能合同与关键视觉门禁)），这一层不能妥协。

### 仍需自写的部分

- **分块 + memo**（用 `marked`，同 Streamdown 策略）
- **逐词动画**——铁律：**不要用"给每个词套一个 rehype 插件"的方案**，增长中的块被重新解析会导致旧词重新挂载并重播动画
- **错误边界**（Vue 用 `onErrorCaptured`）
- **代码块组件**（渲染 shiki tokens、复制按钮、语言标签、明暗主题）
- **`plugins.ts` / `components.tsx` / `mermaid.ts` / `safe-children.ts` 的 Vue 等价物**

⚠️ **新代码约 900 行，不是早期写的 230 行。** 低估来自三个实测事实——`core/streamdown/` 是 6 文件 714 行而非只有 `preprocess.ts`、`plugins.ts` 根本搬不了（它 import 三个 React-only 包）、代码块 UI 在 `streamdown` 的 68 KB chunk 里而不在 `@streamdown/code`（那只是个 1.5 KB 的 shiki tokenizer 插件）。明细与 `globals.css` 的 `@source` 陷阱见 [M3](06-migration-plan.md#️-早期的约-230-行是错的实测低估了-34-倍)。

落点 `app/core/markdown/`。

### Vue 支持已核实

`hast-util-to-jsx-runtime@2.3.6` 的 readme 有一整节 **"Example: Vue"**，给出可运行示例（`import {Fragment, jsx, jsxs} from 'vue/jsx-runtime'`），并要求：

> 👉 you must set `elementAttributeNameCase: 'html'` for Vue.

同时实测 `streamdown@2.5.0` 的 dependencies 确实含 `hast-util-to-jsx-runtime` / `remend` / `rehype-harden` / `rehype-sanitize` / `marked` / `rehype-raw` / `unified`。

该库最后发布 2025-03-05——纯函数式工具库、无框架 peer、被 react-markdown 与 Streamdown 同时依赖，停在稳定态可接受。

另已实测：它的 `lib/index.js` **不使用 `dangerouslySetInnerHTML`**。这是 hast→框架渲染器移植里最容易出问题的地方（React 专有的 prop，Vue 侧会静默丢内容），确认不存在。

**[M3 的 gate 因此降级](06-migration-plan.md)**：不再验证「能不能用」，改为验证输出等价。两个连带影响必须处理：

1. `elementAttributeNameCase: 'html'` ⇒ 自定义组件覆盖收到的是 **`class`** 而非 `className`（见 [05-invariants.md](05-invariants.md) M3）
2. streamdown 用了 **`rehype-harden` 和 `rehype-sanitize` 两个**，只搬前者是安全降级

### ⚠️ Gate 的判据是归一化 DOM 等价，不是字符级一致

早期版本写的是「diff 到字符级」。**这个判据不可用**——它一定会红，然后被人为放宽，gate 随即失去意义。Vue 与 React 在这些地方本来就不同：

- 布尔属性的序列化（`disabled` vs `disabled=""`）
- `style` 对象的属性顺序与单位补全
- 自闭合标签与空元素的写法
- 属性顺序、空白处理
- `@vue/server-renderer` 还会额外吐 `<!--[-->` / `<!--]-->` 这类 fragment 锚点注释

正确判据：**两边输出各自 parse 成 DOM 树后逐节点比对**——`tagName`、属性集合（作为无序 map）、文本内容、子节点顺序。允许的差异类型在 M3 显式列出来并写进本文档，此后**新增任何一类差异都要走同样的登记**，不能就地放宽。

#### 允许的差异类型（M3 落地时实测确定，共 6 类）

实现在 `frontend-vue/tests/support/dom-equivalence.ts`，每一类在那里都有对应的归一化代码与理由。**这张表就是登记本身**：要新增一类，改那个文件 + 改这张表，两处都要在 review 里被看见。

| #   | 允许的差异                      | 为什么它不可消除                                                              | 判定为无害的理由                        |
| --- | ------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------- |
| 1   | 注释节点                        | Vue 的 fragment 锚点 / `v-if` 占位是注释节点，React 没有                       | 不影响 `textContent`、CSS、选择器       |
| 2   | `<link rel="preload">`          | React 19 的 float：见到 `<img>` 就往文档里插一条预加载                         | 不在被比对的子树语义内                  |
| 3   | 布尔属性写法                    | `disabled=""`（React）/ `disabled`（Vue）/ `disabled="disabled"`               | 三者在 DOM 里是同一个状态               |
| 4   | class 的顺序                    | 两边生成顺序不同                                                              | CSS 不看 class 顺序；**集合仍逐项比对** |
| 5   | `style` 声明顺序与大小写        | `stylePropertyNameCase` 两边取值不同（React `dom` / Vue `css`）                | 解析成属性 map 后等价                   |
| 6   | 文本被切成几个 DOM 文本节点     | React 把 `["a"," ","b"]` 序列化成一个文本节点，Vue 每个 vnode 子节点建一个     | 合并后**逐字符**比对，不折叠空白        |

第 6 类是 M3 实测撞出来的：`- [ ] todo` 在 React 侧是 `" todo"` 一个节点、Vue 侧是 `" "` + `"todo"` 两个。放宽的只是「切成几个节点」，内容一个字符都没放过。

**没有放宽的**（放宽了就等于放弃判据）：文本内容不折叠空白、子节点顺序严格、属性集合严格（多一个少一个都算差异）。

---

## 2. UI 层：shadcn-vue + Reka UI

**决策：不使用任何有主见的组件库。UI 全部走 shadcn-vue + Reka UI + Tailwind 4。**

### 为什么

三层同构关系：Radix UI ↔ Reka UI（Radix Vue 后继）、shadcn/ui ↔ shadcn-vue、Tailwind 4 ↔ Tailwind 4。

决定性理由是 **shadcn 不是 npm 依赖，是复制进项目的源码**——组件的全部视觉定义就是一坨 Tailwind class 串，shadcn-vue 用的是同一份 cva 定义，**可逐字复制**。

曾评估过 Element Plus / ant-design-vue / Naive UI（详见 [02-stack.md](02-stack.md) 否决存档表）。它们都是"成品组件"，自带设计语言，会让 41 个 `ui/` 组件的 cva 全部作废，且 **3.4 万行业务组件里的 `bg-muted` / `text-muted-foreground` / `border-border` 等设计 token class 全部失去基准**。

### 随之消失的复杂度

采用 shadcn-vue 后，以下问题都不存在：

- CSS `@layer` 顺序编排（Reka UI 零 CSS，无优先级战争）
- 设计 token 桥接
- 组件库 locale 与应用 locale 的联动
- "组件库样式渗透进自写区"风险

### 组件分工

| 类别                | 数量 | 处置                                |
| ------------------- | ---- | ----------------------------------- |
| shadcn-vue CLI 拉取 | 30   | 逐个对照 cva 定义，样式串逐字复制   |
| 必须自写            | 5    | `resizable`(→splitpanes) + 4 个特效 |
| 不迁                | 6    | 落地页独占 + 死代码                 |

完整清单见 [02-stack.md](02-stack.md#ui-层41-个-ui-组件的处置)。

---

## 3. 状态管理：external store 管协议状态，Vue 适配层管作用域与 UI 状态

**决策：按层次切分，不是二选一。**

| 层                        | 用什么                                      | 内容                                                                                    |
| ------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Agent 协议状态**        | **L1 external store**                       | 消息字典与顺序、run 生命周期、SSE 连接状态、游标、错误与 gap 状态；唯一写入口是 reducer |
| **Vue 订阅与派生状态**    | **每 thread 一个 composable/Pinia adapter** | 订阅 external store、暴露 readonly refs、承载纯 UI 派生状态；不得重复实现协议 reducer   |
| **thread 作用域 UI 状态** | **provide/inject**                          | artifacts 面板、browser-view、messages context、sidecar context                         |
| **应用级**                | Nuxt plugin + provide/inject                | auth、i18n                                                                              |

### 为什么不是全用 Pinia

`frontend/AGENTS.md` 记录的约束里，有相当一部分是**跨 thread 状态隔离**：

- "cross-thread navigation never displays the previous chat's usage"
- artifacts 面板 UI 状态按 thread 键存 sessionStorage
- 切换 thread 时必须清空乐观 / 瞬态 / subtask 状态

DeerFlow 是**多 thread 并存 + 侧栏随时切换 + sidecar 子会话**，全局单例风险高。external store 与 Vue adapter 都按 thread/run 实例化；离开 thread 时释放订阅并中止本地读取，但不能把本地 abort 偷换成服务端 cancel。

`provide`/`inject` 的生命周期语义与 React Context 一致——随组件树挂载卸载，天然按 thread 隔离，不需要额外写清理逻辑来模拟卸载。

### 为什么协议状态不能直接写进 Pinia 或 provide/inject

协议状态必须在 transport / session / reducer / external store 之间形成可脱离框架测试的单向数据流。同一套 `create → stream → resume/cancel → terminal` 语义既要被 Nuxt 使用，也要能被临时 consumer 和协议测试直接调用；若 reducer 藏进 Pinia action，L1 就不再是可复用的纯 TypeScript 包。

Vue adapter 只做三件事：为当前 thread 创建或取得 external store、把 snapshot 映射成 readonly refs、在组件作用域结束时解除订阅。Pinia 可以作为该 adapter 的实现工具，但不是协议真相源。完整接口与实例隔离规则见 [08](08-agent-core-contract.md#框架无关-external-store)。

需要映射为 provide/inject 的 7 个业务 Context：

```
components/workspace/artifacts/context.tsx     thread 作用域
components/workspace/browser-view/context.tsx  thread 作用域
components/workspace/messages/context.ts       thread 作用域
components/workspace/sidecar/context.tsx       thread 作用域
core/tasks/context.tsx                         thread / run 作用域
core/auth/AuthProvider.tsx                     app 作用域
core/i18n/context.tsx                          app 作用域
```

另有 14 处 `createContext` 属于复合组件内部通信，由 Reka UI 或组件自身的 `provide`/`inject` 承接。

---

## 4. Agent 通信层：自研 SSE，参照 gamma-project

**决策：目标终态不依赖 LangGraph SDK，但删除动作受 M2 四类协议证据门禁约束。** 在门禁通过前，SDK 保留为开发期 oracle/fallback，不能先删再凭最终页面补协议。

### ⚠️ 本层有第二个目标：可移植

公司其他项目可能复用这套 agent 前端架构，**而它们的后端未必是 LangChain / LangGraph**。所以本层必须切成**协议无关内核 + 薄适配层**，不能把 DeerFlow 协议揉进去。

切法参照 `gamma-project` 已验证的 `agentCore` / `deepResearch` 双层结构——注意它的 `agentCore` 只有 226 行，是**从 10,538 行业务代码里提炼出来的，不是预先设计的**。

```
packages/agent-core/   L1 协议无关内核（其他项目可整包复用）
  transport            SSE 分帧 + buffer 上限                 ← 不决定请求 URL/方法
  session              RunProtocol + create/resume/cancel 状态机
  reducer              完整 TState + 消息归属规则             ← 纯函数，可单测
  merge                动作 → 写进 AgentMessage
  watchdog             停表规则                              ← 纯函数
  store                external store（subscribe/getSnapshot），无 Pinia
        ↑ 实现接口
core/agent-deerflow/   L3 协议适配层（随项目走）
  run-protocol         create POST / resume GET / cancel + header 映射
  event-map            完整 LangGraph 事件全集 → state/message/session 动作
  message-adapt        LangGraph Message ⇄ AgentMessage
  stream-mode          请求模式白名单
  gap-recovery         gap 控制帧与 rejoin
```

**完整接口契约、内核禁入清单、依赖方向图见 [08-agent-core-contract.md](08-agent-core-contract.md)。** 依赖方向由 `tests/architecture.test.ts` 自动守护（同样抄 gamma 的做法）。

### 三个使内核保持通用的关键设计

| #   | 设计                               | 解决什么                                                                                                                       |
| --- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **`RunProtocol` 可插拔**           | 初始创建与续传不是同一请求；协议适配器显式实现 create/resume/cancel，避免重试 create POST 制造重复 run                         |
| 2   | **reducer 对完整 `TState` 泛型化** | 一次事件可同时更新 messages、artifacts、todos、goal、interrupt 和 session，避免组件各自补状态                                  |
| 3   | **`AgentMessage.meta` 扩展位**     | 适配层把协议特有字段（DeerFlow 的 `additional_kwargs` / `run_id` / `agent` 名）塞进 `meta`，**内核不解释它的内容**，只原样保留 |

### L2 通用 UI：逐模块抽取

消息分组、run-duration 折叠、reasoning 位置规则、composer draft、human-input 协议、Markdown 流式渲染——这些是"agent 聊天 UI"的共性，也是本次的**产品目标**。边界在 M4b / M5 各抽一次、M8 收口，**不推到最后**。时机与理由见 [08-agent-core-contract.md](08-agent-core-contract.md#l2-抽取时机)。

### ⚠️ 搬的是模式，不是代码

gamma 的 agent 层针对**它自己的后端协议**编写，与 DeerFlow Gateway 差异很大：

|      | gamma                                                             | DeerFlow Gateway                                   |
| ---- | ----------------------------------------------------------------- | -------------------------------------------------- |
| 发起 | `POST /api/freedom_card/dr/task/create`                           | `POST /api/threads/:id/runs/stream`                |
| 续拉 | `GET .../task/result` + `last_message_index`                      | SSE `Last-Event-ID`                                |
| 分片 | `segment_continue` 事件                                           | `gap` 控制帧 + rejoin                              |
| 事件 | `message_chunk` / `tool_calls` / `tool_call_result` / `interrupt` | `values` / `messages-tuple` / `updates` / `custom` |
| 会话 | 单会话                                                            | 多 thread + checkpoint + branch                    |

**实际可搬量：**

| 来源                                        | 行数 | 处置                               |
| ------------------------------------------- | ---- | ---------------------------------- |
| `agentCore/stream/sse-buffer.ts`            | ~30  | ✅ 直接搬（需补 CRLF，见下）       |
| `agentCore/stream/parse-sse-event.ts`       | ~20  | ✅ 直接搬（需补 `id:` 字段，见下） |
| `agentCore/view-model/order-messages.ts`    | ~20  | ✅ 直接搬                          |
| `deepResearch/state/stream-watchdog.ts`     | ~90  | ✅ **设计整个搬**（见下）          |
| `deepResearch/api/core/sse/fetch-stream.ts` | 272  | 🔄 抄结构，按 DeerFlow 协议重写    |
| `deepResearch/api/core/merge-message.ts`    | 304  | 🔄 抄结构，重写事件类型            |
| `deepResearch/reducers/event-reducer.ts`    | 357  | 🔄 抄结构，重写归约规则            |
| `deepResearch/state/error-recovery.ts`      | —    | 🔄 抄错误分类与恢复动作设计        |
| `deepResearch/store/index.ts`               | 933  | ❌ 重写（多 thread 场景不同）      |

### gamma 值得直接继承的判断

1. **用 `fetch` + `ReadableStream`，不用 `EventSource`** —— 后者不能设 Authorization header、不能 POST、不能 abort
2. **分帧与解析解耦，buffer 归调用方** —— "ReadableStream 的边界和 SSE 事件边界没有关系"
3. **`async function*` 作为流抽象** —— 天然支持 `for await`、背压、abort
4. **拒绝伪造恢复点** —— 未拿到任何游标就失败时，按彻底失败上报，**不从头重放**（会造成重复消息）
5. **抛错而非静默 return** —— 生成器静默结束会让上层分不清"读完了"和"彻底失败"，UI 停在转圈
6. **区分后端错误与网络抖动** —— 前者不重试直接抛
7. **transport 不读登录态** —— token 由调用方注入
8. **看门狗停表规则** —— "没有新消息"有两种含义：真断流该重连，后端在等用户操作则不该重连。把判断收敛成一个纯函数，而不是散在各张卡片的 `onMounted` 里。**DeerFlow 有 human-input 卡片、`/goal` 确认、interrupt，完全同构，这个设计整个搬**

### 必须补强的 16 条

见 [05-invariants.md](05-invariants.md) 的 **L 组**。核心是：gamma 只面向一个已知后端，而 DeerFlow 要经 nginx、依赖 SSE `Last-Event-ID` 做重放。

### 唯一需要主动改掉的设计

`merge-message.ts` 用了**模块级可变全局**（`imageBuffer` / `imageBufferMessageId`）。它有归属守卫，但模块级可变状态在多标签、多会话、并发流下天然脆弱。**DeerFlow 有 sidecar 子会话和多 thread 并存，不能照抄**——把它放进 message 自身或 per-stream context。

### LangChain 依赖：全部去掉

**终态决策：`@langchain/langgraph-sdk` 与 `@langchain/core` 都移除。执行条件：raw checkpoint、raw SSE trace、fake upstream、real Gateway 四类验证全部通过。**

早期方案曾建议保留 SDK 的 `Client` 与类型，理由是"纯 HTTP 封装，自己写没有增量价值"。补上实测数据后这个理由不成立：

| 事实                            | 数据                                                                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `Client` 的实际用量             | **7 个方法 / 10 个调用点**：`threads.search/get/update/updateState/delete`、`runs.get/list`                                        |
| `Client` 的配置复杂度           | `new LangGraphClient({ apiUrl, onRequest: injectCsrfHeader })` —— 无鉴权逻辑（cookie 由浏览器同源携带）、无重试、无拦截器          |
| `@langchain/langgraph-sdk` 体积 | **4.7 MB** unpacked                                                                                                                |
| `@langchain/core` 体积          | **7.6 MB** unpacked，而 `frontend/` 里**只有 1 处 type-only 引用**（`core/tools/utils.ts` 的 `ToolCall`）                          |
| `@langchain/core` 的传递依赖    | `langsmith`（可观测平台 SDK）、`js-tiktoken`（tokenizer）、`mustache`（模板引擎）、`@cfworker/json-schema` —— **前端一个都用不到** |

既然流式层——真正难的部分——已经自研，REST 层继续挂着 12.3 MB 的 SDK 是分裂的。

### 替代方案

| 原来                                                                                                  | 现在                                                            | 量        |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | --------- |
| `Client`                                                                                              | `app/core/api/client.ts` —— 7 个方法 + CSRF 头注入 + 错误规范化 | ~180 行   |
| REST 信封类型（`Thread` / `Run` / checkpoint 响应）                                                   | **`openapi-typescript` 从 Gateway 的 `/openapi.json` 生成**     | 0（生成） |
| `Message` / `AIMessage` / `ToolMessage` / `ToolCall` / `ThreadState` / `ThreadsClient` / `BaseStream` | `app/core/types/message.ts` 手写                                | ~120 行   |

**URL 前缀保持 `/api/langgraph/*`。** 移除的是 SDK，不是路由约定——该前缀是 nginx 侧 SSE 超时 / body 上限的挂载点，也是 E2E `mock-api.ts` 的拦截依据。详见 [07-parallel-run.md](07-parallel-run.md#为什么必须保住这些-url)。

⚠️ **手写类型必须结构等价，不能简化。** SDK 的 `MessageContent = string | MessageContentComplex[]`（`text` / `image_url` 联合）；塌成 `string` 会让 [05](05-invariants.md) 的 B1、B11 静默走形。这也是移除 LangChain 的真实代价所在——它波及 `core/` 里 17 个原本"零改动"的文件，明细见 [06 M1](06-migration-plan.md#m1--core-纯-ts-落地)。

**为什么 REST 类型能生成而 Message 不能**：Gateway 有 **102 处 `response_model`**，REST 路由的 OpenAPI schema 质量很高；但 `thread_runs.py` 把消息当 `Any` 处理（`_message_content(message: Any) -> Any`、`_checkpoint_values(...) -> dict[str, Any]`），消息结构是 `values` 里的动态内容，OpenAPI 里体现不出来。

**生成的类型比 SDK 的更准**——它反映的是这个 Gateway 的实际契约，而不是 LangGraph 的通用契约。

### 保留 `stream-mode.ts`，但放进适配层

`stream-mode.ts`（75 行纯 TS）**原样保留**，落点是 **`core/agent-deerflow/stream-mode.ts`** 而不是内核——`values` / `messages-tuple` / `checkpoints` 这些是 LangGraph 特有概念，进内核就破坏了协议无关性。

保留的理由：它是不变式 [A2](05-invariants.md) 的实现载体。把「哪些 stream mode 是 Gateway 支持的」这条契约固定在一个有测试覆盖的模块里，比依赖每个调用点自觉更可靠。校验时机从「SDK 调用前」变成「适配层构造请求时」。`sanitizeRunStreamOptions` 里剥离 `streamResumable` 的逻辑同样保留作为防御，即使自研 transport 不再产生该字段。

### 代价

1. 手写 Message 必须保留 `string | content parts[]` 并做 round-trip；不能简化为字符串
2. `openapi-typescript` 的生成与 diff 进入 CI；OpenAPI 不覆盖 SSE 动态 schema，另有 raw trace contract
3. M2 不再估固定 300 行；run session、结构化 cancel/inspect、完整 reducer、adapter 与 fixtures 以门禁闭环为完成标准

---

## 5. i18n 保留自研，不引 vue-i18n

**决策：保留现有词典结构，只把 React Context 换成 Nuxt plugin + `provide`/`inject`。**

| 文件                         | 行数  |
| ---------------------------- | ----- |
| `core/i18n/locales/en-US.ts` | 1,155 |
| `core/i18n/locales/zh-CN.ts` | 1,101 |
| `core/i18n/locales/types.ts` | 914   |

引入 vue-i18n 意味着 2,000+ 条文案重新 key，风险与收益不成比例。`ssr: false` 下不存在"函数不能跨 RSC 边界"的限制，两份带 formatter 的词典直接在客户端持有即可——比现在的 Next 版本还简单。

---

## 6. 关闭业务组件自动导入

**决策：`components: { dirs: [] }`，业务组件全部显式 import。**

126 个业务组件分布在 `workspace/messages/`、`workspace/artifacts/`、`workspace/sidecar/` 等多层嵌套目录。Nuxt 的自动导入按路径拼名（`WorkspaceMessagesMessageList`），既难读又容易与 `ui/` 下同名组件碰撞。

显式 import 保留与原项目一一对应的引用结构，让"这个组件对应原来哪个文件"始终可追溯——迁移期间这比少写几行 import 重要得多。

Composable 的自动导入（`app/composables/`）保留。

### 配套：文件头注释规约

显式 import 只解决了"引用关系可追溯"，解决不了"这个文件为什么长这样"。126 个组件逐个重写，半年后没人记得某处古怪写法对应的是哪条不变式。

采用 `nuxt-modern-starter` 的六段式文件头（那个项目 130 个源文件全覆盖，并有脚本校验），**加一栏本项目专有的对应关系**：

```ts
/*
  【文件职责】     一到两句，这个文件负责什么
  【对应 frontend/】 ★ 本项目专有：src/components/workspace/messages/message-group.tsx
  【架构位置】     L1 / L2 / L3 —— 直接对应 08 的分层，抽 L2 时按这一栏筛
  【主要导出】     对外暴露什么
  【依赖关系】     依赖谁 · 被谁引用
  【边界与注意】   ★ 关联的不变式编号（B4、B8…）与"修改须同步 X 测试"
*/
```

三栏是为本项目加的，各自解决一个具体问题：

| 栏                             | 解决什么                                                                                                                                                             |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **【对应 frontend/】**         | 上游持续演进（近 3 个月 239 次提交）。基线冻结在 `27a425b0` 后不再逐里程碑 diff，但换基线时要知道上游某个文件改了该跟到哪                                            |
| **【架构位置】L1/L2/L3**       | [08](08-agent-core-contract.md) 要求 L2 边界在 M4b / M5 逐模块抽。没有标记就得靠回忆挑文件，而"L2 会被磨掉"正是 [06 风险登记](06-migration-plan.md#风险登记)里的一条 |
| **【边界与注意】写不变式编号** | [05-invariants.md](05-invariants.md) 有 A–N 共 14 组。约束散在文档里、代码里没有痕迹，改动时不会有人回去查。写上 `B4`、`H6` 这类编号，改到该文件的人才看得见         |

不需要像参照项目那样上一整套 `docs-sync` 校验（130 个文件的 manifest + claims 抽取 + 批次报告，对本项目太重）。M8 实测 238 个 app/L1 源码里有 52 个非 `COPIED`
文件缺头，因此新增最小 `scripts/check-file-headers.mjs` 并接入 `make verify`；它只检查
六个标签是否存在，不建立第二份 claims/manifest。

### ⚠️ 但 `app/core/` 的 `COPIED` 集必须有机器守护

文件头注释解决「这个文件为什么长这样」，解决不了「它还是不是上游那一份」。**这两件事不能都靠 review**：最终 `COPIED` 集是整套迁移的护城河（[06 的两条底盘之一](06-migration-plan.md#两条底盘)），一旦有人「顺手改一行」，该文件的护城河属性就没了，而 review 看不出来。99 只是初筛候选数，不是最终 `COPIED` 数。

所以 `app/core/` 额外配 `PROVENANCE.md`、签入的 `baseline/core-sha256.json` 与 `core-provenance.test.ts`：每个文件标 `COPIED` / `RETYPED` / `ADAPTED` / `ADDED` / `DROPPED`，`COPIED` 与 manifest 比对。普通 CI 不依赖 shallow checkout 中是否恰好存在旧 commit；基线更新命令才读取 git 历史。详见 [M1 的 1e](06-migration-plan.md#1e-provenance-台账与-copied-hash-守护)。

这两套机制分工明确：**文件头给人看（为什么），PROVENANCE 给 CI 看（是不是还一致）。**

### 裁决：`COPIED` 档不加文件头

上面两节合起来留了个洞，M1 搬第一个文件就会撞上：§316 要求**每个源文件**带六段式文件头，
而 `COPIED` 的定义是逐字节等同上游——加了头就不再逐字节等同。两条规约不能同时满足。

**裁决：`COPIED` 不加文件头。溯源信息由 `PROVENANCE.md` 承担。**
其余四类（`RETYPED` / `ADAPTED` / `ADDED`，以及 `app/core/` 之外重写的组件）照 §316 加头。

三条理由：

1. **§316 的适用对象本来就是「本项目写的文件」。** 那一节挂在「关闭业务组件自动导入」下，
   动机是「126 个组件逐个重写，半年后没人记得某处古怪写法对应哪条不变式」。
   `COPIED` 不是本项目写的，它没有「本项目的古怪写法」可解释。
2. **加头就是拿护城河换一段注释。** §345 已经论证过这笔交易不能做：`COPIED` 集是整套迁移的
   护城河，「顺手改一行」review 看不出来，所以才配机器守护。文件头也是「改一行」，
   不因为它是注释就例外——`core-provenance.test.ts` 一样会红，而且**必须**红。
3. **§349 的分工本身就已经回答了。** 文件头答「这个文件为什么长这样」；`COPIED` 的答案是
   「上游就长这样，一个字节没动」。这句话恰恰是 `PROVENANCE.md` + `baseline/core-sha256.json`
   记录的内容，而且是机器可验的——比写进注释里更强。

配套两条：

- **需要给某个 `COPIED` 文件加头，等于承认它不再是 `COPIED`。** 走降级流程：
  改标 `RETYPED` / `ADAPTED`，在 `PROVENANCE.md` 写明理由。**不要改 baseline 让守护变绿。**
- **M8 的 `scripts/check-file-headers.mjs` 必须跳过 `class=COPIED`**（分类从
  `PROVENANCE.md` 读）。当前直接证据是 154 个本仓维护源码通过、84 个 `COPIED` 文件
  被跳过；脚本不写/刷新 baseline，也不修改 `COPIED` 文件。

---

## 7. 验收分层：功能合同与关键视觉门禁

**决策：共享 Playwright 是功能/交互硬门禁；有限的关键状态截图是视觉硬门禁；全页面 DOM diff 仍然只是诊断。**

采用 shadcn-vue 后，之前因引入有主见组件库而拆分的"分区验收"口径整个撤销。

| 维度                    | 要求           | 验收方式                                                                       | 是否门禁 |
| ----------------------- | -------------- | ------------------------------------------------------------------------------ | -------- |
| 功能                    | **一致**       | Playwright E2E，同一份 spec 跑两个 app                                         | ✅       |
| 交互逻辑与体验          | **一致**       | Playwright E2E + [05-invariants.md](05-invariants.md) 逐条勾选（A–N 共 14 组） | ✅       |
| 页面结构（DOM）         | 选择器契约一致 | E2E 选择器；`structural-diff` 只产出报告                                       | ❌       |
| 关键视觉状态            | 基线阈值内一致 | 固定 6–10 个截图状态，确定性数据 + 有限 mask                                   | ✅       |
| 非关键装饰/框架内部 DOM | 允许受控差异   | 人工回归 + structural report                                                   | ❌       |

### ⚠️ 为什么「DOM 结构一致」不能当门禁

早期版本把「页面结构（DOM）一致」列为硬要求，做法是 `structural-diff.spec.ts` 逐节点比 `tagName` + 属性集合 + 文本 + 子节点顺序，差异进「允许的差异类型登记」。

**这条要撤销，因为它无界。** Vue 与 React 的组件树在这些地方系统性地不同，且不是有限枚举：

- Reka UI 的 `Primitive` / `as-child` 与 Radix 的 `Slot` 展开出的包裹层不同
- `<Teleport>` 与 React portal 的挂载点、DOM 顺序不同
- Vue 的 fragment 锚点注释（`<!--[-->` / `<!--]-->`）、`v-if` 留下的注释节点
- `<Transition>` 在过渡期间的类名与额外节点

126 个组件会持续产生**新的差异类别**，那张登记表只会一直变长；而一张只增不减、又没有上限的登记表，等于没有门禁——最后一定是被人为放宽，或者反过来吃掉整个排期。

全量逐路由逐状态截图是无界的；**有限关键状态不是**。本方案只冻结空聊天、流式消息、reasoning/tool、artifact、settings、mobile、dark mode 等 6–10 个状态。基线先由冻结 React 版本在固定 Chromium/locale/viewport 下生成并人工确认，Vue CI 只比较、不自动更新。随机 id、时间、光标和动画用确定性数据或局部 mask；mask 列表同样受 review，不能覆盖主体内容。

### 结构仍然重要，但由 E2E 选择器承担

**结构一致不是为了好看，是三件事的前提**：E2E 选择器能复用、`globals.css` 那 453 行主题能直接搬、Markdown 输出的 CSS 能对上。

但这三件事**都不需要全量 DOM 等价**，只需要：

| 需要什么            | 由谁保证                                                                                                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E2E 选择器能复用    | **25 个合同 spec 本身**——选择器对不上就是红的，客观、有界、失败信息精确                                                                                                       |
| 主题能直接搬        | shadcn-vue 逐字复制 cva + 复刻 `data-slot` / `data-variant` 属性约定                                                                                                          |
| Markdown CSS 能对上 | [M3 的归一化 DOM 等价 gate](06-migration-plan.md#m3--markdown-渲染层)——**范围限定在 Markdown 输出这一个子树**，那里确实是有界的（unified 管线两边共用，差异只可能来自渲染器） |

换句话说：**Markdown 那棵子树做严格 DOM 等价（有界、且是同一条管线的输出），整页 DOM 不做。**

### `structural-diff.spec.ts` 的定位与边界

保留这个脚本，但明确三条：

1. **它是诊断，不是门禁。** 报告有内容不阻塞里程碑通过
2. **只覆盖固定的少数容器**（建议 ≤8 个：消息列表、消息组、composer、侧栏、artifacts 面板、settings 主区、thread 列表、workspace header），不是「逐页面」
3. **只比 E2E 选择器真正依赖的属性子集**——`data-slot`、`data-variant`、`role`、`aria-*`、可见文本。不比 `tagName`、不比完整属性集合、不比子节点顺序

这样它回答的是一个有用且有界的问题：「shadcn-vue 的 DOM 复刻假设还成立吗」。若报告里的**差异类别**开始增长（而不只是数量），说明那个假设有问题，值得回头看——这是[中止判定](06-migration-plan.md#相对工作量与中止判定)里的一条观察项，不是失败条件。

### 哪些样式差异可以放宽

Reka UI 与 Radix 的内部结构在个别组件上本来就有出入，为了消掉几像素的偏差去改 shadcn-vue 的实现，性价比很低，而且会让组件偏离 shadcn-vue 上游、后续升级困难。

### E2E 是功能/交互合同

这套 E2E 用 `page.route()` 拦截后端、断言真实 DOM 与文本，**与框架无关**。它验证功能与交互；视觉由上面的有限截图门禁补齐。

当前规模：mock 目录 27 个 spec / 130 个 test，排除 landing/docs 两个 spec 的 10 个 test 后，硬合同是 25 个 spec / 120 个 test；另有 1 个 auth spec 与 3 个 real-backend spec。CI 用 `--list` 输出实时数量，本文只记录 2026-08-04 基线。

⚠️ **spec 是合同，config 也是合同的一部分。** Vue 侧的 `playwright.config.ts` 必须逐字镜像 `frontend/playwright.config.ts` 的 `use` 段（尤其 `locale: "en-US"`）——config 不同等于合同条件不同，见 [03](03-project-shape.md#e2e共用-frontendtestse2e不复制)。

具体做法：

1. **不复制 spec**——`frontend-vue/playwright.config.ts` 的 `testDir` 直接指向 `../frontend/tests/e2e`。复制会漂移，漂移后合同失效。⚠️ M0 先跑 `playwright test --list` 验证用例能被收集到，见 [03](03-project-shape.md#️-m0-必须先验证-spec-能被收集到)
2. 保留 `frontend/tests/e2e/utils/mock-api.ts`（与被删除的产品内 static demo 模式无关，见 [01-scope.md](01-scope.md)）
3. **应用发出的 API URL 必须逐字一致**——`mock-api.ts` 实测有 **39 个 route pattern**，7 个在 `/api/langgraph/*`，32 个在裸 `/api/*`。不是保住一个前缀就够，见 [07](07-parallel-run.md#为什么必须保住这些-url)
4. `webServer` 改为 `nuxt build && PORT=3101 nuxt preview`（独立端口 + `reuseExistingServer: false`），并传 `NUXT_PUBLIC_AUTH_DISABLED=1`（对应 Next 版的 `DEER_FLOW_AUTH_DISABLED`，**25 个 spec 全部依赖它**）
5. **spec 视为只读合同。** 选择器基本可保持原样——shadcn-vue 复刻同样的 DOM 结构与 `data-slot` 属性约定。差异由 **Vue 侧消化**，不改 `frontend/`；实在对不上的进豁免登记表。口径与登记表见 [03](03-project-shape.md#选择器失效时的口径spec-只读--豁免登记)

> ⚠️ 第 5 条早期写的是「两边同步改，保持一份 spec」。**这条与 [06](06-migration-plan.md) 的「不提交对 `frontend/` 的任何修改」直接冲突**——改 spec 或给 React 组件加 `data-testid` 都落在 `frontend/` 里。已改为「spec 只读 + 豁免登记」，冲突消除。

已知需要复核的 spec：

- `tests/e2e/chat.spec.ts` —— 固定了"斜杠只在输入起始位置打开技能列表"
- `tests/e2e/sidecar-chat.spec.ts` —— 固定了"面板动画期间不得触发消息列表滚动"

### 页面结构一致靠诊断报告，不做门禁

126 个组件人工比对不可能可靠，所以还是要有机器手段——但它**不能靠改共用的 spec 实现**（那是只读合同），也**不该当门禁**（上一节的理由）。

做法：在 `frontend-vue/tests/structural-diff.spec.ts` 写一个**自有的** Playwright spec，同一份脚本对两个 `baseURL` 各跑一遍：

1. 复用 `mock-api.ts` 喂同一份确定性数据（只读引用，不修改）
2. 在若干稳定检查点，对**上一节列出的那 ≤8 个容器**提取选择器契约（`data-slot` / `data-variant` / `role` / `aria-*` / 可见文本），**不是 `outerHTML`**
3. 归一化：剥掉随机 id、`data-*` 里的 uuid、时间戳
4. 两份提取结果做 diff，**输出一份报告并归档**

**报告有内容不让构建失败。** 它的用途是让人看见「shadcn-vue 的 DOM 复刻假设在哪些组件上不成立」，而不是把每一处不成立都变成必须消灭的待办。

这样 `frontend/` 一个字都不用改，「结构」有了可观测的抓手，而排期不会被一张无限增长的登记表吃掉。
