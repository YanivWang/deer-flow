# `@deerflow/agent-core` 内核说明

本文描述这个包**当前源码**的行为。它是随包走的文档：`package.json` 的
`files` 只有 `src`，包被复制到别的项目后，这份说明是消费方唯一的依据。

> 判据：本文每一条都能在 `src/**` 里指到具体位置。凡是可机械核验的（导出面、
> 枚举成员、默认值、重试判据），由 `packages/agent-core/tests/contract.test.ts` 钉住——改了代码不改
> 这里，那条门禁会红。**不要在本文写完成度或进度**。

## 这个包是什么

一个**框架无关**的 agent 流式会话内核。它负责：SSE 分帧与解析、run 会话状态机
（创建/续传/重连/取消/终态）、退避计算、静默看门狗、可观察快照存储。

它**不负责**、也不允许知道：任何具体 UI 框架、任何 DeerFlow 的 URL、任何
DeerFlow 的 wire 事件名。协议知识只能通过两个注入点进来——`RunProtocol`
（怎么发请求）和 `ClassifyEvent`（一帧事件对流的走向意味着什么）。

`src/index.ts` 是唯一公共导出面。深路径 `@deerflow/agent-core/src/*` 被
`package.json#exports` 和 `tests/architecture.test.ts` 双向挡住——绕过导出面
会让「整包搬走」当场作废，因为消费方依赖的是没导出的内部路径。

`AGENT_CORE_CONTRACT_VERSION` 是这个包对消费方的契约版本字符串。它当前的值
不是迁移阶段编号，改动它属于破坏性变更。

## 错误模型（`src/errors.ts`）

`AgentErrorKind` 九种：`network`、`abort`、`http`、`backend_error`、
`parse_error`、`missing_handle`、`reconnect_exhausted`、`replay_gap`、`unknown`。

**只有 `network` 可以退避重连。** 判据集中在 `RETRYABLE_KINDS` 一处，不是每个
构造点自己填布尔值——散开就会改一处漏一处。

两条容易写错的收敛：

- **`AbortError` 归 `abort`，不归 `network`。** 两者都是「读到一半没了」，但一个
  是我们自己叫停的。混在一起会让主动取消触发自动重连。
- **`http` 不可重试。** 4xx 重试无意义；5xx 看似可以，但重连走的是 `resume()`，
  resume 的 5xx 说明 run resource 本身有问题，退避只是把同一个错误重放 N 次。

枚举里**没有**独立的 `eof`：意外 EOF 与网络中断对重连策略是同一件事（连接没了、
run 可能还活着），统一归 `network`，靠 message 区分。

## 消息模型（`src/message.ts`）

`AgentMessage` 是**内核内部形状**，不是 wire 类型。wire 类型住在消费方
（本仓是 `app/core/types/message.ts`），两者由适配层互转。合并成一个会让内核
认识 `additional_kwargs` 这类协议字段。

角色四种：`human`、`assistant`、`tool`、`system`。

两条硬约束：

- **`contentChunks` 只记真实收到的 delta，禁止从最终 `content` 反推。**
  `split()` 出来的分片数量与边界都是编的，拿它做流式渲染的回归基线，等于用被测
  对象生成期望值。
- **`meta` 是协议字段的落点，内核不解释其内容。**

`AgentContentPart` 是**开放形状**（带索引签名）而不是闭合联合：实测的续传数据里
存在 bare string 元素和 `thinking` 分支，闭合联合表达不了。

`createAgentMessage()` 存在的唯一理由是 `contentChunks` 必须初始化成数组——归并
路径会往里 `push`，少一个初始化就在第一个 delta 上炸，而那条路径只有真流式才走到。

## SSE 传输（`src/transport/`）

四个文件各管一段：`sse-event.ts` 形状、`sse-buffer.ts` 切帧、`parse-sse-event.ts`
解析一帧、`read-sse-frames.ts` 把字节流读成帧序列。

规范细节，每条都对应一类实际故障：

| 细节                                                    | 不这么做会怎样                                                                     |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 帧分隔符 `/\r?\n\r?\n/`，不是 `"\n\n"`                  | 经 nginx 时代理可能发 CRLF，只找 `\n\n` 会永远攒不出帧——表现是「流卡住但连接还在」 |
| `data:` 后**只剥一个前导空格**，不是 `trim()`           | 流式 token 文本里的前导空格是内容，`trim()` 会让拼出来的句子粘在一起               |
| `id:` 必须保留                                          | 它是重放游标（SSE `Last-Event-ID`），丢了续传只能从头来                            |
| 心跳是**帧的一种**（`kind: "heartbeat"`），不是解析失败 | 心跳在类型层消失后，看门狗会把有心跳的连接误判成静默                               |
| 无冒号的字段行按空值字段处理                            | 单独一行 `data` 是合法的空 data 行，丢弃它会少一帧                                 |

