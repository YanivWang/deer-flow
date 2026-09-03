# React → Vue 对照对齐：轮次交接文档

**这份文档是每一轮开工的第一读物。** 它记录「上一轮做完了什么、下一轮做什么、
有哪些账挂着」。深度背景（162 条踩坑线索、每一轮的实测记录）在 Claude 的记忆文件
`deerflow-parity-harness-plan` 里；这里只放接手一轮所需的最小集合。

**每推完一个阶段（一轮 wave），就地更新这份文档，然后开始下一轮。**

---

## 当前状态（截至 wave 40，2026-09-03）

- 分支 `main-wc`。`b700cf17` = wave 39（chore `b09adb80`）。
- **wave 40 动了 `frontend/`**（重连预算耗尽后那颗键在说反话，两边同改），
  **marker 已推到本轮的 feat**。
- **wave 39 动了 `frontend/`**（命令面板搜索框的可访问名，两边同改）。
- **wave 36 动了 `frontend/`**（`SidebarTrigger` 的窄屏图标，两边同改），
  **upstream marker 已推到 `79afa765`**。wave 30~35 都没动过。
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
  看不见的 10 条死词条，并给「本仓独有的词典块」补了守卫）与
  **写操作的成功播报**（wave 34：五个面 12 处，unused 36→26）与
  **四条「上游在用、本仓没有」的 UI 形状**（wave 35，unused 26→22）与
  **窄屏侧栏触发器 + 两句说明文字**（wave 36，unused 22→20，**两边同改**）与
  **模型选择器筛选 + 技能 chip 那一行**（wave 37）与
  **掉线时的退出出路 + 登录页分隔**（wave 38，unused 20→18）与
  **命令面板搜索框的可访问名**（wave 39，两边同改）与
  **重连预算耗尽后的模式键**（wave 40，两边同改）。

> **`app/pages/` 下的路由已经一条不剩地量过了**（wave 28 量完最后三条）。
> **要找活只能去「挂着的账」里挑**，不要再指望「还有没量过的路由」。

> **settings 域有一个取样点**（`settings-notification`，wave 25 的 `stubs`）。
> 其余六个面板仍然没有合法的场景 id（棘轮要求 id 逐字等于 React spec 文件名），
> 它们的差异只能靠 probe 找、靠单测守（线索 107）。

### 门禁实测值（wave 40 收工时逐条跑过）

```
make -C frontend-vue verify        exit 0；245 文件 / 2039 单测，词典 945 key、18 unused
                                   standalone-check BLOCKING 0 处 / 0 个文件（DECLARED 32 处 / 12 个文件）
make -C frontend-vue e2e-parity    47    台账 0 行，39 样本（NEW=0 GONE=0）
make -C frontend-vue e2e-mock      263 + 22 + 15 + 2 + 6   (= e2e + auth + infra + proxy-options + stream)
make -C frontend-vue e2e-backend   2 + 5 + 2 + 3 + 3 + 5 + 1 + 1
make -C frontend-vue e2e-visual    8    **不在 make e2e 里**
make -C frontend-vue e2e-external  3
```

产品 SFC **215**（总 217，wave 30~40 都没有新增 SFC）。动了 `frontend/` 再加
`python3 scripts/pnpm.py --dir frontend check` / `test`（**1023**）/ `test:e2e`（**146**）。

> **wave 40 实测：`test:e2e` 的 `webServer` 那 120 秒窗口在这台机器上喂不饱一次
> `next build`**（负载 30+ 时编译要 6.6 分钟，`Timed out waiting 120000ms from
> config.webServer` 在任何测试跑起来之前就炸）。**绕法**：先自己 `next build`，
> 起 `PORT=3002 SKIP_ENV_VALIDATION=1 DEER_FLOW_AUTH_DISABLED=1 next start`，
> 再 `PLAYWRIGHT_SKIP_WEB_SERVER=1 pnpm exec playwright test`。
> **注意超时那一次会把 `.next` 留成半成品**（`next start` 会说
> "Could not find a production build"），收工前记得重建。

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

## 上一轮（wave 40）做了什么

**正题：第一轮「没有已知成批理由可拆」的复量。翻出来了，所以判据仍未满足。**

