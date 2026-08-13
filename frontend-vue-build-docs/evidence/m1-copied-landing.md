# M1 窗口 2：85 个 COPIED 落地 + rstest→vitest 工具链

> **历史证据。** 标题与正文数量是该窗口的 landing 快照，不是当前 provenance 总数；
> 后续窗口已继续调整分类。续接任务以
> [当前状态页](../10-current-status-and-next.md)、当前 manifest 和
> `make handoff-check` 为准。

> 范围：搬完全部 85 个 `COPIED`，未碰 `RETYPED`。
> 测试只搬了 **20 个**，不是交接单说的 43 —— 理由见「43 → 20」一节，这是本窗口最重要的结论。

## 复跑命令

```bash
cd frontend-vue
make verify           # lint + format-check + typecheck(预算) + unit + collected-check + build
make migration-check  # baseline-check + codemod-check（读 git 对象，需完整 clone）
```

本窗口实测：两条都 **exit 0**。`make verify` 报 `28 files / 247 tests`，
`collected-check` 报「期望搬运 20 个测试文件（node 13 · dom 7），实收 191 个用例」。

`make e2e-m0` 收工时重跑过一次（**exit 0**，7 个子套件全绿）——本窗口动了
`vitest.config.ts`、`eslint.config.mjs`、`.prettierignore`，确认没有波及 M0 门禁。

重建产物（改了分类或换基线才需要）：

```bash
make baseline-refresh && make land-copied && make codemod-tests && make typecheck-refresh
```

## 开工前先撞上的红：`baseline-check` 是自我作废的

交接摘要说 `baseline-check` 绿。**实测 exit 2。**

`BASELINE ?= HEAD`，而台账把 `baselineCommit` 写进产物、`baseline-check` 又逐字节比对——
**提交台账这个动作本身就会让它过期**。上一窗口提交前确实绿，提交完就红了，
两件事都是真的。diff 只有 `baselineCommit` 一行，分类内容完全没变。

顺带发现锚点本来就选错了：台账锚在 `8f99d2c7`（一个改文件名的 docs 提交），
而 06 / README / 04 §337 三处都写明对标对象是冻结基线 `27a425b0`。
`frontend/src/core` 在两个 commit 之间逐字节相同（`git diff` 为空），所以**分类结论不受影响**，
但锚点正是护城河依赖的那个字段。

已改成 `BASELINE ?= 27a425b0f1078baf8b2a361103a2b136ee342ab5`。换基线从此是显式动作。

## 43 → 20：搬运判据必须走传递闭包

交接单说「43 个测试只测 COPIED 模块」。这个数从 manifest 复核无误，
但它是**直接目标**的口径，而直接目标全 COPIED ≠ 跑得起来。

实测：43 个里有 23 个的传递闭包里有还没落地的模块，跑起来就是
`Cannot find package '@/core/config'`。判据改成闭包后剩 **20 个**（node 13 · dom 7）。

阻塞集中在少数几个模块，全是 `RETYPED`：

| 模块                 | 卡住几个测试 |
| -------------------- | ------------ |
| `config/index.ts`    | 17           |
| `messages/utils.ts`  | 16           |
| `threads/types.ts`   | 13           |
| `messages/usage.ts`  | 7            |
| `sidecar/context.ts` | 6            |

**下一窗口搬完 `RETYPED` 后，这 40 个（20 个原 M1 + 20 个新解锁）会一次性解锁**，
把 `LANDED` 改成 `COPIED,RETYPED` 即可，codemod 与对账脚本同时按新值重算。

### 试过并否决：按 `vi.mock` 剪枝

被 mock 掉的模块理论上不会加载，据此剪枝能多搬 7 个。**实测这 7 个全部失败。**
`vi.mock` 仍然要求路径可解析，而且只在导入方与 mock 方 specifier 同形时才拦得住：
`@/core/config` 对 `@/core/config` 成，对 `../config` 不成（`uploads/api.ts` 就是后者）。
这依赖 vitest 的解析细节，换个版本可能悄悄变。宁可少搬——口径与 06 对 `COPIED`
「说小了只是少省点事，说大了会架空门禁」一致。

