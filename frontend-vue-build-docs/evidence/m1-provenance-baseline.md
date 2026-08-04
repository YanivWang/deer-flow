# M1 窗口 1：分类基础设施与 COPIED 护城河

> 范围：**只交付基础设施，未搬任何业务文件**。`app/core/` 仍然只有 M0 的 `auth/decision.ts`。
> 本文记录分类口径、与 06 计划的出入、以及下一窗口开工前必须先解决的红项。

## 复跑命令

```bash
cd frontend-vue
make baseline-refresh   # 重建两份台账（读 git 对象，需完整 clone）
make baseline-check     # 台账过期即红
make verify             # lint + format-check + typecheck + unit + build
```

本窗口实测：`make verify` **exit 0**，7 个测试文件 / 47 个用例通过（守护新增 5 个用例）。
基线开工前同样先跑过一次 `make verify`（exit 0），确认接手时是真绿而不是上一份摘要的自评。

## 产出

| 文件                                   | 作用                                               |
| -------------------------------------- | -------------------------------------------------- |
| `scripts/lib/source-facts.mjs`         | TS AST 抽取 import / type-only / process.env / JSX |
| `scripts/core-provenance.mjs`          | 149 个源文件分类 → `baseline/core-manifest.json`   |
| `scripts/core-test-manifest.mjs`       | 83 个测试分桶 → `baseline/core-test-manifest.json` |
| `baseline/core-sha256.json`            | `COPIED` 档护城河基线                              |
| `app/core/PROVENANCE.md`               | 已落地文件的台账（手工维护，随批次追加）           |
| `tests/guards/core-provenance.test.ts` | 登记完整性 + `COPIED` 逐字节比对                   |

## 分类结果

分类由规则推出，**不手写清单**。唯一的人工输入是 `core-provenance.mjs` 里的
`DROP_POLICY`（4 条，每条带出处）。

| 分类      | 文件数  | 行数       |
| --------- | ------- | ---------- |
| `COPIED`  | 85      | 6,301      |
| `RETYPED` | 32      | 7,634      |
| `REWRITE` | 28      | 5,444      |
| `DROPPED` | 4       | 586        |
| **合计**  | **149** | **19,965** |

**合计与 06 计划的基线值逐位相同（149 个文件 / 19,965 行）**，说明脚本扫的正是计划所说的那一份集合。
（脚本按 `wc -l` 语义数行；用 `split("\n").length` 会每文件多 1 行、合计多出 149。）

`COPIED` + `RETYPED` 共 117 个，其中 **106 个无依赖阻塞，可以立刻开搬**。

### 与 06 计划的出入

1. **SDK 导入者是 18 个，不是 17 个。** 计划漏了 `threads/hooks.ts`。它同时值导入 React，
   本来就落在 `REWRITE`，所以结论不变：18 = 16 个 `RETYPED` + `static-demo.ts`（不迁）+
   `threads/hooks.ts`（重写）。计划正文那 16 个与脚本结果完全一致。

2. **i18n 词典带 React 耦合，计划未标。** `i18n/locales/{en-US,zh-CN}.ts` 把
   `lucide-react` 的图标当**值**导入并嵌进词典，`locales/types.ts` 借 `LucideIcon` 类型。
   计划 1d 把这 3,170 行当作直接搬运。已实测 `lucide-vue-next@1.0.0` 同时导出 `LucideIcon`
   与用到的 8 个图标名（`CompassIcon` 等），所以仍是纯 specifier 替换 → `RETYPED`，不是重写。

3. **`i18n/cookies.ts` 读 `next/headers`，计划未列。** 归入 `REWRITE`。

4. **依赖不迁模块的文件不可能零改动。** 这是本窗口对自己第一版规则的修正：
   `artifacts/utils.ts`、`models/api.ts` 都 `import { isStaticWebsiteOnly } from "../static-mode"`，
   而 `static-mode.ts` 是 `DROPPED` —— 那行 import 没有落点，必然要改。
   同理 8 个 barrel `index.ts` 对 `REWRITE` 模块做 `export *`，导出面不再保证同名。
   这 10 个已从 `COPIED` 降级为 `RETYPED`（`retype-dropped-dep` / `retype-rewrite-dep`）。
   **口径：宁可把 `COPIED` 说小。说大了会架空 hash 护城河，说小了只是少省点事。**
   `retype-rewrite-dep` 那 8 个落地时逐个复核，确实无需改动可降级回 `COPIED`。

### npm 包缺口