`readSseFrames` 的三条实现约束：

- **缓冲上限按字节判，不按字符。** 语义是「后端一直不发空行时最多攒多少内存」，
  而 UTF-16 长度对多字节文本会低估。计数用增量维护，避免每个 chunk 重新编码整个
  缓冲变成 O(n²)。
- **上限必须在排干成帧之后判，不能在收到 chunk 时判。** 前者量的是「还没成帧的
  残留」，后者量的是吞吐——一个塞了 50 个完整帧的 chunk 会当场误触发上限。
- **解码必须 `{ stream: true }`，流末还要再 `decode()` 一次 flush。** 一个汉字被
  切在两个 chunk 之间时，不带这个选项会当场解成替换字符且无法回滚；不 flush 则
  静默丢掉末尾压着的不完整多字节序列。

这一层**不重连**。读完一个 response body 就结束，重连是会话的事——让通用 reader
自己重连，它就必须持有「怎么重新发起请求」，而重发 create POST 正是硬规则 1 禁止的。

## 会话状态机（`src/session/`）

九个状态：`idle`、`creating`、`streaming`、`reconnecting`、`stopping`、
`completed`、`cancelled`、`failed`、`gap`。

- **`stopping` 只是客户端瞬态**，服务端没有这个枚举。把它当「已取消」显示，会在
  取消还没被后端确认时就告诉用户停住了——而 run 可能还在跑。它带 `mode`，取值
  `draining`（后端还在发尾帧）或 `polling`（要靠探查 durable run 收敛）。
- **没有 handle 的断开进 `failed`，不进 `cancelled`。** 创建阶段断线是「结果不
  确定」，不是「已取消」。

会话向外只发三种输出：`state`、`event`、`heartbeat`。心跳单独成一种而不是被丢掉
——它不进业务 reducer，但必须刷新活动时间，否则看门狗会把健康连接判成静默。

### 八条硬规则的代码位置

| 规则                        | 落在哪                                                       |
| --------------------------- | ------------------------------------------------------------ |
| 1. create 只调用一次        | `create()` 在 `while` 循环外；失败直接终态，不重来           |
| 2. 拿到 handle 才能自动续传 | 创建阶段失败收敛成 `missing_handle`（不可重试）              |
| 3. 重连走 resume            | 循环里只调 `protocol.resume`，不复用 create 的 URL/body      |
| 4. 只有网络错误可退避       | `failure.retryable`，判据在 `errors.ts`                      |
| 5. heartbeat 刷新活动时间   | `pump()` 直接 yield heartbeat，由消费方记账                  |
| 6. gap 不重放               | 进 `gap` 态并**结束这条流**，交给适配层 reload durable state |
| 7. cancel 与 abort 分开     | **两个 `AbortController`**，见下                             |
| 8. stop 先进 stopping       | `settleStop()` 收敛后才落终态                                |

### 两个 AbortController 不能合成一个

`streamController` 掐读，`controlController` 发 cancel/inspect。

`stop()` 必须掐断读（否则 pump 一直挂在 `read()` 上，cancel 发不出去），但绝不能
掐断随后那次 cancel——合成一个的话，`settleStop` 会拿着一个已经 aborted 的 signal
去发 cancel，请求当场夭折，**服务端的 run 根本没被通知**。

同理，drain 尾帧必须用 control signal 读：`stop()` 刚刚 abort 掉了 stream signal，
拿它读尾帧会在第一次 read 之前就抛 abort，表现是用户每点一次停止、最后一段回答
就被吞掉一截。

`abort()` 与 `stop()` 语义不同：前者两个 controller 都断，只断开本地读取，**不代表
服务端的 run 停了**。

### 重连预算

`reconnects` 计数**只增不减**，每段成功后不清零。清零的写法会让持续抖动的连接无限
重连——长任务下就是「永远在重试、永远不报错」。

退避是纯计算（`backoff.ts`），`random` 由调用方注入，所以同一份实现既能抖动也能在
测试里给确定值。抖动是**双边**的：只往后抖会让实际间隔系统性偏大，封顶也随之失真。

### 取消的三条收敛路径

`CancelResult` 不能压成 `void`：

