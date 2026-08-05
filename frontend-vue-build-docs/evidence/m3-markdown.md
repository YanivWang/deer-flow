# M3 · Markdown 渲染层 —— 证据

日期：2026-08-06 · 分支 `main-wc`

本文只记录 git 与代码留不下的东西：**为什么这么选、试过什么被否决、还有什么没证实**。
交付了哪些文件看 `git show`，怎么实现的看文件头注释。

---

## 1. 门禁的真实颜色

全部在本窗口实测，命令可直接复跑（`cd frontend-vue`）：

| 命令                    | 结果   | 规模                                     |
| ----------------------- | ------ | ---------------------------------------- |
| `make verify`           | exit 0 | 91 个文件 / 900 个用例                   |
| `make migration-check`  | exit 0 | 台账 4 条全绿                            |
| `make e2e-m0`           | exit 0 | 7 个子套件 / 14 个用例                   |
| `make consumer-check`   | exit 0 | 干净消费者安装 + typecheck + 最小 session |

M3 新增的部分：

```bash
cd frontend-vue
pnpm exec vitest run tests/unit/markdown/    # 54 个用例 / 6 个文件
pnpm exec vitest run tests/guards/           # 30 个用例 / 6 个文件
node scripts/record-react-markdown.mjs --check   # 夹具与当前 frontend/ 一致
```

> ⚠️ `make verify` 与 `make e2e-m0` **不能并发**（两个 nuxt build 抢锁）。
> 后台任务返回的 0 是复合命令的退出码，不是 make 的。

M2 的基线数字是 84 文件 / 844 用例；本窗口 +7 文件 / +56 用例。

---

## 2. gate 判据是怎么定下来的（这一节是本里程碑的核心决定）

### 2.1 拿什么当「React 版」

04 §1 只说「与 React 版做归一化 DOM 等价比对」，没说 React 版是哪一个。落地时发现这
是个真岔路，两条路差着一个里程碑的工作量：

- **(a) 完整的 `<Streamdown>`**：它自带 **37 个组件槽位**（`data-streamdown="heading-1"`
  `"table-wrapper"` `"link-safety-modal"` …），表格带复制/下载/全屏三个按钮，链接渲染成
  `<button>` 外加一个安全确认弹窗，图片带 hover 遮罩。要 DOM 等价就得把这些全复刻。
- **(b) 组件槽位全部退回同名内建标签**：拿到的是「它真实的 unified 管线 +
  `hast-util-to-jsx-runtime`」的裸输出。

**选 (b)。** 三条理由：

1. 04 §1 自己写的是「差异只可能来自渲染器」——(b) 才让这句话成立。(a) 比的是 Vercel 的
   产品 UI 复刻得像不像，那是另一个问题。
2. 02/04 已经裁决 UI 层走 shadcn-vue 并**逐字复制 shadcn-vue 的 cva 串**。从 streamdown
   的 dist 里搬一套竞品设计语言进来，与那条裁决直接冲突。
3. (a) 会把 M4b 的组件层工作提前压进 M3，而 M4b 那 104 个组件本来就是工作量主体。

实现上靠 Streamdown 的 `components` prop 接受内建标签名：录制时传一张
`{h1:"h1", p:"p", …}` 的中性映射即可。**(a) 那份也录着**（夹具的 `styledHtml` 字段），
它是 M4b 的组件层规格——那 37 个槽位到时候要逐个对照，不必再去读 dist。

### 2.2 允许的差异有哪些