## rstest → vitest：先验证再改

14 个 `rs.*` 里，`doMock` / `doUnmock` / `mocked` 的等价性此前未验证。已逐条验证：

- **`mocked` 是运行时恒等**（`vi.mocked(spy) === spy`）。上游 `mockedFetch.mockReset()`
  就靠这个；若返回副本，reset 打不到真身而测试仍会「通过」。rstest 实测同样为 `true`。
- **`doMock` / `doUnmock` 在 vitest 4 保留字符串路径重载**，配合 `resetModules` 行为一致。
- **反直觉的一条：`mockReset()` 退回 `fn(impl)` 传入的实现，不是 `undefined`。**
  两边一致（rstest 0.10.6 实测同样返回 `"original"`），但上游所有 `mockReset()` 都作用在
  无实现的 `fn()` 上，所以差别现在看不出来。哪天有人给工厂里的 `fn` 加默认实现才会显形。

这些断言钉在 `tests/guards/rstest-vitest-parity.test.ts`（9 个用例）。
codemod 的 `VERIFIED_APIS` 只放这里有断言的 API，**遇到没验证过的直接报错退出**——
`hoisted` 就在门外（只有 DEFERRED 的 `threads/stream-throttle.test.ts` 用它）。

rstest 0.10.6 的 `dist/` 里打包了 `@vitest/*`，JSDoc 里甚至直接写着 `vi.fn(...)`，
`mocked` 的类型签名与 vitest 4 逐字符相同。等价性有实现层面的原因，不是巧合。

### codemod 漏过一次，被兜底拦住

只处理 `PropertyAccessExpression` 会漏掉类型位置的 `ReturnType<typeof rs.fn>`
（那是 `QualifiedName`）。`transform` 末尾「改写后不许残留 rstest 痕迹」的检查直接报错，
没有生成一个带悬空 `rs` 的文件。

## `COPIED` 不加六段式文件头（裁决）

04 §316 要求每个源文件带六段式文件头，而 `COPIED` 要求逐字节等同上游——加了头就不是 `COPIED`。
§349 只说了分工，没说这一档要不要加。**已裁决为不加**，理由与配套写进
[04 §「裁决：`COPIED` 档不加文件头」](../04-architecture-decisions.md)。

一条配套是给未来的：§341 说的那个「M8 补一个检查文件头」的脚本**必须跳过 `class=COPIED`**，
否则会把这 85 个全报成缺头。

## 格式化器会主动破坏护城河（实测）

这条此前没人提过，但落地当场就撞上：

| 工具                | 想改几个 `COPIED` | 原因                                     |
| ------------------- | ----------------- | ---------------------------------------- |
| prettier 3.9.6      | 7 个              | 上游是 3.8.1，两版对联合类型换行意见不同 |
| eslint（Nuxt 预设） | 4 个文件 5 处     | `no-empty`、`import/first` 等上游写法    |

一次 `make format` 或 `eslint --fix` 就会让 `core-provenance.test.ts` 变红——
护城河靠的正是「改一个字节就红」，所以这不是误报，是必须把工具挡在外面。

**只挡 `COPIED` 这一档，不是整个 `app/core/`。** `RETYPED` / `REWRITE` / `ADDED` 是我们自己写的
代码，必须继续受检；文件降级出 `COPIED` 会自动恢复受检。清单从 manifest 推出：
`.prettierignore` 由 `make land-copied` 生成，`eslint.config.mjs` 直接读 manifest。

> ESLint flat config 的坑：`ignores` 必须**单独成一个 config 对象**才是全局忽略。
> 和 `rules` 写在同一个对象里只排除该对象自己的规则，其余照跑（实测合写时仍报 5 处）。

## typecheck 从裸 `vue-tsc` 改成预算门禁

