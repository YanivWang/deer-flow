# M2 · L1 内核 + L3 协议适配层

> 本文只写 git 与代码留不住的东西：为什么这么选、试过什么被否决、还有什么没证实。
> 分类计数、文件清单、改了哪几行，去看 `baseline/core-manifest.json` 与提交历史。

## 复跑命令

```bash
cd frontend-vue
make verify           # lint + format + typecheck(预算) + typecheck-core + unit + collected + i18n + build
make migration-check  # baseline + codemod + land-retyped（读 git 对象，需完整 clone）
```

本窗口实测：两条都 **exit 0**。

| 指标                                 | 上一窗口（M1 收口）        | 本窗口                               |
| ------------------------------------ | -------------------------- | ------------------------------------ |
| `make verify`                        | 68 文件 / 625 用例         | **77 文件 / 757 用例**               |
| L1 行为测试                          | 0                          | **86**（含 golden trace 9）          |
| L3 测试                              | 0                          | **54**                               |
| 等依赖的测试                         | 1（`sidecar/api.test.ts`） | **0**                                |
| `app/core/` 分类                     | COPIED 82 · BLOCKED 10     | **COPIED 84 · BLOCKED 8**            |
| typecheck 预算                       | 0 条                       | **0 条**                             |
| `packages/agent-core` 是否被类型检查 | **否**                     | **是**（新增 `make typecheck-core`） |

`make run-protocol-smoke` 跑了两次（第二次是补一条去敏规则），都 exit 0。
`make e2e-m0` 收工时重跑，**exit 0**（7 个子套件：7+2+1+1+1+1+1 个用例）。

> ⚠️ `make e2e-m0` 与 `make verify` **不能并发跑**（两个 `nuxt build` 撞锁）。
> 本窗口全程串行。

---

## 最该记住的一件事：内核写完时，它从没被类型检查过

`.nuxt/tsconfig.app.json` 的 include 只有 `app/**` 与 `tests/nuxt/**`。
`packages/agent-core/src/**` 一行都不在里面。M1 evidence 的红项 #4 记的是
「`tests/` 不过 vue-tsc」，实际范围比那大得多：**整个 M2 交付物都在洞里**，
而 `make verify` 从头到尾是绿的。

补的方式不是把路径塞进 Nuxt 的 include，而是给包**两份自己的 tsconfig**：

| 文件                 | `types`    | 管什么                                   |
| -------------------- | ---------- | ---------------------------------------- |
| `tsconfig.json`      | `[]`       | `src/**`。**不许 import `node:fs` 之类** |
| `tsconfig.test.json` | `["node"]` | 加上 `tests/**`，测试要读 fixture 文件   |

两份的差就是「这个包能整包搬走」这条承诺的机器证据（08 §54 要求的临时 consumer
workspace typecheck，本质上就是这件事）。合成一份，`src` 就能悄悄用上 Node 全局
而没人发现。

首次运行 **6 条错误**，全部来自 `exactOptionalPropertyTypes`。
处理方式是**修代码不是关检查**——注意这与 M1 对 `noImplicitAny` 的取舍是反的：
那次报错的是上游遗留代码，关掉是拿全仓强度换一次性方便；这次报错的是自己十分钟前
刚写的代码，修它只要几分钟。判据是「谁写的、修得起吗」，不是「哪个更省事」。

`make typecheck-core` 已进 `verify`，并造故障验过能红。

---

## 测试抓出来的三个真缺陷

都是「只在特定路径下才显形」的那种，eslint 与 tsc 全绿，人眼看代码也看不出来。

### 1. buffer 上限判早了

原实现收到 chunk 就判上限。于是一个装了 50 个完整帧的 chunk 会触发 64 字节的上限——
而 05 L6 要防的是「后端一直不发空行导致残留无限增长」，量的是**残留**不是吞吐。
正确顺序是先把完整帧排干、再判剩下的。

### 2. drain 一帧尾巴都读不到

`settleStop` 的 drain 用的是**已经被 `stop()` abort 掉的** stream signal，
第一次 `read()` 之前就抛 abort。症状：**用户每点一次停止，最后一段回答就被吞掉**，
而状态机最终仍然落到 `completed`——只看最终状态永远发现不了。

上一个提交已经为 cancel 分开了两个 AbortController，却漏了 drain 这条路径。
同一个错误的第二种形态，隔了一个提交才被测试逼出来。这条值得记：
**「我已经想到这个问题了」不等于「所有走这条路的代码都改了」。**

### 3. 照搬 COPIED 的 `stream-mode.ts` 到适配层，校验什么都不做

