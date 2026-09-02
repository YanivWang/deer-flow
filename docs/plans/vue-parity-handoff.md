# React → Vue 对照对齐：轮次交接文档

**这份文档是每一轮开工的第一读物。** 它记录「上一轮做完了什么、下一轮做什么、
有哪些账挂着」。深度背景（130 条踩坑线索、每一轮的实测记录）在 Claude 的记忆文件
`deerflow-parity-harness-plan` 里；这里只放接手一轮所需的最小集合。

**每推完一个阶段（一轮 wave），就地更新这份文档，然后开始下一轮。**

---

## 当前状态（截至 wave 28，2026-09-02）

- 分支 `main-wc`。HEAD = `311d11e7`（chore），`c78bc91c` = wave 28。
- wave 28 **动了 `frontend/` 一处**（`workspace/agents/new/page.tsx`：返回键没有可访问名、
  校验错误没有 `role="alert"`），**upstream marker 已推到 `c78bc91c`**。
- **对照台账 0 行**，**39** 个样本，`make -C frontend-vue e2e-parity` **47** 条全绿。
- 覆盖率棘轮：covered **24**，pending **只剩 1 条**（`chat-thread-init-ordering`）。
- 已彻底对齐的域（14 个 + settings/memory）：chat / artifacts / 会话列表 /
  scheduled-tasks / channels / integrations + 设置外壳 / mermaid / subtask-card /
  workspace 头部 / sidebar / messages / sidecar / browser / composer，
  外加 **settings 域全部**（wave 22~24）、**auth**（wave 26：`/login` 58→0）、
  **只读案例页**（wave 27：`/showcase/<id>` 29→0）与
  **建 agent 页**（wave 28：`/workspace/agents/new` 9→0）。

> **`app/pages/` 下的路由现在一条不剩地量过了。** wave 28 把最后三条没 probe 过的
> 都量了：`/workspace` 本来就 0/0；`/workspace/agents/new` 9 行，这一轮清零；
> `/auth/callback` **在这套配置下量不到**（理由见「挂着的账」）。
> 落地页与 docs/blog 双向豁免。**下一轮要找活，去「挂着的账」里挑，
> 不要再指望「还有没量过的路由」。**

> **settings 域现在有一个取样点了**：wave 25 给 `ParityScenario` 加了枚举式夹具注入
> （`stubs`），`settings-notification` 已从 pending 挪进 covered。**其余六个面板仍然
> 没有合法的场景 id**（棘轮要求 id 逐字等于 React spec 文件名），它们的差异仍然只能
> 靠 probe 找、靠单测守（线索 107）。

### 门禁实测值（wave 28 收工时逐条跑过，全绿）

```
make -C frontend-vue verify        exit 0；235 文件 / 1963 单测，词典 953 key、39 unused
make -C frontend-vue e2e-parity    47    台账 0 行，39 样本
make -C frontend-vue e2e-mock      262 + 21 + 15 + 2 + 6   (= e2e + auth + infra + proxy-options + stream)
make -C frontend-vue e2e-backend   2 + 5 + 2 + 3 + 3 + 5 + 1 + 1
                                   (= protocol + real + scheduled + channels + agents + settings + shell + browser)
make -C frontend-vue e2e-visual    8    **不在 make e2e 里**
make -C frontend-vue e2e-external  3
```

产品 SFC **215**（总 217）。动了 `frontend/` 再加
`python3 scripts/pnpm.py --dir frontend check` / `test`（**1022**）/ `test:e2e`（**146**）。
**`frontend/tests/e2e/landing.spec.ts:61` 是一条既有的负载抖动**（`locator.boundingBox`
等动画区的 `.max-w-6xl`），wave 20/21/22 都遇到过。判据：先证你这一轮改的东西
进不了落地页 bundle，再谈负载。

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

### 台账天生看不见的七类差异

