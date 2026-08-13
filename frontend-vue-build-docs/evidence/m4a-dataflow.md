# M4a · 数据流接线 —— 证据

> **历史证据。** 本文记录 M4a 关闭时的 gate 与红项；此后已补跑代表性共享合同和
> real-backend，最新结果不是本文末尾的原始红项清单。续接任务以
> [当前状态页](../10-current-status-and-next.md) 和 `make handoff-check` 为准。

日期：2026-08-06 · 分支 `main-wc`

本文只记录 git 与代码留不下的东西：**为什么这么选、试过什么被否决、还有什么没证实**。
交付了哪些文件看 `git show`，怎么实现的看文件头注释。

---

## 1. 门禁的真实颜色

全部在本窗口实测，命令可直接复跑（`cd frontend-vue`）：

| 命令                   | 结果   | 规模                                                |
| ---------------------- | ------ | --------------------------------------------------- |
| `make verify`          | exit 0 | 100 个文件 / 1,055 个用例（M3 基线 91 / 900）       |
| `make migration-check` | exit 0 | 台账 4 条全绿                                       |
| `make collected-check` | exit 0 | 期望 59 个搬运测试（node 49 · dom 10），实收 560 用例 |
| `make typecheck-core`  | exit 0 | `packages/agent-core` 独立 tsconfig                 |
| `make e2e-m0`          | exit 0 | 7 个子套件 / 14 个用例                              |
| **`make e2e-m4a`**     | exit 0 | **4 个用例（归并与顺序，`route.fulfill` 一次性 body）** |
| **`make e2e-m4a-stream`** | exit 0 | **3 个用例（真分块流：分帧 / 心跳 / 续传游标 / gap）** |
| `make consumer-check`  | exit 0 | 干净消费者安装 + typecheck + 最小 session（需联网） |
| `make baseline-refresh` | exit 0 | **无 diff**（装了 3 个包但 needsDeps 没变）        |

M4a 新增的部分：

```bash
cd frontend-vue
pnpm exec vitest run tests/unit/threads/           # 131 个用例 / 7 个文件
pnpm exec vitest run tests/unit/agent-deerflow/thread-runner.test.ts
pnpm exec vitest run tests/unit/i18n/cookies.test.ts
make e2e-m4a                                       # 4 个浏览器用例（合成流）
make e2e-m4a-stream                                # 3 个浏览器用例（真分块流）
```

> ⚠️ `make verify` / `make e2e-m0` / `make e2e-m4a` / `make e2e-m4a-stream`
> **两两都不能并发**（四者都起 nuxt build，抢同一把锁）。后台任务返回的 0 是复合
> 命令的退出码，不是 make 的。

typecheck 预算仍是 **0**（`baseline/typecheck-known.json` 为空）。

---

## 2. 五处实锤（本里程碑最值钱的部分）

前三处订正 06，后两处是补上真流 gate 之后才暴露的生产 bug。

### 2.1 「M2 已为 A7 留好接口」不成立 —— gap 恢复缺一帧 `custom`

06 §M4a 原文：「M2 已把接口留好：gap 恢复合成的那帧 `values`，UI 侧的清空与警告
挂在这一帧上。」接线时这句话当场垮掉：**合成的 `values` 与正常的 `values` 逐字段
同形**，消费方没有任何字段可以判别，A7 的「清空乐观/瞬态/subtask + 失效缓存 +
本地化警告」无处可挂。

上游不是这么做的。`frontend/src/core/api/api-client.ts:282` 在同一位置**先 yield
一帧 `custom`**（`{type:"stream_replay_gap", ...gap}`），React 侧 `onCustomEvent`
里那个 `eventType === "stream_replay_gap"` 分支做完整清空。M2 搬 gap 恢复时把这一帧
漏了——漏得很自然，因为它在上游看起来只是「给 UI 的一个通知」，而 M2 的验收对象是
rejoin 预算（A4/A5/A6），不含 A7。