05 §A2 说「原样保留 + 校验时机改到适配层构造请求时」。但到那个时机，手里已经不是
SDK 的 options 对象而是 wire 请求体了：SDK 写 `streamMode`，Gateway 收 `stream_mode`。
`"streamMode" in options` 恒为 false，**校验一声不响地放行**。

修法是在适配层显式桥接两种命名，而不是改 `stream-mode.ts`（它是 COPIED 档，
改一个字节就退出 hash 护城河，而且要修的本来也不是它的逻辑）。
05 §A2 已补上这条修正。

> 这三条都不是「写测试顺便发现的」，而是**只有写测试才能发现的**。
> 上一个提交的 1640 行内核 lint 干净、类型干净、架构门禁全过，
> 里面躺着两个会让用户丢内容的 bug。

---

## L1 唯一的协议知识入口：`ClassifyEvent`

内核不能认识 `end` / `error` / `gap`——它们是 DeerFlow 的 wire 事件名，写进 L1 就
等于把协议塞进内核（`architecture.test.ts` 也会当场拦下）。但内核**必须**分得出
「流正常结束 / 后端报错 / 出现重放缺口」，否则意外 EOF 与正常完成永远分不开，
而这两者的处置完全相反（一个该退避重连，一个该收工）。

试过的两条路：

- 让 reducer 返回 session action → reducer 是纯函数、在 store 那一侧，
  而重连决策在 session 这一侧，绕一圈还要把 store 塞进 session；
- 内核认识一个可配的事件名表 → 表里放的还是 `"end"` 这些字符串，
  只是换了个地方违反禁入清单。

最终形状是适配层传入一个纯函数 `(event) => StreamSignal`。它可测、可替换，
而且把「协议知识只有这一个入口」变成了类型层面的事实。08 已补上这段。

## 对 08 的一处有意加宽：`InspectedRun.outcome`

08 原来的 `{ terminal: boolean; reason?: string }` 表达不了它自己的硬规则 8——
后者要求分出 `cancelled` / `completed` / `failed` **三个**去向，而 boolean 只有两个值。
要在原形状下分路，内核就得认识 `"interrupted"`、`"timeout"` 这类 durable status
字符串，正好是禁入清单第 2、3 条禁的。映射留在适配层，内核只收结果。08 已同步。

顺带定的两条：适配层没给 `outcome` 时内核按 `cancelled` 处理（读成 `completed`
会让 UI 显示一条其实被打断的回答已经正常完成）；未知 durable status 当作「还没到
终态」而不是失败（后端加一个枚举值就把 run 判死，比多轮询几次糟得多）。

---

## 四行进度尺走完了三行

M1 evidence 红项 #5 列的四行：

|                          | 结果                                       |
| ------------------------ | ------------------------------------------ |
| `api/index.ts`           | BLOCKED → COPIED，已落地                   |
| `sidecar/api.ts`         | BLOCKED → COPIED，已落地                   |
| `sidecar/api.test.ts`    | waiting → **已搬，直接跑绿**。waiting 归零 |
| `api/api-client.test.ts` | **仍 DEFERRED**（见下）                    |

`api/api-client.test.ts` 不改写，理由不是「没空」：它测的是 SDK 包装层——
`joinStream` 的短路、`cancel` 的 409 错误串匹配、`sessionStorage` 里的重连记账。
这些东西按 02 §249 本来就不该存在，我们的 `api-client.ts` 也确实没有它们
（有意不搬的三样写在该文件头里）。为一个已经不存在的实现改写测试是负价值。
它的重新审视时机是 M4 接线 `threads/hooks.ts`——那是目前唯一还引用那三样的地方。

### 解锁靠的是台账新增 `LANDED_REWRITES`

`REWRITE` 的含义是「没有可搬的，只能自写」，不是「永远不存在」。写完之后它不该再
阻塞下游——否则 `api/index.ts` 会因为一个**已经躺在磁盘上**的被依赖方而永远 BLOCKED。

声明是**手写的而不是扫磁盘**：文件存在 ≠ 职责补齐。本次的 `api-client.ts` 就只补了
core 真正调用的 7 个方法，SDK 的其余几十个没有——让人写一行声明，是逼这个判断被看见一次。

两侧门禁都实测红过：

| 门禁                      | 制造的故障                              | 结果                                                  |
| ------------------------- | --------------------------------------- | ----------------------------------------------------- |
| 声明存在性                | 声明了 `api/api-client.ts` 但还没写文件 | exit 1，指出文件不存在 ✅（写声明时第一次跑就是这个） |
| `landedDeps` 一致性       | 声明与磁盘上的真实 import 不符          | exit 1，两边逐条列出 ✅                               |
| `typecheck-core`          | 给一个 number 标注 string               | exit 1 ✅                                             |
| `core-provenance.test.ts` | 新文件不登记进 PROVENANCE.md            | 6 个文件全部报出 ✅（本窗口真发生了）                 |