6 类，已登记进 [04 §1](../04-architecture-decisions.md#允许的差异类型m3-落地时实测确定共-6-类)，
实现在 `tests/support/dom-equivalence.ts`。**新增任何一类都要改那两处**。

其中第 6 类（相邻文本节点合并）是实测撞出来的，不是预想到的：React 把
`["a"," ","b"]` 序列化成一个文本节点，Vue 为每个 vnode 子节点建一个 DOM 文本节点，
于是 `- [ ] todo` 在两边分别是 1 个和 2 个文本节点。合并后仍然**逐字符**比对。

### 2.3 语料

16 条，覆盖标题 / 行内标记 / 三种列表（含 task list）/ 带对齐的表格 / 嵌套引用 / hr /
带语言与不带语言的代码块 / mermaid 围栏 / 行内与块级公式 / 链接与图片 / raw HTML
（转义与解析两条路径）/ 默认链的 sanitize+harden / 流式列表项 / remend 自愈 / 脚注。

**16 条全绿。** 这是 M3 最实质的结论：`hast-util-to-jsx-runtime` 的 Vue 出口在这套语料上
与 React 出口 DOM 等价，`elementAttributeNameCase:"html"` + `stylePropertyNameCase:"css"`
这组取值成立。

---

## 3. 试过并被否决的做法

### 3.1 分块 key 掺内容哈希 —— 否决

第一版写的是 `key = ${index}-${fnv1a(content)}`：同一序号换了内容就换 key、重新挂载。
看起来更精确，**实际让 05 M4 当场失守**——流式的最后一块每个 chunk 都在变，于是每个
chunk 都把它整块卸载重建，`invariants.dom.test.ts` 的「追加后已渲染的词还是同一个 DOM
节点」直接红。

改成纯序号。内容变化走 props 更新，Vue 原地 patch。「前面某块内容变了也复用旧子树」
不是缺陷，复用即 patch，不是显示旧内容。

### 3.2 逐词动画用 rehype 插件 —— 未尝试，按裁决绕开

05 M4 与 `frontend/AGENTS.md` 都写死了不许用 per-word rehype 插件：hast 树一变，
`hast-util-to-jsx-runtime` 按「同名兄弟计数」生成 key（`span-0` `span-1` …），
块内结构一动，已渲染的词就换 key、重挂载、重播动画。

本层的做法是把切词放在**渲染器边界**：`applyWordAnimation` 是普通函数（不进 unified
管线），词段元素带 `data-md-word="{绝对字符偏移}"`，再由一层 `jsx`/`jsxs` 包装把 key
**强制**改成 `w{偏移}`。偏移只增不改，所以 key 与兄弟计数无关。

配套的一条实现细节值得单独记：`MarkdownBlock` 里那个「上一帧渲染到第几个字符」的游标
**故意不是 `ref`**。渲染函数里同时读写一个 ref 会让它成为自己的依赖，写入触发第二次
渲染，而第二次渲染时游标已等于本帧长度，所有词都被判成旧词、动画 class 当场被摘掉——
效果是动画根本看不见。

### 3.3 在 `dom` project 之外跑组件测试 —— 否决

`.vue` 在 node/dom 两个 vitest project 里没人编译（报 "invalid JS syntax"）。两个选择：
组件测试改走 `nuxt` project，或给 `dom` project 挂 `@vitejs/plugin-vue`。选后者——
`@vue/test-utils` 要的只是一个 document，上 Nuxt 会把「渲染一段 markdown」的用例
拖成整套应用启动。

---

## 4. 落地时才看见的三件事（已回写进 02/06）

1. **`components.tsx` 那 ~120 行估的不是 Streamdown 的默认组件映射。** 后者 37 个槽位，
   不在 M3 范围，归 M4b，规格已录进夹具的 `styledHtml`。
2. **DeerFlow 消息路径把 Streamdown 的默认插件链整条换掉了**——Streamdown 的语义是替换
   不是追加，所以线上消息渲染既没有 rehype-raw，也没有 sanitize 与 harden。
   02 那句「streamdown 两个都用」说的是默认链，对消息路径不成立。原始 HTML 在那条链上
   被 `remarkHtmlToText` 降级成转义文本，净化没有作用对象。
   **给它加回 sanitize/harden 是行为变更，不属于「照搬」，需要单独决定。**
3. **`@source` 静默失效的坑在 M0 就已经避开了**：`app/assets/css/main.css` 里没有那三行
   指向 streamdown dist 的 `@source`。但 main.css 目前只有 74 行（M0 骨架），
   453 行的完整 globals.css 要到 M4b/M8 才搬——**那时候才是真正会踩的时刻**。
   已加 `tests/guards/css-source-scan.test.ts` 把门提前关上。

---

## 5. 红项与未证实（做 M4 时必须知道）

1. **shiki 高亮之后的 token DOM 没有对照**（但高亮本身已验证真的发生）。
   夹具录的是 React SSR，那时 shiki 还没跑完，拿到的是未高亮的回退结构。M3 比对的正是
   这一帧（逐属性全等），**高亮之后两边 token 拆分是否一致，本窗口没有回答**。
   要答就得把录制从 SSR 换成真实浏览器。

   > **⚠️ 这一条差点变成假绿，值得单独记。** 第一版用例只断言「高亮回来之后文本还在」，
   > 而组件在 shiki 失败时是**静默回退**到未高亮结构——文本一模一样还在，用例照绿。
   > 收口后补测才发现：`await flushPromises()` 一次根本不够，shiki 的 `codeToTokens`
   > 内部还要按需动态 import 语法与主题，每个都是独立模块加载。实测第 1 轮与第 5 轮
   > 拿到的都还是回退结构（每行 1 个 token span），**到第 20 轮才变成 11 个**。
   > 现在的断言改成「token 数 > 1 且 `--sdm-c` / `--shiki-dark` 是真实色值而不是 inherit」，
   > 并把等待轮数写进 `settle()` 的注释。**结论：shiki 这条路径是通的**，
   > 上一版评估里说它「跑不通」是等待轮数不足造成的误判。

2. **mermaid 在本仓的测试环境里画不出图，真实浏览器下未验证。**
   实测（直调真包，非组件）：`mermaid.parse` 通过、`mermaid.render` 也 resolve，
   但 **`svg.length === 0`** ——happy-dom 没有文本测量能力，mermaid 拿不到尺寸。
   组件对空串走 `v-if="svg"` 的假值分支，回退成代码块，行为上是对的，
   但这意味着**真实 mermaid 的成功路径在本仓一次都没跑通过**。
   `tests/unit/markdown/mermaid.dom.test.ts` 把 mermaid 包整个 mock 掉，
   验的是**分派与容错**（成功出图、失败保持代码块、晚到结果不覆盖新内容、
   `securityLevel: "strict"`），不是它画得对不对，也不是它在浏览器里画不画得出来。
   要证实只能上 Playwright（M4b 接线之后）。
3. **本层还没有任何消费方。** 与 M2 的内核同样的处境：`StreamMarkdown` 一个调用方都没有，
   `richContentComponents` 也没有。接线在 M4b（`markdown-content.tsx` 的 Vue 版）。
   也就是说「流式追加时的真实表现」只被单测覆盖，没被真实 SSE 流验证过。
4. **逐词动画只在单测里跑过，没有视觉验收。** 入场 class 由调用方给
   （`newWordClass`），本层不带 CSS keyframes——`main.css` 里还没有对应的动画定义，
   那是 M4b 搬 globals.css 时的事。现在传任何 class 都能通过测试，因为断言的是 class
   有没有加对，不是动画好不好看。
5. **`parseIncompleteMarkdown` 只验了一种畸形**（未闭合的 `**`）。remend 能修的构造
   远不止这一种，语料里没有覆盖表格、链接、代码围栏的半截状态。
6. **性能没有测过。** 分块 + Vue props 记忆化的效果、`applyWordAnimation` 每帧重建子树的
   代价，都没有量过。M2 遗留的「分帧层在大帧上是 O(n²)」也仍然没有优化。
7. **M2 的红项原样有效**：内核仍无调用方、`types.gen.ts` 无消费方、`core/threads/` 的
   25 个上游单测只落地 6 个、golden trace 仍缺 `custom`/`debug`/subagent namespace/reasoning。

---

## 6. 依赖

按 02 §337-341 的授权表逐条装的，版本对齐 `frontend/pnpm-lock.yaml` 的 resolved
（行为敏感包精确锁）：

```
unified 11.0.5            remark-parse 11.0.0      remark-rehype 11.1.2
remark-gfm ^4.0.1         remark-math ^6.0.0
rehype-raw ^7.0.0         rehype-katex ^7.0.1
rehype-harden 1.1.8       rehype-sanitize 6.0.0
hast-util-to-jsx-runtime 2.3.6                     unist-util-visit ^5.1.0
remend 1.3.0              marked 17.0.6            shiki 3.23.0
katex 0.16.28             mermaid 11.12.2
@types/hast ^3.0.5  @types/mdast ^4.0.4  @vitejs/plugin-vue 6.0.8   （devDep）
```

**`streamdown` / `@streamdown/code` / `@streamdown/mermaid` 没装**，并已写进
`tests/guards/forbidden-deps.test.ts`。这是同一个形状第三次出现（前两次是 `ai` 与
`@langchain/langgraph-sdk`）：搬运时遇到解析不了的 import，装包最省事，而「不装」的裁决
躺在另一个文档里。这次在写代码之前就先把门关上了。

`marked` 与 `shiki` 的版本取的是 **streamdown 自己解析到的那两个**（17.0.6 / 3.23.0），
不是 frontend 顶层的 16.4.2 / 3.15.0——后者来自别的消费者。

---

## 7. 复跑清单

```bash
cd frontend-vue
make verify                                  # 91 文件 / 900 用例
make migration-check                         # 台账 4 条
make e2e-m0                                  # 与 verify 串行，不要并发
make consumer-check                          # 需要联网
node scripts/record-react-markdown.mjs --check   # React 夹具是否过期
node scripts/record-react-markdown.mjs           # 重录（frontend/ 的 streamdown 变了才需要）
```