### 翻出来的账：`BrowserPanel.vue` 文件头的分叉 1，**两半都记错了**

原文是：「上游走 toast，而且重连预算耗尽之后**什么都不显示**。本仓保留内联提示与重试。」

逐句量：

| 记的 | 实际（wave 40 读源码） |
|---|---|
| 上游耗尽之后什么都不显示 | 上游那颗模式键**永远画着 `"…"`**（`browser-view-panel.tsx:412`：`live ? (status === "open" ? "Live" : "…") : "Live"`）。`"…"` 的意思是「还在连」，而 `scheduleReconnect` 在 `connectionAttempt >= 6` 时已经彻底 `return`。**比什么都不显示更糟：界面在说反话。** |
| （没记）出路 | 有——把它切走再切回来。`enabled` 转 false 的 effect 里有 `setConnectionAttempt(0)`，上游自己的注释也写着 "until the panel is toggled off/on"。**但界面没有任何地方说得出这一点**，因为它还在说「在连」。 |
| 本仓保留内联提示与重试 | 只对了一半。内联 `role="alert"` + 重试确实是本仓独有（控制器耗尽时发 `status:"error", canRetry:true`）。但 **`liveLabel` 照抄的是上游那两态**：`requestedLive && status !== "open" → "…"`——本仓耗尽时 `status` 是 `"error"`，于是**本仓那颗键在说同一句反话**。 |

**这就是线索 162 的下一层**：「本仓这一侧更好」不但要拆成「本仓好不好 / 上游坏不坏」，
还要再问一句——**「更好」是不是只在一部分上更好，另一部分照抄了同一处缺陷？**（线索 163）

### 修法：两边同改，但形状不同

- **上游给出路**：`useBrowserStream` 多一个 `onReconnectExhausted` 回调（照 `onNavRejected`
  的 ref 写法，不进 effect deps），放弃时回调；面板拿到就 `setLive(false)`。
  那颗键回到 `"Live"` / `"Take live control"`——**这是真话**，而且点一下就重连
  （切走顺带把预算清零）。**零新字符串、零新 UI**。
- **本仓只把标签改诚实**：`status !== "open" && status !== "error"` 才画 `"…"`。
  本仓**不能**走上游那条路——`connection.ts` 的 `stop()` 会把快照重置成初始态，
  连带抹掉那条 alert 与重试入口，那正是本仓比上游好的地方。

对照台账看不见这一处（mock 后端没有 WS 端点时要 32 秒才耗尽 6 次预算，取样点在
settle+700ms，那时两边都还在 `connecting`、都画 `"…"`）——所以 **NEW=0 GONE=0 不是「没改动」的证据**。

### 顺着线索 161 把 primitive 的漏网调用点扫干净了

| primitive | 扫描结果 |
|---|---|
| `SidebarTrigger`（wave 36） | 本仓 4 个调用点，展开态那颗读 `isNarrow ? mobileOpen : sidebarOpen`、收起态那颗读 `sidebarOpen`（窄屏收起时侧栏整棵子树不渲染）——**两处都对**。 |
| cmdk `<Command label>`（wave 39） | 上游第三个调用点 `PromptInputCommand`（`prompt-input.tsx:1421`）**没有任何消费者**，是死的库导出。 |
| 无可访问名的图标按钮（wave 28 那颗关闭键） | 按平衡括号重扫了上游**全部** `<Button size="icon">`（第一版正则被箭头函数里的 `>` 截断，13 条里 12 条是误报）：只剩 `ai-elements/queue.tsx:127` 一个泛型包装器，名字由调用方给，且**全仓无人 import**。**这一类清干净了。** |

### 还复验了两条账，都是对的（这次没记错）

- **run 结束重取 checkpoint**：wave 38 引的证据里没有 `/history`，所以那条结论原本悬着。
  现在有直接证据（SDK 的 `onSuccess` → `history.mutate`），**账成立，wave 41 做**。
- **种子取数失败静默降级**：本仓 `seedThreadCheckpoint` 对 `!response.ok` 与 `catch` 一视同仁
  地 return，理由写在原地（取不到种子 = 没有种子，分页历史仍然完整）。**没有「只在一部分上更好」。**