`landedDeps` 的解析必须针对 `app/core/` 而不是 baseline：`agent-deerflow/gap.ts`
在基线里根本不存在，拿基线解析会让这条检查退化成「两边都是空」——**永远绿**。

顺带修了 `land-copied` 的一个新暴露缺陷：幽灵清理按「分类不在落地档里」扫，
而手写 REWRITE 正好不在。实测把刚写完的 `api-client.ts` 直接删了。

---

## raw SSE golden trace：从素材变成门禁

`tests/fixtures/streams/` 的两份录制不是躺在磁盘上的资料，它们被 9 个用例消费：
53KB 真实响应体**逐字节**喂进分帧层，结果与整体读一致；换成 CRLF 重放也一致。

钉住的两条容易回退的事实：

- **73/74 个帧带 `id:`，`end` 不带。** 写成「记住最后一帧的 id」的实现会在终止帧
  把游标覆盖成 `undefined`，重连退回从头开始。
- **gap 载荷里的 `run_id` 等于 `metadata` 里的那个。** 去敏逐个映射 uuid 而不是
  压成一个常量，就是为了让这条关系还能被断言——这也是为什么去敏规则值得写进
  spec 而不是随手 sed 一下。

---

## 第 3 类证据：假的是**后端**，不是 `RunProtocol`

`tests/unit/agent-deerflow/fake-upstream.test.ts` 起一个真的 `node:http` 服务器，
让完整会话（L1 状态机 + L3 适配层 + 真 `fetch`）对着它跑一趟。

它与 `run-session.test.ts` 的分工不能混。后者假的是 `RunProtocol` 这一层，
验的是状态机；**状态机那一层再全，也证明不了「`Last-Event-ID` 这个 header 真的
发出去了」**——`fetch` 会把 header 名规范化成小写，而假 fetch 不会，两边各自
「正确」也能对不上。同理，帧被 TCP 切在分隔符中间、多字节字符跨 write、
连接被 RST，这些只有真网络栈才产生。

写的过程中撞到一个**测试自己的**坑，值得记下来免得下次再踩：
`response.write(...)` 之后立刻 `response.destroy()`，连接会在 undici 交付响应头
之前就被重置，于是 `create` 本身失败——测到的是 `missing_handle` 而不是重连。
真实的网络中断发生在响应头**之后**。所以「意外 EOF」用 `response.end()`
（确定性的），「连接重置」单独一个用例并显式延时让响应头先到。

---

## 红的 / 未验证的

1. **golden trace 只覆盖 7 种事件。** `metadata` / `values` / `updates` /
   `messages` / `end` / `gap` / heartbeat。08 §349 要求覆盖的
   `custom` / `checkpoints` / `tasks` / `debug`、subagent namespace、reasoning、
   tool-call 碎片、临时 id 重写**一个都没有 golden 覆盖**——replay 场景
   （`write_read_file.ultra`）本身不产生它们。要补得换录制场景或造 fake upstream。
   `parseWireEventName` 的 namespace 处理因此**只有合成用例，没有真实录制佐证**。
2. **useStream worktree 探针（06 §M2 A）没做。** 它有 3 天时间盒且**明确不是门禁**，
   本窗口有意跳过。要做必须在 `git worktree` 里，不得改主工作区的 `frontend/`，
   且不得复制回 `packages/agent-core/`（会把 React 类型带进 L1）。
3. **没有任何东西在跑这个内核。** L1 与 L3 都还没被 Nuxt 应用接线——
   没有 plugin 调 `setDeerFlowRuntimeOptions()`，没有组件消费 external store。
   接线是 M4a。所以本窗口证明的是「这些模块各自的行为正确」，
   **不是**「DeerFlow 在 Vue 里能流起来」。
4. **`test-selection` 的闭包对新写模块不完整。** 台账里没有条目的 source
   （`api/client.ts`、`agent-deerflow/*`）被直接当作已落地，**它们自己的依赖没有
   继续展开**。目前这些模块只依赖已落地的 COPIED/RETYPED，所以不影响判断；
   真要补，得让台账也覆盖非基线来源的文件。
5. **M1 的九条红项原样有效**，尤其 `config/index.ts` 与 `auth/auth-disabled-user.ts`
   的 retype 至今零覆盖，以及 `tests/**` 不过 vue-tsc（本窗口只解决了
   `packages/agent-core/` 那一半，`tests/` 那一半没动）。

---

