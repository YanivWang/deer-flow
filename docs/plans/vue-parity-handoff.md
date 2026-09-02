# React → Vue 对照对齐：轮次交接文档

**这份文档是每一轮开工的第一读物。** 它记录「上一轮做完了什么、下一轮做什么、
有哪些账挂着」。深度背景（139 条踩坑线索、每一轮的实测记录）在 Claude 的记忆文件
`deerflow-parity-harness-plan` 里；这里只放接手一轮所需的最小集合。

**每推完一个阶段（一轮 wave），就地更新这份文档，然后开始下一轮。**

---

## 当前状态（截至 wave 30，2026-09-02）

- 分支 `main-wc`。`453174c8` = wave 30。
- wave 30 **没有动 `frontend/`**，**upstream marker 仍在 `c78bc91c`**（wave 28 推的）。
- **对照台账 0 行**，**39** 个样本，`make -C frontend-vue e2e-parity` **47** 条全绿。
- 覆盖率棘轮：covered **24**，pending **仍是 1 条**（`chat-thread-init-ordering`）——
  wave 29 **实测**过，结论是**不能加**，翻案判据写在 `$pendingReasons` 里。
  **wave 30 没有碰它**（正题是给现成场景加一步，不是加场景）。
- 已彻底对齐的域（14 个 + settings/memory）：chat / artifacts / 会话列表 /
  scheduled-tasks / channels / integrations + 设置外壳 / mermaid / subtask-card /
  workspace 头部 / sidebar / messages / sidecar / browser / composer，
  外加 **settings 域全部**（wave 22~24）、**auth**（wave 26：`/login` 58→0）、
  **只读案例页**（wave 27：`/showcase/<id>` 29→0）、
  **建 agent 页**（wave 28：`/workspace/agents/new` 9→0）、
  **composer 的焦点 + follow-up 整簇**（wave 29）与
  **划词工具条整簇**（wave 30：aria 1→0，位置从 (955,642) 挪到与上游逐像素相同的
  (367,197)）。

> **`app/pages/` 下的路由已经一条不剩地量过了**（wave 28 量完最后三条）。
> **要找活只能去「挂着的账」里挑**，不要再指望「还有没量过的路由」。

> **settings 域有一个取样点**（`settings-notification`，wave 25 的 `stubs`）。
> 其余六个面板仍然没有合法的场景 id（棘轮要求 id 逐字等于 React spec 文件名），
> 它们的差异只能靠 probe 找、靠单测守（线索 107）。

### 门禁实测值（wave 30 收工时逐条跑过）

```
make -C frontend-vue verify        exit 0；238 文件 / 1995 单测，词典 953 key、39 unused
                                   standalone-check BLOCKING 0 处 / 0 个文件
make -C frontend-vue e2e-parity    47    台账 0 行，39 样本（NEW=0 GONE=0）
make -C frontend-vue e2e-mock      262 + 21 + 15 + 2 + 6   (= e2e + auth + infra + proxy-options + stream)
make -C frontend-vue e2e-backend   2 + 5 + 2 + 3 + 3 + 5 + 1 + 1
make -C frontend-vue e2e-visual    8    **不在 make e2e 里**
make -C frontend-vue e2e-external  3
```

产品 SFC **215**（总 217，wave 30 没有新增 SFC）。动了 `frontend/` 再加
`python3 scripts/pnpm.py --dir frontend check` / `test`（**1022**）/ `test:e2e`（**146**）。

**已知的两条负载抖动**（都不是产品缺陷，但每次遇到都要重新证一遍因果）：

1. `frontend/tests/e2e/landing.spec.ts:61`——`locator.boundingBox` 等动画区的
   `.max-w-6xl`，wave 20~23 与 wave 28 都遇到过。
2. **`frontend-vue/tests/e2e/channels.spec.ts:1020`（wave 29 新增）**——
   「channel query 401 follows the shared login redirect」。它 `page.goto` 之后用
   **5s** 等 `/login?next=`，而那次跳转要等水合完成、`providersQuery` 发出去、
   拿到 401、`fetchWithAuth` 才 `window.location.href`。wave 29 在 **load 41** 时红过
   一次，随后在 load 3~10 时 `--repeat-each=5` **5/5 全绿**。
   因果链是 `layouts/workspace.vue → ThreadSidebar → WorkspaceChannelsList →
   useChannelConnections → providersQuery → fetchWithAuth 401`，
   wave 29 改的三个文件一个都不在这条链上；而且 **ThreadSidebar 本来就 import
   `ui/dialog`**，所以那一轮往 ChatComposer 里加的 Dialog 没给这条路由的
   critical path 添任何模块（同一次跑里 `/workspace/chats/new` 的 route-payload 是过的）。