### 负向验证

| 变异 | 落盘 | 结果 |
|---|---|---|
| D1 本仓标签退回照抄的 `!== "open"` | ✓ | 红 |
| D2 本仓标签永远画 Live（钉住「连接中仍画 `…`」那一半） | ✓ | 红 |
| D3 上游放弃时不回调 | ✓ | 红 |
| D4 上游把回调掏空 | ✓ | **第一次假绿 → 改判据后红** |
| D5 本仓耗尽后不给重试入口 | ✓ | 红 |
| D6 上游不把回调接给钩子 | ✓ | 红 |

**D4 假绿的原因值得记（线索 164）**：上游这一块的测试是**源码扫描式**的，我照它的
写法写了 `expect(panelSource).toContain("setLive(false)")`——而面板在 429 行另有一处
`setLive(false)`（关闭面板），于是把回调掏空照样绿。**源码扫描断言必须钉住那一段的形状
（正则匹配整个回调），不能钉一个在文件里不唯一的字符串。**

---

## 下一轮（wave 41）：**做 checkpoint 重取，顺带第二次复量**

wave 40 又翻出一条（分叉 1 的两半），所以「连着两轮翻不出记错的账」**仍未满足**，
34/35/36/37/38/39/40 **七轮七次一次都没空过**。别再报「还剩几轮」。

wave 41 有一件实打实的活，而且判据已经验实：

1. **run 结束之后重取 checkpoint。** 上游 SDK 每次 run 成功都
   `await history.mutate(threadId)`（证据见上面「挂着的账」里那条），本仓只在
   `threadId` 变化且 `status === "idle"` 时取一次。**后果**：run 内发生上下文压缩之后，
   上游立刻切到摘要视图，本仓要切走再回来才更新。
   **两道守卫都不能省**：`seedThreadCheckpoint` 里那道 `status !== "idle"` 省的是请求
   （少了它台账上会多一条 Vue 独有的 `POST /history`），`seedDurableState` 里那道守的是
   「晚到的响应不许覆盖正在流的消息」（少了它首个回合的流会被自己的种子抹掉）。
   **在流结束点补重取要把这两条一起验。**
   需要专门造后端状态的 e2e，范本 `tests/e2e-backend/thread-summarized-checkpoint.spec.ts`。
2. **顺带把线索 163 那条问法（「更好」是不是只在一部分上更好）铺到剩下的账上。**
   wave 40 已经撞过：`channels.connectedAs`、种子取数失败静默、`agents.saveRequested`、
   `uploads.uploadingFiles`、`/showcase` 四条请求——都没有「照抄了另一半」。
   还没撞的是那些**纯呈现的照抄**（10 处 `照抄上游`），wave 40 粗看都是类名/DOM 结构，
   没有第二个状态机被抄小，但没有逐处量。

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

- ~~`settings.memory.*` 六条 unused 全部核实为「上游自己也零消费」~~ ——
  **这条记错了，wave 34 翻案**：只有 `rawJson` 是上游也零消费的，其余五条上游全在
  `toast.success`，本仓一条都没有。连同被 `common.exportSuccess` 遮蔽的
  `exportSuccess`，六条已于 wave 34 全部接上。
  **「已核实」这三个字本身要重验**（线索 152）。
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

- **欢迎区在树里的位置** —— wave 34 复量后**改写**：本仓早就照抄了上游那对
  absolute 容器（AgentChat 那段注释写着为什么：留在文档流里会把输入框顶下去 24px），
  两边的**定位完全一样**。剩下的只是 DOM 父节点不同（上游是 InputGroup 的
  `extraHeader`，本仓是同一个定位祖先下的兄弟）。要对齐得给 ChatComposer 加一个 slot，
  **零可观察收益**（aria 去缩进后看不见层级，几何两边相同）。**有意保留。**
- ~~命令面板~~ —— **两条都做完了**：dialog 标题 wave 33（照抄上游写死的
  "Command Palette"），搜索框的可访问名 **wave 39 两边同改**（上游根本没有名字，
  是 WCAG 4.1.2 缺陷；本仓从 `aria-label` 换成同一套 `label` 机制）。
  **这一屏仍然没被取样**，靠 `shell-components.dom.test.ts` 守着。