# 第 2 个窗口：L3 收口（message-adapt / reducer / gap-recovery / A1 / types.gen / consumer-check）

## 复跑命令与实测

```bash
cd frontend-vue
make verify           # 新增 gen-api-types-check
make migration-check
make consumer-check   # 新增。不在 verify 里，理由见下
make e2e-m0           # 与 verify 串行，不能并发
```

| 命令                 | 结果       | 数字                                            |
| -------------------- | ---------- | ----------------------------------------------- |
| `make verify`        | **exit 0** | 82 文件 / 835 用例（上一窗口 79 / 782）         |
| `make migration-check` | **exit 0** | 4 条                                            |
| `make consumer-check` | **exit 0** | pack → clean install → typecheck → 最小 session |
| `make e2e-m0`        | **exit 0** | 7 个子套件 / 14 个用例                          |

新增用例 53 个：message-adapt 16、reducer 20、gap-recovery 11、store A1 6。

两个新门禁**都造故障验过红**：
- 把 `packages/agent-core/package.json` 的 `exports.import` 指到一个不存在的文件 →
  `make consumer-check` exit 1；
- 往 `types.gen.ts` 末尾加一行 → `make gen-api-types-check` exit 1，并报出字节差。

---

## 录制里本来就有的东西，上一窗口漏读了

上一窗口的红项 #1 写「tool-call 碎片、临时 id 重写一个都没有 golden 覆盖」。
把 `deerflow-create.sse` 的 9 个 `messages` 帧逐个解出来之后，**两条都不成立**：

1. **工具调用碎片有真实录制。** 2 个帧带 `tool_call_chunks`，其中 `write_file`
   那帧只有碎片没有成品（`tool_calls: []`），`read_file` 那帧两者都有。
   这直接决定了 `mergeToolCallFragments` 的归并键：先看 `id` 再看 `index`，
   **两个都要登记**。只按 index 会让录制里 `index: null` 的碎片全挤进一个桶；
   只按 id 会让 OpenAI 那种「只有第一片带 id」的增量流被拆成好几个调用。
   第一版只按 id，当场被用例抓住。

2. **临时 id 重写是真实存在的，而且是最强的一条反浅合并证据。**
   第 4 帧 `values` 里，原来 id 为 `X` 的 human 消息变成了 `X__user`，
   同时一条 system-reminder **顶替**了 `X`。这是 DeerFlow 中间件切分用户输入的
   产物。浅合并的后果不是「少一条」而是「多一条」——用户看到自己发的消息出现两次。

还发现 3 条**幽灵 AI 消息**：id 只出现在 `messages` 帧里，从没进过任何 `values`。
它们靠 `values` 的全量语义被清掉，而且清理不是发生在流末尾——每个 `values` 帧
都会当场清掉当时存在的那些。测试为此改成**逐帧记账**：先证明它们真的被造出来过，
再断言末态干净。否则「末态干净」可能只是因为它们压根没产生，那样这条断言什么都没测。

> 教训：**录制不是"覆盖了 7 种事件"就没别的信息了。** 上一窗口按事件名统计就
> 收工了，没有把载荷解开看。真正的证据密度比事件名多得多。

---

## round-trip 为什么不能逐字段枚举

08 §111 要的是「text/image/tool-call 内容不会丢失」。写法有两种：

- 逐字段枚举 wire → 内核 → wire；
- `meta` 收下除内核有字段承载之外的**全部**键，回程原样摊开。

选后者，理由是**测试抓不到前者的失效方式**：round-trip 测试用的是今天的 fixture，
后端明天加一个字段，枚举版会静默丢掉它而所有断言依然全绿。构造式的写法让
「不丢」变成结构性质，不依赖夹具的完备性。

两处**有意不可逆**，都写在代码里：
- wire 没有 `id` 时赋一个（516 条 fixture 全部带 id；没有 id 的消息本来就无法
  在按 id 归并的存储里存活）；
- 工具调用回程一律补 `type: "tool_call"`——那是这个字段唯一的合法值，属于规范化。

reasoning 是**搬出**`additional_kwargs.reasoning_content` 而不是复制：留一份在
meta 里，流式追加 `reasoningChunks` 之后两份就对不上，而对不上的那份会被回程写回去。

## 流式累积必须在 L3 做，不能靠 L1 的 mergeMessage

L1 的 `mergeMessage` 是 `{ ...base, ...patch }`，只对 `contentChunks` 做追加。
把分片直接交给它，`content` 会被后到的 delta **整段替换**——流式文本每来一片
就把前面的擦掉。所以 `accumulateStreamedMessage` 在适配层算好累积值再交给内核。

