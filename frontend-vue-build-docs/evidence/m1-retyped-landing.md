# M1 窗口 3：24 个 RETYPED 落地，60 个测试全解锁，typecheck 预算归零

> 交接单说「32 个 RETYPED」。复核后落地 **24** 个，另外 8 个不属于 M1——
> 理由见「8 个 barrel：既不是 RETYPED 也不是 COPIED」，这是本窗口第一个结论。
>
> 交接单说「需装 @langchain/core 与 date-fns」。两个都**不需要**，
> 但需要一个交接单没预料到的：`@langchain/langgraph-sdk`。见「装包：换了一个」。

## 复跑命令

```bash
cd frontend-vue
make verify           # lint + format-check + typecheck(预算) + unit + collected-check + build
make migration-check  # baseline-check + codemod-check + land-retyped-check（读 git 对象，需完整 clone）
```

本窗口实测：两条都 **exit 0**。

| 指标                | 上一窗口         | 本窗口                     |
| ------------------- | ---------------- | -------------------------- |
| `make verify`       | 28 文件 / 247 用例 | **69 文件 / 643 用例**     |
| 搬运的 core 测试    | 20（node 13 · dom 7） | **60（node 49 · dom 11）** |
| 等依赖的测试        | 40               | **0**                      |
| typecheck 预算      | 58 条            | **0 条**                   |
| `app/core/` 磁盘文件 | 86               | **113**                    |

`make e2e-m0` 收工时重跑（本窗口动了 `eslint.config.mjs` 并加了一个运行时依赖）。

重建产物：

```bash
make baseline-refresh && make land-copied && make land-retyped && make codemod-tests && make typecheck-refresh
```

## 8 个 barrel：既不是 RETYPED 也不是 COPIED

上一窗口给这 8 个留了话：「落地时逐个复核，若确实无需改动可降级回 COPIED」。
逐个看完，**两头都不对**：

- 内容确实一个字节都不用改 → 不是 `RETYPED`；
- 但 7 个 barrel 都写着 `export * from "./hooks"`，而 `*/hooks.ts` 是 `REWRITE` 档、
  M4 才存在。降级成 `COPIED` 就是落一个指向不存在模块的 `export *` → 也不是 `COPIED`。

它们真正的状态是**在等被依赖方**。为此加了 `BLOCKED` 档
（`scripts/core-provenance.mjs`，`CLASS_ORDER` 里排在 `RETYPED` 与 `REWRITE` 之间：
比 RETYPED 轻——内容零改动；比 RETYPED 重——现在一行都落不了）。

不落地的代价实测为零：

| barrel                        | core 内消费方              |
| ----------------------------- | -------------------------- |
| `agents/index.ts`             | 无                         |
| `features/index.ts`           | 无                         |
| `integrations/lark/index.ts`  | 无                         |
| `streamdown/index.ts`         | 无                         |
| `workspace-changes/index.ts`  | 无                         |
| `utils/datetime.ts`           | 无                         |
| `settings/index.ts`           | 只有 REWRITE 档的 hooks    |
| `uploads/index.ts`            | 只有 REWRITE 档的 hooks    |

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

判据一改，`waiting` 从 5 直接归零：

```
COPIED         → 20 (node 13 · dom 7) · waiting 40
COPIED,RETYPED → 60 (node 49 · dom 11) · waiting 0
```

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

| 消费方写法                                              | 塌成 `string` 后 |
| ------------------------------------------------------- | ---------------- |
| `message.content.map(…)`（`extractTextFromMessage`）     | **红**。`typeof === "string"` 之后剩 `never`，`.map` 不存在 |
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

## 装包：换了一个

| 包                         | 交接单 | 实际           | 为什么 |
| -------------------------- | ------ | -------------- | ------ |
| `@langchain/core`          | 要装   | **不装**       | 只为一个 `ToolCall` 类型。06 §M1 1b 本来就把它列在「改指向 `@/core/types/message`」的 8 个符号里。而且它是 SDK 的 optional peer，没被 link 进 `node_modules/@langchain/`，装了才有 |
| `date-fns`                 | 要装   | **不装**       | 只有 `utils/datetime.ts` 用，而它是 `BLOCKED`，M4 才落地 |
| `@langchain/langgraph-sdk` | 没提   | **装了 1.6.0** | `api/api-client.ts` 里 `import { Client }` 是**值导入**，不是类型——任何 retype 都去不掉它 |

SDK 这个决定值得展开，因为 M2 要把它删掉：

- 分类规则原本对 `@langchain/langgraph-sdk` 一律重定向。这对 15 个 type-only 的文件是对的，
  对 api-client 是错的——换成自写类型就没有 `new Client()` 可用了。
  规则加了 `typeOnly: true`，值导入落回「装包」这条路。
- 装它的依据是 08「删除 SDK 的条件：raw trace 差分、session 状态机测试和 real Gateway smoke
  全部通过」——那是 M2 的门槛，M1 期间 SDK 作为开发期 oracle 是被允许的。
- 版本**钉死 1.6.0**（`package.json` 里不带 caret），与 `frontend` 实装的一致。
  `pnpm add @langchain/langgraph-sdk@^1.6.0` 会解析到 1.9.28，跨 3 个 minor；
  M1 的前提是行为保真，同时换 SDK 版本会让任何测试失败都说不清是谁的锅。
- 实测没有拉进 React（它是 optional peer），`node_modules/react` 不存在。

## 严格度差异：`frontend` 关了 `noImplicitAny`