处置：`gap-recovery.ts` 补上这一帧，**必须在合成的 `values` 之前**。顺序反过来的
后果是清空动作把刚 reload 回来的 durable state 一起抹掉。用例见
`tests/unit/agent-deerflow/gap-recovery.test.ts` 的「A7 的触发信号」——它断言的是
两帧的**相对下标**，不只是「两帧都在」。

### 2.2 M4a 的 gate 点名的三个共享 spec 在 M4a 跑不了

06 写的是「跑通 `chat` / `chat-thread-init-ordering` / `thread-history` 三个 spec」。
两条硬阻断：

1. **共享 mock 不发 `Content-Location`。** `frontend/tests/e2e/utils/mock-api.ts`
   的 `handleRunStream` 只回 SSE body，没有那个 header——上游 SDK 从 `metadata`
   事件取 run/thread id，不读它。而 05 L12 + 08 硬规则 2 要求本仓的 protocol
   **只认 `Content-Location`，读不到就 fail closed**（真实 Gateway 确实发，
   G0-8 已验、M-1 探针已记录）。为了让 mock 跑通去放宽那条，等于让一个测试替身
   推翻一条有运行证据的协议裁决。**没有这么做。**
2. **45 个用例里绝大多数是组件契约**：composer 占位符、本地化免责声明、草稿持久化、
   斜杠技能补全、侧栏列表、千轮虚拟化…… 全在 M4b。「最小可用聊天页」这个 gate 描述
   与它选中的 spec 本来就不自洽。

处置：新增 `make e2e-m4a`（`playwright.m4a.config.ts` + `tests/m4a/chat-dataflow.spec.ts`），
mock 写在本仓自己这边并带上 `Content-Location`，覆盖**同一批不变式**：
C8 顺序恢复、issue #2746 的请求时序、C1/C6 的刷新恢复、停止按钮生命周期。
共享合同仍是最终判据，时间点移到 M4b；届时的前置动作是**给共享 mock 补
`Content-Location`**，那是改 `frontend/` 的跨仓动作，需要单独决定。

06 的两处已回写。

### 2.3 `creating` 段对 UI 不可见 —— 由 e2e 第 4 条用例逼出来

`useThreadStream` 最初只在 `onStart` / `onSettled` / `onSnapshot` 里刷会话状态，
于是 **create 请求已发出、响应还没回来**的那一段（`status: "creating"`）在 UI 上
完全看不见。表现：慢连接下停止按钮永远不出现——而那正是最需要它的时候。
单测抓不到（假 runner 直接跳到 `streaming`），是浏览器里的慢流用例把它撞出来的。

处置：`ThreadRunner` 增加 `onSessionState` 钩子，**每一次**状态变化都通知；
`tests/unit/agent-deerflow/thread-runner.test.ts` 断言 `seen[0] === "creating"`。

### 2.4 真流 gate 撞出两条只在分块到达时才存在的 bug

`tests/m4a/chat-dataflow.spec.ts` 用 `route.fulfill`，整条流**一次性到齐**。
补了 `make e2e-m4a-stream`（假 Gateway 真的一片一片写，见
`tests/support/stream-gateway.mjs`）之后，立刻红了两条，两条都是生产 bug：

1. **`/chats/new` → `/chats/<id>` 的 URL replace 会重挂载整个页面组件**，
   `onScopeDispose` 触发 `runner.abort()`，刚建出来的流当场被掐断
   （现象：`POST /runs/stream` 拿到 200 之后紧跟一个 `net::ERR_ABORTED`）。
   起因是 Nuxt `<NuxtPage>` 的默认 key 是 `route.fullPath`。修法是给页面钉一个
   固定 key——这与上游的结论一致，`useCoalescedStreamMessages` 的注释里就写着
   「the chat page deliberately avoids re-mounting」。