这不是绕路：**「什么算一次追加」是协议知识**。让 L1 认识它，就等于让内核知道
`AIMessageChunk` 的 `content` 是增量而 `values` 的 `content` 是全量。

---

## `values` 的一处已知限制（做了取舍，不是疏忽）

`values` 对**已存在**的消息用 `upsert-message`（合并），不是替换。后果是可选字段
（`reasoning` / `toolCalls`）只增不减。

做成真替换要 remove + upsert 整段，代价两条：丢掉 `contentChunks`（真实 delta
历史），以及长 thread 上每帧 O(n) 次对象展开 → O(n²)。而**今天不会分叉**，因为
DeerFlow 的 durable checkpoint 保留 `additional_kwargs.reasoning_content`
（516 条里 203 条带着它）。哪天后端在 checkpoint 里删掉它，这条会显形。

顺带实现了「已知 id 相对顺序被改」的整段重建路径——`upsert-message` 表达不了重排。
录制里没触发过（LangGraph 的 messages 通道是追加式的），但有合成用例钉住。

---

## gap 恢复：上游那份为什么不能照搬

上游 `recoverStreamReplayGaps` 的 `clearReconnectRun` / `lg:stream:` sessionStorage
记账是 **SDK 的重连簿记**——SDK 靠它记住「这个 thread 上有个 run 要重连」，
所以恢复时要先清再写回。我们的游标是 SSE `Last-Event-ID`，由 run session 自己持有，
**没有这本账**。照搬等于把一套不存在的状态机搬进来。

真正要保的两条已经逐条钉住：A5（正好 5 次 rejoin，共 6 次流调用）、
A6（末态 `failed` 而不是 `completed`；整条 gap 路径 `cancel` 与 `inspect`
调用次数都断言为 0）。

### 实现上最关键的一个决定：把 `resume` 伪装成 `create`

内核只从 `create()` 开流，而 rejoin 要走 GET + `Last-Event-ID`。两条路：

- 给内核加一个「从游标开始」的入口 → 重连语义泄进 L1；
- 换一个 protocol，它的 `create` 内部调 `protocol.resume` → 内核什么都不用知道。

选后者。08 硬规则 3「重连必须调 resume」仍然成立——真正发出去的就是 resume。

### 一个只有写测试才会发现的账：两个预算会互相抵消

05 L5 的重连总量上限是**会话内**计数的，而每次 rejoin 会新建一个 run session——
新建就归零了。不处理的话 6 段流可以合起来重连 `6 × maxReconnects` 次，
而 L5 明说「成功后不清零」。现在把已用掉的重连数从下一段额度里扣掉，
有一条用例（EOF → gap → EOF）钉住它。

---

## A1：为什么默认档必须用真的 `queueMicrotask` 来测

A1 的实现是一个 `pending` 短路：一个宏任务里派发一百次也只**登记一次**调度。
每次都重新排队就退化成尾部防抖，那正是 A1 禁的。

测试**不用注入的假调度器**。假调度器只能证明「代码调用了注入的那个函数」，
证明不了默认档到底是合并还是防抖——而 A1 禁的恰恰是默认档被写成防抖。
所以用真的 `queueMicrotask` 与真的宏任务边界，三档行为在同一组断言下可分辨：

| 断言                      | 合并档 | 同步档 | 固定延时防抖档 |
| ------------------------- | ------ | ------ | -------------- |
| 一个宏任务里派发 50 次    | 1      | 50     | 0              |
| 三个宏任务、每个派发 5 次 | 3      | 15     | 0（被饿死）    |

`flushNotifications()` 是补出来的：合并之后，同步读者（卸载前落盘、测试断言、
同一 tick 内量尺寸）唯一的等待方式变成「再 await 一个微任务」——那是在猜实现。

---

## OpenAPI：check 检的是幂等性，不是「和线上后端对不对得上」

06 的两句话连起来只有一种读法：生成源是**签入的**快照，CI 临时生成并 diff。
让 CI 去 curl 一个跑着的 Gateway，门禁就会随后端部署状态变色——那是环境问题
不是代码问题。「和线上对不对得上」由 real-backend job 与 raw trace 契约承担。

装 `openapi-typescript` 之前按规矩过了 `forbidden-deps` 清单，并回到 **02 §340 /
04 §267** 确认这条裁决还成立（依赖增删的裁决不在 06 也不在 08）。

抓快照有一个**没有任何报错的坑**：不设 `DEER_FLOW_ALLOW_UNVERIFIED_GITHUB_WEBHOOKS=1`，
`/api/webhooks/github` 不挂载，快照少一条路径而 `create_app()` 只打一行 warning
（102 vs 103 条）。`sort_keys=True` 同样不是洁癖：FastAPI 的输出顺序随路由注册
顺序变，不排序的话后端加一个不相干的 router 就能让整份快照 diff 成一片红。
两条都写进 `baseline/openapi.snapshot.README.md`。

