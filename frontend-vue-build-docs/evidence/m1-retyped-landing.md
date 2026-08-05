# M1 窗口 3：23 个 RETYPED 落地，58 个测试解锁，typecheck 预算归零

> 交接单说「32 个 RETYPED」。复核后落地 **23** 个，另外 9 个不属于 M1——
> 理由见「9 个 BLOCKED：既不是 RETYPED 也不是 COPIED」。
>
> 交接单说「需装 @langchain/core 与 date-fns」。**一个包都不装**，见「装包：一个都不装」。

> ⚠️ **本文件先写了一版把 `@langchain/langgraph-sdk` 装进 frontend-vue 的结论，
> 那是错的，已在同一窗口内推翻并回退。** 经过保留在「订正：装 SDK 是错的」一节。
> 顺着这条线查下去发现**上一个窗口犯过同一个错**（悄悄装了 `ai`），
> 于是补了机器门禁 `tests/guards/forbidden-deps.test.ts`——见「同一个坑踩了两次」。

## 复跑命令

```bash
cd frontend-vue
make verify           # lint + format-check + typecheck(预算) + unit + collected-check + build
make migration-check  # baseline-check + codemod-check + land-retyped-check（读 git 对象，需完整 clone）
```

本窗口实测：两条都 **exit 0**。

| 指标                 | 上一窗口              | 本窗口                                              |
| -------------------- | --------------------- | --------------------------------------------------- |
| `make verify`        | 28 文件 / 247 用例    | **68 文件 / 625 用例**                              |
| 搬运的 core 测试     | 20（node 13 · dom 7） | **58（node 48 · dom 10）**                          |
| 等依赖的测试         | 40                    | **1**（`sidecar/api.test.ts`，等 M2 的自写 client） |
| typecheck 预算       | 58 条                 | **0 条**                                            |
| `app/core/` 磁盘文件 | 86                    | **110**                                             |
| 落地分类             | COPIED 85             | COPIED 82 · RETYPED 24 · BLOCKED 10                 |
| npm 依赖净变化       | —                     | **−1**（卸载 `ai`）                                 |

`make e2e-m0` 收工时重跑，**exit 0**（7 个子套件）。

> ⚠️ `make e2e-m0` 与 `make verify` **不能并发跑**。本窗口把前者放后台、
> 同时跑后者，两个 `nuxt build` 撞锁，e2e 报
> `Another Nuxt build is already running`——看起来像回归，其实是自己踩自己。
> 串行重跑才是 exit 0。

重建产物：

```bash
make baseline-refresh && make land-copied && make land-retyped && make codemod-tests && make typecheck-refresh
```

## 9 个 BLOCKED：既不是 RETYPED 也不是 COPIED

上一窗口给这 8 个留了话：「落地时逐个复核，若确实无需改动可降级回 COPIED」。
逐个看完这 8 个 barrel，**两头都不对**：

- 内容确实一个字节都不用改 → 不是 `RETYPED`；
- 但 7 个 barrel 都写着 `export * from "./hooks"`，而 `*/hooks.ts` 是 `REWRITE` 档、
  M4 才存在。降级成 `COPIED` 就是落一个指向不存在模块的 `export *` → 也不是 `COPIED`。

它们真正的状态是**在等被依赖方**。为此加了 `BLOCKED` 档
（`scripts/core-provenance.mjs`，`CLASS_ORDER` 里排在 `RETYPED` 与 `REWRITE` 之间：
比 RETYPED 轻——内容零改动；比 RETYPED 重——现在一行都落不了）。

不落地的代价实测为零：

| barrel                       | core 内消费方           |
| ---------------------------- | ----------------------- |
| `agents/index.ts`            | 无                      |
| `features/index.ts`          | 无                      |
| `integrations/lark/index.ts` | 无                      |
| `streamdown/index.ts`        | 无                      |
| `workspace-changes/index.ts` | 无                      |
| `utils/datetime.ts`          | 无                      |
| `settings/index.ts`          | 只有 REWRITE 档的 hooks |
| `uploads/index.ts`           | 只有 REWRITE 档的 hooks |