**wave 30 这两条一条都没遇到，全程零重跑**：六个套件各跑一遍全绿，条数与 wave 29
逐条相同（只有单测从 1975 涨到 1995，是本轮新增的 20 条）。

### 开工前必查

```bash
for p in 8021 3115 3116 3114 8018 3101 3109; do lsof -ti:$p; done
```

```bash
ls frontend/.next/BUILD_ID frontend-vue/.output/server/index.mjs frontend-vue/.output/nitro.json
```

端口都该空，三个文件都该在，`git status` 干净。残缺的构建产物会让整轮以
`Process from config.webServer exited early` 收场。

---

## 四条硬规则

1. **台账保持 0。** 不要用 `make parity-accept` 收工。跑完门禁拿
   `test-results/e2e-parity/report.json` 与 `baseline/parity-diff.json` 逐条比，
   NEW 和 GONE 都必须是 0。新增场景时基线加一条**五个数组全空**的记录。
2. **归一化/取样规则只能因为实测而增加。** 每一条都在抹掉信息。
3. **不要靠重跑收工。** 「偶尔红」先当真缺陷查——先证因果够不着，再谈负载。
4. **「本仓可能更好」的取舍自己定，不要中途提问**（2026-09-02 用户明确）。
   判据仍是「这处不改，React 自己是不是也是坏的？」，但把选了哪边、代价是什么
   **单独列进提交说明的一节**。

### 边界

默认只改 `frontend-vue/`。**根因确实在 `frontend/` 时可以两边同改**——同一处修法
同时落到两个应用，两边的树仍逐行一致，台账不增行。判据：**这处不改，React 自己是不是
也是坏的？** 是，才动 `frontend/`。改完必须跑 `make -C frontend-vue upstream-accept`
并**单独提一个 chore 提交**（范本 `git show 6912c5cf`）。**React 侧注释写英文。**

> **wave 28 用的判据，下一轮可以直接抄**：**没有可访问名的交互控件**算缺陷（读屏器
> 只念得出「按钮」），**命名弱但存在、或缺一层播报**算风格不算缺陷。前者两边同改，
> 后者照抄上游。判缺陷时最强的证据是**同一份代码库里的既定写法**——
> wave 28 那颗返回键的邻居（同一个 header 里的 More）写着 `aria-label`，
> 那两处同形的表单错误（`account-settings-page.tsx:133`、`human-input-card.tsx:339`）
> 都写着 `role="alert"`。

### 台账天生看不见的八类差异

① 需要交互才看得见的；② 藏在请求 body 里的；③ portal 出去还会遮蔽页面的浮层；
④ 顺序与层级（aria 去缩进后按多重集比）；⑤ primitive 的默认值；
⑥ 只在某种后端状态下才分叉的渲染路径；⑦ **这一屏压根没被取样**；
⑧ **焦点**（`document.activeElement`，见下）。

wave 20/21 连着两轮正面打了 ① 和 ⑦。**判据：一个域收工前，把它所有「点一下才出现」
的东西列出来，逐个问「这一屏进过取样面没有」。** 挂展开态很便宜：场景 id 受
`baseline/parity-scenario-coverage.json` 的棘轮约束，但**夹具与 steps 不受**，
直接挂现成场景，基线不用加记录。

**wave 28 补了第八类：焦点。** `document.activeElement` 不进 aria 快照，也不是几何量，
所以「打开这一屏之后光标在哪」这件事，**台账、probe 的 aria diff、几何三样都看不见**。
probe 里顺手记一行 `page.evaluate(() => document.activeElement)` 就能量到——
wave 28 正是这样发现建 agent 页与 composer 都少了 autoFocus（**composer 那一条
wave 29 已经做掉**）。

**wave 29 给第⑦类补了一条推论**：一屏「没被取样」可能不是因为没人写场景，
而是因为**上游在那一屏上不确定**——`chat-thread-init-ordering` 就是这样。
遇到这种，先量再决定，不要硬加；量出来的数字本身就是产出。

