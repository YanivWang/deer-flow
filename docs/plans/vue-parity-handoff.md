# React → Vue 对照对齐：轮次交接文档

**这份文档是每一轮开工的第一读物。** 它记录「上一轮做完了什么、下一轮做什么、
有哪些账挂着」。深度背景（151 条踩坑线索、每一轮的实测记录）在 Claude 的记忆文件
`deerflow-parity-harness-plan` 里；这里只放接手一轮所需的最小集合。

**每推完一个阶段（一轮 wave），就地更新这份文档，然后开始下一轮。**

---

## 当前状态（截至 wave 33，2026-09-03）

- 分支 `main-wc`。`acd119a2` = wave 32，`4d9dd508` = wave 33。
- wave 30~33 **都没有动 `frontend/`**，**upstream marker 仍在 `c78bc91c`**（wave 28 推的）。
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
  **composer 的焦点 + follow-up 整簇**（wave 29）、
  **划词工具条整簇**（wave 30：aria 1→0，位置从 (955,642) 挪到与上游逐像素相同的
  (367,197)）、**聊天面的播报机制**（wave 31：22 处收进 workspace toaster，
  unused 39→36）与 **CSS 基础层的级联层次序**（wave 32：全仓 90 处 border 颜色
  工具类从「一处都没生效」变成全部生效）与 **词典手术**（wave 33：删掉扫描器结构上
  看不见的 10 条死词条，并给「本仓独有的词典块」补了守卫）。

> **`app/pages/` 下的路由已经一条不剩地量过了**（wave 28 量完最后三条）。
> **要找活只能去「挂着的账」里挑**，不要再指望「还有没量过的路由」。

> **settings 域有一个取样点**（`settings-notification`，wave 25 的 `stubs`）。
> 其余六个面板仍然没有合法的场景 id（棘轮要求 id 逐字等于 React spec 文件名），
> 它们的差异只能靠 probe 找、靠单测守（线索 107）。

### 门禁实测值（wave 33 收工时逐条跑过）

```
make -C frontend-vue verify        exit 0；240 文件 / 2008 单测，词典 945 key、36 unused
                                   standalone-check BLOCKING 0 处 / 0 个文件（DECLARED 31 处 / 11 个文件）
make -C frontend-vue e2e-parity    47    台账 0 行，39 样本（NEW=0 GONE=0）
make -C frontend-vue e2e-mock      263 + 21 + 15 + 2 + 6   (= e2e + auth + infra + proxy-options + stream)
make -C frontend-vue e2e-backend   2 + 5 + 2 + 3 + 3 + 5 + 1 + 1
make -C frontend-vue e2e-visual    8    **不在 make e2e 里**
make -C frontend-vue e2e-external  3
```

产品 SFC **215**（总 217，wave 30~33 都没有新增 SFC）。动了 `frontend/` 再加
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

**wave 33 赶上别的仓库在构建，load 一度到 60**：`e2e-settings` 与 `e2e-external` 两次
`Timed out waiting 240000ms from config.webServer`（**基建超时，不是断言**），
`ui-primitives-a11y.spec.ts:288` 的 hover tooltip 在 load 22 时红过一次。
**load 降到 5 之后三套全绿。** 这台机器上 `webServer` 的 240s 在 load>20 时不够用，
遇到就等负载，不要先去查产品。

**wave 30 与 wave 31 全程零重跑**；**wave 32 重跑过一次**：第一遍 `e2e-mock` 在
**load 18** 时 `thread-list-infinite-scroll.spec.ts:74` 红了一次，因果够不着
（那一轮只改了 border/outline 颜色与规则所在的层，都不进布局；边框宽度 probe 前后
逐个元素相同），load 8 时 `--repeat-each=5` **15/15 全绿**，收工前整套也重跑到 263。
**这是第三条已知的负载抖动**，机制与前两条同类：滚动/异步加载 + 固定超时。

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

## 上一轮（wave 33）做了什么

正题是「词典手术」。交接文档写的是「三簇按叶子名匹配扫描器看不见的死条目」，
量下来是 **10 条**，而且它们藏在一个比「三簇」更说得清的地方。顺带两笔小账。

### 一、先量：一个「更好的扫描器」并不便宜