---

## consumer-check：上一窗口的独立 tsconfig 证明不了这件事

上一窗口给包配了两份 tsconfig，那证明的是「包自己能独立类型检查」。
它**证明不了** `exports` 与 `dependencies` 完整，理由很具体：
自家 tsconfig 按相对路径 `include: src/**`，**根本不经过 `package.json` 的
`exports`**；而少声明的依赖在本仓库里会被 workspace 根的 `node_modules` 兜住。

所以三步缺一不可：`pnpm pack` 打真包 → 系统临时目录 clean install（往上找不到
本仓库的 node_modules）→ 从 **bare specifier** 消费。最小 session 还要**真跑**：
`exports.import` 指错文件时 tsc 一样绿——这是实测的，故障注入当场红。

一个实现约束：Node 的类型擦除对 `node_modules` 下的 `.ts` 是关闭的，而这个包的
`exports` 指的正是 TS 源码（它是给打包器消费的 workspace 包）。所以运行时先用
esbuild 打包再交给 node——用打包器不是绕路，就是真实消费方式。

`pnpm` 走 `scripts/pnpm.py`（仓库规矩）。它只认 `--dir frontend|frontend-vue`，
临时目录靠 pnpm **自己的** `--dir` 覆盖 cwd：第一个 `--dir` 被 wrapper 吃掉，
第二个原样转发。

**它不进 `make verify`**：要联网装 typescript/esbuild，而 verify 必须能离线跑。

---

## M2 收口状态：**A 组没有全绿**

06 §M2 的验收清单是「05 的 A 组全部 + L1–L16 全部」。实测：

| 条目    | 状态                                                             |
| ------- | ---------------------------------------------------------------- |
| L1–L16  | ✅ 全部落地（上一窗口）                                          |
| A1      | ✅ 本窗口                                                        |
| A2 · A3 | ✅ 上一窗口                                                      |
| A4 · A5 · A6 | ✅ 本窗口                                                   |
| **A7**  | ❌ **没做**。要清空乐观/瞬态/subtask 状态、失效持久化历史缓存、显示本地化恢复警告——三样都需要 UI 与查询层 |
| **A8**  | ❌ **没做**。Stop 后失效 4 类缓存 + 延迟 refetch，同样需要查询层  |

A7/A8 属于 M4a，本窗口按交接说明有意不做。**所以严格按 06 §M2 的字面清单，
M2 没有收口**——差的这两条不是遗漏而是依赖倒置：它们要求的东西在 M4a 才存在。
要么把 06 §M2 的清单改成「A1–A6 + L1–L16」并把 A7/A8 挪进 M4a 的验收，
要么承认 M2 带着两条红项进 M3。**这个决定没有人做过，留给下一个窗口。**

gap-recovery 已经为 A7 留好了唯一的接口：恢复时合成一帧 `values` 交给 reducer
（全量替换正是 gap 之后要的 durable 语义），UI 侧的清空与警告挂在这一帧上即可。

---

## 红的 / 未验证的（替换上一窗口的清单）

1. **golden trace 仍然不产生 `custom` / `checkpoints` / `tasks` / `debug`、
   subagent namespace、reasoning delta。** 这几样的用例是**合成载荷**，测试里
   分成两个 `describe` 明确标了。replay 场景（`write_read_file.ultra`）本身
   不产生它们，要补得换录制场景。
   （上一窗口把 tool-call 碎片与临时 id 重写也列在这里——**那两条是错的**，
   录制里本来就有，见上文。）
2. **`parseWireEventName` 的 namespace 处理仍然只有合成用例。** 录制里所有事件名
   都不带 `|`。
3. **`values` 对已存在消息是合并不是替换**（上文有取舍理由）。今天不显形，
   依赖的是「后端 checkpoint 保留 reasoning_content」这个观察，不是保证。
4. **useStream worktree 探针（06 §M2 A）仍然没做。** 3 天时间盒且明确不是门禁。
5. **没有任何东西在跑这个内核。** L1 + L3 都还没被 Nuxt 应用接线：没有 plugin
   调 `setDeerFlowRuntimeOptions()`，没有组件消费 external store，
   `reducer` / `gap-recovery` / `message-adapt` 三个新模块**一个调用方都没有**。
   接线是 M4a。本窗口证明的是「这些模块各自的行为正确」，
   **不是**「DeerFlow 在 Vue 里能流起来」。