测试台账里只有一个 `streamdown-plugins.test.ts` 碰到它们，而它本来就是 `DEFERRED`。

`utils/datetime.ts` 值得单独说一句：它卡在 `i18n/cookies.ts` 上，而后者是 `REWRITE`
**只因为一个函数**——`getLocaleFromCookieServer()` 动态 import 了 `next/headers`。
它用到的 `getLocaleFromCookie()` 是纯 DOM、框架无关的。拆分那个文件能解锁它，
但拆分属于改上游结构，不在 M1「保真搬运」的范围内，留给 M4。

## 5 个卡在 DROPPED 上的测试：不用改写，也不用记为不迁

交接单给了两个选项（改写进 `HAND_MAINTAINED`，或正式记为「不迁」）。
**两个都不是**——真正的问题在判据，不在测试。

`api/api-client.test.ts`、`sidecar/api.test.ts`、`artifacts/{api,loader,utils}.test.ts`
被判为永远搬不了，是因为闭包按**上游的 import 图**算，而上游图里
`api/api-client.ts → static-mode.ts`、`artifacts/utils.ts → static-mode.ts` 这两条边通向 `DROPPED`。
但 06 §M1 1b 早就写了处置方式：**删分支**。删完那两条边根本不存在。

所以做法是把「retype 会删掉哪些 import」显式声明进台账
（`core-provenance.mjs` 的 `RETYPE_DROPS`，manifest 里产出 `droppedImports` / `landedDeps`），
闭包改读 `landedDeps`。5 个测试一次性解锁，**测试文件一个字节都没动**。

判据一改，`artifacts/{api,loader,utils}.test.ts` 3 个直接解锁：

```
COPIED         → 20 (node 13 · dom 7) · waiting 40
COPIED,RETYPED → 58 (node 48 · dom 10) · waiting 1
```

另外 2 个（`api/api-client.test.ts`、`sidecar/api.test.ts`）本来也解锁了，
但随后因为「订正：装 SDK 是错的」把 `api/api-client.ts` 判回 REWRITE 而重新卡住——
它们等的不再是 static-mode，而是 M2 的自写 client。前者的被测对象成了 REWRITE 档，
测试台账自动把它归入 `DEFERRED`；后者留在 `waiting`。

代价是这份声明必须与实际改写一致。两头都有门禁兜住：声明的 import 在基线上解析不到
→ `baseline-check` 报「声明已过期」；声明了却没删掉 → `land-retyped` 的残留检查报错。
两条都实测能红（见「门禁都实测能变红」）。

### 唯一一个真需要手工维护的测试

`artifacts/utils.test.ts` 有 2 个用例测 `isStaticWebsiteOnly()` 早返回——
而那段分支按 01-scope 删掉了。**这 2 个用例不是靠 import 图能发现的**：
它们通过 `NEXT_PUBLIC_STATIC_WEBSITE_ONLY` 环境变量驱动，源码里没有 `static-mode` 字样，
grep 和依赖闭包都看不见。是搬完之后跑测试才红出来的。

裁决：登记进 `rstest-to-vitest.mjs` 的 `HAND_MAINTAINED`，**只删不加**——
2 个 static demo 用例，外加整套 `NEXT_PUBLIC_*` 环境变量夹具
（配置改成注入 runtime options 之后它一个字节都读不到，留着会让人以为测试隔离了配置）。
其余用例逐字保留。理由写在该文件的六段式文件头里。

配套改了 codemod 两处，都是必须的：

- `codemod-tests` 原本 `rmSync` 整个 `tests/unit/core/` 再重写——**会把手工维护的文件删掉**。
  改成只清理「既不是本次生成、也不是手工维护」的残留。
- `codemod-check` 原本把手工维护的文件报成「不该存在」，现在放行，
  但反过来加了一条：登记为 `HAND_MAINTAINED` 却不在磁盘上 → 红（它必须被签入）。

## `core/types/message.ts`：塌陷只有一半会被编译器拦住

06 说塌成 `string` 会让 B1/B11 **静默**走形。实测**一半静默、一半不静默**：