`COPIED` 先于 `RETYPED` 落地，必然出现一段「引用了还没搬过来的模块」的红：**58 条**
（51 条 TS2307 找不到模块 + 4 条 TS2305 barrel 导出面不全 + 3 条 TS7006 隐式 any 级联）。
逐条看过，**全部是分窗口推进的后果，没有一条是复制过来的代码本身有问题**。

把 `typecheck` 移出 `verify` 会连带放过真正的类型错误，那是拿门禁换绿。改成钉预算
（`baseline/typecheck-known.json`）：**多一条红，少一条也红**。
「少一条也红」是关键——`RETYPED` 落地后预算必须显式缩小并进 review，
而不是留着一份过时的豁免。**M1 收口时这张表必须为空。**

## 门禁都实测能变红

不是「写了个检查」，是四条都跑出过红再跑回绿：

| 门禁                      | 制造的故障               | 结果                                |
| ------------------------- | ------------------------ | ----------------------------------- |
| `core-provenance.test.ts` | `COPIED` 文件多一个换行  | exit 1 ✅                           |
| `codemod-check`           | 手改一个生成的测试       | exit 1，并指向 `HAND_MAINTAINED` ✅ |
| `collected-check`         | 删掉一个生成的测试       | exit 1「台账要求收集但没收集到」✅  |
| `collected-check`         | dom 测试改名成 node 收集 | 同时报缺失与多余 ✅                 |

`collected-check` 是交接单点名的第 3 项前置。它进了 `verify`（只读台账与 vitest 收集结果，
不碰 git 历史）；`codemod-check` 要读 baseline commit 的 git 对象，因此和 `baseline-check`
一起放在 `make migration-check`，不进 `verify`。

## 产出

| 文件                                        | 作用                                       |
| ------------------------------------------- | ------------------------------------------ |
| `scripts/land-copied.mjs`                   | 按字节落地 `COPIED` + 生成台账行与忽略清单 |
| `scripts/rstest-to-vitest.mjs`              | AST 改写 + prettier；`--check` 防手改      |
| `scripts/collected-vs-manifest.mjs`         | 收集结果 ↔ 台账对账                        |
| `scripts/typecheck-budget.mjs`              | 已知类型报错预算                           |
| `scripts/lib/test-selection.mjs`            | 闭包判据，codemod 与对账**共用**           |
| `tests/guards/rstest-vitest-parity.test.ts` | 9 条 rs._/vi._ 等价性断言                  |
| `baseline/typecheck-known.json`             | 58 条已知报错                              |

`vitest.config.ts` 加了第三个 project（`dom` / happy-dom，收 `*.dom.test.ts`），
并给 node/dom 补了 `@` → `app/` 别名（这两个 project 不过 Nuxt，拿不到注入的别名）。

## 红的 / 未验证的

1. **58 条类型报错仍在**，只是钉住了。`make typecheck-raw` 看原样输出。M1 收口必须归零。
2. **40 个 M1 测试没搬**（20 个等 `RETYPED` + 20 个原本就等），23 个 `DEFERRED` 更远。
   本窗口的 20 个只覆盖 `COPIED` 的一部分行为。
3. **`rs.hoisted` 等价性仍未验证。** codemod 会拒绝改写用到它的文件。
4. **`RETYPED` 那 32 个一个没动**，`core/types/message.ts` 仍未落地——
   `MessageContent` 塌成 `string` 让 B1/B11 静默走形的风险原样留着（上一份证据的第 3 条红项）。
5. **没跑过 `make e2e`（共享业务合同）。** 本窗口只搬 core 与其单测，没有页面接线，
   跑它没有意义；但也因此不能说「业务行为没退化」。
6. `land-copied.mjs` 没有 `--check` 模式。删掉一个已落地的 `COPIED` 文件并同时删掉它的台账行，
   四条门禁都不会红（`git` 会显示，但没有自动门禁）。判断是这属于 review 能看见的范围，
   若后续觉得不够，补一个「manifest 里的 `COPIED` 必须全部在磁盘上」的检查即可。