2. **同一次 URL 变化会把 C9 的顺序锚点清掉。** `threadId` 从 `null` 变成真 id
   在代码里长得像「切换 thread」，于是走了 C9 的清场分支，第一个回合的 C8 重排
   当场失效（先到的 AI 步骤永远排在 human 前面）。它不是切换，是同一个 thread
   拿到了自己的身份；已加 `adoptedThreadId` 区分，并补了两条单测——
   一条证明 new→id 不清场，一条证明**真的换 thread 时仍然清场**（防止前一条
   被写成一个把 C9 整体放宽掉的判断）。

上游没踩到第 2 条，只是因为它那份 `local-turn-order.dom.test.tsx` 用的是固定
`threadId: "thread-1"`，从来没走过 new → id 这一步。

**这一节是 `make e2e-m4a-stream` 存在的全部理由**：这两条在合成流下 100% 绿。

### 2.5 A7 的警告现在验的是用户看得见的文案

原来 `notify.warn` 收到的是字典 key，聊天页直接把 key 显示出来——取不到文案时
静默降级成显示 `conversation.streamReplayGap`，而用例只断言「发出了 key」，
两边都绿。现在：key 解析抽成 `core/i18n/resolve.ts`（纯函数，单测断言**取到真
文案**且不等于 key），聊天页用它，`e2e-m4a-stream` 的 gap 用例断言**整句英文**。
词典改名时三处一起红。

---

## 3. 试过并被否决的做法

### 3.1 `@tanstack/vue-query@5.90.20` —— 否决（不存在）

02 §「版本对齐约束」要求行为敏感包对齐 `frontend/pnpm-lock.yaml` 的 resolved。
frontend 用 `@tanstack/react-query@5.90.20`，但 **vue-query 的 5.90 线只发到
5.90.2**，没有 5.90.20 这个版本，两个绑定包的补丁号各走各的。

做法：装 `@tanstack/vue-query@5.90.2`，并在 `package.json` 的 `pnpm.overrides` 里把
**`@tanstack/query-core` 钉到 5.90.20**——那才是行为敏感的那一层（缓存、失效、
无限查询的游标语义全在 core 里，绑定包只是响应式包装）。lockfile 已确认解析成
5.90.20。留下的偏差是绑定层 5.90.2 vs 上游同期，属于框架适配代码，不进 1:1 判据。

### 3.2 把 `isMock` 分支照搬过来 —— 否决

上游 `hooks.ts` 里 `isMock` 出现 23 次。这些分支的作用是让 E2E 走 `/mock/api`
而不是真 Gateway，代价是**生产路径与测试路径在 23 个地方分叉，而分叉的那一侧
没有测试**。M4a 一处都没搬，替代物是 `useThreadStream({ runnerFactory })`：
测试注入一个假 runner，其余代码路径与生产完全同一条，且注入点在类型上是同一个接口。

连带影响：`invalidateStoppedThreadCaches` 的 metadata query key 从
`["thread","metadata",id,isMock]` 变成 `["thread","metadata",id]`。上游那条
「does not refresh per-thread API caches for mock threads」用例失去了对象，
换成保留下来的另一半语义（**没有 threadId 时只失效全局两类**，新建 thread 的
第一次停止走的正是这条路径），并新增一条「A8 的四类展开成六个 key，一个都不能少」。
两条都写在 `tests/unit/threads/infinite.test.ts` 里，改动理由就在用例上方。

### 3.3 把 C 组的归并逻辑重新设计 —— 未尝试，按 05 裁决绕开

05 C 组原话「建议原样复制…不要重新设计」。`message-merge.ts` 的函数体是**逐字**
搬过来的，只改 import。理由不是省事：`mergeMessages` 的锚点编织（C2「不能在第一个
锚点处切片」）与 `resolveTransientHistoryBridge` 的未加载页抑制（C4）都是被具体
issue 逼出来的形状，**读代码看不出哪一步在防什么**，唯一能证明它们还成立的是上游
那份 1,740 行的 `message-merge.test.ts`——那份测试也一并搬了。

### 3.4 把 gap/顺序的簿记做成 Pinia store —— 否决