12 个包 `frontend-vue` 尚未安装（`zod`、`date-fns`、`uuid`、`best-effort-json-parser`、
`@langchain/core`、`ai`、`hast`、`remark-*`、`rehype-*`、`unist-util-visit`）。
**装包不改文件内容，因此不影响 `COPIED` 判定**，只是落地前置条件；清单见 manifest 的 `needsDeps`。

## COPIED 护城河（方案 1e）

两层，都实测能变红：

| 层                        | 抓什么                     | 实测                                                      |
| ------------------------- | -------------------------- | --------------------------------------------------------- |
| `make baseline-check`     | 有人改 baseline 让守护变绿 | 篡改 `core-sha256.json` 一个条目 → exit 2 ✅              |
| `core-provenance.test.ts` | 有人改 `COPIED` 文件       | 落真文件登记后绿 ✅；追加一行注释 → 红 ✅；不登记 → 红 ✅ |

自检用 `api/errors.ts` 走了一遍「落地→改一字节→不登记」三态，随后完全复原，
`app/core/` 未留下业务文件。

守护**只读签入文件，不调用 git** —— 06 §1e 要求普通 CI 不依赖历史对象是否存在。
因此 `baseline-check` 刻意不进 `make verify`。

## 测试 manifest 的 M1 子集

83 个 = **M1 60 个**（49 纯 node + 11 需 DOM 环境）+ **推迟 23 个**。

**起点假设需要修正。** 交接说「83 = 79 个 `.test.ts` + 4 个 `.test.tsx`，后者就是 DOM 依赖项」——
`.tsx` 那 4 个确实都推迟了，但推迟的 23 个里 **19 个是 `.test.ts`**：

- **8 个值导入 React 生态**，扩展名完全看不出来：`mcp/hooks.test.ts`、`reasoning-trigger.test.ts`、
  `streamdown-plugins.test.ts`、`streamdown/plugins.test.ts`、`threads/infinite.test.ts`、
  `threads/message-merge.test.ts`、`threads/stream-throttle.test.ts`、`threads/token-usage.test.ts`。
  已逐个核对到具体符号：`createElement`、`renderToStaticMarkup`、`QueryClient`、`QueryObserver`
  —— 都是真的 React 运行时断言，不是误报。
- 其余 11 个因**被测模块**分类为 `REWRITE`/`DROPPED` 而随之推迟。

反过来，`dom/render-activity.dom.test.ts` 虽然带 `.dom.` 前缀却是 `.ts`，
说明文件名同样不能单独作为判据。分桶一律按 import 判定。

## 红的 / 未决的

1. **vitest 还没有 DOM project。** `vitest.config.ts` 只有 `node` 与 `nuxt` 两个 project，
   11 个 `M1_DOM` 测试目前无处可跑。`happy-dom` 已是 devDependency，下一窗口需要加第三个 project。
   **在这之前 M1 子集实际只能跑 49 个，不是 60 个。**

2. **rstest → vitest codemod 未写。** 83 个测试全部 `import from "@rstest/core"`，
   用到 14 个 `rs.*` API：`advanceTimersByTimeAsync`、`doMock`、`doUnmock`、`fn`、`hoisted`、
   `mock`、`mocked`、`resetModules`、`restoreAllMocks`、`spyOn`、`stubGlobal`、`useFakeTimers`、
   `useRealTimers`、`unstubAllGlobals`。多数与 `vi.*` 同名，但 `doMock`/`doUnmock`/`mocked`
   的语义等价性未验证。**这是下一窗口开工的第一件事**，符合「先写 codemod，不逐个手改」。

3. **`core/types/message.ts` 未落地。** 32 个 `RETYPED` 中 16 个指望它。
   08 合同已给出 `AgentMessageContent = string | AgentContentPart[]`；
   B1/B11 的失效方式是**静默**的——塌成 `string` 编得过但行为错。
   下一窗口先写这个类型 + round-trip 测试，再动那 16 个文件。

4. **collected-test 对账脚本未写。** 计划要求每批转换后拿 collected 报告与 manifest 对账，
   防止靠「暂时不收集」换全绿。台账已经就位（`core-test-manifest.json` 有每个测试的期望分桶），
   但比对那一步还没有。**在它写出来之前，任何「M1 全绿」的说法都不可采信。**

5. `DROP_POLICY` 里 `blog/index.ts` 的判断出自 01-scope 的范围约定，不是实测无消费方。
   若后续要保留 marketing 博客，这条要重新评估。

## 未做（明确留给后续窗口）

未搬任何业务文件；未建 `scripts/i18n-manager.mjs`（1d）；未装那 12 个 npm 包。