- **模型选择器的筛选** —— wave 37 补了**分隔符不敏感**那一档（列表写 `display_name`
  而筛 `name`，照屏幕上的字打原来一条都搜不到）。**剩下的分叉**：cmdk 的非连续
  子序列匹配 + 评分排序仍然没有，理由写在 `ComposerModelSelector.vue` 文件头
  （要连排序一起来，否则 "abc" 命中几乎所有模型；而 `command-score`/`cmdk`
  都不在依赖里）。
- ~~上游 toast / 本仓静默或内联~~ —— **wave 31 做完了**（普查出 22 处，
  全部收进 workspace toaster）。判据写在 `AgentChat.vue` 的 `failedSend` 声明上：
  **一刻发生的事走 toaster，一段时间为真的事留在页面里**。
  **留在页面里的三处不是遗漏**：发送失败 +「再试一次」、`stream.llmRetry` 的横幅、
  历史加载失败 +「再试一次」。要翻案得先推翻那条判据。
- ~~上游 `SidebarTrigger` 在窄屏读的是桌面的 `open`~~ —— **wave 36 两边同改做完了**
  （marker 推到 `79afa765`）。以下保留当时的分析。
  **wave 34 复量确认属实，而且就在可见面上**——上游三处调用都是
  `<SidebarTrigger className="md:hidden" />`，专门给移动端渲染；移动端抽屉的开合是
  `openMobile`，所以图标永远说「收起」。**「需要用户先拍板」那句已经过期**
  （取舍现在自己定）。**判定：值得做**（这处不改 React 自己也是坏的），
  但可访问名恒为 "Toggle Sidebar"、读屏器无碍，是纯视觉缺陷，
  而它要跑一遍上游的全套门禁（check / test 1022 / test:e2e 146，还有线索 125 那个
  超时坑）。**做法**：上游在组件里 `isMobile ? openMobile : open`；本仓在调用点分开传
  （`md:hidden` 那两处传 mobileOpen，桌面那处传 sidebarOpen）——本仓这个形状更好，
  因为 class 已经把「这是哪个语境」写死了。**建议与其他 `frontend/` 改动打包成一轮。**
- ~~划词工具条整簇差异~~ —— **wave 30 做完了**；留下的那条选区跨轮次播报
  **wave 31 也做掉了**。这一条已结清。
- **browser 面板有意保留的分叉**（写在 `BrowserPanel.vue` 文件头）。
  **其中「上游耗尽重连预算之后什么都不显示」这条 wave 40 翻案了**，见下面
  「上一轮做了什么」：上游是**永远画着 "…"**（意思是「还在连」），而且那条账
  只写了「本仓保留内联提示与重试」——**同一处缺陷的另一半本仓照抄了**。两边已同改。
  其中 `border-border` 那一条 **wave 32 已经结清**——本仓一直有那条基础层，
  错的是它裸写在顶层因而赢过所有工具类；挪进 `@layer base` 之后，
  BrowserPanel 里那些裸 `border-b` 与上游落到同一个颜色，那条分叉不再存在。
  **`BrowserPanel.vue` 的文件头已同步改过**（四处 → 三处）。
- **`Button` 的 as-child —— wave 37 量完决定不做。** 上游 `<Button asChild>` 会把
  `data-slot`/`data-variant`/`data-size` 放到 `<a>` 上，本仓裸调 `buttonVariants()`
  只出 class。wave 34 与 wave 37 两次复验：两边**都没有任何选择器**消费它，
  `data-*` 也不进 aria 快照——**零可观察收益**，而要动 L2 primitive 的 9 个消费者。
  哪天要翻案，判据是「有人真的写了 `[data-slot="button"]` 的选择器」。