- `drain` — 后端返回 200 SSE，继续读尾帧。**读完却没有终止事件时落 `cancelled`。**
- `accepted` — 后端只是收下了，要靠有界轮询 `inspect()` 收敛。
- `terminal` — 后端直接给了终态。

轮询预算用完仍未终态时落 **`failed` 而不是 `cancelled`**：后端可能还在跑，谎报成
已取消会让 UI 允许用户马上再发一条，撞上同一个 thread。

`InspectedRun` 带 `outcome`（`completed`/`cancelled`/`failed`）而不只是
`terminal: boolean`——终态有三个去向，布尔只能表达两个。映射留在适配层，内核只接收
映射结果，这样内核不必认识任何 durable status 字符串。

### 游标推进时机

`cursor` 在**发出事件之前**推进。事件发出后消费方可能立刻触发 stop，那时 cancel
要带的是这一帧的 id，不是上一帧的。

## 快照与通知合并（`src/store/`）

`AgentSnapshot` 是不可变的：每次都整体替换，不原地改。原地改会让靠引用比较的订阅者
收到通知却看不出差别，或者干脆不通知。

`messageIds` 与 `messages` 分开存：顺序是协议给的，内容按 id 归并。合成一个数组会让
每次 merge 都线性查找，长 thread 上是 O(n²)。

`reducer` 一次返回**多个** action，这是必需而非方便：一帧全量快照要同时更新业务
state、消息顺序和会话状态，拆成三次调用就会出现「state 已经换了、消息还是旧的」的
中间帧，而组件恰好可能在那一帧渲染。

### 通知是合并的，不是防抖的

同一个宏任务里派发的若干事件只产生**一次**通知。默认调度器是 `queueMicrotask`——
微任务检查点正好在当前宏任务末尾、浏览器渲染之前，所以「合并」与「绝不拖到下一帧」
同时成立。

**不能换成带延时的实现。** chunk 持续到达时尾部防抖会一直往后推，UI 更新被饿死，
而流式回答恰恰就是 chunk 持续到达。合并靠的是 `pending` 短路：一个宏任务里派发一百
次也只登记一次调度；每次都重新排队就退化成防抖了。

`scheduleNotify` 这个扩展点是给「换一个宏任务边界的定义」用的（比如 Vue 的
`nextTick`），不是给「加一点防抖」用的。

**`getSnapshot()` 始终同步最新**：合并的只有通知，不是数据。订阅者被通知晚一点没
关系，读到旧数据不行。`flushNotifications()` 给同步读者用——卸载前的最后一次落盘、
测试断言、需要在同一 tick 量尺寸的适配器；没有它，唯一的等待方式是「再 await 一个
微任务」，那是在猜调度器的实现。

### 归并语义

- `contentChunks` 是**追加**语义。用对象展开的默认行为会让后到的 delta 把之前收到的
  整段替换掉，流式文本表现为「越流越短」。
- `rewrite-message-id`（临时 id → 服务端 id）**原地保留位置**。删掉再插入会把消息挪
  到列表末尾，用户看到自己刚发的那条突然跳走。
- 两边都没有 reasoning 时**不写这个键**，而不是写 `undefined`——消息会被导出成 JSON，
  也会被 UI 用 `in` 判断。

## 看门狗（`src/watchdog.ts`）

判据的主语是**心跳**，不是业务事件。agent 会跑 sandbox 执行、浏览器操作、子 agent，
长时间没有业务事件完全正常；只要心跳还在，连接就是活的。真正的静默 = 连心跳都停了。

两种停表情形，都返回 `paused`：

- `awaitingHumanInput` — 等用户回话时必须停表，否则用户去泡杯咖啡回来，界面已经
  自己报了超时，而后端什么问题都没有。
- `session.status !== "streaming"` — `reconnecting` 有自己的退避预算和总量上限，让
  看门狗同时计时等于同一个故障有两个互不知情的裁判。

## 默认值

这些值都在源码里有单一出处，并由契约测试钉住：

| 项                                | 出处                                                    |
| --------------------------------- | ------------------------------------------------------- |
| 退避基数 / 倍率 / 上限 / 抖动比例 | `session/backoff.ts` 的 `DEFAULT_BACKOFF`               |
| 看门狗静默阈值                    | `watchdog.ts` 的 `DEFAULT_WATCHDOG`                     |
| 取消后的探查次数与间隔            | `session/run-session.ts` 的 `DEFAULT_INSPECT_POLLING`   |
| 缓冲上限、重连总次数              | **没有默认值**，由调用方在 `RunSessionOptions` 显式给出 |

最后一行是有意的：这两个值取决于宿主环境的内存预算和任务时长，内核不替调用方决定。