① 需要交互才看得见的；② 藏在请求 body 里的；③ portal 出去还会遮蔽页面的浮层；
④ 顺序与层级（aria 去缩进后按多重集比）；⑤ primitive 的默认值；
⑥ 只在某种后端状态下才分叉的渲染路径；⑦ **这一屏压根没被取样**。

wave 20/21 连着两轮正面打了 ① 和 ⑦。**判据：一个域收工前，把它所有「点一下才出现」
的东西列出来，逐个问「这一屏进过取样面没有」。** 挂展开态很便宜：场景 id 受
`baseline/parity-scenario-coverage.json` 的棘轮约束，但**夹具与 steps 不受**，
直接挂现成场景，基线不用加记录。

**wave 28 补了第八类：焦点。** `document.activeElement` 不进 aria 快照，也不是几何量，
所以「打开这一屏之后光标在哪」这件事，**台账、probe 的 aria diff、几何三样都看不见**。
probe 里顺手记一行 `page.evaluate(() => document.activeElement)` 就能量到——
wave 28 正是这样发现建 agent 页少了 autoFocus，以及下面那条新账的。

---

## 上一轮（wave 28）做了什么

把最后三条没量过的路由一次量完，做掉了 `/workspace/agents/new`：**9 行 → 0 行**
（三种交互态各自复量过：静置、填了名字、填了非法名字，都是 0/0）。
顺手清了三笔挂账。

### 三条路由的实测结果

| 路由 | 实测 | 处置 |
|---|---|---|
| `/workspace` | aria 0/0、请求 0/0，两边都落在 `/workspace/chats/new` | 无需改动 |
| `/workspace/agents/new` | aria **5 onlyReact / 4 onlyVue**，焦点也不同 | 这一轮做掉 |
| `/auth/callback` | **量不到**（见下） | 记账，不动 |

**`/auth/callback` 为什么量不到**：上游 `(auth)/layout.tsx` 在 `getServerSideUser()`
返回 authenticated 时**直接 `redirect("/workspace")`**，而 `getServerSideUser()` 一看到
`isAuthDisabledMode()` 就返回合成管理员、**根本不发请求**。于是对照环境
（两边都 `DEER_FLOW_AUTH_DISABLED=1`）下，React 的这一屏永远渲染不出来——probe 量到的
是「React 在工作区、Vue 在回调页」，44 行噪声。`page.route` 也救不了：那次判断发生在
Next 的服务端，浏览器侧的路由拦截碰不到它。

顺带发现的**上游缺陷**：上游 callback 页里 `resolveAuthNextPath(searchParams.get("next"))`
是**够不到的代码**——session 有效时 layout 先跳走（丢掉 `next`），session 无效时
又统一去 `/login?error=sso_failed`（也丢掉 `next`）。本仓 middleware 只守 `/workspace*`，
所以回调页照常渲染并**尊重 `next`**（probe 实测：`?next=/workspace/agents` 上游落在
`/workspace/chats/new`、本仓落在 `/workspace/agents`）。**有意保留本仓这一侧**，
理由与代价写在「挂着的账」里。

### `/workspace/agents/new` 那 9 行的根因

一句话：**本仓这一屏是一张手搓的表单，不是上游那个两步流程的第一步。**
上游 `new/page.tsx` 有 header（返回 + `createPageTitle` 的 h1）、圆形头像里的 Bot、
h2 的步骤标题、`<Input>`、错误段落、整宽且空值置灰的 Continue；本仓只有 h1 + 裸
input + 永不禁用的按钮。九行逐条对应：

| 行 | 修法 |
|---|---|
| `- button`（上游那颗无名返回键） | 补 header 与返回键，**两边同改**加上 `aria-label` |
| `- heading "Design your Agent" [level=1]` | 补 header 标题（吃掉 `agents.createPageTitle`） |
| h2 vs h1 的步骤标题（两行） | h1 归 header，步骤标题降成 h2 |
| textbox 的可访问名 + `/placeholder:` + 值挪成兄弟节点（三行） | 去掉本仓多写的 `aria-label`，名字回到 placeholder |
| `- button "Continue" [disabled]` | 空值时置灰 |
| `- paragraph:` vs `- alert:` | **两边同改**：上游这段补 `role="alert"` |

