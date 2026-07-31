# 交接文档 · DeerFlow 前端 Vue 化项目

> **用途**:新会话冷启动后读本篇即可接手,无需重新推导。
> **最后更新**:2026-07-31
> **主仓库**:`/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow`
> **分支**:`main-wc`|**对标基线 commit**:🔴 **`b71a892b`**
> (`16ea3a4d` → **D4-a** → `f204d2cb` → **D4-b** → `b71a892b`,均在 2026-07-31。
>  **D4-b 这次 `frontend/` 零漂移**,资产数字全部保持)

---

## 〇、⚠️ 冷启动必读

### 🔴 2026-07-31 v4 已定稿:六项外部现实修正,**O18/O19 均已由用户拍定**

> **方案已从 v3.5 → v4。** 用户 2026-07-31 说「按照你推荐的来进行修复」后落的。
> **仍未写一行业务代码。**
>
> **一句话**:前七轮把**内部一致性**做到了很高水平,v4 改的全部是**外部现实** ——
> 上游演进速度、依赖的社区健康度、以及"少装包"越推越远之后的复合成本。
>
> | # | 变更 | 为什么 | 落点 |
> | --- | --- | --- | --- |
> | 🔴 **D26** | **上游冻结政策**(选定 (b):只 merge `backend/` + 安全补丁) | 实测 `frontend/src` 近 6 个月**文件级 100% 翻动**(453 唯一文件 / 389 现存),月新增中位数 **+6,500 行**。5–7.5 个月工期 → 上游多出 **33,000–74,000 行**。**风险 R6 由「中/低」上调为「必然/高」** | 11 号 **§2.10** |
> | 🔴 **D25-a ①** | **`crypto.randomUUID()` 不能用,改回 `uuid` 包** | 它 **secure-context-only**;`docker-vue/` 是内网 **HTTP `:2027`** → 除 localhost 外 `undefined`。而 `uuid()` 生成**新建 thread 的 ID**(6 处)→ **新建会话直接报错** | 11 号 **§2.4.6** |
> | 🔴 **D13-a** | **补第六类偏离 `DETYPED`**,Tier 1 从 10,400 → **7,215 行** | 实测 **13 个 core 文件 / 3,185 行** import `langgraph-sdk`/`ai` 但不 import react,被误算进 Tier 1 → `core-provenance.test.ts` **第一天报 13 个红** | 11 号 **§3.1.4** |
> | 🔴 **D24-a** | **推翻 D24,装 `@tanstack/vue-query`** | 实测 peer 仅 `vue ^2.6\|\|^3.3`,**零 React 依赖**;而自研面是 38 useQuery/40 useMutation/57 invalidateQueries + 7 类选项,且 §4.4 是**全案唯一没有量级的自研件** | 11 号 **§2.8.7** |
> | 🔴 **D25-a ②** | **保留 `@vueuse/core`** | 实测 `14.4.0` **2026-07-29 仍在发版**,Vue 生态事实标准;D25 把它当 `motion-v` 的附属品一起删了,**它不是** | 11 号 **§2.4.6** |
> | 🔴 **D11-a** | **上 GitHub CI,关掉风险 R14** | 实测 14 个现有 workflow **全部按 `paths:` 过滤** → 新建 `paths: frontend-vue/**` 的 workflow **零修改现有文件**,与 D10 同构。**R14 从「中高/高」降到「低/中」** | 11 号 **§3.2.4** |
> | ✅ **减负 1** | `hast-util-to-jsx-runtime` **不是 React 专有**(peer 为 `null`),`vue` 导出 `./jsx-runtime` | **P4「5–8 周 / 全案最高风险」的两根成本支柱倒了一根**。加成 P0 半天二元实验;⚠️ **先不改口径**,等实测回推 | 11 号 **§4.2.5** |
> | ✅ **减负 2** | `splitpanes@4.1.2` **已 emit `resize` + `resized`** | 红线 P5 最硬的判据已满足,**风险 R4 概率下调**,P0 第 3 项 1–2 天 → **半天** | 11 号 **§2.3.2** |
> | ⚠️ **新增 R20** | **antdv 4.2.6 发布于 2024-11-11,20 个月无新版** | 不推翻 D2,但 **P0 ⑦ 的实测结果就是终局**,不能指望上游修 | 11 号 **§8** |
>
> **依赖数 50 → 53**;**Tier 1 逐字节 10,400 → 7,215**;**自研基础件 4 → 3**;
> **P1 `1–2` → `1.5–2.5 周`**;**对外口径 `≈7–12 人月` 不变**(v4 净影响 ≈ 0)。

### ✅ 现在的状态:**无待决项、无阻塞项 —— 可以开 P0**

🔴 **2026-07-31 用户「按你推荐方案来」,O18 / O19 全部关闭:**

| # | 定案 |
| --- | --- |
| ✅ **O18** | **D26 = (b)** —— 项目期间只 merge `backend/` + 安全补丁,**`frontend/` 完全冻结** |
| ✅ **O19** | **D11-a = 上 CI** —— 新建 `frontend-vue-verify.yml`(`paths: frontend-vue/**`),零改现有文件 |

🔴 **同日发生 D4-b:基线第二次前移,已重冻至 `b71a892b`** ——
用户再次合入 main,**但这次 `frontend/` 零漂移**
(实测 `git diff f204d2cb..b71a892b -- frontend/` 为空;该 merge 只动 `backend/` / `docker/` / `deploy/` / `scripts/`,
65 文件 / +4,813 −585)。
✅ **全部资产数字保持不变**,已在新基线上按铁律 1 复核:`frontend/src` **56,484 行**、
`core` **143 个 / 19,001 行**、`threads/hooks.ts` **3,072 行**、E2E **27 个 spec**。

> 🔴 **这次 merge 本身就是 D26 (b) 的第一次验证** —— 政策与实际操作天然一致。
> 📌 **但别把它当成"漂移不会发生"**:对照 **D4-a**(18 文件 / +768 −99,需全量刷新数字、
> 并连带关闭 O17、反转 D18 理由)—— **同样是"合入 main",代价可以差一个数量级。
> 这正是 D26 要管住的东西。**
>
> ⚠️ **P0 期间每次 merge upstream 后都要跑**:
> ```bash
> git diff b71a892b..HEAD --stat -- frontend/
> ```
> **输出非空即按 §2.10.5 第 3 条处理**(判断是否属安全补丁例外;不属则回退该路径)。

> 📌 **剩下唯一的开放项是 O15**(v2 是否做共享包,远期,v1 上线后再议)—— **不影响开工**。

---

### ~~本窗口的任务:把 D20–D25 传播干净~~(v3.5 时点的记录,已完成)