| 消费方写法                                                                          | 塌成 `string` 后                                                                     |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `message.content.map(…)`（`extractTextFromMessage`）                                | **红**。`typeof === "string"` 之后剩 `never`，`.map` 不存在                          |
| `message.content[0]` + `"thinking" in part`（`extractReasoningContentFromMessage`） | **不红**。string 的 index 访问返回 string，分支静默变死代码，reasoning 从此恒为 null |

所以「24 个改完能编译」不构成证据。护栏分两层：

**类型层** —— `app/core/types/message.contract.ts`。
它在 `app/` 而不是 `tests/`，因为**`tests/` 根本不过 vue-tsc**：
`.nuxt/tsconfig.app.json` 的 include 只放了 `../tests/nuxt/` 一支。
实测把 `AgentMessageContent` 改成 `string` 后，写在 `tests/` 里的 `@ts-expect-error`
一声不吭、8 个用例全绿。断言放进 `app/` 才骑得上已有的 typecheck 预算门禁：

```
塌成 string          → message.contract.ts(29,3) / (40,3) 报 TS2344
塌成 AgentContentPart[] → message.contract.ts(34,3) / (38,42) 报 TS2344
正常                  → 无报错
```

**运行时层** —— `tests/guards/message-content-contract.test.ts`（7 个用例）。
夹具取自真实 thread：`frontend/public/demo/threads/*/thread.json` 共 **516 条消息**，
其中 **22 条是数组内容，且 22 条全部是 human 消息**——
塌陷会 100% 破坏用户自己发的消息，不是边角情况。夹具里只有 `text` part，
所以 `image_url`（两种形状）、`thinking`、未知 type + 额外字段在测试里合成补齐。

### 与 08 的一处有意不同

08 给的 `AgentContentPart` 是开放形状（`type: string` + index signature），
SDK 的 `MessageContentComplex` 是 `text | image_url` 闭合联合。**照 08 走**，理由是
上游自己就在防御闭合联合表达不了的东西：`messages/utils.ts` 对数组元素写了
`typeof content === "string"` 分支（Gemini 的 bare-string 续传，测试里有用例），
又用 `"thinking" in part` 取 reasoning。两者都不在 SDK 的闭合联合里。

代价是窄化变弱，落地时有一处要显式收敛（`extractURLFromImageURLContent` 的入参），
已声明在 `land-retyped.mjs` 的 PATCHES 里。

### 第一版写成 `interface`，被上游一句 `as` 抓出来

`message.ts` 第一版把消息族写成 `interface X extends BaseMessage`。
`messages/usage.ts` 有一句 `message as Record<string, unknown>`（读 SDK 没声明的
`usage_metadata`），直接 TS2352「两个类型没有足够重叠」——
**TS 只给类型别名隐式 index signature，不给 interface**。SDK 那边写的就是 `type` 交叉，
改回去才对。这条钉在 `message.ts` 的注释里。

## 装包：一个都不装

| 包                         | 交接单 | 实际       | 为什么                                                                                           |
| -------------------------- | ------ | ---------- | ------------------------------------------------------------------------------------------------ |
| `@langchain/core`          | 要装   | **不装**   | 只为一个 `ToolCall` 类型。06 §M1 1b 本来就把它列在「改指向 `@/core/types/message`」的 8 个符号里 |
| `date-fns`                 | 要装   | **不装**   | 只有 `utils/datetime.ts` 用，而它是 `BLOCKED`，M4 才落地                                         |
| `@langchain/langgraph-sdk` | 没提   | **不装**   | 02 §372 逐字写了「不必装进项目」。它的值导入者 `api/api-client.ts` 因此不是 M1 的活——见下节      |
| `ai`（Vercel AI SDK）      | 没提   | **卸载了** | 02 §321「决策：内联定义，不装这个包」。上一个窗口装的，见下下节                                  |

`frontend-vue/package.json` 的依赖**净减一个**（`ai`）。

## 订正：装 SDK 是错的