另外三处台账看不见、但 probe 的焦点记录与源码对照能看见的：
`autoFocus`（本仓没有，照 React 的做法在 `onMounted` 里 `.focus()`）、
`backend_unreachable` 单独文案（`agents.nameStepNetworkError` 此前零消费）、
以及回车提交从 `<form required>` 换成 `keydown + IME 守卫`（上游没有 `<form>`，
留着原生校验会在空值回车时弹一个上游根本没有的浏览器气泡）。

### 顺手清掉的三笔挂账

1. **`ArtifactFileCards` 的 `.skill` Install 按钮**（wave 27 有意没补）。两个消费点
   （面板清单、会话流 present_files 组）现在都有。判据比上游多一条 `!isMock`，
   理由写在组件头注释里：上游靠 showcase layout 的 `<AuthProvider initialUser={null}>`
   让 `isAdmin` 恒 false，而本仓的 `isAdmin` 在 `authDisabled` 部署下案例页上也是 true。
2. **模式图标与 golden-text 整簇**。四档图标（Zap/Lightbulb/GraduationCap/Rocket）+
   ultra 的 `text-[#dabb5e]` 与 `.golden-text`，触发器与菜单项两处，
   **复合输入框与 sidecar 两个组件**都补齐；`.golden-text` 照抄上游 `globals.css:405`
   进 `main.css` 的 `@layer base`。菜单项的排版也一起对齐（选中态整条
   `text-accent-foreground`、说明行 `pl-7` 缩进）。
3. **bootstrap 会话的一次性保存提示**（`agents.saveHint`，此前零消费）。
   存储键与上游逐字相同，两个应用共用一份「读过了」的记忆，有单测钉着。

### wave 28 动了 `frontend/`（判据成立）

`workspace/agents/new/page.tsx` 两处：返回键**没有可访问名**（同一个 header 里紧挨着的
More 触发器写着 `aria-label={t.agents.more}`），校验错误段落**没有 `role="alert"`**
（这份代码库另外两处同形的表单错误都写了）。两处都补上，两边的树仍逐行一致。
React 侧新增 `tests/unit/app/workspace/agents/new-page.dom.test.tsx`（2 条），
marker 由配套的 chore 提交推进。

### wave 28 新增的踩坑线索（记忆里编号 126~130）

- **126. 注释里写一次 `x.leafName`，那条词条就从 unused 集里消失。** unused 扫描器
  按 `/\.([A-Za-z_$][\w$]*)/` 扫**全文**，注释不例外。wave 28 有三次撞上：给
  `voiceInputStop`、`nameStepChecking`、`saveRequested` 写解释的那几行注释，
  各自把它们伪装成「有人用」。**注释里提到死条目要写成「container 下的 leafName」**，
  别写成带点的完整 key——否则一条真正的死条目会被一句注释永久埋掉。
- **127. 焦点是第八类台账看不见的差异。** `document.activeElement` 不进 aria 快照。
  probe 里加一行就能量，成本几乎为零，收益是一整类此前完全没查过的差异。
- **128. happy-dom 下 ChatComposer 的 DropdownMenu 打不开。** reka 的
  `DropdownMenuTrigger` 没有以 as-child 合并到触发器上，DOM 里留了一个字面
  `<dropdownmenutrigger>` 元素，click 与 pointerdown 都打不开菜单；同一份写法的
  SidecarPanel 却是好的。**不是产品缺陷**——对照套件的 `ui-polish-mobile` 在真浏览器里
  正是点开这个菜单再断言 `menuitemradio`，一直是绿的。要在单测里覆盖菜单项那一层，
  挂 SidecarPanel。
