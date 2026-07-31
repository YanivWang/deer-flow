# 11 · Vue/Nuxt 前端对标建设方案(待审核)

> **状态**:草案 **v4**(2026-07-31),待评审
> **v2 变更**(彻底修复):新增 **D13**(溯源校验两层 + `threads/hooks.ts` 拆分规格)、
> **D14**(验收拆成 UI 层 + 代理层);修正 6 处记账不一致;
> 新增风险 **R16**(Nitro 无缓冲 SSE)/ **R17**(拆分语义漂移)。
> **v3 变更**:🔴 **D15 —— 弃用 Tailwind CSS 4,改用 SCSS**(用户决定)。
> 新增 **§2.4** 影响分析(顺带填上原 §2.4 编号空洞);新增风险 **R18**(视觉对标漂移);
> spec 改动 5 → **7 处**;**工期口径变了:`6–10` → `≈7–12 人月`,3 人 `5–7.5 个月`**。
> **v3.1 变更**:🔴 **D21 —— 不装 `ai` 包,本地手写最小类型**。
> `ai` 在 React 版仅作 `import type`,零运行时代码;Vue 侧改为 `app/core/ai-types.ts`。
> **v3.2 变更**:🔴 **D22 —— 流处理必须手写,不装 `@langchain/langgraph-sdk`**。
> 当前 Gateway 的 LangGraph-compatible SSE 只作为 **DeerFlow Gateway adapter** 的输入协议,
> 前端内部统一转成自有 canonical stream event,为未来非 LangGraph 后端保留替换空间。
> **v3.3 变更**:🔴 **D23 —— 不装 `@langchain/core`,本地手写 `ToolCall` 最小类型**。
> React 版实测仅 1 处 `import type { ToolCall } from "@langchain/core/messages"`,
> 零运行时代码;Vue manifest 降为 **60 个直接依赖**。
> **v3.4 变更**:🔴 **D24 —— 不装 `@tanstack/vue-query`,自研 server-state 层**。
> React 版实测 `@tanstack/react-query` 运行时用在 16 个源码文件,需覆盖 query/mutation/infinite query、
> `invalidateQueries` 与 `setQueryData`;Vue manifest 降为 **59 个直接依赖**。
> **v3.5 变更**:🔴 **D25 —— 清掉 9 个 React 迁移惯性/小众包**。
> 不装 `motion-v` / `@vueuse/core` / `@vue-flow/core` / `canvas-confetti` /
> `@uiw/codemirror-theme-*` / `nanoid` / `uuid` / `tokenlens`;Vue manifest 降为 **50 个直接依赖**。
> 详见 §0.4 决策表、**§2.4**、§10 判断。
>
> ---
>
> 🔴 **v4 变更(2026-07-31 第八轮 · 外部现实核对)**。前七轮把**内部一致性**做到了很高的水平,
> 本轮改的全部是**外部现实**:上游演进速度、依赖的社区健康度、以及"少装包"越推越远之后的复合成本。
> 六项实测结论,其中三项若不改会在 P0 第一周或上线当天卡住:
>
> | # | 变更 | 性质 |
> | --- | --- | --- |
> | 🔴 **D26** | **上游冻结政策**(新):项目期间只 merge `backend/` + 安全补丁,`frontend/` 完全冻结 | **全案最大的未定价风险**。实测 `frontend/src` 近 6 个月**文件级 100% 翻动**(453 唯一文件 / 389 现存文件),月中位数 +6,500 行。**风险 R6 由「概率中/影响低」上调为「概率必然/影响高」**。详见 **§2.10** |
> | 🔴 **D25-a** | **修订 D25**:① `crypto.randomUUID()` 是 **secure-context-only**,内网 HTTP `:2027` 下是 `undefined` → **新建 thread 直接报错**,改回 `uuid` 包或写 `getRandomValues` 回退;② **保留 `@vueuse/core`** | **上线当天会炸的卡点**。详见 **§2.4.6** |
> | 🔴 **D13-a** | **补第六类偏离 `DETYPED`**:实测 **13 个 core 文件 / 3,185 行** import `@langchain/langgraph-sdk` 或 `ai` 但不 import react,被误算进 Tier 1 → **逐字节复制 10,400 → ≈7,215 行** | **`core-provenance.test.ts` 第一天就报红**。与 i18n/lucide-react 那次**同一个根因**。详见 **§3.1.4** |
> | 🔴 **D24-a** | **推翻 D24**:装 `@tanstack/vue-query`,不自研 `ServerStateClient` | 实测 peer 只有 `vue ^2.6\|\|^3.3`,**零 React 依赖**;而自研面是 38 useQuery/40 useMutation/57 invalidateQueries + 7 类选项。详见 **§2.8.7** |
> | 🔴 **D11-a** | **修订 D11**:新增 **path-filtered** workflow,关闭风险 R14 | 实测 `.github/workflows/` 14 个 workflow **全部按 `paths:` 过滤** → 新建一个 `paths: frontend-vue/**` 的文件**零修改现有文件、不触发任何现有流水线**,与 D10 同构。详见 **§3.2.4** |
> | ✅ **两处减负** | ① `hast-util-to-jsx-runtime` **不是 React 专有**(peer 为 `null`),`vue` 有 `./jsx-runtime` → **P4 渲染末端可能不必自研**;② `splitpanes` **同时 emit `resize` 与 `resized`** → **风险 R4 概率下调** | 都加成 P0 的半天二元实验。详见 **§4.2.5**、**§2.3.2** |
>
> **口径影响**:详见 §7 的修正记录 ⑨–⑫。**依赖数 50 → 53**。
> **目标**:在不改动后端的前提下,建设一个 **100% 纯 Vue** 的前端,功能与现有
> `frontend/`(React/Next)完全对标。
> **前置阅读**:本目录 01–10。本方案大量引用其中的事实与红线编号。

---

## 0. 目标与边界

### 0.1 硬性目标
| 项 | 要求 |
| --- | --- |
| 技术栈 | 100% Vue,**零 React 运行时**(不接受 veaury 之类的 React 岛) |
| 功能 | 与当前 `frontend/` **完全对标**,不做功能增减 |
| 后端 | **不动**。Gateway 契约、SSE 协议、鉴权模型全部保持 |
| 交付对象 | 公司内部使用 |

### 0.2 明确的非目标
- 不重新设计交互与信息架构(对标优先,优化留到 v2)
- 不改后端任何接口(哪怕现有接口有瑕疵,如 §10.5 提到的 409 字符串匹配)
- 不承诺跟随上游 `bytedance/deer-flow` 的前端演进(已由 **D4** 冻结基线)

### 0.3 并存策略(建议)

**D7 已定:唯一可改动的目录是 `frontend-vue/`。**

```
deer-flow/
├── frontend/            ← 🔒 禁止改动。React 版,作为「行为基准」和参照实现
├── frontend-vue/        ← ✅ 可改动。Nuxt 版,交付物(自包含)
├── docker-vue/          ← ✅ 可改动。新建(D10):部署 compose,零修改现有文件
├── backend/             ← 🔒 禁止改动
├── docker/  Makefile  pnpm-workspace.yaml  .github/   ← 🔒 已有文件禁止改动
└── (不新建 packages/)
```

> **D10 修订**:可**新建**顶层目录,新目录内不限;**已有文件仍尽量不改** ——
> 确有必要时须先说明「为什么没有新建目录的替代方案」,由用户逐次批准。

保留 React 版的三个理由:
1. **行为基准**:对标时可以两边并排跑,逐屏 diff。"功能完全一样"从主观判断变成可对照。
2. **E2E 双跑**:同一套 spec 可以先在 React 版跑绿(证明 spec 本身没问题),再指向 Vue 版。
3. **回退路径**:Vue 版未达标前,生产可继续用 React 版。

上线后是否删除 `frontend/`,留到 v2 决策。

> D7 使「并存」从一个**建议**变成**硬约束**:Vue 版必须完全自包含,
> 与 React 版零耦合(不共享代码、不共享构建、不共享 CI)。

### 0.4 决策记录(已定稿)

| # | 决策 | 结论 | 日期 |
| --- | --- | --- | --- |
| ~~D1~~ | ~~渲染模式~~ | ~~**Nuxt + SSR**。鉴权五态在服务端完成,`locale`/`sidebar_state` 服务端读取~~ → 🔴 **已被 D20 修订为「产品区全 CSR + 营销区预留 SSR」**。仍用 Nuxt,但 `routeRules` 设 `ssr:false`;鉴权改由 **Nitro server middleware** 承担(见 §2.9) | 2026-07-30<br>2026-07-31 修订 |
| D2 | UI 组件库 | **Ant Design Vue** | 2026-07-30 |
| D3 | ~~共享层~~ | ~~pnpm workspace 共享包~~ → **已被 D7 否决**,改为自包含复制 | 2026-07-30 |
| D4 | 对标基线 | **冻结 `main-wc` 当前 HEAD `16ea3a4d`** 为 v1 基线,后续上游变更进 v2 待办 | 2026-07-30 |
| 🔄 **D4-a** | **基线首次漂移,已重新冻结为 `b71a892b`** | 🔴 **2026-07-31:D4 的「零变动」前提已失效**。`main` 合入 `main-wc`(6 个前端提交:#4577/#4578/#4580/#4582/#4584/#4587),实测 `git diff 16ea3a4d..HEAD -- frontend/src frontend/tests` = **18 文件 / +768 −99**。<br>✅ **处置:基线前移到 `b71a892b`,本次变更计入 v1 而非 v2**(用户已主动合入,属既成 v1 范围)。§1.0 / §3.1 全部资产数字已按新基线实测刷新。<br>🔴 **其中一条改变了既有决策**:`0d8e11ad` 修掉了 `autoOpen` 跨 thread 粘滞 → **O17 关闭、D18 理由反转**(见 D18)。<br>⚠️ **后续仍按 D4 原则**:再有上游变更进 v2 待办,不再随合随改;若需保持 v1 冻结在 `16ea3a4d`,请改回并撤销本次数字刷新 | 2026-07-31 |
| D5 | 无障碍标注 | **Vue 版不写任何 `aria-*` 标注**;不为无障碍额外投入(无键盘导航覆盖、读屏实测、WCAG 审计)。**React 版 `frontend/` 一行不动** | 2026-07-30 |
| D6 | 范围裁剪 | **砍 6 项**(landing 落地页、workspace 零引用特效件、blog、docs 站、静态站点 demo 模式、**Mock 演示模式**,共 **4,925 行** + 72 MDX)。**保留**移动端适配、暗色主题、i18n 双语、第 3 类全部可选特性 | 2026-07-30 |
| **D7** | **改动范围** | 🔴 **只能改动 `frontend-vue/` 目录,其余一切不动** —— `frontend/`、`packages/`、根 `pnpm-workspace.yaml`、`Makefile`、`docker/`、`.github/` 全部禁止改动。**否决 D3** | 2026-07-30 |
| **D8** | **`sr-only` 去留** | 🔴 **一并砍掉**。D5 只禁了 `aria-*`,但 `sr-only`(视觉隐藏文本,全库 **24 处**)是同一类无障碍设施 → **彻底不写**。判定依据:对业务功能零影响(见 §0.4 D8 说明)。代价:E2E 需改 **5 处断言 / 3 个 spec**。**关闭 O16** | 2026-07-30 |
| **D9** | **零引用代码清理** | 🔴 **20 个文件 / 2,100 行不移植**。与 D6 性质不同:**D6 砍的是功能(产品决策、可逆),D9 砍的是永不执行的死代码(技术事实、无需判断)**。已用可执行方式证明(§0.5)。清单见 §2.6 | 2026-07-30 |
| **D10** | **放宽 D7:允许新建目录** | ✅ **可新建顶层目录**(如 `docker-vue/`),**新目录内怎么改都行**;**已有文件尽量不改** —— 确有必要时须先提出、说明为什么没有新建目录的替代方案,由用户逐次批准。**解决 O14b(生产暴露)**,设计见 §3.2.2 | 2026-07-30 |
| **D11**<br>🔄 **已被 D11-a 修订** | **不做 GitHub CI** → 🔴 **改为「新增 path-filtered workflow」** | ❌ 原决策:**Vue 版不进 GitHub Actions**(`.github/` 不动)。质量门禁改为 `frontend-vue/Makefile` 的 **`make verify`** + PR 贴输出的人肉约定(§3.2.3)。**关闭 O14a**;代价已登记为风险 **R14**。<br>🔴 **2026-07-31 v4 修订(D11-a)**:实测 14 个现有 workflow 全部按 `paths:` 过滤 → **新建**一个 `paths: frontend-vue/**` 的 workflow 零修改现有文件,**R14 可关闭**。`make verify` 仍保留(本地快门禁),见 **§3.2.4** | 2026-07-30<br>2026-07-31 修订 |
| **D12** | **Vue 侧测试可读 `frontend/`** | ✅ **只读,不改**。允许 `frontend-vue/tests/` 读取 `frontend/src/**` 与 `frontend/tests/**` 做机械比对。D7 禁的是「改动」,读取不冲突,且 §0.3 本来就把 React 版定位为「行为基准」。**使 §3.1 的「两份拷贝必然发散」从人工比对升级为机械拦截**(§3.1.2) | 2026-07-31 |
| **D13** | **溯源校验分两层 + `threads/hooks.ts` 拆分规格** | 🔴 **文件级哈希不足以守住 C 类红线**。实测 `threads/hooks.ts`(3,072 行)有 **53 个导出,仅 13 个是 `use*` hook,另 40 个是非 hook 导出**(36 个纯函数与常量 + 4 个类型:`mergeMessages` / `decideCoalesce` / `STREAM_RENDER_COALESCE_MS` / 历史合并全组),且与 hook **交错分布**(`decideCoalesce`@1012、`upsertThreadInSearchCache`@1128、`useThreadStream`@1341)。该文件**必拆** → 哈希必不等 → D12 恰在红线最密集处失效。改为 **Tier 1 文件级哈希 + Tier 2 导出级提取比对**;拆分规格见 **§3.1.3**,测试设计见 **§3.1.2** | 2026-07-31 |
| **D14** | **验收定义拆成两层** | 🔴 **25 个 spec 全部靠 `mock-api.ts` 的 `page.route()` 拦截,请求在浏览器层就被劫持,永不经过 Nitro 代理** —— 而 D10 去掉 nginx 后新增的三项责任(R15)+ `proxy-policy` 契约全在那一层。即:**全案最新、最无参照、后果最重的基础设施,恰是继承来的验收套件唯一照不到的地方**。验收改为 **①UI 层:25 spec 全绿 + ②代理层:`proxy-contract` 测试 + 4 个真后端 spec**,见 **§1.2** | 2026-07-31 |
| **D15** | **弃用 Tailwind,改用 SCSS** | ❌ **Vue 版不用 Tailwind CSS 4**,样式一律用 **SCSS**(SFC `<style lang="scss" scoped>` + 共享 token/mixin 层)。React 版 `frontend/` 的 Tailwind **一行不动**(D7)。<br>🔴 **CSS 自定义属性必须保留**(115 个):SCSS 变量是**编译期**的,做不到运行时暗色切换,而暗色主题有 E2E 断言(`ui-polish-mobile.spec.ts:49`)不能砍 → **SCSS 是写法层,CSS 变量是运行时 token 层**,两者并存不冲突。<br>✅ **意外收益**:参照工程 `nuxt-modern-starter` 本来就是 SCSS,§2.7.1 的主题链原样可抄,原先「真相源是 Tailwind CSS 变量」那处必须处理的差异**直接消失**。<br>代价与影响面见 **§2.4** | 2026-07-31 |

| 🔴 **D20** | **渲染策略改为「产品区全 CSR + 营销区预留 SSR」**(修订 D1) | ❌ **对话流程/workspace 全部不做 SSR**,用 `routeRules` 设 `ssr: false`。<br>✅ **但仍然用 Nuxt,不退化成纯 Vite SPA** —— 因为**将来要加落地页/价格页/关于我们/新闻页,那些需要 prerender 或 SSR**。纯 SPA 到时候做不了。<br>📐 **完全照搬参照工程 `nuxt-modern-starter` 的分级模型**:`config/routes.ts` 作单一来源 → `nuxt.config.ts` 的 `routeRules` 消费(`prerender` / `SWR 3600s` / `ssr:false`)。它的 `productRoutePatterns = ['/workspace/**','/docs/**','/account']` 与 DeerFlow 产品区高度吻合。<br>✅ **Nitro 保留** —— `ssr:false` 关的是「服务端渲染」,不是「服务端」。D10/R15/R16/D14 的代理层设计**全部不受影响**。<br>详见 **§2.9** | 2026-07-31 |
| 🔴 **D21** | **不装 `ai` 包,本地手写最小类型** | ✅ React 版实测只有 6 处 `from "ai"`,且全部是 `import type`: `Experimental_GeneratedImage` / `FileUIPart` / `UIMessage` / `LanguageModelUsage` / `ChatStatus`。Vue 侧在 `app/core/ai-types.ts` 定义最小结构并把引用改成本地 import。<br>收益:少一个小众纯类型依赖,同时取消 `ai@6` 对 `zod` 下界的 peer 牵制。<br>约束:本地类型只覆盖当前用到的字段;若未来接入 Vercel AI SDK 运行时或新增消息 part,必须重新评估。 | 2026-07-31 |
| 🔴 **D22** | **流处理必须手写,不装 `@langchain/langgraph-sdk`** | ✅ Vue 版不得依赖 LangGraph SDK 的 `runs.stream` / `joinStream` / `useStream` 或其事件规约。<br>✅ 当前后端仍**不改**:保留 `/api/threads/{id}/runs/stream`、`/{run_id}/join`、`Last-Event-ID`、`Content-Location`、`gap`、`end`、`metadata/messages/values/custom` 等 DeerFlow Gateway SSE 语义,由 **DeerFlowGatewayStreamAdapter** 转成前端自有 canonical stream event。<br>✅ 未来后端若不用 LangChain/LangGraph,只需新增 adapter 或保持 canonical event 契约,UI/store 不大改。<br>收益:少一个 React-peer 特例依赖,并把后端框架语义关在 adapter 层。代价:§4.1 的 P3 需先写 manual transport / wire codec / adapter 单测,不能照搬 SDK client。 | 2026-07-31 |
| 🔴 **D23** | **不装 `@langchain/core`,本地手写 `ToolCall` 最小类型** | ✅ React 版实测只有 **1 处** `@langchain/core/messages` 引用:`frontend/src/core/tools/utils.ts:1`,且是 `import type { ToolCall }`,编译期擦除。运行时使用面 **0**。<br>Vue 侧在 `app/core/agent-types.ts` 定义 `ToolCall = { name: string; args: Record<string, unknown>; id?: string }`,满足当前字段使用:`name` / `args.query` / `args.description`。<br>约束:若未来前端开始构造 LangChain message class 或依赖 `ToolCall` 的更完整字段,必须重新评估。依赖数 **61→60**。 | 2026-07-31 |
| ~~🔴 **D24**~~ | ~~**不装 `@tanstack/vue-query`,自研 server-state 层**~~ → 🔴 **已被 D24-a 推翻**(2026-07-31 v4):改为**装 `@tanstack/vue-query`**。以下为原决策留档 | ✅ React 版实测 `@tanstack/react-query` 是运行时依赖,不是纯类型:16 个 `frontend/src` 文件 import,覆盖 `useQuery` / `useMutation` / `useInfiniteQuery` / `useQueryClient` / `invalidateQueries` / `setQueryData`。<br>✅ 参照工程 `nuxt-modern-starter` 实测不用 TanStack Query,走 Pinia + 手写 api 函数,证明 Nuxt 项目不必须引它。<br>Vue 侧在 `app/core/server-state/` 自研最小 `ServerStateClient` + composable 包装,只覆盖 DeerFlow 当前使用面;不做 SSR hydrate/dehydrate,不接 devtools。依赖数 **60→59**。 | 2026-07-31 |
| 🔴 **D25**<br>🔄 **部分被 D25-a 修订** | **清掉 9 个 React 迁移惯性/小众包,改平台 API / CSS / 自研薄层**<br>🔴 **其中 `@vueuse/core` 与 `uuid` 两项已由 D25-a 推翻**,其余 7 项维持 | ✅ 实测后删除:① `motion-v` + `@vueuse/core`:React 版非 landing 只剩 6 处 `motion/react` import,其中 `terminal` / `number-ticker` 已属 D6 砍掉的零引用特效件;存活 `shimmer` / `flip-display` 用 CSS animation / Vue `<Transition>` / RAF 足够。② `@vue-flow/core`:React 版 `@xyflow/react` 只出现在 D9 已砍的 `ai-elements` 零引用画布件(`canvas`/`controls`/`connection`/`edge`/`node`/`panel`/`toolbar`)。③ `canvas-confetti`:仅 `ConfettiButton` 1 处装饰反馈,改 CSS/Canvas 小实现或普通 antdv 成功反馈。④ `@uiw/codemirror-theme-basic` / `-monokai`:Vue 侧已自写 CodeMirror 薄封装,主题改用 CodeMirror 6 原生 `EditorView.theme`。⑤ `nanoid` / `uuid`:分别只有 prompt-input 2 次与本地 `uuid()` 门面,改 `crypto.randomUUID()`。⑥ `tokenlens`:只服务 D9 已砍的 `ai-elements/context` 零引用组件。<br>暂不删 `lucide-vue-next`:非 landing 实测 82 个 `lucide-react` import,且 3,086 行 i18n 词典 value import 图标;可另开 D26 做 Ant Design Icons 迁移评估。依赖数 **59→50**。 | 2026-07-31 |
| **D16** | **O5 定案:团队有 Vue+Nuxt 实战经验** | ✅ 工期按**基准口径**,不加经验不足的 30–50% 上浮 → **54 周 / 13.5 人月的尾部情景消除**。<br>⚠️ **但区间仍是 27–48 周** —— 剩余跨度不再来自"人不确定",而是两个**已识别且各有处置**的项:**D15 的 +3–6 周**(`⚠️待P2校准`)与 **resizable no-go 的 +2–3 周**(已由 D19 预授权)。**这比"区间变窄"更有用:上界现在是可管理的,不是未知的** | 2026-07-31 |
| **D17** | **O6 定案:全盘接受 §1.3 五条约束** | ✅ 五条**写进开发规范 + PR 模板**,作为硬性检查项。这是继承 22,400 行资产(占总工作面 **43%**)的前提。<br>✅ **其中四条可机械化**(§2.7.6):testid 集合比对 / 禁 `<div @click>` / 路由表比对 / cookie 名 → 做成 `tests/guards/` 进快门禁,**不靠人肉 review**(同时缓解风险 R9、R14) | 2026-07-31 |
| **D18** | **O17 定案:`autoOpen` 切 thread 时重置为 `true`** | ✅ **决策不变,但理由已反转 —— 上游 React 版已收敛到同一行为,这不再是"有意差异"**。<br>🔴 **2026-07-31 复核(合入 main `0d8e11ad` 后)**:React 版新增了 pathname 水合 effect,`artifacts/context.tsx:98` 会把 `autoOpen` 设回 `true`。当前全库 3 处 `setAutoOpen`:`:84`(useState)/ `:98`(`true`)/ `:145`(`false`)。聊天路由为 `/workspace/chats/[thread_id]`,客户端切 thread 即变 pathname → effect 触发 → **O17 描述的跨 thread 粘滞在上游已不存在**。<br>✅ **代价仍为 0 处 spec 改动**:25 个 spec 之间用整页 `page.goto()` 导航(全量重载,状态本就重置)。<br>🔄 **原「必须登记为已知对标差异」的告警作废** —— 反过来:Vue 侧若**不**重置才是缺陷,R18 的逐屏 diff 应按"对齐"判定。`resetForThreadSwitch()` 仍包含该字段(§3.3.1 约定 3) | 2026-07-31 |
| **D19** | **O11 定案:预授权 resizable 自研 2–3 周** | ✅ P0 的 go/no-go 若为 **no-go,直接进入自研,不再等第二轮审批**。理由:resizable 承载 **08 号 §8.3 的 5 条布局红线**(= 红线 `P1–P5`)+ issue #4465,是 P5 的硬前提;审批周期若落在关键路径上,代价高于预算本身。<br>⚠️ 该 2–3 周**已含在 27–48 周的上界里**,不是额外追加。<br>🔄 **2026-07-31 v4 复核**:`splitpanes@4.1.2` 实测**已 emit `resize` 与 `resized` 两类事件**,该预算被触发的概率下降,见 **§2.3.2** | 2026-07-31 |
| 🔄 **D4-b** | **基线第二次前移,已重新冻结为 `b71a892b`** | ✅ **2026-07-31,用户再次合入 main。与 D4-a 那次完全不同 —— 这次 `frontend/` 零漂移。**<br>实测 `git diff f204d2cb..b71a892b -- frontend/` = **空**;该 merge 只动了 `backend/`(测试为主)、`docker/`、`deploy/`、`scripts/`,共 65 文件 / +4,813 −585,**没有一个字节落在 `frontend/`**。<br>✅ **后果:全部资产数字保持不变** —— 已按铁律 1 在新基线上复核 `frontend/src` **56,484 行**、`core` **143 个 / 19,001 行**、`threads/hooks.ts` **3,072 行**、E2E **27 个 spec**,与 D4-a 时点分毫不差。<br>🔴 **这同时是 D26 方案 (b) 的第一次真实验证** —— "只 merge backend、frontend 冻结"不是理论,**这次 merge 天然就是这个形态**。<br>📌 对照 **D4-a**(18 文件 / +768 −99,需全量刷新数字并连带关闭 O17):**同样是"合入 main",代价可以差一个数量级 —— 这正是 D26 要管住的东西** | 2026-07-31 |
| 🔴 **D26** | **上游冻结政策:项目期间只 merge `backend/` + 安全补丁,`frontend/` 完全冻结** | 🔴 **这是 v4 补上的、全案最大的未定价风险。D4 只冻结了"对标基线",没有冻结"上游会不会继续动"。**<br>**实测**(`frontend/src`,近 6 个月):月新增行 `4,935 / 6,326 / 14,653 / 4,023 / 6,657 / 22,815`(中位数 **≈6,500**,均值 **≈9,900**),提交 36–114/月;**被改动过的唯一文件 453 个,而当前总文件只有 389 个 → 文件级 100% 翻动**;当前 `frontend/src` 共 **56,484 行**。<br>按工期 5–7.5 个月推算,上线时 React 版将多出 **33,000–74,000 行**改动,**量级与整个代码库相当**。<br>⚠️ **2026-07 改动最大的文件恰好全在 P3/P5 关键路径上**:`threads/hooks.ts` **+2,181**、`input-box.tsx` +1,905、`message-list.tsx` +1,485、`sidecar-panel.tsx` +1,049 —— 也就是说 **D13 的拆分规格与 Tier 2 溯源比对会被持续冲刷**。<br>🔴 **这是唯一一个 P0 五个实验全部测不出来的风险**,也是 D4「进 v2 待办」无法真正消化的成本。<br>✅ 🔴 **2026-07-31 用户定案:选 (b)**(「按你推荐方案来」)—— 项目期间 `backend/` 与安全补丁照常 merge,**`frontend/` 完全冻结在 `b71a892b`**。**O18 关闭。**<br>✅ **当天即完成第一次验证**:用户随后合入 main 产生 `b71a892b`,实测 `frontend/` **零漂移**(见 **D4-b**)—— 政策与实际操作天然一致。三个候选与取舍见 **§2.10** | 2026-07-31<br>**用户定案** |
| 🔄 **D24-a** | **推翻 D24:装 `@tanstack/vue-query`,不自研 `ServerStateClient`** | 🔴 **D24 越过了"少装包"的收益拐点。**<br>**实测替代品健康度**:`@tanstack/vue-query@5.101.4`,`peerDependencies` 只有 `vue ^2.6.0 \|\| ^3.3.0`(外加 Vue2 才用的 `@vue/composition-api`),**零 React 依赖**,与 `query-core` 同版本号发布,是官方一等公民。<br>**实测自研面**(限 16 个 import 文件内):`useQuery` 38 / `useMutation` 40 / `useInfiniteQuery` 3 / `invalidateQueries` 57 / `setQueryData` 8 / `useQueryClient` 41;选项 `enabled` 48 / `staleTime` 9 / `retry` 9 / `refetchOnWindowFocus` 8 / `refetchOnMount` 2 / `refetchInterval` 2 / `select` 2。<br>🔴 **§4.4 给的 P0 fixture 只有 0.5–1 天,而正文自陈"周数等 P0 后再回填" —— 这是全案唯一一个连量级都没有的自研件**,却压在 P2 关键路径上。<br>📌 **与 D22 的界线**:**D22 隔离的是会变的后端协议(对),D24 重造的是不会变的通用基础设施(不对)** —— D22 保留。详见 **§2.8.7** | 2026-07-31 |
| 🔄 **D25-a** | **修订 D25:保留 `@vueuse/core`;`uuid` 必须写 secure-context 安全实现** | 🔴 **① `crypto.randomUUID()` 是 secure-context-only API** —— `docker-vue/` 形态是 `http://<内网地址>:2027`(现有 nginx 实测 `listen 2026`,无 TLS)→ **除 `localhost` 外所有同事访问时它是 `undefined`**。而 `uuid()` 的使用面不是装饰性的:它负责**新建 thread 的 ID**(`use-thread-chat.ts` 5 处 + `agents/new/page.tsx:93` 1 处)→ **新建会话直接报错**。<br>📌 **佐证:这个仓库已经踩过同类坑** —— `core/clipboard.ts` 专门写了 `document.execCommand` 回退,正因为 `navigator.clipboard` 同样是 secure-context-only。<br>✅ **修法**:保留 `uuid` 包(零 React 耦合,成本最低),或本地 `id.ts` 写成 `crypto.randomUUID?.() ?? 基于 crypto.getRandomValues 的 v4`(`getRandomValues` **不**受 secure context 限制)。**不能只写 `crypto.randomUUID()`**。<br>🔴 **② 保留 `@vueuse/core`** —— 实测 `14.4.0` **2026-07-29 仍在发版**,是 Vue 生态事实标准;砍它换来的是自己写 17 个文件里的 ResizeObserver / matchMedia / storage / 事件监听封装。**这不是"React 迁移惯性",Vue 项目本来就装它**。<br>✅ **D25 其余 7 项维持**(`motion-v` / `@vue-flow/core` / `canvas-confetti` / `@uiw/codemirror-theme-*` / `nanoid` / `tokenlens`)。详见 **§2.4.6** | 2026-07-31 |
| 🔄 **D13-a** | **补第六类偏离 `DETYPED`,并修正 Tier 1 行数** | 🔴 **D21/D22/D23 连续删包之后,「core 纯 TS 无 React 依赖」这次测量没有重跑。**<br>**实测**:`core/` 里有 **13 个文件 / 3,185 行**既不 import react、又 import 了 D21/D22 要删的包,方案把它们全部算进了「Tier 1 逐字节复制 10,400 行」→ **Tier 1 应修正为 ≈7,215 行**,且 `core-provenance.test.ts` 的 Tier 1 哈希**会在第一天对这 13 个文件报红**。<br>📌 **与 i18n/lucide-react 那次是同一个根因**(原始"无 React 依赖"是按 `from "react"` 量的),当时只修了 lucide-react 那一处。<br>✅ 新增第六类 **DETYPED**(只改类型 import 的文件),走 Tier 2 导出级比对。清单与算术见 **§3.1.4** | 2026-07-31 |
| 🔄 **D11-a**<br>✅ **用户定案** | **修订 D11:新增 path-filtered workflow,关闭风险 R14** | ✅ 🔴 **2026-07-31 用户定案:接受**(「按你推荐方案来」)。**O19 关闭。**<br>🔴 **R14(无 CI 门禁)是自设约束。**<br>**实测**:`.github/workflows/` 下 **14 个 workflow 全部按 `paths:` 过滤**(`e2e-tests.yml` 只在 `frontend/**` 触发,`backend-*.yml` 只在 `backend/**`)。<br>✅ 新增 `frontend-vue-verify.yml`(`paths: frontend-vue/**`)= **新建文件、零修改任何现有文件、不触发任何现有流水线** —— **与 D10 批准 `docker-vue/` 的逻辑完全同构**。<br>📌 R14 原评「中高概率 / 高影响」,缓解手段是"第二个人在自己机器上跑一遍并签字"。**用一个新文件换掉它,性价比高于风险表里任何一项**。落盘时机:P0 建出 `frontend-vue/` 之后。详见 **§3.2.4** | 2026-07-31 |

> 📌 **授权来源要分清**:
> - **D1–D12、D15、D16–D25 由用户逐项拍板**,不要重新讨论。
> - **D13 / D14 是用户在 2026-07-31 指示「按最佳实践彻底修复,确保落地时无阻塞项」后,
>   由我依据实测数据定的** —— 只改**实现方式**,不改任何既有决策的方向
>   (D13 是 D12 的正确实现形态,D14 是 §1.2 的精确化)。**用户可随时推翻。**
> - 🔴 **D26 / D24-a / D25-a / D13-a / D11-a(v4)是用户 2026-07-31 说「按照你推荐的来进行修复」后落的。**
>   授权性质分两档,复核时请分开看:
>
>   | 决策 | 性质 | 状态 |
>   | --- | --- | --- |
>   | **D25-a ①**(`crypto.randomUUID` secure-context)、**D13-a**(DETYPED) | **技术事实纠错** —— 不改方向,不照做会在上线当天/P0 第一天卡住 | ✅ 已落地。事实层面无可选项,只能选修法 |
>   | 🔴 **D26**(上游冻结,选 (b))、**D24-a**(装 vue-query)、**D25-a ②**(留 `@vueuse/core`)、**D11-a**(上 CI) | **推翻或修订用户此前拍板的方向**(D4 延伸 / D24 / D25 / D11) | ✅ 🔴 **2026-07-31 用户已逐条确认**(「按你推荐方案来」)。**O18 / O19 均已关闭** |
>
>   ✅ **至此 v4 无待决项。** 若日后要推翻其中任何一条,证据分别在
>   **§2.10**(D26)/ **§2.8.7**(D24-a)/ **§2.4.6**(D25-a)/ **§3.2.4**(D11-a)。

> ⚠️ **D6 的「Mock」指 `app/mock/api/` 演示模式(472 行),不是 E2E 的假后端。**
> `tests/e2e/utils/mock-api.ts`(1,411 行,走 Playwright `page.route()` 拦截)
> 是本方案的核心资产,**必须复制保留** —— 两者互不相关,极易混淆。

#### D7 的连带影响(方案已按此重写)

| 受影响处 | 变化 |
| --- | --- |
| **D3 共享包** | ❌ 作废。`packages/` 与根 `pnpm-workspace.yaml` 均在范围外 → 改为**把 `core/` 纯 TS 复制进 `frontend-vue/app/core/`**(§3.1) |
| **P1** | 从「抽共享包」(2–3 周)降为「复制 + 3 处适配」(**约 3 天**) |
| **§10 的核心论证** | 原判断「必须先做 P1,否则放弃 37% 资产」**不再成立** —— 资产仍可继承,但靠复制而非共享 |
| **`threads/hooks.ts` 技术债** | §10.2① 的 3,072 行拆分**不再顺带偿还**;Vue 侧自行拆,React 侧原样保留 |
| **Nginx 接入** | `docker/nginx/` 的**已有文件**不改 → Vue 版**独立起服务**,靠 Nuxt `routeRules` 代理到 Gateway(§3.2.1)。**D10 后新增 `docker-vue/` 做容器化部署(:2027),仍零修改现有文件**(§3.2.2)|
| **CI** | `.github/` 不动 → **D11 已定:不做 GitHub CI**,改 `frontend-vue/Makefile` 的 `make verify` + PR 贴输出(§3.2.3)。代价见风险 **R14** |
| **E2E spec** | 必须**复制**进 `frontend-vue/tests/e2e/`(原计划已如此,与 D7 一致) |
| **O4**(PR 回上游) | ❌ 作废 |
| **长期代价** | 两份 13,486 行拷贝并存;§5 C 类的 29 条红线不变量分两处维护,必然发散(§3.1 已记录) |

### 0.5 D9 的可执行证明(2026-07-30 实跑)

D9 不是静态分析的推断,是**跑出来的**。方法:把 `frontend/` 复制到 `/tmp` 一份
throwaway 副本(`node_modules` 用 APFS clonefile,14 秒),**在副本上删掉那 20 个文件**,
跑完整流水线。`frontend/` 全程零改动(D7 未被越界,git 已验证)。

| 验证 | 结果 |
| --- | --- |
| 基线 `tsc --noEmit`(未删任何文件) | ✅ 通过 |
| 删 20 个文件后 `tsc --noEmit` | ✅ **通过** —— 证明无任何文件 import 这些模块 |
| 单元测试(`rstest run`) | ✅ **880 passed / 0 failed** |
| `next build`(生产构建,Turbopack 全模块图追踪) | ✅ **通过**,全部路由正常产出 |
| **E2E 全量 26 spec / 123 用例** | ✅ **123 passed** |

> ⚠️ **一次 flake 的处理过程(留档)**:首轮并行跑出现 1 个失败 ——
> `sidecar-chat.spec.ts:1132`「opens restored side chat history without animated scroll」。
> 该用例是时序敏感的动画守门人。处置:① 串行单跑 **3/3 通过**;
> ② 全量并行重跑 **123/123 通过**。→ 判定为**并行时序 flake,与删除无关**。
> **这条 flake 本身值得记下**:它在 React 版就存在,Vue 版重写时会再遇到,
> 且它守的是红线 P2/P3(动画期间不得回流消息列表)。

**证明强度**:`next build` 用 Turbopack 追踪完整模块图 —— 若这 20 个文件中任何一个可达,
构建会失败。E2E 123 用例全绿则证明运行时行为未变。**这不是"影响很小",是行为差异为 0。**

#### D5 + D8 的边界(必须写进开发规范,极易误解)

D5/D8 去掉的是**无障碍标注**,**不是**"不用语义化标签"。两者后果差一个数量级:

| | 含义 | 数量 | E2E 影响 |
| --- | --- | --- | --- |
| ✅ **去掉(D5)** | 全部 **15 种** `aria-*` 属性:`aria-label`(48)/`aria-hidden`(25)/`aria-invalid`(24)/`aria-describedby`(9)/`aria-disabled`(7)/`aria-live`(6)/`aria-pressed`(4)/`aria-labelledby`(3)/其余 7 种共 10 处 | **136 处** | 2 处调用 |
| ✅ **去掉(D8)** | `sr-only` 视觉隐藏文本(`<span class="sr-only">`、`<SheetHeader class="sr-only">`、`<DialogTitle class="sr-only">`) | **24 处** | 3 处调用 |
| ❌ **不要动** | 继续用 `<button>` `<a>` `<input>` `<h1-6>` 等语义化标签;继续用 antdv 组件(`a-button` 等) | 覆盖 **83/122** 次断言的 **role** | 若改成 `<div @click>`,**废掉 83 次断言**,且需自行补 `tabindex` / 回车空格键处理 / 禁用态,是净负债 |

> **一句话规范**:「**不写 `aria-*`、不写 `sr-only`**,但该用 `<button>` 的地方就用 `<button>`。」

⚠️ **别把「83 次 role 天然对齐」和「name 从哪来」搞混**:83 次的 **role** 来自原生标签,
D5/D8 不影响;但其中 **4 次的 `{ name }`** 原本靠 `aria-label`/`sr-only` 提供,这 4 次要改 testid。

#### D5 + D8 + D15 的实际代价:4 个 spec、**7 处**调用(已全量核对)

`sr-only` 的 24 条文本、以及 E2E 里全部 8 处 class 选择器,都在 32 个 spec 里逐条搜过。
完整清单如下,**没有第 8 处**:

| # | spec | 行 | 断言 | 来源 | 触发者 |
| --- | --- | --- | --- | --- | --- |
| 1 | `agent-chat.spec.ts` | 167 | `getByRole("button", { name: "Regenerate" })` | `message-list.tsx:877` `aria-label` | **D5** |
| 2 | `agent-chat.spec.ts` | 305 | `getByRole("button", { name: "Edit and rerun" })` | `message-list-item.tsx:246` `aria-label` | **D5** |
| 3 | `thread-list-pin.spec.ts` | 47 | `getByRole("button", { name: "More" })` | `recent-chat-list.tsx:317` `sr-only` span | **D8** |
| 4 | `thread-list-pin.spec.ts` | 55 | 同上 | 同上 | **D8** |
| 5 | `ui-polish-mobile.spec.ts` | 41 | `getByRole("dialog", { name: /artifacts/i })` | `chat-box.tsx:375` `sr-only` `SheetTitle` | **D8** |
| **6** | `chat.spec.ts` | **481** | `locator("span.font-medium", { hasText: … })` | `font-medium` 是 **Tailwind 工具类** | 🔴 **D15** |
| **7** | `chat.spec.ts` | **500** | 同上 | 同上 | 🔴 **D15** |

**全部改为 `getByTestId`**(testid 完全由我们掌控)。改动落在 Vue 版自己的 spec 副本上。

> ✅ **两处易误判的排除(D15)**:E2E 里按 class 选元素共 8 处,除上面 2 处外 ——
> `a.nextra-card`(×2)在 **D6 已砍的** `docs-localized-links.spec.ts` 里,不在 24 个对标目标内;
> `.is-user` / `.is-user .katex`(×4)是 `message.tsx:32` 显式写的**语义类**(`.katex` 来自 KaTeX 库),
> **与样式方案无关,SCSS 下照样保留**。详见 §2.4.2。

**其余 sr-only 文本 E2E 零引用,可直接删**:`Close`、`Remove`、`Sidebar`、`Toggle Sidebar`、
`Toggle plan`、`Previous slide`、`Next slide`、`humanInput.otherLabel`、`sidebar.agentsDisabledTooltip`。

> ✅ **一处易误判的排除**:`agents-feature-disabled.spec.ts:38/79/89` 断言
> `getByText(/contact your administrator|联系管理员/i)`,看似可能命中
> `workspace-nav-chat-list.tsx:67` 的 sr-only span —— **实际不会**,该 span 的文案是
> `agentsDisabledTooltip = "Feature not enabled"`,与断言正则不匹配。断言命中的是
> agents 页自己的禁用提示。**该 spec 不受影响。**

#### D8 的两个连带收益

**① 移除了一个 P0 实测项(原风险 R12)**
`getByRole("dialog", { name })` 共 **13 次**,全靠 `DialogTitle` 提供名字。
其中 **12 次标题可见**(如 `settings-dialog.tsx:122`),只有移动端 artifacts sheet 用 `sr-only` 标题。
砍掉后**不再需要** antdv `a-modal` 支持"视觉隐藏但有 accessible name 的标题" —— 这个能力要求消失。
⚠️ **但剩下的 12 次仍是 P0 实测项**:我们自己不写任何 `aria-*` 后,
这 12 次的 name 完全依赖 **antdv `a-modal` 内部**是否把 title 接成 accessible name(§2.3.4 / P0 ⑦)。

**② `AuroraText` 变简单,还消掉一处 `getByText` 二义性**
现状是**同一份文本在 DOM 里出现两次**:
```html
<span class="sr-only">{children}</span>              <!-- D8 砍 -->
<span aria-hidden="true" class="...gradient">{children}</span>   <!-- D5 砍 aria-hidden -->
```
D5+D8 之后只剩一个渐变 span,文本只出现一次。
(`aurora-text` 在 D6 后仍存活 —— `workspace/welcome.tsx:55` 在用,landing 那两处已随 D6 砍掉。)

⚠️ **这 2 处改动落在 Vue 版自己的 spec 副本上**(见 §1.2 修订),
`frontend/tests/e2e/` 原文件不动,符合 D5 的「React 版一行不动」。

> D2 与本方案原推荐(reka-ui)不同。§2.3 是针对该决策补做的影响分析与应对,
> 已相应调整 §1.3 验收约束和 §8 风险登记册。**评审时请重点看 §2.3。**

---

## 1. 核心策略:以现有测试套件作为可执行规格

这是整个方案的骨架。我在核实中发现了一个被低估的资产:

### 1.0 🔴 总表:哪些能复用、哪些必须重写(v3 新增,**实现前先看这张**)

> **此前这个答案散在 6 个章节里**(§1.1 / §2.8.1 / §3.1 / §4 / §5 / §2.3.1.1),
> 实现的人要自己拼。本表是唯一的合并视图,**每一格都标了权威出处**。
> ⚠️ 数字与各章节一致,五层账目已机械核对闭合。

#### ✅ 第 1 档 · 逐字节复制,零改动 —— 🔴 **15,832 行**(v4 修正,旧值 19,017 已作废)

| 资产 | 量 | 为什么能复用 | 出处 |
| --- | --- | --- | --- |
| **`tests/e2e/utils/mock-api.ts`** | **1,411 行** | 完整的模拟后端,纯 TS + Playwright API,与前端框架无关 | §1.1 |
| **25 个 E2E spec** | **7,206 行** | 全黑盒断言(`getByRole`/`getByText`/`getByTestId`),**不碰实现** | §1.2 |
| **`core/` 纯 TS** | 🔴 **7,215 行**(旧写 10,400) | 无任何 React 依赖(已 dist 级验证)。<br>⚠️ **v4 更正**:另有 **13 个文件 / 3,185 行** import `@langchain/langgraph-sdk` 或 `ai`,**只改类型 import 但哈希必不等** → 已移入第 2 档的 **DETYPED**(**§3.1.4**) | §3.1 / **§3.1.4** |
| **Vue manifest** | 🔴 **53 个直接依赖**(v4:50 **+3**) | D21–D25 删 13 个包后为 50;**D24-a / D25-a 加回 `@tanstack/vue-query` / `@vueuse/core` / `uuid`** → **31 dependencies + 22 devDependencies** | **§2.8.3** / **§2.8.7** / **§2.4.6** |

> 🔴 **D22 修订**:`@langchain/langgraph-sdk` 不再作为 Vue 运行时依赖。
> 它仍是 React 版现状与后端兼容协议的参照,但 `frontend-vue/` 内不得 import 整个包。

#### ✍️ 第 2 档 · 改几行就能用 —— 🔴 **6,453 行**(v4:3,268 **+3,185**)

| 资产 | 量 | 改什么 | 出处 |
| --- | --- | --- | --- |
| **i18n 词典 3 件** | **3,086 行** | 🔴 只改 import:`lucide-react` → `lucide-vue-next`(⚠️ P1 须核实 8 个图标同名) | §3.1 |
| 🔴 **DETYPED:12 个文件**(**v4 新增**) | **3,185 行** | 🔴 只改类型 import:`@langchain/langgraph-sdk`(11 个)/ `ai`(1 个)→ 本地类型。<br>⚠️ **但类型本身要先有** —— 见 **§4.1.5** | **§3.1.4** |
| **3 处 Next→Nuxt 适配** | **182 行** | `cookies()` → `useRequestHeaders`;`@/env` → `useRuntimeConfig()` | §3.1 |
| **4 个 `isMock` 文件** | 局部 | D6 删演示分支 | §3.1.2 |
| **`threads/hooks.ts` 的 40 个非 hook 导出** | 约 930 行 | **只搬不改**,按导出名拆到 3 个文件 | §3.1.3 |
| **72 个 core 单测**(🔴 v4 更正,旧写 71) | — | Rstest → Vitest(断言语义基本一致)。⚠️ **另有 27 个非 core 单测,归属见 §1.2.3** | §3.2.3 / **§1.2.3** |

#### 🔴 第 3 档 · 必须重写 —— **约 29,680 行 + 3 个自研基础件 + 4 个缺口件**(🔄 v4:4 → **3**)

| 资产 | 量 | 为什么不能复用 | 出处 |
| --- | --- | --- | --- |
| **全部 UI 层** | **≈29,680 行** | JSX → SFC,且 **D15 后连 className 字符串都不能照抄**(§2.4.3) | §2.5.3 |
| **17 个 `hooks.ts`** | **4,162 行** | React hooks 语义 → composables | §3.1 |
| **`ThreadStreamEngine`** | 替代 670+1,060 行 | SDK 的 `useStream` 是 React 专属子路径 | §4.1 |
| **`streamdown-vue`** | 替代 `streamdown` | 该包 peer 为 react/react-dom | §4.2 |
| **`ai-elements-vue` 14 个** | **3,714 行** | 无 Vue 对应物。✅ 但**对 Radix 真实依赖为 0** | §4.3 |
| ~~`ServerStateClient`~~ | — | ❌ **v4 移出本档** —— D24-a 改装 `@tanstack/vue-query`,不自研 | **§2.8.7** |
| **4 个缺口件** | — | `resizable`(D19 已授权自研;⚠️ **v4:`splitpanes` 实测已满足事件区分,概率下调**)/ `command` / `confetti` / `toast` | §2.3.2 |
| **37 个 React 耦合包** | — | 换 Vue 对应物 **10 组**(v4:+`@tanstack/vue-query`)+ 自研 5 项 + 砍 6 个 | **§2.8.1** |

#### ❌ 第 4 档 · 直接不做 —— **7,025 行 + 72 个 MDX**

| | 量 | 依据 |
| --- | --- | --- |
| landing / docs 站 / blog / Mock 演示 / 特效件 | **4,925 行** + 72 MDX | **D6** |
| 零引用代码(实跑证明) | **2,100 行** | **D9** |
| 无障碍 `aria-*` + `sr-only` | 24 处 | **D5 / D8** |
| 2 个 E2E spec | 128 行 | **D6**(`landing`、`docs-localized-links`) |

#### 一句话结论

> **继承 22,285 行(第 1 档 15,832 + 第 2 档 6,453)、重写约 29,680 行 UI + 3 个自研基础件、砍掉 7,025 行。**
> **继承资产占总工作面 `22,285 / (22,285 + 29,680) = 42.9% ≈ 43%`。**

> 🔴 **v4 说明:继承总量 22,285 与占比 43% 都没变,变的是两档之间的划分。**
> `3,185` 行从第 1 档(逐字节)移到第 2 档(改几行),
> `19,017 → 15,832`、`3,268 → 6,453`,**和仍为 22,285** —— 详见 **§3.1.4**。
> 这不是工作量变了,是**校验层级和"能不能无脑复制"的预期**变了。
>
> 🔴 **另:自研基础件由 4 个降为 3 个** —— **D24-a 推翻 D24 后 `ServerStateClient` 不自研**
> (改装 `@tanstack/vue-query`,§2.8.7),§4.4 已降级为存档。

> 📌 **与 §1.1 的「≈22,400」是两套口径,不矛盾**:
> §1.1 用的是**裁剪前**的基数(全部 27 个 spec 7,334 行 + 全部 13,668 行 core);
> 本表用的是**裁剪后的可执行口径**(D6 保留的 25 个 spec 7,206 行 + core 按三档拆分)。
> 两者相差 128 行(被砍的 2 个 spec)—— **实现时以本表为准**。

> 🔄 **2026-07-31 基线刷新**:本节全部数字已按合入 main(`b71a892b`,含 #4577/#4578/#4580/#4582/#4584/#4587)后的代码重新实测。
> 相对上一版基线 `4c79e625` 的变化:**core `+49` 行纯 TS(新增 `core/auth/next-path.ts` 26 行 + `core/mcp/api.ts` +23)**、
> **E2E `+1` 个 spec(`streaming-reasoning-order.spec.ts` 180 行)+ `artifact-preview.spec.ts` +41 行**。
> **占比仍为 43%,人月口径(7–12)不变。**

---

### 1.1 可直接继承的资产清单(实测)

| 资产 | 行数 | 为什么可继承 |
| --- | --- | --- |
| **`tests/e2e/utils/mock-api.ts`** | **1,411** | 一个完整的**模拟后端**。单一入口 `mockLangGraphAPI(page, options)` 装配全部 `page.route()` 拦截器,`handleRunStream()` 合成 SSE 流。**纯 Playwright + TS,零 React 知识**<br>⚠️ 与 D6 砍掉的 `app/mock/api/`(演示模式)**完全无关**,不要混淆 |
| **E2E spec** | **7,334**(`tests/e2e/` 27 个) | 全黑盒:`page.goto()` + `getByRole`(122 次)/`getByText`(215 次)/`getByTestId`(82 次)+ cookie 操作。**不含任何 React 断言**<br>⚠️ D6 后对标目标为 **25 个**(删 `landing`、`docs-localized-links`)<br>⚠️ 27/25 只统计 `tests/e2e/`。另有 3 套配置下的 5 个 spec:`tests/e2e-auth/`(1)、`tests/e2e-real-backend/`(3)、`tests/e2e-record/`(1),全仓共 **32 个**;P3/P6 额外点名的 `e2e-auth` / `e2e-real-backend` 出自这里 |
| **`core/` 纯 TS 模块** | **13,668** | 无 React 依赖(实测)。含 i18n 词典 3,086 行纯数据 |
| 合计 | **≈ 22,400 行** | |

对比需要重写的量(**D9 后约 29,680 行** UI + 🔴 **3 个**自研基础件,v4:原 4 个),**继承资产约占总工作面的 43%**。

> ⚠️ **v3 更正:旧文写「41%」,用的是 D6 后、D9 前的 31,780 行分母。**
> D9 已定(再砍 2,100 行零引用)→ 分母降为 29,680,占比升至
> `22,413 / (22,413 + 29,680) = 43.0% ≈ 43%`。
> **这是「决策落地后没回头更新派生数」的典型** —— 与 §7 的工期表是同一类问题。

### 1.2 验收定义(D14:分两层)

> **① UI 层 —— 25 个 E2E spec 全绿**(D6 裁剪后;原 27 个减去 `landing`、`docs-localized-links`)
> **② 代理层 —— `proxy-contract` 契约测试全绿 + 4 个真后端 spec 全绿**(见 §1.2.1)
> **③ 新增补位 spec 全绿**(⚠️ **不在继承来的 24 个里,要单独跑**):
> &nbsp;&nbsp;&nbsp;&nbsp;• `thread-switch.spec.ts` —— 跨 thread 状态隔离(**R3 / §3.3.1**;
> 继承的 25 个 spec 多为单 thread 场景,**结构上覆盖不到**)
> **三层都绿 = 对标完成。**

这条定义是本方案最重要的设计决策。它把"功能完全一样"从一个永远吵不清的主观判断,
变成一个**可执行的二元判定**。而且这套 spec 已经钉住了历史上踩过的坑:

| spec | 钉住的行为 |
| --- | --- |
| `artifact-panel-resize.spec.ts` | 右面板拖拽手柄(issue #4465 回归) |
| `sidecar-chat.spec.ts` | 面板动画期间不得回流消息列表 |
| `chat-thread-init-ordering.spec.ts` | 新 thread 初始化顺序 |
| `artifact-stream-state.spec.ts` / `-batched-stream` | 流式产物状态机 |
| `thread-history.spec.ts` | 历史分页与合并 |
| `subtask-card.spec.ts` | 子任务时间线 |

**做法**:`playwright.config.ts` 已支持 `PLAYWRIGHT_BASE_URL` + `PLAYWRIGHT_SKIP_WEB_SERVER=1`。
`playwright.vue.config.ts` 指向 Nuxt 服务即可。

⚠️ **修订(因 D5 + D8)**:原计划"spec 文件一行不改"。因去掉 `aria-*`(D5)与 `sr-only`(D8),
需在 **Vue 版自己的 spec 副本**里改 **7 处**调用 / **4 个 spec**
(D5 两处 + D8 三处 + **D15 两处**;完整清单见 §0.4)。
即:`frontend-vue/tests/e2e/` 持有一份副本(**不是符号链接**),
`frontend/tests/e2e/` 原文件保持不动 —— 满足「React 版一行不动」。

**代价**:副本引入了长期漂移风险(v2 若回填上游 spec,需人工比对)。
当前 7 处差异可控,**必须在副本里用注释标注每处偏离原因**(注明 D5 / D8 / D15 哪一个触发)。

#### 🔴 1.2.1 为什么必须有第二层:25 spec 结构上看不见代理层(D14)

**这不是补充,是补一个结构性盲区。**

那 25 个 spec 的假后端是 `mock-api.ts`,走的是 Playwright 的 `page.route()` ——
**请求在浏览器层就被拦截并伪造响应了,根本不会离开浏览器**:

```
page.route() 拦截 ✂️
       │
浏览器 ─┴─╳─▶ Nitro routeRules proxy ─▶ Gateway
              ↑
    整条链路在 25 spec 下从未被执行过
```

而 D10「不要 nginx」之后,**原本由 nginx 承担的责任全部转移到了这一层**:

| 落在代理层的东西 | 出处 | 25 spec 能看见吗 |
| --- | --- | --- |
| SSE 不得缓冲 | R15 ① | ❌ |
| 长连接超时 ≥120s | R15 ② | ❌ |
| `X-Forwarded-Proto` 透传(漏了登录 403) | R15 ③ | ❌ |
| 8 个上游路径前缀白名单 | `proxy-policy` 契约 | ❌ |
| 剥离 12 个请求头(含 `authorization`/`x-api-key`) | 同上 | ❌ |
| 剥离 8 个响应头(含 `set-cookie`) | 同上 | ❌ |
| 非 GET/HEAD 强制 CSRF | 同上 | ❌ |

> 🔴 **全案最新、最没有外部参照、失败后果最严重的一块基础设施,
> 恰好是继承来的 22,400 行资产唯一照不到的地方。**
> 靠「24 全绿」签字上线,等于这一层零验证。

#### 第二层的两个验收物

**① `frontend-vue/tests/contract/proxy-policy.test.ts`(P0 交付,约 120 行)**

起一个 Nitro 实例 + 一个可控假上游,逐条断言上表。**六条断言,全部可反向验证**:

| # | 断言 | 反向验证(故意破坏后必须红) |
| --- | --- | --- |
| 1 | 白名单外路径(如 `/api/langgraph/admin`)返回 404,不转发 | 放开白名单 → 假上游收到请求 |
| 2 | 客户端发的 `authorization` / `x-api-key` **不出现在**上游收到的头里 | 从剥离表删一项 → 上游收到 |
| 3 | 上游返回的 `set-cookie` **不出现在**浏览器侧响应里 | 同上 |
| 4 | 非 GET/HEAD 且无 CSRF token → 403,且**不转发** | 关掉校验 → 假上游收到请求 |
| 5 | 🔴 **SSE 不缓冲**:假上游每 200ms 吐一帧共 5 帧,断言**首帧到达时间 < 400ms** 且帧间隔可分辨 | 打开缓冲 → 5 帧同时到达,首帧 ≈1s,断言红 |
| 6 | `X-Forwarded-Proto` 按入站 scheme 透传 | 写死 http → 断言红 |

> ⚠️ **第 5 条是最容易写成假绿的一条**。断言必须落在**帧的到达时刻**上,
> 不能只断言"最终收到了 5 帧" —— 缓冲状态下最终也会收到 5 帧。
> 记录每帧 `Date.now()`,断言 `max(间隔) > 100ms` 才是真的在测不缓冲。

**② `tests/e2e-real-backend/` 3 个 spec + `tests/e2e-auth/` 1 个 spec**(实测共 **4** 个)

这 4 个打真 Gateway,是唯一能端到端验证代理层的现成资产。原方案只在 P6 顺带提过,
**D14 后升为验收物的一等公民**:`e2e-auth` 守 R15③(登录 403),
`e2e-real-backend/multi-run-order` 守 SSE 时序。

> 📌 **代价诚实说**:第二层需要真 Gateway,不能像 25 spec 那样纯前端跑。
> 但这正是它的价值 —— **mock 掉的东西验证不了 mock 本身替换掉的那一层。**

#### 🔴 1.2.2 验收骨架的覆盖边界(v4 新增)—— **继承的 spec 是"踩过的坑",不是"功能全集"**

> **这一节修正的是骨架的自我认知,不是骨架本身。**
> §1「以现有测试套件作为可执行规格」是对的,但它有一个**固有边界**,此前全文没有一处说明:
> 🔴 **那 25 个 spec 覆盖的是 React 版历史上出过 bug 的地方**(#4465 面板拖拽、流事件合并时序、
> 跨 thread 清理、历史分页…),**不是产品功能的全集**。
> **对没踩过坑的功能,规格是空的 —— Vue 版少做了、做歪了,三层验收全绿也发现不了。**

##### 实测:规格空白区

**① 设置页 —— 9 个里 6 个零 spec**

| 设置页 | 行数 | E2E spec |
| --- | ---: | --- |
| notification / channels / integrations | — | ✅ 各有专属 spec |
| 🔴 **memory** | **993** | ❌ **零** |
| appearance | 196 | ❌ |
| account | 171 | ❌ |
| skill | 147 | ❌ |
| tool | 88 | ❌ |
| about | 9 | ❌ |
| **小计** | **1,604 行无规格** | |

🔴 **`memory`(993 行)是 §6 P2 明确点名的交付物,却没有任何验收判据。**

**② 路由 —— 10 条存活路由里 5 条无直接 `page.goto`**

| 路由 | 行数 | UI 层(25 spec) | 代理层(4 真后端 spec) |
| --- | ---: | --- | --- |
| `/workspace/chats`、`/workspace/chats/[id]`、`/workspace/agents`、`/workspace/agents/[name]/chats/[id]`、`/workspace/scheduled-tasks` | — | ✅ | — |
| 🔴 **`/workspace/agents/new`** | **455** | ❌ | ❌ |
| `/(auth)/login` | 370 | ❌ | ✅ `e2e-auth/auth-setup-recovery` |
| `/(auth)/setup` | 349 | ❌ | ✅ 同上 |
| `/(auth)/auth/callback` | 63 | ❌ | ❌ |
| `/workspace` | 20 | ❌ | ❌(疑似重定向,风险低) |

🔴 **`/workspace/agents/new`(455 行)同样是 §6 P2 点名的交付物**(「agents 画廊/新建」),**两层验收都照不到**。

##### 汇总口径

| | 行数 | 说明 |
| --- | ---: | --- |
| 🔴 **完全无判据** | **≈ 2,122** | 6 个设置页 1,604 + `agents/new` 455 + `auth/callback` 63 |
| ⚠️ **仅第二层覆盖**(需真 Gateway,跑不进快门禁) | **719** | `login` 370 + `setup` 349 |

复现:

```bash
cd frontend && grep -rhoE "goto\(\s*[\"\`'][^\"\`']*" tests/e2e/*.spec.ts | sed -E 's/.*["\`'"'"']//' | sed -E 's/\?.*//' | sort -u
```

##### 🔴 这不是"方案写错了",是策略的必然代价 —— 但必须显式承认

§1.1 说继承资产占工作面 43%,那是**行数口径**;
本节说的是**判据口径** —— 两者不是一回事,此前被混着用了。

**正确的表述**:
> 继承 25 个 spec 让「历史上出过 bug 的行为」有了机械判据;
> **但产品功能里约 2,122 行没有任何判据,只能靠人工验收或补 spec。**

#### 🔴 1.2.3 第二个零归属项:27 个非 core 单测(v4 新增)

**实测**(`frontend/tests/unit/`):

```bash
cd frontend && find tests/unit -name "*.test.*" | wc -l                        # → 99
cd frontend && find tests/unit/core -name "*.test.*" | wc -l                    # → 72
cd frontend && find tests/unit -name "*.test.*" -not -path "*/core/*" | wc -l   # → 27
cd frontend && grep -rl "@testing-library/react" tests/unit | wc -l             # → 5
```

| | 数量 | 方案里的归属 |
| --- | ---: | --- |
| `tests/unit/core/` | **72** | ✅ 明确:迁 Vitest,P1 验收判据。⚠️ **方案 4 处写「71」,实测是 72** |
| 🔴 **非 core**(components 21 / hooks 2 / content 等) | **27** | ❌ **全文零归属** —— 既没说迁、没说砍、也没说由 E2E 兜 |
| 其中硬依赖 `@testing-library/react` | 5 | 🔴 **确定迁不了**(需 `@vue/test-utils` 重写) |
| 其余 22 个 `.test.ts` | 22 | ⚠️ **多数是纯 helper 测试,很可能可迁** —— 但要逐个看,不能假设 |

**为什么这条要现在定**:P1 的验收判据是「**core 的 N 个单测迁到 Vitest 后全绿**」。
`N` 到底是 71 还是 72、那 27 个算不算在内,**直接决定 P1 什么时候算做完**。
⚠️ **同时这也是一次记账漂移**:HANDOFF §十⑥ 自己记的是「`tests/unit/core/` 72 个」,
而方案正文写 71 —— **同一份材料里两个数,v4 已按实测统一为 72**。

##### 处置(P0 交付项 ⑱)

不要求现在就把 spec 补齐 —— **要求把空白显式列出来并逐个定处置**,三选一:

| 处置 | 适用 | 代价 |
| --- | --- | --- |
| **A · 补 spec** | 🔴 **`memory`(993)与 `agents/new`(455) 建议走这条** —— 它们是 P2 点名交付物且体量大 | 每个约 0.5–1 天,可直接复用 `mock-api.ts` |
| **B · 人工验收签字** | `appearance` / `account` / `skill` / `tool` / `about`(合计 611 行,多为表单与静态内容) | 进 P6 验收清单,由第二人逐屏对照 React 版 |
| **C · 明确接受可能漂** | `/workspace`(20 行,疑似重定向)、`auth/callback`(63 行) | 登记进「已知对标差异」,不再追 |

⚠️ **不允许的第四种:不列、不定、默认它们会自动对上。**
这正是 R18(视觉漂移)在**功能层**的对应物 —— 已登记为**风险 R21**。

### 1.3 前提约束(必须写进开发规范)

为让 spec **尽可能少改**(D5 + D8 + D15 后已知 **7 处**例外,完整清单见 §0.4)通过,Vue 版必须保持:
1. **URL 结构完全一致**(所有路由路径、query 参数)
2. **`data-testid` 完全一致**(现有源码 46 处传递,E2E 81 处使用)
3. **继续使用语义化标签**(`<button>` / `<a>` / `<input>` / `<h1-6>`)—— `getByRole` 用了 122 次,
   其中 **83 次靠原生标签自带的 role**,零成本。
   ⚠️ **本条不要求写 `aria-*`(D5),也不要求写 `sr-only`(D8)**,只要求别把 `<button>` 写成 `<div @click>`。
   纯图标按钮因此没有 accessible name → 统一挂 `data-testid`(§0.4 已列出全部 7 处)。
   ⚠️ **D15 追加**:不要用样式类当选择器 —— `span.font-medium` 那类 Tailwind 工具类在 SCSS 下不存在(§2.4.2)。
   余下 38 次(dialog/option/menuitem/tooltip/combobox)取决于 antdv 的组件实现,
   由 P0 逐一实测;不达标者降级用 `getByTestId`(§2.3.4)
4. **可见文案一致**(`getByText` 用了 207 次 → i18n 词典直接复用,这也是词典必须原样搬过来的原因)
5. **cookie 名与语义一致**(`locale`、`sidebar_state`)

> ⚠️ 这 5 条是**约束而非建议**。任何一条打破,对应的 spec 就要手工改,
> 继承资产的价值随之衰减。评审时请确认团队接受。

---

## 2. 技术选型

### 2.1 选型表

| 领域 | 选择 | 理由 | 风险 / 备选 |
| --- | --- | --- | --- |
| 框架 | 🔴 **Nuxt + 按路由分级渲染**(**D20** 修订 D1) | **产品区(`/workspace/**` + 认证页)全部 `ssr: false`** —— 对话流程不需要 SSR。<br>**仍用 Nuxt 而非纯 Vite SPA**:① 将来的落地页/价格页/关于我们/新闻页需要 prerender/SSR;② **Nitro 是 D10 去 nginx 后的代理层载体**。<br>🔴 **鉴权改由 Nitro server middleware 承担**(原为 Server Component,五态定义见 [03-routing-and-pages.md](03-routing-and-pages.md))。详见 **§2.9** | ✅ 版本已实核(§2.2) |
| 服务端状态 | ✅ **`@tanstack/vue-query`**(🔄 **D24-a 推翻 D24**) | 实测 peer 只有 `vue ^2.6.0 \|\| ^3.3.0`(外加 Vue2 才用的 `@vue/composition-api`),**零 React 依赖**,与 `query-core` 同版本号发布。React 版的 query key 与失效策略可**语义等价迁移**,不需要重新设计 | 低。原自研方案(§4.4)已降级为存档;判据与实测见 **§2.8.7** |
| UI 组件库 | ✅ **Ant Design Vue**(D2) | 公司技术栈统一;生态成熟、团队上手快、文档完整 | ⚠️ 见 §2.3 影响分析:需映射 **15/41** 组件原语,**resizable 与 command 两处缺口需独立方案**,主题体系需桥接 |
| 样式 | ✅ **SCSS**(**D15**,不用 Tailwind) | SFC `<style lang="scss" scoped>` + 共享 token/mixin 层。Nuxt 原生支持,无需 PostCSS 配置。与 antdv 同为「组件库 + 预处理器」的常规组合,不必再桥两套体系 | 🔴 **代价:失去 className 逐字复制这个对标捷径**,详见 **§2.4**。`cn()` / `cva` 语义变化 |
| 主题 | 自写 `useTheme.ts` + **antdv ConfigProvider 桥接** + 🔴 **保留 CSS 自定义属性** | 替代 `next-themes`,与参照工程一致,不引 `@nuxtjs/color-mode`。⚠️ **D20 后仍需防主题闪烁**(CSR 首屏),内联脚本照留。**SCSS 变量是编译期的,做不到运行时暗色切换** → 115 个 CSS 变量必须保留作运行时 token 层 | 见 §2.3.3(D15 后**变简单**:参照工程本就是 SCSS,主题链可整条抄) |
| 代码编辑器 | **CodeMirror 6 原生** | 核心框架无关,只换 `@uiw/react-codemirror` 这层封装 | 低。需自写薄 Vue 封装(约 100 行) |
| 图 | 🔴 **不装 Vue Flow**(**D25**) | React 版 `@xyflow/react` 只出现在 D9 已砍的零引用 ai-elements 画布件 | 低。若未来真做流程画布,另行选型,不从迁移惯性默认带入 |
| 动效 | 🔴 **CSS / Vue `<Transition>` / RAF**(**D25**),**不装 `motion-v`** | 存活动效点用平台能力实现;landing 与零引用特效件已由 D6 裁剪 | 中低。`shimmer` 需用 CSS animation 保持视觉;`flip-display` 用 `<Transition mode="out-in">` |
| 浏览器 API 封装 | ✅ **`@vueuse/core`**(🔄 **D25-a 修订 D25**) | 实测 `14.4.0` **2026-07-29 仍在发版**,是 Vue 生态事实标准。它覆盖的是 ResizeObserver / matchMedia / storage / 事件监听这类**框架无关的浏览器 API 封装**(React 版实测 17 个文件在裸用),**不是 React 迁移惯性** | 低。⚠️ 它原是 `motion-v` 的 peer,`motion-v` 不装之后需**显式声明为直接依赖** |
| **流式 Markdown** | **🔴 自研 `streamdown-vue`** | 无 Vue 对应物 | 见 §4.2 |
| **AI 元素** | **🔴 自研**(**14** 个组件,D9 后;原 28 个中 14 个零引用) | 无 Vue 对应物 | 见 §4.3 / §2.6.1 |
| **流引擎** | **🔴 自研 `ThreadStreamEngine`** | `sdk/react` 的 `useStream` 无 Vue 版 | 见 §4.1 |
| Gateway 客户端 | **手写 fetch wrapper + DeerFlow Gateway adapter**(**D22**) | 不装 `@langchain/langgraph-sdk`。当前后端的 LangGraph-compatible wire format 只在 adapter 层解析,前端内部只认 canonical stream event | 中。关键在 §4.1 的 contract fixture 与 gap/409/stop 语义单测 |
| 单元测试 | **Vitest** | 与 Rstest 同为 Vite 系,`core/` 的 **72** 个测试迁移成本低(🔴 v4 更正,旧写 71) | 低。⚠️ **另有 27 个非 core 单测需在 P0 定去留**(§1.2.3),其中 5 个硬依赖 `@testing-library/react` |
| E2E | **Playwright**(原样) | 见 §1 | 零风险 |

### 2.2 版本核实 —— ✅ 已有实跑参照,不必从零核实

原文写的是「我的知识有截止时间,需你方以实际发布状态为准」。
**2026-07-30 找到了一个可参照的真实工程,这项已基本闭合**(详见 §2.7):

| 项 | 实跑通过的版本组合 | 来源 |
| --- | --- | --- |
| 框架 | **Nuxt 4.4.8** | `nuxt-modern-starter` @ `ece56c2` |
| UI 库 | **ant-design-vue 4.2.6** + **`@ant-design-vue/nuxt` 1.4.6** | 同上 |
| 状态 | **Pinia 3.0.4**(`@pinia/nuxt` 0.11.3) | 同上 |
| i18n | **vue-i18n 11.4.6** | 同上 |
| 运行时 | **Node 22.22.3** / **pnpm 11.5.2** | 同上 |
| 测试 | **Vitest 4.1.9** + `@nuxt/test-utils` 4.0.3 + happy-dom | 同上 |

**🔴 antdv 在 Nuxt 下仍采用官方模块接线**:`@ant-design-vue/nuxt` + `antd: { extractStyle: true }`。
D20 后产品区 `ssr:false`,原先的 **SSR FOUC** 不再是 P0 风险;但**主题闪烁**仍存在,
根组件里 hydration 前设置 `data-theme` 的内联脚本仍要保留(§2.9.4)。
→ **风险 R5b 由 D20 消除**,主题闪烁归入 §2.3.3 / P0 ⑧ 处理。

~~🔴 **D24 参照结论**~~ → 🔴 **v4 更正:这条证据当时被用反了。**
该工程确实**没有用 TanStack Query**(它用 Pinia + 手写 api 函数),
但同一段自己也写了「**DeerFlow 的使用面大于该参照工程,不能只靠 Pinia + 裸 api 函数临时拼**」——
**参照工程的结论是「小项目不必引」,不是「大项目该自研」。**
✅ **D24-a 后**:DeerFlow 装 `@tanstack/vue-query`(实测 peer 零 React 依赖),
仍**不照搬**该工程的 `app/lib/http`。判据见 **§2.8.7**。

---

### 2.3 Ant Design Vue 影响分析(针对 D2 补做)

#### 2.3.1 44 个 `ui/` 原语的归属实测

我按每个文件实际 `import` 的底层库做了分类。⚠️ **本表已按实读重算**:
`components/ui/` 下 44 个文件里有 **3 个是 `.css`**(`galaxy` / `magic-bento` / `spotlight-card`),
组件文件实为 **41 个**;归类后**需要映射 antdv 的是 15 个**:

| 类别 | 数量 | 文件 | antdv 相关性 |
| --- | --- | --- | --- |
| **纯自研 / 纯样式** | 15 | `alert` `card` `empty` `input` `input-group` `textarea` `skeleton` `aurora-text` `shine-border` + 6 个特效件(`magic-bento` `galaxy` `terminal` `flickering-grid` `number-ticker` `spotlight-card`) | **无关**。⚠️ **D6 已砍其中 6 个特效件**(workspace 零引用)→ 实际保留 **9 个** |
| **仅用 Radix `Slot`** | 6 | `badge` `breadcrumb` `button` `button-group` `item` `sidebar` | **基本无关**。`Slot` 只是 `asChild` 组合能力,不是行为原语;Vue 用具名插槽 / `<component :is>` 表达。⚠️ 但 `sidebar.tsx` 是 Shadcn 大型复合件(含 cookie 持久化),需单独评估 |
| **真 Radix 行为原语** | **15**(D9 后实需 **14**) | ~~`avatar`~~(D9:零引用) `collapsible` `dialog` `sheet` `dropdown-menu` `hover-card` `progress` `scroll-area` `select` `separator` `switch` `tabs` `toggle` `toggle-group` `tooltip` | ✅ **antdv 有对应物**,这是主要映射工作量 |
| **非 Radix 第三方** | 5(D9 后实需 **3**) | 🔴 `command`(cmdk)、🔴 `resizable`(react-resizable-panels)、`confetti-button`(D25:不装 `canvas-confetti`)、~~`sonner`~~(D9:本地包装零引用,但 **toast 功能仍需 antdv `message`**)、~~`carousel`~~(D9:全库零引用)| 见 §2.3.2 / §2.6.2 |
| **CSS 文件** | 3 | `galaxy.css` `magic-bento.css` `spotlight-card.css` | 随 D6 一并砍 |
| **合计** | **44** | | |

**结论(注意:上表是 D6 / D9 裁剪 _之前_ 的原始归类)**:选 antdv 影响的是 **15 个**
行为原语的映射;**21 个**(15 纯自研 + 6 Slot)与 UI 库无关;另有 4 个缺口,其中 1 个高风险。

> 🔴 **上面这几个数不能直接拿去排期** —— D6 砍了 6 个特效件、D9 砍了 3 个零引用件。
> **存活口径见 §2.3.1.1,后续 §3.2 目录树 / P2 范围 / §10.1 一律以那张表为准。**

#### 2.3.1.1 D6 + D9 之后的存活口径(后续章节引用本表)

| 类别 | 原始 | D6 砍 | D9 砍 | **存活** | 处理方式 |
| --- | --- | --- | --- | --- | --- |
| 纯自研 / 纯样式 | 15 | −6 特效件 | — | **9** | **SCSS 自研**(D15),与 UI 库无关 |
| 仅用 Radix `Slot` | 6 | — | — | **6** | 具名插槽 / `<component :is>` |
| 真 Radix 行为原语 | 15 | — | −1(`avatar`) | **14** | ✅ 映射为 antdv 薄包装 |
| 非 Radix 第三方 | 5 | — | −2(`carousel`、`sonner` 包装) | **3** | `command` / `resizable` / `confetti-button` |
| `.css` 文件 | 3 | −3 | — | **0** | 随特效件一并砍 |
| **合计** | **44** | **−9** | **−3** | **32** | |

🔴 **自研面 = 9 + 6 = 15 个,不是 21。**
「21」是 15 纯自研 + 6 Slot,**其中那 15 里有 6 个特效件已被 D6 砍掉** ——
旧文在 §2.3.1 结论、§3.2 目录树、P2 范围、§10.1 四处沿用了这个 D6 前的数字,**本轮已全部更正**。

#### 缺口是 **4 项**,但只有 **3 个**对应存活文件(这就是旧文 3 / 4 两个数并存的原因)

| 缺口 | 有存活文件? | 说明 |
| --- | --- | --- |
| 🔴 `resizable` | ✅ 有 | **P0 go/no-go**(R4),承载 **08 号** §8.3 五条布局红线 + issue #4465 |
| `command` | ✅ 有 | `a-modal` + `a-input` + 自研筛选,约 200–300 行,计入 P2 |
| `confetti-button` | ✅ 有 | 🔴 **D25:不装 `canvas-confetti`**。仅 1 处装饰反馈,改 CSS/Canvas 小实现或普通 antdv 成功反馈 |
| **`toast`** | ❌ **文件已死,能力仍活** | `sonner` 本地包装零引用(D9 砍掉那 40 行),但 **10+ 处直连 npm 包**、`Toaster` 由 `workspace-content.tsx:44` 直接引入,且 **E2E 用 `getByText` 断言其文案** → 必须用 antdv `message` / `notification` 顶上,**文案必须一致** |

> ⚠️ **两个数字口径不同,不要相加**:
> **存活文件 32** = 14 antdv 包装 + 15 自研 + 3 第三方;
> **缺口 4 项** = 那 3 个第三方 + `toast`(无存活文件,但有存活能力)。
> §2.6.5 旧写「非 Radix 第三方缺口 3」说的是**文件**,§3.2 目录树旧写「4 个缺口」说的是**能力** —— 两者都对,只是没说清口径。

> ⚠️ **本表修正了旧版三处计数错误**:① 行为原语写 13 但列了 15 个文件(实测 15);
> ② `confetti-button` 被同时计入「纯自研」与「不覆盖」,双重计数;
> ③ `carousel` 实际包装 `embla-carousel-react`,不属于纯自研。
> 旧版 16+6+13+4=39,与 44 对不上。

#### 2.3.2 🔴 两个必须独立解决的缺口

#### 缺口 A · `resizable` —— 本节最重要的发现

`components/ui/resizable.tsx` 包装 `react-resizable-panels`,而它承载了
****08 号** §8.3 全部 5 条布局红线 + issue #4465**:三个右面板(artifacts/sidecar/browser)
共用一个 `ResizablePanelGroup`、`collapse()`/`resize()` 命令式开合、
过渡加在 group 上、动画期间内容锁宽裁剪、`0%` 只认 `onLayoutChanged`。

**Ant Design Vue 没有 resizable panel group。** 这意味着:
- 必须另选 Vue 侧库(如 `splitpanes`、`vue-resizable` 等)或自研
- 所选库**必须支持**:命令式 collapse/resize handle、`minSize` 折叠语义、
  布局变更与拖拽中 resize 的**事件区分**(红线 P5 的前提)
- 若所选库不提供"拖拽中 vs 最终布局"两类事件,红线 P5 无法实现 → issue #4465 类 bug 必然重现

**行动项(P0 必须完成)**:候选库调研 + 用一个最小 demo 验证 5 条红线可实现性。
**这是 P0 的一个 go/no-go 检查点** —— 若无库满足,需追加自研预算(估 2–3 周)。

##### 🔴 v4 预调研:`splitpanes` 已满足最关键的那一条

> **调研判据里最硬的一条是「有没有把『拖拽中 resize』与『最终布局变更』分成两类事件」**
> —— 因为红线 P5(`0%` 只认最终布局事件,不认拖拽中帧)与 issue #4465 全靠它。
> **这一条已经可以提前回答。**

| 项 | 实测 |
| --- | --- |
| 包 | `splitpanes@4.1.2` |
| 维护状态 | `time.modified` = **2026-05-26**(在维护)。对照:`vue-splitter-pane` 停在 **2022-01-26**,已淘汰 |
| 🔴 **事件** | 从 dist 扫出:**`resize`**(拖拽中,连续)、**`resized`**(拖拽结束,最终布局)、`ready`、`pane-add`、`pane-remove`、`pane-maximize`、`splitter-click` |
| → 判定 | ✅ **红线 P5 的前提(两类事件可区分)成立** —— `onResize` 记录最后正尺寸用 `resize`,而 `0%` 关闭判定用 `resized`,与 React 版 `onResize` / `onLayoutChanged` **一一对应** |

复现:

```bash
cd /tmp && npm pack splitpanes --silent && tar xzf splitpanes-*.tgz && grep -oE '"(resize|resized|ready|pane-[a-z]+|splitter-click)"' package/dist/splitpanes.esm.js | sort -u
```

##### ⚠️ 剩下要验的(P0 仍要做,但范围小了很多)

| 红线(**08 号** §8.3) | 已答 | 待验 |
| --- | --- | --- |
| **P5** `0%` 只认最终布局事件 | ✅ **已答** | — |
| 三面板共用一个 group | — | ⚠️ splitpanes 的 `<Splitpanes>` + `<Pane>` 结构能否表达 |
| **命令式 `collapse()` / `resize()`** | — | 🔴 **最大的剩余问号** —— splitpanes 是 `:size` **声明式**驱动。Vue 里可以用 `:size` 绑一个 ref 表达"程序化开合",但**要 demo 确认它与 `minSize` 折叠语义不打架** |
| 过渡加在 group 上 | — | ⚠️ 需确认可给 `[data-splitpanes]` 挂 CSS transition |
| 动画期间内容锁宽裁剪 | — | ✅ 这条是我们自己的 CSS,与库无关 |

##### 对风险 R4 与 D19 的影响

| | 原 | 🔴 v4 |
| --- | --- | --- |
| **风险 R4 概率** | 中 | **中低** —— 最硬的判据已满足 |
| **D19 的 2–3 周自研预算** | 预授权待触发 | ✅ **仍然预授权,但触发概率明显下降**(仍在 27–48 周上界内,不改口径) |
| **P0 第 3 项工时** | 1–2 天 | **约半天** —— 直接从 `splitpanes` 最小 demo 验剩下 3 条,不必再从 d.ts 筛库 |

> ⚠️ **不要因此跳过 P0 的 demo**:事件区分只是**必要条件**。
> **命令式开合**那条如果不成立,红线 P1–P4 一样落不了地 —— 判定权仍在 demo,不在本节。

#### 缺口 B · `command`(命令面板)

`cmdk` 驱动的 `CommandPalette`(全局快捷键唤起的命令面板)。antdv 无对应物。
可选:找 Vue 命令面板库、或用 `a-modal` + `a-input` + 自研筛选逻辑重写(约 200–300 行)。
风险低,但要计入 P2 工作量。

#### 其余两个
- `sonner`(toast):antdv 有 `message` / `notification`。API 与视觉差异大,
  ⚠️ 但 toast 文案被 E2E 用 `getByText` 断言(流恢复警告、goal 状态、错误提示),
  **文案必须一致**,容器实现可换。
- `confetti-button`:🔴 D25 后不装 `canvas-confetti`;只保留业务反馈语义,效果用 CSS/Canvas 小实现或 antdv 成功反馈。

#### 2.3.3 主题体系桥接

> 🔴 **本节已按 D15 重写。** React 版现状是 **Tailwind 4 CSS 变量 + `.dark` class**;
> Vue 版改用 **SCSS**,antdv 仍用 **design token + ConfigProvider**。
> **D15 让这一节变简单了** —— 原本要桥「Tailwind ↔ antdv」两套体系,现在只需一个 token 源派生三路。

```
config/theme-palette.json              ← 🔴 单一真相(色板/圆角/间距/字号/z-index)
        │
        ├─▶ scripts/generate-theme.mjs ← prebuild 生成两份产物:
        │      ├── tokens/_variables.scss   ← SCSS 变量,供 @use 引入(编译期)
        │      └── tokens/_variables.css    ← CSS 自定义属性(:root / .dark)(运行时)
        │
        └─▶ config/theme.ts::getAntdThemeToken(mode)  ← antdv token
                    │
              app/composables/useTheme.ts   ← mode / resolvedMode / antdTheme
                    │
              app/app.vue  <a-config-provider :theme="antdTheme" :locale="antdLocale">
```

#### 🔴 为什么 SCSS 变量和 CSS 变量都要留(不是冗余)

| | SCSS 变量 | CSS 自定义属性 |
| --- | --- | --- |
| 生效时机 | **编译期**替换 | **运行时**求值 |
| 能做暗色切换吗 | ❌ **不能** —— 编译完就固化了 | ✅ 换 `.dark` 作用域即可 |
| 用途 | 写样式时的算术、mixin、断点、`map-get` | 主题 token、跟随暗色的颜色 |

**暗色主题不能砍**(`ui-polish-mobile.spec.ts:49` 有断言),所以那 **115 个 CSS 自定义属性必须保留**。
规则很清楚:**颜色类 token 走 CSS 变量;尺寸/断点/层级等不随主题变的走 SCSS 变量。**

> ✅ **§2.7.1 的实现可以整条抄了**。D15 之前这里有一处必须处理的差异
> ——「参照工程真相源是 JSON,deer-flow 是 Tailwind CSS 变量」,当时的建议是「改成 JSON 驱动」。
> **换成 SCSS 后这个差异直接消失**:参照工程本来就是 `theme-palette.json → generate-theme-scss.mjs → SCSS`。

要点:
1. **`theme-palette.json` 是唯一真相**,SCSS 变量 / CSS 变量 / antdv token 三者都由它派生,**不要维护三份色板**
2. 自写 `app/composables/useTheme.ts` 的 class 切换必须同步驱动 antdv 的 `algorithm`(`darkAlgorithm`)
3. ⚠️ **主题闪烁**仍需验证:CSR 首屏也要在 hydration 前设置 `data-theme`;原 **SSR FOUC** 风险已由 D20 消除
4. 🔴 **加 stylelint**(参照工程的质量门禁里有)—— Tailwind 时代靠 `prettier-plugin-tailwindcss` 排序类名,
   SCSS 时代靠 stylelint 管属性顺序与嵌套深度。**并入 `make verify` 快门禁**

#### 2.3.4 对验收策略(§1.2/§1.3)的实际影响 —— 好于预期

我实测了 E2E 中 `getByRole` 断言的**具体 role 分布**(共 122 次):

| role | 次数 | antdv 下的对齐情况 |
| --- | --- | --- |
| `button` | **64** | ✅ 天然(原生 `<button>`) |
| `dialog` | 13 | ⚠️ 需确认 `a-modal` 给 `role="dialog"`,**且把 title 接成 accessible name** —— D5/D8 后我们不写任何 `aria-*`,这 12 次(另 1 次已改 testid)完全依赖 antdv 内部实现 |
| `link` | **11** | ✅ 天然(原生 `<a>` / RouterLink) |
| `option` | 10 | ⚠️ 需确认 `a-select` 选项 role |
| `menuitem` | 9 | ⚠️ 需确认 `a-dropdown` + `a-menu` |
| `textbox` | **5** | ✅ 天然(原生 input/textarea) |
| `tooltip` | 4 | ⚠️ 需确认 `a-tooltip` |
| `heading` | **3** | ✅ 天然(自写 `<h1-6>`) |
| `combobox` | 2 | ⚠️ 需确认 `a-select` |
| `switch` | 1 | ✅ 通常天然 |

**结论:83/122(68%)落在原生 HTML 元素上,与 UI 库无关,天然对齐。**
真正有风险的是 38 次(dialog/option/menuitem/tooltip/combobox),且都有兜底手段:
若 antdv 的 role 不符,可在包装层补 `role` 属性,或改用 `getByTestId`(testid 完全由我们掌控)。

**修订后的 §1.3 第 3 条(已含 D5 + D8)**:
- **不补 `aria-*`(D5)、不补 `sr-only`(D8)**。包装层只做两件事:①(必要时)补 `role`,②挂 `data-testid`
- 14 个 antdv 薄包装仍需要(D9 后;`avatar` 零引用),但职责缩小 → 工作量从原估 1–2 周降到 **3–5 天**
- 图标按钮因无 `aria-label` 而失去 accessible name → 统一走 `data-testid`
  (§0.4 已列出受影响的全部 **7** 处调用 / 4 个 spec:D5 两处 + D8 三处 + **D15 两处**)

#### 2.3.5 D2 的净代价小结

| 项 | 影响 |
| --- | --- |
| 原语映射 | **14** 个需映射(D9 后;`avatar` 零引用) |
| 🔴 `resizable` 缺口 | **P0 go/no-go 检查点**,最坏追加 2–3 周自研 |
| `command` 缺口 | +200–300 行,计入 P2 |
| 主题桥接 | +3–5 天(CSS 变量 → antdv token) |
| 包装层(补 `role` + 挂 testid) | **14** 个薄包装,**+3–5 天**(D5 后职责缩小,原估 1–2 周) |
| **合计上浮** | **约 1.5–4.5 周**(取决于 resizable 结论) |
| 收益 | 公司技术栈统一、团队上手快、生态成熟 |

这是一个**可接受的代价**,前提是 P0 把 `resizable` 结论跑出来。

> D5 顺带削减了 D2 的上浮:不补 `aria-*` 后,包装层从"补齐完整 a11y 语义"
> 降级为"必要时补 `role` + 挂 testid",省下约 1 周。

---

### 2.4 弃用 Tailwind 改用 SCSS 的影响分析(针对 D15 补做)

> 📌 本节同时填上了 §2.3 → §2.5 之间的编号空洞(此前是修订期删小节留下的)。

#### 2.4.1 React 版的 Tailwind 实测footprint

| 项 | 实测 |
| --- | --- |
| 版本与工具链 | `tailwindcss@4.0.15` + `@tailwindcss/postcss` + `prettier-plugin-tailwindcss` |
| `globals.css` | **449 行**,Tailwind 4 原生语法(`@import "tailwindcss"` / `@theme` / `@theme inline` / `@custom-variant dark` / `@layer base`) |
| **CSS 自定义属性** | **115 个** —— 🔴 **D15 后仍然保留**(运行时 token 层,见 §2.3.3) |
| `className=` 出现次数 | **1,841 处** |
| `cn()` 调用 | **418 次 / 114 个文件**(`clsx` + `tailwind-merge`) |
| 变体方案 | `class-variance-authority`(cva) |

#### 2.4.2 🔴 E2E 影响:只有 **2 处**(已全量核对)

这是本节最重要的实测结果。E2E 里按 class 选择元素的一共 **8 处**,逐条核对后**只有 2 处真受影响**:

| 选择器 | 出现 | 是否受 D15 影响 | 原因 |
| --- | --- | --- | --- |
| 🔴 `span.font-medium` | `chat.spec.ts` **:481、:500** | ✅ **受影响,共 2 处** | `font-medium` 是 **Tailwind 工具类**,SCSS 下不存在 |
| `a.nextra-card` | `docs-localized-links.spec.ts` ×2 | ❌ 不受影响 | 该 spec **已被 D6 砍掉**(不在 24 个对标目标里) |
| `.is-user` / `.is-user .katex` | `chat.spec.ts` 等 ×4 | ❌ 不受影响 | **语义类**,由 `message.tsx:32` 显式写出,与样式方案无关;`.katex` 来自 KaTeX 库 |

**处置**:与 D5/D8 的 5 处同样处理 —— **改 `getByTestId`**,并在副本里注释标注偏离原因(注明 D15 触发)。

> ⚠️ **spec 改动累计口径更新**:D5(2)+ D8(3)+ **D15(2)** = **7 处 / 4 个 spec**。
> §1.2 与 §0.4 的「5 处」已相应更新为 **7 处**。

#### 2.4.3 真实代价:失去「className 逐字复制」这个对标捷径

**这是 D15 唯一实质的成本,也是最容易被低估的一条。**

`components/workspace` 有 20,286 行、全库 1,841 处 `className=`。在 Tailwind 方案下,
把 React 组件搬到 Vue 时,类名字符串可以**逐字复制**:

```tsx
// React
<div className="flex w-fit max-w-full min-w-0 flex-col gap-2 overflow-visible">
```
```vue
<!-- Vue:Tailwind 方案 —— 字符串原样搬,视觉一致性接近免费 -->
<div class="flex w-fit max-w-full min-w-0 flex-col gap-2 overflow-visible">
```

D15 之后,每一处都必须**读懂工具类 → 起类名 → 写等价 SCSS → 目视核对**:

```vue
<!-- Vue:SCSS 方案 -->
<div class="message-body">
<style lang="scss" scoped>
.message-body { display:flex; flex-direction:column; gap:$space-2;
                width:fit-content; max-width:100%; min-width:0; overflow:visible; }
</style>
```

**注意成本落在哪里**:UI 层本来就要全部重写(≈29,680 行),所以 **D15 的成本不是"转换存量"**,
而是**「照抄字符串」变成「重新表达意图」**的增量。它主要压在组件密集的 **P2 与 P5**。

⚠️ 另外两处语义变化:
- **`cn()` 的 418 次调用**:`tailwind-merge` 的"后者覆盖前者"冲突消解在 SCSS 下没有意义 →
  改用 Vue 原生的 `:class="{ 'is-active': active }"` / 数组语法。**不要移植 `tailwind-merge`**
- **`cva`**:核心是字符串拼接、框架无关,技术上可留;但脱离工具类后价值大降 →
  建议改用 SCSS 的 **BEM 修饰符 + `:class` 绑定**,不引入这个依赖

#### 2.4.4 收益(三项,其中一项是实的)

| # | 收益 | 强度 |
| --- | --- | --- |
| 1 | 🔴 **参照工程的主题链可整条抄** —— `nuxt-modern-starter` **本来就是 SCSS**。§2.7.1 原先记着一处「必须处理的差异:它的真相源是 JSON,deer-flow 是 Tailwind CSS 变量」,当时建议「改成 JSON 驱动(推荐,稳)」或「写脚本从 CSS 变量提取(脆)」。**D15 后这个岔路直接消失** | ✅ **实的**,省 1–2 天 |
| 2 | **R5c 降级**:原本要让 Tailwind 与 antdv 两套 token 体系共存(§2.3.3 旧版),现在只有一个 `theme-palette.json` 派生三路 | ✅ 实的,见 §8 |
| 3 | Nuxt 原生支持 SCSS,不需要 `@tailwindcss/postcss` 与 `prettier-plugin-tailwindcss` 两个构建期依赖 | 🟡 小 |

#### 2.4.5 D15 的净代价小结

| 项 | 影响 |
| --- | --- |
| E2E spec 改动 | **+2 处**(`chat.spec.ts:481/500` → testid),累计 5 → **7 处** |
| 样式撰写增量 | 🔴 **+3–6 周**,压在 **P2 / P5** —— 见下方口径说明 |
| `cn()` / `cva` | 418 处调用改 Vue 原生 `:class`;**不移植 `tailwind-merge`** |
| 主题桥接 | ✅ **反而省 1–2 天**(§2.7.1 可整条抄) |
| 新增工具 | **stylelint** 进 `make verify` 快门禁 |
| **合计** | **约 +3–6 周** |

> ⚠️ **「+3–6 周」是本方案里最不确定的一个数字,必须说清它的来源**:
> 它**不是实测**,是按「约 200 个组件文件 × 每个多花 0.5–1.5 小时撰写并目视核对样式」估的。
> 真正决定它落在哪一端的是**视觉对标要求有多严** ——
> 若接受"接近即可",取下界;若要求逐像素对齐 React 版,取上界甚至更高。
> **建议在 P2 做完前 3 个页面后用实际速率回推这个数,再更新 §7。**

---

#### 2.4.6 🔴 D25-a:两处必须改回来(v4)

> D25「清掉 React 迁移惯性包」的方向是对的,9 项里有 **7 项删得对**。
> 但其中 **2 项删错了**,而且第一项**会在上线当天炸**。

#### ① 🔴 `crypto.randomUUID()` 在公司内网 HTTP 下是 `undefined` —— 落地卡点

| 事实 | 实测/依据 |
| --- | --- |
| `crypto.randomUUID()` 的可用条件 | **secure-context-only**(HTTPS / `localhost` / `file:`)。非安全上下文下 `crypto.randomUUID` **不存在** |
| Vue 版的部署形态 | **`docker-vue/` 走 `http://<内网地址>:2027`** —— 现有 nginx 实测 `listen 2026`(`docker/nginx/nginx.conf:44`),**无 TLS**;README 全篇也是 `http://localhost:2026` |
| → 后果 | 🔴 **除开发者自己的 `localhost` 外,所有同事访问时该 API 都不存在** |
| `uuid()` 的实际使用面 | **不是装饰性的** —— 它生成**新建 thread 的 ID**:`components/workspace/chats/use-thread-chat.ts`(**5 处**:`:37` / `:41` / `:47` / `:56` / `:64`)+ `app/workspace/agents/new/page.tsx:93`(1 处) |
| → 症状 | 🔴 **新建会话直接抛异常**,而这是应用的主入口 |
| `nanoid` 的使用面 | `ai-elements/prompt-input.tsx:177/571`(2 处,附件 id)—— 影响小,但同一个修法一起解决 |

> 🔴 **最有说服力的一条佐证:这个仓库已经踩过同一类坑。**
> `frontend/src/core/clipboard.ts` 专门写了 `document.execCommand("copy")` 回退
> (`:12` 判定、`:30` 执行、`:59` `fallbackWriteText`、`:142` 装配),
> **正是因为 `navigator.clipboard` 同样是 secure-context-only。**
> 也就是说:**非安全上下文是这个项目已知的真实部署条件,不是理论风险。**

**修法二选一(都可以,推荐 A)**:

| | 做法 | 代价 |
| --- | --- | --- |
| ✅ **A(推荐)** | **保留 `uuid` 包**(`^14.0.0`,与 React 版同版本线,自带 types,零 React 耦合) | +1 个依赖。**成本最低、行为与 React 版逐字节一致** |
| B | 本地 `app/core/utils/id.ts`:`crypto.randomUUID?.() ?? v4FromGetRandomValues()` | 零依赖,但要自己写 v4 位操作并测。⚠️ **`crypto.getRandomValues()` 不受 secure context 限制**,所以回退是可靠的 |

> 🔴 **绝对不能做的**:只写 `crypto.randomUUID()`。
> ⚠️ **这个 bug 在开发机上永远复现不了**(`localhost` 是安全上下文),
> **也不会被 25 个 E2E spec 抓到**(Playwright 默认跑 `localhost`)——
> 它只在同事第一次用内网地址打开时出现。**这正是最贵的一类 bug。**
>
> 📌 **如果将来给 `:2027` 配了 TLS,本条自动失效** —— 但那是一个**尚未做出的决定**,
> 不能拿它当依赖清单的前提。

#### ② `@vueuse/core` 不是 React 迁移惯性,是 Vue 生态事实标准

| 判据 | 实测 |
| --- | --- |
| 维护状态 | `@vueuse/core@14.4.0`,**`time.modified` = 2026-07-29**(两天前) |
| D25 的删除理由 | 它是 `motion-v@2.3.0` 的 peer(`>=10.0.0`)→ **`motion-v` 不装了,就"顺手"把它一起删了** |
| 🔴 这个推理的问题 | **`@vueuse/core` 不是 `motion-v` 的附属品。**它是独立的通用库,与 `motion-v` 装不装无关 |
| 它替代的东西 | React 版**裸用**浏览器 API 的文件实测 **17 个**(`ResizeObserver` / `IntersectionObserver` / `matchMedia` / `localStorage` / `sessionStorage` / `MutationObserver` / `addEventListener("resize")`) |
| 不装的代价 | 这 17 处要自己写 composable,并自己处理 SSR 安全、卸载清理、事件节流 —— **而这些正是 `@vueuse/core` 被广泛采用的原因** |

> **判据一句话**:D25 的标准是「Vue 项目根本不常用、只是 React 迁移惯性带过来的包」。
> `@vueuse/core` **两条都不符合** —— Vue 项目常用它,而且 React 版根本没有对应包可"惯性带过来"
> (React 生态的对应物是各种零散 hooks,不是一个包)。

#### ③ ✅ D25 其余 7 项维持不变

`motion-v` / `@vue-flow/core` / `canvas-confetti` / `@uiw/codemirror-theme-basic` /
`@uiw/codemirror-theme-monokai` / `nanoid` / `tokenlens` —— **删得对**,理由见 §0.4 D25。
(`nanoid` 的 2 处使用面由 ① 的 `uuid` 一并覆盖。)

#### D25-a 的影响面

| 项 | 变化 |
| --- | --- |
| 依赖数 | 51(D24-a 后)→ **53** |
| **P0** | 🔴 **新增一条冒烟检查**:把 `frontend-vue/` 用**非 localhost 的内网地址**打开一次,确认新建会话可用。**成本 10 分钟,但它是唯一能抓到 ① 的检查** |
| §1.3 五条约束 | ➖ 不受影响 |
| **§7 工期** | ➖ 不变(装包比自研省时,但落在噪声内) |

---

### 2.5 范围裁剪(D6)

裁剪的判断依据是「**是否服务于产品功能**」。实测把候选项分成三类,
三类的**决策人不同** —— 这是本节的关键区分。

> 📌 编号说明:本节的三类直接以 `第 1/2/3 类` 列出,**没有 `§2.5.1`**;
> 后续小节从 `§2.5.2` 开始。此前有两处引用误写 `§2.5.1`(实际内容在 `§2.5.2`),v3 已更正。

#### 第 1 类 · 只服务「开源项目官网」(技术决策)

DeerFlow 是开源项目,前端里有一块是为**官网与演示**服务的,与产品功能无关。

| 项 | 行数 | D6 结论 |
| --- | --- | --- |
| landing 落地页组件(6 个 section) | 1,628 | ❌ **砍** |
| **workspace 零引用特效件** | **1,904** | ❌ **砍** —— `magic-bento`(930) `galaxy`(366) `terminal`(257) `flickering-grid`(202) `number-ticker`(67) `spotlight-card`(82),实测在 workspace 引用数为 **0** |
| blog(`app/blog` + `core/blog`) | 632 | ❌ **砍** |
| docs 站(`app/[lang]/docs` + `components/docs`) | 188 | ❌ **砍**(连带 Nextra 与 72 个 MDX) |
| 静态站点 demo 模式 | 101 | ❌ **砍**(`static-demo.ts` / `static-mode.ts` / `static-user.ts`) |
| **Mock 演示模式**(`app/mock/api/` 11 个 route handler) | 472 | ❌ **砍** —— 见 §2.5.2 |
| **小计砍掉** | **4,925 行** | **+ 72 个 MDX** |

**额外收益(D6 后可完整实现)**:静态站点模式与 Mock 模式**同时砍掉**后,
`env.NEXT_PUBLIC_STATIC_WEBSITE_ONLY === "true"` 与 `isMock` 这两个开关可**一并清除**。

§10.2④ 记录过:这两者**成对出现**,共同组成主聊天页的
`canRegenerate` / `canEdit` / `canBranch` / `disabled` 布尔表达式
(仅 `chats/[thread_id]/page.tsx` 里 `NEXT_PUBLIC_STATIC_WEBSITE_ONLY` 就出现 **7** 次)。
只砍一个只能拿一半收益;两个都砍,这些能力判定才真正变干净。

**连带简化(已补完整 grep 统计)**:`isMock` 全库 **102 处 / 15 个文件**,
`NEXT_PUBLIC_STATIC_WEBSITE_ONLY` **35 处 / 17 个文件**。逐文件清单:

| 位置 | `isMock` 处数 | 简化内容 |
| --- | --- | --- |
| `core/threads/hooks.ts` | **23** | `ThreadStreamOptions.isMock` 及其向下传递全部移除 |
| `app/workspace/chats/[thread_id]/page.tsx` | **17** | 能力判定表达式显著收敛(另含 7 处静态模式开关) |
| `app/workspace/agents/[agent_name]/chats/[thread_id]/page.tsx` | **13** | 同上(另含 5 处静态模式开关) |
| `components/workspace/artifacts/artifact-file-detail.tsx` | **11** | 产物详情的演示分支移除 |
| `components/workspace/sidecar/context.tsx` | 7 | `isMock` prop 移除 |
| `core/api/api-client.ts` | 6 | `getAPIClient(isMock)` → `getAPIClient()`;去掉 `_clients` 的 `"mock"`/`"default"` 双键 Map;去掉 `createStaticClient()`(静态模式的桩 client) |
| `components/workspace/input-box.tsx` | 5 | 输入框 `disabled` 判定收敛 |
| `core/sidecar/api.ts` | 3 | 演示分支移除 |
| `core/artifacts/utils.ts` | 3 | 同上 |
| `core/artifacts/loader.ts` | 3 | 同上 |
| `core/artifacts/hooks.ts` | 3 | 随 hooks 重写为 composable 时一并去掉 |
| `components/workspace/sidecar/sidecar-panel.tsx` | 3 | 同上(另含 2 处静态模式开关) |
| `core/config/index.ts` | 2 | `getLangGraphBaseURL(isMock)` → 去掉 `isMock` 分支与 `/mock/api` 兜底 |
| `components/workspace/chats/use-thread-chat.ts` | 2 | `searchParams.get("mock")` 入口移除(全库唯一读取点) |
| `components/workspace/messages/context.ts` | 1 | `ThreadContext` 从 `{ thread, isMock }` 简化为 `{ thread }` |
| **合计** | **102** | |

⭐ **这对复制后的 `app/core/` 是净收益**(D7 下无共享包):client 工厂
不必再带演示模式分支(§3.1 / §4.1),`ThreadStreamEngine` 的接口也更干净。
`core/static-mode.ts` 整个文件随 D6 删除。

**特效件的裁剪收益被行数低估**:那 1,904 行是 GSAP / WebGL(`ogl`)特效,
Vue 侧需完全重写且无现成对应物,单位行的重写成本远高于普通组件。

#### 2.5.2 为什么砍 Mock 演示模式

实测它的**唯一入口**是 landing 页的 Case Studies 区块 ——
而 landing 已被 D6 砍掉,保留 Mock 等于保留一个**没有入口的功能**:

```
落地页「Case Studies」6 个案例卡
  └─ case-study-section.tsx:58
       href={pathOfThread(caseStudy.threadId) + "?mock=true"}   ← 全库唯一入口
            ↓
     use-thread-chat.ts:122   isMock = searchParams.get("mock") === "true"
            ↓
     getAPIClient(true) → ${origin}/mock/api
            ↓
     11 个 handler 返回预录假数据(假模型列表、假技能列表、
     预录 history / artifacts / mcp 配置 / lark 状态)
            ↓
     输入框 disabled —— 访客只能看,不能发消息
```

判定依据:
- **产品定位**:与已砍的静态站点模式是**同一产品目的的两种实现**(官网演示)
- **无文档**:`README` / `README_zh` / `AGENTS.md` 零提及;仅在两份 skill 开发计划里
  被当作"改这个文件让技能出现在 UI 列表"的附带步骤
- **无其他入口**:全库仅 `case-study-section.tsx:58` 一处引用 `mock=true`

**测试影响**:`thread-history.spec.ts:655` 有一个 `?mock=true` 用例
(断言"mock 模式不得加载真实 run"),该用例随之删除。spec 文件本身保留。

#### 第 2 类 · 非功能性技术能力(技术决策)

| 项 | D6 结论 | 依据 |
| --- | --- | --- |
| 无障碍 `aria-*` + `sr-only` | ❌ 砍(D5 + D8) | 与业务功能无关;**5 处** E2E 改 testid(D5 两处 + D8 三处,§0.4) |
| SEO / OG image | ❌ 砍 | 内部系统无需 |
| **移动端适配** | ✅ **保留**(D6) | 有移动使用场景;`ui-polish-mobile.spec.ts` 是守门人 |
| **暗色主题** | ✅ **保留**(D6) | 成本近零(CSS 变量已写好),但需与 antdv token 桥接(§2.3.3) |
| **i18n 双语** | ✅ **保留**(D6) | 🔴 **必须保留** —— 见下 |

##### 🔴 i18n 是反直觉的陷阱(即便只用中文也不能砍)

`i18n` 看起来最像"业务无关"(3,086 行纯文案数据),但实测它是**测试的强依赖**:

```
playwright.config.ts:17     locale: "en-US"     ← 固定英文
getByText 断言英文文案:      197 处
getByText 断言中文文案:        2 处
```

砍掉 `en-US` 词典 = **废掉近 200 处 E2E 断言**,直接击穿 §1.2 的验收策略。
而保留成本近零(纯 TS 数据,复制即可)。**D6 保留双语是正确决策。**

#### 第 3 类 · 可选产品特性(产品决策)

这一类**本身就是业务功能**,只是优先级可能较低。砍它们属于减需求,
需产品决策而非技术决策。

| 项 | 行数 | D6 结论 |
| --- | --- | --- |
| token 用量统计与展示 | 942 | ✅ 保留 |
| workspace 变更卡 | 619 | ✅ 保留 |
| 引文 citations 面板 | 417 | ✅ 保留 |
| 命令面板(⌘K) | 373 | ✅ 保留 |
| 会话导出 | 317 | ✅ 保留 |
| 语音输入 | 181 | ✅ 保留 |
| run 时长展示 | 163 | ✅ 保留 |
| 浏览器通知 | 103 | ✅ 保留 |
| 后续建议 | 64 | ✅ 保留 |
| input-polish 草稿润色 | 32 | ✅ 保留 |
| **小计** | **3,211** | **全部保留**(D6) |

#### 2.5.3 裁剪后的量级修正

| | 裁剪前 | 裁剪后 |
| --- | --- | --- |
| 需重写的 UI 层 | ≈ 36,700 行 | **≈ 31,780 行**(D9 再减 2,100 → **≈ 29,680**,见 §2.6.5)|
| MDX 内容 | 72 个文件 | **0** |
| E2E spec 文件数 | 26 | **24**(删 `landing.spec.ts`、`docs-localized-links.spec.ts`) |
| E2E 用例 | — | 另删 `thread-history.spec.ts` 的 1 个 `?mock=true` 用例 |
| 运行模式开关 | 4 种(正常/Mock/静态/免鉴权) | **2 种**(正常/免鉴权)—— 见下 |
| 工期影响 | — | **减 3–4 周** |

**运行模式从 4 种降到 2 种**是 D6 最被低估的收益。01 号文档 §1.4 列出的四种模式,
每一种都要在重写时单独验证;砍掉 Mock 与静态站点后只剩「正常」与「免鉴权(E2E 用)」,
**测试矩阵直接减半**。

---

### 2.6 零引用代码清理(D9)

**20 个文件 / 2,100 行,存活区零引用。** 已按 §0.5 实跑证明。
与 D6 的区别:**D6 砍功能(产品决策),D9 砍死代码(技术事实)** —— 分开记录,
以后才看得清哪些是可逆的产品选择。

#### 2.6.1 `ai-elements` 28 个里 14 个零引用 = 1,660 行

该目录**无 barrel、无 `export * from`、无非字面量动态导入**(全部实测),
所以任何使用必须经过含 `ai-elements/` 的 import 路径。存活区实际被导入的只有 14 个:

| ❌ 零引用(不移植) | 行数 | ✅ 在用(需移植) | 引用文件数 |
| --- | --- | --- | --- |
| `context` | 408 | `prompt-input` | 9 |
| `open-in-chat` | 365 | `conversation` | 4 |
| `web-preview` | 263 | `streamdown` / `shimmer` | 3 / 3 |
| `plan` | 142 | `reasoning` / `model-selector` / `chain-of-thought` | 2 各 |
| `edge` | 140 | `task` `suggestion` `queue` `message` `loader` `code-block` `artifact` | 1 各 |
| `sources` | 77 | | |
| `checkpoint` / `node` | 71 / 71 | | |
| `connection` `image` `canvas` `controls` `toolbar` `panel` | 123 合计 | | |
| **小计** | **1,660** | **小计 14 个 / 3,714 行** | |

> ⚠️ **本表推翻了 §4.3 原先的分级**(那份是按名字推测,未实测):
> `sources` 与 `web-preview` 原列「P1 必需 / 核心体验」,**实测两者零引用**;
> `queue` 原列「P3 可能可砍」,**实际有 1 处真实引用**。
> **§4.3 的 P0 使用面盘点任务由本节完成,P0 不必重做。**

#### 2.6.2 `ui/` 3 个原语零引用 = 334 行

| 件 | 行数 | 说明 |
| --- | --- | --- |
| `carousel` | 241 | **全库**零引用(不止存活区)。原被误归入「纯自研」,实际包装 `embla-carousel-react` |
| `avatar` | 53 | **全库**零引用 → **antdv 需映射原语从 15 降到 14** |
| `sonner` | 40 | **本地包装**零引用。真实调用是 10+ 处 `import { toast } from "sonner"` **直连 npm 包**,`Toaster` 也由 `workspace-content.tsx:44` 从 npm 包直接导入 |

> 🔵 **`sonner` 要分清**:本地包装是死的(不移植这 40 行),
> 但 **toast 功能是活的**且被 E2E 用 `getByText` 断言文案 →
> antdv 缺口清单里 **`sonner` 保留、`carousel` 移除**(§2.3.1 / §2.3.2)。

#### 2.6.3 零散 3 个 = 106 行

| 文件 | 行数 | 处理 |
| --- | --- | --- |
| `core/auth/proxy-policy.ts` | 55 | ⚠️ **代码砍,契约要带走** —— 见下 |
| `components/workspace/streaming-indicator.tsx` | 34 | 全仓零引用,直接不移植 |
| `components/workspace/overscroll.tsx` | 17 | 全仓零引用,直接不移植 |

#### 🔴 2.6.4 唯一的例外:`proxy-policy.ts` 代码死了,契约没死

这个文件**永不执行**(全仓零引用,含配置与测试),但它的**内容是一份代理契约**,
与 §3.2.1 的 Nuxt `routeRules` 直接相关。**砍文件,但这份策略必须落进 Nuxt 代理实现**:

```
允许的上游路径前缀(8):threads / runs / assistants / store / models / mcp / skills / memory
必剥离的请求头(12):host connection keep-alive transfer-encoding te trailer upgrade
                    authorization x-api-key origin referer proxy-authorization
必剥离的响应头(8):connection keep-alive transfer-encoding te trailer upgrade
                    content-length set-cookie
凭据:cookie `access_token`  │  非 GET/HEAD 强制 CSRF  │  超时 120_000 ms
```

**这是「零引用」与「可以忘掉」之间唯一的真实缝隙** —— 死代码里可能封装着活知识。
D9 清单里其余 19 个文件不存在这个问题(都是未接线的 UI 组件)。

#### 2.6.5 D9 的量级影响

| 项 | 原 | D9 后 |
| --- | --- | --- |
| `ai-elements` | 28 个 / 5,374 行 | **14 个 / 3,714 行** |
| antdv 需映射原语 | 15 | **14** |
| 非 Radix 第三方**存活文件** | 5 | **3**(`command`/`resizable`/`confetti-button`)|
| 非 Radix **能力缺口** | 5 | **4**(上列 3 个 + `toast`,文件死但能力活)—— 口径区分见 §2.3.1.1 |
| `ui/` 存活文件合计 | 44 | **32**(D6 −9、D9 −3,见 §2.3.1.1)|
| 需重写总量 | ≈ 31,780 行 | **≈ 29,680 行** |
| 工期 | — | **省 1–2 周**(保守;主要落在 P5)—— ✅ **已计入 §7 总账**(P5 8–12 → **7–11**),旧版漏计,本轮已更正 |

工期按保守报:行数省了 6.6%,但零引用件里大头是 `context` 408 / `open-in-chat` 365 /
`web-preview` 263,其余 11 个平均仅 60 行 —— **省的行数密度低于平均重写成本**。

#### 2.6.6 另外两类(不属于 D9)

| 项 | 性质 |
| --- | --- |
| `src/dev-origins.js`(59 行) | **不是死代码** —— 被 `next.config.js:6` 引用(`allowedDevOrigins`)。但它是 Next 专用,Nuxt 有自己的 devServer 配置 → **不移植,非砍** |
| `tests/e2e-record/` + `playwright.record.config.ts` | 录制工具,不在 25 spec 验收范围 → **v1 可不做** |
| 显式 `role=` 属性 23 处中的 **20 处** | E2E 一次未断言(`group` 5 / `img` 4 / `status` 3 / `presentation` 2 / `alert` 2 / `region` `log` `listbox` `list` 各 1)→ 按 D5/D8 同一逻辑可一并不写;仅 `textbox` `option` `link` 各 1 处需逐一确认 |

---

### 2.7 可参照实现:`nuxt-modern-starter`

> **来源**:`/Users/wangcheng/Documents/workSpace/frontEnd/nuxtProjects/nuxt-modern-starter`
> @ `ece56c2`(61 commits,2026-07-04 → 07-22)
> **核实时间**:2026-07-30。核实方式:实跑其完整质量门禁,**全绿**
> (lint / format / stylelint / typecheck / i18n:check / docs-sync / **126 用例**)。

这是一个**技术栈与 D1/D2 完全重合**的真实 Nuxt 工程(Nuxt 4 + antdv + Pinia + vue-i18n),
规模 `app/` 11,560 行。它对 P0 帮助明显,但**对工期大头零帮助** —— 结算见 §2.7.5。

#### 2.7.1 ✅ 可直接抄(已实跑验证)

| # | 抄什么 | 对应 deer-flow 的哪一项 | 收益 |
| --- | --- | --- | --- |
| 1 | **antdv + Nuxt 接线**:`@ant-design-vue/nuxt` 模块 + `antd: { extractStyle: true }` + 根组件 hydration 前的 `data-theme` 内联脚本 | **P0 ①/⑧**、**风险 R5b/主题闪烁** | 省 2–3 天;D20 后 **R5b 消除**,内联脚本继续用于 CSR 主题防闪 |
| 2 | **主题桥接链**(见下) | **P0 ⑧**、**风险 R5c** | 3–5 天 → **2 天** |
| 3 | **antdv locale 联动 vue-i18n**:`config/antd-locale.ts` + 对应单测 | D6 保留双语的连带项 | 省 1 天 |
| 4 | **routeRules 从单一 config 派生**,不在 `nuxt.config` 手写 | §3.2.1 + §1.3 第 1 条 | 使「URL 结构与 React 版一致」可被测试断言 |

**主题桥接链的具体形态**(比 §2.3.3 的设计更进一步 —— **构建期生成**而非运行时读取):

```
config/theme-palette.json                    ← 单一真相(色板 / 圆角 / 间距 / 字号 / z-index)
        │
        ├─▶ scripts/generate-theme-scss.mjs  ← prebuild 钩子,生成 SCSS/CSS 变量
        └─▶ config/theme.ts::getAntdThemeToken(mode)  ← 生成 antdv token
                    │
              app/composables/useTheme.ts    ← mode / resolvedMode / antdTheme
                    │
              app/app.vue  <a-config-provider :theme="antdTheme" :locale="antdLocale">
```

✅ **原先这里有一处必须处理的差异,已被 D15 消除。**

旧文写:「deer-flow 的真相源是 `globals.css` 里的 **Tailwind 4 CSS 变量**,不是 JSON。
两条路 —— 改成 JSON 驱动(推荐,稳),或写脚本从 CSS 变量提取(脆)。」

**D15 弃用 Tailwind 后,这个岔路不存在了** —— 参照工程的链条
(`theme-palette.json` → `generate-theme-scss.mjs` → SCSS + antdv token)**本来就是为 SCSS 设计的**,
deer-flow 直接采用同一形态即可,**整条可抄,不需要任何转换层**。
唯一的补充是多生成一份 CSS 自定义属性(运行时暗色切换用,见 §2.3.3)。

#### 2.7.2 🔵 借鉴机制,但必须裁剪

| # | 机制 | 用在哪 | 裁剪要求 |
| --- | --- | --- | --- |
| 5 | **`【文件职责】` 文件头 + `docs-sync` 机械强制**(该工程 124/124 = 100% 覆盖,CI 中跑在 quality gate 之前) | 🔴 **§5 的 44 条红线** —— 原方案只建议做成「PR 模板 checklist」(人肉),这套是**机械校验的 claims**,强一个量级<br>✅ **v3 已落地 checklist(§5.2)**,并把 B 类 12 条里的 **6 条做成了机械测试** | 全套 1,988 行**太重**。只抄两点:① 文件头存在性强制(约 10 行);② claims → 文件的映射,用于 **C 类 29 条**。**❌ 不抄 batches / reports / enrich** |
| 6 | **架构守护型测试**(断言文件位置与 import 形式,而非运行时行为) | 🔴 **§1.3 五条约束** + **风险 R14** —— 五条约束目前只能靠人肉 review | **五条里四条可机械化**,成品形状见 §2.7.6 |
| 9 | 🔴 **契约测试模式**(从被拷贝方源码提取算法/常量执行比对) | 🔴 **§3.1 的 D7 最大技术债** —— 两份 13,486 行拷贝「必然发散」 | 见 **§3.1.2**,约 **180 行**(D13 后)。**这是本次参照中价值最高的一项**<br>⚠️ **要抄的正是它的原始形态(导出级提取比对)** —— 简化成文件级哈希会在 `threads/hooks.ts` 上失效,这就是 D13 的由来 |
| 7 | **`i18n-manager.mjs`** 的 check / diff / scan / unused | **P6 的「i18n 双语完整性核对」** —— deer-flow 有 3,086 行词典、197 处英文断言 | 直接可用 |
| 8 | **`quality` 一把梭脚本**:`lint → format:check → stylelint → typecheck → i18n:check → test → build` | **§3.2.3 的 `make verify` 内容模板**(D11) | 顺序照抄 |

> 🔴 **抄第 6 项时必须吸取它的教训**。我在该工程里实测发现,它这类测试的通病是
> **锁在错误的层**:硬编码文件名、只拦相对路径不拦别名深引、对 `nuxt.config.ts` 的
> **源码文本**做 `toContain` 而不验证真实产物 —— 结果放过了一处真实的边界违规。
> **抄思路,不要抄断言层级。** deer-flow 侧的每条守护测试都必须能通过「故意引入缺陷 → 检查必须失败」的反向验证。

#### 2.7.6 架构守护测试:成品形状与五条约束映射

参照工程 `tests/unit/page-structure.test.ts` 的四个可直接改写的模式:

```ts
// ① 别名深引 —— 同时覆盖 ~/ 与 @/,以及动态 import()
/from\s+['"](?:~|@)\/features\/[^/'"]+\/[^'"]+['"]|import\(\s*['"](?:~|@)\/features\/[^/'"]+\/[^'"]+['"]\s*\)/g
// ② 相对路径逃逸
/from\s+['"](?:\.\.\/)+(?:features|api|config)\//g
// ③ 跨模块引用(提取被引模块名后比对)
/from\s+['"](?:~|@)\/features\/([^/'"]+)(?:\/[^'"]*)?['"]/g
// ④ 动态枚举,不硬编码文件名 —— 新增文件自动纳入检查
const listFiles = (root, exts) => { /* 递归 readdirSync */ }
```

**映射到 §1.3 的五条约束(四条可机械化,直接缓解 R14)**:

| §1.3 约束 | 机械化 | 怎么写 |
| --- | --- | --- |
| **2. `data-testid` 完全一致** | ✅ **最该做** | 扫 `app/**` 的 testid 集合 **⊇** 扫 `tests/e2e/**` 的 81 处 `getByTestId` 值 |
| **3. 继续用语义化标签** | ✅ | 扫 `.vue` 模板禁 `<div @click>` / `<span @click>` —— D5/D8 后 **83 次 role 断言全靠原生标签**,这条比原来更关键 |
| **1. URL 结构完全一致** | ✅ | 遍历 `app/pages/**` 生成路由表,与 `frontend/src/app/**` 比对(**D12 允许只读**) |
| **5. cookie 名与语义一致** | ✅ | 扫 `locale` / `sidebar_state` 字面量 |
| **4. 可见文案一致** | ⚠️ 半自动 | 靠 i18n 词典原样复用 + `i18n-check` 检出缺失/未使用 |

> ⚠️ **抄的时候必须避开它的原缺陷**:该工程这类测试原本**硬编码文件名 + 只拦相对路径**,
> 结果放过了一处真实违规(`pages/docs/[id].vue` 深引 `~/features/editor/composables/...`)。
> 上面 ①④ 两点就是修复后的形态 —— **动态枚举 + 覆盖所有 import 形式**,缺一不可。

#### 2.7.7 两个会咬人的工程细节(实测踩到)

1. **`quality` 脚本里 `build` 必须在 `test` 之前** ——
   一旦有测试断言构建产物(如 §2.7.6 之外的 chunk 断言),顺序反了就永远读不到 `.output`,
   测试静默跳过、永远绿。`make verify` 若加产物断言,同样注意。
2. **缺前置条件时用 `ctx.skip()`,不要用 `return`** ——
   `return` 是**静默 pass**,会伪装成「测过了」;`ctx.skip()` 才是真跳过。

#### 2.7.3 ⚠️ 不要整体照搬,按阶段借鉴

| 项 | 原因 |
| --- | --- |
| **把现有 workspace 整体改成 `app/features/`** | 🔴 **与 §3.2 冲突**。该工程是 6 个 feature / 3,425 行;deer-flow 的 `components/workspace` 是 **20,286 行**,且 §3.2 明确要求**子目录镜像 React 版**以便对标时双向查找。对标阶段按 feature 重划会直接破坏双向查找；但这不禁止 v1 之后为**新增领域**采用 feature 垂直切片，见下方「渐进式扩展规则」 |
| **CSP 配置** | 它那份有**未解冲突**:`script-src 'unsafe-inline'` 去不掉 —— nonce 必须每响应唯一,与它的 prerender/SWR 缓存策略根本不兼容。deer-flow 是内网工具,入口在 Nginx(:2026)或 `docker-vue`(:2027),CSP 该放哪层是另一个问题 |
| **`.env.*` 白名单提交** | 明确的反面教材:`.gitignore` 用 `!.env.prod` 强制提交生产 env 文件。deer-flow 用 `.env.example` |
| **`app/lib/http` 原样复制** | deer-flow 有自己的 `core/api/`(从 React 版复制,含 CSRF 双通道、401 处理、SSE gap 恢复 5 次预算),复杂度高一个量级；只借鉴其 Public/Auth/Product client 的分层思想 |

#### 2.7.3a 🔵 渐进式扩展规则(新增业务适用)

参照工程的 `app/features/<domain>` 不用于重划现有 workspace,但适合作为 DeerFlow **对标完成后的新增业务目录约定**。两套形态允许并存,不得为了形式统一而回迁旧代码:

```text
现有对标区(保持 React 镜像)       新增领域(垂直切片)
app/components/workspace/          app/features/billing/
app/core/threads/                  app/features/pricing/
app/composables/                   app/features/news/
                                   ├── components/
                                   ├── api.ts / types.ts
                                   ├── composables/ / stores/
                                   └── index.ts(唯一公共导出面)
```

新增业务的页面只负责路由、layout、SEO 和 feature 组合;服务端状态进入 `@tanstack/vue-query`,客户端工作流状态才进入 Pinia。Feature 之间不得深引内部文件,跨领域共享 API/类型放在 `core/<domain>` 或已有共享 adapter 中。

新增页面必须先声明以下元数据,再决定实现:

| 元数据 | 可选值 | 约束 |
| --- | --- | --- |
| 区域 | 营销 / 认证 / 产品 / 编辑器 | 决定 layout、鉴权和依赖边界 |
| 渲染 | prerender / SSR / SWR / CSR | 只在 `config/routes.ts` 登记,不在页面散落 |
| 数据 | 静态 / Public API / Auth API / Product API | 公开 SSR 数据不得携带用户凭据 |
| SEO | index / noindex、canonical、hreflang | 公开页面必须接入统一 SEO 工具 |
| 缓存 | 无缓存 / SWR TTL / 按需失效 | 价格等商业数据最终以服务端校验为准 |

#### 2.7.3b 🔴 安全与部署边界:只借鉴分层,不复制认证实现

参照工程把 API 直连后端、在普通可读 Cookie 中保存 token 并由浏览器转成 Bearer,适合作为轻量 starter 的实现,不作为 DeerFlow 的生产边界。DeerFlow 继续采用 Nitro 代理契约:

```text
浏览器 ── HttpOnly session/cookie + CSRF ──▶ Nitro
Nitro  ── 代理、鉴权、CSRF、SSE 不缓冲、超时 ──▶ Gateway
```

Public client 的「主动剥离 authorization/cookie」可以借鉴;但 `frontend-vue` 的敏感 token 不得依赖可被页面 JavaScript 读取的 Cookie。公开营销数据可通过 Public API 在 SSR/prerender/SWR 中读取,产品区实时流和用户数据必须沿 DeerFlow 的 Gateway 契约处理。

#### 2.7.3c 🔵 可借鉴的公开站点基础设施

后续新增落地页、价格页、关于页、新闻页时,可借鉴参照工程的以下职责分布:

- `config/routes.ts`: 路由区域、渲染规则、公开路径单一来源;
- `server/routes/`: `sitemap.xml`、`robots.txt` 等 SEO 资源;
- `server/middleware/`: 首跳鉴权与 canonical 重定向;
- `server/api/`: 受保护的 revalidate/BFF 入口;
- `server/utils/`: SEO、缓存失效和请求边界工具;
- `app/api/public.ts`: 公开内容 adapter,不携带用户凭据。

SWR 仅用于新闻、帮助文档、营销内容等公开数据;不得用于聊天流、thread 状态或工作台实时数据。参照工程通过 webhook 触发缓存失效的模式可以复用,但不得依赖 Nitro 私有 cache key 算法而不配升级回归测试;多实例限流必须放到共享网关或 Redis 等外部设施。

#### 2.7.4 🚫 它完全没覆盖的(deer-flow 最难的部分)

| deer-flow 的难点 | 参照工程 |
| --- | --- |
| 服务端状态(D24,§4.4 的 key 约定 / 失效策略) | ⚠️ **只有分层方向参照** —— 参照工程不用 TanStack Query,DeerFlow 按 D24-a 使用 `@tanstack/vue-query`;不能照抄 `app/lib/http` |
| **`resizable`**(风险 R4 的 go/no-go,承载 **08 号** §8.3 五条布局红线 + issue #4465) | ❌ **零参照** |
| `ThreadStreamEngine`(§4.1,4–6 周) | ❌ 无任何流式 / SSE |
| `streamdown-vue`(§4.2,5–8 周,全案最高风险) | ❌ 无 |
| E2E(**验收定义就是 25 spec 全绿**) | ❌ 无 Playwright(仅 126 个单测 + 1 个 smoke) |

#### 2.7.5 净收益结算(诚实口径)

| 项 | 影响 |
| --- | --- |
| P0 ① 选型核实 | 省 **2–3 天**(D24 后不再做 vue-query 客户端插件 smoke,改做 server-state contract fixture) |
| P0 ⑧ 主题桥接 PoC | 3–5 天 → **2 天** |
| antdv locale | 省 **1 天** |
| **P0 合计** | **省约 1–1.5 周** |
| 风险 **R5b**(FOUC) | ✅ **消除** |
| 风险 **R5c**(双色板) | 🟢 有成熟解法 |
| 风险 **R14**(D11 无 CI 门禁) | 🟢 **部分补偿** —— 靠第 5、6 两项把五条约束机械化 |
| **四个自研基础件 + resizable** | ❌ **一天没省** —— 那是 17–26 周里的大头 |

> **判断**:它对 **P0 帮助明显,对工期大头零帮助**。
> 但 **R5b / R5c / R14 三个风险的缓解,价值可能比那 1.5 周更大** ——
> 尤其 R14,那是 D11 定案后 deer-flow 最实质的风险。

---

### 2.8 `frontend-vue/package.json` 定版(v3 新增)

> 🔴 **本节的目的是消除「实现时还要临时决定装什么包」。**
> React 版实测 **97 个依赖**(76 dependencies + 21 devDependencies),
> 已逐个分类:**保留 / 替换 / 自研 / 不移植**。下方给出可直接落盘的完整内容。

#### 2.8.1 🔴 React 耦合的机械核查(97/97 全覆盖,非人工判断)

> **方法**:逐个读 `node_modules/<pkg>/package.json` 的 `peerDependencies` + `dependencies`,
> 再 `grep` 该包 dist 里实际的 `require("react")` / `from "react"`。
> **97 个依赖全部在 `node_modules` 中找到,零缺失。**

| | 数量 |
| --- | --- |
| 🔴 **React 耦合**(peer 或 dep 声明 react/react-dom) | **37 个** |
| ✅ **框架无关** | **60 个** |

**37 个 React 耦合包的逐个处置**:

| 包(耦合方式) | 处置 |
| --- | --- |
| 🔴 **`@langchain/langgraph-sdk`**(peer: react, react-dom) | 🔴 **D22:不装包**。流处理与 Gateway API 全部手写;SDK 仅作为 React 版现状和 wire format 参照 |
| ✅ **`@langchain/core`**(无 React peer) | 🔴 **D23:不装包**。React 版仅 1 处 `import type ToolCall`,运行时使用面 0;本地手写 `ToolCall` 最小类型 |
| `@radix-ui/*` **16 个**(全部 peer: react[+dom]) | → `ant-design-vue`(D2) |
| `@streamdown/code` `@streamdown/mermaid`(peer: react) | → **直接用 `shiki` / `mermaid`** |
| `@tanstack/react-query`(peer: react) | ✅ **D24-a:换 `@tanstack/vue-query`**(实测 peer 只有 `vue`,零 React 依赖)。~~D24 自研 server-state 层~~ 已推翻 |
| `@uiw/react-codemirror`(peer: react, react-dom) | → Vue 绑定(⚠️ **两个主题包不耦合,保留**,见下) |
| `@xyflow/react`(peer: react, react-dom) | 🔴 **D25:不装 Vue Flow**。使用面均属 D9 零引用 ai-elements 画布件 |
| `cmdk`(peer: react, react-dom) | → **自研 `command`** |
| `embla-carousel-react`(peer: react) | ❌ D9 砍 |
| `lucide-react`(peer: react) | → `lucide-vue-next` |
| `motion`(peer: react, react-dom) | 🔴 **D25:不装 `motion-v`**。用 CSS / Vue `<Transition>` / RAF |
| `next` `next-themes`(peer: react, react-dom) | → `nuxt` / 自写 `useTheme.ts`(不引 `@nuxtjs/color-mode`) |
| `nextra` `nextra-theme-docs`(peer: react, react-dom) | ❌ D6 砍 |
| `react-dom`(peer: react) | ❌ |
| `react-resizable-panels`(peer: react, react-dom) | → **自研**(D19 已预授权) |
| `sonner`(peer: react, react-dom) | → antdv `message` |
| `streamdown`(peer: react, react-dom) | → **自研 `streamdown-vue`**(§4.2) |
| `use-stick-to-bottom`(peer: react) | → **自研 composable** |
| `@testing-library/react`(peer: react, react-dom) | → `@vue/test-utils` |
| `@radix-ui/react-icons`(peer: react) | ❌ D6 砍(只在 landing) |

##### 🔴 D22:`@langchain/langgraph-sdk` —— 曾可复用,但 Vue 版决定**不装**

这个包表面看 `peerDependencies` 含 `react` + `react-dom`,此前实测三条证据表明
**主入口技术上可在 Vue 侧使用**:

| 证据 | 实测 |
| --- | --- |
| ① peer 是**可选的** | `peerDependenciesMeta` 里 `react` / `react-dom` 均标 **`"optional": true`** |
| ② **按子路径隔离** | `exports` 有 8 个子路径:`.` `./client` `./auth` `./logging`(框架无关)与 `./react` `./react-ui` `./react-ui/server`(React 专属)**是分开的** |
| ③ dist 里 react import **只出现在 React 子目录** | `grep` 结果全部落在 `dist/react-ui/*`,主入口与 `client` 干净 |

**代码库实际用量**:`@langchain/langgraph-sdk` 主入口 **23 处**、`/client` **4 处**;
`/react` **仅 4 处** —— **其中 3 处是 `import type { BaseStream }`(类型,编译期擦除)**,
唯一的值引用是 `threads/hooks.ts:3` 的 `useStream`,**而它正是 §4.1 要重写掉的那 670 行**。

> 🔴 **D22 结论:技术上可用不等于架构上该用。Vue 版不装 `@langchain/langgraph-sdk`。**
> 原因不是它跑不起来,而是它会把前端流处理继续绑定在 LangGraph SDK 的 run/thread/stream
> 心智模型上。当前 Gateway 的真实 SSE 契约由 **DeerFlowGatewayStreamAdapter** 手写适配,
> `BaseStream` 等类型由 `ThreadStreamEngine` 自己导出等价最小类型。
> 守护测试从“禁 `/react` 与 `/react-ui` 子路径”升级为:
> **`frontend-vue/` 内禁止 import 整个 `@langchain/langgraph-sdk` 包**。

##### 另两处修正(机械核查带出的)

| # | 发现 | 处置 |
| --- | --- | --- |
| 1 | ✅ **`@uiw/codemirror-theme-basic` / `-monokai` 不耦合 React**(peer/dep 均无 react,dist 也无) | 🔴 **D25 后仍不装**。既然 Vue 侧已自写 CodeMirror 薄封装,主题也改用 CodeMirror 6 原生 `EditorView.theme` |
| 2 | 🔴 **`remend` 不在 `package.json` 里** —— 它是 `streamdown` 的**传递依赖**(1.3.0)。而 D15/§4.2 要弃用 `streamdown` 自研 | **必须提升为直接依赖**。✅ 已核实 `remend@1.3.0` **零 `peerDependencies`、零 `dependencies`**,完全独立 |

##### 保留清单的 dist 级验证

§2.8.2 中标为"保留原包"的 **30 个**,已逐个验证 peer/dep 无 react **且 dist 内无 react import**。
`@langchain/langgraph-sdk` 的 dist 隔离证据仅作为 D22 前历史记录,不进入 Vue manifest。

---

#### 2.8.2 逐个依赖的处置(97 个分四类)

**① 保留原包原版本(框架无关,已 dist 级验证)**

| 类 | 包 |
| --- | --- |
| unified 管线 | `remark-gfm` `remark-math` `rehype-katex` `rehype-raw` `rehype-slug` `unist-util-visit` `hast` `@types/hast` |
| 渲染底层 | `shiki` `katex` `mermaid` `remend`(🔴 **原为 streamdown 的传递依赖,须提为直接依赖**) |
| 编辑器 | `codemirror` + `@codemirror/lang-{css,html,javascript,json,markdown,python}` + `@codemirror/language-data` |
| 纯工具 | `date-fns` `zod` `best-effort-json-parser` |

**② 换 Vue 对应物**

| React | → Vue | 依据 |
| --- | --- | --- |
| `react` `react-dom` `next` | `nuxt` `vue` | D1 |
| `@radix-ui/*`(**16 个**) | `ant-design-vue` + `@ant-design-vue/nuxt` | D2 |
| 🔴 `lucide-react` | `lucide-vue-next` | ⚠️ **i18n 词典依赖它**(见 §3.1 的 Tier 2 改判) |
| `next-themes` | 自写 `app/composables/useTheme.ts` | §2.3.3 / §2.8.6 |
| 🔴 `@tanstack/react-query`(16 文件) | ✅ **`@tanstack/vue-query`** | 🔄 **D24-a**(推翻 D24)。实测 `5.101.4` peer 仅 `vue ^2.6.0 \|\| ^3.3.0`,零 React 依赖 |
| ~~`@xyflow/react`(7 文件)~~ | 🔴 **D25:不装 Vue Flow** | D9 已砍其全部使用面 |
| ~~`motion`(8 文件)~~ | 🔴 **D25:不装 motion-v** | CSS / Vue `<Transition>` / RAF |
| 🔴 *(浏览器 API,React 版为裸用)* | ✅ **`@vueuse/core`** | 🔄 **D25-a**(修订 D25)。实测 `14.4.0` @ 2026-07-29,Vue 生态事实标准 |
| 🔴 `uuid` / `nanoid` | ✅ **保留 `uuid`**,或本地 `id.ts` 走 `crypto.getRandomValues` 回退 | 🔄 **D25-a**。**不能只写 `crypto.randomUUID()`** —— secure-context-only,内网 HTTP 下 `undefined`(§2.4.6) |
| `@uiw/react-codemirror` | 自写 CodeMirror 6 薄封装 | 🔴 **D25 后主题包也不装**;主题用本地 `EditorView.theme` |
| `@t3-oss/env-nextjs` | *(无包)* `useRuntimeConfig()` | 3 处适配之一 |

**③ 自研,不装包**

| 原包 | 处置 | 出处 |
| --- | --- | --- |
| `streamdown` | **自研 `streamdown-vue`** | §4.2(peer 为 react/react-dom) |
| 🔴 `@streamdown/code` | **直接用 `shiki`** —— 它只是 shiki 的 React 包装(`peerDeps: react`) | v3 实测 |
| 🔴 `@streamdown/mermaid` | **直接用 `mermaid`** —— 同上 | v3 实测 |
| ~~🔴 `@tanstack/react-query`~~ | ❌ **本行已作废** —— **D24-a 改为装 `@tanstack/vue-query`**(见上方"② 换 Vue 对应物") | ~~D24~~ → **D24-a** |
| 🔴 `motion` | **CSS / Vue `<Transition>` / RAF**,不装 `motion-v`。⚠️ **`@vueuse/core` 已由 D25-a 改回保留**,见"② 换 Vue 对应物" | **D25** / **D25-a** |
| 🔴 `@xyflow/react` | **不装 Vue Flow** —— D9 已砍全部画布件 | **D25** |
| `canvas-confetti` | **自研小效果或改普通成功反馈** | **D25** |
| `@uiw/codemirror-theme-basic` / `-monokai` | **CodeMirror 6 原生 `EditorView.theme` 本地主题** | **D25** |
| `nanoid` / `uuid` | **`crypto.randomUUID()` + 本地 `id.ts` 门面** | **D25** |
| `tokenlens` | **不装** —— 只服务 D9 已砍的 `ai-elements/context` | **D25** |
| `react-resizable-panels` | **自研**,D19 已预授权 2–3 周 | 缺口 A / 风险 R4 |
| `cmdk` | **重写 `command`** | 缺口 / 风险 R19 |
| `use-stick-to-bottom` | **自研 composable**(仅 `conversation.tsx` 1 处用) | — |
| 🔴 `ai` | **本地手写最小类型**,不装包。实测当前只用 `Experimental_GeneratedImage` / `FileUIPart` / `UIMessage` / `LanguageModelUsage` / `ChatStatus` 五类类型,且全是 `import type` | **D21** |

**④ 不移植 —— 明确列出理由,避免实现时误装**

| 包 | 理由 |
| --- | --- |
| `tailwindcss` `@tailwindcss/postcss` `prettier-plugin-tailwindcss` `tw-animate-css` `clsx` `tailwind-merge` `class-variance-authority` | 🔴 **D15**(§2.4.3 明确:**不要移植 `tailwind-merge`**) |
| `nextra` `nextra-theme-docs` `gsap` `@types/gsap` `ogl` `@radix-ui/react-icons` | **D6** 砍 docs 站 / 特效件 / landing |
| `embla-carousel-react` `sonner` | **D9** 砍 carousel / sonner 包装(toast 改 antdv `message`) |
| 🔴 `nuxt-og-image` `defu` `h3` `dotenv` | **实测零引用的死依赖**(4 个,均 0 文件)—— 09 号文档标注的"可疑项"已证实。⚠️ `h3` 在 Nuxt 下由框架自带,不需显式声明 |
| `@rsbuild/plugin-react` `@rstest/core` `@testing-library/react` `eslint-config-next` `@types/react` `@types/react-dom` `postcss` | 构建/测试链随框架更换 |

#### 2.8.3 可直接落盘的 `frontend-vue/package.json`

> ✅ **已通过四层验证(2026-07-31),不是纸面清单**:
> ① 逐个 `npm view` 确认版本存在 → ② 逐个查 `peerDependencies` 交叉约束 →
> ③ **与参照工程 `nuxt-modern-starter` 的实际依赖逐个比对**(§2.8.6)→
> ④ 🔴 **D21 前 `pnpm install` 实跑:63/63 全部锁定,依赖图 1,654 个包,
> `--strict-peer-dependencies` 退出码 0、零告警**。
> D21 删除纯类型 `ai` 后,manifest 直接依赖数为 **62**;这是删包不加包,
> D22 删除 `@langchain/langgraph-sdk` 后,manifest 直接依赖数为 **61**(39 dependencies + 22 devDependencies);
> D23 删除 `@langchain/core` 后,manifest 直接依赖数为 **60**(38 dependencies + 22 devDependencies);
> D24 删除 `@tanstack/vue-query` 后,manifest 直接依赖数为 **59**(37 dependencies + 22 devDependencies)。
> D25 删除 9 个 React 迁移惯性/小众包后,manifest 直接依赖数为 **50**(28 dependencies + 22 devDependencies)。
>
> 🔴 **v4 修正(D24-a / D25-a):加回 3 个包,manifest 终值为 53 个直接依赖**
> (**31 dependencies + 22 devDependencies**):
>
> | 包 | 版本 | 依据 | 为什么之前删错了 |
> | --- | --- | --- | --- |
> | `@tanstack/vue-query` | `^5.101.4` | **D24-a** | D24 只核了"React 版是运行时依赖",**没核 Vue 对应物的 peer** —— 实测它 peer 仅 `vue`,零 React 依赖,与 `query-core` 同版本号发布 |
> | `@vueuse/core` | `^14.4.0` | **D25-a** | D25 把它当成 `motion-v` 的附属品一起删了。**它不是** —— 它是 Vue 生态事实标准,2026-07-29 仍在发版,覆盖的是框架无关的浏览器 API |
> | `uuid` | `^14.0.0` | **D25-a** | 🔴 **替代方案 `crypto.randomUUID()` 在内网 HTTP 下不存在**(secure-context-only)。自带 types,不需要 `@types/uuid` |
>
> ⚠️ **v4 是本方案第一次「加包」** —— 前面 D21–D25 全是删包不加包,不引入新 peer 约束;
> **加包会引入 peer 约束,所以 P0 落盘时那次 `--strict-peer-dependencies` 实跑不再是"留证",而是必须项**。
> 三个包的 peer 已逐个核过(`@tanstack/vue-query` → `vue`;`@vueuse/core` → 无;`uuid` → 无),
> 预期仍可零豁免通过,但**以 P0 实跑为准**。
>
> 版本来源分三类:
> - §2.2 参照工程 `nuxt-modern-starter` **实跑通过**的组合(精确锁版,无 `^`)
> - 从 React 版原样沿用的框架无关包(版本真实,`node_modules` 里就是;D21 删除 `ai`,D22 删除 `@langchain/langgraph-sdk`,D23 删除 `@langchain/core`)
> - Vue 侧替代包,**已逐个 npm 核实**(此前是推测,v3 修正见下)

> 🔴 **v3 修正:首版这 18 个里有 7 个大版本写错、2 个依赖漏装。** 记录如下,避免重犯:
>
> | 包 | 首版(推测) | 更正 | 错因 |
> | --- | --- | --- | --- |
> | `lucide-vue-next` | `^0.562.0` | **`^1.0.0`** | 想当然按 `lucide-react` 的 0.562 对齐 —— **两个包版本线不同** |
> | `@nuxtjs/i18n` | `^9.0.0` | **`^10.6.0`** | 🔴 **9.x 只带 vue-i18n `^10.0.7`**,与 §2.2 实跑的 **vue-i18n 11.4.6** 矛盾;10.x 才带 `^11.4.8` |
> | ~~`@nuxtjs/color-mode`~~ | ~~`^3.5.2`~~ | 🔴 **整个包已移除** | 第四轮发现参照工程自写 `useTheme.ts`,不用此模块(§2.8.6) |
> | `stylelint` | `^16.0.0` | **`^17.0.0`** | 与下一行**配错了对** —— `config-standard-scss@17` 的 peer 是 `stylelint ^17` |
> | `stylelint-config-standard-scss` | `^14.0.0` | **`^17.0.0`** | 同上 |
> | `motion-v` | `^1.0.0` | **`^2.3.0`** | 实际已到 2.x;🔴 D25 后不进入 manifest |
> | `vue-tsc` | `^2.2.0` | **`^3.3.8`** | 实际已到 3.x |
> | 🔴 `postcss` | **漏装** | **`^8.3.3`** | `stylelint-config-standard-scss` 的 peer |
> | 🔴 `postcss-html` | **漏装** | **`^1.0.0`** | `stylelint-config-recommended-vue` 的 peer |
>
> **教训**:替代包的版本**不会跟随原包**(`lucide-vue-next` ≠ `lucide-react` 版本线),
> **Nuxt 生态模块有独立的大版本线对应 Nuxt 3/4**,而 **config 类包必须与主包配对查 peer**。

> 🔴 **第二轮(peer 交叉核查)又抓出 3 处 —— 只查"版本存在"是不够的**:
>
> | 问题 | 修正 | 谁要求的 |
> | --- | --- | --- |
> | `happy-dom` 声明 `^15.0.0` | **`^20.11.1`** | `@nuxt/test-utils@4.0.3` 的 peer 是 **`>=20.0.11`** —— 差 5 个大版本 |
> | 🔴 **漏装 `@vueuse/core`** | **`^14.4.0`** | `motion-v@2.3.0` 的 peer(`>=10.0.0`);🔴 D25 后随 `motion-v` 一并不进入 manifest |
> | `zod` 声明 `^3.24.2` | **`^3.25.76`** | D21 前为满足 `ai@6` peer(`^3.25.76 \|\| ^4.1.8`)而上调。D21 后该 peer 不再存在,但保留已验证版本即可,无需再降回去 |
>
> **加上第一轮的 7 个版本错 + 2 个漏装,`package.json` 首版共有 12 处问题。**
> 这说明:**只靠推测写依赖清单几乎必然出错,必须实跑解析。**

#### 2.8.4 落地前必须核实的项(P0 第一周)

> ✅ **原列 3 项已全部关闭,本表无遗留未决项。**
> 第 1 项(CodeMirror 绑定)由 §2.8.5 定为自写;第 2 项(版本)与第 3 项(图标名)由 npm 实核关闭。

| # | 项 | 为什么不能现在定 |
| --- | --- | --- |
| ~~1~~ | ~~Vue 的 CodeMirror 绑定选型~~ | ✅ **已关闭 —— 决定自写薄封装,不引库**(见下方 §2.8.5) |
| ~~2~~ | ~~`@vue-flow/core` / `motion-v` 版本~~ | ✅ **已关闭**:当时 npm 核实为 `1.48.2` / `2.3.0`;🔴 **D25 后二者均不进入 manifest** |
| ~~3~~ | ~~`lucide-vue-next` 里那 8 个图标是否同名存在~~ | ✅ **已关闭**:下载 `lucide-vue-next@1.0.0` 的 `.d.ts` 逐个 grep,**`CompassIcon` `GraduationCapIcon` `ImageIcon` `MicroscopeIcon` `PenLineIcon` `ShapesIcon` `SparklesIcon` `VideoIcon` 8 个全部存在**。<br>⚠️ **P1 仍需复核一次**:React 侧锁 `lucide-react@^0.562`(**0.x 线**),Vue 侧是 **1.x 线** —— 跨大版本,**这 8 个之外若新增图标引用,不保证同名** |

#### 2.8.5 ✅ CodeMirror 绑定:自写薄封装(最后一项待决已关闭)

**决定:不引 Vue 绑定库,自写约 100 行的 SFC 封装。**

| 依据 | 实测 |
| --- | --- |
| 使用面 | **仅 1 个文件 114 行**(`components/workspace/code-editor.tsx`) |
| 实际 API 面 | **7 个 prop**:`value` / `readOnly` / `placeholder` / `theme` / `extensions` / `basicSetup` / `onChange` |
| CodeMirror 6 本体 | ✅ **框架无关**(§2.8.1 已验证:`codemirror` + 8 个 `@codemirror/*` 全部无 react 耦合) |
| `@uiw/react-codemirror` 的本质 | **只是 React 薄壳** —— 真正干活的是框架无关的 `EditorView`/`EditorState` |
| 候选库 `vue-codemirror` | 6.1.1,**最后更新 2023-08-08(近 3 年前)**;peer `vue 3.x` + `codemirror 6.x` |
| 候选库 `codemirror-editor-vue3` | 2.8.0,最后更新 2024-09-20 |

> **判断**:为一个 7 props 的壳引入**近 3 年未更新**的绑定库不划算 ——
> 该层是 CodeMirror 6 API 变化的直接暴露面,库一旦停更就是负债。
> 自写反而只需对接 `EditorView` + `EditorState` 两个稳定 API。
>
> 🔴 **D25 修订**:两个主题包 `@uiw/codemirror-theme-basic` / `-monokai` 虽然实测不耦合 React,
> 但它们来自 React CodeMirror 生态的迁移惯性。Vue 侧既然自写 CodeMirror 薄封装,
> 主题也用本地 `EditorView.theme` 表达,不再安装 `@uiw/*` 主题包。
>
> ⚠️ **兜底**:若自写遇到意外阻力,`vue-codemirror@6.1.1` 的 peer(`codemirror 6.x`)
> 与本方案的 `^6.0.2` 兼容,可作为回退选项。**但不作为首选。**

> ✅ **至此 §2.8.4 的 3 项待核实全部关闭**,`package.json` 无遗留未决项 ——
> **依赖部分可以直接落盘实现。**

#### 2.8.6 🔴 第四轮:对齐参照工程的实际依赖(D20 之后补做)

D20 定下渲染策略后,把清单与**已在跑这套策略**的参照工程 `nuxt-modern-starter`
逐个比对,**又发现 3 处**:

| # | 我的清单 | 参照工程实际 | 判定 |
| --- | --- | --- | --- |
| 1 | 🔴 `@nuxtjs/i18n ^10.6.0` | **裸 `vue-i18n ^11.4.6` + 自写 `app/plugins/i18n.ts`** | **我错了**。参照工程 `modules` 里只有 `@pinia/nuxt` + `@ant-design-vue/nuxt` 两个。<br>⚠️ **§2.2 白纸黑字写的就是「vue-i18n 11.4.6」** —— 是我把它错映射成了 Nuxt 模块 |
| 2 | 🔴 `@nuxtjs/color-mode ^4.0.1` | **不用,自写 `app/composables/useTheme.ts`** | **我错了,而且自相矛盾** —— §2.3.3 的主题链里我已经画了 `useTheme.ts`,package.json 却又塞了 color-mode |
| 3 | 缺 `postcss-scss` | **有 `^4.0.9`** | **漏装**。stylelint 解析 SCSS 语法需要(与 `postcss-html` 解析 `.vue` 是两件事) |
| 4 | `eslint ^9.0.0` | **`^10.6.0`** | 改为 `^10.6.0` —— 对齐参照工程,**并顺带消掉 `@eslint/js@10` 的 peer 告警** |

> 🔴 **这轮的教训与前几轮不同**:前三轮错在「没查 registry / 没查 peer / 没实跑」,
> **这一轮错在「有现成的实跑参照,却没去比对」**。
> §2.2 已经列出了参照工程验证过的组合,而我在写 §2.8 时**按 Nuxt 生态的常规做法推测**,
> 结果多引入了 2 个模块。**有参照就先比参照。**

##### ✅ 第三层验证:`pnpm install` 实跑结果(修正后)

| 项 | 修正前 | ✅ 修正后 |
| --- | --- | --- |
| 直接依赖解析 | 63/63 | ✅ **D21 前 63/63 全部锁定**;🔴 **D21 后 manifest 为 62 个依赖,D22 后为 61 个依赖,D23 后为 60 个依赖,D24 后为 59 个依赖,D25 后为 50 个依赖**,P0 落盘时重跑严格 install 留证 |
| 完整依赖图 | 1,862 个包 | ✅ **D21 前 1,654 个包**(少 208,即两个 Nuxt 模块的传递依赖);D21–D25 后精确包数不在文档里硬报,以 P0 实跑为准 |
| **严格 peer 门禁** | ⚠️ 4 类未满足 | ✅ **`--strict-peer-dependencies` 退出码 0,零告警** |

> ✅ **结论:可以直接开 `strictPeerDependencies: true`**,不需要任何
> `peerDependencyRules` 豁免 —— 这比修正前"3 类上游问题需要豁免"干净得多。
> **少用两个 Nuxt 模块,同时解决了依赖体积与 peer 健康度两件事。**
> ✅ **一处配对已验证正确**:`pinia 3.0.4` + `@pinia/nuxt 0.11.3`
> (后者 peer 为 `pinia ^3.0.4`;⚠️ 注意 `@pinia/nuxt` **最新版要求 pinia ^4**,不要盲目升级)。

```jsonc
{
  "name": "deer-flow-web-vue",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@11.5.2",              // ✅ §2.2
  "engines": { "node": ">=22.22.3" },           // ✅ §2.2
  "scripts": {
    "dev": "nuxt dev",
    "build": "nuxt build",
    "preview": "nuxt preview",
    "typecheck": "nuxt typecheck",
    "lint": "eslint .",
    "stylelint": "stylelint \"app/**/*.{scss,vue}\"",
    "test": "vitest run tests/unit tests/guards tests/contract",
    "test:e2e": "playwright test",
    "verify": "pnpm lint && pnpm stylelint && pnpm typecheck && pnpm test",
    "verify:full": "pnpm verify && pnpm test:e2e"
  },
  "dependencies": {
    "nuxt": "4.4.8",                            // ✅ D1
    "vue": "^3.5.40",
    "ant-design-vue": "4.2.6",                  // ✅ D2
    "pinia": "3.0.4",                           // ✅ §3.3.1
    "vue-i18n": "^11.4.6",                   // ✅ §2.2 实跑;🔴 **不用 @nuxtjs/i18n** —— 参照工程用裸 vue-i18n + 自写 plugins/i18n.ts
    "lucide-vue-next": "^1.0.0",             // 🔴 i18n 词典依赖它(§3.1)。⚠️ 注意**不是**跟随 lucide-react 的 0.562
    "shiki": "3.23.0",
    "mermaid": "^11.12.2",                       // 由 @streamdown/mermaid 提升为直接依赖
    "katex": "^0.16.28",
    "remend": "^1.3.0",
    "remark-gfm": "^4.0.1",
    "remark-math": "^6.0.0",
    "rehype-katex": "^7.0.1",
    "rehype-raw": "^7.0.0",
    "rehype-slug": "^6.0.0",
    "unist-util-visit": "^5.0.0",
    "hast": "^1.0.0",
    "codemirror": "^6.0.2",
    "@codemirror/lang-css": "^6.3.1",
    "@codemirror/lang-html": "^6.4.11",
    "@codemirror/lang-javascript": "^6.2.4",
    "@codemirror/lang-json": "^6.0.2",
    "@codemirror/lang-markdown": "^6.5.0",
    "@codemirror/lang-python": "^6.2.1",
    "@codemirror/language-data": "^6.5.2",
    "date-fns": "^4.1.0",
    "zod": "^3.25.76",                       // D21 后不再受 ai peer 牵制;保留已验证版本
    "best-effort-json-parser": "^1.2.1",
    // ── 🔴 v4 新增 3 个(D24-a / D25-a),版本已 npm 实核 ─────────────
    "@tanstack/vue-query": "^5.101.4",       // 🔄 D24-a 推翻 D24。peer 仅 vue ^2.6.0||^3.3.0,零 React 依赖
    "@vueuse/core": "^14.4.0",               // 🔄 D25-a 修订 D25。2026-07-29 仍在发版;motion-v 不装后需显式声明
    "uuid": "^14.0.0"                        // 🔄 D25-a。🔴 不能用 crypto.randomUUID() —— secure-context-only(§2.4.6)
                                             //    自带 types,不需要 @types/uuid
  },
  "devDependencies": {
    "@ant-design-vue/nuxt": "1.4.6",            // ✅ §2.2,FOUC 解法依赖它
    "@pinia/nuxt": "0.11.3",                    // ✅ §2.2
    "sass": "^1.102.0",                          // 🔴 D15
    "stylelint": "^17.0.0",                     // 🔴 D15;必须 17 —— config-standard-scss@17 的 peer
    "stylelint-config-standard-scss": "^17.0.0",
    "postcss": "^8.3.3",                        // 🔴 上一行的 peer,不能漏
    "postcss-html": "^1.8.1",                   // stylelint 解析 .vue 内样式
    "postcss-scss": "^4.0.9",                   // 🔴 stylelint 解析 SCSS 语法,参照工程有,此前漏了
    "stylelint-config-recommended-vue": "^1.6.1",
    "vitest": "4.1.9",                          // ✅ §2.2
    "@nuxt/test-utils": "4.0.3",                // ✅ §2.2
    "happy-dom": "^20.11.1",                    // 🔴 必须 >=20.0.11 —— @nuxt/test-utils@4.0.3 的 peer
    "@vue/test-utils": "^2.4.11",
    "@playwright/test": "^1.49.0",              // 继承的 25 spec 用它
    "@nuxt/eslint": "^1.16.0",
    "eslint": "^10.6.0",                       // 对齐参照工程;同时消掉 @eslint/js@10 的 peer 告警
    "typescript-eslint": "^8.0.0",
    "typescript": "^5.7.0",
    "vue-tsc": "^3.3.8",
    "prettier": "^3.4.0",
    "@types/node": "^22.0.0",
    "@types/hast": "^3.0.4"
  }
}
```

> 🔴 **workspace 归属(D7)**:`frontend-vue/` **自成独立 pnpm 项目**(§3.2 目录树已标注)。
> 理由:D7 否决共享包,两端依赖树完全隔离,**避免 hoisting 把 React 依赖串进 Vue 侧**。
>
> ⚠️ **v4 实测更正:仓库根目录并没有 `pnpm-workspace.yaml`。**
> 全仓只有 **`frontend/pnpm-workspace.yaml`**,内容是 `packages: []` + 三个
> `ignoredBuiltDependencies`(`esbuild` / `sharp` / `unrs-resolver`)——
> 它根本不是一个 workspace 声明,只是 pnpm 的构建脚本白名单载体。
> → 本条约束**自动成立,不需要任何动作**;D7 与根 `AGENTS.md` 里"禁改根 `pnpm-workspace.yaml`"
> 指的是一个**不存在的文件**,属陈述漂移(不影响任何决定,顺手记录)。
> 🔴 `frontend-vue/` 若也要用 pnpm 构建脚本白名单,**自己建一份**,不要去动 `frontend/` 那份。

---

#### 2.8.7 🔴 D24-a:为什么把 `@tanstack/vue-query` 装回来(v4)

> **D24 的方向是对的(少装包),但它越过了收益拐点。**
> 这一节把判据摊开,方便你复核 —— 因为 D24 是你拍板的,D24-a 是推翻它。

#### 判据一 · Vue 对应物本身没有 React 耦合(D24 没核这一层)

D24 的论证是「React 版实测 `@tanstack/react-query` 是运行时依赖,不是纯类型」——
**这句是对的,但它论证的是"不能像 D21/D23 那样靠本地类型糊过去",不是"必须自研"。**
真正该核的是**Vue 对应物**:

| 实测项 | 结果 |
| --- | --- |
| 版本 | `@tanstack/vue-query@5.101.4` |
| `peerDependencies` | `vue: ^2.6.0 \|\| ^3.3.0` + `@vue/composition-api`(**仅 Vue 2 需要**) |
| `dependencies` | `@tanstack/query-core@5.101.4` / `@tanstack/match-sorter-utils` / `@vue/devtools-api` / `vue-demi` |
| **React 依赖** | 🔴 **零** |
| 维护状态 | 与 `query-core` **同版本号发布**,官方一等公民 |

对照 D21/D22/D23 的删包判据 —— 那三个删得对,因为它们**要么是纯类型(`ai`、`@langchain/core`)、
要么会把架构绑死在后端框架心智模型上(`langgraph-sdk`)**。
`@tanstack/vue-query` **两条都不占**:它有运行时价值,且与后端协议正交。

#### 判据二 · 自研面比 D24 描述的大

实测(限 16 个 import `@tanstack/react-query` 的文件内):

| 调用 | 次数 | | 选项 | 次数 |
| --- | --- | --- | --- | --- |
| `useQuery` | **38** | | `enabled` | **48** |
| `useMutation` | **40** | | `staleTime` | 9 |
| `useInfiniteQuery` | 3 | | `retry` | 9 |
| `invalidateQueries` | **57** | | `refetchOnWindowFocus` | 8 |
| `useQueryClient` | 41 | | `refetchOnMount` | 2 |
| `setQueryData` | 8 | | `refetchInterval` | 2 |
| | | | `select` | 2 |

复现:

```bash
grep -rln "@tanstack/react-query" frontend/src > /tmp/f.txt && xargs grep -hoE "\b(useQuery|useMutation|useInfiniteQuery|invalidateQueries|setQueryData|enabled|staleTime|retry|refetchOnWindowFocus|refetchInterval|select)\b" < /tmp/f.txt | sort | uniq -c | sort -rn
```

自研要覆盖:**并发去重、staleTime/gc、`enabled` 门控、retry、focus/mount/interval 三种重取、
`select` 变换、infinite 分页、prefix invalidate、乐观写、请求取消、响应式 key**。
这是 **2–4 周实现 + 长期维护**,且这类库的 bug 形态是**"偶发竞态 / 重复请求"** ——
最难测,也最难在 E2E 里定位。

#### 判据三 · 🔴 §4.4 是全案唯一一个连量级都没有的自研件

§4.4.4 原文:「具体周数等 P0 contract fixture 后再回填,避免现在拍脑袋加账」——
诚实,但意味着 **§7 的 27–48 周里没有它的位置**,而它压在 **P2 的关键路径**上。
其余三个自研件都有明确区间(§4.1 `4–6 周`、§4.2 `5–8 周`、§4.3 含在 P5)。

> **一个没有量级的自研件 + 一个已有的官方一等公民替代品 = 不该自研。**

#### 判据四 · 参照工程的证据被用反了

§2.2 原文用「`nuxt-modern-starter` 不用 TanStack Query」支持 D24。
但同一段自己也写了:「**DeerFlow 的使用面大于该参照工程,所以不能只靠 Pinia + 裸 api 函数临时拼**」。
→ 参照工程的结论是「**小项目不必引**」,不是「**大项目该自研**」。

#### D24-a 的影响面

| 项 | 变化 |
| --- | --- |
| 依赖数 | 50 → **51**(另 D25-a 再 +2 = **53**) |
| **P0** | ❌ **删掉「D24 server-state contract fixture」实验**(原 0.5–1 天)。改为 **`@tanstack/vue-query` 客户端插件 smoke(2 小时)** —— 验证 Nuxt 插件注册 + 一个 query 能跑通即可 |
| **§4.4** | 🔻 **降级为存档**(自研设计不执行)。⚠️ **但 §4.4.1 的"当前 React 使用面"表要留** —— 它是 P2 迁移 hooks 时的对照清单 |
| **P2** | ⬇️ 16 个薄 `hooks.ts` → composables 的工作变成**语义等价迁移**(`useQuery` → `useQuery`),不是"在自研层上重建" |
| **风险** | ➖ 消除一个"没有量级的自研件"落在关键路径上的风险 |
| **§7 工期** | ⬇️ 净减,但**不单独调区间** —— 原本就没给 §4.4 计过工时,减掉的是**未入账的风险**,不是已入账的周数 |

---

### 2.9 🔴 渲染策略:产品区全 CSR,营销区预留 SSR(D20)

> **用户 2026-07-31 决定**:「真实对话流程的界面不需要 SSR,全部 CSR;
> 以后新增落地页、价格页、关于我们、新闻页这种才需要 SSR。」

#### 2.9.1 为什么仍然用 Nuxt(而不是退化成 Vite + Vue Router)

这是本决策最容易被误读的一点。**「全 CSR」不等于「不需要 Nuxt」**:

| 能力 | 现在要不要 | 将来要不要 | 纯 Vite SPA 能做吗 |
| --- | --- | --- | --- |
| 产品区渲染 | CSR | CSR | ✅ 能 |
| **落地页 / 价格页 / 关于我们 / 新闻页** | ❌ 暂无(D6 已砍 landing) | 🔴 **要,且需 prerender/SSR 才有 SEO** | ❌ **不能** |
| **Nitro 代理层**(D10 去 nginx 后的三项责任) | 🔴 **要** | 要 | ❌ 不能(得另起服务) |
| 文件路由 / 模块生态 | 要 | 要 | ⚠️ 需自行拼装 |

> ✅ **结论:保留 Nuxt,只把产品区的 `ssr` 关掉。**
> `ssr: false` 关的是**服务端渲染**,不是**服务端** —— **Nitro 照常运行**,
> 所以 **D10 / D14 / 风险 R15 / R16 的代理层设计全部不受影响**。

#### 2.9.2 照搬参照工程的分级模型

`nuxt-modern-starter` 已经在跑这套(§2.7),**直接抄**:

```
config/routes.ts          ← 🔴 渲染策略的单一来源
   ├── prerenderRoutes    → routeRules { prerender: true }   构建期生成静态 HTML
   ├── swrRouteRules      → routeRules { swr: 3600 }         新闻类
   └── csrRouteRules      → routeRules { ssr: false }        🔴 产品区
                │
         nuxt.config.ts::routeRules 消费
```

**参照工程的产品区**:`productRoutePatterns = ['/workspace/**', '/docs/**', '/account']`
—— **与 DeerFlow 高度吻合**。

**DeerFlow 的路由分区**(实测 D6 裁剪后存活的 12 条路由):

| 分区 | 路由 | 策略 |
| --- | --- | --- |
| **产品区** | `/workspace`、`/workspace/agents`、`/workspace/agents/new`、`/workspace/agents/[agent_name]/chats/[thread_id]`、`/workspace/chats`、`/workspace/chats/[thread_id]`、`/workspace/scheduled-tasks` | 🔴 **`ssr: false`** |
| **认证区** | `/login`、`/setup`、`/auth/callback` | 🔴 **`ssr: false`** |
| ~~营销区~~ | ~~`/`(landing)、`/blog/**`、`/[lang]/docs/**`~~ | ❌ **D6 已砍** |
| **将来的营销区** | `/`、`/pricing`、`/about`、`/news/**` | 📐 **架构预留**:`prerender` / `swr` |

> ⚠️ **`/` 现在是空的** —— React 版的 `/` 是 landing 页(`app/page.tsx` 引 8 个 landing 组件),
> 已随 D6 砍掉。**Vue 版 v1 的 `/` 应重定向到 `/workspace`**;
> 将来做落地页时,把它从 `csrRouteRules` 移到 `prerenderRoutes` 即可 —— **这正是分级模型的价值**。

#### 2.9.3 🔴 鉴权:唯一需要重新设计的地方

这是 D20 **最实质的影响**。实测 React 版的做法:

```
app/workspace/layout.tsx   ← Server Component
app/(auth)/layout.tsx      ← Server Component
        └─▶ getServerSideUser()  (core/auth/server.ts, next/headers 的 cookies())
              └─▶ 五态判定 → 未登录直接**服务端重定向**,浏览器拿不到受保护内容
```

**CSR 下这条路没了。** 两个方案:

| 方案 | 做法 | 代价 |
| --- | --- | --- |
| A · 纯客户端中间件 | `app/middleware/auth.global.ts` 判定后 `navigateTo('/login')` | 🔴 **未登录用户会先看到 app shell 再跳转**,且受保护路由的 JS 已下发 |
| ✅ **B · Nitro server middleware**(**推荐**) | `server/middleware/auth.ts` 在返回 HTML 前读 cookie → 302。**Nitro 本来就在**(代理层),零额外基础设施 | 需把五态判定从 `core/auth/server.ts` 迁到 Nitro 侧 |

> ✅ **选 B**。参照工程就有 `server/middleware/product-canonical.ts` 这个先例,
> 证明 Nitro middleware 是它的既定做法。
> **五态 tagged union 与 `userSchema` 的逻辑原样搬**,只换 cookie 读取方式
> (`next/headers` 的 `cookies()` → `getCookie(event, ...)`)。

#### 2.9.4 D20 的影响面(逐条)

**✅ 消失的风险与工作(净收益)**

| 项 | 原状 | D20 后 |
| --- | --- | --- |
| **风险 R5b** antdv SSR 下 FOUC | 已由 §2.7 缓解 | ✅ **彻底消失** —— 没有 SSR 就没有这个成因 |
| **§3.3.1 约定 4** Pinia SSR 跨请求污染 | 需严格约束 `useXxxStore()` 调用位置 | ✅ **不再适用** —— CSR 下每个浏览器会话一个 Pinia 实例 |
| **SSR 兼容性排查** | 需逐个确认包在无 DOM 下能否 import | ✅ **整类问题消失** —— 产品区全 CSR;且 D25 已删除 `canvas-confetti` / `@vue-flow/core` 这类 DOM 装饰/画布依赖 |
| `core/i18n/server.ts` | 3 处适配之一 | ⬇️ **调用者 5 个里 4 个在 D6 已砍的 blog/landing**,仅剩 `app/layout.tsx` 一处 → CSR 下改客户端读 cookie |

**⚠️ 变化或新增的**

| 项 | 说明 |
| --- | --- |
| 🔴 **鉴权五态** | 从 Server Component 迁到 **Nitro server middleware**(§2.9.3) |
| 🔴 **首屏体验** | CSR 有白屏窗口。**建议给 app shell 做 `prerender`**,并保留 §2.3.3 那段 hydration 前设 `data-theme` 的内联脚本(**防主题闪烁的需求依然存在**) |
| `locale` / `sidebar_state` cookie | 从服务端读改为客户端读(§1.3 第 5 条约束不变,cookie 名与语义仍须一致) |

**✅ 完全不受影响的(容易误判,特别标注)**

**Nitro 代理层的一切** —— **D10**(`docker-vue/` 单服务)、**D14**(代理层验收)、
**风险 R15**(SSE 不缓冲 / 长超时 / `X-Forwarded-Proto` 三项责任)、
**风险 R16**(Nitro 能否无缓冲透传 SSE)。
> 🔴 **R16 仍是 P0 第一周必须证伪的项** —— 它测的是 **Nitro 作为代理**转发 SSE 的能力,
> 与页面是否 SSR **完全无关**。不要因为「改成 CSR 了」就跳过这个实验。

#### 2.9.5 工期影响

**小幅净减**,但**不足以调整 §7 的区间**:

| | 变化 |
| --- | --- |
| ➖ 省 | SSR 相关的调试与兼容性排查(FOUC、hydration mismatch、包的 SSR 安全性) |
| ➕ 增 | 鉴权迁到 Nitro middleware(约 2–3 天);app shell 的 prerender 与首屏优化 |
| **净** | **≈ 持平**,落在 27–48 周的估算噪声内 → **§7 不改** |

---

### 2.10 🔴 上游冻结政策(D26,v4 新增)

> **这是 v4 补上的、全案最大的未定价风险。**
> D4 冻结的是「**对标基线**」(拿哪个 commit 当规格),
> **但从来没有冻结「上游会不会继续动」** —— 而这两件事的成本差一个数量级。

#### 2.10.1 实测:上游演进速度

`frontend/src`,截至 2026-07-31:

| 月份 | 新增行 | 删除行 | 提交数 |
| --- | --- | --- | --- |
| 2026-02 | +4,935 | −3,298 | 94 |
| 2026-03 | +6,326 | −2,048 | 47 |
| 2026-04 | +14,653 | −2,787 | 57 |
| 2026-05 | +4,023 | −803 | 36 |
| 2026-06 | +6,657 | −846 | 55 |
| **2026-07** | **+22,815** | −2,949 | **114** |

- 月新增行**中位数 ≈6,500**、**均值 ≈9,900**;而 `frontend/src` **当前总共只有 56,484 行**
- 🔴 **近 6 个月被改动过的唯一文件 453 个,当前总文件 389 个 → 文件级 100% 翻动**
- 按工期 **5–7.5 个月**推算,上线时 React 版将多出 **33,000–74,000 行**改动 ——
  **量级与整个代码库相当**

复现命令:

```bash
git log --since="2026-02-01" --numstat --pretty=format:"" --no-renames -- frontend/src | awk '{a+=$1;d+=$2} END {print "+"a" -"d}'
```

```bash
git log --since="6 months ago" --name-only --pretty=format:"" -- frontend/src | sort -u | grep -c "^frontend/src"
```

#### 2.10.2 🔴 为什么这条比工期数字更要紧

**漂移不是均匀摊在全库的,它精确地压在关键路径上。** 2026-07 改动最大的文件:

| 文件 | 当月变更行 | 落在哪一期 |
| --- | --- | --- |
| 🔴 `core/threads/hooks.ts` | **+2,181** | **P1(D13 拆分规格)+ P3 + P5** |
| `components/workspace/input-box.tsx` | +1,905 | **P5**(§10.2② 点名的最大件) |
| `components/workspace/messages/message-list.tsx` | +1,485 | **P5** |
| `components/workspace/sidecar/sidecar-panel.tsx` | +1,049 | **P5**(红线 P2–P5) |
| `components/workspace/settings/integrations-settings-page.tsx` | +894 | P2 |

两个连带后果:

1. 🔴 **D13 的拆分规格(§3.1.3)是按 3,072 行 / 53 导出这个快照写的** ——
   `threads/hooks.ts` 一个月动 2,181 行,规格会被持续冲刷
2. 🔴 **Tier 2 导出级溯源比对(§3.1.2)会持续报红** ——
   而它的设计前提是"报红 = 有人偷偷改了拷贝",不是"上游又动了"。
   **两种红色混在一起,这道门禁就废了**(会被随手加进豁免,和 §3.1.2 自己警告的失效路径一模一样)

#### 2.10.3 🔴 这是唯一一个 P0 测不出来的风险

§6 P0 的五个实验(stream fixture / resizable / Nitro SSE / Nitro 鉴权 / server-state)
都是**技术二元判定**,一两天内出结论。**上游漂移不是技术问题,是流程问题,做多少实验都测不出来**,
而它的代价在项目末期才显形 —— **那正是返工最贵的时点**。

原风险登记册把 **R6 评为「概率中 / 影响低」**。与实测不符,
**v4 已上调为「概率必然 / 影响高」**(§8)。

#### 2.10.4 三个候选与取舍

| 方案 | 漂移 | 代价 | 适用场景 |
| --- | --- | --- | --- |
| **(a) 项目期间彻底停止 merge upstream** | **0** | 6 个月不拿上游的任何修复与**安全补丁**(含 backend) | 内网隔离、不担心 CVE |
| ✅ **(b) 只 merge `backend/` + 安全补丁,`frontend/` 完全冻结**(**推荐,已选**) | **0** | 后端能力照常演进,**前端功能差集明确且可枚举**(= 冻结期内所有 `frontend/` 提交) | **本案** —— 前后端在同一仓库但耦合面只有 HTTP 契约 |
| **(c) 继续全量 merge** | 大 | §7 必须显式加一笔**追平预算**;D13 的 Tier 2 比对需要区分"拷贝发散"与"上游演进"两种红 | 上游前端有必须跟进的功能 |

#### 2.10.5 ✅ 选定 (b) 的执行细则

1. **冻结点** = D4-a 的 `b71a892b`,与对标基线**同一个 commit**(这是 (b) 相对 (c) 的最大好处:
   规格与代码永远一致,§3.1.2 的报红重新变回单一含义)
2. **仍然 merge 的**:`backend/**`、`docker/**`、`scripts/**`、根配置,以及
   **任何被判定为安全修复的 `frontend/` 提交**(逐个批准,记进 `PROVENANCE.md` 的偏离登记)
3. **每次 merge 后跑一次**:

   ```bash
   git diff b71a892b..HEAD --stat -- frontend/src frontend/tests
   ```

   **输出非空即需人工判断**是否属于第 2 条的安全例外;不属于则**必须回退该路径**
4. **冻结期结束(v1 上线)时**,把冻结期内的全部 `frontend/` 提交整理成 v2 待办清单 ——
   这就是 D4 原本承诺的东西,只是现在它有了**明确的边界和可枚举的内容**
5. ⚠️ **这条要在开 P0 之前定,不能边做边定** —— 一旦 P1 复制完 `core/`,
   再改冻结政策就要重做溯源基线

> 🔴 **不定这一条就开 P0,等于把一个「已知会发生、量级 ≈ 代码库本身」的成本推给未来的自己。**
> D4-a 那次漂移(18 文件 / +768 −99)不是偶发 —— **它是近 6 个月里最小的一次。**

---

## 3. 目标架构

### 3.1 核心逻辑层设计(D7 后:自包含复制)

> **D7 已否决共享包方案。** 全部代码必须在 `frontend-vue/` 内自包含。
> 本节是按 D7 重写后的设计;原共享包设计见 §3.1.1 存档(仅供 v2 参考)。

我实测了 `core/` 纯 TS 部分对 Next 专有 API 的依赖,结果**出人意料地干净**:

```
13,668 行纯 TS 中,仅 4 个文件触及 Next 专有物:
  core/static-mode.ts    → @/env          (1 个函数)   ← D6 已砍,无需迁移
  core/config/index.ts   → @/env          (40 行)
  core/auth/server.ts    → next/headers   (Nitro 鉴权中间件专用,101 行)
  core/i18n/server.ts    → next/headers   (Nitro/客户端边界适配)
```

**D6 已砍掉 `static-mode.ts`,实际只剩 3 个耦合点**,且全部落在**配置与 Nitro/客户端边界**上 ——
正是应该做框架适配的位置。

#### 迁移方式:复制 + 3 处适配

```
frontend-vue/
└── app/core/                   ← 从 frontend/src/core 复制(不是引用)
    ├── api/          ← fetcher(CSRF + credentials + 401)、errors、
    │                    stream-mode 白名单、SDK 包装 + gap 恢复
    │                    + ThreadStreamEngine(§4.1)
    ├── messages/     ← utils(分组)、human-input(校验)、usage、
    │                    run-duration、workspace-change-anchor
    ├── threads/      ← 历史合并 15 个纯函数、分页协议、utils
    ├── tasks/        ← steps、lifecycle、subtask-result
    ├── artifacts/    ← preview(HTML 完整性检查)、utils
    ├── i18n/         ← 词典 3,086 行(纯数据)+ locale 解析
    ├── settings/     ← local.ts(含 safeLocalStorage 门面)
    └── {models,skills,mcp,memory,agents,channels,scheduled-tasks,
          uploads,sidecar,workspace-changes,citations,todos,tools,
          suggestions,notification,voice-input,input-polish,features}/
                     ← 各自的 api.ts + types.ts(hooks.ts 重写为 composables)
```

**3 处适配**(全部在 `frontend-vue/` 内完成):

| 原文件 | Next 依赖 | Nuxt 侧替换 |
| --- | --- | --- |
| `core/config/index.ts` | `@/env`(`@t3-oss/env-nextjs`) | `useRuntimeConfig()`;`NEXT_PUBLIC_*` → `NUXT_PUBLIC_*`。D6 砍掉 `isMock` 分支后此文件更简单(§2.5.2) |
| `core/auth/server.ts` | `next/headers` 的 `cookies()` | Nitro:`useRequestHeaders(['cookie'])` / `getCookie(event, ...)`。**五态 tagged union 与 `userSchema` 逻辑原样保留** |
| `core/i18n/server.ts` | `next/headers` 的 `cookies()` | 同上,读 `locale` cookie |

其余 **13,486 行**复制过去(13,668 纯 TS − **182 行**的 3 处适配),其中
🔴 **7,215 行逐字节零改动**(v4 更正,旧写 10,400)、**3,086 行** i18n 词典需改 icon import(见下)、
🔴 **3,185 行**属 **DETYPED**(12 个文件只改类型 import,**§3.1.4**,v4 新增)。

##### ⚠️ 「不复制」那部分的旧标注有误,已按实测更正

旧文写「`core/*/hooks.ts`(**24 个薄文件、2,251 行**)不复制」。
**这一行把两个不同的集合混在了一起**:

| 旧说法 | 实测 | 「24 / 2,251」实际是什么 |
| --- | --- | --- |
| 「24 个」 | `find src/core -name hooks.ts` = **17 个** | 24 是 core 里 **React 耦合文件总数**(含 `threads/hooks.ts`) |
| 「2,251 行」 | 17 个 hooks.ts 合计 **4,162 行** | 2,251 是 **React 耦合行数 −`threads/hooks.ts`**(5,333 − 3,072) |
| 「薄文件」 | 16 个确实薄(合计 **1,090 行**) | 但 **`threads/hooks.ts` 独占 3,072 行**,而且装着 **40 个纯函数导出**(§3.1.3) |

**总账本身是闭合的,错的只是这一行的标签** —— 已实测复核:

```
core 非测试文件  143 个 / 19,001 行
      = 13,668(纯 TS,无 React 依赖) + 5,333(React 耦合)     ✅ 分毫不差
13,668 = 7,215(逐字节) + 3,086(i18n 改 icon) + 3,185(DETYPED) + 182(3 处适配)
         🔴 v3 两次更正 + v4 第三次更正(DETYPED,§3.1.4);旧式「= 10,400 + 3,086 + 182」已作废
5,333  = 3,072(threads/hooks.ts) + 1,090(16 个薄 hooks)
         + 1,171(其余 7 个 React 耦合文件)                     ✅
17 个 hooks.ts 合计 4,162;4,162 − 3,072 = 1,090             ✅
```

> 🔄 **2026-07-31 基线刷新(合入 main `b71a892b`)**:上表由上一版基线 `4c79e625` 的
> `142 个 / 18,942 行`(= 13,619 + 5,323)刷新而来,**净 +1 文件 / +59 行**,逐文件归口如下:
>
> | 文件 | 增量 | 归口 |
> | --- | --- | --- |
> | `core/auth/next-path.ts` **(新增)** | +26 | 纯 TS → **Tier 1 逐字节** |
> | `core/mcp/api.ts` | +23 | 纯 TS → **Tier 1 逐字节** |
> | `core/artifacts/loader.ts` | +1 / −1 = 0 | 纯 TS(仍属 DEMOCKED 4 件) |
> | `core/artifacts/hooks.ts` | +12 | React 耦合 → 16 个薄 hooks |
> | `core/mcp/hooks.ts` | +29 / −31 = −2 | React 耦合 → 16 个薄 hooks |
>
> 纯 TS 侧 **+49**、React 耦合侧 **+10**,合计 +59,**三条恒等式仍分毫不差**。
> `17 个 hooks.ts 合计 4,162 行` 为直接实测值,与推算的 `4,152 + 10` 吻合。

> 🔴 **v3 追加发现:i18n 词典 3,086 行不是「纯数据」,必须从 Tier 1 移到 Tier 2。**
>
> 实测 `i18n/locales/{zh-CN,en-US,types}.ts` = **1,073 + 1,124 + 889 = 3,086 行**
> —— **精确等于**方案一直说的「i18n 词典 3,086 行纯数据」。但这三个文件
> **`import { CompassIcon, GraduationCapIcon, … } from "lucide-react"`(value import,非 type)**,
> 并把图标**作为 `icon:` 字段的值**使用(实测 8 处)。
>
> 🔴 **后果是会卡住的**:Vue 侧必须把 import 换成 `lucide-vue-next`
> → **文件哈希必然不等** → 若按旧分类放进 Tier 1,**D13 的 `core-provenance.test.ts` 第一天就报红**。
> 改判:**进 ADAPTED 类,走 Tier 2 导出级比对**(实际改动量很小 —— 每个文件一行 import,
> ⚠️ **但 P1 必须逐个核实这 8 个图标名在 `lucide-vue-next` 里同名存在**)。
>
> 原始的「13,619 行无 React 依赖」测量应是用 `from "react"` 匹配的,
> **匹配不到 `from "lucide-react"`** —— 口径漏洞,不是笔误。

> 🔴 **v3 系统性核对发现:这一行此前是错的,而且当时还标着「✅」。**
>
> 旧文写 `13,619 − 141(3 处适配) ≈ 13,480`。实测三个适配文件:
> `config/index.ts` **40** + `auth/server.ts` **101** + `i18n/server.ts` **41** = **182 行**。
> **`141` 正好等于 `101 + 40` —— 漏掉了 `i18n/server.ts` 的 41 行。**
>
> 更正:**适配 182 行,复制总量 13,486 行**(`13,480` 曾在全文出现 **9 处**,已全部同步)。
> 影响很小(占 13,619 的 0.3%),**但它是全文唯一一处「标了 ✅ 却算错」的账** ——
> 记在这里是因为:**核对时最该怀疑的,恰恰是已经打了勾的那几行。**

**更正后的处置口径(后续阶段排期以本表为准)**:

| 集合 | 实测 | 去向 | 溯源校验 |
| --- | --- | --- | --- |
| 纯 TS 零改动 | 🔴 ≈ **7,215 行**(= 13,486 − 3,086 − **3,185**)<br>⚠️ **v4 更正,旧值 10,400 已作废** | 📋 逐字节复制 | **Tier 1** 文件哈希 |
| 3 处 Next→Nuxt 适配 | **182 行** | ✍️ 适配 | **Tier 2** 导出级 |
| 🔴 **i18n 词典 3 件** | **3,086 行** | ✍️ **改 icon import** | **Tier 2** 导出级 |
| 🔴 **DETYPED:12 个类型改 import 的文件**(**v4 新增**) | **3,185 行** | ✍️ **改类型 import**(D21/D22) | **Tier 2** 导出级 |
| 4 个 D6 清 `isMock` 的文件 | 见 §3.1.2 | ✍️ 删演示分支 | **Tier 2** 导出级 |
| 16 个薄 `hooks.ts` | **1,090 行** | ✍️ 重写为 composables(**P2**) | 不校验(重写件) |
| 🔴 `threads/hooks.ts` | **3,072 行 / 53 导出** | **必须拆**,见 **§3.1.3** | **Tier 2** 导出级 |
| 其余 7 个 React 耦合件 | ≈ **1,171 行** | ✍️ 随所属阶段重写 | 不校验(重写件) |

> 🔴 **DETYPED 是 v4 新增的第六类偏离(D13-a),清单与算术见 §3.1.4。**
> 它不改变**总量**(13,486 行照搬),只改变**校验层级** ——
> 但如果不改,`core-provenance.test.ts` 的 Tier 1 哈希**会在第一天对这 13 个文件报红**。

#### D7 的代价(必须记录)

| 项 | 后果 |
| --- | --- |
| **两份 13,486 行拷贝** | `frontend/src/core` 与 `frontend-vue/app/core` 长期并存且发散 |
| **29 条红线不变量分两处维护** | §5 C 类的 29 条(历史合并、协议校验、传输层)在两边各有一份,必然失同步 |
| 修 bug | 同一缺陷修两次;或只修 Vue 侧,React 侧保留旧行为 |
| `threads/hooks.ts` 技术债 | §10.2① 的 3,072 行拆分**不再顺带完成**(不能改 `frontend/`);Vue 侧需自行拆,React 侧原样留着 |
| 上游同步 | 无法把纯 TS 层 PR 回上游(O4 作废) |

**缓解(两层)**:

1. **档案层** —— 在 `frontend-vue/app/core/` 根目录放 `PROVENANCE.md`,记录
   ① 复制自 `frontend/src/core` 的哪个 commit(D4-a 基线 `b71a892b`)、
   ② 3 处适配的清单、③ 后续任何偏离原实现的改动及原因。
2. 🔴 **机械层(D12 新增)** —— `core-provenance.test.ts` **自动拦截发散**,见 §3.1.2。
   这是把「必然发散」变成「一发散就红」的关键,**不要只做第 1 层** ——
   人工比对等于不会发生。

#### 3.1.2 🔴 `core-provenance.test.ts` —— 把「必然发散」变成「立刻报红」(D12)

> **灵感来源**:§2.7 参照工程的 `revalidate-nitro-contract.test.ts`。
> 它解决的是同一个问题 —— **我们抄了别人的实现,别人改了怎么办**。
> 那边的做法是「从被拷贝方源码提取真实算法与常量,执行比对」,
> 提取不到 → 抛错,提取到但值不同 → 断言失败,**两种都红**。

> 🔴 **本节已按 D13 重写。** 草案原写「deer-flow 的处境更简单:拷贝是逐字节的,
> 直接比哈希即可」—— **这个前提对最重要的那个文件不成立**,见下。

##### 为什么纯哈希不够:它恰好在红线最密集处失效

实测 `frontend/src/core/threads/hooks.ts`:**3,072 行、53 个导出,其中只有 13 个是
`use*` hook,另 40 个是非 hook 导出**(36 个纯函数与常量 + 4 个类型),且两者**交错分布**:

```
 448  mergeMessages                     ← C 类红线 S7–S10 历史合并语义
 998  STREAM_RENDER_COALESCE_MS = 80    ← B 类红线 S1
1012  decideCoalesce                    ← §4.1 要「原样搬」到 core/api/stream/
1128  upsertThreadInSearchCache         ← 纯函数,夹在 hook 之间
1341  useThreadStream                   ← hook,→ ThreadStreamEngine
2402+ useThreadHistory / useThreads …   ← 11 个 query hook
```

该文件**必然要拆**(§3.1.3)→ 哈希必然不等 → 若只有 Tier 1,
它只能被塞进豁免清单 → **承载 C 类红线最多的文件恰好不受任何机械保护**。
这正是 D12 想解决的问题本身。

##### D13 的解法:两层校验

```ts
// frontend-vue/tests/guards/core-provenance.test.ts
// D12:只读 frontend/,不改。D7 禁的是「改动」,读取不冲突。
const REACT_CORE = resolve(projectRoot, '../frontend/src/core')
const VUE_CORE   = resolve(projectRoot, 'app/core')

// ── 偏离登记:每一类都必须在 PROVENANCE.md 里有条目 ──────────────
const ADAPTED  = new Set([            // 3 处 Next→Nuxt 适配(§3.1)
  'config/index.ts', 'auth/server.ts', 'i18n/server.ts',
])
const DEMOCKED = new Set([            // D6 清 isMock —— 实测这 4 个,旧草案漏了
  'api/api-client.ts', 'sidecar/api.ts',
  'artifacts/utils.ts', 'artifacts/loader.ts',
])
// 🔴 v4 新增第六类(D13-a):只改类型 import 的文件。清单与算术见 §3.1.4
const DETYPED  = new Set([            // D22:@langchain/langgraph-sdk → app/core/agent-types.ts
  'messages/utils.ts', 'messages/human-input.ts', 'messages/usage-model.ts',
  'messages/usage.ts', 'messages/run-duration.ts',
  'tasks/subtask-result.ts', 'tasks/types.ts',
  'threads/export.ts', 'threads/types.ts', 'threads/utils.ts',
  'sidecar/context.ts',
  'uploads/prompt-input-files.ts',   // D21:from "ai" → app/core/ai-types.ts
  'tools/utils.ts',                  // 🔴 D22 + D23 两条 import 都要改,别漏(§3.1.4)
])                                   // 共 13 个 / 3,185 行。⚠️ threads/static-demo.ts 归 REMOVED(D6),不在此
const SPLIT    = new Map([            // D13:拆分件 → 其纯函数导出的新落点
  ['threads/hooks.ts', ['threads/history.ts', 'threads/coalesce.ts', 'threads/cache.ts']],
])
const ADDED    = new Set([            // Vue 侧新写,React 侧不存在 → 不比对
  'api/stream/',                      // §4.1 ThreadStreamEngine
])
const REMOVED  = new Set([            // D6/D9 砍掉 + 17 个 hooks.ts(重写为 composables)
  'static-mode.ts', /* …D6/D9 完整清单 */
])

// ── Tier 1:逐字节复制的文件,比文件哈希 ────────────────────────
it('tier-1: byte-identical files stay byte-identical', () => {
  const drifted = listFiles(VUE_CORE)
    .filter((f) => !isExempt(f))            // 排除以上五类
    .filter((f) => sha256(read(REACT_CORE, f)) !== sha256(read(VUE_CORE, f)))

  expect(drifted, '与 React 版 core 发散:同步它,或记进 PROVENANCE.md 并登记豁免').toEqual([])
})

// ── Tier 2:必然偏离的文件,比「导出的实现体」而非整文件 ──────────
// 对每个导出,从两侧源码提取函数体/常量值做规范化比对(去注释、去空白)。
// 提取不到 → 抛错(说明导出被改名或删了);提取到但不等 → 断言失败。两种都红。
it.each([...ADAPTED, ...DEMOCKED, ...DETYPED, ...SPLIT.keys()])('tier-2: %s 的纯导出未发生语义漂移', (file) => {
  const reactExports = extractExports(read(REACT_CORE, file))
  const vueExports   = collectExports(vueTargetsOf(file))   // SPLIT 时跨多个新文件收集

  for (const [name, body] of reactExports) {
    if (isHook(name)) continue                    // use* 是重写件,不比对
    if (isKnownDeviation(file, name)) continue    // 逐项登记在 PROVENANCE.md
    expect(vueExports.get(name), `${file}::${name} 在 Vue 侧找不到`).toBeDefined()
    expect(normalize(vueExports.get(name))).toBe(normalize(body))
  }
})

// ── 完备性:不允许有"没被分类"的文件悄悄出现 ────────────────────
it('every core file is classified, and every exemption is justified', () => {
  const unclassified = listFiles(VUE_CORE).filter((f) => !isExempt(f) && !existsIn(REACT_CORE, f))
  expect(unclassified, '新增文件必须登记进 ADDED 并写明理由').toEqual([])

  for (const f of [...ADAPTED, ...DEMOCKED, ...DETYPED, ...SPLIT.keys(), ...ADDED, ...REMOVED]) {
    expect(readProvenance(), `豁免 ${f} 未在 PROVENANCE.md 登记`).toContain(f)
  }
})
```

**旧草案漏掉的四件事(都会让它一跑就崩或悄悄失效)**:

| # | 漏了什么 | 后果 |
| --- | --- | --- |
| 1 | **D6 清 `isMock` 会改到豁免名单外的 4 个文件** —— 实测 core 含 `isMock` 共 7 个文件:`config/index.ts`(2,已豁免)、`threads/hooks.ts`(23,要拆)、`artifacts/hooks.ts`(3,不复制),**剩 `api/api-client.ts`(6)、`sidecar/api.ts`(3)、`artifacts/utils.ts`(3)、`artifacts/loader.ts`(3) 无处安放** | Tier 1 直接报 4 个假发散,第一次跑就红,然后被随手加进豁免 → 保护消失 |
| 2 | **没有 ADDED 分支** —— §4.1 要新建 `app/core/api/stream/`,而实测 `frontend/src/core/api/` 下**没有 `stream/` 目录**(只有 api-client / errors / feedback / fetcher / index / stream-mode) | `read(REACT_CORE, f)` 直接抛异常,测试崩溃 |
| 3 | **`recoverStreamReplayGaps` 的位置写错了** —— §4.1 把它列为独立文件,实测它在 **`api/api-client.ts:236`,而且没有 `export`** | 「原样搬」时会发现搬不动,须连带重构 `api-client.ts`(该文件已因 `isMock` 进 DEMOCKED) |
| 🔴 **4**<br>(**v4 / D13-a**) | **D21/D22 删包后,12 个文件的类型 import 必须改,但它们不在任何豁免类里** —— 实测 `core/` 里有 **13 个文件 / 3,185 行**既不 import react、又 import 了 `@langchain/langgraph-sdk`(11 个)或 `ai`(1 个) | **与第 1 条完全同型**:Tier 1 直接报 **12 个**假发散,第一次跑就红,然后被随手加进豁免 → **保护消失**。清单见 **§3.1.4** |

> 🔴 **Tier 2 必须能反向验证**:改掉 React 侧 `decideCoalesce` 里的 `80`,
> 或删掉一个纯函数导出,**测试必须红**。参照 §10 的纪律 ——
> **先确认破坏真的生效,再判定测试有效性。**

**效果**:§5 C 类那 29 条红线不再「分两处维护、必然失同步」——
React 侧一改(比如上游回填),`make verify` 立刻红,强制做出决定:同步、或记录豁免。

| 项 | 只做 `PROVENANCE.md` | 纯 Tier 1(旧草案) | **Tier 1 + Tier 2(D13)** |
| --- | --- | --- | --- |
| 发散何时被发现 | v2 回填时人工比对(**实际=不会发生**) | 下一次 `make verify` | **下一次 `make verify`** |
| 逐字节复制的 **≈7,215 行**(🔴 v4 修正,旧写 10,400) | 靠自觉 | ✅ 覆盖 | ✅ 覆盖 |
| 🔴 **13 个 DETYPED 件 / 3,185 行**(v4 新增) | 靠自觉 | ❌ **报 13 个假发散,随后被豁免掉** | ✅ **导出级覆盖** |
| 🔴 `threads/hooks.ts` 的 40 个纯函数导出<br>(**C 类红线最密集处**) | 靠自觉 | ❌ **只能进豁免 = 零保护** | ✅ **导出级覆盖** |
| 4 个 `isMock` 清理件 | 靠自觉 | ❌ 报假发散,随后被豁免掉 | ✅ 导出级覆盖 |
| 新增文件(`api/stream/`) | — | 💥 **读不到 React 侧文件,测试崩溃** | ✅ 登记为 ADDED |
| 豁免清单 | 可能悄悄膨胀 | 必须在 PROVENANCE 有据 | 必须在 PROVENANCE 有据 + **完备性检查** |
| 成本 | — | 约 60 行 | **约 180 行**(+2 天,已计入 P1) |

⚠️ **接受这个取舍**:它把 `frontend/` 变成 Vue 版测试的**依赖**。
上游回填 React 版时 Vue 侧会红 —— **这是特性不是 bug**(正是要它提醒),
但要接受「React 版改动会让 Vue 版 `make verify` 红」这件事。

> 📌 **这条同时下调了 O15(v2 是否重评共享包)的紧迫度**:
> 共享包的核心价值是「避免两份拷贝发散」,而机械拦截已经拿到了这个价值的大部分。
> 剩下的差异只是「改一处 vs 改两处」的人力,不再是「悄悄失同步」的正确性风险。

#### 🔴 3.1.3 `threads/hooks.ts` 拆分规格(D13)—— 必须按导出名拆,不能按行区间

**实测构成**(`frontend/src/core/threads/hooks.ts`,3,072 行):

| | 数量 | 说明 |
| --- | --- | --- |
| `export` 声明总数 | **53** | |
| ├ 函数 / 常量 | 49 | 其中 **13 个是 `use*` hook** → 重写;**36 个是纯函数与常量** → 保留语义 |
| └ 类型 | 4 | `ThreadStreamOptions` / `PendingPreparedReplayMask` / `ThreadMessagesPageResponse` / `CoalesceDecision` |
| **非 hook 导出合计** | **40** | = 36 纯函数常量 + 4 类型 → **Tier 2 逐导出比对** |

> ⚠️ **纯函数与 hook 是交错的,不存在一刀切的分界线**:
> `decideCoalesce`@1012 → `useCoalescedStreamMessages`@1041 → `upsertThreadInSearchCache`@1128
> → `useThreadStream`@1341。**按行区间切会切碎语义,必须按导出名搬。**

#### 拆分落点

```
frontend/src/core/threads/hooks.ts  (3,072 行 / 53 导出)
│
├─▶ app/core/threads/history.ts     ← 22 个导出,约 1,000 行   【P1】
│     hasToolResult · buildThreadSubmitMessages · removeSetItems
│     buildVisibleHistoryMessages · parseThreadMessagesPageResponse
│     getThreadHistoryNextPageParam · threadHistoryQueryKey
│     buildThreadMessagesPageUrl · flattenThreadHistoryPages
│     reconcileThreadHistoryRows · mergeMessages · mergeRenderedMessageLedger
│     computeSummarizationTransientMessages · resolveTransientHistoryBridge
│     mergeTransientHistoryBridge · mergeTransientHistoryBridgeOrder
│     resolveThreadTransientHistoryBridge · pruneConfirmedTransientMessages
│     countHumanMessagesExcludingSuperseded · getVisibleOptimisticMessages
│     areOptimisticMessagesConfirmed · getSummarizationMiddlewareMessages
│     🔴 承载 C 类红线 S7–S10(历史合并语义)
│
├─▶ app/core/threads/coalesce.ts    ← 3 个导出,约 60 行       【P1】
│     STREAM_RENDER_COALESCE_MS(= 80) · decideCoalesce · type CoalesceDecision
│     🔴 承载 B 类红线 S1;§4.1 的引擎直接 import 它
│
├─▶ app/core/threads/cache.ts       ← 12 个导出,约 200 行     【P1】
│     upsertThreadInSearchCache · upsertThreadInInfiniteCache
│     invalidateStoppedThreadCaches · STOP_THREAD_FINALIZATION_REFETCH_DELAY_MS
│     stopThreadAndInvalidateCaches · INFINITE_THREADS_PAGE_SIZE
│     INFINITE_THREADS_QUERY_KEY_PREFIX · fetchInfiniteThreadsPage
│     getInfiniteThreadsNextPageParam · mapInfiniteThreadsCache
│     filterInfiniteThreadsCache · findSidecarThreadIdsForParent
│     ⚠️ 签名里带 queryClient,**不是纯函数但框架无关**
│        🔴 v4(D24-a):直接接 @tanstack/vue-query 的 QueryClient ——
│        ~~原 D24 的 app/core/server-state/ 等价最小接口~~ 已作废。
│        ✅ **这反而更好搬**:两侧 QueryClient 是同一套 API,签名逐字一致;Tier 2 照常比对
│
├─▶ app/core/threads/types.ts       ← 3 个类型                 【P1】
│     ThreadStreamOptions(🔴 去掉 isMock,D6)· PendingPreparedReplayMask
│     ThreadMessagesPageResponse
│
├─▶ app/core/api/stream/engine.ts   ← useThreadStream 的语义    【P3】
│     原 1341–2401,约 1,061 行 → 重实现为发布订阅状态机(§4.1)
│     登记为 ADDED(React 侧无对应文件),不做 Tier 2 比对
│
└─▶ app/composables/                ← 12 个 hook,约 758 行
      【P2】useThreads · useInfiniteThreads · usePinThread · useDeleteThread
            useRenameThread · useBranchThread        ← 侧栏与 thread 列表
      【P3/P5】useThreadHistory · useThreadRuns · useThreadMetadata
            useThreadTokenUsage · useRunDetail · useCoalescedStreamMessages
```

#### 🔴 这条同时补上了一个此前无归属的工作量

旧文把「不复制」的量写成 **2,251 行**,而 `threads/hooks.ts` 里那 **12 个 query hook(约 758 行)**
既不在 2,251 里(那个数已扣除整个 `threads/hooks.ts`),
也不在 §4.1 引擎估算的 1,061 行里 —— **等于没有任何阶段认领它。**
本节按消费方把它拆给 **P2(约 400 行,thread 列表)** 与 **P3/P5(约 358 行,聊天页)**,缺口补齐。

#### 拆分的两条纪律

1. **只搬不改**:36 个纯函数与 4 个类型**逐字搬运**(除 `ThreadStreamOptions` 去 `isMock`),
   任何"顺手优化"都会让 Tier 2 报红。想改 → 先记进 `PROVENANCE.md` 的偏离清单。
2. **拆分本身要能反向验证**:拆完后在 React 侧改掉 `mergeMessages` 任一分支,
   `make verify` 必须红。**这是拆分完成的判据,不是"看起来搬全了"。**

#### 🔴 3.1.4 第六类偏离 `DETYPED`(D13-a,v4 新增)

> **根因与 i18n/lucide-react 那次完全相同,只是没人回来重跑测量。**
> 原始「core 纯 TS 无 React 依赖 13,668 行」是按 `from "react"` 匹配出来的。
> v3 发现它**匹配不到 `from "lucide-react"`**,于是把 i18n 词典 3,086 行从 Tier 1 移到了 Tier 2。
> 🔴 **但 D21(删 `ai`)、D22(删 `@langchain/langgraph-sdk`)、D23(删 `@langchain/core`)
> 之后,这次测量没有再跑一遍** —— 而这三个决策让"待删包"从 1 个变成了 4 个。

##### 实测:13 个文件 / 3,185 行被误算进 Tier 1

筛选条件:**在 `core/` 内、不 import `react`/`react-dom`、但 import 了 D21/D22 要删的包**。

| # | 文件 | 行 | 来源包 | 改什么 |
| --- | --- | ---: | --- | --- |
| 1 | `messages/utils.ts` | **861** | langgraph-sdk | `AIMessage` `Message` |
| 2 | `messages/human-input.ts` | **588** | langgraph-sdk | `Message` |
| 3 | `messages/usage-model.ts` | **440** | langgraph-sdk | `Message` |
| 4 | `tasks/subtask-result.ts` | 271 | langgraph-sdk | `Message` |
| 5 | `threads/export.ts` | 238 | langgraph-sdk | `Message` |
| 6 | `sidecar/context.ts` | 212 | langgraph-sdk | `Message` |
| 7 | `messages/usage.ts` | 156 | langgraph-sdk | `Message` |
| 8 | `threads/utils.ts` | 124 | langgraph-sdk | `Thread` 系 |
| 9 | `messages/run-duration.ts` | 104 | langgraph-sdk | `Message` |
| 10 | `threads/types.ts` | 77 | langgraph-sdk | `Message` `Thread` |
| 11 | `tasks/types.ts` | 33 | langgraph-sdk | `Message` |
| 12 | `uploads/prompt-input-files.ts` | 52 | **`ai`**(D21) | `FileUIPart` 系 |
| 13 | `tools/utils.ts` | 29 | langgraph-sdk **+ `@langchain/core`** | `AIMessage` + `ToolCall`(D23) |
| | **合计** | **3,185** | | |

复现:

```bash
cd frontend/src/core && for f in $(grep -rlE 'from "(@langchain/langgraph-sdk|ai)"' .); do grep -qE 'from "react"' "$f" || echo "$f"; done
```

> 🔴 **这条命令输出 14 个文件 / 3,272 行,不是 13 / 3,185 —— 差额必须对上,否则就是记账漂移。**
> 唯一的差是 **`threads/static-demo.ts`(87 行)**:它 import `ThreadState` / `ThreadsClient`,
> 但已被 **D6 砍掉**(静态站点 demo 模式)→ 归 **REMOVED**,不进 DETYPED。
>
> ```
> 14 文件 / 3,272 行 − static-demo.ts 87(D6 REMOVED) = 13 文件 / 3,185 行  ✅
> ```
>
> ⚠️ **`tools/utils.ts` 要留在 DETYPED,不要因为 D23 已经提过它就漏掉** ——
> 它同时 import `@langchain/core` 的 `ToolCall`(D23 记过)**和 `@langchain/langgraph-sdk` 的 `AIMessage`**(D22,D23 没提)。
> 判据只有一条:**它的字节会变,就必须落进某个豁免集**,否则 Tier 1 哈希报红。
>
> 📌 **这处本身就是一次记账漂移的实例**:v4 首版写「12 个 / 3,156 行」,
> 是从一个更宽的中间清单里**手工挑**出来的,漏了 `tools/utils.ts`;
> 2026-07-31 基线换到 `b71a892b` 后按铁律 1 重跑该命令才发现。
> **教训与 §7 修正记录 ①–⑫ 同型:手工挑出来的子集不是实测,重跑命令才是。**

⚠️ **另有一个分类存疑件,单独处理**:`core/utils/files.tsx`(**286 行**)——
它 **value import `lucide-react` 的 7 个图标且自身含 JSX**,
按「`from "react"`」的旧口径被算进了纯 TS,**但它其实是 React 耦合件**。
处置:归入 React 耦合侧随 P2 重写(图标改 `lucide-vue-next`,JSX 改 SFC/`h()`),
**不进 DETYPED**(DETYPED 的定义是"只改 import 行")。

##### 算术更正

```
旧:13,486 = 10,400(Tier 1 逐字节) + 3,086(i18n,Tier 2)
🔴 新:13,486 = 7,215(Tier 1 逐字节) + 3,086(i18n,Tier 2) + 3,185(DETYPED,Tier 2)
                ^^^^^  10,400 − 3,185 = 7,215
```

**总量不变(13,486 行照搬),变的是校验层级**:Tier 1 从 10,400 → **7,215 行**(−30%),
Tier 2 从 3,086 → **6,242 行**。

##### 为什么这条必须在 P1 之前定

| 不改的后果 | 说明 |
| --- | --- |
| 🔴 `core-provenance.test.ts` **第一天报 13 个红** | 与 §3.1.2「旧草案漏掉的第 1 条」**完全同型** —— 然后被随手加进豁免,**保护消失** |
| §1.0 第 1 档虚高 | 「逐字节复制 19,017 行」里的 core 部分要从 10,400 改成 7,215 |
| P1 工时口径 | 12 个文件的 import 改动本身很轻(**约 0.5 天**),**但 Tier 2 比对面从 3,086 涨到 6,242 行**,`core-provenance.test.ts` 的提取器要多覆盖一倍的文件 |

##### 与 D22 的连带:`Message` 类型模型(见 §4.1.5)

13 个 DETYPED 件里有 **11 个**指向同一件事:**`Message` 这个域类型没有了包提供**。
这不是改一行 import 就完的 —— 它需要一个**本地手写的、与 Gateway wire format 结构兼容的类型模型**。
**§4.1.5 是 v4 新增的,专门估这件事。**

#### 3.1.1 存档:原共享包设计(D7 已否决)

原设计为 `packages/deerflow-client/` + 根 `pnpm-workspace.yaml` + 两端薄适配层,
可实现"一处修、两端受益"与"29 条红线集中维护",并可 PR 回上游。
**因 D7 禁止改动 `frontend-vue/` 之外的任何文件而作废。**
若 v2 放开该约束,建议按此方向重构 —— 它同时偿还 §10.2① 的技术债。

### 3.2 目录结构(最终版,已含 D1–D15 + §2.7)

图例:**📋 复制**(自 React 版,零改动)· **✍️ 新写** · **⚙️ 生成**(构建期产物,不入库)

```
deer-flow/
├── frontend/                           ← 🔒 D7 禁改。React 版,行为基准
├── docker-vue/                         ← ✅ D10 新建,与 frontend-vue 平级(不在其内)
│   ├── docker-compose.yaml             ✍️ 1 个服务,无 nginx(§3.2.2)
│   └── README.md                       ✍️ 启动 + 网络名排障
└── frontend-vue/                       ← ✅ 交付物,自包含
    │
    ├── app/
    │   ├── app.vue                     ✍️ 根组件:<a-config-provider :theme :locale>
    │   │                                  + hydration 前设 data-theme 的内联脚本(防 FOUC,§2.7.1)
    │   ├── error.vue                   ✍️
    │   │
    │   ├── pages/                      ✍️ 🔴 路径必须与 React 版逐一对应(§1.3 第 1 条)
    │   │   ├── index.vue                          → /
    │   │   ├── login.vue / setup.vue / auth/callback.vue
    │   │   └── workspace/
    │   │       ├── index.vue
    │   │       ├── chats/index.vue
    │   │       ├── chats/[thread_id].vue          → 主聊天页(P5 核心)
    │   │       ├── agents/index.vue / new.vue
    │   │       ├── agents/[agent_name]/chats/[thread_id].vue
    │   │       └── scheduled-tasks.vue
    │   │
    │   ├── layouts/                    ✍️ default.vue / workspace.vue
    │   │
    │   ├── components/
    │   │   ├── ui/                     ✍️ 🔴 **32 个存活组件**(44 −D6 9 −D9 3,口径见 §2.3.1.1):
    │   │   │                              · 14 个 antdv 薄包装 —— 只做两件事:
    │   │   │                                必要时补 role + 挂 data-testid
    │   │   │                                🔴 不写 aria-*(D5)、不写 sr-only(D8)
    │   │   │                              · 15 个自研(9 纯样式 + 6 Slot 组合件)
    │   │   │                                ⚠️ **不是 21** —— 21 是 D6 砍 6 个特效件前的数
    │   │   │                              · 3 个第三方:resizable / command / confetti-button
    │   │   │                                🔴 resizable 是 P0 go/no-go(R4)
    │   │   │                              ＋ toast:文件已死(D9)但能力仍活 → antdv message
    │   │   │                                ∴ 存活文件 32 = 14+15+3;能力缺口 4 = 3+toast
    │   │   ├── ai/                     ✍️ 对应 ai-elements —— 🔴 **14 个,不是 28 个**
    │   │   │                              (D9 实测 14 个零引用,§2.6.1)
    │   │   └── workspace/              ✍️ 🔴 子目录必须镜像 React 版(对标时双向查找)
    │   │       ├── chats/ messages/ artifacts/ sidecar/ browser-view/
    │   │       └── changes/ agents/ channels/ citations/ settings/
    │   │
    │   ├── core/                       📋 自 frontend/src/core 复制,约 13,486 行
    │   │                                  (🔴 v4:其中 7,215 行逐字节零改动;3,086 i18n + 3,185 DETYPED 走 Tier 2,§3.1/§3.1.4)
    │   │   ├── PROVENANCE.md           ✍️ 🔴 必做:来源 commit b71a892b + **五类偏离逐条登记**
    │   │   │                              ADAPTED(3)/ DEMOCKED(4)/ SPLIT(1)/ ADDED / REMOVED
    │   │   │                              —— 每一条都被 core-provenance 完备性检查强制(§3.1.2)
    │   │   ├── ai-types.ts             ✍️ 🔴 D21:替代 `ai` 包的本地最小类型
    │   │   │                              FileUIPart / UIMessage / ChatStatus /
    │   │   │                              LanguageModelUsage / Experimental_GeneratedImage
    │   │   ├── agent-types.ts          ✍️ 🔴 D23:替代 `@langchain/core` 的本地 ToolCall 最小类型
    │   │   │                              name / args / id?,覆盖当前工具渲染实用字段
    │   │   ├── server-state/           ✍️ 🔴 D24:替代 `@tanstack/vue-query` 的自研服务端状态层
    │   │   │   ├── client.ts           ✍️ Query cache / subscribers / fetch dedupe / stale flag
    │   │   │   ├── composables.ts      ✍️ useServerQuery / useServerMutation / useServerInfiniteQuery
    │   │   │   ├── keys.ts             ✍️ stable query key 序列化 + prefix match
    │   │   │   └── types.ts            ✍️ QueryClient 等价最小类型
    │   │   ├── config/index.ts         ✍️ ADAPTED 1/3:@/env → useRuntimeConfig()
    │   │   ├── auth/server.ts          ✍️ ADAPTED 2/3:next/headers → Nitro getCookie
    │   │   ├── i18n/server.ts          ✍️ ADAPTED 3/3:同上,读 locale cookie
    │   │   ├── i18n/locales/           📋 词典 3,086 行 —— 🔴 en-US 不能砍(§2.5 第 2 类)
    │   │   ├── api/
    │   │   │   ├── api-client.ts       ✍️ DEMOCKED 1/4:去 isMock(6 处)
    │   │   │   │                          ⚠️ recoverStreamReplayGaps 实测在本文件 :236
    │   │   │   │                             且**未 export** → 抽到 stream/ 时连带重构
    │   │   │   ├── fetcher.ts errors.ts stream-mode.ts feedback.ts   📋 零改动
    │   │   │   └── stream/             ✍️ **ADDED**(React 侧无此目录,实测已确认)
    │   │   │       ├── transport/      ✍️ 🔴 D22:手写 fetch/SSE/abort/retry/cursor
    │   │   │       │   ├── fetch-sse.ts
    │   │   │       │   ├── sse-buffer.ts
    │   │   │       │   ├── parse-sse-event.ts
    │   │   │       │   └── stream-error.ts
    │   │   │       ├── codec/          ✍️ DeerFlow Gateway wire codec(Content-Location / id / event / data)
    │   │   │       ├── adapters/       ✍️ deerflow-gateway.ts;未来可加 native adapter
    │   │   │       ├── canonical.ts    ✍️ 前端自有 CanonicalStreamEvent
    │   │   │       ├── reducer.ts      ✍️ Canonical event → snapshot patches
    │   │   │       ├── engine.ts       ✍️ ThreadStreamEngine(§4.1)—— 纯 TS,不 import vue
    │   │   │       └── gap-recovery.ts ✍️ 保留 5 次恢复预算语义,但不依赖 SDK
    │   │   ├── threads/                🔴 **SPLIT**(D13,规格见 §3.1.3)
    │   │   │   ├── history.ts          📋 22 个导出 —— C 类红线 S7–S10 载体
    │   │   │   ├── coalesce.ts         📋 3 个导出 —— B 类红线 S1(含 = 80 常量)
    │   │   │   ├── cache.ts            📋 12 个导出 —— 带 queryClient,框架无关
    │   │   │   ├── types.ts            📋 3 个类型(ThreadStreamOptions 去 isMock)
    │   │   │   └── api.ts              📋 零改动
    │   │   ├── sidecar/api.ts          ✍️ DEMOCKED 2/4:去 isMock(3 处)
    │   │   ├── artifacts/utils.ts      ✍️ DEMOCKED 3/4:去 isMock(3 处)
    │   │   ├── artifacts/loader.ts     ✍️ DEMOCKED 4/4:去 isMock(3 处)
    │   │   ├── messages/ tasks/ settings/            📋 零改动
    │   │   └── {models,skills,mcp,memory,agents,channels,scheduled-tasks,uploads,
    │   │        workspace-changes,citations,todos,tools,suggestions,
    │   │        notification,voice-input,input-polish,features}/
    │   │                                  ⚠️ 各自 api.ts + types.ts 复制;
    │   │                                     **17 个 hooks.ts 全部不复制**(实测,非 24)
    │   │
    │   ├── composables/                ✍️ 重写 hooks —— 🔴 **实测口径,非旧文的「24 个 2,251 行」**:
    │   │                                  · 16 个薄 hooks.ts        1,090 行  【P2】
    │   │                                  · threads/hooks.ts 拆出的 12 个 hook
    │   │                                       758 行 【P2 约 400 / P3·P5 约 358】
    │   │                                  🔴 用 @tanstack/vue-query(D24-a,原 D24 自研 server-state);
    │   │                                  ⚠️ enabled 的 48 处使用面必须改成响应式(§4.4.1);
    │   │                                  useThreadStream 不在此,它在 core/api/stream/engine.ts(§4.1)
    │   ├── stores/                     ✍️ Pinia 替代 React Context(§3.3)
    │   │                                  🔴 切 thread 必须显式 reset(风险 R3)
    │   ├── middleware/                 ✍️ 路由级鉴权守卫(客户端兜底;首跳由 Nitro middleware 处理)
    │   ├── plugins/                    ✍️ antdv locale / i18n / auth bootstrap
    │   ├── utils/                      ✍️ ⚠️ **不含 cn()** —— D15 后用 Vue 原生 :class 绑定,
    │   │                                  **不移植 clsx / tailwind-merge / cva**(§2.4.3)
    │   └── assets/styles/              ✍️ 🔴 **SCSS**(D15,不用 Tailwind)
    │       ├── main.scss               ✍️ 入口:@use tokens + reset + 全局语义类
    │       ├── _mixins.scss            ✍️ 断点、文本截断、滚动条等复用片段
    │       └── tokens/
    │           ├── _variables.scss     ⚙️ 生成:SCSS 变量(编译期 —— 尺寸/断点/层级)
    │           └── _variables.css      ⚙️ 生成:CSS 自定义属性(运行时 —— 颜色,:root/.dark)
    │                                      🔴 **两份都要**:SCSS 变量做不了运行时暗色切换,
    │                                         而暗色有 E2E 断言不能砍(§2.3.3)
    │                                      ⚙️ 均由 scripts/generate-theme.mjs 从
    │                                         config/theme-palette.json 生成(§2.7.1)
    │
    ├── config/                         ✍️ ⚠️ 在 app/ 之外 —— nuxt.config.ts 要 import 它
    │   ├── routes.ts                   ✍️ 🔴 渲染策略单一来源(§2.7.1 第 4 项):
    │   │                                  prerenderRoutes / swrRouteRules / csrRouteRules
    │   ├── theme-palette.json          ✍️ 🔴 主题唯一真相(§2.7.1 第 2 项)
    │   ├── theme.ts                    ✍️ getAntdThemeToken(mode) → antdv token
    │   └── antd-locale.ts              ✍️ antdv 组件内部文案联动 vue-i18n
    │
    ├── server/                         ✍️ Nitro
    │   ├── middleware/
    │   │   └── auth.ts                 ✍️ 🔴 D20 新增:返回 HTML 前读 cookie → 302(§2.9.3)
    │   ├── (routeRules proxy 在 nuxt.config)  🔴 必须实现 §3.2.1 的 proxy-policy 契约
    │   │                                  + SSE 不缓冲 / 超时 ≥120s / X-Forwarded-Proto(R15)
    │   ├── api/memory/                 ✍️ BFF(对应 React 版 app/api/memory)
    │   └── utils/                      ✍️ Nitro 鉴权五态 / cookie 工具
    │
    ├── scripts/
    │   ├── generate-theme.mjs          ✍️ prebuild:theme-palette.json → SCSS + CSS 变量
    │   ├── check-headers.mjs           ✍️ docs-sync 裁剪版(§2.7.2 第 5 项,约 10 行核心)
    │   └── i18n-check.mjs              ✍️ 词典缺失/未使用检查(§2.7.2 第 7 项)
    │
    ├── tests/                          ⚠️ guards / contract / unit / e2e **四者平级**
    │   ├── SPEC-GAPS.md                ✍️ 🔴 **P0 ⑱ 产出(v4/R21)**:≈2,122 行无判据功能的
    │   │                                 逐条处置(A 补 spec / B 人工签字 / C 接受漂移)
    │   │                                 ⚠️ 每条必须有结论;P6 验收 ④ 按它销账(§1.2.2)
    │   ├── unit/                       ✍️ Vitest,镜像 app/ 结构
    │   │   └── core/                   📋 72 个测试迁移(🔴 v4 更正;证明复制无损,P1 验收)
    │   │                                 ⚠️ 27 个非 core 单测的去留由 P0 ⑲ 定(§1.2.3)
    │   ├── guards/                     ✍️ 🔴 架构守护测试(§2.7.6 / 缓解 R14)
    │   │   │                              ⚠️ 路径是 tests/guards/,**不是 tests/unit/guards/**
    │   │   │                                 (D12 条文、§3.1.2、约束 6、P1⑤ 均用此路径)
    │   │   ├── core-provenance.test.ts   🔴 **D12+D13 核心**:Tier 1 文件哈希
    │   │   │                              + Tier 2 导出级比对 + 完备性检查
    │   │   │                              (§3.1.2,约 180 行)
    │   │   ├── testid-parity.test.ts     · testid 集合 ⊇ E2E 用到的 81 处
    │   │   ├── semantic-tags.test.ts     · 模板禁 <div @click>(D5/D8 后 83 次 role 断言全靠原生标签)
    │   │   ├── route-parity.test.ts      · 路由表与 React 版比对(D12 只读)
    │   │   └── cookie-names.test.ts      · locale / sidebar_state 字面量
    │   │                                  ⚠️ 每条都要能反向验证,且**先确认破坏真的生效**(§10)
    │   ├── contract/                   ✍️ 🔴 **D14 新增**:25 spec 照不到的代理层
    │   │   └── proxy-policy.test.ts      6 条断言:路径白名单 / 剥请求头 / 剥响应头
    │   │                                 / CSRF / 🔴 **SSE 不缓冲(按帧到达时刻断言)**
    │   │                                 / X-Forwarded-Proto(§1.2.1,约 120 行)
    │   ├── e2e/                        📋 复制 frontend/tests/e2e(**不是符号链接**)
    │   │   ├── utils/mock-api.ts       📋 1,411 行,核心资产,原样
    │   │   └── *.spec.ts               📋 24 个(删 landing / docs-localized-links,D6)
    │   │                                  🔴 改 7 处 testid(D5 二 + D8 三 + D15 二,§0.4)
    │   └── e2e-real-backend/           📋 🔴 **D14 后升为一等验收物**:复制 frontend 的
    │       └── *.spec.ts                  e2e-real-backend(3)+ e2e-auth(1)= **实测 4 个**
    │                                      打真 Gateway,唯一能端到端验证代理层的资产
    │
    ├── .husky/pre-push                 ✍️ 跑 make verify(本地钩子,非 .github/,缓解 R14)
    ├── Makefile                        ✍️ 🔴 make verify(D11 的人肉门禁,§3.2.3)
    ├── nuxt.config.ts                  ✍️ modules / routeRules 消费(config/routes.ts 的
    │                                      prerender/SWR/ssr:false) / routeRules proxy /
    │                                      antd extractStyle / runtimeConfig
    ├── playwright.vue.config.ts        ✍️ 指向 :3001
    ├── vitest.config.ts                ✍️
    ├── .env.example                    ✍️ ⚠️ 只提交 example(§2.7.3 反面教材)
    └── package.json                    ✍️ **独立**,不进根 pnpm-workspace.yaml(D7)
```

#### 关键约束(违反任一条都会伤到验收)

| # | 约束 | 违反的后果 |
| --- | --- | --- |
| 1 | `pages/` 路径与 React 版**逐一对应** | 打破 §1.3 第 1 条 → E2E 的 `page.goto()` 全废 |
| 2 | `components/workspace/` 子目录**镜像 React 版** | 🔴 对标时无法双向查找。**这条与 §2.7.3 的「不要抄 `app/features/` 分层」是同一件事** |
| 3 | `config/` 在 `app/` **之外** | `nuxt.config.ts` 需要 import 它(routeRules / theme),放 `app/` 里别名解析不到 |
| 4 | `core/` 的偏离**只允许五类且逐条登记**(D13):<br>ADAPTED 3 / DEMOCKED 4 / SPLIT 1 / ADDED / REMOVED | 偏离越多,`PROVENANCE.md` 越难维护,v2 回填上游越贵。<br>⚠️ **旧文写「只做 3 处适配」是不成立的** —— D6 清 `isMock` 必然改到另外 4 个文件,`threads/hooks.ts` 必然要拆(§3.1.2 / §3.1.3) |
| 5 | `core/api/stream/` **不 import vue** | 否则无法用 node 环境单测,也失去 v2 恢复共享包的可能(§4.1) |
| 6 | **运行时全部自包含**(D7) | 不改根 `pnpm-workspace.yaml`、不建 `packages/`。<br>⚠️ **D12 例外**:`tests/guards/` **可只读** `frontend/` 做机械比对 —— 仅测试期,运行时/构建产物**绝不引用** |
| 7 | `docker-vue/` 与 `frontend-vue/` **平级**,不嵌套 | 它需要 `context: ../` 才能读到 `frontend-vue/`(§3.2.2) |

> ⚠️ **第 2 条最容易被"改进"掉**。参照工程用的是 `app/features/` 按业务域分层,
> 看起来更现代 —— 但 deer-flow 的 `components/workspace` 是 **20,286 行**,
> 重划目录会让「两边并排 diff」这个对标手段直接失效。**§2.7.3 已明确标为不要抄。**

#### 3.2.1 D7 下的服务接入方式

D7 禁止改动 `docker/nginx/nginx.conf`,所以 **Vue 版不能挂进现有 Nginx(:2026)**。
它必须独立起服务,自己解决到 Gateway 的路由 —— 这在 Nuxt 下是现成能力:

```ts
// frontend-vue/nuxt.config.ts —— 对应 frontend/next.config.js 的 rewrites
import { csrRouteRules, prerenderRoutes, swrRouteRules } from './config/routes'

export default defineNuxtConfig({
  runtimeConfig: {
    gatewayUrl: process.env.DEER_FLOW_INTERNAL_GATEWAY_BASE_URL
                ?? 'http://127.0.0.1:8001',        // Nitro 鉴权中间件 + 代理用
    public: { backendBaseUrl: '', langgraphBaseUrl: '' },  // 留空=同源
  },
  routeRules: {
    ...Object.fromEntries(prerenderRoutes.map((route) => [route, { prerender: true }])),
    ...Object.fromEntries(swrRouteRules.map((route) => [route, { swr: 3600 }])),
    ...Object.fromEntries(csrRouteRules.map((route) => [route, { ssr: false }])),
    // 顺序与 next.config.js 一致:langgraph 必须在 /api/** 兜底之前
    '/api/langgraph/**': { proxy: `${GATEWAY}/api/**` },
    '/api/**':           { proxy: `${GATEWAY}/api/**` },
  },
})
```

| 项 | React 版(现状) | Vue 版(D7 下) |
| --- | --- | --- |
| 端口 | 3000 | **3001**(避免冲突) |
| 公开入口 | Nginx :2026 | **直连 :3001**,或由你方在 `frontend-vue/` 外自行配置(不在本方案范围) |
| `/api/*` 落地 | Nginx 或 Next rewrites | **Nitro `routeRules` proxy** |
| 鉴权取 cookie | `next/headers` | Nitro middleware 里 `getCookie(event, 'access_token')` |

#### 🔴 Nitro 代理必须实现的契约(来自 D9 砍掉的 `proxy-policy.ts`)

`frontend/src/core/auth/proxy-policy.ts` 是死代码(D9 已砍),但它的内容是一份
**LangGraph 兼容代理策略**,`routeRules` 的 proxy 必须等价实现,否则会出安全或兼容问题:

| 项 | 值 | 不实现的后果 |
| --- | --- | --- |
| 允许的上游路径前缀 | `threads` `runs` `assistants` `store` `models` `mcp` `skills` `memory`(8 个) | 代理成为任意转发器 |
| 必剥离的**请求**头 | `host` `connection` `keep-alive` `transfer-encoding` `te` `trailer` `upgrade` **`authorization`** **`x-api-key`** `origin` `referer` `proxy-authorization`(12 个) | 🔴 客户端可注入凭据头绕过 cookie 鉴权 |
| 必剥离的**响应**头 | `connection` `keep-alive` `transfer-encoding` `te` `trailer` `upgrade` `content-length` **`set-cookie`**(8 个) | 🔴 上游可越过 Nitro 直接给浏览器下 cookie |
| 凭据传递 | 仅转发 cookie **`access_token`** | — |
| CSRF | 非 `GET`/`HEAD` **强制校验** | 🔴 CSRF 防护失效 |
| 超时 | `120_000 ms` | 长 SSE 运行被提前掐断 |

> ⚠️ **这是 D9 里唯一"代码死了但知识活着"的文件**。其余 19 个都是未接线的 UI 组件,
> 删掉不带走任何信息。**P0 实现 Nitro 代理时按上表逐项对照。**

✅ **原 O14 的两件事已由 D10 / D11 解决**:
① 生产暴露 → **D10 允许新建 `docker-vue/`**,设计见 §3.2.2;
② CI → **D11 决定不做 GitHub CI**,改用 `make verify` 人肉门禁,见 §3.2.3。

### 3.2.2 `docker-vue/` 部署方案(D10)

**目标**:让公司同事访问到 Vue 版,且**零修改任何现有文件**。

#### 实读到的四个约束(决定了方案形态)

| 事实 | 出处 | 影响 |
| --- | --- | --- |
| **Gateway 不发布端口到主机** | `docker-compose.yaml` 仅 `nginx` 有 `ports` | 🔴 只能靠**加入主栈的 Docker 网络**访问 `gateway:8001`,没有 `host.docker.internal` 兜底 |
| **网络名 dev / prod 不同** | prod `-p deer-flow`+网络 `deer-flow` → `deer-flow_deer-flow`;dev `-p deer-flow-dev`+网络 `deer-flow-dev` → `deer-flow-dev_deer-flow-dev`(实测当前在跑的就是后者) | 网络名**必须参数化**,不能写死 |
| **根 `.dockerignore` 不排除 `frontend-vue/`** | 实读:排除的是 `docker/` `scripts/` `tests/` `*.md` | ✅ 构建上下文可用 `../` |
| **`nginx.conf` 无 `include`** | 两份 conf 零 `include` | 想挂进 `:2026` 只能改文件 → 所以走独立端口 |

#### ⭐ 最终设计:**不要 nginx-vue**,只一个服务

原方案打算复制一份 `vue.conf`。**实读后发现那一层是多余的** ——
§3.2.1 的 Nitro `routeRules` 已经把 `/api/**` 代理到 Gateway 了,
前面再放 nginx 只是一个透传的 `location /`。

```
浏览器 → :2027 ──▶ frontend-vue:3000 (Nuxt/Nitro)
                      └─ routeRules: /api/langgraph/** → gateway:8001/api/**
                                     /api/**           → gateway:8001/api/**
```

```
docker-vue/                       ← 新建(D10),零修改现有文件
├── README.md                     # 启动 + 网络名排障说明
└── docker-compose.yaml           # 1 个服务,无 nginx,无 conf 拷贝
```

```yaml
name: deer-flow-vue                       # 显式项目名,不依赖目录名推断

services:
  frontend-vue:
    build:
      context: ../                        # 仓库根;只读 frontend-vue/,不改任何现有文件
      dockerfile: frontend-vue/Dockerfile
    container_name: deer-flow-frontend-vue
    ports:
      - "${VUE_PORT:-2027}:3000"          # 唯一对外端口
    environment:
      - NUXT_GATEWAY_URL=${VUE_GATEWAY_URL:-http://gateway:8001}
    networks: [deer-flow]
    restart: unless-stopped

networks:
  deer-flow:
    external: true                        # 复用主栈网络,拿到 gateway:8001
    # prod(make up)        → deer-flow_deer-flow
    # dev (make docker-start) → deer-flow-dev_deer-flow-dev
    name: ${DEER_FLOW_NETWORK:-deer-flow_deer-flow}
```

启动:主栈先起,再 `docker compose -f docker-vue/docker-compose.yaml up -d`
→ **`:2026` = React 版,`:2027` = Vue 版,两个同时活着,打同一个后端。**

#### 这个形态的三个好处

1. **彻底消掉「第 3 份 nginx conf」的发散债** ——
   实测现有两份已经在发散(`/docs` vs `/api/docs`、`nginx.local.conf` 缺 `/api/sandboxes`),
   再加一份就要三处维护 16 个 location。**不做 nginx-vue 就没有这个问题。**
2. **复用同一个 Gateway = 对标时排除后端变量** ——
   §0.3 保留 React 版是为了「并排跑、逐屏 diff」。两个前端打同一个后端,
   行为不一致就**一定**是前端问题。自带一套 Gateway 反而做不到。
3. **零修改现有文件**,严格满足 D10。

#### ⚠️ 责任转移:nginx 原来做的三件事必须落进 Nitro

去掉 nginx-vue 后,这三项从 nginx 转移到 Nitro,**都是 P0 必做项**:

| 原 nginx 负责 | Nitro 侧必须等价实现 | 不做的后果 |
| --- | --- | --- |
| `proxy_buffering off` + `X-Accel-Buffering no` | 代理不得缓冲 SSE | 🔴 流式响应被攒成一坨,整个聊天体验废掉 |
| `browser/stream` / 长 prompt 的加长超时 | 长连接超时 ≥ 120s(见 §3.2.1 契约) | 长 run 被提前掐断 |
| `X-Forwarded-Proto` 透传(`nginx.conf:29-32` 的 map) | 转发真实 scheme | 🔴 Gateway 把 HTTPS 当 HTTP,登录 POST 返回 403「Cross-site auth request denied」,session cookie 丢 Secure 标记 |

> 📌 这三项 + §3.2.1 的 `proxy-policy` 契约,构成 **P0 的 Nitro 代理验收清单**。

#### 后续若需要 TLS 或统一入口

再加 `docker-vue/nginx/` 也不迟(D10 允许)。但那时它只需要**一个** `location /`
透传给 `frontend-vue:3000`,仍然不需要复制那 16 个 API location。

### 3.2.3 质量门禁:`make verify`(D11)

> 🔴 **v4 修订(D11-a)**:`make verify` / `verify-full` **全部保留**(本地快/慢门禁的拆分是对的),
> **但 §3.2.4 新增了一层 GitHub CI** —— 因为「不做 CI」这个前提实测站不住。
> 本节以下内容不变,只是**它不再是唯一的门禁**,R14 的严重度相应下降。

D11 原决定 Vue 版不进 GitHub Actions。本地方案放在 `frontend-vue/Makefile`(D7 允许):

顺序参照 §2.7.2 第 8 项(该工程的 `quality` 脚本,已实跑全绿):

```makefile
# ── 快门禁:秒级,pre-push 钩子跑这个 ──────────────────────────
verify:                    ## lint + 样式 + 类型 + 单测 + 守护 + 契约(不含 E2E)
	pnpm lint
	pnpm stylelint                              # D15:SCSS 属性顺序 / 嵌套深度
	pnpm typecheck
	pnpm vitest run tests/unit tests/guards tests/contract

# ── 全门禁:PR 必须贴它的完整输出 ─────────────────────────────
verify-full: verify        ## 上面全部 + 两层 E2E(D14)
	pnpm exec playwright test -c playwright.vue.config.ts          # ① UI 层 25 spec
	pnpm exec playwright test -c playwright.real-backend.config.ts # ② 代理层 4 spec
```

**为什么必须拆**(而不是一个 `verify` 一把梭):
原方案把 123 个 E2E 用例挂在 pre-push 钩子上。**现实里这会变成 `git push --no-verify`** ——
一个每次 push 都要等几分钟的钩子活不过两周,而钩子是 R14 三条缓解里唯一自动执行的一条。
拆开后:`verify` 秒级、真的会被跑;`verify-full` 慢但只在 PR 前跑一次。

| 目标 | 跑什么 | 何时 | 耗时量级 |
| --- | --- | --- | --- |
| `verify` | lint / typecheck / 单测 / **guards** / **contract** | **pre-push 钩子**(自动) | 秒级 |
| `verify-full` | 上面 + 24 UI spec + 4 真后端 spec | **PR 前**(人工),贴输出 | 分钟级 |

⚠️ **`tests/contract/` 放进快门禁而不是慢门禁**:代理契约测试只需起 Nitro + 假上游,
不需要真 Gateway,秒级可跑 —— **让 R15 那三项每次 push 都被检查一遍**,这是 D14 最划算的一步。

约定:**PR 必须贴 `make verify-full` 的完整输出**,否则不予 review。

⚠️ **这不等价于 CI,代价已登记为风险 R14**:
- 「25 spec 全绿」变成**自我声明**,没有独立执行的门禁
- §1.3 五条约束(URL / testid / 语义化标签 / 文案 / cookie)只能靠 review 人肉守
- 忘跑 / 跑一半 / 本机环境差异,都不会被拦住

**缓解建议**(都不需要任何权限):
① `make verify` / `verify-full` 失败必须非零退出,不允许 `|| true`;
② 在 `frontend-vue/` 装 pre-push git hook 跑 **`make verify`(快门禁)** ——
   hook 在本地不是 `.github/`;**必须是快的那个,否则会被 `--no-verify` 绕过**;
③ P6 验收那一次,由**第二个人**在自己机器上独立跑一遍 **`make verify-full`** 并签字 ——
   这是本方案里代替 CI 的最后一道闸;
④ 把 §1.3 五条约束做成 `tests/guards/`(四条可机械化,§2.7.6);
⑤ 代理层由 `tests/contract/` 守(D14,§1.2.1)—— **它跑在快门禁里,每次 push 都执行**;
🔴 ⑥ **v4 新增:上 GitHub CI(D11-a,§3.2.4)** —— 这一条直接关掉 R14 的主因。

### 🔴 3.2.4 D11-a:R14 是自设约束,一个新文件就能关掉(v4 新增)

> **R14(无 CI 门禁)被评为「中高概率 / 高影响」,是方案自认的四个剩余执行风险之一。**
> 它的全部依据是 D11 的一句话:「`.github/` 不动」。
> 🔴 **但 D7 禁的是「改动已有文件」,而 D10 已经明确批准「新建」** ——
> `docker-vue/` 就是靠这条逻辑批下来的。**CI 完全可以走同一条路。**

#### 实测:14 个现有 workflow 全部按 `paths:` 过滤

```bash
ls .github/workflows/ && grep -A4 "paths:" .github/workflows/*.y*ml
```

| workflow | 触发路径 |
| --- | --- |
| `e2e-tests.yml` | `frontend/**` + 自身 |
| `frontend-unit-tests.yml` | `frontend/**` + 自身 |
| `backend-unit-tests.yml` / `backend-blocking-io-tests.yml` | `backend/**` + 自身 |
| `chart.yaml` | `deploy/helm/**` 等 |
| …(共 14 个) | 各自的路径 |

🔴 **结论**:新建 `.github/workflows/frontend-vue-verify.yml`(`paths: frontend-vue/**`)——

| 影响 | 结果 |
| --- | --- |
| 修改现有文件 | ✅ **0 个** |
| 触发现有流水线 | ✅ **0 条**(没有任何现有 workflow 监听 `frontend-vue/**`) |
| 被现有流水线触发 | ✅ **不会**(新 workflow 只监听 `frontend-vue/**`,`frontend/` 的改动不会触发它) |
| 与 D7 的关系 | ✅ **不冲突** —— 新建文件,与 D10 批准 `docker-vue/` **完全同构** |

#### 落盘内容(P0 建出 `frontend-vue/` 之后)

```yaml
# .github/workflows/frontend-vue-verify.yml  ← 🔴 新建,零修改现有文件
name: frontend-vue verify
on:
  push:
    paths: ['frontend-vue/**', '.github/workflows/frontend-vue-verify.yml']
  pull_request:
    paths: ['frontend-vue/**', '.github/workflows/frontend-vue-verify.yml']
concurrency:
  group: fe-vue-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true
jobs:
  verify:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: frontend-vue } }
    steps:
      - uses: actions/checkout@v4          # ⚠️ 必须完整 checkout —— core-provenance 要读 frontend/src
      - uses: actions/setup-node@v4
        with: { node-version: '22.22.3' }
      - run: corepack enable && pnpm install --frozen-lockfile --strict-peer-dependencies
      - run: make verify                   # 快门禁:lint + stylelint + typecheck + unit + guards + contract
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm exec playwright test -c playwright.vue.config.ts   # ① UI 层 25 spec
```

#### ⚠️ 两个必须注意的点

| # | 点 | 说明 |
| --- | --- | --- |
| 1 | 🔴 **`core-provenance.test.ts` 要读 `frontend/src`** | CI 里必须是**完整 checkout**(不能 sparse checkout 只拉 `frontend-vue/`),否则 D12/D13 的两层校验在 CI 上直接崩 |
| 2 | ⚠️ **代理层第 ② 半(4 个真后端 spec)进不了这个 workflow** | 它们需要真 Gateway。**这部分仍按 §3.2.3 ③ 由第二人本地跑并签字** —— 也就是说 **R14 是被"大部分关闭",不是完全消除** |

#### 对风险 R14 的影响

| | 原(D11) | 🔴 v4(D11-a) |
| --- | --- | --- |
| 25 个 UI spec | 自我声明 | ✅ **CI 强制执行** |
| `tests/guards/`(§1.3 五条约束) | 自我声明 | ✅ **CI 强制执行** |
| `tests/contract/`(代理层 6 条断言) | 自我声明 | ✅ **CI 强制执行** |
| 4 个真后端 spec | 自我声明 | ⚠️ **仍是自我声明**(需真 Gateway) |
| **R14 评级** | **中高 / 高** | 🔻 **低 / 中** |
| 成本 | — | **约 1 小时**(一个新文件) |

> 🔴 **这是全案投入产出比最高的一处修改** ——
> 用一个不触碰任何现有文件的新 workflow,换掉一个「中高概率 / 高影响」的风险。
> **如果你仍然坚持 D11 原文(彻底不进 GitHub Actions),那也可以** ——
> 但请把它记成一次**明确的取舍**,而不是"没有别的办法"。

### 3.3 状态方案映射

| React 版 | Vue 版 | 备注 |
| --- | --- | --- |
| TanStack Query + `QueryClientProvider` | ✅ **`@tanstack/vue-query` + `VueQueryPlugin`**(🔄 **D24-a** 推翻 D24) | key 约定与失效策略**语义等价迁移**,不必重新设计。⚠️ **唯一要动脑子的是 `enabled` 那 48 处必须改成响应式**(§4.4.1);不做 SSR hydrate/dehydrate(D20 产品区全 CSR) |
| `useStream`(SDK) | `useThreadStream()` composable → 包 `ThreadStreamEngine` | 见 §4.1 |
| `I18nContext` | Pinia store 或 `useState` | 产品区 CSR 下客户端读 `locale` cookie;将来营销区 SSR/预渲染另按路由处理 |
| `AuthProvider` | Pinia store + Nitro middleware + 客户端兜底中间件 | 五态判定首跳移到 `server/middleware/auth.ts`(D20),客户端只做兜底与状态同步 |
| `SubtasksProvider` | Pinia store | ⭐ `tasksRef` 模式在 Vue 下可简化(见 §5 A 类) |
| `ArtifactsProvider` / `SidecarProvider` / `BrowserViewProvider` | Pinia store(按 thread 作用域) | 需注意生命周期:React 靠 Provider 卸载,Vue 需显式 reset |
| `ThreadContext` | `provide`/`inject` 或 store | 只下发 `{ thread }`,轻量(`isMock` 已随 D6 移除,见 §2.5.2) |
| `PromptInputProvider` | 自研 composable | 随 ai-elements 一起做 |
| `SidebarProvider` | **antdv `a-layout-sider`** / 自研 + cookie | 产品区 CSR 下客户端读写 `sidebar_state`;cookie 名与语义仍须与 React 版一致。⚠️ 原文写 reka-ui,已按 **D2** 更正 |
| localStorage external store | Pinia + `storage` 事件监听 | ⭐ 比 React 版简单(Vue 响应式天然支持),但 **`safeLocalStorage` 门面必须原样保留**(红线 S11) |
| sessionStorage 草稿 | 原样复用复制来的 `app/core/` 逻辑 | 纯 TS(D7 下无共享包) |

---

### 3.3.1 Pinia store 作用域约定(补 R3 的设计空档)

> 🔴 **本节是 v3 新增。** 此前 §3.3 与风险 R3 都只写了「P2 即定 store 作用域约定」,
> **但方案里从来没有这个设计** —— 这是空档,不是记账错。Pinia 默认单例、
> 而 DeerFlow 的核心语义是按 thread 隔离。D20 后产品区 `ssr:false`,跨请求共享风险不再适用,
> 但 store 作用域仍必须清楚,否则会出现**浏览器会话内的跨 thread 泄漏**。

#### 🔴 先纠正一个错误的前提

本节旧版写着:「React 版靠 Provider 随路由卸载来清理每 thread 状态」。**这是错的**,实测:

| 事实 | 证据 |
| --- | --- |
| 三个 thread 级 Provider 挂在 `[thread_id]/layout.tsx`,**且没有 `key`** | `agents/[agent_name]/chats/[thread_id]/layout.tsx`(`SubtasksProvider` / `ArtifactsProvider` / `PromptInputProvider`,全文 18 行,无 `key`) |
| Next.js App Router **在同级动态段之间复用 layout** | `/chats/A` → `/chats/B` 时该 layout 实例**不卸载**,只有 `page.tsx` 重渲染 |
| 🔴 重置**部分**住在消费者组件的手写哨兵里 | `chats/chat-box.tsx:81`<br>`if (threadIdRef.current !== threadId) { threadIdRef.current = threadId; deselect(); }`<br>⚠️ 2026-07-31 更新:`setArtifacts([])` 已从哨兵中移除(main `0d8e11ad`),改为下方的非空守卫 `if (threadArtifacts && threadArtifacts.length > 0)`,避免初始空流值抹掉 provider 恢复的状态 |
| ✅ 另一半重置已回到**状态所有者**内部 | `artifacts/context.tsx:89-101` 的 pathname 水合 effect:切 pathname 即重设 `artifacts` / `selectedArtifact` / `open` / `autoOpen` / `autoSelect`,并从 `sessionStorage` 读回面板状态 |

**这个纠正对 Vue 侧是好消息**:重置机制**本来就与框架无关**(显式哨兵 + 重置调用),
不是 React 生命周期的产物 → 迁到 Pinia 几乎 1:1(`watch(threadId)` → `store.$reset()`)。

**🔄 2026-07-31 复核:原先列出的两个问题,上游已各自变化**:
1. **重置逻辑住在消费者里,不在状态所有者里** —— ⬇️ **风险降级**。provider 现在自带 pathname-keyed 水合 effect,
   thread 级重置的主体已回到状态所有者内部,正是本节希望的方向。哨兵仅剩 `deselect()`,
   仍建议 Vue 侧统一收进 `resetForThreadSwitch()`(约定 3),但"绕过 `chat-box.tsx` 的新入口会泄漏"已不再成立。
2. ~~🔴 `deselect()` 不重置 `autoOpen`,全库无路径设回 `true`,跨 thread 粘滞~~
   —— ✅ **已被上游修复,O17 关闭**。`artifacts/context.tsx:98` 在 pathname 水合 effect 中 `setAutoOpen(true)`。
   当前 3 处:`:84`(useState)/ `:98`(`true`)/ `:145`(`false`)。Vue 侧按 **D18** 实现即与 React 对齐,**不再是有意差异**。

#### store 三分类与 reset 边界

| 类 | store | 生命周期 | 切 thread 时 |
| --- | --- | --- | --- |
| **G · 全局** | `useAuthStore`、`useSettingsStore`、`useI18nStore`、`useSidebarStore` | 整个会话 | ❌ **不动** |
| **T · thread 级** | `useArtifactsStore`、`useSidecarStore`、`useBrowserViewStore`、`useSubtasksStore` | 逻辑上随 thread | 🔴 **必须 `$reset()`** |
| **E · 引擎持有** | `ThreadStreamEngine` 的流状态 | 由引擎自管(§4.1) | 由引擎的 `dispose()` 负责,**不走 Pinia** |

#### 五条可执行约定

1. **T 类 store 一律不自行读 `route.params.threadId`。**
   thread 切换由**单一入口**负责:`app/composables/useThreadScope.ts` 里一个
   `watch(threadId, (id, prev) => { if (prev !== undefined && id !== prev) resetThreadStores(); })`。
   → 把 React 那个散在消费者里的哨兵**收拢到状态层**,解决上面的问题 1

2. **`resetThreadStores()` 是唯一的重置入口**,显式列出所有 T 类 store。
   新增 T 类 store 必须同时登记进这个函数 —— 由守护测试兜底(见下)

3. **每个 T 类 store 自定义 `resetForThreadSwitch()`**,显式声明哪些字段跨 thread 保留 ——
   **不要无脑用 `$reset()`**,重置范围必须是逐字段声明的,不能是"默认全清"的副作用。
   > ✅ **`autoOpen` 已定案(D18):切 thread 时重置为 `true`**,即**包含**在 `resetForThreadSwitch()` 里。
   > 🔴 **这是与 React 版的有意差异**(React 现状是跨 thread 粘滞),**实测代价 0 处 spec 改动**,
   > 但**必须登记进「已知对标差异」清单** —— 否则风险 R18 的逐屏 diff 会把它报成缺陷。

4. ~~**SSR 隔离**~~ → ✅ **D20 后不再适用**:产品区 `ssr:false`,**不存在服务端渲染,也就没有跨请求共享的可能**,每个浏览器会话一个 Pinia 实例。<br>⚠️ **但下面这条写法约束仍建议保留**(将来营销区若引入 SSR,或做 prerender 时会重新相关):`@pinia/nuxt` 每个请求建一个新的 Pinia 实例,默认安全。
   🔴 **唯一会破坏它的写法是在模块顶层调用 `useXxxStore()`** —— 那会绑到当时的 active pinia,
   造成请求间共享。**约定:`useXxxStore()` 只能在 `setup` / Nuxt 插件 / 中间件内调用,
   禁止出现在模块作用域、也禁止用模块级变量缓存 store 引用。**

5. **`storeToRefs` 解构**:T 类 store 的解构结果在 `$reset` 后仍然有效(ref 身份不变),
   但**不要解构后存进模块级变量** —— 同第 4 条。

#### 守护测试(并入 `tests/guards/`,跑在快门禁里)

| 测试 | 断言 |
| --- | --- |
| `store-scope.test.ts` | ① 每个标注为 T 类的 store 都出现在 `resetThreadStores()` 里(靠命名约定或显式注册表比对);② 没有模块顶层调用 `useXxxStore()`(AST 扫描) |
| 🔴 `no-react-deps.test.ts` | **扫全部源码,断言没有 import 到 37 个 React 耦合包中的任何一个**(清单见 §2.8.1)。<br>🔴 **D22 后额外断言:禁止 import 整个 `@langchain/langgraph-sdk` 包** —— 不再只拦 `/react` 与 `/react-ui` 子路径。<br>~~🔴 D24 后额外断言:禁止 import `@tanstack/vue-query`~~ → ❌ **v4 删除该断言(D24-a)** —— **它现在是允许的直接依赖**;若不删,`make verify` 第一天就红<br>🔴 **D25 后额外断言:禁止 import `motion-v` / `@vue-flow/core` / `canvas-confetti` / `@uiw/codemirror-theme-*` / `nanoid` / `tokenlens`**。<br>🔴 **v4 从禁用名单中移除 `@vueuse/core` 与 `uuid`**(D25-a,§2.4.6)—— **同上,不移除会立刻假红**。<br>⚠️ **这条本身就是"删包决策会往守护测试里沉淀"的例子**:每次推翻一个删包决策,**必须同步改这里**,否则门禁会拦住正确的代码。 |
| `thread-switch.spec.ts` **(新增 E2E)** | 🔴 **现有 25 个 spec 多为单 thread 场景,覆盖不足**(R3 已指出)。补:A 线程开产物面板 → 切到 B → 断言面板状态、产物列表、subtasks 均已隔离 |

> ⚠️ **这条 E2E 是新增的,不在继承来的 25 个 spec 里** —— 按 D14,它属于 ① UI 层,
> 但**不计入「25 spec 全绿」这个验收口径**,需在 §1.2 的验收清单里单列。

---

## 4. 🔴 **三个**自研基础件设计(成败关键)

> 🔴 **v4:原为四个。`ServerStateClient`(§4.4)已由 D24-a 移出** ——
> 改装 `@tanstack/vue-query`,不自研(§2.8.7)。§4.4 保留为存档,其中 **§4.4.1 的使用面表仍有效**。

### 4.1 `ThreadStreamEngine` — 框架无关的流引擎

**目标(D22)**:前端**手写完整流处理**。不依赖 `@langchain/langgraph-sdk` 的
`runs.stream` / `joinStream` / `useStream`,而是把当前 DeerFlow Gateway SSE wire contract
解析成前端自有的 `CanonicalStreamEvent`,再由 `ThreadStreamEngine` 规约为快照。
上面只挂一层 Vue composable 适配。

> ⚠️ **D7 修订**:原设计把引擎放在共享包 `packages/deerflow-client/` 并「两端各写薄适配」。
> D7 否决共享包后,引擎只服务 Vue 一端;但**仍要保持框架无关**(纯 TS、不 import vue),
> 这样它才能用 node 环境单测,也才可能在 v2 恢复共享包时原封不动搬走(§3.1.1 / O15)。

> 🔴 **D22 修订**:旧方案说"复刻 SDK `useStream` + 复用 SDK client"不再成立。
> 当前后端仍不改,但 LangGraph-compatible 只作为 **DeerFlow Gateway adapter** 的输入协议;
> 前端内部不得泄漏 LangGraph SDK 的 run/thread/stream 抽象。未来后端若不用 LangChain/LangGraph,
> 只需新增 adapter 或保持 canonical event 契约,UI/store 不大改。

#### 4.1.0 🔵 Gamma-project 参照评估:借鉴分层,不复制协议

**参照来源**:`/Users/wangcheng/Documents/workSpace/frontEnd/pixelBloomSpace/oversea/gamma-project`
的 `features/agentCore/stream/`、`features/deepResearch/api/core/sse/`、`reducers/`、`store/`
与 `tests/sse-transport.test.ts`、`tests/reducer-merge.test.ts`、`tests/parity.test.ts`。

这套实现中值得借鉴的不是具体事件名,而是职责分层:

```text
Gamma 通用 SSE buffer/parser
        ↓
Deep Research transport(连接、分片续拉、网络重试)
        ↓
业务 SSE adapter(JSON.parse、业务类型)
        ↓
纯 reducer(事件 → action)
        ↓
Pinia store(游标、abort、重连、消息合并)
        ↓
view-model / renderer
```

**✅ DeerFlow 采用的部分**:

1. `agentCore/stream` 的职责思想:buffer 只切 frame,parser 只产出 `{ event, data }`,不在底层解析业务 JSON。
2. transport 与业务 adapter 分层:连接失败、abort、协议错误不在业务 reducer 中处理。
3. reducer 使用纯函数和明确 action(`ignore` / `merge` / `error`),不直接改 Pinia。
4. 流所有权和生命周期检查:切 thread、stop、重连后,旧 reader 即使晚到事件也不能写入当前状态。
5. `requestAnimationFrame` 批量更新的性能思路,但只放在 Vue 适配层;引擎内部继续使用 `coalesce.ts` 的框架无关合并语义。
6. 实时流与历史回放的 parity 测试:同一组 canonical 事件分别走实时和回放路径,最终 view-model 必须一致。
7. watchdog 的纯函数规则:「后端等待用户输入」与「真实断流」必须分开,组件不直接控制重连。

**🔴 DeerFlow 不复制的部分**:

| Gamma 实现 | DeerFlow 处理 |
| --- | --- |
| `sse-buffer.ts` 只按 `\\n\\n` 切分 | 仅借鉴思路;必须覆盖 `CRLF`、多行 `data:`、注释/heartbeat、EOF 残帧与 frame 边界测试 |
| `parse-sse-event.ts` 不解析 `id:`、heartbeat,且只支持简化字段 | DeerFlow parser 必须保留 `id`,识别 `: heartbeat`,并把 heartbeat 排除在业务 reducer 之外 |
| `segment_continue` + `last_message_index` | 不复制;DeerFlow 使用 Gateway 的 `Last-Event-ID`、`Content-Location`、`gap` 和 durable state reload |
| `localStorage` 读取 token | 不复制;认证由 Nitro proxy / HttpOnly session / CSRF 契约负责,transport 不读存储 |
| 模块级 `reconnectTimer` / `reconnectPromise` | 不复制;`ThreadStreamEngine` 每个实例自有生命周期,必须有 `dispose()` 和单一流所有权 |
| reducer 明确声明“没有通用 event 去重” | 不接受为最终方案;DeerFlow 至少按 event id/cursor 做重复保护,并覆盖 gap 恢复后的重放行为 |

**DeerFlow 最终采用的链路**:

```text
fetch-sse(字节/文本流)
  → sse-buffer + parse-sse-event(通用 SSE frame)
  → deerflow-wire(codec: id / event / data / heartbeat / end / gap / 409)
  → deerflow-gateway(adapter: Gateway event → CanonicalStreamEvent)
  → reducer(CanonicalStreamEvent → snapshot patches)
  → ThreadStreamEngine(游标、所有权、abort、gap recovery、coalesce)
  → Vue composable(响应式快照与 RAF 批量通知)
  → Pinia / workspace UI
```

Gamma 的 `message_chunk`、`segment_continue`、`stream_completed`、Deep Research agent 名称
都属于它自己的业务协议,不能进入 DeerFlow 的 canonical 层。DeerFlow canonical 层只允许本方案
§4.1.2 定义的自有事件,组件和 Pinia 不得判断 Gateway 原始 `event` 名。

**必须新增或保留的测试形态**:

- `sse-transport`: CRLF、heartbeat、多行 data、`id`、`end`、EOF、abort;
- `gateway-codec`: `Content-Location`、`metadata/messages/values/custom`、`gap`、409 分支;
- `engine-lifecycle`: dispose、切 thread 后旧流事件丢弃、stop/drain、单流所有权;
- `replay-parity`: 实时事件与 durable reload/tail resume 的 canonical snapshot 一致;
- `coalesce`: 连续 chunk 不饿死 UI,且不产生每 chunk 一次的响应式通知;
- `nitro-proxy`: 首帧按到达时间断言,验证 SSE 没有被代理缓冲。

```
frontend-vue/app/core/api/stream/     ← 🔴 ADDED:React 侧无此目录(实测已确认)
├── transport/
│   ├── fetch-sse.ts          ← fetch + ReadableStream + TextDecoderStream + AbortController
│   ├── sse-buffer.ts         ← 按空行切 SSE frame(参考 Gamma,但不绑定其业务字段)
│   ├── parse-sse-event.ts    ← 解析 event/data/id/heartbeat,不 JSON.parse 业务
│   └── stream-error.ts       ← abort/network/backend/protocol/gap 分类
├── codec/
│   └── deerflow-wire.ts      ← Content-Location / Last-Event-ID / end / gap / 409
├── adapters/
│   └── deerflow-gateway.ts   ← metadata/messages/values/custom/updates → CanonicalStreamEvent
├── canonical.ts              ← 前端自有事件模型,不出现 LangGraph SDK 类型
├── reducer.ts                ← CanonicalStreamEvent → snapshot patches
├── engine.ts                 ← ThreadStreamEngine:纯 TS 状态机(不依赖 vue)
└── gap-recovery.ts           ← 5 次恢复预算 + durable state reload + resume tail

  ⚠️ coalesce **不在这里** —— 它在 app/core/threads/coalesce.ts(D13 拆分产物),
     engine.ts `import` 它即可,不要复制第二份。
  ⚠️ 也**不再有 `sdk-wrappers.ts`** —— D22 后所有 Gateway API 都走手写 fetch wrapper。
```

#### 4.1.1 当前 DeerFlow Gateway stream contract(已按后端源码比对)

| 项 | 当前语义 | Vue 手写层责任 |
| --- | --- | --- |
| 创建流 | `POST /api/threads/{thread_id}/runs/stream` | 读取 `Content-Location` 解析 `thread_id/run_id`,触发 `created` |
| 接入流 | `GET /api/threads/{thread_id}/runs/{run_id}/join` | 带 `Last-Event-ID` 续接,终态 run 先查状态短路 |
| stop/drain | `POST /api/threads/{thread_id}/runs/{run_id}/stream?action=interrupt|rollback&wait=0` | stop 后继续 drain 剩余 SSE;202/204/409 分支要区分 |
| stateless | `POST /api/runs/stream` | 可保留 wrapper,但聊天主链优先 thread-scoped |
| SSE frame | `event:` + `data:` + 可选 `id:`;心跳为 `: heartbeat`;终止为 `event: end` / `data: null` | transport 层解析,heartbeat 不进业务 reducer |
| stream modes | 请求允许 `values` / `messages-tuple` / `updates` / `debug` / `tasks` / `checkpoints` / `custom` | 仍做白名单 throw;注意请求 `messages-tuple`,实际 SSE event 名为 `messages` |
| `gap` | `event: gap`,payload `code=stream_replay_gap`,含 `latest_available_event_id` | reload durable state 后从 tail resume,最多 5 次 |
| `custom` | `task_*` / `llm_retry` / `stream_replay_gap` 等 DeerFlow UI 事件 | adapter 转 canonical `subtask_delta` / `notice` / `stream_gap` |
| 409 | "not active on this worker and cannot be streamed" vs "is not cancellable" 等字符串分支 | 临时沿用字符串 matcher;若后端未来给结构化 code,只改 codec |
| `streamResumable` | 前端现状会传,后端只接受 SDK 默认 false;React 版 wrapper 会剥离 true | D22 后仍在 submit options 层剥离,不把它当真实 resumable |

> 这张表的来源不是 SDK 文档,而是当前后端源码:
> `thread_runs.py` 的 stream/join/cancel 路由、`services.py::format_sse/sse_consumer`、
> `runtime/stream_modes.py`、`runtime/runs/worker.py::_lg_mode_to_sse_event`。

#### 4.1.2 Canonical event 边界

前端内部只认自有事件,组件/Pinia/composable 都不能判断 Gateway SSE event 名:

```ts
type CanonicalStreamEvent =
  | { type: "connected"; runId?: string; threadId?: string; cursor?: StreamCursor }
  | { type: "message_delta"; messageId?: string; delta: unknown; cursor?: StreamCursor }
  | { type: "message_snapshot"; values: AgentThreadState; cursor?: StreamCursor }
  | { type: "subtask_delta"; payload: unknown; cursor?: StreamCursor }
  | { type: "artifact_delta"; payload: unknown; cursor?: StreamCursor }
  | { type: "human_input_required"; payload: unknown; cursor?: StreamCursor }
  | { type: "stream_gap"; gap: StreamReplayGapData }
  | { type: "notice"; payload: unknown; cursor?: StreamCursor }
  | { type: "error"; error: StreamEngineError; cursor?: StreamCursor }
  | { type: "done"; cursor?: StreamCursor }
  | { type: "aborted" }
```

#### 4.1.3 旧来源位置的处理

> ⚠️ **两处来源位置,旧文写错了(实测更正),D22 后仍要吸收其语义**:
>
> | 旧文 | 实测 | 影响 |
> | --- | --- | --- |
> | `gap-recovery.ts ← recoverStreamReplayGaps(原样搬)` | 它在 **`core/api/api-client.ts:236`,是 `async function*` 且没有 `export`** | 不能搬 SDK wrapper,但必须复刻 **gap 帧拦截 + durable state reload + 5 次恢复预算 + tail resume** |
> | `coalesce.ts ← decideCoalesce(原样搬)` | 它在 **`core/threads/hooks.ts:1012`**,与 `STREAM_RENDER_COALESCE_MS`(:998)同处,而该文件在旧计划里是「不复制」的 | 若照旧文执行,会**从一个说好不复制的文件里搬东西** —— D13 的 §3.1.3 已把它明确安置到 `threads/coalesce.ts` |

接口草案:
```ts
interface ThreadStreamEngine {
  // 快照读取(适配层用它接框架响应式)
  getSnapshot(): { messages, values, isLoading, error }
  subscribe(listener: () => void): () => void

  // 命令
  submit(input, options): Promise<void>
  stop(): Promise<void>
  join(runId, lastEventId): Promise<void>

  // 生命周期事件(对应现有 5 个回调)
  on(event: "created"|"update"|"custom"|"error"|"finish", handler): void
}
```

**必须原样复刻的语义**(红线 T1–T8、S1–S5):
- 手写 `createRunStream()` / `joinRunStream()` 仍保持 **lazy AsyncIterable/generator** 语义(T1),但不调用 SDK
- `join` 前的终态短路(T2)
- `gap` 帧拦截 + 5 次恢复预算(T3/T4)
- 409 多分支的区分处理(T5):不可把 inactive stream、已终止 cancel、跨 worker active 混为一类
- stream mode 白名单 throw(T6)、`streamResumable` 剥离(T7)
- `reconnectOnMount`、`fetchStateHistory: { limit: 1 }` 等 UI 语义保留,实现改为手写 REST wrapper
- `Content-Location` 解析 run metadata;`Last-Event-ID` 续接;`end`/heartbeat/gap 处理
- **`throttle` 的合并语义(S1)** —— 见下

⚠️ **S1 在 Vue 下会变形,这是本件最大的技术难点**。React 版依赖
"同一 macrotask 内的流事件合并为一次 React 通知";Vue 的批处理基于 `nextTick`
微任务队列,时序语义不同。不能直接假设 Vue 的默认批处理等价于 SDK 的 `throttle: true`。
**建议**:在 engine 层自己实现合并(而非依赖框架批处理),这样行为不受 Vue 调度器影响,且可在 node 环境单测。
`STREAM_RENDER_COALESCE_MS = 80` 的 `decideCoalesce` 逻辑正好可以承担这个角色。

#### 4.1.4 P0/P3 验证口径

P0 不写完整业务,但必须先把协议边界测实:

1. **DeerFlow Gateway fixture**:覆盖 `metadata`、`messages`、`values`、`custom task_*`、`gap`、`end`、heartbeat、409 三分支。
2. **非 LangGraph fixture**:用同一套 canonical reducer 喂一个未来 native 后端形态,证明 UI/store 不依赖 LangGraph event 名。
3. **Nitro proxy fixture**:继续执行 R16,确认 `routeRules` 代理不缓冲 SSE。
4. **反向验证**:删掉 `id:` 或把 `messages` 误写成 `messages-tuple`,adapter 单测必须红。

**估算**:4–6 周。**建议先做,且用 node 环境单测覆盖到位** —— 这是最值得投测试的地方,
因为它的 bug 表现为"偶发的消息顺序错乱",极难在 E2E 里定位。

#### 🔴 4.1.5 D22 的隐藏工作面:`Message` 类型模型(v4 新增)

> **D21 和 D23 都精确量化了自己的类型面(`ai` 6 处、`@langchain/core` 1 处),
> D22 没有。** §2.8.1 论证的是**值引用**(「唯一值引用是 `useStream`,正是要重写的 670 行」)——
> 这句话是对的,但它**回答的是"能不能删",不是"删了要补多少"**。

##### 实测:SDK 供给的类型渗透到 27 个文件

```bash
grep -rl "@langchain/langgraph-sdk" frontend/src | wc -l          # → 27
grep -rhoE 'import (type )?\{[^}]*\} from "@langchain/langgraph-sdk[^"]*"' frontend/src \
  | sed -E 's/.*\{([^}]*)\}.*/\1/' | tr ',' '\n' | sed 's/^ *//;s/^type //' | sort | uniq -c | sort -rn
```

| 符号 | 文件数 | 性质 |
| --- | ---: | --- |
| 🔴 **`Message`** | **19** | **核心域类型** —— 消息数组、分组、历史合并、导出、usage、subtask 全靠它 |
| `AIMessage` | 4 | `Message` 联合的一支 |
| `BaseStream` | 4 | 其中 3 处是 `import type`,由 `ThreadStreamEngine` 自己导出等价类型即可 |
| `ThreadsClient` | 3 | 手写 REST wrapper 替代 |
| `ThreadState` / `Thread` / `Run` | 各 1 | 手写最小结构 |
| `useStream` | 1 | ✅ §4.1 已认领的 670 行 |

##### 🔴 为什么这不是"再写一个 `ToolCall`"

D23 的 `ToolCall` 是 `{ name; args; id? }` —— 三个字段,一处使用面。
**`Message` 不是**。它至少要覆盖(依据 `frontend/AGENTS.md` 与 core 实际读取面):

| 必须覆盖 | 谁在用 |
| --- | --- |
| `type` 判别(`human` / `ai` / `tool` / `system`)+ 联合收窄 | `messages/utils.ts` 的全部分组逻辑 |
| `content` **多态**(`string` \| content-block 数组) | 渲染、导出、`user-message-plain-text` spec |
| `additional_kwargs` | `turn_duration`(run-duration)、`hide_from_ui`(human-input 回复)、`subagent_model_name` / `subagent_token_usage`(subtask 卡) |
| `tool_calls` / `invalid_tool_calls` | `assistant:processing` 分组、步骤时间线 |
| `artifact`(ToolMessage) | `human_input` 协议 v1/v2 载体 |
| `response_metadata` / `usage_metadata` | token usage 折叠 |
| `id` 的可空性与去重语义 | 历史合并 `mergeMessages`(C 类红线 S7–S10) |

> 🔴 **约束比 D21/D23 强一档**:这个类型不是"给自己看的",
> **它必须与 Gateway 实际吐出的 wire format 结构兼容** ——
> 写窄了运行时拿不到字段,写宽了 `mergeMessages` 的收窄逻辑会失效。
> **它是 §4.1.1 那张 wire contract 表在类型系统里的投影。**

##### 落点与估算

| 项 | 内容 |
| --- | --- |
| **文件** | `app/core/agent-types.ts`(D23 的 `ToolCall` 已在此)+ 新增 `app/core/message-types.ts` |
| **阶段** | 🔴 **P1**(不是 P3)—— **13 个 DETYPED 件(§3.1.4)要 import 它,不先有它 P1 就走不完** |
| **估算** | **2–3 天**(类型定义 1 天 + 用 §4.1.4 的 Gateway fixture 做结构对齐验证 1–2 天) |
| **验收** | 🔴 **反向验证**:把 `content` 从 `string \| ContentBlock[]` 收窄成 `string`,
`messages/utils.ts` 的分组单测**必须红**;删掉 `additional_kwargs.turn_duration`,run-duration 单测**必须红** |
| **风险** | 已并入 **风险 R17**(拆分/搬运引入语义漂移)。⚠️ 不新增风险编号 —— 它的失败形态与 R17 同型 |

> 📌 **对 §7 的影响**:P1 从 **1–2 周** → **1.5–2.5 周**(+2–3 天)。
> 落在区间噪声内,**§7 的 27–48 周不变**,但 P1 的下界要抬。

---

### 4.2 `streamdown-vue` — 流式 Markdown 渲染器(最高风险)

**现状拆解**(实测 `streamdown@2.5.0` 依赖):

| 组成 | 是否框架无关 | 处理 |
| --- | --- | --- |
| `remark-parse` → `remark-gfm` → `remark-rehype` → `rehype-raw`/`-sanitize`/`-harden` | ✅ 全部框架无关 | **直接复用整条 unified 管线** |
| `marked` / `unist-util-visit(-parents)` | ✅ | 复用 |
| `remend@1.3.0` | ✅ 独立包 | **复用**(流式 markdown 残缺修补) |
| `mermaid@11` | ✅ | 复用,需自写 Vue 挂载 |
| **`hast-util-to-jsx-runtime`** | 🔴 ~~❌ React 专有~~ → ✅ **v4 实测:框架无关**(`peerDependencies` 为 `null`,依赖里无 react) | ✅ **很可能直接接 `vue/jsx-runtime`,不必自研** —— 见 **§4.2.5** |
| **`animated` / `isAnimating` 逐词动画 API** | ❌ | 🔴 自研 |

**好消息**:真正 React 专有的只有**动画 API**;
整条解析管线 + 残缺修补 + mermaid 可以复用,
🔴 **而 v4 实测后,连"渲染末端"这一条也很可能不成立**(§4.2.5)。

#### 4.2.1 `core/streamdown/` 的可搬性(实测逐文件)

⚠️ **旧文只提了 `preprocess.ts`(389 行),实际是 5 个文件 624 行**,可搬性不一致:

| 文件 | 行 | 可搬性 | 说明 |
| --- | --- | --- | --- |
| `preprocess.ts` | 389 | ✅ **纯 TS,原样搬** | `stripLeakedSystemTags` / `capMarkdownNesting` / `normalizeStreamdownMathMarkdown` |
| 🔴 `plugins.ts` | 98 | ⚠️ **要改 3 行 import,不能原样搬** | 自身逻辑框架无关(含自写 rehype 插件 `rehypeStreamingListItems()`、`streamdownWordAnimation` / `streamdownSmoothStreamingAnimation` 两组动画配置,**红线 R5 的直接相关物**),**但它 import 了三个 React 耦合物**:`@streamdown/code`、`@streamdown/mermaid`(两者 `peerDependencies` 均为 `react`)、以及 `import type { StreamdownProps } from "streamdown"`。<br>✅ **处置很简单**:那两个包只是 `shiki` / `mermaid` 的 React 包装 → **直接依赖底层库**;`StreamdownProps` 换成 streamdown-vue 自己的类型 |
| `mermaid.ts` | 98 | ✅ 纯 TS | 挂载方式需换 Vue |
| `index.ts` | 5 | ✅ | 桶文件 |
| 🔴 `safe-children.ts` | 34 | ⚠️ **必须拆** | **2 个纯函数 + 2 个 React hook 包装**:`getSafeStreamdownMarkdown` / `getSafeStreamdownChildren` 是纯的可搬;`useSafeStreamdownChildren` / `useSafeStreamdownMarkdown` 只是 `useMemo` 外壳 → **Vue 侧改 `computed`**。属 D13 的 **SPLIT** 类,进 Tier 2 导出级比对 |

✅ **R6 的数据层可整个搬**:`core/citations/sources.ts` **123 行、零 React 引用**(实测)。
React 专有的只是「从 children 树推导标签」那一步,不是引文数据本身。

#### 4.2.2 接口草案

```ts
// app/core/streamdown/render.ts —— 纯 TS,不 import vue
//   把 hast 树转成一个框架无关的渲染指令树,Vue 层只负责 h() 化
interface HastRenderPlan {
  toRenderTree(hast: Root, opts: RenderOptions): RenderNode
}
type RenderNode =
  | { kind: "element"; tag: string; props: Record<string, unknown>;
      key: string;               // 🔴 稳定 key,R5 的载体(见 4.2.3)
      children: RenderNode[] }
  | { kind: "text"; value: string; key: string }
  | { kind: "custom"; name: "mermaid" | "code-block" | "citation";
      payload: unknown; key: string }
```

```vue
<!-- app/components/streamdown/StreamdownRoot.vue —— 唯一的 Vue 边界 -->
<script setup lang="ts">
const props = defineProps<{
  content: string           // 对应 React 版的 children(string)
  animated?: boolean        // 逐词动画开关
  plugins?: PluginSet       // streamdownPlugins / reasoningPlugins
}>()
// 渲染:h() 递归消费 RenderNode,key 直接取 node.key
</script>
```

> 🔴 **设计要点:把「hast → 渲染指令树」和「渲染指令树 → vnode」切开。**
> 前者纯 TS、可 node 环境单测(**稳定 key 的生成逻辑就能脱离浏览器测**);
> 后者是 20–30 行的 `h()` 递归。R5 的正确性因此变成一个**可单测的纯函数性质**,
> 而不是"只能靠肉眼看动画有没有重播"。

#### 4.2.3 逐条红线对应(渲染层 R1–R9 中落在本件的 4 条)

> ⚠️ 编号是**红线**编号(渲染层),不是风险编号 —— 见 §5 图例。

| 红线 | 内容 | 在本件里怎么落地 |
| --- | --- | --- |
| 🔴 **R5** | 不得重新引入"逐词包裹"的 rehype 插件 | **不在 rehype 层做动画**。`RenderNode.key` 由「块内偏移 + 内容哈希」生成,保证增长块重解析后**旧节点 key 不变** → Vue 复用 DOM,CSS 动画不重播。`plugins.ts` 里那两组动画配置只提供参数,不参与分词 |
| 🔴 **R6** | 引文标签须从完整 children 树推导 | 数据层 `core/citations/sources.ts` 原样搬(123 行纯 TS)。推导改在 **`HastRenderPlan` 阶段**做 —— 那时拿到的是完整 hast 树,**比 React 在 children 上推导更稳**(React 版在流式期间 children 可能是 element/数组,正是 R6 的破坏场景) |
| **R4** | HTML 预览须过 `preview.ts` 完整性检查 | 复用现有 `preview.ts`;`kind:"custom"` 分支挂载前必须先过检查 |
| **R3** | 渲染流式写入时不排定时器 | `StreamdownRoot.vue` 内**禁止 `setTimeout`/`setInterval`**;mermaid 等异步挂载走 `onScopeDispose` 清理 |

#### 4.2.4 一处 React 专有物:ErrorBoundary

`ai-elements/streamdown.tsx`(72 行)是个 **React class 组件 ErrorBoundary**
(`Component` + `getDerivedStateFromProps`),职责是:**渲染崩溃时回退到上一次成功的 raw 文本**,
避免一次解析异常炸掉整个消息列表。

**Vue 无对应物** → 用 `onErrorCaptured` 重写。⚠️ 语义差异需注意:
React 的 `getDerivedStateFromProps` 在**每次 props 变化**时同步比对 `prevRaw`;
Vue 的 `onErrorCaptured` 是**错误发生时**触发。要保持"回退到上一次成功值"的行为,
需在组件内自己维护 `lastGoodContent` ref。

**估算**:5–8 周(⚠️ **v4:上界可能显著下修,取决于 §4.2.5 的 P0 实验结果**)。
**这是全案最高风险项**,因为流式 markdown 的视觉质量是产品体验核心,
且"动画重播"这类问题只在真实流式下暴露。

> ✅ **4.2.2 的分层设计降低了这个风险**:R5 从"只能靠肉眼验"变成"key 生成是纯函数、可单测"。
> 但**视觉质量本身仍然只能人工比对** —— 这与风险 R18(D15 视觉漂移)是同一个缺口,
> 下面的视觉对比工具建议同时服务两者。

**建议**:P4 开始时先做一个**独立的视觉对比工具** —— 同一份流式 markdown 输入,
React 版与 Vue 版并排渲染,人工逐帧比对。这比事后靠 spec 发现问题便宜得多。

#### 🔴 4.2.5 v4 实测更正:`hast-util-to-jsx-runtime` 不是 React 专有

> **本方案把 P4 定为"全案最高风险、5–8 周",而它的成本论证有两根支柱:
> ①「渲染末端 hast → vnode 要自研」②「逐词动画 API 要自研」。
> 🔴 实测后第 ① 根不成立。**

##### 实测证据

| 项 | 实测结果 |
| --- | --- |
| `hast-util-to-jsx-runtime` 版本 | **2.3.6**(`frontend/node_modules` 里就是这个版本) |
| `peerDependencies` | 🔴 **`null`** —— **没有任何 peer** |
| `dependencies` | 15 个,全是 `@types/hast` / `property-information` / `style-to-js` / `comma-separated-tokens` 等**框架无关**工具,**没有 react** |
| 它怎么工作 | **JSX-runtime 注入式**:`Fragment` / `jsx` / `jsxs` 三个函数**由调用方传入**(`lib/types.d.ts:254/266/270`) |
| 🔴 **Vue 有没有 JSX runtime** | ✅ **有** —— `vue` 的 `exports` 里包含 **`./jsx-runtime`** 与 `./jsx-dev-runtime` |
| 属性名大小写怎么办 | ✅ 它有 **`elementAttributeNameCase: 'html' \| 'react'`**(`lib/types.d.ts:204`)—— **`'html'` 正好产出 Vue 要的 `class` / `for`**,不是 `className` |
| 内联样式怎么办 | ✅ **`stylePropertyNameCase: 'dom' \| 'css'`**(`lib/types.d.ts:239`) |

复现:

```bash
npm view hast-util-to-jsx-runtime peerDependencies dependencies --json && npm view vue exports --json
```

##### 也就是说,渲染末端可能只是一次配置

```ts
import { Fragment, jsx, jsxs } from 'vue/jsx-runtime'
import { toJsxRuntime } from 'hast-util-to-jsx-runtime'

const vnode = toJsxRuntime(hast, {
  Fragment, jsx, jsxs,
  elementAttributeNameCase: 'html',   // class/for,不是 className/htmlFor
  stylePropertyNameCase: 'css',
  components: { code: CodeBlock, /* mermaid、citation 等自定义映射 */ },
})
```

##### ⚠️ 还没验证的三点(所以这是实验,不是结论)

1. **`jsx(type, props, key)` 的调用签名**两边是否完全一致(Vue 的 jsx-runtime 与 React 的形状相近,但要实测)
2. `components` 覆写映射到 **Vue 组件**时,props 传递与插槽语义是否符合预期
3. 🔴 **稳定 key(红线 R5)** —— 该库自己生成 key 的策略,是否满足 §4.2.3「流式追加时旧节点不重挂载」。
   **这条最关键**:若不满足,仍需 §4.2.2 的 `HastRenderPlan` 中间层来接管 key,但**渲染末端本身仍可省**

##### P0 实验(**半天,二元**)

| | |
| --- | --- |
| **做什么** | 起一个最小 Vue 应用,把一段含代码块/表格/数学公式/嵌套列表的 markdown 走 `unified` 管线 → `toJsxRuntime` + `vue/jsx-runtime` 渲染,并**分两次追加内容**观察 DOM 节点是否被重建 |
| **判据(二元)** | ① 能渲染出结构正确的 DOM ② 追加内容时**已有节点不被重挂载**(用 `MutationObserver` 或给节点打标记验证) |
| **成立** | 🔴 **P4 的上界显著下修** —— 只剩逐词动画、mermaid 挂载、ErrorBoundary 三件。**§4.2.2 的 `HastRenderPlan` 可简化或取消** |
| **不成立** | 回到 §4.2.2 的自研渲染指令树方案,**5–8 周不变** —— **代价只有这半天** |

> 🔴 **为什么值得排进 P0**:它满足与其他四个实验相同的判据 ——
> **成本半天、结论二元、失败即改架构**;而它影响的是**关键路径上最贵的一段**(P4,5–8 周)。
> ⚠️ **但注意**:即使成立,**§7 的区间先不要改** —— 按 §7 表下的校准纪律,
> 等 P0 实测结果出来再回推,不要拿"预期会省"去调口径。

---

### 4.3 `ai-elements-vue` — **14** 个组件(D9 后)

无 Vue 对应物。**原 28 个 / 5,374 行,D9 实测 14 个零引用 → 实需重写 14 个 / 3,714 行**(§2.6.1)。

✅ **使用面盘点已完成(2026-07-30 实测),P0 不必重做。**

| 优先级 | 组件(仅列在用的 14 个) | 引用数 | 依据 |
| --- | --- | --- | --- |
| **P0 必需** | `prompt-input`(1,477 行,`InputBox` 基座)、`conversation`、`message`、`streamdown`(壳)、`code-block` | 9 / 4 / 1 / 3 / 1 | 主聊天页无法降级 |
| **P1 必需** | `reasoning`、`task`、`artifact`、`loader`、`shimmer` | 2 / 1 / 1 / 1 / 3 | 核心体验 |
| **P2 视情况** | `chain-of-thought`、`model-selector`、`suggestion`、`queue` | 2 / 2 / 1 / 1 | 引用数均为 1–2,可评估降级 |
| ~~P3 可能可砍~~ | ❌ **已由 D9 全部移除** | 0 | — |

> ⚠️ **原分级有两处实测反转,已修正**:
> ① `sources`、`web-preview` 原列「P1 必需 / 核心体验」→ **实测零引用,已砍**;
> ② `queue` 原列「P3 可能可砍」→ **实际有 1 处引用,必须移植**。
> 教训:原分级是按**组件名推测**的,不是测的。`web-preview` 听起来像浏览器面板核心,
> 实际浏览器面板用的是 `components/workspace/browser-view/`,与它无关。

#### 4.3.1 逐组件行数与耦合实测

| 组件 | 行 | 占比 | Radix | 备注 |
| --- | --- | --- | --- | --- |
| 🔴 **`prompt-input`** | **1,477** | **40%** | — | **不是一个组件,是 41 个组件的复合族**(见 4.3.3) |
| `message` | 449 | 12% | — | |
| `queue` | 274 | 7% | — | |
| `reasoning` | 239 | 6% | ✅ 1 | |
| `chain-of-thought` | 239 | 6% | ✅ 1 | 含 `isValidElement(Icon)` —— React 专有的 children 内省,需改 Vue slot |
| `model-selector` | 208 | 6% | — | |
| `code-block` | 179 | 5% | — | |
| `artifact` | 150 | 4% | — | |
| `conversation` | 100 | 3% | — | |
| `loader` / `task` / `suggestion` / `streamdown` / `shimmer` | 96/87/80/72/64 | 11% | — | 小件 |
| **合计** | **3,714** | 100% | **2 处** | ✅ 与 §2.6.1 的 D9 实测一致 |

#### 4.3.2 ✅ Radix 依赖实际为零(实测澄清)

表面看有 2 个组件依赖 Radix,但实测两处**是同一个东西**:

```
reasoning.tsx:3        import { useControllableState } from "@radix-ui/react-use-controllable-state";
chain-of-thought.tsx:3 import { useControllableState } from "@radix-ui/react-use-controllable-state";
```

这**不是 UI 原语,是个受控/非受控状态助手 hook**。
**Vue 有原生等价物:`defineModel()`(Vue 3.4+)** —— 语义几乎一一对应。

> ✅ **结论:`ai-elements` 这 14 个组件对 Radix 的真实依赖是 0。**
> 它们与 D2(antdv 替换 Radix)那条线**完全解耦** —— P5 不会因为 antdv 的 role 对齐问题受阻。
> 这是本次深化里最实的一条好消息。

#### 4.3.3 🔴 `prompt-input` 是复合组件族,且**跨阶段依赖 P2 的缺口件**

实测 **81 个导出 / 41 个组件**,分 7 个子族:

```
PromptInput / Body / Textarea / Header / Footer / Tools / Button   ← 骨架
PromptInputAttachment* (4)      ← 附件
PromptInputActionMenu* (4)      ← 动作菜单   → 依赖 ui/dropdown-menu
PromptInputSelect* (5)          ← 下拉       → 依赖 ui/select
PromptInputHoverCard* (3)       ← 悬浮卡     → 依赖 ui/hover-card
PromptInputTab* (5)             ← 标签页
🔴 PromptInputCommand* (7)      ← 命令面板   → 依赖 ui/command
PromptInputSubmit / SpeechButton
```

**14 个 ai-elements 对 `ui/` 原语的全部依赖**(实测 24 处 / 12 种):

| ui/ 原语 | 引用 | antdv 对应 | 风险 |
| --- | --- | --- | --- |
| `button` | 7 | `a-button` | ✅ |
| `collapsible` | 4 | `a-collapse` | ✅ |
| `tooltip` / `scroll-area` | 2 / 2 | `a-tooltip` / 自研 | ✅ |
| 🔴 **`command`** | **2** | ❌ **无对应,是 §2.3.2 的缺口件** | 🔴 **见下** |
| `select`/`input-group`/`hover-card`/`dropdown-menu`/`dialog`/`button-group`/`badge` | 各 1 | 多数有对应 | ⚠️ `input-group`/`button-group` 需确认 |

> 🔴 **跨阶段依赖(本次深化新发现,原方案未标注)**:
> **`prompt-input`(P5,最大件)硬依赖 `command`(P2 的缺口件,antdv 无对应需重写)。**
>
> 后果:**P2 的 `command` 若做得不到位,P5 会被堵住** —— 而 P5 是 7–11 周的关键路径末端,
> 那时返工代价最高。
>
> **处置**:① 把 `command` 的验收标准提前到 **P2 出口条件**,而不是"P2 里做掉就行";
> ② P2 做 `command` 时,**直接拿 `prompt-input` 的 7 个 `PromptInputCommand*` 用法当验收用例**,
> 不要只按 `ui/command` 自身的 API 验;③ 已在 §6 的 P2 交付项与 P5 前置条件里各加一条。

#### 4.3.4 接口草案(以最大件为例)

```ts
// app/components/ai-elements/prompt-input/  —— 按子族拆目录,不要单文件 1,477 行
//   Vue 侧用 provide/inject 承接 React 的 PromptInputProvider
interface PromptInputContext {
  attachments: Ref<Attachment[]>
  addAttachments(files: File[]): void
  removeAttachment(id: string): void
  submit(): void
  // 🔴 受控/非受控:React 用 @radix-ui/react-use-controllable-state
  //    Vue 用 defineModel() —— 见 4.3.2
}
```

**估算**:含在 P5。原估 6–10 周,按行数下降 31% 保守下调至 **5–9 周**
(不按 31% 线性折算 —— 砍掉的 11 个小件平均仅 60 行,省的密度低于平均)。

> ✅ **4.3.2 的发现(Radix 依赖为零)支持维持 5–9 周,不必上浮**:
> 原先担心的「antdv role 对齐问题会波及 ai-elements」不成立。
> ⚠️ **但 4.3.3 的跨阶段依赖是新增风险**,已登记为 **风险 R19**(§8)。

---

### 4.4 ~~`ServerStateClient` — 自研服务端状态层(D24)~~ → 🔴 **已存档,不执行(D24-a)**

> 🔴 **2026-07-31 v4:D24 已被 D24-a 推翻 —— Vue 版装 `@tanstack/vue-query`,不自研。**
> 判据(Vue 对应物零 React 依赖 / 自研面比 D24 描述的大 / 本节是全案唯一没有量级的自研件 /
> 参照工程证据被用反)见 **§2.8.7**。
>
> **本节保留的理由只有一个**:🔴 **§4.4.1 的「当前 React 使用面」表仍然有效** ——
> 它是 P2 迁移 16 个薄 `hooks.ts` 时的**逐项对照清单**,只是右列的"Vue 侧最小实现"
> 现在读作"**对应的 vue-query API**"而不是"自研 API"。
> §4.4.2(自研 API 草案)/ §4.4.3(明确不做)/ §4.4.4(自研 contract fixture)**均不执行**。
>
> ⚠️ **§4.4.3「明确不做」里有一条要单独拎出来,它在 D24-a 之后仍然成立**:
> **不把 thread 流式状态放进 server-state** —— D22 的 `ThreadStreamEngine` 独立持有流状态,
> 不要因为装了 vue-query 就顺手把流塞进 query cache。这条现在是 **§3.3.1 的 store 作用域约定**的一部分。

**~~目标(D24)~~**:~~Vue 版不装 `@tanstack/vue-query`,但必须保留 React 版当前服务端状态语义。~~
~~这不是流处理,也不是 Pinia 全局业务状态;它负责**普通 HTTP 请求的缓存、失效、分页与局部写缓存**。~~

#### 4.4.1 ✅ 当前 React 使用面(实测)—— **本表在 D24-a 之后仍然有效,是 P2 的迁移对照清单**

| 能力 | 次数 | 当前使用面 | ✅ **D24-a 后的 Vue 侧落点** |
| --- | --- | --- | --- |
| `useQuery` | **38** | agents / skills / memory / mcp / models / artifacts / uploads / scheduled-tasks / channels / features / suggestions / workspace-changes 等 | `useQuery`(vue-query,**同名同义**) |
| `useMutation` | **40** | create/update/delete/publish/connect/upload 等写操作 | `useMutation` |
| `useInfiniteQuery` | 3 | thread history / thread search 分页 | `useInfiniteQuery` |
| `useQueryClient` | 41 | 组件和 composable 内拿客户端 | `useQueryClient` |
| `invalidateQueries` | **57** | mutation 后刷新 thread / agents / scheduled-tasks / channels 等 key | `invalidateQueries`(prefix match 是**内置语义**,不必自己实现) |
| `setQueryData` | 8 | memory / lark integration 等乐观或同步写缓存 | `setQueryData` |

**选项面**(同一批文件内实测):`enabled` **48** / `staleTime` 9 / `retry` 9 /
`refetchOnWindowFocus` 8 / `refetchOnMount` 2 / `refetchInterval` 2 / `select` 2。

> 🔴 **P2 迁移时唯一真正要动脑子的是 `enabled` 那 48 处** ——
> React 里它常是一个普通布尔表达式,**Vue 里必须是 `computed` / `ref`(响应式)**,
> 否则 query 不会随依赖变化重新启用。这是 React→Vue 迁移 query 层最常见的一类静默 bug,
> 建议做成 `tests/guards/` 的一条机械检查(禁止给 `enabled` 传裸布尔字面量以外的非响应式表达式)。

实测依据:`frontend/src` 中 **16 个文件** import `@tanstack/react-query`;参照工程
`nuxt-modern-starter` 实测不用 TanStack Query,但 DeerFlow 的使用面大于该参照工程,所以不能只靠 Pinia + 裸 api 函数临时拼。

#### 4.4.2 最小 API 草案

```ts
type QueryKey = readonly unknown[]

interface ServerStateClient {
  getQueryData<T>(key: QueryKey): T | undefined
  setQueryData<T>(key: QueryKey, value: T | ((old: T | undefined) => T)): void
  invalidateQueries(options: { queryKey?: QueryKey; exact?: boolean }): Promise<void>
  cancelQueries(options: { queryKey?: QueryKey; exact?: boolean }): Promise<void>
  subscribe(key: QueryKey, listener: () => void): () => void
  fetchQuery<T>(options: ServerQueryOptions<T>): Promise<T>
  fetchInfiniteQuery<TPage>(options: ServerInfiniteQueryOptions<TPage>): Promise<InfiniteData<TPage>>
}
```

```ts
function useServerQuery<T>(options: ServerQueryOptions<T>): {
  data: Ref<T | undefined>
  isLoading: Ref<boolean>
  isPending: Ref<boolean>
  error: Ref<unknown>
  refetch: () => Promise<T>
}
```

#### 4.4.3 明确不做

- 不做 SSR `hydrate` / `dehydrate` —— D20 后产品区全 CSR,这条复杂度没有收益。
- 不做 TanStack devtools、retry/backoff 全家桶、focus/reconnect 自动 refetch,除非 React 现状有明确使用。
- 不把 thread 流式状态放进 server-state;D22 的 `ThreadStreamEngine` 独立持有流状态。
- 不把所有业务状态塞进 Pinia;Pinia 负责 UI/session/thread 作用域状态,server-state 负责 HTTP cache。

#### 4.4.4 P0 验证口径

P0 先写 `server-state` contract fixture,不接 UI:

1. 相同 key 的并发 `fetchQuery` 只发一次请求,两个订阅者都收到同一结果。
2. `invalidateQueries({ queryKey: ["threads"] })` 能命中 `["threads","search"]` 这类前缀 key。
3. `setQueryData(["memory"], updater)` 后订阅者同步更新。
4. infinite query 能追加 page,并保留 `pageParams`。
5. mutation `onSuccess` 里触发 invalidate / setQueryData 的顺序与当前 React 语义一致。
6. 反向验证:把 prefix match 改成 exact-only,threads / scheduled-tasks 的失效测试必须红。

**估算影响**:D24 属于新增自研基础设施,不改变已定的流处理目标,但会把一部分原本“低风险替换包”的工作量转成 P0/P2 的可测试基础层。具体周数等 P0 contract fixture 后再回填,避免现在拍脑袋加账。

## 5. 44 条红线不变量的移植分类

这是本方案技术含量最高的部分。10 号文档整理的 **44 条**不变量,在 Vue 下**不是等价移植** ——
必须分三类处理。**评审时请重点看这一节。**

> 🔴 **v3 修正:总数是 44,不是 37。** 实测 10 号文档 §10.3 逐行统计:
> **T8(传输层)+ S12(编排与状态)+ R9(渲染层)+ P6(面板布局)+ A9(协议与安全)= 44**。
> 旧版三类标称 `5 + 8 + 24 = 37`,**三个数字全部与实际不符**,且漏掉了 **S3/S4/S5** 三条:
>
> | 类 | 旧标称 | 实际(编号红线) | 差因 |
> | --- | --- | --- | --- |
> | A | 5 | **3** | 表里另 2 行(`useRef` 反模式、`useCallback`/`useMemo` 包裹)是**泛化 React 模式,不是编号红线** |
> | B | 8 | **12** | `P2–P5` 那一行是** 4 条合并写的**;且本轮补入漏掉的 **S3/S4/S5** |
> | C | 24 | **29** | 正文枚举的是 `T1–T8`(8)+`A1–A9`(9)+`S7–S10`(4)+`R1/R4/R5/R6/R7/R8`(6)+`P1/P6`(2)=**29**,与标称的 24 从来没对上 |
> | **合计** | 37 | **3 + 12 + 29 = 44** ✅ 闭合 |
>
> **S3/S4/S5 此前完全没有归类**(S3 是 issue #2746 的守护)。
> 它们在 §4.1「必须原样复刻的语义(T1–T8、S1–S5)」里其实有归属,
> **但 §5 的 A/B/C 分类漏了** —— 本轮已补入 B 类。

> 📖 **红线编号图例**(沿用 [10-refactor-hotspots.md](10-refactor-hotspots.md) §10.3 的语义前缀,**不要改**):
> **`T`** 传输层 · **`S`** 编排与状态 · **`R`** 渲染层 · **`P`** 面板布局
>
> 🔴 **注意代号冲突:红线的 `R` 是「渲染层」,§8 风险登记册的 `R` 是「Risk」,两套编号在 `R1`–`R9` 段完全重叠。**
> 例:**红线 R3** = 产物自动打开须在带清理的 effect 里;**风险 R3** = Pinia 单例导致跨 thread 状态泄漏 —— 毫无关系。
>
> 🔴 **`P` 也撞了,而且更隐蔽:红线的 `P` 是「面板布局」,§6 的 `P0`–`P6` 是「阶段」。**
> 全文最容易误读的一句是 §6 P5 里的 **「B 类 12 条红线在此收敛,尤其右面板 P2–P5」**
> —— 这里的 `P2–P5` 指的是**面板布局红线 P2 到 P5**,**不是"第 2 到第 5 阶段"**。
>
> **约定:引用这几类编号时必须写全 ——「红线 R3」/「风险 R3」、「红线 P2」/「阶段 P2」,
> 不得只写 `R3` 或 `P2`。**
> 两边都不重命名的理由:红线编号是 10 号文档的既有资产(且对应真实代码不变量),
> 风险编号在本文档被引用 **146 次**,阶段编号贯穿 §6/§7 全部工期表
> —— 改任何一边的成本都远大于加这条约定。

### A 类:Vue 下自然消失(React 特有问题)—— **3 条编号红线**(+2 项泛化模式)

> ⚠️ 下表后 2 行(`useRef` 反模式、`useCallback`/`useMemo` 包裹)**是泛化的 React 模式,
> 不是 10 号文档的编号红线** —— 旧版把它们计入"5 条",是三类合计对不上 44 的原因之一。

| 红线 | 原问题 | 为何消失 |
| --- | --- | --- |
| **S6** `useUpdateSubtask` 必须基于 `tasksRef` 而非闭包快照 | React 闭包捕获旧状态 | Vue 的 proxy 响应式**没有 stale closure 问题**,直接读 store 即为最新值。⭐ 可简化 |
| **S2** URL 更新必须用 `history.replaceState` 而非 Next router | Next router 导致组件重挂载 | Vue Router 的 `replace` 不重建组件树。⚠️ **但需实测验证**,Nuxt 的页面组件 key 策略可能仍触发重建 |
| **R9**(渲染层) MessageGroup 查表每组只建一次 | React 每次 render 重算 | Vue `computed` 天然缓存。⭐ 可简化 |
| 部分 `useRef` 反模式 | 为避免重渲染而用 ref | Vue 用 `shallowRef`/`markRaw` 表达更自然 |
| `useCallback`/`useMemo` 包裹 | React 引用稳定性 | Vue 不需要 |

> ⚠️ 「自然消失」**不等于「不用测」**。S2 必须实测确认 Vue Router 行为,
> `chat-thread-init-ordering.spec.ts` 是它的守门人。

### B 类:变形重现 —— 需重新设计,问题仍在 —— **12 条编号红线**(+1 项非编号)

**这一类最危险**:容易因为"React 的坑"而误判为不适用,实际上以新形式存在。
**§5.2 有逐条的 PR 验证清单。**

| 红线 | 原形式 | Vue 下的新形式 |
| --- | --- | --- |
| **S1** `throttle` 只能布尔档 | SDK 数字档是尾部去抖 → UI 饿死 | Vue 的 `nextTick` 批处理时序与 React macrotask 不同。**必须在 engine 层自实现合并**(见 §4.1) |
| 🔴 **S3** `isNewThread=true` 期间不能把 thread id 传给 SDK | SDK eagerly fetch `/history`,thread 不存在 → 报错(**#2746**) | **v3 补入(此前完全没归类)**。约束来自 SDK 行为,与框架无关 → **但下达该约束的是重写的引擎**(§4.1),必须在新引擎里重新实现并测 |
| 🔴 **S4** 不能把字面量 `"new"` 传给 `useStream` | 422 | **v3 补入**。同上:守卫逻辑随引擎重写 |
| 🔴 **S5** 停止后需**立即失效 + 1.5s 后补拉一次** | 拿到 finalize 之前的旧标题 | **v3 补入**。React 版靠 `setTimeout` + query 失效;Vue 侧时序载体变了,**这条最容易被"顺手优化掉"** |
| **R2**(渲染层) loading 中纯内容 AI 消息留在 processing 组 | React 分组时机 | 逻辑在复制来的 `app/core/messages/utils.ts`(纯函数),可搬;但**触发重算的时机**依赖响应式追踪,需验证 |
| **R3**(渲染层) 产物自动打开须在带清理的 effect 里 | React `useEffect` + cleanup | Vue `watchEffect` + `onScopeDispose`。语义相近但**清理时机不同**,需重测 |
| **P2 / P3 / P4 / P5**(面板布局,**这是 4 条不是 1 条**) 右面板的 collapse/resize/动画/`0%` 判定 | react-resizable-panels 的 imperative handle | Vue 侧换库 → **整套交互逻辑重新实现**。issue #4465 那类 bug 会重现。`artifact-panel-resize.spec.ts` 是守门人。⚠️ **旧版把 4 条并成一行写作 `P2–P5`,是 B 类标称 8 与实际不符的主因之一** |
| **S11** `safeLocalStorage` 吞存储异常 | 异常冒进 React render | Vue 的 render 同样会被异常打断。**必须原样保留门面** |
| **S12** goal/compact 请求绑 `AbortController` | 组件卸载时中止 | Vue `onScopeDispose`。**Pinia store 是单例,不随组件卸载** → 需显式管理 |
| 跨 thread 状态清理<br>*(非编号项 —— 不在 10 号文档的 44 条里,是本方案识别的新增关切)* | ⚠️ **旧文写「Provider 卸载自动清」,实测是错的** —— layout 无 `key`,App Router 复用,重置来自 `chat-box.tsx:81` 的手写哨兵 + `artifacts/context.tsx:89-101` 的 pathname 水合 effect(后者为 main `0d8e11ad` 新增) | **Pinia 单例需显式 reset**。✅ **v3 已补完整设计:§3.3.1**(store 三分类 + 五条约定 + 守护测试)。~~遗留 O17~~ → ✅ **O17 已于 2026-07-31 关闭**(上游 `context.tsx:98` 已把 `autoOpen` 重置回 `true`,见 D18) |

### C 类:与框架无关,原样保留 —— **29 条**

`T1–T8`(传输层,8)+ `A1–A9`(协议与安全,9)+ `S7/S8/S9/S10`(历史合并语义,4)
+ `R1/R4/R5/R6/R7/R8`(渲染语义,6)+ `P1/P6`(2)= **29**。
⚠️ **旧版标称 24,与这份枚举从来没对上**(v3 已按实际枚举更正)。

这些逻辑都住在**复制过来的 `app/core/` 纯函数里**,或是**与后端的协议契约**。

> 🔴 **但「搬过去就对」这个措辞过强,v3 修正如下 —— 这直接影响 PR 检查怎么做。**
>
> 实测 T 类的实现位置:`TERMINAL_RUN_STATUSES`(**T2**)在 `api/api-client.ts:63`、
> gap 拦截与预算(**T3/T4**)在 `api/api-client.ts:236`、`streamResumable` 剥离(**T7**)
> 在 `api/stream-mode.ts:41` —— **确实都在复制层**,分类没错。
>
> **但调用方是重写的引擎**:`threads/hooks.ts:2017/2135` 在设 `streamResumable`,
> 而该文件按 D13 要拆进 `ThreadStreamEngine`(§4.1)。
>
> **所以准确的说法是:复制保证了「实现还在」,不保证「新引擎仍然正确地路过它」。**
> → C 类的 PR 检查**不是**"你复制了吗"(那是 `core-provenance.test.ts` 的职责),
> 而是**"新引擎是否仍然经由这些包装,而不是绕过去直接调 SDK"**。
> §4.1 把 T1–T8、S1–S5 列为"必须原样复刻的语义"、P3 要求 node 环境单测覆盖它们,
> 讲的正是这件事 —— **两处口径至此对齐**。

⚠️ **D7 的长期代价落在这 24 条上**:它们在 `frontend/src/core` 与
`frontend-vue/app/core` 各有一份。React 侧若修了某条(如上游回填),
Vue 侧不会自动获得 —— 但 **D12 的 `core-provenance.test.ts`(§3.1.2)会在下一次 `make verify` 就报红**,
强制做出「同步 or 记录豁免」的决定,不再是悄悄失同步。
**这是 D7 最实质的技术债,建议在 v2 重新评估共享包方案(§3.1.1)。**

### 5.1 结论

| 类别 | 条数 | 含义 |
| --- | --- | --- |
| A 自然消失 | **3** | 可简化,但需实测确认(另有 2 项泛化 React 模式,不计入编号红线) |
| B 变形重现 | **12** | 🔴 **需重新设计,最高风险** —— 逐条 PR 检查见 **§5.2** |
| C 原样保留 | **29** | 由**复制来的 `app/core/`** 承载。⚠️ 复制保证「实现还在」,不保证「新引擎仍路过它」 |
| **合计** | **44** | ✅ 与 10 号文档 §10.3 逐行统计闭合 |

**29/44 条住在纯 TS 层里** —— 这是「复制 `core/`」这一步的价值量化:
这 29 条不用在 Vue 侧重新踩一遍。

> ⚠️ **旧版此处写「24/37」,两个数都错**(见本节开头的修正表)。
> 更正后比例反而更好看:**66% 的红线由复制承载**,而不是 65%。
> 但**别把这当成利好** —— 真正的风险从来在 B 类那 12 条,
> 而 B 类的实际条数比旧版标称的 8 条**多了 50%**。

---

### 5.2 B 类 12 条的 PR 验证清单(可直接贴进 PR 模板)

> 🔴 **为什么必须有这个清单**:D11 已定**不做 CI**,门禁全靠人(风险 R14)。
> B 类是"**真正的技术风险所在**",但此前每条只有一句话描述 ——
> **红线只有变成可勾选的动作才真正生效。**
>
> 📖 每条给三样东西:**怎么验证**(具体动作)、**能否机械化**、**守门人**。
> ⚠️ 编号是**红线**编号,不是风险编号,也不是阶段编号(见 §5 开头图例)。

#### 🤖 可机械化的 6 条 —— 优先做成测试,别靠人眼

| # | 红线 | 怎么验证(具体动作) | 守门人 |
| --- | --- | --- | --- |
| 1 | **S1** engine 层自实现合并 | **node 单测**:以 10ms 间隔喂 100 个 chunk,断言 ① 订阅者通知次数 **< 100**(证明合并生效)② 最后一帧内容完整 ③ **相邻两次通知间隔 ≤ `STREAM_RENDER_COALESCE_MS`(80ms)**(证明不是尾部去抖、UI 不饿死)<br>🔴 **必须断言到时间分布上** —— 只断言"最终内容对"在饿死的实现下也会通过 | `tests/unit/stream/coalesce.test.ts`(新增) |
| 2 | **S3** `isNewThread` 期间不传 thread id | **node 单测**:构造 `isNewThread=true`,断言传给 SDK 的 `threadId === undefined`<br>**+ 守护测试**:`grep` 引擎源码,`isNewThread` 分支内不得出现 `threadId:` 直传 | `chat-thread-init-ordering.spec.ts`(已有)+ 新增单测 |
| 3 | **S4** 不传字面量 `"new"` | **守护测试**(AST/grep):`useStream`/引擎入参路径上不得出现字面量 `"new"` | `tests/guards/no-literal-new.test.ts`(新增) |
| 4 | **S5** 停止后立即失效 + 1.5s 补拉 | **node 单测 + fake timer**:调 `stop()` 后断言 ① 立即触发一次缓存失效 ② **推进 1.5s 后再触发一次**<br>🔴 **这条最容易被"顺手优化掉"**(看起来像多余的重复请求)—— 单测里写明注释:**删掉它会拿到 finalize 之前的旧标题** | 新增单测 |
| 5 | **R3**(渲染层) 不在渲染期排定时器 | **守护测试**:`app/components/streamdown/**` 与产物面板组件内**禁止出现 `setTimeout`/`setInterval`**;异步挂载必须配 `onScopeDispose` | `tests/guards/no-render-timers.test.ts`(新增) |
| 6 | **跨 thread 状态清理**(非编号项) | **E2E**:A 线程开产物面板 → 切 B → 断言面板状态/产物列表/subtasks 均已隔离 | `thread-switch.spec.ts`(§3.3.1 新增,已进 §1.2 验收③) |

#### 👁 只能人工验的 6 条 —— PR 里逐条勾选

| # | 红线 | 怎么验证(具体动作) | 守门人 |
| --- | --- | --- | --- |
| 7 | **R2**(渲染层) loading 中纯内容 AI 消息留在 processing 组 | 发一条会让模型先说话再调工具的消息,**在流式进行中**截图:纯文本必须还在 **processing 组**,不能跳进步骤面板<br>⚠️ 时机敏感,流结束后再看是看不出来的 | 人工 + `agent-chat.spec.ts` 部分覆盖 |
| 8 | **S11** `safeLocalStorage` 门面 | 浏览器隐私模式 / 手动禁用 `localStorage` → 应用**必须不白屏**<br>✅ 实现本身由 `core-provenance.test.ts` 保证没被改 | 人工 + provenance |
| 9 | **S12** 请求绑 `AbortController` | 打开 DevTools Network → 触发 goal/compact 请求 → **立刻切走页面** → 该请求应显示 **cancelled**<br>🔴 **Pinia store 是单例、不随组件卸载** → 若只把 abort 挂在组件上会失效,必须挂 `onScopeDispose` 或由 store 显式管理 | 人工 |
| 10–13 | **P2 / P3 / P4 / P5**(面板布局,**4 条**)右面板 collapse / resize / 动画 / `0%` 判定 | ① 拖拽手柄到最左,断言**折叠**而不是宽度 0<br>② 拖拽过程中**消息列表不得回流**(issue #4465 的原始症状)<br>③ 动画期间内容**锁宽裁剪**,不重排<br>④ 拖到 `0%` 的判定与"用户主动折叠"必须可区分<br>🔴 **换库后 imperative handle 语义全变,这 4 条是 P0 go/no-go 的直接后果**(风险 R4) | `artifact-panel-resize.spec.ts` + `sidecar-chat.spec.ts` + 人工拖拽 |

#### PR 模板片段(可直接复制)

```markdown
## 红线检查(B 类 12 条 —— 见方案 §5.2)
> 只勾选**本 PR 实际触及**的项;不涉及的写 N/A。全部 N/A 时请说明理由。

**机械化(应由测试覆盖,勾选=已跑绿)**
- [ ] S1  流合并:node 单测通过(含**通知间隔 ≤80ms** 的时间分布断言)
- [ ] S3  isNewThread 期间未直传 threadId
- [ ] S4  入参路径无字面量 "new"
- [ ] S5  stop() 后立即失效 + 1.5s 补拉(fake timer 单测)
- [ ] R3  渲染期无 setTimeout/setInterval,异步挂载配 onScopeDispose
- [ ] 跨thread  thread-switch.spec.ts 通过

**人工(勾选=本人已实际操作验证)**
- [ ] R2  流式进行中截图确认纯文本仍在 processing 组
- [ ] S11 禁用 localStorage 后应用不白屏
- [ ] S12 切走页面时 goal/compact 请求显示 cancelled
- [ ] P2–P5 右面板四项:折叠 / 拖拽不回流 / 动画锁宽 / 0% 可区分

**C 类提醒**(29 条):本 PR 若改了 `app/core/api/**` 或引擎 ——
- [ ] 新引擎仍**经由** api-client 的包装(T1–T8),没有绕过去直连 SDK
- [ ] `make verify` 绿(含 `core-provenance` 两层校验)
```

> ⚠️ **这份清单不替代 `make verify`**,它守的是**机械校验守不住的部分**。
> 两者的分工:`core-provenance` 守「代码有没有被改」,本清单守「新代码有没有正确使用它」。

---

> ⚠️ **D7 修订**:原文在此处论证「不做共享包,这 24 条要在 Vue 侧重新踩一遍」。
> **该论证已被 D7 推翻**(见 §0.4「D7 的连带影响」):复制同样能继承这 29 条,
> 一行资产都没少。共享包的真实价值不在**移植**,而在**长期维护** ——
> 避免两份拷贝对同一条不变量各修一次(见上文 C 类的 D7 代价段与 O15)。

---

## 6. 分期计划

每期以「哪些 spec 转绿」作为验收标准。

### P0 · 地基验证与选型定稿(2–3 周)
| 项 | 内容 |
| --- | --- |
| 交付 | ① 选型核实报告 —— ⚠️ **大部分已由 §2.7 闭合**(Nuxt 4.4.8 + antdv 4.2.6 + `@ant-design-vue/nuxt` 1.4.6 + Pinia 3.0.4 + vue-i18n 11.4.6 实跑通过,FOUC 已解)。🔄 **v4:D24-a 后恢复 `@tanstack/vue-query` 客户端插件 smoke**;并**必须重跑一次 `pnpm install --strict-peer-dependencies`** —— v4 是本方案第一次加包(53 个依赖),不再是"删包不加包"(§2.8.3)<br>② Nuxt 骨架 + 构建 + **独立起服务(:3001)+ Nitro `routeRules` 代理到 Gateway**(§3.2.1,D7 下不接 Nginx)<br>③ 🔴 **Nitro 鉴权中间件五态打通**(五态定义见 [03-routing-and-pages.md](03-routing-and-pages.md),Nuxt 侧适配见 §2.9.3 / §3.1 / §3.2.1)+ CSRF 双提交;客户端路由守卫只做兜底<br>④ `core/` 复制 + **五类偏离**的可行性验证(§3.1)—— ⚠️ **不是「3 处适配」**:实测为 ADAPTED 3 / **DEMOCKED 4**(`isMock`)/ **SPLIT 1**(`threads/hooks.ts`)/ ADDED / REMOVED(D13)<br>⑤ ~~`ai-elements` 使用面盘点~~ → ✅ **D9 已完成**(§2.6.1),P0 不必重做<br>⑥ 🔴 **`resizable` 候选库调研 + 最小 demo 验证 **08 号** §8.3 五条红线可实现性**<br>⑦ antdv 的 14 个原语 role 实测(§2.3.4 的 38 次风险项逐一确认)<br>⑧ 主题桥接 PoC(**D15/D20 后**:`theme-palette.json` → SCSS 变量 + CSS 自定义属性 + antdv token + hydration 前 `data-theme`,含暗色切换)—— ✅ **§2.7.1 的实现链可整条抄**(参照工程本就是 SCSS,原「真相源不同」的差异已消失),工作量 3–5 天 → **2 天**<br>⑫ 🔴 **D15 新增**:SCSS 基础层(`main.scss` / `_mixins.scss`)+ stylelint 接入 + **挑 1 个中等复杂度组件做 Tailwind→SCSS 样例**,作为 P2 的撰写范式与速率基线(§2.4.5)<br>~~⑭ D24 server-state contract fixture~~ → ❌ **v4 取消**(D24-a),替换为 **`VueQueryPlugin` smoke(2 小时)**,含 `enabled` 响应式验证<br>🔴 **⑮ v4 新增**:`hast-util-to-jsx-runtime` + `vue/jsx-runtime` 可行性实验(半天,**§4.2.5**)<br>🔴 **⑯ v4 新增**:非 `localhost` 内网地址冒烟(10 分钟)—— 抓 `crypto.randomUUID` secure-context(**§2.4.6**)<br>🔴 **⑰ v4 新增**:`.github/workflows/frontend-vue-verify.yml` 落盘(1 小时,**§3.2.4**,D11-a)<br>🔴 **⑱ v4 新增 · 规格空白清单**(**半天**,**§1.2.2**)—— 把 ≈**2,122 行**无判据的功能(6 个设置页 1,604 + `agents/new` 455 + `auth/callback` 63)逐个定处置 **A 补 spec / B 人工签字 / C 接受漂移**,产出 `frontend-vue/tests/SPEC-GAPS.md`。**建议 `memory`(993)与 `agents/new`(455)走 A**<br>🔴 **⑲ v4 新增 · 27 个非 core 单测定去留**(**1 小时**,**§1.2.3**)—— 逐个标「迁 / 重写 / 砍 / 由 E2E 替代」,5 个硬依赖 `@testing-library/react` 的确定要重写;同时把 P1 验收里的 `71` 校正为实测的 **72** |
| 交付(续) | ⑨ 🔴 **`tests/contract/proxy-policy.test.ts`**(**D14**,§1.2.1,约 120 行)—— 6 条断言覆盖 R15 三项 + `proxy-policy` 契约四项。**这是 25 spec 结构上照不到的那一层**<br>⑩ `playwright.real-backend.config.ts` + 复制 4 个真后端 spec(e2e-real-backend 3 + e2e-auth 1)<br>⑪ `make verify` / `verify-full` 两级门禁骨架 + pre-push 钩子(§3.2.3)<br>⑬ 🔴 **D22 stream contract fixture**:手写 `fetch-sse` / wire codec / DeerFlow Gateway adapter 的最小 fixture,覆盖 `Content-Location`、`Last-Event-ID`、`metadata/messages/values/custom/gap/end`、heartbeat、409 分支;再加一个非 LangGraph 形态 fixture 证明 canonical reducer 不依赖后端框架 |
| 验收 spec | `sidebar.spec.ts`(`landing.spec.ts` 已按 D6 删除)+ **⑨ 的 6 条契约断言全绿且已反向验证** |
| 🔴 go/no-go | **⑥ 是硬检查点**:若无 Vue resizable 库能支持"拖拽中 vs 最终布局"事件区分(红线 P5 前提),须立即追加自研预算(2–3 周)并重估 P5 |
| 🔴 建议执行顺序<br>(**v4 重排**) | **先做「便宜、二元、失败即改架构」的六件,再搭骨架。总计约 3.5–4.5 天。**<br>**0. ✅ 前置已完成**:D26 已定案 (b)、基线已重冻至 **`b71a892b`**(D4-b,`frontend/` 零漂移)。<br>&nbsp;&nbsp;&nbsp;&nbsp;⚠️ **P0 期间每次 merge upstream 后仍要跑一次** `git diff b71a892b..HEAD --stat -- frontend/`,**输出非空即需按 §2.10.5 第 3 条处理**<br>**1. D22 stream contract fixture**(1 天:不接 UI,只用固定 SSE 文本验证手写 transport/codec/adapter 能还原当前 Gateway 语义,并证明非 LangGraph fixture 可复用 reducer。失败则 §4.1 需先改架构)<br>~~2. D24 server-state contract fixture~~ → ❌ **v4 取消**(D24-a 改装 `@tanstack/vue-query`)。替换为 **`VueQueryPlugin` smoke(2 小时)**:Nuxt 插件注册 + 一个 query 跑通 + **确认 `enabled` 传响应式 ref 时会正确重新启用**(§4.4.1 点名的迁移陷阱)<br>**3. ⑥ resizable 判定**(🔻 **v4:1–2 天 → 半天**。`splitpanes@4.1.2` 实测已 emit `resize`/`resized`,§2.3.2 已答掉最硬的一条;剩余只验**命令式开合 + minSize 折叠 + group 级过渡**三条)<br>**4. SSE 能否不缓冲地穿过 Nitro `routeRules` proxy**(1 小时:Nuxt + 一个每 200ms 吐帧的假上游。**失败则 `docker-vue/` 的单服务形态要改成自写 h3 handler**)<br>**5. Nitro 鉴权中间件 PoC**(半天:最小 `server/middleware/auth.ts` 读 `access_token` cookie,未登录在返回 HTML 前 302 到 `/login`;验证 CSR 产品页不会先下发受保护 app shell)<br>🔴 **6. v4 新增:`hast-util-to-jsx-runtime` + `vue/jsx-runtime` 可行性**(**半天**:实测该包 `peerDependencies` 为 `null`、依赖无 react,而 `vue` 导出 `./jsx-runtime`。判据二元 —— ① 能渲染出结构正确的 DOM ② **追加内容时已有节点不被重挂载**。**成立则 P4 的 5–8 周上界显著下修**;不成立则回 §4.2.2 自研,代价只有这半天。见 **§4.2.5**)<br>六件都便宜,且任一失败都会改变架构 —— **没有理由排在骨架之后**。 |
| 🔴 **v4 新增冒烟检查** | **用非 `localhost` 的内网地址打开一次,确认新建会话可用**(10 分钟)。<br>这是唯一能抓到 **D25-a ①**(`crypto.randomUUID` 在非安全上下文不存在)的检查 —— **开发机 `localhost` 上永远复现不了,25 个 E2E 也抓不到**(Playwright 默认跑 localhost)。详见 **§2.4.6** |
| 关键风险 | 若 Nitro 鉴权中间件、`core/` 复制适配、resizable、或 SSE 穿透在此阶段就不顺,**应在此止损重估**,沉没成本最低 |

### P1 · `core/` 复制、拆分与溯源校验(**1–2 周**)· 🔴 已按 D13 上调
| 项 | 内容 |
| --- | --- |
| 交付 | ① 把 `frontend/src/core` 的纯 TS 部分复制到 `frontend-vue/app/core/`(**13,486 行**,🔴 **其中 7,215 行**逐字节零改动 —— v4 更正,旧写 10,400)<br>🔴 **①b v4 新增 · `Message` 类型模型**(`app/core/message-types.ts`,**2–3 天**,§4.1.5)—— **必须先于 ①c**,因为 13 个 DETYPED 件要 import 它<br>🔴 **①c v4 新增 · DETYPED**:13 个文件 / 3,185 行改类型 import(`@langchain/langgraph-sdk` 11 个 / `ai` 1 个),**0.5 天**,清单见 §3.1.4<br>② **ADAPTED**:3 处 Next→Nuxt 适配(`config/index.ts` → `useRuntimeConfig`、`auth/server.ts` / `i18n/server.ts` → Nitro cookie)<br>③ **DEMOCKED**:清 `isMock` —— 🔴 **实测落在 4 个此前无归属的文件**:`api/api-client.ts`(6 处)、`sidecar/api.ts`(3)、`artifacts/utils.ts`(3)、`artifacts/loader.ts`(3);连同 `static-mode.ts` / `static-demo.ts` 一并删<br>④ 🔴 **SPLIT**:按 **§3.1.3** 拆 `threads/hooks.ts`(3,072 行 / 53 导出)→ `history.ts`(22 导出)/ `coalesce.ts`(3)/ `cache.ts`(12)/ `types.ts`(3),**按导出名搬,不按行区间切**<br>⑤ 写 `app/core/PROVENANCE.md`:来源 commit `b71a892b` + **五类偏离逐条登记**(ADAPTED/DEMOCKED/SPLIT/ADDED/REMOVED)<br>⑥ 🔴 **写 `tests/guards/core-provenance.test.ts`**(D12+D13,§3.1.2)—— 约 **180 行**:Tier 1 文件哈希 + Tier 2 导出级比对 + 完备性检查。**不写这条,①–⑤ 的价值会随时间流失** |
| 验收 | ① `core/` 的 **72** 个单测迁到 Vitest 后全绿(🔴 v4 更正,旧写 71;证明复制无损)。⚠️ **27 个非 core 单测按 P0 ⑲ 的结论执行,不含在这个 72 里**(§1.2.3)<br>② 🔴 **反向验证**:在 React 侧改掉 `mergeMessages` 任一分支、或 `decideCoalesce` 里的 `80`,`make verify` **必须红**。**这是 P1 完成的判据,不是"看起来搬全了"**<br>③ **`frontend/` 零改动**(D7,用 `git status` 证明) |
| ⚠️ 工时为何从 0.5 周上调到 1–2 周 | 原估「约 3 天」只覆盖了「复制 + 3 处适配」。实测后新增三块**此前无归属**的工作:<br>· `threads/hooks.ts` 按 53 个导出拆分(**2–3 天**,机械但需逐个核对语义)<br>· 4 个 `isMock` 文件的清理(0.5 天)<br>· Tier 2 导出级比对从 60 行涨到 180 行(**2 天**)<br>· 72 个 core 单测迁 Vitest(2 天,原估已含;🔴 v4 更正,旧写 71)<br>**这不是估算变悲观,是原估漏了工作面。** |
| 代价 | 两份拷贝并存(§3.1「D7 的代价」)。**不再顺带偿还 §10.2① 的技术债** —— 但 D13 的拆分实际上**在 Vue 侧偿还了它**:3,072 行的巨型文件被拆成 4 个按职责分的文件 |

### P2 · 常规页面(5–7 周)· 可与 P3/P4 并行
| 项 | 内容 |
| --- | --- |
| 范围 | 11 个设置页、scheduled-tasks(612 行 + cron)、agents 画廊/新建、channels、memory(993 行)、integrations(884 行)、侧栏与 thread 列表<br>**+ D2 追加**:14 个 antdv 薄包装(补 role + testid,**不写 aria**)、**15 个自研原语**(⚠️ 不是 21,见 §2.3.1.1)、`command` 命令面板重写、toast 容器替换(antdv `message`,**文案必须与 React 版一致**)、主题桥接落地<br>**+ D15 追加**:🔴 **全部样式用 SCSS 撰写**(不能照抄 React 的 className 字符串)、`_mixins.scss` / `main.scss` 基础层、stylelint 接入。**这是 D15 成本的主要落点之一**(§2.4.3);⚠️ **P2 做完前 3 个页面后,用实际速率回推 §2.4.5 的「+3–6 周」并更新 §7**<br>**+ D13 追加**:16 个薄 `hooks.ts` → composables(**1,080 行**)、以及 `threads/hooks.ts` 拆出的 **6 个 thread 列表 hook**(`useThreads` / `useInfiniteThreads` / `usePinThread` / `useDeleteThread` / `useRenameThread` / `useBranchThread`,约 **400 行**)—— 🔴 **这部分旧计划无任何阶段认领**(§3.1.3) |
| 为何先做 | **不含** streamdown / ai-elements / 流引擎。纯 CRUD + 表单,用来爬升 Vue 工程效率、定下 store 与 composable 约定(**约定见 §3.3.1**) |
| 🔴 **出口条件**(不是"做掉就行") | **`command` 必须按 `prompt-input` 的用法验收通过**。理由:P5 最大件 `prompt-input`(1,477 行)含 7 个 `PromptInputCommand*` 导出,硬依赖 `command`;而 `command` 是 antdv 无对应物的缺口件(§2.3.2)。**P2 交不出合格的 `command`,P5 会在关键路径末端被堵**(风险 **R19** / §4.3.3)。<br>**验收用例直接取自 `prompt-input` 的 7 个用法,不要只按 `ui/command` 自身 API 验。** |
| 验收 spec | `settings-notification`、`scheduled-tasks`、`channels`、`integrations`、`agents-feature-disabled`、`thread-list-pin`、`thread-list-infinite-scroll`(`docs-localized-links` 已按 D6 删除)<br>🔴 **v4 追加(R21 / §1.2.2)**:上面这批**照不到 P2 的两个大交付物** —— `memory`(**993 行**)与 `agents/new`(**455 行**)**零 spec**。按 P0 ⑱ 的结论执行:走 A 则本阶段要**新写这两个 spec**(各 0.5–1 天,复用 `mock-api.ts`);走 B 则**必须进 P6 人工签字清单**,不能默认对上 |

### P3 · ThreadStreamEngine(4–6 周)
| 项 | 内容 |
| --- | --- |
| 交付 | §4.1 的手写 transport / wire codec / DeerFlow Gateway adapter / canonical reducer / 引擎 + Vue composable 适配 + **node 环境单测覆盖 T1–T8、S1–S5**。🔴 **不装、不 import `@langchain/langgraph-sdk`** |
| 验收 spec | `chat-thread-init-ordering`、`thread-history`、`e2e-real-backend/multi-run-order` |
| 说明 | 此阶段 UI 可以粗糙(纯文本渲染),只验证流的正确性 |

### P4 · streamdown-vue(5–8 周)
| 项 | 内容 |
| --- | --- |
| 交付 | §4.2 渲染器 + **视觉逐帧对比工具** |
| 验收 spec | `thread-history-mermaid`、`user-message-plain-text` + 人工视觉比对签字 |
| 风险 | 🔴 全案最高。建议独立小组、尽早启动 |

### P5 · 主聊天页 + ai-elements-vue(**7–11 周**,D9 后)
| 项 | 内容 |
| --- | --- |
| 范围 | **14 个** ai-elements(⚠️ 不是 28 —— D9 实测 14 个零引用,§2.6.1;分级见 §4.3)、`InputBox` 全部职责(§10.2②)、MessageList/Group/Item、human-input 卡片、subtask 卡、右面板三件套、产物详情、sidecar、browser-view<br>**+ D13 追加**:`threads/hooks.ts` 拆出的聊天页 hook(`useThreadHistory` / `useThreadRuns` / `useThreadMetadata` / `useThreadTokenUsage` / `useRunDetail` / `useCoalescedStreamMessages`,约 **358 行**,与 P3 分担) |
| 验收 spec | `chat`、`agent-chat`、`subtask-card`、`sidecar-chat`、`artifact-preview`、`artifact-panel-resize`、`artifact-stream-state`、`artifact-batched-stream`、`browser-feature`、`workspace-changes`、`branch-thread` |
| 🔴 **开工前置检查** | ① **P2 的 `command` 已按 `prompt-input` 用法验收通过**(风险 R19 / §4.3.3)—— 否则 `prompt-input` 的 7 个 `PromptInputCommand*` 无处落地;② P3 的引擎已通过 T1–T8/S1–S5 单测;③ P4 的渲染器已过人工视觉签字 |
| ✅ **一条减负事实** | **ai-elements 对 Radix 的真实依赖是 0**(实测:表面 2 处均为 `@radix-ui/react-use-controllable-state`,是受控状态助手 hook,**不是 UI 原语**,Vue 用原生 `defineModel()` 顶替)→ **本阶段与 D2 的 antdv role 对齐问题完全解耦**,不会被 R5/R13 波及(§4.3.2) |
| 说明 | B 类 12 条红线在此收敛,尤其右面板 P2–P5(⚠️ 此处 `P2–P5` 是**红线**编号「面板布局」,不是阶段编号 —— 见 §5 图例) |

### P6 · 收尾与验收(2–3 周,D6 后)
| 项 | 内容 |
| --- | --- |
| 范围 | i18n 双语完整性核对、移动端适配、暗色主题与 antdv token 桥接收尾<br>~~无障碍~~ → 按 **D5 + D8** 彻底不投入(`aria-*` 136 处、`sr-only` 24 处均不写)<br>~~landing 特效件~~、~~文档站 + 72 MDX~~ → 按 **D6** 已砍 |
| 验收 spec | 🔴 **按 D14 分层,每层都必须绿**:<br>**① UI 层** —— `ui-polish-mobile` + **`tests/e2e/` 25 个 spec 全绿**(含 D5/D8/D15 的 **7** 处 testid 改动)<br>**② 代理层** —— `tests/contract/proxy-policy.test.ts` 6 条断言全绿 + **真后端 4 个 spec**(`e2e-real-backend` 3 + `e2e-auth` 1,实测)<br>**③ 补位 spec** —— `thread-switch.spec.ts`(跨 thread 状态隔离,R3 / §3.3.1)⚠️ **不在 24 个里,别漏跑**<br>🔴 **④ v4 新增 · 规格空白区签字**(R21 / §1.2.2)—— 按 P0 ⑱ 产出的 `SPEC-GAPS.md` 逐条销账:<br>&nbsp;&nbsp;&nbsp;&nbsp;· 走 **A** 的(建议 `memory` / `agents/new`)→ 新 spec 全绿;<br>&nbsp;&nbsp;&nbsp;&nbsp;· 走 **B** 的 → **第二人逐屏对照 React 版并签字**(与 R18 的视觉 diff 合并做);<br>&nbsp;&nbsp;&nbsp;&nbsp;· 走 **C** 的 → 已登记进「已知对标差异」。<br>&nbsp;&nbsp;&nbsp;&nbsp;⚠️ **`SPEC-GAPS.md` 里每一条都必须有结论,不允许留空**<br>⚠️ **只签①不签②等于代理层零验证** —— 25 spec 走 `page.route()` 在浏览器层就被拦截,**从未执行过 Nitro 代理**(§1.2.1)<br>🔴 **D11 无 CI** → 全绿必须由**第二个人在自己机器上独立跑 `make verify-full` 并签字**(§3.2.3 / 风险 R14)|
| 说明 | D6 使本阶段显著瘦身:原本最不确定的两项(landing 的 GSAP/WebGL 特效、Nextra → Vue 文档站方案)都已移出范围,工期从 3–4 周降到 **2–3 周** |

---

## 7. 工作量估算

| 阶段 | 单人周 | 本轮变化 | 可并行 |
| --- | --- | --- | --- |
| P0 地基 | **2.5–3.5** | 🔺 +0.5 —— D14 的 ⑨⑩⑪(契约测试 120 行 + 真后端配置 + 两级门禁) | 否(阻塞全部) |
| **P1 core 复制、拆分与溯源** | 🔺 **1.5–2.5** | 🔺 **+0.5–1.5**(D13)**+0.5–1(v4)** —— D13:拆 `threads/hooks.ts`(2–3 天)+ 4 个 `isMock` 件(0.5 天)+ Tier 2 校验 60→180 行(2 天);🔴 **v4 追加**:`Message` 类型模型 **2–3 天**(§4.1.5)+ 13 个 DETYPED 件改 import **0.5 天**(§3.1.4)+ Tier 2 比对面 3,086→6,242 行 | 否(阻塞 P3+) |
| P2 常规页 | 5–7 | ➖ 不变 —— 新认领的 400 行 thread 列表 hook 落在原区间噪声内 | ✅ 与 P3/P4 并行 |
| P3 流引擎 | 4–6 | ➖ 不变 | ✅ 与 P2 并行 |
| P4 streamdown | 5–8 | ➖ 不变 | ✅ 与 P2/P3 并行 |
| P5 聊天页 + ai-elements | **7–11** | 🔻 **−1** —— D9 的省量**旧版漏计入总账**,本轮补上(§2.6.5) | 依赖 P3+P4 |
| P6 收尾 | **2–3**(D6 瘦身) | ➖ 不变 | 否 |
| 小计 | 🔺 **27–41 周** | 逐项相加:下界 2.5+**1.5**+5+4+5+7+2;上界 3.5+**2.5**+7+6+8+11+3<br>(🔴 v4:P1 从 1–2 → 1.5–2.5,小计 26.5–40.5 → **27–41**) | |
| **D2(antdv)上浮** | **+1.5–4.5** | **14** 个包装层 + command + toast + 主题桥接;D5 已削减包装层职责;若 resizable 需自研取上限(§2.3.5) | |
| **D6(范围裁剪)下调** | **−3–4** | 砍 4,925 行 + 72 MDX;运行模式 4→2 使测试矩阵减半(§2.5.3) | |
| 🔴 **D15(弃 Tailwind 改 SCSS)上浮** | **+3–6** `⚠️待P2校准` | 失去 className 逐字复制这个对标捷径,约 200 个组件要撰写并目视核对 SCSS(压在 P2/P5);主题桥接反而省 1–2 天。**🔴 全表唯一一笔非实测数字,校准方法见下方** | |
| 🔴 **v4 净影响** | **≈ 0**<br>⚠️ **+0.5–1(若 ⑱ 走 A)** | 🔴 **v4 追加(R21)**:P0 ⑱⑲ 本身 **+0.6 天**;若 `memory`+`agents/new` 走 **A 补 spec**,**P2 再 +1–2 天**(各 0.5–1 天)。**这笔算在 P2 里,不改总区间** ——但它是**新暴露的工作面,不是估算变悲观**(同修正 ⑤⑨ 的性质)。<br>**➕** P1 +0.5(`Message` 类型模型 + DETYPED);**➖** P0 −0.25(resizable 1–2 天→半天、server-state fixture 取消换 2 小时 smoke、新增 jsx-runtime 半天 + CI 1 小时 + 内网冒烟);**➖ 未入账的**:D24-a 消掉一个没有量级的自研件(原压在 P2 关键路径)<br>🔴 **P4 上界可能显著下修,但先不改** —— 按 §4.2.5 的纪律等 P0 实验结果回推,不拿"预期会省"调口径 | |
| **串行合计** | **27–48 周** `⚠️含待校准项` | **≈ 7–12 人月**(v4 后不变,见上一行) | |

> 🔴 **`⚠️待P2校准` 是什么意思 —— 引用本表数字前必读。**
>
> 上表除 D15 那一行外,其余分期工时都来自逐项分解;
> **只有 `+3–6 周` 是按「约 200 个组件 × 每个多花 0.5–1.5 小时撰写并目视核对 SCSS」估的,没有任何实测支撑。**
> 它却决定了上界的 12.5%(42 → 48 周)、并把对外口径从 `6–10` 顶到 `≈7–12 人月`。
>
> **校准方法(P2 开始后第一个可执行动作)**:
> 1. P2 做完**前 3 个页面**时,记录这 3 个页面的组件数与实际耗在样式上的工时
> 2. 算出「每组件样式工时」的实测均值,乘以剩余组件数
> 3. 用实测值替换 `+3–6`,并**同步更新三处**:本表、**§7.1 对外口径**、**README「目标量级」**
> 4. 在 §7 的「口径修正记录」里追加一条,注明校准前后的值
>
> ⚠️ **在校准完成前,对外沟通必须说明「7–12 人月含一笔未实测的样式估算」** ——
> 不要把它当成和其他分期同等可靠的数字。

> 🔵 **v2「彻底修复」那一轮的净效果几乎为零**(诚实的巧合,不是凑数):
> D9 补计入的 **−1 周** 与 D13/D14 的 **+1–2 周** 方向相反、量级相当,基本抵消
> → 区间从 24–41 变成 **24–42**,对外口径当时不变。
>
> 🔴 **但 D15 不一样 —— 它是本方案里第一笔真正改变口径的决策。**
> **+3–6 周**推高上界近 15%:`24–42 → 27–48 周`,`6–10 → 7–12 人月`。
> 原因是它动的不是某个模块,而是**每一个组件的撰写方式** ——
> 影响面随组件数线性增长,而组件正是这个项目的大头。

### 7.1 对外口径(按此表述,不要报周数)

| 场景 | 数字 |
| --- | --- |
| ✅ **本案口径(O5 已定为「有经验」,D16)** | **≈ 7–12 人月**;**3 人 5–7.5 个月**<br>🔴 **含 D15 的 `+3–6 周` `⚠️待P2校准`** —— 全案唯一一笔非实测数字,校准方法见 §7 表下说明 |
| ~~O5 为「经验不足」时~~ | ✅ **该情景已由 D16 消除**(原为:P0+P2 上浮 30–50% → 上界约 54 周 ≈ 13.5 人月,3 人 8–9 个月) |

> ✅ **D16 之后,27–48 周这个区间的性质变了 —— 这比"区间变窄"更重要。**
>
> 定 O5 之前,上界的驱动里有一项是**未知的团队能力**,无法管理。
> 现在剩余跨度只来自**两个已识别、且各有处置的项**:
>
> | 驱动 | 量 | 处置 |
> | --- | --- | --- |
> | **D15 样式撰写增量** | +3–6 周 | `⚠️待P2校准` —— P2 前 3 个页面后用实测速率回推(§2.4.5) |
> | **resizable no-go** | +2–3 周 | ✅ **D19 已预授权**,不占审批时间;P0 第一周即出 go/no-go(风险 R4) |
>
> **两项都走好 → 落在 27 周侧;都走坏 → 48 周。**
> 而这两项**都在 P0–P2 期间就能见分晓** —— 也就是说,
> **开工约两个月后,就能把区间收敛到一个可承诺的数。**
| ~~D15 之前的旧口径~~ | ~~≈ 6–10 人月 / 3 人 4–6 个月~~ —— **已作废,不要再引用** |

> 🔴 **别把精度报到周。** 上表 27–48 周是分期逐项相加的结果,不是可承诺的精度 ——
> **区间宽 21 周,上界比下界高 78%**,这已经说明了一切。
> (⚠️ 此处旧文写「±40%」「±43%」,两个百分比都算错了 —— 用的是「宽度 ÷ 上界」;
> 本轮改为直接陈述「上界比下界高多少」,避免再出现口径不明的百分比。)
> **O5 已由 D16 定为「团队有 Vue+Nuxt 实战经验」**,经验不足导致的尾部情景已消除。
> 当前区间的剩余跨度主要来自 **D15 的样式速率待校准** 与 **resizable no-go 是否触发 D19 自研预算**。
> 对外仍只报「≈7–12 人月 / 3 人 5–7.5 个月」,不要报到周。
> (⚠️ 旧口径「6–10 人月 / 3 人 4–6 个月」是 **D15 之前**的,已作废,不要再引用。)

<details>
<summary>口径修正记录(本轮交叉核对发现,供追溯)</summary>

① 原「小计 26–39.5」的下界与逐项相加(26.5)不符,已更正。
② 原「串行合计 24.5–40 周 / 6–9.5 人月」与上述加减不闭合,按 26.5+1.5−4 = **24**、
39.5+4.5−3 = **41** 更正,HANDOFF §6.1 已同步。
③ **一处已知重复计入(不修,仅披露)**:P6 行已写「2–3(D6 瘦身)」,即 D6 对 P6 的
约 1 周节省已计入分期;而「D6 下调 −3–4」又覆盖全量裁剪 → 下界偏乐观约 1 周。
之所以不修:它落在区间宽度的 6% 以内,而修它需要把 D6 的收益在 P2/P5/P6 之间重新分摊,
属于给假精度做假账。**披露比修正更诚实。**

---
**2026-07-31 本轮(彻底修复)新增三条**:

④ **D9 的收益此前漏计入总账**:P5 行早已标注「D9 后 7–11」,但小计的逐项相加用的是
`8` 和 `12`(D9 前的数)→ 24–41 是 **D9 前**的区间。本轮改用 7–11,总账才与 §2.6.5
自己声明的「省 1–2 周」一致。**这与 ③ 方向相反**:③ 是偏乐观 1 周,④ 是偏保守 1 周。

⑤ **P1 原估 0.5 周漏了工作面**(不是估算变悲观):原估只覆盖「复制 + 3 处适配」,
未包含 `threads/hooks.ts` 拆分、4 个 `isMock` 文件、Tier 2 校验。已上调至 **1–2 周**。

⑥ **P0 因 D14 增 0.5 周**:契约测试(120 行)+ 真后端配置 + 两级门禁骨架。

> **三条净效果 ≈ 0**(−1 + 1.5 + 0.5 ≈ +1,落在区间宽度的 5% 内)。
> 当时对外口径不变。**但 ③④ 并存这件事本身说明:分期加减表在没有逐项复核时
> 会同时藏住收益和成本 —— 这正是那一轮要修的毛病。**

---
**2026-07-31 v3(D15 弃 Tailwind 改 SCSS)新增两条**:

⑦ 🔴 **D15 上浮 +3–6 周,是本方案第一笔真正改变对外口径的调整**:
`24–42 → 27–48 周`,`6–10 → ≈7–12 人月`,3 人 `4–6 → 5–7.5 个月`。
⚠️ **这个数不是实测**,是按「约 200 个组件 × 每个多花 0.5–1.5 小时撰写并目视核对 SCSS」估的,
**全案最不确定**。真正的变量是视觉对标要求有多严(§2.4.5)。
**建议 P2 做完前 3 个页面就用实际速率回推,并回来更新本表。**

⑧ **两处百分比口径错误已更正**:原文用「区间宽度 ÷ 上界」冒充「±百分比」
(24–41 写成「±40%」、24–42 写成「±43%」,实际按中值算分别是 ±26% / ±27%)。
本轮起改为直接陈述**「上界比下界高 78%」**,不再使用口径不明的 ± 表述。

---
🔴 **2026-07-31 v4(外部现实核对)新增四条**:

⑨ **P1 从 `1–2 周` 上调到 `1.5–2.5 周`**(+0.5)。两笔,**都不是估算变悲观,而是原估漏了工作面**
(与修正 ⑤ 同型):
· 🔴 **`Message` 类型模型 2–3 天**(§4.1.5)—— D21/D23 都量化了自己的类型面,**D22 没有**。
  实测 SDK 类型渗透 **27 个文件**,其中 `Message` 一个符号就占 **19 个**,
  而它必须与 Gateway wire format 结构兼容(`content` 多态 / `additional_kwargs` / `tool_calls` / `artifact`)
· **13 个 DETYPED 件改 import 0.5 天** + **Tier 2 比对面从 3,086 → 6,242 行**(§3.1.4)

⑩ **P0 净减约 0.25 周**,四笔相抵:
· ➖ resizable 判定 **1–2 天 → 半天**(`splitpanes` 实测已满足事件区分,§2.3.2)
· ➖ D24 server-state contract fixture **取消**(0.5–1 天)→ 换成 `VueQueryPlugin` smoke(2 小时)
· ➕ `hast-util-to-jsx-runtime` 实验 **半天**(§4.2.5)
· ➕ CI workflow **1 小时**(§3.2.4)+ 内网冒烟 **10 分钟**(§2.4.6)

⑪ 🔴 **一笔"未入账的收益"——不进表,但要知道**:D24-a 消掉了 `ServerStateClient`。
它原本压在 **P2 的关键路径**上,而 §4.4.4 自陈"周数等 P0 后再回填" ——
**也就是说 27–48 周里从来没有它的位置**。所以**减掉它不减周数,减的是一笔未定价的风险**。
(⚠️ 这与修正 ③ 是同一类诚实披露:**表里没有的东西,拿掉了也别去表里减**。)

⑫ 🔴 **P4 的 5–8 周上界可能显著下修,但本轮不动**。
`hast-util-to-jsx-runtime` 实测框架无关(peer 为 `null`)+ `vue` 导出 `./jsx-runtime`
→ P4 两根成本支柱倒了一根。**但按 §7 表下的校准纪律,等 P0 实验出结论再回推** ——
**不拿"预期会省"去调对外口径**,这与 D15 那笔 `+3–6 周` 待校准是同一条纪律。

> 📌 **v4 净效果 ≈ 0**(⑨ +0.5、⑩ −0.25,落在区间宽度 21 周的 1% 内)。
> **对外口径 `≈7–12 人月 / 3 人 5–7.5 个月` 不变。**
> 🔴 **但 v4 真正改变的不是工期,是 §2.10 的 D26** ——
> 上游漂移是**唯一一个不在这张表里、也不在 P0 实验里的成本**。

</details>

> **D7 使工期再降约 2 周**(P1 从 2–3 周降到 0.5 周),但代价是失去共享层的
> 长期收益 —— 这是**用长期维护成本换短期工期**的取舍,已在 §3.1、§5 C 类记录。

**3 人团队的日历估算**:约 **5–7.5 个月**(含 D15)。按关键路径
`P0 + P1 + max(P2,P3,P4) + P5 + P6` 推算(D15 的 +3–6 周按 P2 +1–2 / P5 +2–4 分摊)
= **20.5–32.5 周**。并行结构:
```
P0 ──▶ P1 ──┬──▶ P2(A)──────────────┐
            ├──▶ P3(B)──┐            ├──▶ P5(全员)──▶ P6
            └──▶ P4(C)──┘            ┘
```

建议角色:**C 位(P4 streamdown)必须是最强的人** —— 风险最高且无外部参照。

> 估算口径:含单测,不含需求返工与人员爬升期。若团队 Vue/Nuxt 经验不足,
> P0+P2 应上浮 30–50%。

---

## 8. 风险登记册

> 🔴 **本表的 `R` = Risk,与 §5 红线的 `R`(渲染层)是两套编号,在 `R1`–`R9` 段完全重叠。**
> 例:**风险 R3** = Pinia 单例跨 thread 泄漏;**红线 R3** = 产物自动打开须在带清理的 effect 里。
> **引用时必须写全「风险 R3」/「红线 R3」**(理由与约定见 §5 开头的编号图例)。
>
> 编号说明:`R5b`/`R5c` 是 R5 的派生项;**R1–R18 已按序排列**,无缺号
> (v3 修正了 R18 误插在 R5c 后、R13 掉到表尾两处错位)。

| # | 风险 | 概率 | 影响 | 缓解 |
| --- | --- | --- | --- | --- |
| R1 | **streamdown-vue 视觉/动画达不到 React 版质量** | 中高 | 高 | P4 独立小组 + 早期视觉对比工具 + 人工签字验收 |
| R2 | **B 类 12 条红线重新踩坑**(尤其右面板 #4465 类) | 高 | 中 | §5 分类已前置识别;对应 spec 作为守门人;code review 强制对照红线清单 |
| R3 | Pinia 单例导致跨 thread 状态泄漏 | 中 | 中 | ✅ **v3 已补设计:§3.3.1**(此前只写「P2 即定作用域约定」却无设计,是空档)。含:store 三分类 + reset 边界、五条可执行约定、`store-scope.test.ts` 守护测试、新增 `thread-switch.spec.ts`。<br>🔴 **顺带纠正一个错误前提**:React 版**不是**靠 Provider 卸载清理的(layout 无 `key`,App Router 复用),重置来自 `chat-box.tsx:81` 的手写哨兵 + `artifacts/context.tsx:89-101` 的 pathname 水合 effect → 迁 Pinia 反而是 1:1。<br>✅ **O17 已关闭**(2026-07-31):上游 main `0d8e11ad` 已让 `autoOpen` 随 pathname 重置回 `true`,跨 thread 粘滞不复存在,无需产品决策 |
| R4 | 🔴 **无 Vue resizable 库支持"拖拽中 vs 最终布局"事件区分** → **红线 P5** 无法实现,#4465 类 bug 重现 | 🔻 **中低**<br>(v4 下调) | **高** | **P0 go/no-go 检查点**(§2.3.2 缺口 A)。`artifact-panel-resize.spec.ts` 是守门人。<br>✅ **D19 已预授权自研 2–3 周** —— no-go 时**直接开工,不占审批时间**;该预算已含在 27–48 周上界内。<br>🔴 **v4 实测下调**:`splitpanes@4.1.2`(2026-05-26 仍在维护)**已同时 emit `resize` 与 `resized`** —— 与 React 版 `onResize` / `onLayoutChanged` 一一对应,**最硬的那条判据已满足**。剩余问号是**命令式 `collapse()`/`resize()`**(它是 `:size` 声明式驱动),P0 demo 从 1–2 天压到**半天**。详见 §2.3.2 |
| R5 | `getByRole` 中 38 次(dialog/option/menuitem/tooltip/combobox)在 antdv 下 role 不对齐 | 中 | 中 | 实测 83/122 天然对齐;余下由**薄包装层显式补 role**,或降级用 testid(§2.3.4)。P0 逐一实测 |
| R5b | ✅ **已消除(双重)**:antdv 在 Nuxt SSR 下样式注入产生 FOUC | — | — | 🔴 **D20 后该成因彻底不存在**(产品区 `ssr:false`,没有服务端渲染就没有 SSR FOUC)。⚠️ 但**主题闪烁**是另一回事,CSR 下仍需 hydration 前的内联脚本(§2.9.4)。原缓解:**§2.7 的参照工程已跑通**:`@ant-design-vue/nuxt` + `antd: { extractStyle: true }` + hydration 前设 `data-theme` 的内联脚本 |
| R5c | antdv token 与自有色板不一致(暗色模式尤甚) | **低** | 低 | ✅ **D15 后进一步降低**:不再需要桥「Tailwind ↔ antdv」两套体系,改为 `theme-palette.json` 单一真相派生三路(SCSS 变量 / CSS 自定义属性 / antdv token,§2.3.3),且**参照工程的实现可整条抄**(它本就是 SCSS) |
| 🔴 **R6** | **上游演进导致对标目标漂移** | 🔺 **必然**<br>(v4 上调,原「中」) | 🔺 **高**<br>(v4 上调,原「低」) | **D4 冻结基线 `16ea3a4d`**,上游变更进 v2 待办。<br>🔴 **2026-07-31 首次漂移**:合入 main 带来 6 个前端提交(18 文件 / +768 −99),按 **D4-a** 基线前移到 `b71a892b`。<br>🔴 **v4 实测重估 —— 原评级与数据不符**:`frontend/src` 近 6 个月月新增行 `4,935/6,326/14,653/4,023/6,657/22,815`(中位数 **≈6,500**,均值 **≈9,900**),**被改动过的唯一文件 453 个而现存总文件仅 389 个 → 文件级 100% 翻动**;当前全库 56,484 行。按 5–7.5 个月工期推算,上线时上游将多出 **33,000–74,000 行**,**量级与整个代码库相当**。<br>⚠️ 且漂移**精确压在关键路径**:2026-07 变更最大的是 `threads/hooks.ts` **+2,181**(P1 拆分规格 + P3 + P5)、`input-box.tsx` +1,905、`message-list.tsx` +1,485。<br>🔴 **这是唯一一个 P0 五个实验全部测不出来的风险** —— 它不是技术问题,是流程问题。<br>✅ **缓解:D26 上游冻结政策(§2.10)** —— 选定 (b):只 merge `backend/` + 安全补丁,`frontend/` 完全冻结在 `b71a892b`。**必须在开 P0 之前定** |
| R7 | Nuxt 版本/生态与我的选型判断不符 | 中 | 低 | P0 第一件事就是核实(§2.2) |
| R8 | ✅ **已缓解**:ai-elements 工作量被低估 | 低 | 中 | **D9 盘点已完成**:28→14 个,5,374→3,714 行。原分级两处反转已修正(§4.3)|
| R9 | E2E spec 因 §1.3 五条约束被打破而失效 | 中 | 高 | 五条约束写入开发规范 + PR 模板检查项;**更强的做法见 §2.7.6** —— **五条里四条可做成架构守护测试**(testid 集合 / 禁 `<div @click>` / 路由表比对 / cookie 名),与 R14 的缓解 ④ 是同一件事 |
| R10 | ✅ **已消除**:文档站(72 个 MDX)转换成本超预期 | — | — | **D6 已砍 docs 站**(连带 Nextra 与 72 MDX),O3 随之作废 → 本风险不再存在 |
| R11 | ✅ **已消除**:`sr-only` 去留悬而未决 | — | — | **D8 已定「砍」**,O16 关闭。5 处断言改 `getByTestId`,清单已全量核对(§0.4) |
| R12 | ✅ **已消除**:antdv `a-modal` 需支持"视觉隐藏但有 accessible name 的标题" | — | — | **D8 砍掉隐藏标题后该能力要求不再存在** |
| R13 | antdv `a-modal` 不把 title 接成 accessible name → 剩余 **12 次** `getByRole("dialog", { name })` 失效 | 中 | 中 | D5/D8 后我们不写任何 `aria-*`,这 12 次全依赖 antdv 内部实现 → **P0 ⑦ 必测**;兜底改 `getByTestId` |
| **R14** | **无 CI 门禁** → 「全绿」成为自我声明:忘跑 / 跑一半 / 本机环境差异都不会被拦;§1.3 五条约束只靠人肉 review | 🔻 **低**<br>(v4 下调,原「中高」) | 🔻 **中**<br>(v4 下调,原「高」) | ① `make verify` / `verify-full` 必须非零退出,禁止 `\|\| true`;② pre-push hook 跑 **`verify`(快门禁)** —— 🔴 **必须是快的那个**,把 123 个 E2E 挂 pre-push 等于逼人 `--no-verify`(§3.2.3);③ **P6 验收由第二人独立跑 `verify-full` 并签字**;④ **§1.3 五条约束做成 `tests/guards/`**(四条可机械化,§2.7.6);⑤ **`core-provenance.test.ts` 两层校验**(§3.1.2);⑥ **`tests/contract/` 进快门禁**(D14)。<br>🔴 **v4 下调依据(D11-a / §3.2.4)**:实测 14 个现有 workflow **全部按 `paths:` 过滤** → 新建 `frontend-vue-verify.yml`(`paths: frontend-vue/**`)**零修改现有文件、不触发任何现有流水线**,与 D10 同构。25 个 UI spec + `tests/guards/` + `tests/contract/` 全部变成 **CI 强制执行**。<br>⚠️ **仍未完全消除**:4 个真后端 spec 需真 Gateway,仍靠第二人签字 → 因此是「低/中」而不是"已消除" |
| R15 | 去掉 nginx-vue 后,SSE 不缓冲 / 长超时 / `X-Forwarded-Proto` 三项责任转移到 Nitro,漏做则流式体验废掉或登录 403 | 中 | **高** | 🔴 **本轮升级为可执行门禁**:`tests/contract/proxy-policy.test.ts` 的 6 条断言(**D14**,§1.2.1),跑在**快门禁**里 —— 从「P0 的一份检查清单」变成「每次 push 都执行的测试」。⚠️ **第 5 条 SSE 断言必须落在帧的到达时刻上**,只断言"最终收到 5 帧"在缓冲下也会通过 |
| 🔴 **R16** | **Nitro `routeRules` 的内置 proxy 可能本身就不支持无缓冲 SSE** —— 这不是"漏做配置",是**能力不具备**。若成立,`docker-vue/` 的单服务形态(§3.2.2)与 §3.2.1 的代理设计都要改成自写 h3 event handler | **中** | **高** | **P0 第一周用 1 小时证伪**:Nuxt + 一个每 200ms 吐帧的假上游,测首帧到达时间(§6 P0 建议执行顺序第 2 项)。**便宜、二元、失败即改架构 —— 与 resizable 同一类,不要排在骨架之后**。兜底:自写 h3 handler 仍不需要 nginx,只是 P0 ② 内容变化 |
| **R17** | **`threads/hooks.ts` 拆分引入语义漂移** —— 3,072 行 / 53 导出按名搬运,漏搬或"顺手优化"都会悄悄改变 C 类红线行为 | 中 | **高** | ① D13 的 **Tier 2 导出级比对**(§3.1.2)——36 个纯函数与 4 个类型逐个比对实现体;② §3.1.3 的两条纪律:**只搬不改**;③ P1 验收的**反向验证**:改 React 侧 `mergeMessages` 任一分支,`make verify` 必须红 |
| 🔴 **R18** | **D15 视觉对标漂移** —— 弃 Tailwind 后不能再逐字复制 className,约 200 个组件的间距/尺寸/层级要重新表达,**容易积累成"看起来差不多但处处不一样"** | **中高** | 中 | ① §0.3 保留 React 版就是为了**并排跑、逐屏 diff**,D15 后这条从"锦上添花"变成**必需**;② P2 前 3 个页面做完即**回推速率**校准 §2.4.5 的 +3–6 周;③ 颜色类一律走 CSS 变量(同源),漂移只可能出在间距/尺寸;④ ⚠️ **注意 E2E 看不见视觉漂移** —— 25 spec 断言的是文案/角色/testid,不是像素,**这条只能靠人工比对** |
| 🔴 **R21**<br>(**v4 新增**) | **规格空白区的功能漂移** —— 实测 ≈ **2,122 行**产品功能**没有任何验收判据**:6 个设置页 **1,604 行**(其中 🔴 `memory` **993**)、`/workspace/agents/new` **455**、`/auth/callback` **63**;另有 `login`+`setup` **719 行**只有需真 Gateway 的第二层覆盖。<br>🔴 **根因是策略的固有边界,不是疏漏**:继承的 25 个 spec 覆盖的是「React 版历史上出过 bug 的地方」,**不是功能全集**。<br>⚠️ **`memory` 与 `agents/new` 都是 §6 P2 点名的交付物,却没有判据** | **中高** | **中高** | ① 🔴 **P0 ⑱ 产出 `SPEC-GAPS.md`**,逐个定 A 补 spec / B 人工签字 / C 接受漂移(**§1.2.2**);<br>② `memory`(993)与 `agents/new`(455)**建议走 A** —— 体量大、是 P2 交付物,补 spec 各 0.5–1 天且可直接复用 `mock-api.ts`;<br>③ B 类进 **P6 验收清单**,由第二人逐屏对照 React 版(与 R18 的逐屏 diff 合并做,不额外增加一轮);<br>④ 🔴 **禁止第四种处置:不列、不定、默认它们会自动对上**。<br>📌 **与 R18 的关系**:R18 是**视觉**漂移(有实现、长得不一样),R21 是**功能**漂移(可能压根没实现)。**两者都逃得过三层验收,但 R21 更重** |
| 🔴 **R20**<br>(**v4 新增**) | **`ant-design-vue` 发布停滞** —— 实测 **`4.2.6` 发布于 2024-11-11,距今约 20 个月无新版本**;`dist-tags` 里 `latest=4.2.6`,`next`/`alpha`/`beta` 全停在更早的线上。对照同期:`@vueuse/core` 2026-07-29、`splitpanes` 2026-05-26、`@tanstack/vue-query` 跟随 `query-core` 同步发布 | **中** | **中** | 🔴 **这不构成推翻 D2 的理由**(D2 是"公司技术栈统一"的产品决策,antdv 4.x 本身稳定且兼容 Vue 3.5 / Nuxt 4)。但它改变两件事:<br>① 🔴 **P0 ⑦ 的实测结果就是终局** —— 那 38 次风险 `getByRole` 与 12 次 `getByRole("dialog",{name})`(风险 R13),**不能指望"上游以后会修"**;不达标就立刻降级 `getByTestId`,不要挂起等待<br>② **锁死版本**:`package.json` 已精确锁 `4.2.6`(无 `^`),不要为"可能有修复"去追新<br>③ **登记为长期技术债**:v2 需评估 antdv 若长期不随 Vue 主线更新时的升级/替换路径(与 O15 一起看)<br>⚠️ **方案此前只核到"版本存在 + 参照工程实跑通过",没做发布节奏这一层** —— 这是 v4 补的 |
| 🔴 **R19** | **跨阶段依赖:P5 的 `prompt-input` 硬依赖 P2 的缺口件 `command`** —— 实测 `prompt-input`(1,477 行,占 ai-elements 的 40%)含 7 个 `PromptInputCommand*` 导出,而 `command` 在 antdv 无对应物、属 §2.3.2 需重写的缺口件。**P2 的 `command` 做不到位 → P5 被堵**,而 P5 是 7–11 周的关键路径末端,返工代价最高 | **中** | **中高** | ① 把 `command` 的验收提前为 **P2 出口条件**(不是"P2 里做掉就行");② P2 做 `command` 时**直接拿 `prompt-input` 的 7 个用法当验收用例**,不要只按 `ui/command` 自身 API 验;③ P5 开工前置检查里显式列这一条。详见 §4.3.3 |

---

## 9. 需要你决策的开放项

以下是我无法代你决定、且会影响方案的点。**请在评审时明确。**

### 9.1 已决(见 §0.4 决策记录)

| # | 开放项 | 结论 |
| --- | --- | --- |
| ~~O1~~ | 对标基线冻结 | ✅ **D4** — 冻结 `16ea3a4d` |
| ~~O8~~ | 渲染模式 | ✅ **D1** — Nuxt + SSR |
| ~~O9~~ | UI 组件库 | ✅ **D2** — Ant Design Vue(影响分析见 §2.3) |
| ~~O10~~ | 共享层策略 | ❌ **D7 否决 D3** — 改为自包含复制(§3.1) |
| ~~O12~~ | 无障碍投入 | ✅ **D5** — Vue 版不写 `aria-*`,不额外投入;React 版不动。边界见 §0.4 |
| ~~O14~~ | D7 引出的生产暴露与 CI 归属 | ✅ **已拆解并关闭** —— **O14b 生产暴露** 由 **D10** 解决(新建 `docker-vue/`,§3.2.2);**O14a CI** 由 **D11** 解决(不做 GitHub CI,改 `make verify`,§3.2.3)|
| ~~O16~~ | `sr-only` 视觉隐藏文本去留 | ✅ **D8 — 一并砍掉**(24 处)。判定:对业务功能零影响。代价 5 处断言 / 3 个 spec,已全量核对(§0.4)。连带消除风险 R11、R12 |
| ~~O3~~ | 文档站(72 MDX)方案 | ✅ **D6 已砍 docs 站** —— 本项作废 |
| ~~O7~~ | landing 的 React-only 特效件 | ✅ **D6 已砍 landing** —— 本项作废 |
| ~~O13~~ | 「不能动 React 版」是否全局约束 | ✅ **D7 — 是全局约束**。只能改 `frontend-vue/`,其余一切不动 |
| ~~O4~~ | 共享包是否 PR 回上游 | ❌ **D7 后作废**(无共享包) |

### 9.2 仍待决

> ✅ **2026-07-31:四项已定案(D16–D19),一项已转为结论。本表只剩 O15 一个远期项。**

| # | 开放项 | 为什么需要定 | 何时必须定 |
| --- | --- | --- | --- |
| ~~**O6**~~ | ~~是否接受 §1.3 五条约束~~ | ✅ **D17 — 全盘接受**。五条进开发规范 + PR 模板;**其中四条做成 `tests/guards/`**(§2.7.6)进快门禁 | ✅ 已关闭 |
| ~~**O5**~~ | ~~团队规模与 Vue/Nuxt 经验~~ | ✅ **D16 — 有 Vue+Nuxt 实战经验**。按基准口径,**54 周尾部情景消除**;区间仍 27–48,但跨度只剩两个已识别项 | ✅ 已关闭 |
| ~~**O11**~~ | ~~resizable 自研预算~~ | ✅ **D19 — 预授权 2–3 周**,P0 若 no-go 直接开工,不再等审批 | ✅ 已关闭 |
| ~~**O17**~~ | ~~`autoOpen` 是否跨 thread 保留~~ | ✅ **D18 — 切 thread 重置为 `true`**(与 React 有意不同,实测 **0 处 spec 改动**) | ✅ 已关闭 |
| ~~**O2**~~ | ~~React 版 `frontend/` 的去留时间点~~ | 🔴 **已不是待决项,是既定前置条件** —— **D15 之后 R18(视觉漂移)只能靠与 React 版逐屏 diff 兜住**,而 E2E 断言的是文案/角色/testid、**不是像素**。<br>**结论:P5 视觉签字前不得退役 `frontend/`。**(D4 的冻结基线 `16ea3a4d` 本就要求它原地不动) | ✅ 转为结论 |
| **O15** | v2 是否重新评估共享包方案 | ⬇️ **紧迫度已由 D12 下调**:共享包的核心价值是「避免两份拷贝发散」,而 `core-provenance.test.ts`(§3.1.2)已机械保证了这一点。剩余差异只是「改一处 vs 改两处」的人力,不再是正确性风险 | v1 上线后 |
| ~~🔴 **O18**~~ | ~~D26 选哪个(上游冻结政策)~~ | ✅ **2026-07-31 已关闭 —— 用户定案 (b)**:只 merge `backend/` + 安全补丁,`frontend/` 冻结在 `b71a892b`。<br>✅ **当天即完成第一次验证**:随后那次合入 main(`b71a892b`)实测 `frontend/` **零漂移**,见 **D4-b** | ✅ 已关闭 |
| ~~**O19**~~ | ~~是否接受 D11-a 上 GitHub CI~~ | ✅ **2026-07-31 已关闭 —— 用户定案「上」**:新建 `frontend-vue-verify.yml`(`paths: frontend-vue/**`),零修改现有文件。**R14 由「中高/高」降为「低/中」**,详见 **§3.2.4** | ✅ 已关闭 |

---

## 10. 我对这个方案的判断

**可行,且已无待决项、无阻塞项 —— 可以开 P0。**
🔴 **2026-07-31 v4 定稿**:O18(D26 上游冻结,选 (b))与 O19(D11-a 上 CI)均由用户拍定,
基线已按 **D4-b** 重冻至 `b71a892b`(`frontend/` 零漂移,数字全部保持)。
剩余的 **O15**(v2 共享包)是远期项,不影响开工。

决策定稿后,方案的结构风险已经收敛。
剩下的执行风险集中在五处:**§5 的 B 类 12 条红线**、**R16(Nitro 能否无缓冲透传 SSE)**、
**R18(D15 的视觉对标漂移)**,以及 🔴 **v4 新加的 R6(上游漂移)** 与 🔴 **R21(规格空白区)**。

> 🔴 **v4 末轮补充:「验收即规格」这个骨架有一处此前没人说破的边界。**
>
> §1 把「功能完全一样」变成可执行的二元判定,这是方案最好的设计。
> **但它判的是"有判据的那部分"** —— 实测 ≈ **2,122 行**产品功能**没有任何判据**
> (6 个设置页 1,604 含 `memory` 993、`agents/new` 455、`auth/callback` 63),
> 而 **`memory` 与 `agents/new` 恰恰都是 §6 P2 点名的交付物**。
>
> 根因是策略的固有代价,不是疏漏:**继承的 25 个 spec 覆盖的是「React 版历史上出过 bug 的地方」,
> 不是功能全集**。§1.1 的「继承 43%」是**行数口径**,不是**判据口径** —— 此前两者被混着用了。
>
> 🔴 **R21 比 R18 更重**:R18 是"实现了但长得不一样",R21 是"可能压根没实现" ——
> **两者都能逃过三层验收全绿。** 处置见 §1.2.2 与 P0 ⑱。
~~R14(无 CI 门禁)~~ 已由 **D11-a** 大部分关闭(§3.2.4)。

> 🔴 **v4 补充判断:前七轮把「内部一致性」做到了很高的水平,薄弱点全在「外部现实」。**
>
> 这不是批评那七轮 —— 恰恰相反,**正因为内部账目已经闭合,外部的问题才显出来**。
> 六项修正的共同形态是:**方案核实了"这个包/这个数存不存在",但没核实"它在真实环境里会怎样"**:
>
> | 修正 | 核过的 | 没核的 |
> | --- | --- | --- |
> | **D26** | D4 冻结了**对标基线**(拿哪个 commit 当规格) | 上游**会不会继续动**,以及动多快(实测:6 个月文件级 100% 翻动) |
> | **D25-a ①** | `crypto.randomUUID()` **是标准 API** | 它 **secure-context-only**,而部署形态是内网 **HTTP** |
> | **D24-a** | React 版 `@tanstack/react-query` **是运行时依赖**(所以不能像 D21/D23 那样本地化类型) | Vue 对应物 **peer 里根本没有 react**(所以也不必自研) |
> | **D13-a** | v3 已发现"无 React 依赖"是按 `from "react"` 量的,并修了 lucide-react | D21/D22/D23 又新增三个待删包之后,**这次测量没有重跑** |
> | **§4.2.5** | `hast-util-to-jsx-runtime` **在 React 生态里** | 它 `peerDependencies` 为 `null`,而 **`vue` 导出 `./jsx-runtime`** |
> | **R20** | antdv 4.2.6 **版本存在 + 参照工程实跑通过** | 它**发布于 2024-11-11,20 个月无新版** |
>
> 🔴 **可提炼成第四条铁律**(前三条见 HANDOFF §〇):
> **「核实一个依赖,要核三层:版本存在 → peer 兼容 → 真实运行环境与维护节奏。」**
> 前七轮反复在第一层和第二层上抓到错(§2.8.3 记了 12 处),
> **v4 抓到的全部在第三层。**

> 🔴 **关于 D26 的判断 —— 这是 v4 唯一一条我认为比工期数字更要紧的**:
>
> 方案对工期做了六轮口径修正、追到 0.5 周的精度;
> 而**上游漂移这笔账从头到尾没有定价** —— 它的量级(33,000–74,000 行)
> **比全部六轮修正加起来还大一个数量级**,却不在 §7 的任何一行里。
>
> 更麻烦的是它的**分布**:2026-07 变更最大的四个文件全部落在 P1/P3/P5 关键路径上,
> 其中 `threads/hooks.ts` 一个月动了 **2,181 行** —— 而 D13 的拆分规格正是按它的快照写的。
>
> **这条不定就开 P0,等于把一个已知会发生的成本推给未来的自己。**

> 🔴 **关于 D15(弃 Tailwind 改 SCSS)的判断 —— 这是唯一改变了对外口径的决策。**
>
> 技术上完全成立,而且有两处比预期好:① **E2E 只受影响 2 处**
> (`chat.spec.ts:481/500` 的 `span.font-medium`;其余 6 处 class 选择器要么在 D6 已砍的
> spec 里,要么是语义类)—— 与 D5/D8 那 5 处同样处理即可;
> ② **参照工程本来就是 SCSS**,§2.7.1 原先记着的「真相源不同」那处差异**直接消失**,
> 主题链可整条抄,反而省 1–2 天。
>
> 但成本是真的,且**性质与之前所有决策都不同**:D5–D14 动的是某个模块或某种机制,
> **D15 动的是每一个组件的撰写方式** —— 失去「className 字符串逐字复制」这个对标捷径后,
> 约 200 个组件要重新表达间距/尺寸/层级。**+3–6 周,把上界从 42 推到 48 周。**
>
> 🔴 **最需要警惕的不是工期,是 R18**:E2E 断言的是文案、角色、testid,**不是像素** ——
> **视觉漂移在 25 spec 全绿的情况下依然会发生**。所以 §0.3「保留 React 版做逐屏 diff」
> 这一条,在 D15 之后从"锦上添花"变成了**必需**。

> 📌 **2026-07-31 彻底修复后的补充判断**:本轮逐项复核暴露的问题**没有一条动到 D1–D12
> 或分期结构**,但有两条会让方案在落地时卡住,已修:
> ① **D12 的文件级哈希在 C 类红线最密集的文件上必然失效**(`threads/hooks.ts` 必拆)
> → D13 改为两层校验 + §3.1.3 拆分规格;
> ② **25 spec 走 `page.route()`,结构上永远看不见 Nitro 代理层**,而那层恰是 D10 之后
> 最新、最无参照的基础设施 → D14 把验收拆成 UI 层 + 代理层。
>
> 其余六条是记账不一致(组件计数沿用 D6 前的数、D9 收益漏计入总账、两处残留「4 处」、
> 路径写法分叉)。**它们不改变任何决定,但它们同时藏住了一笔收益和一笔成本** ——
> 修的价值不在那 1 周,在于**恢复"文档里的数字可以直接拿去排期"这个前提**。

**关键资产仍然继承得到**:D7 否决共享包后,22,400 行可继承资产**一行都没少** ——
只是从"共享"变成"复制"。13,668 行纯 TS(含 i18n 3,086 行词典)、1,411 行模拟后端、
25 个 E2E spec,全部照搬进 `frontend-vue/`。§1.2 的验收骨架完全不受影响。

**D7 的真实代价是长期的、不是当下的**:两份拷贝并存,§5 C 类的 29 条红线分处维护。
短期反而省 2 周工期。这是一个明确的取舍,建议在 v1 上线后按 O15 重新评估。

**警告**:真正的风险不在"Vue 不会写",而在 **§5 的 B 类 12 条**。
这些是 React 版用真实缺陷换来的经验,在 Vue 下会以不同形式重现 ——
右面板拖拽(#4465)、流事件合并时序、跨 thread 状态清理、effect 清理时机。
现有 spec 能守住其中大部分,但**不是全部**(尤其 R3 的跨 thread 泄漏)。

建议把 §5 的 B 类清单直接做成 PR 模板的 checklist。

> 🔴 **一条实测得来的纪律:反向验证本身也会有 bug。**
> 每条守护测试都要求「故意引入缺陷 → 检查必须失败」,但**必须先确认破坏确实生效**。
> 实例:在参照工程里验证分包断言时,破坏写成 `false && id.includes('ant-design-vue')`,
> 而原分支是 `if (A || B)` —— `B` 仍成立,chunk 照常产出,**测试假绿**,
> 差点据此误判「该修复没做对」。**先确认破坏落地,再判定测试有效性。**

> ⭐ **更强的一步(§2.7.2 第 5 项)**:参照工程用 `docs-sync` 把「文档声明 ↔ 代码位置」做成
> **机械校验的 claims**,并强制每个文件带职责头(实测 124/124 = 100%)。
> 用它承载 **C 类 29 条**(住在 `app/core/` 纯函数里、可定位到具体文件的那些)比 checklist 可靠得多;
> **B 类 12 条**因为是「设计时的思考方式」而非「某文件的属性」,仍只能靠 checklist + code review。
> 这个区分很重要 —— 别指望机械检查能守住 B 类。

### 10.1 关于 D2(Ant Design Vue)的补充判断

我原推荐 reka-ui,你定了 antdv。做完 §2.3 的实测分析后,我认为**这个决定的代价可控**,
理由是三个实测结果比我的先验估计乐观:

1. **只有 14/32 个存活组件原语真正涉及 UI 库**(D6+D9 后)—— **15 个**是自研/纯样式,
   与选哪个库无关(⚠️ 旧文写 21,那是 D6 砍掉 6 个特效件**之前**的数,见 §2.3.1.1)
2. **83/122 次 `getByRole` 落在原生 HTML 元素上** —— 天然对齐,不依赖库的行为
3. 余下 38 次有明确兜底(包装层补 `role`,或降级 testid)

净上浮约 2–5 周,换来公司技术栈统一和团队上手速度,我认为划算。

**但有一个真实的新增风险需要你知道**:antdv 不提供 resizable panel group,
而右侧三面板系统承载了 **08 号** §8.3 的 5 条红线和 issue #4465。
这个缺口**与 antdv 的选择无关**(reka-ui 也不提供),但因为选了 antdv 就不能靠
"同源生态顺带解决",必须独立立项。已列为 P0 的 go/no-go 检查点(R4 / O11)。

---

### 10.2 关于 D7(只能改 `frontend-vue/`)的补充判断

D7 是约束最强的一条决策,但它**没有伤到方案的核心** —— 因为 §1 的验收骨架
(以 E2E 套件作为可执行规格)本来就只要求"复制 spec + 指向新服务",不要求改 React 版。

D7 实际改变了三件事:

| | 影响 | 严重度 |
| --- | --- | --- |
| 共享包作废,改为复制 | 短期 **省 2 周**;长期两份代码发散 | 🟡 可接受,已记录(O15 复评) |
| 不能接 Nginx | Vue 版独立起服务 + Nitro 代理(§3.2.1)。技术上完全可行 | 🟢 低 |
| ~~生产暴露与 CI 落在范围外~~ | ✅ **已解决**:D10 建 `docker-vue/`(§3.2.2)+ D11 不做 CI 改 `make verify`(§3.2.3) | 🟢 **O14 已关闭** |

第三项是唯一需要你现在处理的:Vue 版做完了,**怎么让公司同事访问到、怎么进 CI**,
这两件事的配置文件都在 `frontend-vue/` 之外。我可以把 Vue 版做成"独立可运行"
(`pnpm dev` 起 :3001、自带 Gateway 代理、自带 Playwright 配置),
但从这一步到"生产可访问 + CI 有门禁",需要有人改 `docker/` 或 `.github/`。

---

**评审关注建议**(按重要性,🔴 **2026-07-31 v4 已重排 —— 前三条都是 v4 新增**):

0. 🔴 **§2.10 上游冻结政策(D26)** —— **全案唯一一个既不在工期表里、也测不出来的成本**,
   ✅ **O18 已由用户定案 (b),D4-b 已重冻基线**。这一节仍是本轮最该先看的,因为 P0 期间每次 merge 都要按 §2.10.5 执行
0b. 🔴 **§2.4.6 ① `crypto.randomUUID` 的 secure-context 问题(D25-a)** ——
   **会在上线当天炸、开发机永远复现不了、25 个 E2E 也抓不到**的一条
0c. 🔴 **§3.1.4 DETYPED(D13-a)** —— `core-provenance.test.ts` 第一天报 13 个红,
   以及 Tier 1 从 10,400 修到 7,215
0d. **§2.8.7(D24-a 装 vue-query)/ §3.2.4(D11-a 上 CI)/ §4.2.5(P4 可能省掉渲染末端)/ R20(antdv 20 个月未发版)**

以下为 v3 的排序,仍然有效:

1. 🔴 **§1.2 + §1.2.1 验收定义(D14)** —— 整个方案的骨架(O6)。**重点看为什么 25 spec
   结构上看不见代理层**:这是本轮发现的最实质盲区
2. 🔴 **§3.1.2 + §3.1.3 溯源校验与拆分规格(D13)** —— 文件级哈希为何在 `threads/hooks.ts`
   上必然失效,以及两层校验怎么补上。**D12 的价值全押在这里**
3. 🔴 **§2.4 弃 Tailwind 改 SCSS 的影响分析(D15)** —— **唯一改变了对外口径的决策**
   (`6–10` → `≈7–12 人月`)。重点看 §2.4.3(成本落在哪)与 §2.4.5 的口径说明:
   **「+3–6 周」是全案最不确定的数字**,建议 P2 前 3 个页面后用实际速率回推
4. **§2.3 Ant Design Vue 影响分析** —— 含 P0 的 resizable go/no-go 检查点(R4);
   组件计数以 **§2.3.1.1 存活口径表**为准
5. **风险 R14 / R15 / R16 / R18** —— 无 CI 门禁的代价、代理三项责任、
   **Nitro 能否无缓冲透传 SSE(R16,P0 第一周 1 小时证伪)**、
   以及 🔴 **R18 视觉对标漂移(D15 引入,E2E 看不见,只能人工 diff)**
6. **§5 红线分类**(尤其 B 类 12 条) —— 真正的技术风险所在
7. **§6 P0 的「建议执行顺序」** —— D22 stream contract fixture + resizable + Nitro SSE + Nitro 鉴权,
   都是便宜、二元、失败即改架构的实验,先于骨架
8. **§9.2 其余** —— 只剩 O15(远期共享包复评)
9. ✅ ~~§9.2 O14~~ —— 已由 D10 / D11 关闭,不再阻塞