`make i18n-unused` 按**叶子名**匹配，是为了容忍
`const larkCopy = copy.value.settings.integrations.lark` 这类别名。代价是同名叶子
互相遮蔽。本轮试写「全路径匹配」的替代判据，**在共有块上一次误报 122 条**；
加上别名检测仍然误报（跨行别名不是正则做得准的）。**结论：通用的死条目检测器
要类型感知的分析，这一轮不做，只做能判准的那部分。**

### 二、能判准的那部分：本仓独有的 8 个块

本仓词典 **38 个顶层块**，上游 **30 个**。多出来的 8 个
（`primitives` / `browser` / `artifacts` / `markdown` / `marketing` / `messages` /
`navigation` / `setup`）里，「上游也没人用」这条辩解**不成立**——上游根本没有这些 key。
117 条里 **10 条是死的，扫描器一条都没报**：`browser.trigger`（被 `common.showBrowser`
顶掉）、`browser.navigationFailed`（只有一条单测消费）、
`messages.{conversation,clarification,subtask}`、
`navigation.{settingsAndMore,appearance,light,dark,language}`（后五条是别处同名 key 的
**死副本**，UI 用的一直是另一份）。逐条手验后删掉：**953 → 943**。

### 三、守卫（`tests/unit/i18n/vue-only-keys.test.ts`）

三条：① 「本仓独有的块」清单 == 「上游词典里没有的块」；② 这些块里每条都要有消费者；
③ **`primitives.*` 两个 locale 一字不差**——那是上游写死英文的可访问名，
本仓照抄这一侧，而**把它们翻成中文此前不会让任何门禁变红**。

守卫读上游词典当坐标系，在 `standalone-check` 里登记成 **DECLARED**
（与 `scenario-coverage.test.ts` 同形）。**BLOCKING 仍是 0**；不登记会打成 1 处。

### 四、两笔小账

- **命令面板**：上游 `<CommandDialog>` 用 shadcn 的默认值 "Command Palette" /
  "Search for a command to run..."（写死英文）。本仓此前念 "Actions"。
  按 `primitives.*` 照抄，新增两条 key：**943 → 945**。
- **chip 可编辑区**：`<span>` + `aria-multiline` + `aria-placeholder` +
  `data-empty`/`data-placeholder` 的空态占位 + `tabindex`。布局那两个类没动
  （改它要先量几何）。

### 五、`/auth/callback` 有意没做（本轮改判）

差异是真的（上游 `(auth)/layout.tsx` 的服务端 redirect 让 OAuth 回跳的 `?next=`
深链**总是被丢掉**），但**修法只在 `frontend/` 一侧，本仓不需要任何改动**——
这不是「两边同改」，是替上游修 bug；而这一屏进不了取样面（wave 28 量过 44 行噪声），
**对齐价值为零**。另外交接文档原来给的修法也不是最好的（会把 `/login` 的服务端跳转
变成客户端跳转）；更小的是把 `auth/callback` 移出 `(auth)` 路由组。详见「挂着的账」。

### wave 33 自审抓出来的（都已修）

1. **守卫的正则漏转义，负向验证当场假绿**：`["trigger"]` 被当成**字符类**。
2. **差点把工具报错读成「红」**：`--reporter=basic` 在 vitest 里不存在，进程以 1 退出。
3. **手写的词典解析器在对象数组上跑偏**（`marketing.caseStudyItems`）——
   改成直接读 `baseline/i18n-keys.json`。
4. **`primitives` 的守卫第一版比对了注释**，改成先剥注释再比值。
5. **新增的两条 primitives 第一版在 zh-CN 里写成了中文**，按规矩改回英文。

### 两条用例过期（不是产品回归）

- `i18n-theme.spec.ts:76` 用 `zhCN.browser.trigger` 当浏览器触发器的名字，
  **此前能过只是因为它与 `common.showBrowser` 在 zh-CN 里恰好同字**。
- `workspace-shell.spec.ts:49` 等的是 `dialog { name: "Actions" }`。

### wave 33 新增的踩坑线索（记忆里编号 148~151）

- **148. 一条 key 死着，可能只是因为别处有一条同名叶子活着。** 叶子名扫描器天生看不见
  这种。**判准的办法只在「上游没有的块」里成立**——那里「上游也没人用」不成立。