- **129. 菜单项里有两个 svg，第一个是 primitive 自带的选中勾。** `querySelector("svg")`
  永远拿到那个勾，于是「四个图标各不相同」变成「四个勾都一样」，用例恒红或恒绿都不测
  产品。按产品自己写的 class 取（`svg[class*="mr-2"]`）。
- **130. 一条用例挂在断言上，它后面的 `document.body.innerHTML = ""` 就不会执行，**
  下一条用例的 `document.querySelectorAll` 会读到上一条留下的浮层。wave 28 有两条
  连坐失败，改掉第一条第二条自己就好了。**看见成对失败先怀疑清理没跑。**

---

## 下一轮（wave 29）：三条路，挑一条

1. **`chat-thread-init-ordering`**（pending 最后一条，做完 pending 清零）。
   要「填入并发送」这一步，而且要**先测流式取样是否稳定**（理由原文在
   `baseline/parity-scenario-coverage.json` 的 `$pendingReasons`）。
2. **composer 的 `autoFocus`**（wave 28 新量到，见下面第一条账）。它横跨三条路由，
   而且会动焦点相关的既有断言，值得单独一轮。
3. **`border-border` 基础层**（影响全仓，本来就该单独一轮）。

---

## 挂着的账（有意没修；**当假设重新验**）

### composer 的 autoFocus（wave 28 新量到）

probe 实测 `/workspace`（跳到 `/workspace/chats/new`）之后：
**上游焦点落在 composer 的 textarea 上，本仓落在 `body`。**
上游三处都传：`chat-page.tsx:413` 与 `agents/[agent_name]/chats/[thread_id]/page.tsx:404`
是 `autoFocus={isWelcomeMode}`，`app/workspace/chats/page.tsx:88` 是裸的 `autoFocus`；
本仓 `ChatComposer.vue` 里一个 `autofocus` 都没有。
**台账、几何、aria 三样都看不见**（线索 127）。会动焦点顺序相关的既有断言，单独一轮。

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

### composer 域剩下的两条

- **follow-up 确认框仍是手搓副本。** 上游 `input-box.tsx:2750` 是真 `<Dialog>`
  （portal / 焦点陷阱 / 遮罩 / Escape / DialogTitle+DialogDescription + 三个 Button）；
  本仓 `ChatComposer.vue` 是 `absolute bottom-full` 的
  `div[role=dialog][aria-modal=true]` + 手搓按钮，**且多渲染一段 `pendingFollowup`
  正文（上游没有）**。本仓 `ui/dialog` 早就有了。改动会动焦点顺序与「第一个可聚焦
  元素」的断言。**顺带把 follow-up chip 那五条缺失守卫一起做掉**：上游
  `showFollowups`（`input-box.tsx:1965`）是
  `!disabled && !isWelcomeMode && !showSkillSuggestions && !selectedSlashSkill &&
  !followupsHidden && status !== "streaming" && (...)`，本仓 `AgentChat.vue` 那一处
  只有 `!bootstrap && !isWelcomeMode && (loading || length)`。要给 ChatComposer 加一个
  emit（上游对应 `onFollowupsVisibilityChange`）。
- ~~模式图标与 golden-text~~ —— **wave 28 做掉了。**

### 跨域 / 更早挖出的

- **欢迎区与建议列表在树里的位置不同**：上游放进 InputGroup（`extraHeader`），
  本仓是兄弟节点。`diffAriaLines` 去缩进 + 多重集，层级差异天生看不见。
- **命令面板的搜索框可访问名**：上游同样撞 cmdk 的空 `<label>` 缺陷，本仓有
  `aria-label`；上游 dialog 标题是 "Command Palette"，本仓是 "Actions"。这一屏没被取样。
- **模型选择器的筛选**：上游是 cmdk 的 command-score 模糊评分，本仓是子串匹配。
  写在 `ComposerModelSelector.vue` 文件头。