**wave 30 给第⑦类补了第二条，而且它比第一条常见**：一屏没被取样，可能是因为
**已有的那条场景在最后一步把它关掉了**。划词工具条挂了九轮「要一条新场景」，
真相是 `sidecar-chat` 的 steps 是 `select-text` → **click** → 等面板，
而两个应用都在那次点击里清掉选区。**判据：一个「点一下才出现」的东西如果还没进
台账，先去看已有场景的 steps 是不是刚好走过它又走开了；给现成场景加一步比新加
一条场景便宜得多，而且不动棘轮。**

---

## 上一轮（wave 30）做了什么

正题是**划词工具条整簇**。它挂在「挂着的账」里九轮，一直写着「要守住它需要一条
**取样在选中态的新场景**」。这一轮先把这句当假设重新验——**假设是错的**，
然后按测出来的数字把整簇差异修掉。

### 一、翻掉「要新场景」那句话（本轮最值钱的产出）

`select-text` 这条步骤 wave 21 就有了。挡路的不是步骤词汇，是**唯一在用它的那条
场景把它点掉了**：`sidecar-chat` 的 steps 是 `select-text` → click「Ask in side chat」
→ 等面板，而两个应用都在那次点击里清选区（React `setSelectionToolbar(null)` /
本仓 `selection.value = null`），稳定态里自然没有工具条。

**不点就取得到。** 一次性 probe 把一步 `select-text`（不点）挂在
`streaming-reasoning-order` 上，两个应用各取一份，**当场量到两处差异**：

| 变体 | onlyReact | onlyVue | 工具条位置 React | 工具条位置 Vue |
|---|---|---|---|---|
| 选 **AI** 正文 | `- button "Close"` | （空） | (367,197) 337×42 | (955,642) 293×46 |
| 选 **人类** 正文 | （空） | `- button "Add to conversation"` / `- button "Ask in side chat"` | 不出 | 出 |

选区 rect 两边**逐像素相同**（376,247,320×18），所以位置差的整整
588×445 px 全是本仓这一侧。第二行是白捡的：上游只在 assistant 组的 ai 消息上挂
onMouseUp，本仓挂在**每个组**上。

场景 id 受棘轮约束，**夹具与 steps 不受**——所以这一步是加在**已经 covered 的**
场景上的，基线不用加记录，covered 24 / pending 1 没变，套件仍是 47 条。

### 二、整簇修掉的八处

1. **锚在选区上**（headline）。上游 `message-list.tsx:1328` 是
   `style={{ left: x, top: y }}` + `-translate-x-1/2`，x 取选区中线、y 取上沿减 8；
   本仓原来是 `fixed right-8 bottom-28`，与选中的是哪一段完全无关。
2. **放不下就翻到选区下方**。判据 `rect.top - 8 - 48 >= 0`（`SELECTION_TOOLBAR_MARGIN`
   与 `SELECTION_TOOLBAR_ESTIMATED_HEIGHT` 两个常量与上游逐字相同），
   class 上跟着在 `-translate-y-full` / `translate-y-0` 之间切。
3. **第三颗关闭键**（`aria-label` = `common.close`，×）——台账上那一行就是它。
4. **两颗动作按钮各带图标**（`MessageCircle` / `MessageSquarePlus`，`size-3.5`）。
5. **三颗都换成 `<Button variant="ghost" size="sm">`**，容器从 `bg-background rounded-md
   shadow` 换成 `bg-popover text-popover-foreground rounded-full shadow-lg`。
6. **`@mousedown.prevent`**：默认 mousedown 会先折叠选区，高亮跟着消失。
7. **只在 assistant 组的 ai 消息上起**，且**流式期间整屏不起**（上游 `thread.isLoading`）。
8. **滚动就收起**（window 的**捕获**阶段——真正在滚的是会话流那个容器，
   scroll 不冒泡到 window）。

**顺带修掉一处机制差**：归属判定从「`text(message)` 的子串」换成上游的
「anchor/focus 两个节点在不在这一轮里」。`text()` 给的是 markdown **源码**，
选区里是**渲染之后**的文字，一段跨越行内标记的选区（`this is **bold** text` 上选
"is bold te"）在源码里根本不是子串，于是本仓**静默不弹工具条**，上游照弹。

改完复量：两个变体 aria 都是 **0/0**，工具条 rect 两边都是 **(367,197) 337×42**。

### 三、两条新守卫（都是「哪一行代码读它」问出来的）

1. **`select-text` 的 `scope` 此前不受定位方式检查**。
   `scenario-coverage.test.ts` 那条「只用两边共有的定位方式」写的是
   `if (!("target" in step)) continue;`，而 `select-text` 用的是 `scope`——
   整类步骤被静默跳过。**步骤词汇加新形状时，这条守卫要跟着加。**