04 §3 已裁决：协议状态归 L1 external store，thread 作用域 UI 状态归 provide/inject。
`useThreadStream` 里那几个跨帧簿记（`localTurnOrderBaseline`、瞬态桥、已渲染账本）
**故意不是 ref**——它们不参与渲染，做成响应式只会多出无意义的重算，且会让
「什么时候该清」这个问题被响应式依赖图掩盖。生命周期规则写在文件头，逐条对应 C9。

---

## 4. 落地时才看见的三件事

1. **合帧层让第一个 chunk 最多晚 80ms 到。** `useCoalescedStreamMessages` 的前沿
   flush 发生在「开始流式」那一刻，那时消息还是空的；第一个真实 chunk 落在尾部
   flush 上。单测里只 `await flushPromises()` 一次拿到的是**前沿那一帧的空数组**，
   这是 M3「假绿」教训在本层的形态。`tests/unit/threads/thread-stream.dom.test.ts`
   的 `settleCoalescing()` 把这件事写成了注释，不是样板代码。
2. **`buildRunContext` 在上游是两处逐字重复的对象字面量**（首次发送与重跑各一份，
   含同一串三元嵌套的 `reasoning_effort`）。合并成一个函数是本次唯一的结构改动，
   理由是它决定后端跑哪种模式——两份拷贝迟早分叉，而分叉的表现是「重跑与首次
   发送用了不同的推理档位」，在 UI 上完全看不出来。`submit.test.ts` 钉住了推导表。
3. **N4 的首帧闪烁是真实代价，没有被解决。** i18n plugin 在顶层同步读 cookie，
   把窗口压到最小，但 `ssr:false` 下服务端不参与 locale 派生，预渲染路由
   （`/`、`/pricing`、`/about`）上仍然看得见。03 说「i18n 双词典分裂随之消失」
   时没算这笔。真正消除要走服务端 middleware，属于 M7。

---

## 5. 红项与未证实（做 M4b 时必须知道）

1. **M4a 关闭时还没有对着真 Gateway 跑过。** 后续修正
   `E2E_FRONTEND_PORT=3101` 并绕过本机代理后，real-backend 已达到 2/3：
   auth-disabled 与多 run order/history 通过，render 因 M4b UI 未实现而失败。
   `make e2e-m4a-stream` 的假 Gateway 是真的
   分块写、真的经 Nitro 代理、真的接 `Last-Event-ID`，但它**不是** Gateway：
   `run_m0_gateway.py`（真 backend replay，G0-8 用的那个）没有被接到聊天页上。
   仍未走到的具体分支：**重连退避**（假 Gateway 不会中途断连）、
   **cancel 的 202/200-drain 两支**（它只回 204）、**watchdog 静默判定**。
2. **gap 的「后端 run 还在跑」那一半没验。** `e2e-m4a-stream` 证明了
   gap → 带游标续传 → A7 清空与本地化警告这条链路端到端成立；但 05 A6 的
   「不得取消仍在运行的后端 run」在浏览器里没有断言（假 Gateway 收不到 cancel
   就等于没发，缺的是**主动断言它一次 cancel 都没收到**）。
3. **`useThreadHistory` 的分页与对账没有多页用例。** e2e 的历史 mock 是单页
   （`has_more: false`）。C6「历史失效时保留已加载的页」的实现来自
   `reconcileThreadHistoryRows`（有搬过来的单测），但**「翻到第 3 页时后台刷新」
   这个真实时序没有测过**——它涉及 vue-query 的 `isFetching` / `isSuccess` 在
   Vue 下的时序，而那正是我改写最多的地方。
4. **A7 的警告还不是 toast。** 文案已经是真的（见 §2.5），但呈现方式是聊天页里
   一行 `role="status"` 的文字；生产实现（vue-sonner + 统一的 toast 位置）
   属于 M4b 的 UI 层。**「有没有本地化」已验，「长成什么样」没验。**