落地后 vue-tsc 报 7 条。**5 条与我们的类型无关**——
`frontend/tsconfig.json` 显式写了 `"noImplicitAny": false`，
`frontend-vue` 继承 `strict: true` 因而是 `true`。实测把它关掉，7 条只剩 2 条。

上游 `frontend` 自己跑 `tsc --noEmit` 是 **exit 0 / 0 条报错**，所以这不是上游有 bug，
是两个工作区的门槛不同。

没有选择「跟着关掉 `noImplicitAny`」：那是拿全仓永久的检查强度换 5 处一次性的方便。
改成逐条声明补丁（都是纯类型断言，编译后一个字节不变）：

| 位置                                  | 上游为什么不报                                   |
| ------------------------------------- | ------------------------------------------------ |
| `messages/utils.ts` × 3（`fileMatch[n]`） | `let fileMatch;` 是隐式 any，索引访问不受检      |
| `api/api-client.ts` × 2（SDK 泛型）    | 生成器形参是隐式 any，SDK 两个重载与 `TypedAsyncGenerator` 的泛型都不必解 |

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

| 规则                                   | 范围                     | 为什么 |
| -------------------------------------- | ------------------------ | ------ |
| `@typescript-eslint/no-empty-object-type` | RETYPED 档（从 manifest 推） | `interface X extends Generic<"a"> {}` 是给泛型实例化取名的常见写法，`messages/utils.ts` 有 6 处 |
| `no-case-declarations`                 | 同上                     | `switch` 的 case 里声明 const；Next 预设不开，Nuxt 预设开 |
| `import/first`                         | `tests/unit/core/**`     | 上游把 `vi.mock(…)` 写在 import 之前，**这是 vitest 的提升语义要求的**，9 个文件 21 处。按规则挪到 import 之后 mock 就不生效了——这条在这里是误报 |

余一条 warning 未处理：`messages/utils.ts:853` 有个上游写的
`eslint-disable @typescript-eslint/prefer-regexp-exec`，而 Nuxt 预设没开这条规则。
它是上游的行，不动。

## 门禁都实测能变红

沿用上一窗口的标准：不是「写了个检查」，是造出故障看它红，再还原看它绿。

| 门禁                       | 制造的故障                        | 结果 |
| -------------------------- | --------------------------------- | ---- |
| `land-retyped-check`       | 手改一个已落地的 RETYPED 文件     | exit 1，并指向 `HAND_MAINTAINED` ✅ |
| `codemod-check`            | 删掉 `HAND_MAINTAINED` 的测试文件 | exit 1「登记为 HAND_MAINTAINED 但文件不在磁盘上」✅ |
| `land-retyped`（PATCHES）  | 把一条 `find` 改得对不上上游      | exit 1「补丁命中 0 次（应为 1 次），声明已过期」✅ |
| `baseline-check`（RETYPE_DROPS） | 声明一个基线上不存在的 import | exit 1「声明已过期」✅ |
| `typecheck`（message.contract） | 联合塌向任一侧               | 两个方向各 2 条 TS2344 ✅ |

还验了两条幂等性：`make land-copied` 不会吃掉 PROVENANCE 里的 `RETYPED` 块
（两个块并列，不是嵌套）；`make codemod-tests` 不会删掉手工维护的测试（md5 前后一致）。

## 产出

| 文件                                          | 作用                                             |
| --------------------------------------------- | ------------------------------------------------ |
| `scripts/land-retyped.mjs`                    | 按声明改写落地 RETYPED + 生成台账行；`--check` 防手改 |
| `app/core/types/message.ts`                   | 替代 SDK 的 wire 类型，16 个文件指向它           |
| `app/core/types/message.contract.ts`          | 联合塌陷的类型层护栏（骑 typecheck 预算门禁）    |
| `app/core/scheduled-tasks/schedule.ts`        | `ScheduleValue` 搬进 core，纠正依赖方向          |
| `tests/guards/message-content-contract.test.ts` | 真实夹具双向往返（7 个用例）                   |
| `tests/fixtures/message-content-shapes.json`  | 从 516 条真实消息抽的 22 + 3 条                  |

`core-provenance.mjs` 新增 `BLOCKED` 档与 `RETYPE_DROPS`；
`test-selection.mjs` 的闭包改读 `landedDeps`；
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

## 红的 / 未验证的

1. **`config/index.ts` 的 retype 没有任何测试覆盖。** 60 个测试里有 8 个用到 `@/core/config`，
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
   60 个迁移测试与所有 guard 测试的类型错误不会被任何门禁发现。本窗口只针对
   message 契约绕开了（断言挪进 `app/`），**没有普遍解决**。要解决得单独引
   `vitest --typecheck` 或加 tsconfig project，代价没评估。
5. **`api/api-client.ts` 顶上还留着 `"use client"`。** Next 的指令，在 Vue 侧无意义也无害，
   属于上游正文，没有声明改写它。
6. **没跑过 `make e2e`（共享业务合同）。** 本窗口仍然只有 core 与其单测，没有页面接线。
   `make e2e-m0` 跑了，证明的是 M0 的地基没被破坏，不是业务行为没退化。
7. **`land-retyped.mjs` 的补丁是文本锚点，不是 AST。** 上游改一个空格，
   `find` 就命中 0 次并报错——会红而不是悄悄改错，这是有意的取舍，
   但换基线时这 12 条补丁大概率要逐条重写。
8. **`rs.hoisted` 等价性仍未验证**（上一窗口的第 3 条红项原样留着）。
   codemod 仍会拒绝改写用到它的文件，目前只有 DEFERRED 的
   `threads/stream-throttle.test.ts` 用到。