本窗口一度把 `@langchain/langgraph-sdk@1.6.0` 装进了 frontend-vue，理由写得很像样：
`api/api-client.ts` 里的 `import { Client }` 是值导入，任何 retype 都去不掉；
08 §351 写着「LangGraph SDK 可以作为开发期 oracle」，还给了删除条件。

**这个理由是查错了文档得出的。** 依赖决策不在 08（那是 agent-core 合同），在 02/04：

| 出处    | 原文                                                                                       |
| ------- | ------------------------------------------------------------------------------------------ |
| 02 §106 | `@langchain/langgraph-sdk`｜4.7 MB｜`Client` 的 7 个方法 / 10 个调用点 + 类型｜**❌ 移除** |
| 02 §249 | `@langchain/langgraph-sdk/client` → **移除** → 自写 `core/api/client.ts`（~180 行）        |
| 02 §372 | 「…**不必装进项目**」                                                                      |
| 03 §100 | `api/` ← **改写**：不再依赖 LangChain SDK                                                  |

08 说的「保留为开发期 oracle/fallback」指的是继续跑着的 `frontend/`（07 的并行运行），
以及 M2 那个**一次性 worktree** 里的兼容探针（06 §358、08 §68）——
都不是往 frontend-vue 的 `package.json` 里加一行。

正确结论：`api/api-client.ts` 的处置在计划里早就写好了——**自写 `core/api/client.ts`，
属于 M2**，不是 M1 的 retype。分类规则相应改成 `REMOVED_DEPS`：
这两个包的 type-only 导入 → `RETYPED`（重定向到自写类型），
**值导入 → `REWRITE`**（没有包可装，只能自写替代物）。

回退代价实测（这也是当初该先算的数）：

```
api/api-client.ts   RETYPED → REWRITE
api/index.ts        COPIED  → BLOCKED   （re-export 了 api-client）
sidecar/api.ts      COPIED  → BLOCKED   （import 了 api/index）
可搬测试            60 → 58
api/api-client.test.ts  → DEFERRED（被测对象成了 REWRITE）
sidecar/api.test.ts     → waiting（等 M2 的自写 client）
```

### 顺带暴露的两个真缺陷

**1. `BLOCKED` 的传播只做了一轮，不是不动点。**
`api/index.ts` 因为 re-export `api-client.ts`（REWRITE）而 BLOCKED，
但 `sidecar/api.ts` 的阻塞源头是 `api/index.ts`——它是 **BLOCKED 而不是 REWRITE**，
单轮扫描看不见，`sidecar/api.ts` 会被留在 COPIED 并落地成一个悬空 import。
改成对 `{REWRITE, BLOCKED}` 求不动点。原来那 8 个 barrel 恰好都只有一跳，
所以这个 bug 在回退之前不会显形。

**2. 两个 `land-*` 脚本只写不删。**
分类变化会让文件降级出落地档（这次是 3 个），旧文件留在磁盘上变成幽灵：
已经不在台账里，却还能被 import 到。`core-provenance.test.ts` 能报出来
（「磁盘上的每个文件都已登记」），但让人手动 `rm` 不如脚本扫掉——
`land-copied.mjs` 现在开工前先清理非落地档的残留。
这条正好补上了上一窗口留的第 6 条红项（「land-copied 没有 --check 模式」）的一半。

## 同一个坑踩了两次，所以补了机器门禁

回退 SDK 之后顺手查了一遍 02 点名不装的其他包，发现 `ai`（Vercel AI SDK）**已经在
`package.json` 里**——`058836aa`（上一个窗口）装的，提交说明里一个字没提。
而 02 §321 写着「**决策：内联定义，不装这个包**」，连落点都指好了
（「写进 `app/core/types/message.ts` 即可」）。

两次的形状完全一样：

|              | 上一窗口                                                | 本窗口                                      |
| ------------ | ------------------------------------------------------- | ------------------------------------------- |
| 触发         | COPIED 的 `uploads/prompt-input-files.ts` 解析不了 `ai` | RETYPED 的 `api/api-client.ts` 解析不了 SDK |
| 出路         | 装包（最省事）                                          | 装包（最省事）                              |
| 计划里的裁决 | 02 §321「不装这个包」                                   | 02 §372「不必装进项目」                     |
| 裁决躺在哪   | 另一个文档，没人翻                                      | 另一个文档，翻的是 08                       |