- **149. 非零退出码可能来自工具本身。** `--reporter=basic` 在 vitest 里不存在，
  进程以 1 退出，看起来像用例失败。变异脚本用 `--reporter=dot`。
- **150. 别自己再解析一遍词典。** `baseline/i18n-keys.json` 由真解析器生成、
  被 `i18n-check` 钉住；手写的括号计数在对象数组上会跑偏。
- **151. 这台机器上 `webServer` 的 240s 在 load>20 时不够用。**
  `Timed out waiting 240000ms from config.webServer` 是基建超时，不是断言失败，
  遇到就等负载降下来，不要先去查产品。

## 下一轮（wave 34）：收尾复量

`app/pages/` 下的路由已经量光，**只能从「挂着的账」里挑**。wave 30~33 把「必须单独
一轮」的四条做掉了三条，第四条（`/auth/callback`）wave 33 量完**改判为不做**
（理由见上、细节见「挂着的账」）。剩下的：

1. **收尾复量**（推荐做这一轮）：把「挂着的账」逐条当假设重新验一遍。
   连着四轮的教训是这份清单会过期——wave 30「必须单独一轮」量完是普通清零、
   wave 31「就四处」实际 22 处、wave 32「本仓没有」实际是有但写错地方、
   wave 33「三簇」实际 10 条且位置说得更清。**这一轮的产出就是一份重新验过的清单。**
2. **剩下的小账**（可合并进任意一轮）：`Button` 的 as-child、模型选择器筛选、
   欢迎区在树里的位置、browser 面板剩余分叉、chip 的布局类。
3. **共有块的死条目**：要做得先有类型感知的分析（wave 33 量过，正则做不准）。
   这不是一轮平替，是一次工具投资，**先问它值不值**。

### 还剩几轮（**估计，不是实测；下一轮仍要当假设重新验**）

wave 29 估 7~9，wave 30 估 6~8，wave 31 估 5~6，wave 32 估 4，wave 33 做完再估：

- **收尾复量（1）**：把挂账逐条重验，产出一份新的清单
- **可合并的小账（1）**
- **被上游阻塞（0 轮，只记账）**：首次发送后那一屏的 `Completed in <1s` 与
  `Edit and rerun`；`/auth/callback` 的上游修缮
- **已决定不做（0 轮，只记账）**

合计 **2 轮左右**。**这个数字连着五轮都偏悲观**，但收尾复量那一轮本身就会把它校准。

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

### `/auth/callback`（wave 28 新增，**wave 33 改判为不做**）

- **差异是真的**：上游 `(auth)/layout.tsx` 见到 authenticated 就服务端
  `redirect("/workspace")`。真实 OAuth 流程走到 callback 时 session cookie 已经在了，
  于是**回跳带的 `?next=` 深链总是被丢掉**，那个页面对 `next` 的处理是死代码。
  本仓的全局 middleware 只在 `/workspace/*` 上探 session，callback 页照常渲染并尊重 `next`。
- **但修法只在 `frontend/` 一侧，本仓不需要任何改动。** 这不是「两边同改」——
  那条边界的目的是让两棵树在**被取样的面**上逐行一致；这一屏在
  `DEER_FLOW_AUTH_DISABLED=1` 下两边打开的根本不是同一个页面（wave 28 量过 44 行噪声），
  **进不了取样面，对齐价值为零**。**所以它不占一轮平替。**
- **wave 28 记的修法也不是最好的。** 那条「把 `authenticated → redirect` 从共享
  layout 挪到各页」会把 `/login` 的服务端跳转变成客户端跳转（闪一下登录表单）。
  **更小的修法**：把 `auth/callback` 移出 `(auth)` 路由组——那个页面不用
  AuthProvider、不用 I18nProvider（它一句 `t` 都没有），只需要自带一个
  `dynamic = "force-dynamic"` 的 layout（`useSearchParams` 在静态渲染下要 Suspense）。