2. **「工具条留在取样面里」本身没有守卫**：把那一步删掉，没有任何门禁会红，
   工具条会静默退出取样面（线索 131 的同一条机制）。现在钉的是
   「有场景的**最后一步**是 select-text」——这正是「取样时刻工具条还在」的充要条件。

### 四、位置为什么只能靠单测守

`sampleGeometry` 只量 **settle 里的 `visible` 锚点**（capture.ts 的函数头写着为什么：
click/fill 的目标在交互之后可能已经移动或消失）。而 settle 跑在 steps **之前**，
所以工具条不可能成为 settle 锚点。结论：**台账看得见工具条的可访问性树，看不见它的
位置**。位置、翻转、`@mousedown.prevent`、各条不该出现的判据，全部由
`tests/unit/chat/selection-toolbar.dom.test.ts`（19 条）守。

happy-dom 里 `Range.getBoundingClientRect()` 恒为全 0，造不出「贴着视口顶端」这种
场景，所以那个文件把 `getSelection` 换成一份可控替身，被测的是 `onSelection` 里
那段判据本身。

### wave 30 自审抓出来的（都已修）

1. **注释里写 `sidecar.selectionCrossesMessages` 会让它从 unused 集里消失**
   （线索 126 的现场复发）：那条 key 现在仍然是死条目，带点写会让 unusedTotal
   从 39 掉到 38，`doc-facts` 当场红。改成「sidecar 下的 selectionCrossesMessages」。
2. **负向验证抓出一条真的假绿**：把 `group?.type !== "assistant"` 整句删掉，
   全部用例照样绿——「人类轮次」那条用例会被后一句 `message.type !== "ai"` 顺手挡住，
   两条判据在那个输入上**重叠**了。能把它们分开的只有 **assistant:processing 组**：
   它的 `messages[0]` 恰恰**是**一条 ai 消息。补了一条用例，C1 转红。
3. **第一版把「流式期间不起」的用例写在单轮会话上，恒红**：流式期间那一轮的 ai
   消息进的是 `assistant:processing` 组，压根没有 `data-assistant-turn`，
   取锚点就失败。改成两轮会话、划**已经结束**的第一轮，并配一条同夹具的
   非流式对照——只有这一对才在测「流着的时候整屏都不给划」。

### wave 30 新增的踩坑线索（记忆里编号 136~139）

- **136. 一屏没被取样，可能是已有场景的最后一步把它关掉了。** 见上面第①条。
- **137. `sampleGeometry` 只量 settle 锚点，而 settle 跑在 steps 之前**——
  所以**任何靠交互才出现的东西，位置都进不了台账**，只能单测守。
- **138. 两条判据可能在你写的那个输入上重叠，于是删掉一条也不红。**
  负向验证发现假绿时，先问「有没有一个输入能把这两条分开」，再补用例。
- **139. lucide-vue-next 会自动补 `aria-hidden="true"`**（`hasA11yProp`：
  没有 aria-*/role/title 才补），与 lucide-react 行为一致。本仓有几处手写了
  `aria-hidden="true"`，那是冗余而不是必需。

## 下一轮（wave 31）：三条路，挑一条

`app/pages/` 下的路由已经量光，**只能从「挂着的账」里挑**。wave 30 把其中一条
（划词工具条）做掉了，剩下的按性价比：

1. **流式警告 toast vs 内联横幅**（上游 `core/threads/hooks.ts:1805`；本仓
   `AgentChat.vue` 的 `warnings` 渲染成 `absolute right-4 bottom-36` 的
   `<p role="status">`）。**这一轮值得先做**：它现在是**一整簇**了，不只一处——
   wave 30 又往里放了一条（划词选区跨轮次时上游 toast、本仓静默），加上
   `handleSubmitHumanInput` 的 catch、种子取数失败那条，一共四处走同一个决定。
   做之前先答一个问题：本仓已经有**三套**播报机制（`workspace-shell/toast` 的
   全局 toaster、ChatComposer 的局部 `toast` ref、MessageList 的 `actionError`
   内联区），这一轮要么统一，要么明写谁管谁。
2. **`border-border` 基础层**（本仓 `main.css` 没有 `* { @apply border-border }`）。
   影响全仓，压不住就要拆两轮。
3. **`/auth/callback` 的结构性对齐**（会把 `/login` 的服务端跳转变成客户端跳转，
   要先跑一遍上游的 e2e-auth）。