6. **`types.gen.ts` 也没有任何消费方。** 9027 行生成类型签进来了，
   `core/api/client.ts` 目前用的还是手写形状。让 client 改用生成类型是 M4a
   的事，那时才会知道两者对不对得上。
7. **快照与 `config.yaml` 开关的关系没验证。** memory / scheduler / tracing
   看上去只影响启动期行为，但没实测它们会不会改 schema 细节。
8. **`test-selection` 的闭包对新写模块仍不完整**（上一窗口第 4 条原样有效）。
9. **M1 的九条红项原样有效**，尤其 `config/index.ts` 与 `auth/auth-disabled-user.ts`
   的 retype 至今零覆盖，以及 `tests/**` 不过 vue-tsc。
10. **`app/core/messages/utils.ts:853` 有一条 eslint warning**（无用的
    eslint-disable 指令），M1 起就在，`make lint` 仍 exit 0。没动它：
    那是 RETYPED 档，改它要走 land-retyped 的声明流程。

---

# 第 3 个窗口：验收条件全面订正 + M2 接缝补齐

上一节结尾留了一个问题：「M2 按 06 §M2 的字面清单没有收口，改清单还是带红项进 M3，
留给下一个窗口。」本窗口的结论是**清单本身写错了**，不是工作没做完。

## 复跑命令与实测

```bash
cd frontend-vue
make verify           # 新增 tests/guards/invariant-ownership.test.ts
make migration-check
make e2e-m0
```

| 命令                   | 结果       | 数字                                        |
| ---------------------- | ---------- | ------------------------------------------- |
| `make verify`          | **exit 0** | 84 文件 / 844 用例（上一窗口 82 / 835）     |
| `make migration-check` | **exit 0** | 4 条                                        |
| `make e2e-m0`          | **exit 0** | 7 个子套件 / 14 个用例                      |

新增 9 个用例：seam 4、invariant-ownership 5。

---

## 根因：05 按**话题**分组，06 按**层**切里程碑，而 06 用组名做验收单位

05 的表头自己写了：A–K 组来自 `frontend/AGENTS.md`——那是一个**没有分层的 React
应用**里沉淀的行为不变式，按「流式与重连」「消息渲染」这种话题聚类。06 的里程碑是按层
切的（L1 内核 / L3 适配 / 数据流 / 组件 / L3 业务）。

用组名当验收单位，等于假设「一个话题只落在一层」。实测 **A、C、F、H、J、K 六个组都
横跨里程碑**，于是两个方向的错法同时存在：

**重复认领（3 处，都是实锤）**

| 现象                                                       | 证据                                                                          |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------- |
| M2 被要求交付 A7/A8                                        | 两条都要求「失效持久化缓存」，而 `@tanstack/vue-query` plugin 在 §M4a 才引入   |
| C 组同时被 §M2（经 A 组）、§M4a、§M4b 认领                 | §M4a 原文「hooks.ts 独自承载 A 组与 C 组」，而 §M2 写「A 组全部」、§M4b 写「C」 |
| J 组（认证与存储）挂在「通用 agent UI」下                   | J1–J4 在 M0 的 G0-3/G0-5 就验完了；J5/J6 是 G0-7 + M7                          |

**静默漏项（3 个整组）**：**H、M、N 不在任何验收清单里**。H 只在 M7 的工作量表里被
提了一句，M/N 一次都没出现。

> 两种错法都**读不出来**——要把 14 个组、115 条逐个对一遍才发现。
> 这就是为什么它在四个窗口里没人察觉。

## 做了什么

06 新增 **§验收项归属：05 全表 × 里程碑**，115 条逐条落到里程碑，并定下规则：

> **验收项归属于「拥有它那一层」的里程碑，不引用 05 的组名。**

各里程碑的「验收清单」改成只引用这张表。M1/M3/M4a 之前**根本没有验收清单**，一并补上。
逐条订正（含依据）见 06 的归属表与各里程碑小节，这里只记几条容易被当成"随手改"的：

- **K6 从所有前端清单里移出**，标为「不是前端验收项」。05 原文就写着「后端行为，
  前端不要伪造」——那是个否定式约束，没有对应的前端断言，放进清单只能勾一个假钩。
- **M 组不属于任何单一里程碑**。M5（`watch` 惰性）在每个写 Vue 代码的里程碑都要查；
  塞进某一个，等于宣布其余里程碑不用查。
- **N 组的验收动作是「补完这一格并写回 05」**，不是跑通某个断言——它本来就是
  「移植前先去读源码」的登记（05 原话）。
- **M7 的「全表逐条勾选」改成复核**，并加了一句：若某条到 M7 才第一次被检查，
  说明归属表漏了它，应当回头补进对应里程碑而不是在 M7 补做。

