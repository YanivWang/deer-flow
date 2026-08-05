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

## 红的 / 未验证的

1. **golden trace 只覆盖 7 种事件。** `metadata` / `values` / `updates` /
   `messages` / `end` / `gap` / heartbeat。08 §349 要求覆盖的
   `custom` / `checkpoints` / `tasks` / `debug`、subagent namespace、reasoning、
   tool-call 碎片、临时 id 重写**一个都没有 golden 覆盖**——replay 场景
   （`write_read_file.ultra`）本身不产生它们。要补得换录制场景或造 fake upstream。
   `parseWireEventName` 的 namespace 处理因此**只有合成用例，没有真实录制佐证**。
2. **第 3 类证据（fake upstream 集成测试）只做了一半。** L1 的
   `run-session.test.ts` 用假协议覆盖了 create-once / resume 切 GET / 退避 /
   abort 与 cancel 分离，但它假的是 `RunProtocol` 这一层，**不是 HTTP 那一层**。
   06 §M2 B 说的 fake upstream 是「起一个假后端」，能覆盖真实 `fetch`、
   真实 `Response`、真实 chunk 边界。现在这一层是空的。
3. **useStream worktree 探针（06 §M2 A）没做。** 它有 3 天时间盒且**明确不是门禁**，
   本窗口有意跳过。要做必须在 `git worktree` 里，不得改主工作区的 `frontend/`，
   且不得复制回 `packages/agent-core/`（会把 React 类型带进 L1）。
4. **没有任何东西在跑这个内核。** L1 与 L3 都还没被 Nuxt 应用接线——
   没有 plugin 调 `setDeerFlowRuntimeOptions()`，没有组件消费 external store。
   接线是 M4a。所以本窗口证明的是「这些模块各自的行为正确」，
   **不是**「DeerFlow 在 Vue 里能流起来」。
5. **`test-selection` 的闭包对新写模块不完整。** 台账里没有条目的 source
   （`api/client.ts`、`agent-deerflow/*`）被直接当作已落地，**它们自己的依赖没有
   继续展开**。目前这些模块只依赖已落地的 COPIED/RETYPED，所以不影响判断；
   真要补，得让台账也覆盖非基线来源的文件。
6. **M1 的九条红项原样有效**，尤其 `config/index.ts` 与 `auth/auth-disabled-user.ts`
   的 retype 至今零覆盖，以及 `tests/**` 不过 vue-tsc（本窗口只解决了
   `packages/agent-core/` 那一半，`tests/` 那一半没动）。