另外三笔小账：**`Button` 的 as-child**、**chip 编辑区**（wave 30 复查发现它比
「span vs div」大，见下）、**词典手术**（三簇按叶子名匹配扫描器看不见的死条目 +
39 条 unused 复核）。

### 还剩几轮（**估计，不是实测；下一轮仍要当假设重新验**）

wave 29 估的是 7~9 轮，wave 30 做掉了其中一条「必须单独一轮」的。重估：

- **必须单独一轮（3~4）**：上游 toast 那一簇（四处一起）、`border-border` 基础层
  （影响全仓，压不住要拆两轮）、`/auth/callback` 结构性对齐（会把 `/login` 的
  服务端跳转变成客户端跳转，**要先跑一遍上游的 e2e-auth**）
- **可合并的小账（1~2）**：`Button` as-child、chip 编辑区、命令面板名字、
  模型选择器筛选、欢迎区在树里的位置、browser 面板剩余分叉
- **词典手术（1）**、**收尾复量（1）**
- **被上游阻塞（0 轮，只记账）**：首次发送后那一屏的 `Completed in <1s` 与
  `Edit and rerun`，要等上游那条 history/stream 竞态
- **已决定不做（0 轮，只记账）**：逐条写在「挂着的账」里

合计 **6~8 轮**。**wave 30 的教训是这个数字可能偏悲观**：划词工具条被记成
「必须单独一轮的结构性改动」，实测只是「给现成场景加一步 + 一屏组件」。
**每一条「必须单独一轮」都值得先花半小时量一次再定。**

## 挂着的账（有意没修；**当假设重新验**）

### 只读案例页剩下的

> wave 28 复量：`/showcase/<demo id>` 的 aria 差异仍是 **onlyReact 0 / onlyVue 0**。

- **请求层的落差**（台账天生看不见的第②类：`/showcase` 不在取样面里）。
  wave 28 独立复量，与 wave 27 逐条相同：

  ```
  react-only /api: GET /api/features · GET /api/skills · GET /api/suggestions/config
                   · GET /api/threads/«generated»/uploads/limits
  vue-only   /api: （空）
  ```

  **wave 28 决定不放开，并把它从「待办」改成「已决定」**：这四条都打向需要鉴权的
  端点，而案例页是公开只读的——上游发它们只是因为没有为 demo 分支特判。
  它们在这一屏上产生的可见差异实测为零（aria 0/0）。哪天要翻案，判据是
  「有没有哪个只读能力因为缺了这四条而在案例页上失灵」，不是「上游发了所以要发」。

### settings 域剩下的

- **`settings.memory.*` 剩下的六条 unused 全部核实为「上游自己也零消费」**
  （`rawJson` 与五条 `*Success`）——**不是缺 UI**，与 `inputBox` 下的 voiceInputStop 同类。
- settings 域已全部归 0（wave 24 收尾）。

### 建 agent 页剩下的（wave 28 新增）

- **确认名字之后那一步（chat step）两边的外壳不同。** 上游 `new/page.tsx` 自己画一张
  极简页：同一个 header（返回 + 标题）再加一颗 More 下拉，里面只有 Save；本仓走
  `AgentChat` 的**完整会话头**（侧栏触发器、agent 名字牌、用量、导出、行内 Save 按钮）。
  **有意保留本仓这一侧**：把上游那个 header 叠上去会让这一屏有两个 header。
  代价是 `agents.more` 在本仓永远没有消费点。
- **`agents.saveRequested` 与 agents 下的 agentCreatedPendingRefresh 有意不补。**
  上游靠这两条 toast 报告保存进度；本仓 `useAgentCreationSession` 用
  saving/verifying/created/error 四态 + 行内错误区表达同一件事，再加 toast 等于说两遍。
- **上游那颗 `<Input>` 的可访问名来自 placeholder。** 本仓照抄了（去掉了自己加的
  `aria-label`）。这是「命名弱但存在」，按 wave 28 的判据不算缺陷；要改是两边同改。

### `/auth/callback`（wave 28 新增）

- **上游那一屏在有 session 时够不到**（机制见上面「上一轮做了什么」）。后果是上游
  callback 页对 `?next=` 的处理是死代码，而 OAuth 回跳带的深链因此被丢掉。