**光写文档挡不住这个**——第二次恰恰是在读了文档之后发生的（读的是 08，
而依赖裁决在 02）。所以加了 `tests/guards/forbidden-deps.test.ts`，两条断言：

1. 禁装清单里的包不许出现在 `dependencies` / `devDependencies`；
2. 台账的 `needsDeps` 里也不许出现——`needsDeps` 的语义是「落地前置条件：先装这个包」，
   禁装的包出现在那儿，说明分类规则漏了一条，下一个人照着台账做就会装回来。

清单每条都带 02/04 的出处。改这张表 = 推翻一条已记录的裁决，要先改 02 并进 review。
**门禁写完第一次跑就是红的**（`ai` 还装着），这不是设计出来的演示，是它本来就该报的。

`ai` 的处置按 02 §321 执行：`FileUIPart` 内联进 `app/core/types/message.ts`，
`uploads/prompt-input-files.ts` 从 `COPIED` 降级为 `RETYPED`（只改 import specifier）。
代价是它退出了 hash 护城河——但那正是 02 选好的取舍，不是新决定。

## 严格度差异：`frontend` 关了 `noImplicitAny`

落地后 vue-tsc 报 7 条。**5 条与我们的类型无关**——
`frontend/tsconfig.json` 显式写了 `"noImplicitAny": false`，
`frontend-vue` 继承 `strict: true` 因而是 `true`。实测把它关掉，7 条只剩 2 条。（回退 SDK 后 api-client.ts 不再落地，实际只剩 3 条要打补丁。）

上游 `frontend` 自己跑 `tsc --noEmit` 是 **exit 0 / 0 条报错**，所以这不是上游有 bug，
是两个工作区的门槛不同。

没有选择「跟着关掉 `noImplicitAny`」：那是拿全仓永久的检查强度换 5 处一次性的方便。
改成逐条声明补丁（都是纯类型断言，编译后一个字节不变）：

| 位置                                      | 上游为什么不报                              |
| ----------------------------------------- | ------------------------------------------- |
| `messages/utils.ts` × 3（`fileMatch[n]`） | `let fileMatch;` 是隐式 any，索引访问不受检 |

> 原本还有 `api/api-client.ts` 的 2 处（SDK 泛型），随该文件判回 REWRITE 一起没了。

> **这条留给后面的窗口：目前没有一个 `COPIED` 文件踩到隐式 any。**
> 一旦有，就没有「打补丁」这个选项了——`COPIED` 改一个字节 hash 就废。
> 那时候只能在「关掉 `noImplicitAny`」和「把该文件降级成 `RETYPED`」之间选，
> 而后者会让它退出 hash 护城河。

## eslint：只关规则，不豁免文件

`RETYPED` 与生成的测试**继续受检**（这是上一窗口定的口径），落地后报 31 条。
其中 2 条是本脚本自己的缺陷，已修：

- `tools/utils.ts` 两条 import 重定向到同一个目标 → `import/no-duplicates`。
  改成合并成一条（`land-retyped.mjs` 的 `firstByTarget`）。
- `api/api-client.ts` 删掉 `createStaticClient` 后 `AgentThreadState` 变成死 import
  → `no-unused-vars`。补进声明一起删。

剩下 28 条全在**我们没碰过的正文**里，消掉它们就得改上游逻辑。处理方式是关掉三条具体规则
（不是豁免文件——同一个文件里别的问题照报），每条都写了理由：