- **哪天要做**，判据是「有人真的因为深链被吞而报障」，做的时候按上面那条更小的修法，
  并且要跑一遍上游的 e2e-auth。401 与 5xx 两支两边**已经一致**。

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
- **命令面板**：dialog 标题那一条 **wave 33 做完了**（照抄上游写死的
  "Command Palette" / "Search for a command to run..."，走 `primitives.*`）。
  **剩下搜索框的可访问名**：上游撞 cmdk 的空 `<label>` 缺陷，本仓有 `aria-label`——
  本仓这一侧更好，有意保留。这一屏没被取样。
- **模型选择器的筛选**：上游是 cmdk 的 command-score 模糊评分，本仓是子串匹配。
  写在 `ComposerModelSelector.vue` 文件头。
- ~~上游 toast / 本仓静默或内联~~ —— **wave 31 做完了**（普查出 22 处，
  全部收进 workspace toaster）。判据写在 `AgentChat.vue` 的 `failedSend` 声明上：
  **一刻发生的事走 toaster，一段时间为真的事留在页面里**。
  **留在页面里的三处不是遗漏**：发送失败 +「再试一次」、`stream.llmRetry` 的横幅、
  历史加载失败 +「再试一次」。要翻案得先推翻那条判据。
- **上游 `SidebarTrigger` 在窄屏读的是桌面的 `open`**，图标恒定且指反。上游缺陷，
  本仓先保持一致。**要修就是两边同改，需要用户先拍板。**
- ~~划词工具条整簇差异~~ —— **wave 30 做完了**；留下的那条选区跨轮次播报
  **wave 31 也做掉了**。这一条已结清。
- **browser 面板有意保留的四处分叉**（写在 `BrowserPanel.vue` 文件头）。
  其中 `border-border` 那一条 **wave 32 已经结清**——本仓一直有那条基础层，
  错的是它裸写在顶层因而赢过所有工具类；挪进 `@layer base` 之后，
  BrowserPanel 里那些裸 `border-b` 与上游落到同一个颜色，那条分叉不再存在。
  **`BrowserPanel.vue` 的文件头已同步改过**（四处 → 三处）。
- **`Button` 的 as-child 没做**：上游 `<Button asChild>` 会把
  `data-slot`/`data-variant`/`data-size` 放到 `<a>` 上，本仓裸调 `buttonVariants()`
  只出 class。两边都 grep 过，**没有任何选择器消费它**，所以现在只是合同差异。
- **run 成功结束之后退回「重新取的 checkpoint」**（跨域候选）。
- **上游种子取数失败会弹 toast**（`hooks.ts:1839`），本仓静默降级（S8 明写 403/404 属常态）。
  **这一条 wave 31 有意没动**：它不是「缺一层播报」，是 S8 写死的「403/404 属常态」，
  弹 toast 会在每次打开只读线程时报一次假故障。
- ~~`messages.*` 与 `browser.*` 的死条目~~ —— **wave 33 做完了**：连同
  `navigation.*` 那五条一共 **10 条**，全部删掉（953 → 943，再加命令面板两条 → 945）。
  **剩下的是共有块里的死条目**：要判准得先有类型感知的分析（wave 33 实测正则会误报
  122 条），那是一次工具投资而不是一轮平替，**先问它值不值**。
- **inputBox 下的 voiceInputStop 是上游自己也零消费的死条目**，有意留着，**不是缺 UI**。
- ~~chip 编辑区~~ —— **wave 33 做完了**（span + `aria-multiline` + `aria-placeholder`
  + `data-empty`/`data-placeholder` 的空态占位 + `tabindex`）。
  **只剩布局那两个类**（`min-h-10 flex-1`）：上游靠外层容器给，改它要先量这一屏的几何。

### 剩余 36 条 unused 词条（wave 33 复核过，位置未变）

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

## 其他常踩的坑（完整 151 条在记忆文件里）

- **新增 Vue SFC 要同步三个数字**：`I18N_INVENTORY.md` 的「共有 N 个 Vue SFC」与
  「N 个产品 SFC」（**217 / 215**）、`tests/unit/i18n/source-guard.test.ts` 的
  `toHaveLength(215)`。`tests/guards/doc-facts.test.ts` 把 key 数与 unused 数对死
  （**945 / 36**）——改 i18n 后跑 `make i18n-refresh`，`I18N_INVENTORY.md` 里那句
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

- 每一轮的实测记录、151 条踩坑线索：Claude 记忆 `deerflow-parity-harness-plan`
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