- **本仓保留「尊重 `next`」这一侧。** 要对齐成上游那样，只有两条路：
  (a) 本仓也丢掉 `next` —— 会让 `resolveAuthCallback` 与它的单测全部失去意义；
  (b) 上游把 `authenticated → redirect("/workspace")` 从共享的 `(auth)/layout.tsx`
  里挪走，改由 `login/page.tsx`（**它本来就有** `if (isAuthenticated) router.push(redirectPath)`）
  与 `setup/page.tsx` 各自负责。(b) 是对的修法，但它把 `/login` 的服务端跳转变成
  客户端跳转（会闪一下登录表单），是一处结构性改动，**要单独一轮并且先跑一遍上游的
  e2e-auth**。wave 28 没做。
- 401 与 5xx 两支两边**已经一致**（`/login?error=sso_failed`；本仓另外把「服务不可用」
  分出来送去 `?error=gateway_unavailable&next=…`，那是 wave 26 的既定改进）。

### 首次发送之后那一屏（wave 29 新增，**没有进台账**）

候选场景没有加，但那 10 次取样把这一屏的差异照下来了。都是**只在提交之后**
才看得见的（第①类），现在没有任何门禁守着：

- **上游那条竞态本身**：见上面「上一轮做了什么」的表。终态 A 里标签页标题永远停在
  `Loading…`，会话流里留着一条**没去重的用户消息**。判据成立
  （「这处不改，React 自己是不是也是坏的？」——是），但根因在 LangGraph SDK 的
  `fetchStateHistory` 与流之间，**不是一处两边同改能收掉的东西**，本轮只记账。
- **上游画一行 `Completed in <1s`（回合耗时），本仓不画。**
- **本仓在用户消息上多一颗 `button "Edit and rerun"`**，上游那个位置是一颗无名按钮。
- 播报区：上游 settle 之后是**空的**，本仓是 `New chat - DeerFlow`。**这一条不算差异**
  ——两边都是框架自带的路由播报区（线索 135），不是产品标记。

要动前两条，得先有一个稳的取样面，也就是要先等上游那条竞态。

### 跨域 / 更早挖出的

- **欢迎区与建议列表在树里的位置不同**：上游放进 InputGroup（`extraHeader`），
  本仓是兄弟节点。`diffAriaLines` 去缩进 + 多重集，层级差异天生看不见。
- **命令面板的搜索框可访问名**：上游同样撞 cmdk 的空 `<label>` 缺陷，本仓有
  `aria-label`；上游 dialog 标题是 "Command Palette"，本仓是 "Actions"。这一屏没被取样。
- **模型选择器的筛选**：上游是 cmdk 的 command-score 模糊评分，本仓是子串匹配。
  写在 `ComposerModelSelector.vue` 文件头。
- **上游 toast / 本仓静默或内联** 这一簇现在有**四处**，要做就一起做（下一轮候选 1）：
  流式警告与 llm retry（上游 `core/threads/hooks.ts:1805`；本仓 `AgentChat.vue` 的
  `warnings` 渲染成 `absolute right-4 bottom-36` 的 `<p role="status">`）、
  种子取数失败（`hooks.ts:1839`）、`MessageList` 的 `handleSubmitHumanInput` catch、
  以及 wave 30 新增的划词选区跨轮次。本仓已经有三套播报机制
  （全局 toaster / ChatComposer 的局部 ref / MessageList 的 `actionError`），
  这一轮的正题其实是**先定谁管谁**。
- **上游 `SidebarTrigger` 在窄屏读的是桌面的 `open`**，图标恒定且指反。上游缺陷，
  本仓先保持一致。**要修就是两边同改，需要用户先拍板。**
- ~~划词工具条整簇差异~~ —— **wave 30 做完了**。留下的只有一条：
  **选区跨轮次时上游 toast 一句 sidecar 下的 selectionCrossesMessages，本仓静默**。
  归进下面那条 toast 的账里一起做（那条 key 因此仍在 39 条 unused 里）。
- **browser 面板有意保留的四处分叉**（写在 `BrowserPanel.vue` 文件头），其中
  `border-border`（本仓 `main.css` 没有 `* { @apply border-border }` 基础层）
  **影响全仓，哪天要统一处理就是单独一轮**。
- **`Button` 的 as-child 没做**：上游 `<Button asChild>` 会把
  `data-slot`/`data-variant`/`data-size` 放到 `<a>` 上，本仓裸调 `buttonVariants()`
  只出 class。两边都 grep 过，**没有任何选择器消费它**，所以现在只是合同差异。