| 规则                                      | 范围                         | 为什么                                                                                                                                           |
| ----------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@typescript-eslint/no-empty-object-type` | RETYPED 档（从 manifest 推） | `interface X extends Generic<"a"> {}` 是给泛型实例化取名的常见写法，`messages/utils.ts` 有 6 处                                                  |
| `no-case-declarations`                    | 同上                         | `switch` 的 case 里声明 const；Next 预设不开，Nuxt 预设开                                                                                        |
| `import/first`                            | `tests/unit/core/**`         | 上游把 `vi.mock(…)` 写在 import 之前，**这是 vitest 的提升语义要求的**，9 个文件 21 处。按规则挪到 import 之后 mock 就不生效了——这条在这里是误报 |

余一条 warning 未处理：`messages/utils.ts:853` 有个上游写的
`eslint-disable @typescript-eslint/prefer-regexp-exec`，而 Nuxt 预设没开这条规则。
它是上游的行，不动。

## 门禁都实测能变红

沿用上一窗口的标准：不是「写了个检查」，是造出故障看它红，再还原看它绿。

| 门禁                             | 制造的故障                             | 结果                                                |
| -------------------------------- | -------------------------------------- | --------------------------------------------------- |
| `land-retyped-check`             | 手改一个已落地的 RETYPED 文件          | exit 1，并指向 `HAND_MAINTAINED` ✅                 |
| `codemod-check`                  | 删掉 `HAND_MAINTAINED` 的测试文件      | exit 1「登记为 HAND_MAINTAINED 但文件不在磁盘上」✅ |
| `land-retyped`（PATCHES）        | 把一条 `find` 改得对不上上游           | exit 1「补丁命中 0 次（应为 1 次），声明已过期」✅  |
| `baseline-check`（RETYPE_DROPS） | 声明一个基线上不存在的 import          | exit 1「声明已过期」✅                              |
| `typecheck`（message.contract）  | 联合塌向任一侧                         | 两个方向各 2 条 TS2344 ✅                           |
| `forbidden-deps.test.ts`         | 无需制造——`ai` 本来就装着              | 首次运行即红，指出 02 §321 ✅                       |
| `i18n-check`                     | zh-CN 单独删一个 key                   | exit 1「zh-CN 缺 key」✅                            |
| `i18n-check`                     | 两个 locale 一起删（typecheck 抓不到） | exit 1「基线里有、现在没了」✅                      |
| `architecture.test.ts`           | 8 条规则逐条越界                       | 每条各自红，无一漏网 ✅                             |

还验了两条幂等性：`make land-copied` 不会吃掉 PROVENANCE 里的 `RETYPED` 块
（两个块并列，不是嵌套）；`make codemod-tests` 不会删掉手工维护的测试（md5 前后一致）。

## 产出

| 文件                                            | 作用                                                  |
| ----------------------------------------------- | ----------------------------------------------------- |
| `scripts/land-retyped.mjs`                      | 按声明改写落地 RETYPED + 生成台账行；`--check` 防手改 |
| `app/core/types/message.ts`                     | 替代 SDK 的 wire 类型，15 个落地文件指向它            |
| `app/core/types/message.contract.ts`            | 联合塌陷的类型层护栏（骑 typecheck 预算门禁）         |
| `app/core/scheduled-tasks/schedule.ts`          | `ScheduleValue` 搬进 core，纠正依赖方向               |
| `tests/guards/message-content-contract.test.ts` | 真实夹具双向往返（7 个用例）                          |
| `tests/fixtures/message-content-shapes.json`    | 从 516 条真实消息抽的 22 + 3 条                       |
| `tests/guards/forbidden-deps.test.ts`           | 计划点名不装的包不许出现在依赖或 `needsDeps` 里       |
| `scripts/i18n-manager.mjs`                      | 词典体检 check / diff / unused（06 §1d）              |
| `baseline/i18n-keys.json`                       | 751 个 key 的基线，趁词典原样时取                     |

`core-provenance.mjs` 新增 `BLOCKED` 档（对 `{REWRITE, BLOCKED}` 求不动点）、
`REMOVED_DEPS`（@langchain/* 与 ai）与 `RETYPE_DROPS`；`test-selection.mjs` 的闭包改读 `landedDeps`；
`land-copied.mjs` 开工前清理降级出落地档的残留文件；
`Makefile` 的 `LANDED` 改成 `COPIED,RETYPED`，`migration-check` 加上 `land-retyped-check`。

### 夹具重建

```bash
node -e "
const fs=require('fs'),path=require('path');
const dir='frontend/public/demo/threads';
const arrays=[],strings=[],seen=new Set();let total=0;
for(const d of fs.readdirSync(dir).sort()){
  const p=path.join(dir,d,'thread.json'); if(!fs.existsSync(p))continue;
  for(const m of JSON.parse(fs.readFileSync(p,'utf8')).values?.messages??[]){
    total++; const r={source_thread:d,type:m.type,id:m.id,content:m.content};
    if(Array.isArray(m.content))arrays.push(r);
    else if(!seen.has(m.type)){seen.add(m.type);strings.push(r);}
  }
}
console.log(total,arrays.length,strings.length);
"
```

数据源在 `frontend/` 工作区，只在重建夹具时读，不进 `frontend-vue` 的运行时依赖。

## 顺手做的一轮「文档记了、实现没做」审计

`ai` 那件事说明这类偏离不止一处，所以把 01–08 里**可机械核对**的裁决逐条对了一遍。
结论是只有一处真缺口，其余要么已在、要么是后续里程碑的正常进度：

| 检查项                                     | 出处       | 结果                                                |
| ------------------------------------------ | ---------- | --------------------------------------------------- |
| `tests/architecture.test.ts` 存在          | 08 §32     | ✅ 在                                               |
| `packages/agent-core` 的 workspace 契约    | 08 §36     | ✅ package.json / exports / src/index.ts / tests 齐 |
| `package.json` 的 scripts 只留 postinstall | 03 §415    | ✅                                                  |
| 行为敏感包对齐 frontend 的 resolved 版本   | 02 §360    | ✅ zod / tailwindcss / typescript 三个已装的都一致  |
| 我们自己写的文件都有六段式文件头           | 04 §6      | ✅ 无一缺失                                         |
| 文档提到的 make 目标都存在                 | —          | ✅ 除下面两条，其余都在根 Makefile                  |
| **`scripts/i18n-manager.mjs`**             | **06 §1d** | **❌ 不存在**                                       |
| `make gen-api-types`                       | 02         | ⏳ M2（`openapi-typescript` 也还没装，进度正常）    |
| 03 规定的 package.json 里 38 个包未装      | 03 §592    | ⏳ 全是 M2/M4 的内容渲染与状态管理，进度正常        |

### 补上 `i18n-manager.mjs`（06 §1d，本来就是 M1 的活）

06 把它放在 M1 而不是 M4b，理由是**时序**：

> `i18n:diff` 的基线要在词典还是原样的时候取，此后每次组件重写都能立刻看出漏了哪个 key。
> 等 M4b 写完再补，基线就没了。

词典（3,209 行）正是本窗口随 RETYPED 落地的，所以现在就是那个时刻。三个子命令：

| 命令               | 判据                                                  | 是否进 verify                            |
| ------------------ | ----------------------------------------------------- | ---------------------------------------- |
| `make i18n-check`  | 两个 locale 的 key 集必须一致 + 基线里的 key 不许消失 | ✅ 已进                                  |
| `make i18n-diff`   | 当前 key 集 vs 基线，少的报错、多的只报告             | 否（诊断用）                             |
| `make i18n-unused` | 词典里有但代码里没人引用的 key                        | 否（M4b 前几乎全部未引用，只报告不判错） |

基线：`baseline/i18n-keys.json`，**751 个 key**。

key 用 TS AST 抽，不用正则——词典里全是嵌套对象和 `searchFor(query)` 这种模板函数，
正则分不清「对象字面量的属性」和「函数体里的对象」。

两种失效都造出来验过：

```
zh-CN 单独删一个 key        → ✗ zh-CN 缺 key：common.renameFailed
两个 locale 一起删          → ✗ 基线里有、现在没了：common.renameFailed
```

**第二种是 typecheck 抓不到的**——两边一起删之后 `Translations` 接口也改了，
类型完全自洽，只有基线知道这个 key 曾经存在。这正是 06 要求「趁原样取基线」的原因。

### 补齐 `architecture.test.ts`

M0 版只查 import specifier，也就是 08 §L1 禁入清单 7 条里的第 4 条和半条第 7 条。
其余 5 条当时没查——`packages/agent-core/src/` 只有一个 10 行 stub，查不查都绿。

**M2 马上要往这个目录里写东西**，而边界靠的是「越界当场红」；等目录满了再补，
越界的代码已经进来了。现在补齐 7 条，另加一条反方向的
（08 §54「禁止从应用中深路径 import `packages/agent-core/src/*`」——
绕过 `src/index.ts` 会让「整包搬走」当场作废）。

8 条规则逐条造故障验过能红：

```
import { ref } from "vue"                        → 1 failed
const url = "/api/langgraph/threads"             → 2 failed
const mode = "messages-tuple"                    → 1 failed
const a = document.cookie                        → 1 failed
let cache = new Map()                            → 1 failed   ← 全局单例
import … from "../../../app/core/config"         → 1 failed
应用侧 import "@deerflow/agent-core/src/index"   → 1 failed
```

业务词按**整词**匹配、且先剥注释：按子串匹配会把 `getValues`、`stateKey` 误伤，
而误报会逼人去改测试——那正是这个文件开头禁止的事。

## 红的 / 未验证的

1. **`config/index.ts` 的 retype 没有任何测试覆盖。** 58 个测试里有 8 个用到 `@/core/config`，
   但**全部整个 mock 掉它**（`vi.mock("@/core/config", () => ({ getBackendBaseURL: () => "" }))`）。
   注入式 runtime options 这条路径一次都没被执行过。
2. **`auth/auth-disabled-user.ts` 同样没有覆盖，而且有一处已知行为变更。**
   上游有一条兜底：即使 `DEER_FLOW_AUTH_DISABLED=1`，只要 `DEER_FLOW_ENV`/`ENVIRONMENT`
   是 prod/production 就强制关掉。Nuxt 侧没有等价输入（runtime config 由部署方给），
   这条兜底**不再存在**。它唯一的 core 消费方 `auth/server.ts` 是 REWRITE 档，
   唯一的测试 `auth/server.test.ts` 是 DEFERRED，所以现在既没人用也没人测。
   接线到 Nuxt plugin 时必须重新决定这条兜底放在哪。
3. **没有 Nuxt plugin 调用 `setDeerFlowRuntimeOptions()`。** 默认值是空串 / false，
   与上游 env 未设置时同行为，所以测试不受影响；但真接线之前 `getBackendBaseURL()`
   在浏览器里恒返回 `""`。这属于 M4a 的活，本窗口有意没做（M1 = core 落地，不接线）。
4. **`tests/**` 完全不过 vue-tsc**（`.nuxt/tsconfig.app.json` 的 include 只有 `../tests/nuxt/`）。
   58 个迁移测试与所有 guard 测试的类型错误不会被任何门禁发现。本窗口只针对
   message 契约绕开了（断言挪进 `app/`），**没有普遍解决**。要解决得单独引
   `vitest --typecheck` 或加 tsconfig project，代价没评估。
5. **`api/` 整个目录还没有落点。** `api/api-client.ts` 判回 REWRITE 后，
   `api/index.ts`、`sidecar/api.ts` 连带 BLOCKED，`sidecar/api.test.ts` 留在 waiting。
   解锁它们要等 02 §249 说的自写 `core/api/client.ts`（~180 行，7 个 REST 方法
   - CSRF 头 + 错误规范化），属于 M2。**这是本窗口唯一一个 waiting 的测试。**
6. **没跑过 `make e2e`（共享业务合同）。** 本窗口仍然只有 core 与其单测，没有页面接线。
   `make e2e-m0` 跑了，证明的是 M0 的地基没被破坏，不是业务行为没退化。
7. **`land-retyped.mjs` 的补丁是文本锚点，不是 AST。** 上游改一个空格，
   `find` 就命中 0 次并报错——会红而不是悄悄改错，这是有意的取舍，
   但换基线时这 11 条补丁（分布在 5 个文件）大概率要逐条重写。
8. **`rs.hoisted` 等价性仍未验证**（上一窗口的第 3 条红项原样留着）。
   codemod 仍会拒绝改写用到它的文件，目前只有 DEFERRED 的
   `threads/stream-throttle.test.ts` 用到。