5. **标题写回缓存曾经搬错了，已修。** 第一版在 `handleUpdateEvent` 里用了
   `upsertThreadIn*`——而上游那两个函数**只在 `onCreated` 用**，标题更新走的是
   `setQueriesData` + 只改 `values.title` 的 mapper（`hooks.ts:1617/1638`）。
   用 upsert 的后果不只是「代码弱」：`mergeExistingThread` 的合并方向是
   「已有的赢」，所以**侧栏里已存在的 thread 标题根本不会更新**——一个只会在
   接上侧栏之后才被发现的静默失效。已改成上游写法，`as never` 随之消失，
   并补了两条用例（只改 title 不碰 metadata/status；缓存里没有这条 thread 时
   不凭空插入）。仍然没有的是**侧栏本身**（`useThreads` / `useInfiniteThreads`
   在 M4b），所以这条路径在真实 UI 上没被看见过。
6. **Pinia 只注册了模块，一个 store 都没有。** 02 的新增清单要求装它，04 §3 给它
   的位置是「每 thread 一个 composable/Pinia adapter」的实现工具。M4a 的 thread
   作用域状态由 `useThreadStream` 按组件生命周期承载，还用不到跨组件共享的 store；
   第一个真正需要它的是 M4b 的侧栏线程列表。**现在它是一条未兑现的配置。**
7. **7 个业务 Context 只落了底座，没落实例。** `defineThreadContext` 与 M1/M2 的
   护栏用例已就位（`tests/unit/threads/thread-context.dom.test.ts`，含一条
   「照搬 React 写法当场抛」），但 artifacts / browser-view / messages / sidecar /
   tasks 五个 thread 作用域 context **一个都还没定义**——它们的消费方是组件，
   随 M4b/M5/M6 落地。
8. **`app/core/api/types.gen.ts`（9,027 行生成类型）仍无消费方。** M2 起的红项，
   本窗口没有改变。
9. **M2 的分帧层仍是 O(n²)，未优化、未在真实网络下测过。** golden trace 逐字节
   测试仍只跑前 64KB（整份 42 秒）；仍缺 `custom` / `debug` / subagent namespace /
   reasoning 的真实录制。
10. **M3 的渲染层仍无消费方。** M4a 的聊天页**故意不接** `StreamMarkdown`
    （接线在 M4b）：混进来会让「流式顺序错了」与「渲染层错了」分不开，
    而分不开正是这个 gate 要避免的事。mermaid 的成功路径在本仓仍然一次都没跑通过。
11. **K2/K3（编辑并重跑）在本窗口只留了接口。** `clearPreparedReplayMasks` 与
    `pendingSuperseded*` 两个 mask 已就位，但 `submitPreparedReplay` /
    `regenerateMessage` / `editAndRegenerateMessage` **没有搬**——它们的
    prepare 端点返回的是 checkpoint + metadata，消费方是 M4b 的消息卡片。
    06 §M4b 已登记它们没有专门的 E2E。
12. **`tests/**` 仍不过 vue-tsc**（M1 的九条红项原样有效）。

---

## 6. 依赖

按 02 §「新增」清单装的三个：

```
@tanstack/vue-query 5.90.2      pinia ^4.0.2      @pinia/nuxt ^1.0.1
```

外加一条 override（理由见 §3.1）：

```json
"pnpm": { "overrides": { "@tanstack/query-core": "5.90.20" } }
```

`make baseline-refresh` **无 diff**——这三个包不在 `frontend/src/core/` 的
needsDeps 映射里（它们是 Vue 侧的替代物，不是被搬运文件的前置条件）。

---

## 7. 复跑清单

```bash
cd frontend-vue
make verify                 # 100 文件 / 1,055 用例
make migration-check        # 台账 4 条
make collected-check        # 收集口径与台账一致
make typecheck-core         # agent-core 独立 tsconfig
make e2e-m0                 # 与 verify / e2e-m4a 串行，不要并发
make e2e-m4a                # M4a gate：4 个浏览器用例（合成流）
make e2e-m4a-stream         # M4a 真流 gate：3 个用例（分块 / 心跳 / 续传 / gap）
make consumer-check         # 需要联网
make baseline-refresh       # 应当无 diff
```