- **流式警告与 llm retry 这一簇，上游是 toast，本仓是内联横幅**
  （上游 `core/threads/hooks.ts:1805`；本仓 `AgentChat.vue` 的 `warnings` 数组渲染成
  `absolute right-4 bottom-36` 的 `<p role="status">`）。要做就单独一轮。
- **上游 `SidebarTrigger` 在窄屏读的是桌面的 `open`**，图标恒定且指反。上游缺陷，
  本仓先保持一致。**要修就是两边同改，需要用户先拍板。**
- **划词工具条整簇差异**：上游锚在选区上（放不下就翻转），本仓钉死在
  `right-8 bottom-28` 的屏幕角落；上游两颗按钮各带图标、还有**第三颗关闭按钮**。
  属 messages 域，要守住它需要一条**取样在选中态**的场景。
- **browser 面板有意保留的四处分叉**（写在 `BrowserPanel.vue` 文件头），其中
  `border-border`（本仓 `main.css` 没有 `* { @apply border-border }` 基础层）
  **影响全仓，哪天要统一处理就是单独一轮**。
- **`Button` 的 as-child 没做**：上游 `<Button asChild>` 会把
  `data-slot`/`data-variant`/`data-size` 放到 `<a>` 上，本仓裸调 `buttonVariants()`
  只出 class。两边都 grep 过，**没有任何选择器消费它**，所以现在只是合同差异。
- **`ArtifactFileCards` 的 CardAction 是 `row-span-2`、上游是 `row-span-1`**
  （wave 28 顺手看到，没动）。差的是这一格在两行网格里怎么跨，没有取样点量它。
- **run 成功结束之后退回「重新取的 checkpoint」**（跨域候选）。
- **上游种子取数失败会弹 toast**（`hooks.ts:1839`），本仓静默降级（S8 明写 403/404 属常态）。
- **上游 `MessageList` 的 `handleSubmitHumanInput` 在 catch 里 `toast.error`**，
  本仓静默清 pending。
- **`messages.clarification` / `messages.conversation` / `messages.subtask` 是既有
  死条目**，unused 扫描器按叶子名匹配看不见它们。清理整簇属词典手术，单独一轮。
- **`browser.trigger` / `browser.navigationFailed` 也是死条目**（只有测试在消费）。
- **inputBox 下的 voiceInputStop 是上游自己也零消费的死条目**，有意留着，**不是缺 UI**。
- **chip 编辑区上游是 `<span contentEditable>`、本仓是 `<div>`**（role 都是 textbox）。

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

## 其他常踩的坑（完整 130 条在记忆文件里）

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
- **几何容差 `GEOMETRY_TOLERANCE_PX = 2` 在 `diff.spec.ts:66`，不要动。**
- **同一时刻只能有一个后台门禁任务**（Nuxt 构建锁，线索 120）。

## 背景在哪

- 每一轮的实测记录、130 条踩坑线索：Claude 记忆 `deerflow-parity-harness-plan`
- 判据与踩过的坑写在各文件头注释里，**不要跳过**：
  `frontend-vue/tests/e2e-parity/support/{capture,scenarios,react-preview,context-options,fixture-thread}.ts`、
  `frontend-vue/tests/e2e-parity/diff.spec.ts`、`frontend-vue/scripts/lib/aria-parity.mjs`、
  `app/components/chat/*.vue`、`app/components/ui/command/*.vue`、
  `app/components/workspace/artifacts/ArtifactFileCards.vue`、
  `app/pages/workspace/agents/new.vue`、
  `app/core/skills/slash-suggestions.ts`、`workspace/sidecar/SidecarPanel.vue`、
  `workspace/browser-view/BrowserPanel.vue`
- 取数合同在 `frontend-vue/BEHAVIOR_CONTRACTS.md` 的 **S8 / S8a / S8b / S8c**
- **文件头里写着「实测过、做不到」的结论，也要看它给的机制对不对。已经翻案十一次。**
  **上一轮写下的推断，下一轮仍要当假设重新验。**