- **run 成功结束之后退回「重新取的 checkpoint」**（跨域候选）。
- **上游种子取数失败会弹 toast**（`hooks.ts:1839`），本仓静默降级（S8 明写 403/404 属常态）。
- **上游 `MessageList` 的 `handleSubmitHumanInput` 在 catch 里 `toast.error`**，
  本仓静默清 pending。
- **`messages.clarification` / `messages.conversation` / `messages.subtask` 是既有
  死条目**，unused 扫描器按叶子名匹配看不见它们。清理整簇属词典手术，单独一轮。
- **`browser.trigger` / `browser.navigationFailed` 也是死条目**（只有测试在消费）。
- **inputBox 下的 voiceInputStop 是上游自己也零消费的死条目**，有意留着，**不是缺 UI**。
- **chip 编辑区**：wave 30 复查发现它**比「span vs div」大**。上游
  `input-box.tsx:2277` 除了 `<span contentEditable>` 还写了 `aria-multiline="true"`、
  `aria-placeholder`、`data-empty` / `data-placeholder`（后两个驱动空态占位文字）；
  本仓 `ChatComposer.vue:1462` 的 `<div role="textbox">` 只有 `aria-label`，
  **空的时候一个占位字都不画**。可访问名两边都在（按 wave 28 的判据不算缺陷），
  但 `aria-multiline` 与空态占位是两处实打实的落差。三样都不进 aria 快照，
  所以台账天生看不见。

### 剩余 39 条 unused 词条

逐条 grep 时注意**扫描器按叶子名匹配，双向都会漏报**：不在 unused 里不等于有人用
（`inputBox.mode` 就是这样被埋了很久），而**写进注释就会被算成有人用**（线索 126）。
当前清单见 `baseline/i18n-keys.json`。

---

## 很省时间的调查手段

临时写 `frontend-vue/tests/e2e-parity/probe.spec.ts`，两个应用各开一个 fresh context
打开同一条路径，取 `body` 的 `ariaSnapshot()`，用 `normalizeAriaSnapshot` 归一后
`diffAriaLines` 比：

```bash
cd frontend-vue && PROBE_OUT=/tmp/p.json node scripts/with-loopback-no-proxy.mjs -- python3 ../scripts/pnpm.py --dir frontend-vue exec playwright test -c playwright.parity.config.ts probe.spec.ts --workers=1 --reporter=line
```

- **必须在 `frontend-vue/` 目录下跑**（`with-loopback-no-proxy.mjs` 是模块内路径）。
- **`--workers=1` 不能省**：`test.afterAll` 写文件，多 worker 下模块级 results 收不齐。
- `captureScenario` 在 settle 之后还静置 700ms；probe 用 `waitForTimeout(5000)` 够稳。
- **顺手记三样**：`/api/` 请求序列、最终 URL（按 pathname + search 拆开比，线索 118）、
  以及 `document.activeElement`（线索 127）。三样各自都抓到过台账看不见的差异。
- `page.evaluate` 传字符串形式的函数不会执行，**要传真的函数**。
- **每测一种交互态换一个 fresh context**（线索 104）。
- **先想清楚这一屏在 `DEER_FLOW_AUTH_DISABLED=1` 下长什么样**：上游有整片路由
  （`(auth)/**`）在这种配置下**服务端直接跳走**，probe 量到的会是另一个页面。
- **提交前记得删掉 probe**（留着会让门禁条数对不上，`any` 会让 lint 红，
  删了不 `git add` 会让 `doc-references` 守卫假红）。
- 一次 probe ≈ 5 分钟（瓶颈是 React 侧的 `next build`），丢后台跑。

## 负向验证的做法

逐条变异 → **回读文件确认变异真的落地** → 只跑相关单测/e2e 文件 → 还原，
结果做成表格贴进提交说明。**假绿要如实写进去，连同成因。**
变异脚本跑完确认 `git status` 干净再提交。
只有对照门禁抓得到的那几条，要**真跑一遍 parity** 证实。
（macOS 的 BSD sed 不支持 `0,/pat/`，**退出码 0 但文件一个字节没改**；用 python harness。）
**锚点要按 prettier 格式化之后的样子写**：wave 28 有一条变异因为把三元写成一行而
锚点 0 次命中，脚本报了「变异没落地」——那一条如果没被脚本自己抓住，就是一条假绿。

## 其他常踩的坑（完整 139 条在记忆文件里）