## 顺带查出来的一条：05 §使用建议 1 今天是**误导**的

原文「C 组和 F 组的语义几乎全部由单测固定，测试全绿 = 语义已保真」。实测：
`core/threads/` 的 25 个上游单测**只落地了 6 个**，没落地的恰恰是 C 组那几个——
`coalesce`、`infinite`（分页）、`local-turn-order`（C8/C9）、`message-merge`（C1/C3）、
`thread-history-options`（C6）。它们依赖 `REWRITE` 档的 `hooks.ts`，随它一起在 M4a 落地。

**所以今天 `make verify` 全绿不代表 C 组保真。** F1–F7 那一半成立（`human-input.ts`
已 RETYPED 落地，单测随搬），C 组那一半不成立。05 已订正。

---

## 让机器守住它：`tests/guards/invariant-ownership.test.ts`

理由与 `forbidden-deps.test.ts` 一样——**文档挡不住这个**。已实测红：把 `A7` 从归属表
拿掉，门禁当场报 `expected [ 'A7' ] to deeply equal []`。

**一处有意不做的覆盖，也实测过**：本门禁只解析归属表，不解析各里程碑那段散文式的
验收清单。把 `C1–C9` 塞进 M4b 的清单，门禁**仍然全绿**。

不做的理由不是懒：**条目 id `M1`–`M6` 与里程碑名 `M0`–`M8` 完全同形**。M1 的验收清单里
就有一句「验收在 M4a」，按 id 规则解析会把它读成不变式 M4（逐词动画 key）。要消歧就得
给散文加标记语法，等于为了门禁重新设计文档格式；而判据一旦有误报，第一次红之后就会
被人放宽，门禁随即作废——06 §M3 gate 那句「字符级判据一定会红然后被人为放宽」说的是
同一件事。兜底是最后一条用例：每个验收清单都必须引用归属表。

---

## M2 的接缝补齐：`tests/unit/agent-deerflow/seam.test.ts`

订正后的 M2 清单多了一条「接缝」要求，所以它必须真的被满足，否则等于用改清单换绿。

`gap-recovery` 恢复时会**合成**一帧 `values` 交给下游，而合成的形状（事件名、`data`
是不是 JSON 字符串、载荷是全量还是补丁）**只有 reducer 真正消费一次才知道对不对**。
在此之前两边各自全绿，中间这一步没人验过。

4 个用例里最要紧的是第 2 条：gap 之后 durable state 必须**替换**——合成帧若被写成补丁
形状，缺口之前的陈旧消息会留在列表里，而所有单模块测试依然全绿。

写的时候撞到一个**自己的**错误假设，值得记下来：第 4 条用例原本断言「一直 gap 时末态
的 durable 值是最后一次 reload」。实测是 `before`——因为每次 rejoin 之后那段流又推了
一版 `values` 才再次 gap，**流上后到的全量快照本来就该覆盖 reload 的值**。改成断言
「3 次 reload 各自都真的进了 reducer」（按载荷计数），这才是接缝要证明的东西。

---

## M2 的收口状态（订正后）

| 条目            | 状态                                              |
| --------------- | ------------------------------------------------- |
| A1–A6           | ✅                                                |
| L1–L16          | ✅                                                |
| 接缝            | ✅ 本窗口补上                                     |
| ~~A7 / A8~~     | **不属于 M2**（已移至 M4a，M2 已留好接口）        |

**M2 按订正后的验收清单收口。** 这不是把红项改绿：A7/A8 要求的「失效持久化缓存」与
「本地化恢复警告」在 vue-query plugin 引入之前**没有验收对象**，把它们记在 M2 名下，
既不可能满足、也不会有人发现它们其实没被验过。

---

## 红的 / 未验证的（在上一节 10 条基础上更新）

- 上一节第 1、2、4、5、6、7、8、9、10 条**原样有效**。
- 上一节第 3 条（`values` 对已存在消息是合并不是替换）**范围收窄了**：本窗口的接缝
  测试证明 gap 恢复路径上的替换语义是对的（陈旧消息确实被清掉）。仍未解决的是
  同一条消息 id **可选字段只增不减**那一半。
- **新增**：C 组的单测大半没落地（见上文），所以 M4a 之前 `make verify` 全绿
  不能读成「历史加载与顺序已保真」。
- **新增**：归属表把 **K2/K3（编辑并重跑）** 标为 M4b，但 25 个 spec 里**没有对应的
  E2E**——`branch-thread` 不覆盖它。这条只能靠单测加手验，已在 06 §M4b 显式登记。
- **新增**：invariant-ownership 门禁不覆盖各里程碑散文清单的内容漂移（理由见上文）。