> 🔴 **当前阶段:方案 v3.5,D1–D25 全部定稿。仍未写一行业务代码。**
>
> ✅ **本轮已完成**:[§十](#十下一窗口的优化待办按性价比排序) 的 **⑧⑨⑩** ——
> D20(产品区全 CSR)已传播到 11 号主方案、P0 实验顺序、目录树与 README。
> ✅ **本轮新增 D22**:流处理必须手写,Vue 版不装 `@langchain/langgraph-sdk`;
> 当前 Gateway SSE 语义由 DeerFlow Gateway adapter 适配成前端 canonical stream event。
> ✅ **本轮新增 D23**:`@langchain/core` 仅 1 处 `import type ToolCall`,零运行时代码;
> Vue 版本地手写 `ToolCall` 最小类型,不装 `@langchain/core`。
> ✅ **本轮新增 D24**:`@tanstack/react-query` 在 React 版有 16 个源码文件运行时使用;
> Vue 版不装 `@tanstack/vue-query`,改自研 `app/core/server-state/`。
> ✅ **本轮新增 D25**:继续清理 React 迁移惯性/小众包,不装 `motion-v` / `@vueuse/core` /
> `@vue-flow/core` / `canvas-confetti` / `@uiw/codemirror-theme-*` / `nanoid` / `uuid` /
> `tokenlens`;用平台 API、CSS/Vue Transition/RAF、CodeMirror 原生主题与极小本地门面替代。
> 复查命令:`grep -n "SSR" frontend-refactor-docs/11-vue-parity-plan.md`
> 仍会命中 D20 正文、未来营销区 SSR、R5b 历史风险与 O8→D1 历史记录,这些不要删。
>
> **可以做**:改 `frontend-refactor-docs/` 下的文档、跑只读命令实测、`npm view` / 临时目录里 `pnpm install` 验证。
> **不可以做**:建 `frontend-vue/`、写任何业务代码、动 `frontend/`(D7 红线)。

### 📌 已经完全定稿、不要重新讨论的部分

| 部分 | 状态 |
| --- | --- |
| **决策 D1–D25** | 全部定稿(D3 被 D7 否决、D1 被 D20 修订,D21 决定 `ai` 类型本地化,D22 决定流处理手写化,D23 决定 `@langchain/core` 类型本地化,D24 决定 `@tanstack/vue-query` 自研替代,D25 决定清理 9 个 React 迁移惯性/小众包)。见 §二 |
| **待决项** | ✅ 只剩 **O15**(v2 共享包,远期)。O5/O6/O11/O17 → **D16–D19**;O2 → 结论 |
| **复用 vs 重写** | ✅ 总表在 11 号 **§1.0**(四档划分,每格标了出处) |
| **技术栈 / `package.json`** | ✅ **50 个依赖**(D21 删除纯类型 `ai`,D22 删除 `@langchain/langgraph-sdk`,D23 删除纯类型 `@langchain/core`,D24 删除 `@tanstack/vue-query`,D25 删除 9 个 React 迁移惯性/小众包)。D21 前 63 个已四层验证;D21–D25 后是删包不加包,但 P0 落盘时仍需重跑严格 install 留证。见 §2.8 |
| **红线分类** | ✅ **44 条**(A3/B12/C29),机械核对闭合。B 类 12 条已做成 PR checklist(§5.2) |
| 🔴 **三个**自研基础件(v4:原 4 个) | ✅ §4.1/§4.2/§4.3 均有接口草案与红线对应。**§4.4 `ServerStateClient` 已由 D24-a 移出**(改装 `@tanstack/vue-query`),仅 §4.4.1 使用面表仍有效 |
| **store 作用域** | ✅ §3.3.1(三分类 + 五条约定 + 守护测试) |

### 🔴 三条铁律(这个项目吃过亏,别再犯)

| # | 铁律 | 为什么 |
| --- | --- | --- |
| 1 | **引用文档里的数字前,先自己实测复核** | 已发生过 **两轮共 10+ 处**记账错。形态固定:**实测基数全对,被复述到第二处的数字会漂**。见 §七 |
| 2 | **不要覆盖式重写文档** | 在现有基础上定点改。(v4 时点:01–11 号与本篇均已提交,`5ae7f359`) |
| 3 | **不要重新讨论 D1–D12、D15** | 用户已逐项拍定,见 §二。D13/D14 可推翻,但**推翻前先读 §3.1.2 / §1.2.1 的实测依据** |
| 🔴 **4**<br>(**v4 新增**) | **核实一个依赖要核三层:① 版本存在 → ② peer 兼容 → ③ 真实运行环境与维护节奏** | 前七轮反复在①②上抓到错(`package.json` 首版 **12 处**问题,见 §十 ⑦c/⑦d/⑦e);<br>🔴 **v4 抓到的六处全部在第 ③ 层**:`crypto.randomUUID` 在内网 HTTP 下不存在、antdv 20 个月未发版、`@vueuse/core` 两天前还在发版、`hast-util-to-jsx-runtime` peer 为 `null`、`@tanstack/vue-query` peer 里没有 react、`splitpanes` 已 emit 两类事件。<br>**"这个包存在且 peer 干净"≠"它在我们的部署形态和维护周期里能用"** |

### 确认未提交改动

**截至 2026-07-31,本目录的三份文档仍处于未提交状态**:

```
AM frontend-refactor-docs/11-vue-parity-plan.md
AM frontend-refactor-docs/HANDOFF.md
MM frontend-refactor-docs/README.md
```

开工前先跑一次:

```bash
git status --short frontend-refactor-docs/
```

- **还在未提交** → 用户尚未审阅,**在其基础上改,不要重写**
- **已提交** → 正常继续

`deer-flow` 上一个提交是 `5991e181`(01–10 号文档首次入库)。
**D8–D15 的全部修订、v2「彻底修复」与 v3「弃 Tailwind 改 SCSS」的成果,都还在工作区。**

### 文档职责边界(避免改错文件)

| 文档 | 性质 | 本轮能不能改 |
| --- | --- | --- |
| `01`–`10` | **React 现状快照**,描述"现在是什么" | ❌ **不要动** —— 里面提 Tailwind 是对的(React 版确实用 Tailwind)。已核对:仅 `09` 第 166 行提到 Nuxt,说的是 React 项目的可疑依赖,**不是前瞻内容** |
| `11-vue-parity-plan.md` | **唯一的前瞻性方案文档** | ✅ 主战场 |
| `HANDOFF.md` | 交接与决策记录 | ✅ 改完方案要同步 |
| `README.md` | 索引 | ✅ 口径变了要同步 |

> ✅ **第二轮已完成,方案为 v2**(见 §一)。10 处问题已全部修复,**无遗留项**。
> 若你是新会话且 `git status` 仍显示未提交:**说明用户还没审阅 v2,不要再动文档**,
> 先按 §〇 顶部要求汇报理解,等指令。
>
> 🔴 **D4 基线已于 2026-07-31 首次漂移,并已重新冻结** —— 见 **D4-a**。
> 上一版写的「`git diff 16ea3a4d..HEAD -- frontend/` 为空,零变动」**已失效**:
> `main` 合入 `main-wc` 后实测 `git diff 16ea3a4d..HEAD -- frontend/src frontend/tests`
> = **18 文件 / +768 −99**(6 个提交:#4577/#4578/#4580/#4582/#4584/#4587)。
> **新基线 `b71a892b`**,全部资产数字已按新基线实测刷新;
> 其中 `0d8e11ad` 修掉了 `autoOpen` 跨 thread 粘滞 → **O17 关闭、D18 理由反转**。

### 本会话涉及两个项目,别搞混

| 项目 | 路径 | 状态 | 关系 |
| --- | --- | --- | --- |
| **DeerFlow**(主任务) | `aiAppSpace/deer-flow` | 方案定稿,**尚未写任何代码** | 本文档的主体 |
| **nuxt-modern-starter**(参照 + 已修复) | `frontEnd/nuxtProjects/nuxt-modern-starter` | ✅ **已完成并提交**(`ac86de0`) | 见 §6.13 与该仓库的 `FIX-PLAN.md` |

`nuxt-modern-starter` **不是本项目的一部分**,它是一个技术栈重合的真实工程。
本会话对它做了两件事:① 架构质量评估 → 发现 11 个问题;② 按 `FIX-PLAN.md` 彻底修复
(9 项完成 / 1 项用户决定不做 / 1 项不纳入),`pnpm quality` + `docs:sync:check` 全绿,
测试 126 → 137,每项都通过「故意引入缺陷 → 检查必须失败」的反向验证。
**它对本项目的价值已提炼进 §6.13 与方案 §2.7,不必重看那个仓库。**

---

## 一、当前状态

**已完成**:现有 React 前端的架构提取(11 篇文档)+ Vue 化建设方案
(🔴 **方案 v4**,含 **D1–D26 + 五项修订 D4-a / D11-a / D13-a / D24-a / D25-a**)。

### 🔴 2026-07-31 第八轮:v4 —— 外部现实核对(用户「按推荐来修复」)

用户要求评估方案是否为企业主流最佳方案。逐项独立实测(**不引用文档里的任何数字**)后,
发现**前七轮的严谨度全部作用在内部一致性上,薄弱点集中在外部现实**。
六项修正 + 两项减负,**其中三项若不改会在 P0 第一周或上线当天卡住**。清单见 §〇 顶部。

| 类 | 数量 | 是什么 |
| --- | --- | --- |
| **上线当天会炸** | **1** | `crypto.randomUUID()` secure-context(**D25-a ①**) |
| **P0/P1 第一天会卡** | **2** | DETYPED 13 个文件(**D13-a**);`Message` 类型模型无预算(**§4.1.5**) |
| **方向性推翻** | **3** | 上游冻结(**D26**)、装 vue-query(**D24-a**)、留 `@vueuse/core`(**D25-a ②**) |
| **风险重估** | **3** | R6 上调(中/低 → 必然/高)、R14 下调(中高/高 → 低/中)、R4 概率下调 |
| **新增风险** | **1** | **R20** antdv 20 个月未发版 |
| **减负(待 P0 证实)** | **2** | P4 渲染末端可能不必自研;resizable 判定压到半天 |

🔴 **口径**:依赖 **50 → 53**;Tier 1 逐字节 **10,400 → 7,215 行**;自研基础件 **4 → 3**;
P1 **1–2 → 1.5–2.5 周**;**对外 `≈7–12 人月` 不变**(v4 净影响 ≈ 0,见 11 号 §7 修正记录 ⑨–⑫)。

> 🔴 **本轮最该记住的一条**:六处问题的共同形态是
> **「核实了这个包/这个数存不存在,但没核实它在真实环境里会怎样」** ——
> 已提炼为**第四条铁律**(见 §〇)。
> 讽刺之处与第二轮那次同源:方案在 §2.8.3 记了首版 `package.json` 的 **12 处**依赖错,
> 教训写的是"必须实跑解析" —— **但"实跑"当时只跑到 `pnpm install` 那一层,没跑到部署形态。**

### 🔴 2026-07-31 第七轮:D25 —— 清理 9 个 React 迁移惯性/小众包(用户要求)

用户要求继续挑出“Vue 项目根本不常用、只是 React 迁移惯性带过来的包”,并要求彻底处理。
按实际运行时使用面与参照工程比对后,D25 决定继续删包,不新增第三方依赖。

| 包 | 处置 |
| --- | --- |
| `motion-v` / `@vueuse/core` | React 版非 landing 只剩 6 处 `motion/react` import;`terminal` / `number-ticker` 已属 D6 零引用特效件,存活 `shimmer` / `flip-display` 用 CSS animation / Vue `<Transition>` / RAF |
| `@vue-flow/core` | React 版 `@xyflow/react` 只出现在 D9 已砍的 `ai-elements` 画布件 |
| `canvas-confetti` | 仅 `ConfettiButton` 1 处装饰反馈,改 CSS/Canvas 小实现或普通 antdv 成功反馈 |
| `@uiw/codemirror-theme-basic` / `-monokai` | Vue 侧已自写 CodeMirror 薄封装,主题改用 CodeMirror 6 原生 `EditorView.theme` |
| `nanoid` / `uuid` | 改 `crypto.randomUUID()` + 本地 `id.ts` 门面 |
| `tokenlens` | 只服务 D9 已砍的 `ai-elements/context`,不装 |

**Vue manifest 依赖数:59→50**(28 dependencies + 22 devDependencies)。
**暂不删 `lucide-vue-next`**:非 landing 实测仍有 82 个 `lucide-react` import,且 3,086 行 i18n 词典 value import 图标;如要迁到 Ant Design Icons,另开 D26 评估。

### ~~🔴 2026-07-31 第六轮:D24 —— `@tanstack/vue-query` 自研替代(用户决定)~~

> 🔴 **已被 v4 的 D24-a 推翻(2026-07-31,用户「按推荐来」)** ——
> **改为装 `@tanstack/vue-query`,不自研**。判据:实测其 peer 仅 `vue ^2.6||^3.3`,零 React 依赖;
> 而自研面是 38 useQuery / 40 useMutation / 57 invalidateQueries + 7 类选项,
> 且 §4.4 是**全案唯一没有量级的自研件**,却压在 P2 关键路径。见 11 号 **§2.8.7**。
> **以下为原决策留档,不要照它执行。**

用户明确要求 `@tanstack/vue-query` 自研替代。实测 React 版 `@tanstack/react-query`
不是纯类型依赖,而是运行时使用: `frontend/src` 中 **16 个文件** import,
覆盖 `useQuery` / `useMutation` / `useInfiniteQuery` / `useQueryClient` /
`invalidateQueries` / `setQueryData`。

| | 结论 |
| --- | --- |
| **Vue 侧依赖** | 🔴 **不装 `@tanstack/vue-query`**。依赖数 **60→59** |
| **替代方式** | 自研 `app/core/server-state/`: `ServerStateClient` + `useServerQuery` / `useServerMutation` / `useServerInfiniteQuery` |
| **P0 影响** | 新增 **D24 server-state contract fixture**:并发去重、prefix invalidate、`setQueryData`、infinite page append |
| **边界** | 不做 SSR hydrate/dehydrate、不接 devtools、不负责 D22 流状态 |

### 🔴 2026-07-31 第五轮:D23 —— `@langchain/core` 类型本地化(用户决定)

用户要求继续挑出小众且可手写替代的包,并明确要求处理 `@langchain/core`。
实测 React 版只有 **1 处**引用:`frontend/src/core/tools/utils.ts:1`,
且是 `import type { ToolCall } from "@langchain/core/messages"`,编译期擦除,运行时使用面 **0**。

| | 结论 |
| --- | --- |
| **Vue 侧依赖** | 🔴 **不装 `@langchain/core`**。依赖数 **61→60** |
| **替代方式** | 在 `app/core/agent-types.ts` 定义 `ToolCall = { name: string; args: Record<string, unknown>; id?: string }` |
| **当前字段覆盖** | `name` / `args.query` / `args.description` |
| **约束** | 未来若前端开始构造 LangChain message class 或依赖更完整 `ToolCall` 字段,必须重新评估 |

### 🔴 2026-07-31 第四轮:D22 —— 流处理手写化(用户决定)

用户明确要求:前端必须手动实现流处理,不能继续依赖 LangChain/LangGraph SDK,
目标是未来后端不用 LangChain/LangGraph 时,Vue 前端也能复用、不大改。

| | 结论 |
| --- | --- |
| **当前后端是否改** | ❌ **不改**。继续对接现有 DeerFlow Gateway SSE contract |
| **Vue 侧依赖** | 🔴 **不装 `@langchain/langgraph-sdk`**。依赖数 **62→61** |
| **保留的后端语义** | `/api/threads/{id}/runs/stream`、`/{run_id}/join`、`Last-Event-ID`、`Content-Location`、`gap`、`end`、`metadata/messages/values/custom`、409 分支 |
| **新增设计** | 手写 `fetch-sse` / wire codec / `DeerFlowGatewayStreamAdapter` / canonical event reducer |
| **P0 影响** | P0 先做 stream contract fixture,用当前 Gateway fixture + 非 LangGraph fixture 双验证 |

🔴 **核心口径**:这不是脱离当前后端重造协议,而是**忠实实现当前 DeerFlow Gateway wire contract,
再把它隔离在 adapter 层**。未来后端替换时,UI/store 只认 canonical stream event。

### 🔴 2026-07-31 第三轮:D15 —— 弃用 Tailwind,改用 SCSS(用户决定)

用户明确要求「不要用 Tailwind CSS 4,改成 SCSS 来实现」。**这是第一笔真正改变对外口径的决策。**

| | 实测结论 |
| --- | --- |
| **E2E 影响** | ✅ **只有 2 处**(`chat.spec.ts:481/500` 的 `span.font-medium`)。按 class 选元素共 8 处,其余 6 处:`a.nextra-card`×2 在 **D6 已砍**的 spec 里、`.is-user` 系 ×4 是**语义类**与样式方案无关 |
| **必须保留的东西** | 🔴 **115 个 CSS 自定义属性** —— SCSS 变量是**编译期**的,做不到运行时暗色切换,而暗色有 E2E 断言(`ui-polish-mobile.spec.ts:49`)不能砍。**SCSS 是写法层,CSS 变量是运行时 token 层** |
| **真实成本** | 失去「className 字符串逐字复制」这个对标捷径。全库 **1,841 处 `className=`**、`cn()` **418 次 / 114 文件**;约 200 个组件要重新表达间距/尺寸/层级 → **+3–6 周**,压在 P2/P5 |
| **意外收益** | ✅ 参照工程 `nuxt-modern-starter` **本来就是 SCSS**,§2.7.1 原先记着的「真相源是 Tailwind CSS 变量」那处必须处理的差异**直接消失**,主题链可整条抄,反省 1–2 天;R5c 进一步降低 |
| **不移植** | `tailwind-merge`(冲突消解在 SCSS 下无意义)、`clsx`、`cva` → 改用 Vue 原生 `:class` 绑定 |
| **新增** | **stylelint** 进 `make verify` 快门禁;**风险 R18**(视觉对标漂移) |

🔴 **口径变化(必须更新对外说法)**:
`24–42 → 27–48 周`;**`≈6–10 → ≈7–12 人月`**;**3 人 `4–6 → 5–7.5 个月`**。
⚠️ 「+3–6 周」**不是实测**,是按「约 200 组件 × 每个多 0.5–1.5 小时」估的,**全案最不确定** ——
建议 P2 做完前 3 个页面就用实际速率回推(方案 §2.4.5)。

🔴 **最需要警惕的不是工期,是 R18**:E2E 断言的是文案/角色/testid,**不是像素** ——
**视觉漂移在 25 spec 全绿的情况下照样会发生**。§0.3「保留 React 版做逐屏 diff」
在 D15 之后从"锦上添花"变成**必需**。
**当前阶段**:方案定稿,**无阻塞项,可直接开工 P0**。**DeerFlow 侧尚未写任何代码。**
**下一步**:见 §五(已给出建议的起手项与理由)。

### 🔴 2026-07-31 第二轮:彻底修复(方案 v1 → v2)

用户指示「按最佳实践彻底修复,确保方案落地时无阻塞项」。逐项复核后发现 **10 处问题并全部修复**:

| 类 | 数量 | 是什么 | 结果 |
| --- | --- | --- | --- |
| **落地会卡住的** | **2** | ① D12 的文件级哈希在 `threads/hooks.ts` 上必然失效<br>② 25 spec 结构上看不见 Nitro 代理层 | → **D13**、**D14** |
| 记账不一致 | 6 | 组件计数沿用 D6 前的数、D9 收益漏计入总账、两处残留「4 处」、`tests/guards` 路径分叉、缺口 3/4 口径混用、`hooks.ts` 标注张冠李戴 | 全部按实测更正 |
| 执行形态建议 | 2 | `make verify` 拆快/慢门禁;P0 执行顺序 | 已写进 §3.2.3 / P0 |

**没有一条动到 D1–D12、分期结构、或当时三个自研件的估算(那是 17–26 周的大头)。**
工期重算后 **24–42 周**,当时对外口径 ≈6–10 人月 / 3 人 4–6 个月 **不变**
—— D9 补计入的 −1 周与 D13/D14 的 +1.5 周基本抵消。
> ⚠️ **这一行是 v2 时点的记录**。**v3 的 D15 已把口径改为 `27–48 周 / ≈7–12 人月 / 3 人 5–7.5 个月`**,
> 见本节上方的第三轮说明。**对外引用请用 v3 的数。**

---

## 二、任务目标与硬约束

### 目标
在**不改动后端**的前提下,建设一个 **100% 纯 Vue** 的前端,功能与现有
`frontend/`(React/Next 16)**完全对标**,供公司内部使用。

### 二十五项已定稿决策(D1–D25)

> 完整表格在 [11-vue-parity-plan.md](11-vue-parity-plan.md) §0.4。
> **D1–D12、D15–D25 是用户明确拍定的,不要再重新讨论或建议改变。**
> **D13 / D14 授权来源不同**:用户 2026-07-31 指示「按最佳实践彻底修复」后由我依实测所定,
> 只改**实现方式**不改方向 —— **用户可随时推翻**。

| # | 决策 | 要点 |
| --- | --- | --- |
| **~~D1~~** | ~~渲染模式~~ | ~~**Nuxt + SSR**。鉴权五态在服务端完成~~ → 🔴 **已被 D20 修订为「产品区全 CSR + 营销区预留 SSR」** |
| **D2** | UI 组件库 | **Ant Design Vue**(用户选择;我原推荐 reka-ui,已按 antdv 重做分析见 §2.3) |
| **D3** | ~~共享包~~ | **已被 D7 否决** |
| **D4** | 对标基线 | 冻结 `16ea3a4d`,后续上游变更进 v2 待办 |
| 🔄 **D4-a** | 基线首次漂移,**已重新冻结为 `b71a892b`** | 2026-07-31 合入 main(6 个前端提交 / 18 文件 / +768 −99)。本次计入 v1,数字已刷新;连带 **O17 关闭、D18 理由反转**。后续仍按 D4 原则进 v2 待办 |
| **D5** | 无障碍 | Vue 版**不写任何 `aria-*`**,不为无障碍额外投入(D8 进一步砍 `sr-only`)|
| **D6** | 范围裁剪 | **砍 6 项**共 4,925 行 + 72 MDX(见下)|
| **D7** | 改动范围 | 🔴 **只能改 `frontend-vue/`,其余一切不动** |
| **D8** | `sr-only` | 🔴 **一并砍掉**(24 处)。无障碍彻底不投入。代价 5 处断言 / 3 个 spec |
| **D9** | 零引用代码 | 🔴 **20 个文件 / 2,100 行不移植**。已实跑证明(见 §6.12)。与 D6 分开记:D6 砍功能(可逆),D9 砍死代码(技术事实)|
| **D10** | 放宽 D7 | ✅ **可新建顶层目录**(如 `docker-vue/`),新目录内不限;**已有文件尽量不改**,确需改动须先说明「为何无新建目录的替代方案」并逐次获批。关闭 O14b |
| **D11** | 不做 GitHub CI | ❌ Vue 版不进 GitHub Actions。门禁改 `frontend-vue/Makefile` 的 `make verify` + PR 贴输出。关闭 O14a,代价见风险 **R14** |
| **D12** | 测试可读 `frontend/` | ✅ **只读不改**。`frontend-vue/tests/guards/` 可读 `frontend/src/**` 做机械比对 → **`core-provenance.test.ts` 把「两份拷贝必然发散」变成「立刻报红」**(11 号 §3.1.2)|
| **D13** | 溯源校验分两层<br>+ `threads/hooks.ts` 拆分规格 | 🔴 **文件级哈希不够**。实测该文件 3,072 行 / **53 导出,仅 13 个是 hook,另 40 个是非 hook 导出**(`mergeMessages`/`decideCoalesce`/`STREAM_RENDER_COALESCE_MS`/历史合并全组),且**与 hook 交错分布** → **必拆 → 哈希必不等 → D12 恰在 C 类红线最密集处失效**。改为 **Tier 1 文件哈希 + Tier 2 导出级提取比对**;拆分规格见 11 号 **§3.1.3** |
| **D14** | 验收拆成两层 | 🔴 **25 spec 全部走 `mock-api.ts` 的 `page.route()`,请求在浏览器层就被劫持,永不经过 Nitro 代理** —— 而 D10 去 nginx 后的三项责任(R15)+ `proxy-policy` 契约全在那层。**全案最新、最无参照、后果最重的基础设施,恰是继承资产唯一照不到的地方**。验收改为 **①UI 层 25 spec + ②代理层 `proxy-contract` 6 条断言 + 4 个真后端 spec**(11 号 §1.2.1)|
| 🔴 **D20** | **渲染策略:产品区全 CSR + 营销区预留 SSR**(修订 D1) | ❌ **对话流程/workspace 全部 `ssr: false`**。<br>✅ **但仍用 Nuxt,不退化成纯 Vite SPA** —— 将来要加落地页/价格页/关于我们/新闻页,**那些需要 prerender/SSR**,纯 SPA 做不了;且 **Nitro 是 D10 去 nginx 后的代理层载体**。<br>📐 照搬参照工程 `nuxt-modern-starter`:`config/routes.ts` 单一来源 → `routeRules` 消费(prerender / SWR / `ssr:false`)。它的 `productRoutePatterns = ['/workspace/**','/docs/**','/account']` 与 DeerFlow 高度吻合。<br>🔴 **鉴权是唯一要重新设计的**:React 靠 Server Component 的 `getServerSideUser()` 服务端重定向;CSR 下改用 **Nitro server middleware**(方案 B,参照工程有 `server/middleware/` 先例)。<br>✅ **Nitro 代理层完全不受影响** —— D10/D14/R15/R16 全部有效。**R16 仍是 P0 必做**(它测的是代理转发 SSE,与页面是否 SSR 无关)。<br>详见 11 号 **§2.9** |
| 🔴 **D21** | **`ai` 包不装,本地手写最小类型** | React 版实测只有 `import type` 用到 `Experimental_GeneratedImage` / `FileUIPart` / `UIMessage` / `LanguageModelUsage` / `ChatStatus`,零运行时代码。Vue 侧改在 `app/core/ai-types.ts` 定义最小类型,依赖数 **63→62**。 |
| 🔴 **D22** | **流处理必须手写,不装 `@langchain/langgraph-sdk`** | 当前后端不改,仍接 `/api/threads/{id}/runs/stream`、`/{run_id}/join`、`Last-Event-ID`、`Content-Location`、`gap`、`end`、`metadata/messages/values/custom` 等 DeerFlow Gateway SSE 语义;Vue 侧手写 transport / wire codec / DeerFlow Gateway adapter,统一转成 canonical stream event。依赖数 **62→61**。 |
| 🔴 **D23** | **`@langchain/core` 包不装,本地手写 `ToolCall` 最小类型** | React 版实测只有 `frontend/src/core/tools/utils.ts:1` 一处 `import type { ToolCall }`,零运行时代码。Vue 侧改在 `app/core/agent-types.ts` 定义 `{ name; args; id? }` 最小结构,覆盖当前 `name` / `args.query` / `args.description` 使用面。依赖数 **61→60**。 |
| ~~🔴 **D24**~~<br>🔴 **已被 D24-a 推翻** | ~~**`@tanstack/vue-query` 包不装,自研 server-state 层**~~ → ✅ **改为装 `@tanstack/vue-query`** | 原决策留档:React 版实测 `@tanstack/react-query` 运行时用在 16 个 `frontend/src` 文件。<br>🔴 **v4 推翻理由**:实测 Vue 对应物 peer 仅 `vue`,零 React 依赖;自研面 38 useQuery/40 useMutation/57 invalidateQueries + `enabled` 48 等 7 类选项;§4.4 是全案唯一没有量级的自研件。见 **D24-a** 行与 11 号 §2.8.7 |
| 🔴 **D25**<br>🔄 **部分被 D25-a 推翻** | **清掉 9 个 React 迁移惯性/小众包** | 不装 `motion-v` / ~~`@vueuse/core`~~ / `@vue-flow/core` / `canvas-confetti` / `@uiw/codemirror-theme-*` / `nanoid` / ~~`uuid`~~ / `tokenlens`。依赖数 **59→50**。<br>🔴 **v4:其中 2 项已推翻(D25-a)** —— `@vueuse/core` 保留、`uuid` 保留(`crypto.randomUUID()` 是 secure-context-only)。**其余 7 项维持。** |
| 🔴 **D26** | **上游冻结政策(v4 新增,已选 (b))** | 项目期间只 merge `backend/` + 安全补丁,**`frontend/` 完全冻结在 `b71a892b`**。<br>实测依据:近 6 个月 `frontend/src` **文件级 100% 翻动**(453 唯一文件 / 389 现存),月新增中位数 **+6,500 行**,5–7.5 个月 → 上游多出 **33,000–74,000 行**;且 2026-07 变更最大的四个文件(`threads/hooks.ts` +2,181 等)**全在 P1/P3/P5 关键路径上**。<br>✅ 🔴 **2026-07-31 用户定案 (b)**(「按你推荐方案来」),**O18 关闭**;(a)/(c) 见 11 号 §2.10.4。<br>✅ **当天即完成第一次验证**:随后合入 main 的 `b71a892b` 实测 `frontend/` **零漂移**(见 **D4-b**) |
| 🔄 **D24-a** | **推翻 D24:装 `@tanstack/vue-query`** | 实测 `5.101.4` peer 仅 `vue ^2.6\|\|^3.3`(+ Vue2 才用的 composition-api),**零 React 依赖**;自研面 38 useQuery/40 useMutation/3 useInfiniteQuery/57 invalidateQueries/8 setQueryData + `enabled` 48 等 7 类选项,而 §4.4 **是全案唯一没有量级的自研件**,却压在 P2 关键路径。依赖数 **50→51**。见 11 号 §2.8.7 |
| 🔄 **D25-a** | **修订 D25 两项** | ① 🔴 **`crypto.randomUUID()` 是 secure-context-only** —— 内网 HTTP `:2027` 下 `undefined`,而 `uuid()` 生成新建 thread 的 ID(`use-thread-chat.ts` 5 处 + `agents/new/page.tsx` 1 处)→ **新建会话直接报错**。佐证:`core/clipboard.ts` 已为 `navigator.clipboard` 写过 `execCommand` 回退,**非安全上下文是本项目已知的真实部署条件**。<br>② **`@vueuse/core` 保留** —— `14.4.0` @ 2026-07-29 仍在发版,Vue 生态事实标准;D25 把它当 `motion-v` 附属品删了,**它不是**。依赖数 **51→53**。见 11 号 §2.4.6 |
| 🔄 **D13-a** | **补第六类偏离 `DETYPED`** | 实测 **13 个 core 文件 / 3,185 行** import `@langchain/langgraph-sdk`(11)或 `ai`(1)但不 import react,被误算进 Tier 1 → **逐字节 10,400 → 7,215 行**,且 `core-provenance.test.ts` **第一天报 13 个红**。与 i18n/lucide-react 那次**同一根因**(按 `from "react"` 量),只是 D21/D22/D23 之后没重跑。见 11 号 §3.1.4 |
| 🔄 **D11-a** | **修订 D11:上 GitHub CI** | 实测 `.github/workflows/` **14 个 workflow 全部按 `paths:` 过滤** → 新建 `frontend-vue-verify.yml`(`paths: frontend-vue/**`)**零修改现有文件、不触发任何现有流水线**,与 D10 同构。25 UI spec + guards + contract 全变成 CI 强制执行,**R14 从「中高/高」→「低/中」**(4 个真后端 spec 仍需人工)。✅ 🔴 **2026-07-31 用户定案「上」**,**O19 关闭**。见 11 号 §3.2.4 |
| **D16** | **O5:团队有 Vue+Nuxt 实战经验** | ✅ 按基准口径,**54 周 / 13.5 人月的尾部情景消除**。⚠️ 区间仍 **27–48 周**,但跨度只剩两个**已识别且各有处置**的项:D15 的 `+3–6`(待 P2 校准)与 resizable no-go 的 `+2–3`(D19 已预授权)。**两项都在 P0–P2 见分晓 → 开工约两个月后可收敛到可承诺的数** |
| **D17** | **O6:全盘接受 §1.3 五条约束** | ✅ 进开发规范 + PR 模板。**其中四条可机械化**(testid 集合 / 禁 `<div @click>` / 路由表 / cookie 名)→ 做成 `tests/guards/` 进快门禁,同时缓解风险 R9、R14 |
| **D18** | ✅ **O17:`autoOpen` 切 thread 重置为 `true`**(**已与上游对齐**) | 🔄 **2026-07-31 复核后理由反转**:合入 main `0d8e11ad` 后,React 版新增 pathname 水合 effect,`artifacts/context.tsx:98` 会把 `autoOpen` 设回 `true` → **跨 thread 粘滞在上游已消失,这不再是"有意不同"**。<br>✅ **实测仍 0 处 spec 改动** —— 25 个 spec 之间用整页 `page.goto()`(全量重载)。<br>🔄 **原「必须登记进已知对标差异」作废**:反过来,Vue 侧若**不**重置才是缺陷,R18 逐屏 diff 应按"对齐"判定 |
| **D19** | **O11:预授权 resizable 自研 2–3 周** | P0 若 no-go **直接开工,不等第二轮审批**。resizable 承载 08 号 §8.3 的 5 条布局红线(红线 `P1–P5`)+ #4465,是 P5 硬前提;审批若落关键路径,代价高于预算本身。该 2–3 周**已含在上界内**,非额外追加 |
| **D15** | 🔴 **弃用 Tailwind,改用 SCSS** | ❌ Vue 版**不用 Tailwind CSS 4**,样式一律 SCSS(SFC `<style lang="scss" scoped>` + 共享 token/mixin)。React 版一行不动(D7)。<br>🔴 **115 个 CSS 自定义属性必须保留** —— SCSS 变量是编译期的,做不了运行时暗色切换,而暗色有 E2E 断言不能砍。**SCSS 管写法,CSS 变量管运行时 token**。<br>**E2E 只受影响 2 处**(`chat.spec.ts:481/500`)。**不移植** `tailwind-merge`/`clsx`/`cva`。**加 stylelint**。<br>🔴 **代价 +3–6 周,口径变为 ≈7–12 人月**。详见 11 号 **§2.4** |

### D5 + D8 的边界(极易误解,务必守住)
- ✅ **去掉(D5)**:全部 **15 种 `aria-*`,共 136 处**(D6 裁剪后实测)——
  `aria-label` 48 / `aria-hidden` 25 / `aria-invalid` 24 / `aria-describedby` 9 /
  `aria-disabled` 7 / `aria-live` 6 / `aria-pressed` 4 / `aria-labelledby` 3 / 其余 7 种共 10
- ✅ **去掉(D8)**:`sr-only` 视觉隐藏文本 **24 处**(`<span>`、`<SheetHeader>`、`<DialogTitle>` 三种形态)
- ❌ **不要动**:继续用 `<button>` `<a>` `<input>` `<h1-6>` 语义化标签,继续用 antdv 组件
- 一句话规范:**「不写 `aria-*`、不写 `sr-only`,但该用 `<button>` 的地方就用 `<button>`。」**
- 若误改成 `<div @click>`,会废掉 **83/122** 次 `getByRole` 断言,还得自补 `tabindex`/回车空格/禁用态
- ⚠️ **别混淆两件事**:83 次的 **role** 来自原生标签(D5/D8 不影响);
  只有其中 **4 次的 `{ name }`** 靠 `aria-label`/`sr-only`,需改 testid

### D6 砍掉的 6 项
| 项 | 行数 |
| --- | --- |
| landing 落地页组件 | 1,628 |
| workspace 零引用特效件(`magic-bento` 930 / `galaxy` 366 / `terminal` 257 / `flickering-grid` 202 / `number-ticker` 67 / `spotlight-card` 82) | 1,904 |
| blog(`app/blog` + `core/blog`) | 632 |
| docs 站(`app/[lang]/docs` + `components/docs` + Nextra) | 188 + 72 MDX |
| 静态站点 demo 模式 | 101 |
| **Mock 演示模式**(`app/mock/api/`,唯一入口是已砍的 landing) | 472 |

**D6 明确保留**:移动端适配、暗色主题、i18n 双语、第 3 类全部 10 项可选特性(3,211 行)。

> ⚠️ **两个 "mock" 千万别搞混**
> - ❌ D6 砍掉:`frontend/src/app/mock/api/`(472 行)—— 官网案例演示模式
> - ✅ **必须复制保留**:`frontend/tests/e2e/utils/mock-api.ts`(1,411 行)—— Playwright `page.route()` 模拟后端,**方案核心资产**

### D7 的范围(逐字执行)
```
✅ 可改:frontend-vue/               ← 交付物
✅ 可建:新顶层目录(D10),如 docker-vue/  ← 新目录内怎么改都行
🔒 禁改:frontend/  backend/  docker/  .github/
        Makefile  pnpm-workspace.yaml  以及根目录其它一切**已有文件**
        (D10:确需改动须先说明为何无新建目录替代方案,逐次获批)
🔒 禁建:packages/
```

---

## 三、产出物清单

全部在 `frontend-refactor-docs/`(约 3,000 行):

| 文件 | 内容 |
| --- | --- |
| [README.md](README.md) | 索引 |
| [01-system-overview.md](01-system-overview.md) | 服务拓扑、两条请求通道、四种运行模式、SSE 基础设施约束 |
| [02-frontend-layers.md](02-frontend-layers.md) | 技术栈、五层结构、依赖方向、ESLint 强制项 |
| [03-routing-and-pages.md](03-routing-and-pages.md) | 路由表、11 层 Provider 树、SSR 鉴权五态、thread id 生命周期 |
| [04-state-and-data-flow.md](04-state-and-data-flow.md) | 五套状态载体、Query key 约定、完整数据流 |
| [05-streaming-pipeline.md](05-streaming-pipeline.md) | **最长(370 行)**:SDK 四个包装、gap 恢复、历史合并、消息分组、子任务、human-input 协议 |
| [06-backend-api-contract.md](06-backend-api-contract.md) | CSRF 双通道、40+ 接口全表、错误语义 |
| [07-core-modules.md](07-core-modules.md) | 36 个 `core/*` 模块清单 |
| [08-components-and-ui.md](08-components-and-ui.md) | 三类组件、**右面板 5 条布局约束**、样式约定 |
| [09-tooling-and-quality.md](09-tooling-and-quality.md) | 命令、Rstest 双环境、四套 Playwright 配置、环境变量 |
| [10-refactor-hotspots.md](10-refactor-hotspots.md) | 热点排序、🔴 **44 条红线不变量**(v3 逐行核实;⚠️ 旧文写 37,是错的 —— 该文档自己从未声明总数)、回归护栏映射 |
| [11-vue-parity-plan.md](11-vue-parity-plan.md) | **Vue 化方案(约 1,010 行)** —— 主文档 |
| HANDOFF.md | 本篇 |
| *(外部)* `nuxtProjects/nuxt-modern-starter/FIX-PLAN.md` | 参照工程的修复计划与执行结果 —— **不属于本项目**,仅在需要追溯 §6.13 结论时查 |

**11 号是主文档**,结构:
```
§0   目标边界 + 决策记录(D1-D14)+ §0.5 D9 的可执行证明
🔴 §1.0 **总表:哪些能复用、哪些必须重写** ★★ **实现前先看这张**(v3 新增)
     🔴 v4 四档:①逐字节 15,832 行 ②改几行 6,453 行 ③重写 29,680 行+3 自研件 ④不做 7,025 行
     (v3 为 ①19,017 ②3,268;总量 22,285 不变,DETYPED 3,185 行从①移到②)
§1   核心策略:以 E2E 套件作为可执行规格 ★方案骨架
     🔴 §1.2 验收定义(D14 分两层)/ §1.2.1 为什么 25 spec 看不见代理层
§2   技术选型 / §2.3 antdv 影响分析 / 🔴 §2.3.1.1 组件存活口径(唯一权威计数)/
     🔴 §2.4 弃 Tailwind 改 SCSS 的影响分析(D15,含 E2E 只受影响 2 处的核对)/
     §2.5 范围裁剪(D6)/ §2.6 零引用清理(D9)/ §2.7 可参照实现
§3   目标架构 / §3.1 core 复制(含 hooks.ts 标注更正)/
     🔴 §3.1.2 core-provenance 两层校验(D12+D13)/ 🔴 §3.1.3 threads/hooks.ts 拆分规格 /
     §3.2 目录结构最终版(7 条关键约束)/ §3.2.2 docker-vue / §3.2.3 make verify + verify-full
§4   🔴 三个自研基础件设计 ★成败关键(v4:§4.4 已由 D24-a 移出;§4.1.5 为 v4 新增的 Message 类型模型;§4.2.5 为 v4 新增的 jsx-runtime 实测更正)
§5   🔴 44 条红线的移植分类(A 3 / B 12 / C 29)★技术含量最高
     §5.2 B 类 12 条的 PR 验证清单(6 条可机械化 + 6 条人工,含可复制的 PR 模板)
§6   分期计划 P0–P6(P0 含「建议执行顺序」/ P1 已按 D13 上调至 1–2 周)
§7   工作量估算(含 6 条口径修正记录)
§8   风险登记册(新增 R16 Nitro-SSE / R17 拆分漂移)
§9   开放项(§9.1 已决 / §9.2 仍待决)
§10  我的判断
```

---

## 四、✅ 无阻塞项(O14 已于 2026-07-30 关闭)

**原来唯一的阻塞项 O14 已拆解并全部解决,现在可以直接开工 P0。**

| | 原问题 | 结论 |
| --- | --- | --- |
| **O14b** 生产暴露 | Vue 版如何让公司同事访问?(`docker/nginx/nginx.conf` 禁改) | ✅ **D10** —— 新建 `docker-vue/`,**零修改任何现有文件**。`:2026` React 版 / `:2027` Vue 版并存,打同一个后端(11 号 §3.2.2) |
| **O14a** CI 门禁 | Vitest / Playwright 如何进流水线?(`.github/` 禁改) | ✅ **D11** —— **不做 GitHub CI**。改用 `frontend-vue/Makefile` 的 `make verify` + PR 贴输出(11 号 §3.2.3)。代价见风险 **R14** |

> 🔴 **我此前把 O14 标成「阻塞 P0」是错的。** 逐项对过 P0 那 8 项交付,
> 没有一项需要 nginx 或 CI —— 全部能在开发机上用 `pnpm dev`(:3001)+ `make dev` 起的
> Gateway:8001 完成。**O14 真正的时点是 P6 验收(CI)和上线(暴露),不是 P0。**

### `docker-vue/` 的形态(注意:**不要 nginx**)

Nitro `routeRules` 已经把 `/api/**` 代理到 Gateway,前面再放 nginx 只是透传 →
**只需 1 个服务,不复制任何 nginx conf**:

```
浏览器 → :2027 ──▶ frontend-vue:3000 (Nuxt/Nitro)
                      └─ routeRules: /api/** → gateway:8001
```

四个实测约束(决定了这个形态):
1. **Gateway 不发布端口到主机** —— 只有 nginx 有 `ports`。所以 `docker-vue/` **必须加入主栈的 Docker 网络**,没有 `host.docker.internal` 兜底
2. **网络名 dev/prod 不同** —— prod `deer-flow_deer-flow`;dev `deer-flow-dev_deer-flow-dev`(实测当前在跑的是后者)→ **必须参数化**,用 `${DEER_FLOW_NETWORK}`
3. **根 `.dockerignore` 不排除 `frontend-vue/`** —— 构建上下文可用 `../`
4. **`nginx.conf` 无 `include`** —— 挂进 `:2026` 只能改文件,所以走独立端口

⚠️ **责任转移(P0 必做)**:去掉 nginx 后,这三项从 nginx 落到 Nitro,漏做后果严重 ——
① SSE 不得缓冲(`proxy_buffering off` / `X-Accel-Buffering no`),漏了流式体验直接废;
② 长连接超时 ≥120s,漏了长 run 被掐断;
③ `X-Forwarded-Proto` 透传,漏了 Gateway 把 HTTPS 当 HTTP → **登录 POST 返回 403**。
(风险 **R15**;并入 §3.2.1 的 `proxy-policy` 契约一起验)

### §9.2 仍待决项(均不阻塞开工)
| # | 内容 | 何时定 |
| --- | --- | --- |
| **O15** | v2 是否重评共享包方案 | v1 上线后 |

---

## 五、下一步行动(**待用户下令后再执行**)

🔴 **方案已按 D1–D26 + 五项修订(D4-a/D4-b/D11-a/D13-a/D24-a/D25-a)定稿到 v4**,
**O18/O19 已由用户拍定,无待决项、无阻塞项 —— 可以开 P0**。
但 🔴 **不要自行开始**:本节是「用户说开始时该做什么」的清单,不是「现在就去做」。

**P0 的关键交付**(11 号 §6;⑨⑩⑪ 为 D14 新增,⑬ 为 D22 新增),其中 ⑤ 已提前完成:

| # | 项 | 备注 |
| --- | --- | --- |
| ① | 选型核实报告 | ⚠️ **大部分已由 §6.13 闭合**(Nuxt 4.4.8 + antdv 4.2.6 + `@ant-design-vue/nuxt` 1.4.6 + Pinia 3.0.4 + vue-i18n 11.4.6 实跑通过,FOUC 已解)。D24 后**不做 `@tanstack/vue-query` 客户端插件 smoke**,改做 server-state contract fixture |
| ② | Nuxt 骨架 + 独立起服务 + Nitro 代理 | 🔴 含 **R15 的三项责任转移**(SSE 不缓冲 / 长超时 / `X-Forwarded-Proto`)+ §3.2.1 的 `proxy-policy` 契约 |
| ③ | 🔴 **Nitro 鉴权中间件五态 + CSRF 双提交** | 五态定义见 03 号文档;D20 后首跳鉴权由 `server/middleware/auth.ts` 承担 |
| ④ | `core/` 复制 + 🔴 **六类偏离**可行性验证(v4:原五类) | **13,486** 行,🔴 **其中 7,215 行**逐字节零改动(v4 更正,旧写 10,400)、**3,086 行** i18n 改 icon import、🔴 **3,185 行 / 12 个文件** 改类型 import。<br>⚠️ **不是「3 处适配」** —— 实测为 ADAPTED 3 / **DEMOCKED 4**(`isMock`)/ **SPLIT 1**(`threads/hooks.ts`)/ 🔴 **DETYPED 13**(D13-a)/ ADDED / REMOVED |
| ⑤ | ~~`ai-elements` 使用面盘点~~ | ✅ **D9 已完成**(28→14 个),不必重做 |
| ⑥ | 🔴 **`resizable` 候选库调研 + 最小 demo** | **go/no-go 硬检查点**:必须能区分「拖拽中 resize」与「最终布局变更」两类事件,否则红线 P5 无法实现、#4465 类 bug 必然重现。不达标须走 O11 |
| ⑦ | antdv 的 14 个原语 role 实测 | 重点是 38 次风险断言,尤其 **12 次 `getByRole("dialog", { name })` 是否靠 `a-modal` 内部把 title 接成 accessible name**(R13)——D5/D8 后我们不写任何 `aria-*` |
| ⑧ | 主题桥接 PoC(CSS 变量 → antdv token + 暗色切换) | 暗色主题**不能砍**:`ui-polish-mobile.spec.ts:49` 有断言 |
| **⑨** | 🔴 **`tests/contract/proxy-policy.test.ts`**(**D14** 新增,约 120 行) | 6 条断言覆盖 R15 三项 + `proxy-policy` 契约四项。⚠️ **SSE 那条必须按帧的到达时刻断言** —— 只断言"最终收到 5 帧"在缓冲下也会通过(11 号 §1.2.1) |
| **⑩** | `playwright.real-backend.config.ts` + 复制 4 个真后端 spec | `e2e-real-backend`(3)+ `e2e-auth`(1),**实测共 4 个**。D14 后升为一等验收物 |
| **⑪** | `make verify` / `verify-full` **两级**门禁骨架 + pre-push 钩子 | 🔴 pre-push 必须挂**快的那个** —— 把 123 个 E2E 挂上去等于逼人 `--no-verify` |
| **⑬** | 🔴 **D22 stream contract fixture** | 手写 `fetch-sse` / wire codec / DeerFlow Gateway adapter 的最小 fixture。覆盖 `Content-Location`、`Last-Event-ID`、`metadata/messages/values/custom/gap/end`、heartbeat、409 分支;再加一个非 LangGraph 形态 fixture,证明 canonical reducer 不依赖后端框架 |
| ~~**⑭**~~ | ~~🔴 D24 server-state contract fixture~~ → ❌ **v4 取消**(D24-a) | 改为 **`VueQueryPlugin` smoke(2 小时)**:插件注册 + 一个 query 跑通 + 🔴 **`enabled` 传响应式 ref 时会正确重新启用**(48 处使用面,React→Vue 最常见的静默 bug) |
| 🔴 **⑮** | **`hast-util-to-jsx-runtime` + `vue/jsx-runtime` 实验**(v4 新增) | 半天,二元。成立则 **P4 的 5–8 周上界显著下修**。见 11 号 §4.2.5 |
| 🔴 **⑯** | **非 `localhost` 内网地址冒烟**(v4 新增) | 10 分钟。唯一能抓到 `crypto.randomUUID` secure-context 的检查(11 号 §2.4.6) |
| 🔴 **⑰** | **`.github/workflows/frontend-vue-verify.yml` 落盘**(v4 新增,D11-a) | 1 小时。`paths: frontend-vue/**`,零修改现有文件。⚠️ **必须完整 checkout** —— `core-provenance.test.ts` 要读 `frontend/src`(11 号 §3.2.4) |
| 🔴 **⑱** | **规格空白清单 `tests/SPEC-GAPS.md`**(v4 新增,**风险 R21**) | **半天**。实测 ≈ **2,122 行**产品功能**零验收判据**:6 个设置页 **1,604**(🔴 `memory` **993** / appearance 196 / account 171 / skill 147 / tool 88 / about 9)+ `/workspace/agents/new` **455** + `/auth/callback` **63**;另 `login` 370 + `setup` 349 = **719 行**只有需真 Gateway 的第二层覆盖。<br>逐条定 **A 补 spec / B 人工签字 / C 接受漂移**,🔴 **每条必须有结论,不允许留空**。<br>🔴 **`memory` 与 `agents/new` 都是 §6 P2 点名的交付物,建议走 A**(各 0.5–1 天,可直接复用 `mock-api.ts`)。见 11 号 **§1.2.2** |
| 🔴 **⑲** | **27 个非 core 单测定去留**(v4 新增) | **1 小时**。实测 `tests/unit/` 共 **99** = core **72** + 非 core **27**(其中 **5 个**硬依赖 `@testing-library/react`,确定要重写)。<br>⚠️ 方案此前只写「71 个 core 单测迁 Vitest」:① **实测是 72**(§十⑥ 自己记的就是 72,正文写 71,v4 已统一);② 那 **27 个全文零归属** —— 而 P1 的验收判据正是"core 的 N 个单测全绿"。见 11 号 **§1.2.3** |

**同时要建的三样**(D10/D11/D12+D13 的产物):
- `frontend-vue/Makefile` 的 **`make verify`(快:lint+typecheck+vitest+guards+contract,秒级)**
  与 **`make verify-full`(慢:加两层 E2E)**,**失败必须非零退出**
- `docker-vue/docker-compose.yaml`(1 个服务,见 §四)
- 🔴 `frontend-vue/tests/guards/core-provenance.test.ts`(**D12+D13**,约 **180 行**,方案 §3.1.2)
  —— Tier 1 文件哈希 + **Tier 2 导出级比对** + 完备性检查。**P1 交付项 ⑥,不要漏**
  ⚠️ **路径是 `tests/guards/`,不是 `tests/unit/guards/`**

### 🔴 建议的起手项:先做六个「便宜、二元、失败即改架构」的实验,**不要先搭骨架**

判据统一:**成本小时到天级、结论是二元的、失败会改变架构**。六件都满足,骨架都不满足。
🔴 **v4 重排,总计约 3.5–4.5 天。**

| 顺序 | 实验 | 成本 | 失败的后果 |
| --- | --- | --- | --- |
| **0** | ✅ **前置已完成** | — | D26 已定案 (b)、基线已重冻至 **`b71a892b`**(D4-b)。⚠️ **P0 期间每次 merge upstream 后仍要跑** `git diff b71a892b..HEAD --stat -- frontend/`,**非空即按 §2.10.5 第 3 条处理** |
| **1** | 🔴 **D22 stream contract fixture** | **1 天** | 若手写 transport/codec/adapter 不能还原当前 Gateway 语义,§4.1 需先改架构 |
| ~~2~~ | ~~D24 server-state contract fixture~~ → ❌ **v4 取消**(D24-a)<br>改为 **`VueQueryPlugin` smoke** | **2 小时** | 只需验插件注册 + 一个 query 跑通 + 🔴 **`enabled` 传响应式 ref 时会正确重新启用**(48 处使用面,React→Vue 最常见的静默 bug) |
| **3** | 🔴 **⑥ resizable 判定** | 🔻 **半天**(原 1–2 天) | 红线 P5 无法实现 → 走 **D19** 追加 2–3 周自研。<br>✅ **v4 已答掉最硬的一条**:`splitpanes@4.1.2` 实测已 emit `resize`+`resized`;**只剩验命令式开合 + minSize 折叠 + group 级过渡** |
| **4** | 🔴 **SSE 能否不缓冲地穿过 Nitro `routeRules` proxy**(风险 **R16**) | **1 小时** | `docker-vue/` 的单服务形态与 §3.2.1 代理设计都要改成自写 h3 handler(仍不需要 nginx,但 P0 ② 内容变了) |
| **5** | 🔴 **Nitro 鉴权中间件 PoC** | **半天** | D20 唯一新增架构风险:必须证明能在返回 HTML 前读 cookie 并 302,避免未登录先看到产品区 app shell |
| 🔴 **6** | 🔴 **`hast-util-to-jsx-runtime` + `vue/jsx-runtime`**(**v4 新增**) | **半天** | 实测该包 peer 为 `null`、依赖无 react,而 `vue` 导出 `./jsx-runtime`。判据二元:① 渲染结构正确 ② **追加内容时已有节点不重挂载**。<br>**成立 → P4 的 5–8 周上界显著下修**(全案最贵一段);不成立 → 回 §4.2.2 自研,代价只有这半天 |

🔴 **另加一条 10 分钟的冒烟(不是实验,但必做)**:
**用非 `localhost` 的内网地址打开一次,确认新建会话可用** ——
这是唯一能抓到 D25-a ①(`crypto.randomUUID` secure-context)的检查,
**开发机上永远复现不了,25 个 E2E 也抓不到**(Playwright 默认跑 localhost)。

**为什么不先搭骨架**:骨架谁都能搭,且 ① / ⑧ 已有 §6.13 的可参照实现(实跑全绿),风险低。
而上面五件若结论很差,此时止损代价接近零 —— **沉没成本最低的时点就是现在。**

**⑥ 的做法**(别一上来就写 demo):判据是二元的 —— 候选库有没有把「拖拽中 resize」
与「最终布局变更」分成两类事件、有没有命令式 `collapse()`/`resize()`。
**先读候选库的 `.d.ts` 与 changelog 就能筛掉大半**,剩 1–2 个再写最小 demo,
验证 08 号 §8.3 的**五条布局红线**:三面板共用一个 group、命令式开合、
过渡加在 group 上、动画期间内容锁宽裁剪、`0%` 只认最终布局事件(不认拖拽中帧)。

**④⑤ 的做法**:各起一个最小 Nuxt 实例即可。④的假上游每 200ms 吐一帧共 5 帧,
**断言首帧到达时间 < 400ms** —— 缓冲状态下 5 帧会同时到达、首帧 ≈1s。
这段代码可直接长成 P0 ⑨ 的 `proxy-policy.test.ts` 第 5 条断言,不浪费。

---

## 六、新会话必须知道的关键事实

以下都是**实测数据**,不是估算。避免重新推导。

### 6.1 规模基线
| 项 | 数值 |
| --- | --- |
| `frontend/src` 总行数 | 56,355 |
| `core/` 非测试文件合计 | **143 个 / 19,001 行**(= 13,668 + 5,333,**分毫不差**) |
| `core/` 纯 TS(**无 React 依赖**) | **13,668**(含 i18n 词典 3,086)<br>🔴 **v4 更正**= **7,215**(逐字节)+ **3,086**(i18n 改 icon)+ **3,185**(**DETYPED**,12 个文件改类型 import)+ **182**(3 处适配)<br>⚠️ **旧写「10,400 逐字节」已作废** —— 那 3,185 行 import 了 D21/D22 要删的包,哈希必不等。见 11 号 §3.1.4 |
| 🔴 **上游演进速度**(v4 新增,D26 的依据) | `frontend/src` 月新增行(2026-02→07):`4,935 / 6,326 / 14,653 / 4,023 / 6,657 / 22,815`,**中位数 ≈6,500,均值 ≈9,900**;提交 36–114/月<br>🔴 **近 6 个月被改动过的唯一文件 453 个,现存总文件 389 个 → 文件级 100% 翻动**<br>当前 `frontend/src` = **56,484 行**(方案写 56,355,差在统计时点/扩展名集合) |
| 🔴 **依赖健康度抽查**(v4 新增) | `ant-design-vue` **4.2.6 @ 2024-11-11(20 个月无新版,latest 就是它)** → **R20**<br>`@vueuse/core` 14.4.0 @ **2026-07-29**;`splitpanes` 4.1.2 @ **2026-05-26**;`@tanstack/vue-query` **5.101.4**(跟随 query-core);`eslint` **10.8.0**;`vitest` **4.1.10**;`nuxt` **4.5.1**(方案锁 4.4.8) |
| `core/` React 耦合 | **24 个文件 / 5,333 行** = `threads/hooks.ts` 3,072 + 16 个薄 hooks.ts 1,090 + 其余 7 个 1,171 |
| `core/**/hooks.ts` 实测 | 🔴 **17 个 / 4,162 行** —— ⚠️ 旧文写「24 个薄文件 2,251 行」是**两个集合混用**(24 = React 耦合文件数;2,251 = React 耦合行数减 `threads/hooks.ts`)。见 11 号 §3.1 |
| 🔴 `threads/hooks.ts` 构成 | **3,072 行 / 53 个 `export`** = 49 函数常量 + 4 类型;其中 **仅 13 个是 `use*` hook**,另 **40 个是非 hook 导出**(36 纯函数常量 + 4 类型),且**与 hook 交错分布** → **D13 拆分规格见 11 号 §3.1.3** |
| `components/workspace` | 20,286 |
| `components/ui`(44 个,含 3 个 .css → 41 组件) / `ai-elements`(28 个)| 5,318 / 5,374<br>**D9 后:antdv 需映射 14 个;ai-elements 实需 14 个 / 3,714 行** |
| `app/` 路由 | 4,118 |
| 单测 | 🔴 **99 个文件 = core 72 + 非 core 27**(v4 实测更正,旧写「97(core 71 / components 21 / hooks 2 / content 1)」)<br>其中 **5 个**硬依赖 `@testing-library/react`(确定迁不了);**27 个非 core 在方案里此前零归属** → **P0 ⑲ 定去留**(11 号 §1.2.3)<br>复现:`find frontend/tests/unit -name "*.test.*" \| wc -l` / `... -not -path "*/core/*" \| wc -l` |
| E2E | `tests/e2e/` 27 spec / 7,334 行 + `mock-api.ts` 1,411 行<br>另有 `e2e-auth`(1)/`e2e-real-backend`(3)/`e2e-record`(1),**全仓 31 个** |
| `isMock` 出现次数 | **102 处 / 15 个文件**(D6 全链路清除面) |
| `NEXT_PUBLIC_STATIC_WEBSITE_ONLY` | **35 处 / 17 个文件** |
| **D6 后需重写** | **≈ 31,780 行**;**D9 再减 2,100 → ≈ 29,680** |
| **工期估算** | 🔴 **对外只报:≈ 7–12 人月,3 人 5–7.5 个月**(**v3 已含 D15,口径变了,别再引用旧的 6–10**)<br>推导值 **27–48 周**。演进:v1 `24–41` → v2 `24–42`(净效果≈0)→ **v3 `27–48`(D15 +3–6 周)**<br>**别报到周** —— 区间宽 21 周,**上界比下界高 78%**<br>✅ **O5 已由 D16 定为团队有 Vue+Nuxt 经验**,经验不足尾部情景已消除。剩余最大不确定源是 **D15 的 +3–6 周**(非实测,建议 P2 前 3 页后回推)与 resizable no-go 是否触发 D19 自研预算 |

### 6.2 可继承资产(≈22,400 行,占工作面 43%)
1. `tests/e2e/utils/mock-api.ts` **1,411 行** —— 完整模拟后端,入口 `mockLangGraphAPI(page, options)` + `handleRunStream()`。纯 Playwright+TS,零 React
2. **25 个 E2E spec**(原 27 减去 D6 砍掉的 `landing`、`docs-localized-links`)—— 全黑盒
3. `core/` 纯 TS **13,668 行**

### 🔴 6.3.0 验收骨架的覆盖边界(v4 新增,风险 R21)—— **接手必读**

> **继承的 25 个 spec 覆盖的是「React 版历史上出过 bug 的地方」,不是功能全集。**
> §6.2 说「继承资产占工作面 43%」,那是**行数口径**;判据口径要小得多。

| | 行数 | 状态 |
| --- | ---: | --- |
| 🔴 **完全无验收判据** | **≈ 2,122** | 6 个设置页 **1,604**(🔴 `memory` **993**)+ `/workspace/agents/new` **455** + `/auth/callback` **63** |
| ⚠️ 仅第二层覆盖(需真 Gateway) | **719** | `login` 370 + `setup` 349 |

🔴 **`memory`(993)与 `agents/new`(455)都是 §6 P2 点名的交付物,却没有任何判据。**

复现:

```bash
cd frontend && grep -rhoE "goto\(\s*[\"\`'][^\"\`']*" tests/e2e/*.spec.ts | sed -E 's/.*["\`'"'"']//' | sed -E 's/\?.*//' | sort -u
```

**处置**:P0 ⑱ 产出 `frontend-vue/tests/SPEC-GAPS.md`,逐条定 A/B/C;P6 验收第 ④ 项按它销账。
🔴 **R21 比 R18 更重** —— R18 是"实现了但长得不一样",R21 是"**可能压根没实现**",**两者都逃得过三层验收全绿**。

### 6.3 验收定义(方案骨架)—— 🔴 **D14 后分两层**
> **① UI 层:25 个 E2E spec 全绿**
> **② 代理层:`proxy-policy.test.ts` 6 条断言 + 4 个真后端 spec 全绿**
> **两层都绿 = 对标完成。**

做法:`playwright.config.ts` 已支持 `PLAYWRIGHT_BASE_URL` + `PLAYWRIGHT_SKIP_WEB_SERVER=1`
→ 新建 `frontend-vue/playwright.vue.config.ts` 指向 :3001。spec **复制**一份到
`frontend-vue/tests/e2e/`(不是符号链接,因 D7 禁改 `frontend/`)。

#### 🔴 为什么必须有第二层(D14 的由来,极易被忽略)

**25 个 spec 的假后端走的是 Playwright `page.route()` —— 请求在浏览器层就被拦截了,
根本不会离开浏览器,更不会经过 Nitro 代理。**

而 D10 决定「不要 nginx」之后,原本 nginx 承担的责任全部转移到了 Nitro 那一层:
SSE 不缓冲、长连接超时 ≥120s、`X-Forwarded-Proto` 透传(R15 三项),
外加 `proxy-policy` 契约的路径白名单 / 剥 12 个请求头 / 剥 8 个响应头 / 强制 CSRF。

> **这几项没有任何一条能被那 25 个 spec 看见。**
> 靠「24 全绿」签字上线 = 全案最新、最无外部参照、失败后果最严重的一层**零验证**。

第二层的两个验收物:`tests/contract/proxy-policy.test.ts`(6 条断言,只需 Nitro + 假上游,
**秒级,进快门禁**)+ `e2e-real-backend`(3)/`e2e-auth`(1)共 **4 个真后端 spec**。
详见 11 号 **§1.2.1**。

**§1.3 五条前提约束**(打破任一条,继承资产就贬值):
1. URL 结构完全一致
2. `data-testid` 完全一致(源码 46 处传递,E2E 81 处使用)
3. 继续用语义化标签(**不要求写 `aria-*`(D5)、不要求写 `sr-only`(D8)**)
4. 可见文案一致(靠 i18n 词典原样复用)
5. cookie 名与语义一致(`locale`、`sidebar_state`)

### 6.4 E2E 选择器分布(决定 antdv 风险面)
| 方式 | 次数 |
| --- | --- |
| `getByText` | 207(英文 197 / 中文 2) |
| `getByRole` | 122 |
| `page.route` | 120 |
| `locator(...)` | 113 |
| `getByTestId` | 81 |

`getByRole` 的 role 分布:`button` 64、`dialog` 13、`link` 11、`option` 10、
`menuitem` 9、`textbox` 5、`tooltip` 4、`heading` 3、`combobox` 2、`switch` 1。
→ **83 次(button/link/textbox/heading)落在原生 HTML 标签上,天然对齐**;
有风险的 38 次(dialog/option/menuitem/tooltip/combobox)需 P0 逐一实测 antdv。

### 6.5 D5 + D8 + D15 的实际代价:**7 处调用 / 4 个 spec**(已全量核对,没有第 8 处)
24 处 `sr-only` 的每一条文本、以及 E2E 全部 8 处 class 选择器,都在 32 个 spec 里搜过。完整清单:

| # | spec | 行 | 断言 | name 来源 | 触发者 |
| --- | --- | --- | --- | --- | --- |
| 1 | `agent-chat.spec.ts` | 167 | `name: "Regenerate"` | `message-list.tsx:877` `aria-label` | **D5** |
| 2 | `agent-chat.spec.ts` | 305 | `name: "Edit and rerun"` | `message-list-item.tsx:246` `aria-label` | **D5** |
| 3–4 | `thread-list-pin.spec.ts` | 47, 55 | `name: "More"` | `recent-chat-list.tsx:317` sr-only span | **D8** |
| 5 | `ui-polish-mobile.spec.ts` | 41 | `getByRole("dialog", { name: /artifacts/i })` | `chat-box.tsx:375` sr-only `SheetTitle` | **D8** |
| **6–7** | `chat.spec.ts` | **481, 500** | `locator("span.font-medium", …)` | `font-medium` 是 **Tailwind 工具类**,SCSS 下不存在 | 🔴 **D15** |

全部改 `getByTestId`。`aria-live` / `role="status"` / `aria-hidden` **E2E 零断言**。

✅ **D15 的两处易误判排除**:E2E 里按 class 选元素共 **8 处**,除上面 2 处外 ——
`a.nextra-card`(×2)在 **D6 已砍**的 `docs-localized-links.spec.ts` 里,不在 24 个对标目标内;
`.is-user` / `.is-user .katex`(×4)是 `message.tsx:32` 显式写的**语义类**(`.katex` 来自 KaTeX),
**与样式方案无关,SCSS 下照样保留**。
其余 sr-only 文本零引用可直接删:`Close` `Remove` `Sidebar` `Toggle Sidebar` `Toggle plan`
`Previous/Next slide` `humanInput.otherLabel` `sidebar.agentsDisabledTooltip`。

✅ **一处易误判的排除**:`agents-feature-disabled.spec.ts` 断言
`/contact your administrator|联系管理员/`,**不会**命中 `workspace-nav-chat-list.tsx:67` 的
sr-only span —— 后者文案是 `"Feature not enabled"`,正则不匹配。该 spec 不受影响。

📌 **D8 的连带效应**:
1. **消掉一个 P0 能力要求**:原本需 antdv `a-modal` 支持"视觉隐藏但有 name 的标题",
   砍掉隐藏标题后不再需要(风险 R12 消除)
2. **但剩下 12 次 `getByRole("dialog", { name })` 变成硬实测项(风险 R13)**:
   我们自己不写任何 `aria-*` 后,这 12 次的 name 完全依赖 **`a-modal` 内部**
   是否把 title 接成 accessible name → **P0 ⑦ 必测**
3. **`AuroraText` 变简单**:现状同一文本在 DOM 出现两次(sr-only + `aria-hidden` 渐变层),
   D5+D8 后只剩一个 span,顺带消掉一处 `getByText` 二义性
   (`aurora-text` 在 D6 后仍存活,`workspace/welcome.tsx:55` 在用)

### 6.6 ⚠️ i18n 是反直觉陷阱
即便公司只用中文,**也不能砍 `en-US` 词典**:`playwright.config.ts:17` 固定
`locale: "en-US"`,197 处 `getByText` 断言英文文案。砍掉会废掉近 200 处断言。
D6 已决定保留双语。

### 6.7 🔴 **三个**必须自研的基础件(v4:原 4 个,`ServerStateClient` 已由 D24-a 移出)
| 件 | 说明 | 估算 |
| --- | --- | --- |
| **`ThreadStreamEngine`** | 🔴 **D22 后不装 `@langchain/langgraph-sdk`**。需手写 fetch/SSE transport、DeerFlow Gateway wire codec、adapter、canonical reducer,再把现有 1,060 行 DeerFlow 编排语义收进发布订阅状态机。SDK 的 `useStream` 只作为历史参照,不能作为运行时依赖<br>🔴 **v4 追加:`Message` 类型模型 2–3 天,落 P1 不落 P3** —— 实测 SDK 类型渗透 **27 个文件**,`Message` 一个符号占 **19 个**,而 13 个 DETYPED 件要 import 它。见 11 号 §4.1.5 | 4–6 周<br>**+2–3 天(P1)** |
| **`streamdown-vue`** | `streamdown@2.5.0` 硬 React peer。整条 unified 管线(remark/rehype)+ `remend`(残缺修补)+ mermaid **可复用**。<br>🔴 **v4 实测更正**:~~React 专有的有 `hast-util-to-jsx-runtime`~~ —— **它 `peerDependencies` 为 `null`、依赖无 react,是通用 JSX-runtime 库,而 `vue` 导出 `./jsx-runtime`**。**真正 React 专有的只剩 `animated`/`isAnimating` 动画 API**。见 11 号 §4.2.5 | 5–8 周 🔴**最高风险**<br>⚠️ **上界可能显著下修,待 P0 实验 6** |
| **`ai-elements-vue`** | 28 个组件 5,374 行 → **D9 后实需 14 个 / 3,714 行**。✅ 对 Radix 真实依赖为 0 | 含 P5 |
| ~~**`ServerStateClient`**~~ | ❌ **v4 移出 —— D24-a 改装 `@tanstack/vue-query`,不自研**。<br>实测其 peer 仅 `vue ^2.6\|\|^3.3`,零 React 依赖;而 §4.4 是全案唯一没有量级的自研件,却压在 P2 关键路径。见 11 号 §2.8.7 | — |

### 6.8 antdv 覆盖:41 个组件原语只有 15 个相关,**D9 后实需 14 个**
`components/ui/` 44 个文件中 **3 个是 `.css`**,组件文件实为 **41 个**:

| 类别 | 原始 | D6 砍 | D9 砍 | **存活** | antdv 相关性 |
| --- | --- | --- | --- | --- | --- |
| 纯自研/纯样式 | 15 | −6 特效件 | — | **9** | 无关 |
| 仅用 Radix `Slot` | 6 | — | — | **6** | 基本无关(`Slot` 是组合能力,非行为原语) |
| **真 Radix 行为原语** | 15 | — | −1 `avatar` | **14** | ✅ 需映射 antdv |
| 非 Radix 第三方 | 5 | — | −2 `carousel`/`sonner`包装 | **3** | 🔴 `resizable`、🔴 `command`、`confetti-button`(框架无关可直用) |
| `.css` 文件 | 3 | −3 | — | **0** | 随特效件一并砍 |
| **合计** | **44** | **−9** | **−3** | **32** | |

🔴 **自研面 = 9 + 6 = 15 个,不是 21。**「21」是 15 纯自研 + 6 Slot,
**其中那 15 里的 6 个特效件已被 D6 砍掉** —— 方案 v1 在四处沿用了这个 D6 前的数字,v2 已全部更正。

**能力缺口是 4 项,但只有 3 个对应存活文件**(这就是旧文 3/4 两个数并存的原因):
`resizable` / `command` / `confetti-button`(有文件)+ **`toast`**(文件已死但能力活 ——
`sonner` 本地包装零引用,但 10+ 处直连 npm 包且 **E2E 断言其文案**,须用 antdv `message` 顶上)。
→ **存活文件 32 = 14+15+3;能力缺口 4 = 3+toast。两个口径不同,不要相加。**

> ⚠️ 更早一版曾写「13 个」但列了 15 个文件名,且 `confetti-button` 双重计数、
> `carousel` 误归纯自研 —— 那版 16+6+13+4=39 与 44 对不上,已按实读更正。

🔴 **`resizable` 是最大缺口**:它承载 [08-components-and-ui.md](08-components-and-ui.md) §8.3 的**全部 5 条布局约束 + issue #4465**。
所选 Vue 库**必须能区分「拖拽中 resize」与「最终布局变更」**两类事件,否则红线 P5 无法实现。

### 6.9 D7 下的 `core/` 迁移方式 —— 🔴 **不是「仅 3 处适配」,实测是五类偏离**

复制 `frontend/src/core` → `frontend-vue/app/core/`。方案 v1 写「仅 3 处需适配」,
**实测后站不住** —— D6 清 `isMock` 必然改到另外 4 个文件,`threads/hooks.ts` 必然要拆:

| 类 | 文件 | 原因 | 溯源校验 |
| --- | --- | --- | --- |
| **ADAPTED** (3) | `config/index.ts`(`@/env`→`useRuntimeConfig()`,`NEXT_PUBLIC_*`→`NUXT_PUBLIC_*`)<br>`auth/server.ts`(`next/headers`→Nitro `getCookie`,**五态 union + `userSchema` 原样保留**)<br>`i18n/server.ts`(同上,读 `locale` cookie) | Next→Nuxt | **Tier 2** |
| **DEMOCKED** (4) | `api/api-client.ts`(6 处)、`sidecar/api.ts`(3)、`artifacts/utils.ts`(3)、`artifacts/loader.ts`(3) | D6 清 `isMock` | **Tier 2** |
| **SPLIT** (1) | 🔴 `threads/hooks.ts` → `history.ts` / `coalesce.ts` / `cache.ts` / `types.ts` | 40 个非 hook 导出要留,13 个 hook 要重写 | **Tier 2**(按导出名) |
| **ADDED** | `api/stream/`(`engine.ts` / `gap-recovery.ts`) | §4.1 新写;**实测 React 侧无 `api/stream/` 目录** | 不比对,须登记 |
| **REMOVED** | `static-mode.ts`、17 个 `hooks.ts`、D9 的 20 个文件 | D6 / D9 | 只校验确实不存在 |

> ⚠️ **两个来源位置旧文写错了**:`recoverStreamReplayGaps` 实际在 **`api/api-client.ts:236`
> 且未 `export`**(不是独立文件);`decideCoalesce` 在 **`threads/hooks.ts:1012`**
> —— 而那个文件在旧计划里是「不复制」的。两处都会让「原样搬」执行不下去,D13 已安置。

`core/**/hooks.ts` 实测 **17 个 / 4,162 行**(非旧文的 24 个 2,251 行)**不复制**,
在 `app/composables/` 用 🔴 **`@tanstack/vue-query`**(D24-a,原 D24 自研 server-state)重写:16 个薄的 1,080 行【P2】+
`threads/hooks.ts` 拆出的 12 个 hook 758 行【P2 约 400 / P3·P5 约 358】。
🔴 **最后这 758 行在方案 v1 里没有任何阶段认领**,v2 已补。

**必做**:`frontend-vue/app/core/PROVENANCE.md` 记录来源 commit(`b71a892b`,D4-a 新基线)+
**五类偏离逐条登记** —— 且由 `core-provenance.test.ts` 的**完备性检查**强制
(登记缺失即报红,豁免清单不能悄悄膨胀)。

### 6.10 D6 的连带简化
砍掉 Mock + 静态站点后,`isMock` 与 `NEXT_PUBLIC_STATIC_WEBSITE_ONLY` 可**一并清除**
(两者成对出现在能力判定表达式里)。连带简化:
- `getAPIClient(isMock)` → `getAPIClient()`,去掉 `_clients` 双键 Map、去掉 `createStaticClient()`
- `getLangGraphBaseURL()` 去掉 `isMock` 分支与 `/mock/api` 兜底
- `ThreadStreamOptions.isMock` 及全部向下传递移除
- `ThreadContext` 从 `{ thread, isMock }` → `{ thread }`
- 两个聊天页的 `canRegenerate`/`canEdit`/`canBranch`/`disabled` 表达式收敛
- **运行模式从 4 种降到 2 种**(正常 / 免鉴权),测试矩阵减半

### 6.11 🔴 44 条红线的移植分类(§5,技术含量最高)

> 🔴 **v3 重算:总数是 44,不是 37;三类标称数全部与实际不符。**
> 10 号文档 §10.3 逐行统计 = T8 + S12 + R9 + P6 + **A9(协议与安全)** = **44**。
> 该文档**自己从未声明过总数**,「37」是方案侧编出来又互相抄的。

| 类别 | 旧标称 | 🔴 实际 | 差因 |
| --- | --- | --- | --- |
| **A 自然消失** | 5 | **3** | 另 2 行是**泛化 React 模式**(`useRef` 反模式、`useCallback`/`useMemo`),不是编号红线 |
| **B 变形重现** | 8 | **12** | `P2–P5` 那行**是 4 条合并写的**;且补入此前**完全没归类**的 **S3/S4/S5** |
| **C 原样保留** | 24 | **29** | 正文枚举本来就是 29(T8+A9+S7–S10+R×6+P1/P6),与标称 24 从来没对上 |
| **合计** | 37 | **44** | ✅ 已机械核对:无重叠、无遗漏、无多余 |

🔴 **S3/S4/S5 此前是分类真空**(S3 守的是 issue #2746)。它们在 §4.1
「必须原样复刻的语义(T1–T8、S1–S5)」里有归属,**但 §5 的 A/B/C 漏了** → v3 补入 B 类。

✅ **`§5.2` 已把 B 类 12 条做成 PR 验证清单**:**6 条可机械化**
(S1 流合并含时间分布断言 / S3 / S4 / S5 fake-timer / R3 无渲染期定时器 / 跨thread E2E),
**6 条只能人工**(R2 流式中途截图 / S11 禁用 localStorage / S12 请求 cancelled / P2–P5 面板四项),
并附可直接复制的 PR 模板片段。

⚠️ **一处口径已对齐**:C 类原写「搬过去就对」措辞过强。实测 T 类实现确实在复制层
(`api-client.ts:63/236`、`stream-mode.ts:41`),**但调用方是重写的引擎**
(`threads/hooks.ts:2017` 在设 `streamResumable`)→ 准确说法是
**「复制保证实现还在,不保证新引擎仍然路过它」**。故 C 类的 PR 检查是
「新引擎有没有绕过包装直连 SDK」,不是「你复制了吗」(后者是 provenance 测试的职责)。

---

### 6.12 D9:零引用代码清理 —— 20 个文件 / 2,100 行(已实跑证明)

**这不是静态推断,是跑出来的。** 方法:把 `frontend/` 复制到 `/tmp` 一份 throwaway 副本
(`node_modules` 用 APFS clonefile,14 秒),在**副本**上删掉那 20 个文件跑完整流水线。
`frontend/` 全程零改动(git 已验证,D7 未越界)。

| 验证 | 结果 |
| --- | --- |
| 基线 `tsc --noEmit`(未删) | ✅ 通过 |
| 删 20 个后 `tsc --noEmit` | ✅ **通过** —— 无任何文件 import 这些模块 |
| 单元测试 `rstest run` | ✅ **880 passed / 0 failed** |
| `next build` 生产构建(Turbopack 全模块图) | ✅ **通过**,全部路由正常 |
| **E2E 全量 27 spec / 126 用例** | ✅ **126 passed**(2026-07-31 基线,含新增 `streaming-reasoning-order`) |

**证明强度**:`next build` 会追踪完整模块图,若 20 个中任何一个可达则构建失败;
E2E 123 全绿证明运行时行为未变 → **行为差异为 0,不是"影响很小"。**

#### 清单(详表见 11 号 §2.6)
| 组 | 数量 | 行数 |
| --- | --- | --- |
| `ai-elements` 零引用 | 14 / 28 | **1,660** |
| `ui/` 零引用(`carousel` 241 / `avatar` 53 / `sonner` 40) | 3 | **334** |
| 零散(`proxy-policy` 55 / `streaming-indicator` 34 / `overscroll` 17) | 3 | **106** |
| **合计** | **20** | **2,100** |

#### 🔴 唯一例外:`core/auth/proxy-policy.ts` 代码死了,契约没死
它永不执行,但内容是一份**代理契约**(8 个允许路径前缀、12 个必剥离请求头含
`authorization`/`x-api-key`、8 个必剥离响应头含 `set-cookie`、`access_token` cookie、
非 GET 强制 CSRF、120s 超时)。**已抄进 11 号 §3.2.1 的 Nitro 代理设计** ——
不实现会造成凭据头注入 / 上游越权下 cookie / CSRF 失效。
其余 19 个都是未接线的 UI 组件,删掉不带走任何信息。

#### ⚠️ 顺带发现一条 React 版就存在的 flake(Vue 版会再遇到)
`sidecar-chat.spec.ts:1132`「opens restored side chat history without animated scroll」
在并行跑下偶发失败(串行 3/3 通过、并行重跑 123/123 通过)。
它守的是**红线 P2/P3(动画期间不得回流消息列表)**,是时序敏感用例。
**Vue 版重写右面板动画时,这条会是主要的不稳定来源。**

#### 6.12.1 另外两类(不属于 D9,别混)
| 项 | 性质 |
| --- | --- |
| `src/dev-origins.js`(59 行) | **不是死代码**,被 `next.config.js:6` 引用。但 Next 专用 → **不移植,非砍** |
| `tests/e2e-record/` + `playwright.record.config.ts` | 录制工具,不在 25 spec 验收范围 → v1 可不做 |
| 显式 `role=` 23 处中的 **20 处** | E2E 一次未断言 → 按 D5/D8 同一逻辑可一并不写;仅 `textbox`/`option`/`link` 各 1 需确认 |

### 6.13 可参照实现:`nuxt-modern-starter`(2026-07-30 实测)

`/Users/wangcheng/Documents/workSpace/frontEnd/nuxtProjects/nuxt-modern-starter` @ `ece56c2`
—— 一个**技术栈与 D1/D2 完全重合**的真实 Nuxt 工程(`app/` 11,560 行)。
核实方式:实跑其完整质量门禁,**全绿**(lint/format/stylelint/typecheck/i18n/docs-sync/**126 用例**)。
**详细对照见 11 号 §2.7。**

**✅ 已闭合的版本核实**(原 P0 ① 的主要内容):
`Nuxt 4.4.8` + `ant-design-vue 4.2.6` + `@ant-design-vue/nuxt 1.4.6` + `Pinia 3.0.4`
+ `vue-i18n 11.4.6` + `Node 22.22.3` / `pnpm 11.5.2` + `Vitest 4.1.9`。
**FOUC 解法**:`antd: { extractStyle: true }` + hydration 前设 `data-theme` 的内联脚本 → **风险 R5b 消除**。

**可直接抄 4 项**:antdv SSR 接线、主题桥接链(构建期从单一 JSON 生成 CSS 变量 + antdv token)、
antdv locale 联动 vue-i18n、routeRules 从单一 config 派生。
**借鉴但要裁剪 8 项**:`docs-sync` 的 claims 机制(用于 C 类 29 条红线)、架构守护型测试
(用于 §1.3 五条约束 → **缓解 R14**)、`i18n-manager.mjs`、`quality` 脚本顺序(→ `make verify` 模板)、
公开页面的 `default` layout、SEO 资源与 Public API adapter、SWR + webhook revalidate、
`app/features/<domain>` 作为**对标完成后新增领域**的垂直切片约定。

🔴 **明确不要原样抄**:把现有 workspace 整体改成 `app/features/`(会破坏 §3.2 子目录镜像)、
CSP 配置(它有未解冲突)、`.env.*` 白名单提交(反面教材)、`app/lib/http`、普通可读 token Cookie、
浏览器直连后端作为 DeerFlow 的生产 API 边界。认证、CSRF、SSE 和后端代理必须遵守 DeerFlow 的
`proxy-policy` / Nitro 契约。

**新增领域的最终形态**:旧 workspace 继续镜像 React;新建 `billing`、`pricing`、`news` 等领域
可采用 `app/features/<domain>` + 薄页面 + `core/<domain>`/API adapter。两种结构渐进共存,不为统一目录而做迁移性重构。

🚫 **`nuxt-modern-starter` 完全没覆盖**:服务端状态层的 DeerFlow 使用面(⚠️ **v4:D24-a 后不再是自研件**,
但参照工程不用 TanStack,仍无参照)、`resizable`(R4)、DeerFlow Gateway 流式/SSE(`ThreadStreamEngine`、
`streamdown-vue`)、E2E。

### 6.14 可参照 SSE 实现:`gamma-project/features`(2026-07-31 深读)

参照来源:`/Users/wangcheng/Documents/workSpace/frontEnd/pixelBloomSpace/oversea/gamma-project`。

**✅ 借鉴**:通用 SSE buffer/parser 与业务 transport 分层、业务 adapter、纯 reducer action、
流所有权/abort、watchdog 纯函数、实时与历史回放 parity 测试、UI 层 `requestAnimationFrame` 批量更新。
详细取舍已写入 11 号 **§4.1.0**。

**🔴 不复制**:它的 `\\n\\n` 简化 parser、`segment_continue/last_message_index` 协议、
`localStorage` token、模块级重连变量和“没有通用 event 去重”的最终状态。DeerFlow 必须遵守
Gateway 的 `id` / heartbeat / `Last-Event-ID` / `Content-Location` / `gap` / `end` / 409 契约。

**最终结构**:`fetch-sse → wire codec → Gateway adapter → canonical event → pure reducer →
ThreadStreamEngine → Vue composable → Pinia/UI`。Gamma 只提供分层参考,不改变 D22 的手写流处理方案,
也不减少 P0 的 stream contract、Nitro proxy 和生命周期测试。

🔴 **最有价值的一项(2026-07-31 深读后新增)**:它的 `revalidate-nitro-contract.test.ts`
演示了**「从被拷贝方源码提取算法/常量执行比对」**的契约测试模式 ——
这正好打在 deer-flow 的 D7 最大技术债上(两份 13,486 行拷贝必然发散)。
已据此定 **D12** 并写成 **§3.1.2 `core-provenance.test.ts`**(约 60 行)。

**净收益**:P0 省 **1–1.5 周**;R5b 消除、R5c 降级、R14 部分补偿;**D7 的核心技术债被机械拦住**。
**四个自研基础件 + resizable 一天没省** —— 那是 17–26 周里的大头。

⚠️ **抄它的守护测试时必须吸取教训**:实测发现该工程这类测试的通病是**锁在错误的层**
(硬编码文件名、只拦相对路径、对源码文本做 `toContain`),结果放过了一处真实边界违规。
**抄思路,不要抄断言层级** —— 每条守护测试都要能通过「故意引入缺陷 → 检查必须失败」。

## 七、本会话完成的工作(2026-07-30 → 07-31)

### 时间线

| # | 做了什么 | 结果 |
| --- | --- | --- |
| 1 | 11 号文档全文交叉引用核对 | 修正 **26 处**(详见下方三项要点) |
| 2 | 补 `isMock` 精确统计 | **102 处 / 15 个文件**(旧表只列 6 个) |
| 3 | 发现 `sr-only` 不属于 `aria-*` → 提 O16 | 用户定「砍」→ **D8** |
| 4 | 零引用代码实跑排查 | **20 个文件 / 2,100 行** → **D9**(§6.12) |
| 5 | O14 拆解 | O14b→**D10**(新建 `docker-vue/`)、O14a→**D11**(不做 CI)→ **阻塞项清零** |
| 6 | 评估 `nuxt-modern-starter` 架构质量 | 发现 **11 个问题**,写 `FIX-PLAN.md` |
| 7 | 按计划**彻底修复**该项目 | 9 项完成 / #9 用户决定不做 / #11 不纳入;门禁全绿,测试 126→**137** |
| 8 | 从修复中提炼可复用设计 | → 方案 **§2.7**、**§2.7.6/2.7.7**、**§3.1.2** |
| 9 | 确认「测试可只读 `frontend/`」 | **D12** → `core-provenance.test.ts` 机械防发散 |
| 10 | 补写目录结构最终版 | 方案 **§3.2**(含 7 条关键约束,标注 📋复制/✍️新写/⚙️生成) |

### 决策增量:D8 → D12(本会话新增 5 项)

| # | 决策 | 一句话 |
| --- | --- | --- |
| **D8** | 砍 `sr-only` | 24 处,代价 5 处 E2E 断言改 testid |
| **D9** | 砍零引用代码 | 20 文件 / 2,100 行,已实跑证明 |
| **D10** | 可新建顶层目录 | 解决生产暴露(`docker-vue/`),零修改现有文件 |
| **D11** | 不做 GitHub CI | 改 `make verify` 人肉门禁,代价见 R14 |
| **D12** | 测试可只读 `frontend/` | 使 `core-provenance.test.ts` 成为可能 |

### 🔴 第二轮:彻底修复(2026-07-31,方案 v1 → v2)

用户指示「按最佳实践彻底修复,确保落地无阻塞项」。**逐项复核 + 全部数字重新实测**,
发现并修复 **10 处**。修复清单:

| # | 问题 | 性质 | 修复 |
| --- | --- | --- | --- |
| **A** | 🔴 **D12 的文件级哈希在 `threads/hooks.ts` 上必然失效** —— 该文件 53 导出里 40 个是非 hook 导出(`mergeMessages`/`decideCoalesce`/历史合并全组),与 hook 交错,**必拆 → 哈希必不等** → 承载 C 类红线最多的文件恰好零保护 | **落地会卡住** | **D13**:两层校验(§3.1.2)+ 拆分规格(§3.1.3) |
| **B** | 🔴 **豁免集不止 3 个,且缺「新增」分支** —— D6 清 `isMock` 实测改到 4 个名单外文件;`api/stream/` 在 React 侧不存在会让测试崩溃 | **落地会卡住** | 并入 **D13**:五类偏离 ADAPTED/DEMOCKED/SPLIT/ADDED/REMOVED |
| **C** | `core/*/hooks.ts(24 个薄文件 2,251 行)` 标注张冠李戴(实测 17 个 / 4,162 行);连带 **758 行 query hook 无阶段认领** | 记账 | §3.1 更正 + 分派给 P2/P3/P5 |
| **D** | **D9 的「省 1–2 周」未计入总账** —— P5 行写了「D9 后 7–11」,小计却用 8 和 12 | 记账 | §7 重算,新增修正记录 ④⑤⑥ |
| **E** | 「21 个自研原语」是 D6 砍 6 个特效件**之前**的数,出现在 4 处 | 记账 | **§2.3.1.1 存活口径表**(唯一权威计数)|
| **F** | 缺口数 3 / 4 两个口径混用 | 记账 | 同上:**存活文件 32 / 能力缺口 4**,说明差在 toast |
| **G** | 两处残留「4 处」(D8 后应为 5 处) | 记账 | §1.3、§2.5 已改 |
| **H** | `tests/guards/` vs `tests/unit/guards/` 路径分叉 | 记账 | 统一 `tests/guards/`,树里加了警示 |
| **I** | 🔴 **25 spec 结构上看不见 Nitro 代理层** —— 全走 `page.route()` 浏览器层拦截,而 D10 去 nginx 后 R15 三项 + proxy-policy 契约全在那层 | **落地会卡住** | **D14**:验收拆两层 + §1.2.1 + `proxy-policy.test.ts` 6 条断言 |
| **J** | `make verify` 塞 123 个 E2E 挂 pre-push → 必被 `--no-verify` 绕过 | 执行形态 | 拆 **`verify`(快)/`verify-full`(慢)**,契约测试进快门禁 |

**另新增两条风险**:**R16**(Nitro `routeRules` 内置 proxy 可能**本身**不支持无缓冲 SSE ——
不是漏配置,是能力不具备;P0 用 1 小时证伪)、**R17**(拆分引入语义漂移,由 Tier 2 + 反向验证守)。

**净效果**:没有一条动到 D1–D12、分期结构、或当时三个自研件的估算(17–26 周的大头)。
工期 24–41 → **24–42 周**,**对外口径不变**。

> 📌 **本轮最该记住的一条**:10 条里 6 条是记账错,而它们的共同形态是
> **「实测出来的基数全对,被复述到第二处的数字会漂」** ——
> 因为两天内落了 D8–D12 五个决策,每个都让 3–5 处已写好的数字失效。
> 讽刺的是,方案自己在 §2.7.2 第 5 项就给出了解法(`docs-sync` 的机械 claims 校验),
> **只是建议对代码用,没对文档自己用。**

### 🔴 第三轮:D15 弃 Tailwind 改 SCSS(2026-07-31,方案 v2 → v3)

用户决定:「不要用 Tailwind CSS 4,改成 SCSS 来实现」。**先实测影响面再改**,结论:

| 维度 | 实测 | 判断 |
| --- | --- | --- |
| E2E 受影响 | **2 处**(`chat.spec.ts:481/500`) | ✅ **远小于预期**,与 D5/D8 同样处理 |
| 必须保留 | **115 个 CSS 自定义属性** | 🔴 SCSS 变量是编译期的,暗色切换要运行时 |
| 重写面 | 1,841 处 `className=`、`cn()` 418 次 | 🔴 **成本不是"转换存量"**(UI 本来就全重写),是**失去逐字复制这个捷径** |
| 工期 | **+3–6 周** | 🔴 **首次改变对外口径**:`6–10` → `≈7–12 人月` |
| 意外收益 | 参照工程本就是 SCSS | ✅ §2.7.1 那处「真相源不同」的差异消失,主题链整条可抄 |

**同时顺带解决两件事**:① §2.4 编号空洞被 D15 的分析填上;
② 发现并更正了工期表里**两处百分比口径错误**(旧文用「宽度÷上界」冒充「±%」,
`24–41` 写成「±40%」实际应为 ±26%)—— 已改为直接陈述「上界比下界高 78%」。

**新增风险 R18(视觉对标漂移)**,中高概率:
🔴 **E2E 断言的是文案/角色/testid,不是像素 —— 25 spec 全绿的情况下视觉照样会漂。**
这使 §0.3「保留 React 版做逐屏 diff」从锦上添花变成**必需**。

### 🔴 最值得带走的一条方法论:反向验证

方案 §10 已写入,这里再强调一次 —— 本会话反复用到,且**救了两次场**:

> **每条守护性检查都必须能通过「故意引入缺陷 → 检查必须失败」。不能反向验证的修复视为未完成。**

两次实战:
- 用它查出 `nuxt-modern-starter` 的 #2/#6 **只做了便宜的一半**(改 `slice(0,16)`→`(0,15)` 后测试仍全绿)
- ⚠️ **它自己也会有 bug**:我破坏分包规则时写成 `false && id.includes('ant-design-vue')`,
  而原分支是 `if (A || B)`,`B` 仍成立 → chunk 照常产出 → **测试假绿**,差点误判。
  **必须先确认破坏真的生效,再判定测试有效性。**

### 本轮修正中最值得注意的 3 项

1. 🔴 **D5 代价从 4 处降到 2 处(事实错误)**:`thread-list-pin.spec.ts` 的
   `getByRole("button", { name: "More" })` 依赖的是 `sr-only` span,**不是 `aria-label`**。
   → 曾引出待决项 O16,用户当场定为「砍」→ **已升为 D8**,O16 关闭
2. **`ui/` 原语归类重算**:13 → **15**(旧版数字与自己列的 15 个文件名矛盾,且合计 39≠44)。
   连带更新 6 处引用(§2.3.4/§2.3.5/§3.2/§10.1/P0⑦/P2)
3. **§5.1 的核心论证是 D7 已推翻的旧论证**:原写「不做共享包,24 条红线要在 Vue 侧重新踩一遍」——
   §0.4 早已记录该论证"不再成立",但 §5.1 没同步。已改为「共享包的价值在长期维护,不在移植」
   > ⚠️ **该引文里的「24 条」本身也是错的**(v3 实测 C 类是 **29 条**,见 §6.11)——
   > 此处保留原文只为记录当时改了什么,**不要引用这个数字**。

### ~~仍存的一处「不修」判断~~ → ✅ **已在 v3 顺带解决**
原问题:`§2.3` 之后直接跳到 `§2.5`(无 `§2.4`),是修订期删小节留下的编号空洞。
**v3 把 D15 的影响分析正好放进了 `§2.4`** —— 编号连上了,且不需要动 `§2.5.x` 的 4 处引用。

> **工具提示**:本会话期间 Bash 工具因模型可用性**间歇不可用**(报
> `claude-opus-5 is temporarily unavailable`)。Read / Write / Edit 不受影响。
> 遇到时:用 Read/Grep 替代查证,或稍后原样重试(命令本身没问题)。
>
> **权限提示**:在 `frontend/` 等受保护目录里执行 `rm` 会被权限层拦截(这是对的)。
> 若需验证「删掉某文件是否安全」,**复制到 `/tmp` 再删** ——
> `node_modules` 用 `cp -Rc`(APFS 写时复制,1GB 约 14 秒)。本会话验证 D9 就是这么做的。

---

## 八、如何复现我的实测数据

新会话若要验证上面的数字,在 `frontend/` 目录下执行:

```bash
cd frontend && find src -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.jsx" \) | xargs wc -l | tail -1
```

```bash
cd frontend && grep -rhoE "getByRole\(\s*[\"'][a-z]+[\"']" tests/e2e | grep -oE "[\"'][a-z]+[\"']" | tr -d "\"'" | sort | uniq -c | sort -rn
```

```bash
cd frontend && for c in magic-bento galaxy terminal flickering-grid number-ticker spotlight-card; do echo "$c: $(grep -rl "$c" src/components/workspace src/app/workspace 2>/dev/null | wc -l)"; done
```

```bash
cd frontend && grep -rn "mock=true" src/
```

### 🔴 v4 新增的复现命令(六项修正的依据)

**D26 上游漂移**(在仓库根跑):

```bash
for m in 2026-02 2026-03 2026-04 2026-05 2026-06 2026-07; do echo -n "$m: "; git log --since="$m-01" --until="$m-31" --numstat --pretty=format:"" --no-renames -- frontend/src | awk '{a+=$1;d+=$2} END {printf "+%d -%d\n", a, d}'; done
```

```bash
git log --since="6 months ago" --name-only --pretty=format:"" -- frontend/src | sort -u | grep -c "^frontend/src"
```

**D13-a DETYPED 清单**:

```bash
cd frontend/src/core && for f in $(grep -rlE 'from "(@langchain/langgraph-sdk|ai)"' .); do grep -qE 'from "react"' "$f" || echo "$f"; done
```

**D22 的 SDK 类型渗透面**:

```bash
cd frontend && grep -rhoE 'import (type )?\{[^}]*\} from "@langchain/langgraph-sdk[^"]*"' src | sed -E 's/.*\{([^}]*)\}.*/\1/' | tr ',' '\n' | sed 's/^ *//;s/^type //' | sort | uniq -c | sort -rn
```

**D24-a TanStack 使用面**:

```bash
cd frontend && grep -rln "@tanstack/react-query" src > /tmp/f.txt && xargs grep -hoE "\b(useQuery|useMutation|useInfiniteQuery|invalidateQueries|setQueryData|enabled|staleTime|retry|refetchOnWindowFocus)\b" < /tmp/f.txt | sort | uniq -c | sort -rn
```

**D25-a ① 部署形态无 TLS**:

```bash
grep -n "listen\|ssl" docker/nginx/nginx.conf
```

**依赖健康度(R20 / §4.2.5 / §2.3.2)**:

```bash
npm view ant-design-vue time --json && npm view hast-util-to-jsx-runtime peerDependencies --json && npm view vue exports --json && npm view @tanstack/vue-query peerDependencies --json
```

**splitpanes 事件**:

```bash
cd /tmp && npm pack splitpanes --silent && tar xzf splitpanes-*.tgz && grep -oE '"(resize|resized|ready|pane-[a-z]+|splitter-click)"' package/dist/splitpanes.esm.js | sort -u
```

---

## 九、与用户协作的注意事项

- 用户偏好**直接、数据驱动**的回答,会追问"这跟核心业务有关系吗"这类穿透性问题 —— 回答要诚实分层,不要为了正当性而夸大(例如无障碍对业务功能确实没用,该直说)
- 用户已多次通过决策收紧范围(D5→D6→D7),倾向**尽量少做、尽量隔离**。提建议时应主动算成本,并区分「技术决策」与「产品决策」
- D1–D12 是用户拍定的,**不要重新讨论**。若发现新的事实冲突,提出事实与后果,由用户决定
- 我提过反对意见但用户坚持的项(D2 选 antdv、D5 砍无障碍、D7 禁改范围),已按用户决定执行并在方案里记录了代价 —— 保持这个处理方式

---

## 十、下一窗口的优化待办(按性价比排序)

> 🔴 **这份清单是本轮交接的核心。** 已按「投入 ÷ 收益」排序,**从上往下做**。
> 每条都标了**为什么值得做**和**做完什么样算完**,不用再重新判断优先级。
>
> ⚠️ **共同前提**:动手前先按 §〇 铁律 1 实测复核相关数字,别直接信文档里的数。

### ✅ 第一梯队 —— **已于 2026-07-31 完成**

> 三条全做完了,且**①和③各自挖出一个原计划之外的真问题**(见下方各条的「实际发现」)。
> 下一窗口从**第二梯队**开始。

#### ✅ ① 修风险登记册的编号错位 —— 已完成

修复后风险表为 **`R1 R2 R3 R4 R5 R5b R5c R6 … R18`**,连续无缺号(已机械核对)。

🔴 **实际发现(原计划外)**:排查时发现 **`R` 是两套编号的代号冲突** ——
§5 红线的 `R` 是**渲染层**(沿用 10 号文档 §10.3 的 `T`/`S`/`R`/`P` 语义前缀),
§8 风险的 `R` 是 **Risk**,两者在 **`R1`–`R9` 段完全重叠**。
例:**红线 R3** = 产物自动打开须在带清理的 effect 里;**风险 R3** = Pinia 单例跨 thread 泄漏。

**处置**(两边都不重命名 —— 红线编号是 10 号文档既有资产且对应真实代码不变量,
风险编号在文档里被引用 **146 次**,改任一边成本都远大于加约定):
§5 加编号图例 + §8 加冲突警告,**约定引用时必须写全「红线 R3」/「风险 R3」**;
§5 表格里 3 处裸 `R` 已标注为 `**R9**(渲染层)`。

#### ✅ ② 给「+3–6 周」挂待校准标记 —— 已完成

三处已联动:**§7 工期表**(`+3–6` 与 `27–48 周` 各挂 `⚠️待P2校准`)、
**§7.1 对外口径**、**README「目标量级」下新增一行口径警告**。
§7 表下新增四步校准方法(记录前 3 个页面实际速率 → 回推 → 同步三处 → 追加修正记录)。

#### ✅ ③ 补 Pinia store 作用域约定设计 —— 已完成(新增 **§3.3.1**)

含:store 三分类(G 全局 / T thread 级 / E 引擎持有)与 reset 边界、**五条可执行约定**、
`store-scope.test.ts` 守护测试、新增 `thread-switch.spec.ts`,并已回填 R3 与 §1.2/P6 验收清单
(验收从两层变**三层**,补位 spec 单列,因为它不在继承的 24 个里)。

🔴 **实际发现(原计划外,两条)**:

1. **§3.3 的前提是错的,已纠正**。旧文写「React 版靠 Provider 随路由卸载来清理每 thread 状态」——
   实测:三个 thread 级 Provider 挂在 `[thread_id]/layout.tsx` **且没有 `key`**,
   而 **App Router 在同级动态段之间复用 layout**,根本不卸载。
   重置来自消费者组件里的**手写哨兵** `chat-box.tsx:81`:
   `if (threadIdRef.current !== threadId) { …deselect(); }`
   *(⚠️ 2026-07-31:`setArtifacts([])` 已被 main `0d8e11ad` 从哨兵移除,改为非空守卫)*
   加上 `artifacts/context.tsx:89-101` 的 **pathname 水合 effect**(同一提交新增,重置回到了状态所有者内部)
   → **对 Vue 反而是好消息**:该机制本就与框架无关,迁 Pinia 是 1:1。

2. ~~🔴 发现一处跨 thread 粘滞状态,已登记为待决项 O17~~ → ✅ **O17 已于 2026-07-31 关闭,上游修复**:
   原问题是 `deselect()` 不重置 `autoOpen`、全库只有一处 `setAutoOpen(false)` 且无路径设回 `true`。
   合入 main `0d8e11ad` 后,`artifacts/context.tsx:98` 在 pathname 水合 effect 中 `setAutoOpen(true)`,
   当前 3 处:`:84`(useState)/ `:98`(`true`)/ `:145`(`false`)。
   → **无需产品决策**;Vue 侧用 Pinia `$reset()` 恰好与 React 现状一致(见 **D18**)。

---

### ~~第一梯队~~(存档:原始条目描述)

<details><summary>展开查看原始待办描述</summary>

#### ① 修风险登记册的编号错位 —— 15 分钟

**实测现状**(§8 表格里的实际顺序):
```
R1 R2 R3 R4 R5 R5b R5c 🔴R18 R6 R7 R8 R9 R10 R11 R12 R14 R15 R16 🔴R13
```
两处错位:**`R18` 被插在 `R5c` 后面**(v3 加 D15 风险时贴着 R5c 放了)、**`R13` 落在 `R16` 后面**。

**做完什么样算完**:表格按 `R1→R18` 顺序排列(`R5b`/`R5c` 紧随 `R5`),
且 §10 判断里「集中在四处」引用的 R14/R16/R18 编号仍对得上。

---

#### ② 把「+3–6 周」这个数标注成待校准 —— 20 分钟

**为什么**:这是 **全案最不确定的数字**(§2.4.5),它把上界从 42 推到 48 周、
把对外口径从 `6–10` 改成 `≈7–12 人月`。但它**不是实测**,是按
「约 200 组件 × 每个多 0.5–1.5 小时」估的。

**做什么**:在 §7 工期表、§7.1 对外口径、README「目标量级」三处
统一挂一个显式标记(如 `⚠️待P2校准`),并写明校准方法
(P2 做完前 3 个页面 → 实际速率 → 回推 → 更新三处)。

**做完什么样算完**:任何人引用 `7–12 人月` 时,都能一眼看到它含一笔未实测的估算。

---

#### ③ 补 Pinia store 作用域约定的设计 —— 半天

**为什么**:风险 **R3** 写着「P2 即定 store 作用域约定」,
但**方案里根本没有这个设计** —— §3.3 只有「React 状态方案 → Vue 对应物」的对照表,
没说 store 怎么按 thread 隔离、何时销毁、SSR 下怎么避免跨请求污染。

🔴 **这是真空档,不是记账错**:Pinia 默认是单例,而 DeerFlow 的核心语义是
**按 thread 隔离**(见 AGENTS.md 与 §5 红线)。SSR 下 store 跨请求泄漏是 Nuxt 的经典坑。

**做完什么样算完**:§3.3 下新增小节,回答三个问题 ——
store 按什么粒度建(全局/按 thread)、thread 切换时旧 store 何时销毁、
SSR 请求间如何保证不共享实例。

</details>

---

### 第二梯队

#### ✅ ④ 深化 §4.2 / §4.3 —— **已于 2026-07-31 完成**

两节已达到 §4.1 粒度:接口草案、逐条红线对应、可搬性逐文件实测、跨阶段依赖。
新增小节 **§4.2.1–4.2.4** 与 **§4.3.1–4.3.4**。

🔴 **实际发现(原计划外,四条)**:

1. ✅ **`ai-elements` 对 Radix 的真实依赖是 0** —— 表面看 2 个组件引 Radix,
   实测两处**是同一个东西**:`@radix-ui/react-use-controllable-state`,
   **受控/非受控状态助手 hook,不是 UI 原语**,Vue 用原生 `defineModel()` 顶替。
   → **P5 与 D2 的 antdv role 对齐问题完全解耦**,不会被风险 R5/R13 波及。
   这是本次深化最实的好消息,支持 P5 维持 5–9 周不上浮。

2. 🔴 **发现跨阶段硬依赖,已登记为风险 R19**:
   **P5 的 `prompt-input`(1,477 行,占 ai-elements 的 40%)硬依赖 P2 的缺口件 `command`**
   —— 它含 7 个 `PromptInputCommand*` 导出,而 `command` 在 antdv 无对应物需重写。
   **P2 交不出合格的 `command`,P5 会在关键路径末端被堵**,那时返工最贵。
   处置:`command` 提升为 **P2 出口条件**,验收用例直接取自 `prompt-input` 的 7 个用法;
   P5 加开工前置检查。已回填 §6 的 P2/P5 两个阶段块。

3. **`prompt-input` 不是一个组件,是 81 个导出 / 41 个组件的复合族**(7 个子族)。
   方案原先按"一个组件 1,477 行"描述,会低估其结构复杂度 → 已给出按子族拆目录的建议。

4. 🔴 **又一处代号冲突:红线 `P` 是「面板布局」,§6 的 `P0`–`P6` 是「阶段」。**
   全文最易误读的一句是 §6 P5 里的「尤其右面板 **P2–P5**」——
   指的是**面板布局红线 P2 到 P5**,不是"第 2 到第 5 阶段"。已就地加注 + 写进 §5 图例。

**其他实测更正**:`core/streamdown/` 是 **5 个文件 624 行**(旧文只提 `preprocess.ts` 389 行);
`safe-children.ts` 需拆(2 纯函数 + 2 个 `useMemo` 外壳 → Vue `computed`),属 D13 的 SPLIT 类;
`ai-elements/streamdown.tsx` 是 **React class ErrorBoundary**,Vue 无对应物需用 `onErrorCaptured` 重写;
R6 的数据层 `core/citations/sources.ts` **123 行零 React 引用**,可整个搬。

---

#### ✅ ⑤ B 类红线做成 PR checklist —— **已于 2026-07-31 完成**(新增 **§5.2**)

12 条(不是 8 条)各有「怎么验证没破」的具体操作,分**可机械化 6 条**与**只能人工 6 条**,
附可直接复制的 PR 模板片段。

🔴 **实际发现(原计划外,这条最严重)**:**红线总账全错。**
做 checklist 前先核对了源头,发现 10 号文档实际是 **44 条**(方案说 37),
且 **A/B/C 三类的标称数全部与实际不符**,还有 **S3/S4/S5 三条完全没归类**
(S3 守的是 issue #2746)。已全部更正并机械核对闭合(A3+B12+C29=44,无重叠无遗漏)。
详见 §6.11。

**连带修正**:C 类「搬过去就对」措辞过强 —— 实测 T 类实现在复制层,
但调用方是重写的引擎 → 改为「复制保证实现还在,不保证新引擎仍然路过它」,
并据此把 C 类的 PR 检查定义为「有没有绕过包装直连 SDK」。

---

#### ✅ ⑥ 全文系统性口径核对 —— **已于 2026-07-31 完成**

用脚本把全文 **138 处行数断言、239 处「个」、64 处「条」、84 处「处」**全部抽出,
逐类与代码库实测比对 + 内部算术闭合验证 + 结构性体检。

🔴 **结论先说:方案的实测基数经受住了检验,错的全在派生数和引用上。**

**✅ 逐项实测吻合(8/8 精确一致)**:`core` 143 个/19,001 行、`workspace` 20,286 行、
`threads/hooks.ts` 3,072 行/53 导出、`ai-elements` 28 个/5,374 行、`mock-api.ts` 1,411 行、
E2E 27 个/7,334 行、17 个 `hooks.ts`/4,162 行、`getByRole` 122 / `getByText` 215 / `getByTestId` 82、
32 个 spec、99 个单测、`tests/unit/core/` 72 个、Playwright 报 **126 tests in 27 files**、
`ui/` 44 文件(40 tsx + 3 css + **1 jsx**)= 41 个组件。

> ⚠️ **有三次是我自己数错、方案没错**(`.test.tsx` 漏统计、`.jsx` 漏统计、用例数 grep 少数)。
> 记在这里提醒:**核对时先怀疑自己的统计口径,再怀疑文档。**

🔴 **找到 4 处真错(已全部更正)**:

| # | 问题 | 影响面 |
| --- | --- | --- |
| 1 | **`3 处适配 141 行` 是错的,实测 182 行** —— `141 = 101 + 40`,**漏掉 `i18n/server.ts` 的 41 行**。连带 `13,619 − 141 = 13,480` 也错,应为 **13,437** | 🔴 `13,480` 在方案里出现 **9 处** + HANDOFF **3 处**,已全部同步。<br>**这是全文唯一一处「标了 ✅ 分毫不差、却算错」的账** |
| 2 | **继承资产占比 `41%` 过期** —— 用的是 D6 后、D9 前的 31,780 分母;D9 已定 → 应为 **43%** | 「决策落地后没回头更新派生数」的典型 |
| 3 | 🔴 **`### 2.5 范围裁剪(D6)` 标题被我自己在加 §2.4 时删掉了** | **本轮引入的回归**,已恢复。教训:大段替换时要检查 old_string 尾部的结构标记 |
| 4 | **`§2.5.1` 悬空**(该节只有 2.5.2 / 2.5.3),被引用 2 次;**`§8.3` 未标来源**(是 08 号文档的节,与本文档 §8 风险登记册易混),被引用 5 次 | 已分别改为 `§2.5.2` 和 `**08 号** §8.3` |

**✅ 结构性体检全过**:标题无跳级(排除代码块后)、§0–§10 主干完整、各章二级编号连续无缺、
外部文件链接全部可达、表格列数一致(R14 行的"异常"是转义竖线 `\|\|` 造成的误报)、
内部 `§` 引用全部可达。

**✅ 内部算术闭合**:`13,668 + 5,333 = 19,001`、`3,072 + 1,090 + 1,171 = 5,333`、
`4,162 − 3,072 = 1,090`、`41 − 6 − 3 = 32 = 14 + 15 + 3`、`5,374 − 3,714 = 1,660`、
红线 `3 + 12 + 29 = 44`、各百分比(66% / 78% / 40% / 31% / 12.5%)全部复算一致。

---

#### ✅ ⑦ 技术栈定版 + `package.json` 落地 —— **已于 2026-07-31 完成**(新增 **§2.8**)

用户问「目录/技术栈/架构/package.json 是否都确定到可以直接实现」。核对结果:
目录结构(§3.2,354 行树)与架构设计(§4 + §3.3.1)✅ 已齐;
但**技术栈只锁了 10 个核心包,`package.json` 完全没有**。已补齐。

**做法**:把 React 版实测的 **97 个依赖**(76 deps + 21 devDeps)逐个分类为
**保留 / 换 Vue 对应物 / 自研不装包 / 不移植**,产出可直接落盘的 `package.json`
(首版为 **58 个依赖**,后经 D21–D25 连续删包收敛到 **50 个依赖**,已通过 JSON 语法与禁用包交叉校验)。

🔴 **实际发现(原计划外,两条都会让实现卡住)**:

1. 🔴 **i18n 词典 3,086 行不是「纯数据」** —— `locales/{zh-CN,en-US,types}.ts`
   = 1,073 + 1,124 + 889 = **3,086 行,精确等于方案一直说的那个数**。但三者
   **`import { CompassIcon, … } from "lucide-react"` 是 value import**,图标当 `icon:` 值用(8 处)。
   **后果**:方案把它们归进「Tier 1 文件哈希 / 逐字节复制」,而 Vue 侧必须改 import
   → **哈希必然不等 → D13 的 `core-provenance.test.ts` 第一天就报红**。
   已改判进 **ADAPTED / Tier 2**,纯 TS 零改动量相应从 13,486 降为 **10,400 行**。
   > 根因:原始「13,619 行无 React 依赖」测量应是按 `from "react"` 匹配的,
   > **匹配不到 `from "lucide-react"`** —— 是口径漏洞,不是笔误。

2. 🔴 **`@streamdown/*` 插件包不可复用** —— 实测 `streamdown`、`@streamdown/code`、
   `@streamdown/mermaid` 的 **`peerDependencies` 全是 `react`**。
   §4.2.1 原写 `plugins.ts` 「✅ 纯 TS 原样搬」不成立(它 import 了这两个包 + 一个 `StreamdownProps` 类型)。
   ✅ **处置简单**:那两个包只是 `shiki` / `mermaid` 的 React 包装 → **直接依赖底层库**。

**另确认 4 个零引用死依赖**:`nuxt-og-image` `defu` `h3` `dotenv`(均 0 文件引用)——
09 号文档标注的"可疑项"已证实,不移植。

#### 🔴 ⑦b React 耦合的机械核查(用户要求后补做,**非人工判断**)

**方法**:逐个读 `node_modules/<pkg>/package.json` 的 `peerDependencies`+`dependencies`,
再 grep 该包 dist 内实际的 `require("react")`/`from "react"`。**97/97 全覆盖,零缺失。**

**结果:37 个 React 耦合 / 60 个框架无关。**逐个处置已写进 **§2.8.1**。

🔴 **D22 改判:`@langchain/langgraph-sdk` 声明了 react peer,技术上曾可复用,但 Vue 版决定不装。**
此前它被视为流式管线基础包;D22 后,这些证据只作为"为什么旧方案曾认为可用"的历史记录:

| # | 实测 |
| --- | --- |
| 1 | `peerDependenciesMeta` 里 `react`/`react-dom` 均标 **`"optional": true`** |
| 2 | `exports` **按子路径隔离**:`.` `./client` `./auth` `./logging`(干净)vs `./react` `./react-ui`(React 专属) |
| 3 | dist 里的 react import **只落在 `dist/react-ui/*`**,主入口与 `client` 干净 |

**代码库用量**:主入口 23 处 + `/client` 4 处;`/react` 仅 4 处,
**其中 3 处是 `import type { BaseStream }`(编译期擦除)**,唯一值引用 `useStream`
正是 §4.1 要重写的 670 行。

→ 🔴 **D22 结论:SDK 不保留。** 守护测试从"禁 `/react` 与 `/react-ui` 子路径"
升级为**禁止 import 整个 `@langchain/langgraph-sdk` 包**。当前 Gateway 的真实 SSE 语义
由手写 `DeerFlowGatewayStreamAdapter` 适配,前端内部只认 canonical stream event。

**机械核查带出的另两处修正**:
1. ✅ **`@uiw/codemirror-theme-basic` / `-monokai` 不耦合 React** → 当时结论是可保留原版本,
   只换 `@uiw/react-codemirror` 这层绑定(此前误把三个一起归为"需换 Vue 绑定")。
   🔴 **D25 后改判为不装**:Vue 侧自写 CodeMirror 薄封装,主题也用本地 `EditorView.theme`
2. 🔴 **`remend` 不在 `package.json` 里** —— 是 `streamdown` 的传递依赖(1.3.0),
   而我们要弃用 streamdown → **必须提为直接依赖**。已核实其**零 peer、零 deps**,完全独立

**D23 后保留清单已按 `@langchain/core` 类型本地化再次收缩**;上述 SDK 证据只作历史留档,不进入 Vue manifest。

#### 🔴 ⑦c 版本号 npm 实核(用户追问"依赖都没问题了吧"后补做)

**首版 `package.json` 里 Vue 侧替代包的版本全是推测。** 用 `npm view` 逐个核实后
**发现 7 个大版本写错 + 2 个依赖漏装,已全部更正。**
D21 后为 **62 个依赖**;D22 删除 `@langchain/langgraph-sdk` 后为 **61 个依赖**;
D23 删除纯类型 `@langchain/core` 后为 **60 个依赖**;D24 删除 `@tanstack/vue-query` 后为 **59 个依赖**;
🔴 D25 删除 9 个 React 迁移惯性/小众包后终版为 **50 个依赖**。
声明范围逐个验证可解析到真实发布版。

| 包 | 首版 | 更正 | 错因(值得记住) |
| --- | --- | --- | --- |
| `lucide-vue-next` | `^0.562.0` | **`^1.0.0`** | 想当然按 `lucide-react` 的 0.562 对齐 —— **替代包不跟随原包版本线** |
| `@nuxtjs/i18n` | `^9.0.0` | **`^10.6.0`** | 🔴 **9.x 只带 vue-i18n `^10.0.7`**,与 §2.2 实跑的 **11.4.6** 矛盾 |
| `@nuxtjs/color-mode` | `^3.5.2` | **`^4.0.1`** | 🔴 **3.x 是 Nuxt 3 线**;4.x 依赖 `@nuxt/kit ^4.4.6` 才配 Nuxt 4.4.8 |
| `stylelint` + `-config-standard-scss` | `^16` + `^14` | **`^17` + `^17`** | **配错了对**(config 的 peer 是 `stylelint ^17`) |
| `motion-v` / `vue-tsc` | `^1.0.0` / `^2.2.0` | **`^2.3.0` / `^3.3.8`** | 实际都已到下一个大版本;🔴 D25 后 `motion-v` 不进入 manifest |
| 🔴 `postcss` / `postcss-html` | **漏装** | `^8.3.3` / `^1.0.0` | 两个 stylelint config 包的 peer |

**三条教训**:① 替代包版本线与原包无关;② **Nuxt 生态模块有独立大版本线对应 Nuxt 3/4**;
③ config 类包必须查 peer 与主包配对。
✅ **一处配对已验证正确**:`pinia 3.0.4` + `@pinia/nuxt 0.11.3`(后者 peer 为 `pinia ^3.0.4`)——
⚠️ 但 `@pinia/nuxt` **最新版要求 `pinia ^4`**,**不要盲目升级**。

✅ **§2.8.4 的 3 项待核实已全部关闭**:
① **CodeMirror 绑定 → 决定自写薄封装**(§2.8.5)—— 实测 CodeMirror 只用在 **1 个文件 114 行**、
仅 **7 个 prop**,而 CodeMirror 6 本体框架无关(`@uiw/react-codemirror` 只是 React 薄壳);
候选库 `vue-codemirror@6.1.1` **近 3 年未更新**(2023-08-08)、`codemirror-editor-vue3` 停在 2024-09
→ **为 7 props 的壳引停更库不划算**,自写只需对接 `EditorView`+`EditorState` 两个稳定 API。
✅ 两个 `@uiw/codemirror-theme-*` 实测不耦合,当时可原样保留;🔴 **D25 后仍不装**,改本地 `EditorView.theme`。⚠️ 兜底:`vue-codemirror` 与 `codemirror ^6.0.2` 兼容,可回退。
② 版本、③ 图标名 —— 已由 npm 实核关闭。

🔴 **依赖部分至此无遗留未决项,可直接落盘实现。**

#### 🔴 ⑦d peer 交叉核查 + 实跑安装(用户再追问"全部核查完了吗"后补做)

**只查"版本存在"是不够的 —— 还要查它们彼此兼容。** 又抓出 3 处:

| 问题 | 修正 | 谁要求的 |
| --- | --- | --- |
| `happy-dom` `^15.0.0` | **`^20.11.1`** | `@nuxt/test-utils@4.0.3` peer 是 **`>=20.0.11`**,差 5 个大版本 |
| 🔴 **漏装 `@vueuse/core`** | **`^14.4.0`** | `motion-v@2.3.0` 的 peer(`>=10.0.0`);🔴 D25 后随 `motion-v` 一并不进入 manifest |
| `zod` `^3.24.2` | **`^3.25.76`** | D21 前为满足 `ai@6` peer(`^3.25.76 \|\| ^4.1.8`)而上调。D21 后该 peer 不再存在,但保留已验证版本即可 |

**累计:`package.json` 首版共 12 处问题**(7 版本错 + 2 漏装 + 3 peer 冲突)。
**教训:只靠推测写依赖清单几乎必然出错,必须实跑解析。**

#### 🔴 ⑦e 对齐参照工程(D20 定下渲染策略后补做)

把清单与**已在跑这套策略**的 `nuxt-modern-starter` 逐个比对,**又发现 3 处**:

| 我的清单 | 参照工程实际 | 判定 |
| --- | --- | --- |
| 🔴 `@nuxtjs/i18n` | **裸 `vue-i18n ^11.4.6` + 自写 `app/plugins/i18n.ts`** | **我错了**。它的 `modules` 只有 `@pinia/nuxt` + `@ant-design-vue/nuxt`。⚠️ **§2.2 写的本来就是「vue-i18n 11.4.6」**,是我错映射成了 Nuxt 模块 |
| 🔴 `@nuxtjs/color-mode` | **不用,自写 `app/composables/useTheme.ts`** | **我错了且自相矛盾** —— §2.3.3 主题链我已画了 `useTheme.ts`,package.json 却塞了 color-mode |
| 缺 `postcss-scss` | **`^4.0.9`** | 漏装。解析 SCSS 语法用(与 `postcss-html` 解析 `.vue` 是两回事) |
| `eslint ^9` | **`^10.6.0`** | 改为 10 —— 对齐参照工程,**并顺带消掉 `@eslint/js@10` 的 peer 告警** |

> 🔴 **这轮教训与前几轮不同**:前三轮错在「没查 registry / 没查 peer / 没实跑」;
> **这轮错在「有现成的实跑参照,却没去比对」**。§2.2 早就列出了验证过的组合,
> 而我按 Nuxt 生态的常规做法推测,多引了 2 个模块。**有参照就先比参照。**

##### ✅ 决定性验证:`pnpm install` 实跑(修正后)

| 项 | 修正前 | ✅ 修正后 |
| --- | --- | --- |
| 直接依赖 | 63/63 | ✅ **D21 前 63/63 全部锁定**;🔴 **D21 后 manifest 为 62 个依赖,D22 后为 61 个依赖,D23 后为 60 个依赖,D24 后为 59 个依赖,D25 后为 50 个依赖**,P0 落盘时重跑严格 install 留证 |
| 依赖图 | 1,862 个包 | ✅ **D21 前 1,654 个包**(少 208 = 两个模块的传递依赖);D21–D25 后精确包数以 P0 实跑为准 |
| **严格 peer** | ⚠️ 4 类未满足 | ✅ **`--strict-peer-dependencies` 退出码 0,零告警** |

✅ **可以直接开 `strictPeerDependencies: true`**,不需要任何 `peerDependencyRules` 豁免。
**少用两个 Nuxt 模块,同时解决了依赖体积与 peer 健康度。**

> 🔴 **历史留档**:`@langchain/langgraph-sdk` 实际解析到 1.9.28(声明 `^1.5.3`),
> 已复核该版本的 `exports` 仍子路径分离。但 **D22 后不进入 Vue manifest**,
> 不再需要 peer 豁免或子路径白名单。

**✅ 另一处复核通过**:`next/` 在 core 里精确只有 3 个文件
(`auth/server.ts`、`i18n/server.ts`、`AuthProvider.tsx`),**「3 处适配」的说法成立**。

---

### ✅ D20 传播清理 —— **已于 2026-07-31 完成**

`①–⑦e` 与全文核对**已全部完成**,第三梯队的 O5/O6/O11/O17 已定案为 **D16–D19**、
O2 转为结论,**只剩 O15(远期)**。

**D20(全 CSR)是 2026-07-31 最后才定的,此前只传播到了主要位置。**
本轮已完成 ⑧⑨⑩:清理 11 号主方案里的过期 SSR 口径、按 D20 重排 P0 实验清单、
并按参照工程形态补齐目录树。

#### ✅ ⑧ 把 D20 传播干净 —— 已完成

**已传播到位的**:D1 决策行(标为被修订)、§2.9(新增,完整设计)、§2.1 选型表框架行、
风险 R5b、§3.3.1 约定 4。

**本轮已处理的(按 `grep -n "SSR" 11-vue-parity-plan.md` 复查):**

| 行号附近 | 内容 | 处理结果 |
| --- | --- | --- |
| 434 / 570 / 964 | 「antdv 在 Nuxt SSR 下需官方模块 + FOUC 解法」、**P0 核实项** | 产品区无 SSR → **FOUC 那条 P0 核实项可降级**;但**主题闪烁**在 CSR 下仍在,内联脚本要留 |
| 440 / 1943 | 当时的 vue-query **SSR 水合**(`hydrate`/`dehydrate` 插件) | 🔴 **产品区 CSR 不需要水合** —— P0 的「vue-query SSR 水合」实验可取消。⚠️ D24 后进一步升级为:**不装 `@tanstack/vue-query`,改做 server-state contract fixture** |
| 1533–1537 | `auth/server.ts` / `i18n/server.ts` 标注为「SSR 专用」 | 改为「**Nitro server middleware 专用**」(§2.9.3 方案 B) |
| 1967 / 2035 / 2051 | `server/utils/` 的「SSR 鉴权五态」「SSR 鉴权取 cookie」 | 措辞改为「**Nitro 鉴权中间件**」,逻辑不变(仍是 `getCookie(event,...)`) |
| 2214 / 2215 / 2220 | §3.3 状态映射表:「需 SSR 友好」「SSR 五态判定移到 server/」「SSR 读 sidebar_state」 | 三处都要按 D20 重写 |
| 2230 | §3.3.1 开头「SSR 下跨请求泄漏是 Nuxt 经典坑」 | 已在约定 4 里标注不适用,**但开头这句还没改** |
| 2766 / 2767 | **§6 P0 的建议执行顺序与关键风险**,含「SSR 鉴权」 | 🔴 **最重要的一处** —— P0 的三件实验要按 D20 重排(见下) |

> ⚠️ **`O8 → D1 Nuxt+SSR` 是历史记录,不要改**(它记录的是当时的决定)。
> 复查时仍会命中 D20 正文、未来营销区 SSR、R5b 历史风险等**有效表述**。

#### ✅ ⑨ 按 D20 重排 P0 的实验清单 —— 已完成

原 P0「三件便宜、二元、失败即改架构」的实验是:① resizable 判定 ② **SSE 穿透 Nitro(R16)** ③ vue-query SSR 水合。

**D20 之后**:
- ✅ **① resizable 保留**(与渲染策略无关)
- ✅ 🔴 **② R16 必须保留** —— 它测的是 **Nitro 作为代理**转发 SSE 的能力,**与页面是否 SSR 完全无关**。
  **不要因为改成 CSR 就跳过这个实验**(§2.9.4 已特别标注)
- ❌ **③ vue-query SSR 水合 → 取消**,产品区 CSR 不需要;🔴 **D24 后改为 server-state contract fixture**
- 🔴 **新增:Nitro 鉴权中间件 PoC** —— 验证 `server/middleware/auth.ts` 能在返回 HTML 前读 cookie 并 302(§2.9.3 方案 B)。这是 D20 唯一新增的架构风险点
  → 已写入 11 号 §6 P0 的建议执行顺序与关键风险

#### ✅ ⑩ 目录树按 D20 补齐 —— 已完成

§3.2 的 354 行目录树已补齐(参照 `nuxt-modern-starter` 的形态):
- `config/routes.ts` —— **渲染策略单一来源**(`prerenderRoutes` / `swrRouteRules` / `csrRouteRules`)
- `server/middleware/auth.ts` —— Nitro 鉴权中间件
- `nuxt.config.ts` 的 `routeRules` 消费段

**状态**:本轮到此停止,尚未开 P0,也未建 `frontend-vue/`。

---

### 第三梯队:已清空,只剩 O15 远期项

> ✅ O5/O6/O11/O17 已定案为 D16–D19,O2 已转为结论。这里保留为历史提醒:
> 当前不要再把它们当待决项。

| 项 | 内容 | 影响 |
| --- | --- | --- |
| **O15** | 是否做 v2 共享包 | 远期 |

---

### 明确**不要**做的事

| ❌ | 原因 |
| --- | --- |
| 改 `01`–`10` 号文档 | React 现状快照,提 Tailwind 是对的(见 §〇 文档职责边界) |
| 重新论证 D2(antdv)/ D5(砍无障碍)/ D7(禁改范围)/ D15(SCSS) | 用户拍定,且我已提过反对意见并记录了代价 |
| 重编 §2.5.x 小节号 | 被 4 处引用;§2.4 空洞已由 D15 分析填上,**编号现在是连的** |
| 追求把工期区间做窄 | O5 已由 D16 关闭;剩余区间要靠 P0/P2 的实测速率与 resizable go/no-go 收敛 |
| 开始写代码 / 建 `frontend-vue/` | 本轮是文档优化轮,**等用户明确说开工** |