- **新增 Vue SFC 要同步三个数字**：`I18N_INVENTORY.md` 的「共有 N 个 Vue SFC」与
  「N 个产品 SFC」（**217 / 215**）、`tests/unit/i18n/source-guard.test.ts` 的
  `toHaveLength(215)`。`tests/guards/doc-facts.test.ts` 把 key 数与 unused 数对死
  （**953 / 39**）——改 i18n 后跑 `make i18n-refresh`，`I18N_INVENTORY.md` 里那句
  「N 个已审阅 unused key」也要一起改。
- **新增 L2 组件要加进 `tests/architecture.test.ts` 的 `l2Files` 允许清单**
  （要有 `【架构位置】 L2` 头、不许 import 产品层——`@/composables`、`#app`、`#imports`
  都是禁的，所以 L2 primitive 不能自己取 i18n，标签由调用点传）。清单按字母序。
- **动 `app/components/ui/` 下任何东西之前，先 grep 出全部消费者**——共享组件会把
  上游两个调用点之间的分叉**静默**抹平。
- **门禁清单不是全集。** 改了哪个域就把 `make help` 里相关的都跑一遍。
- **裸 `getByRole()` / `getByText()` 在长页面上是定时炸弹**（strict violation）。
  修法是 `data-testid` 或 `.first()`，不要给定位器加文本过滤。
- **「测试红了」的第一步永远是分「用例过期」还是「产品回归」**，两者修法相反。
- **首屏预算**：`tests/e2e/route-payload.spec.ts` 因新增组件变红时，直接把
  `baseline/route-payload-budget.json` 对应路由的数字抬到实测值以上继续走，
  提交说明里提一句抬了多少。**但 `criticalPathForbidden` 仍然守着**
  （katex / shiki / mermaid 的本体特征串不许进 critical ∪ prefetch）。
- **后台跑长命令时不要用 `| tail`**——管道会缓冲到命令结束。直接 `> file 2>&1`。
  等它的时候**不要 `grep -q 'passed'`**：Gateway 那句
  `authentication is bypassed` 里就有 "passed"，等待循环会立刻退出，
  看起来像「命令秒完成」。写成 `grep -aqE '^ +[0-9]+ (passed|failed)'`（线索 132）。
- **baseline 里每加一个字段，先问「哪一行代码读它」。** `$pendingReasons` 挂了十几轮
  没有任何消费者，删掉一条理由不会让任何门禁变红（线索 131；wave 29 补了守卫）。
- **几何容差 `GEOMETRY_TOLERANCE_PX = 2` 在 `diff.spec.ts:66`，不要动。**
- **同一时刻只能有一个后台门禁任务**（Nuxt 构建锁，线索 120）。
- **`sampleGeometry` 只量 settle 里的 `visible` 锚点，而 settle 跑在 steps 之前**——
  所以**靠交互才出现的东西，位置永远进不了台账**，只能单测守（线索 137）。
- **注释里带点写一条死词条会把它从 unused 集里弄没**（线索 126）。要写成
  「container 下的 leafName」，改完跑 `make i18n-unused` 核对。

## 背景在哪

- 每一轮的实测记录、139 条踩坑线索：Claude 记忆 `deerflow-parity-harness-plan`
- 判据与踩过的坑写在各文件头注释里，**不要跳过**：
  `frontend-vue/tests/e2e-parity/support/{capture,scenarios,react-preview,context-options,fixture-thread}.ts`、
  `frontend-vue/tests/e2e-parity/diff.spec.ts`、`frontend-vue/scripts/lib/aria-parity.mjs`、
  `frontend-vue/tests/parity/scenario-coverage.test.ts`、
  `frontend-vue/tests/unit/chat/followup-chip-guards.test.ts`、
  `frontend-vue/tests/unit/composer/composer-autofocus.dom.test.ts`、
  `frontend-vue/tests/unit/chat/selection-toolbar.dom.test.ts`、
  `app/components/chat/*.vue`、`app/components/ui/command/*.vue`、
  `app/components/workspace/artifacts/ArtifactFileCards.vue`、
  `app/pages/workspace/agents/new.vue`、
  `app/core/skills/slash-suggestions.ts`、`workspace/sidecar/SidecarPanel.vue`、
  `workspace/browser-view/BrowserPanel.vue`
- 取数合同在 `frontend-vue/BEHAVIOR_CONTRACTS.md` 的 **S8 / S8a / S8b / S8c**
- **文件头里写着「实测过、做不到」的结论，也要看它给的机制对不对。已经翻案十一次。**
  **上一轮写下的推断，下一轮仍要当假设重新验。**