- **run 成功结束之后退回「重新取的 checkpoint」** —— **wave 38 第一次量清**：
  本仓只在 `threadId` 变化时取种子（`useThreadStream.ts` 的 watch，且要求
  `status === "idle"`）；上游是 SDK 的 `fetchStateHistory: { limit: 1 }`，
  **每次流结束也重取**（wave 29 量到的「终态 B」里那一轮
  `threads/{id}` + `messages/page` + `token-usage` 重取就是它）。
  **后果**：run 内发生上下文压缩之后，上游立刻切到摘要视图，本仓要切走再回来才更新。
  **没有盲改**：`seedThreadCheckpoint` 的注释写着「少了 `status !== "idle"` 那道，
  首个回合的流会被自己的种子抹掉」——在流结束点补重取要连这条一起验，
  而且需要一个专门造后端状态的 e2e（范本
  `tests/e2e-backend/thread-summarized-checkpoint.spec.ts`）。
  **wave 40 把这条账当假设复验过了，它是对的**：wave 38 引的证据是 wave 29 量到的
  `threads/{id}` + `messages/page` + `token-usage`，那三条里**没有 `/history`**，
  所以「每次流结束也重取」原本是没有直接证据的。现在有了——SDK
  `@langchain/langgraph-sdk/dist/react/stream.lgp.js` 的两处 `onSuccess` 都
  `await history.mutate(threadId)`（一处受 `shouldRefetch` 约束，另一处无条件），
  而 `history` 就是 `client.threads.getHistory(threadId, { limit })`。
  **wave 41 做这条。**
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

### 剩余 18 条 unused 词条（**34 逐条撞过上游；35/36/38 各做掉四/二/二条**）

复量的做法：对每一条 unused key 问「上游用不用它」。**用 = 本仓少了一块 UI。**
26 条分三档：

- ~~5 条上游在用、本仓没有~~ —— **wave 35 处理完了**：四条是真缺口（已补），
  **`channels.connectedAs` 是记录写错了**——本仓早就在显示这个信息，只是形状不同
  （每条连接一行 vs 追加到 provider 说明里），**本仓这一侧对多账号更清楚，有意保留**。
- **若干条上游在用但本仓有意不做**（已各自记在上面）：`agents.saveRequested` 与
  `agents.agentCreatedPendingRefresh`（本仓用四态 + 行内错误表达同一件事）、
  `home.blog`（`components/landing/header.tsx`，落地页）与 `sidebar.demoChats`
  （静态整站模式那一支）——**这两条 wave 38 逐条撞过上游，确实在范围外**；
  同一批里的 `workspace.logout` 与 `login.orContinueWith` **归错了，wave 38 已做掉**
  （前者是掉线横幅的退出键、后者在登录页）。**成批归类的理由要逐条撞**（线索 160）。
  `uploads.uploading` / `uploads.uploadingFiles` / `toolCalls.skillInstallTooltip`
  （**wave 36 量完了**：`uploads.uploading` 与 `toolCalls.skillInstallTooltip` 是真缺口、
  已补；`uploads.uploadingFiles` **不是缺口**——上游边传边发所以要插一条乐观 AI 消息，
  本仓的上传发生在 composer 里、进度由 composer 自己的 `uploading` 态表达，
  **架构不同不是漏了一句话**）。
- **上游自己也零消费的死条目**：`settings.memory.rawJson`、`inputBox.voiceInputStop`、
  `common.preview`、`conversation.startConversation`、`scheduledTasks.preview` 等。

**注意 `make i18n-unused` 不能当「这处代码还在」的守卫**：叶子名撞车时它两边都看不见
（线索 153）。要钉代码就写代码守卫，范本
`tests/unit/i18n/success-announcements.test.ts`。

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

## 其他常踩的坑（完整 162 条在记忆文件里）

- **新增 Vue SFC 要同步三个数字**：`I18N_INVENTORY.md` 的「共有 N 个 Vue SFC」与
  「N 个产品 SFC」（**217 / 215**）、`tests/unit/i18n/source-guard.test.ts` 的
  `toHaveLength(215)`。`tests/guards/doc-facts.test.ts` 把 key 数与 unused 数对死
  （**945 / 18**）——改 i18n 后跑 `make i18n-refresh`，`I18N_INVENTORY.md` 里那句
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

- 每一轮的实测记录、162 条踩坑线索：Claude 记忆 `deerflow-parity-harness-plan`
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
