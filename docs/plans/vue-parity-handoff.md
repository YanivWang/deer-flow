# React → Vue 对照对齐：轮次交接文档

**这份文档是每一轮开工的第一读物。** 它记录「上一轮做完了什么、下一轮做什么、
有哪些账挂着」。深度背景（103+ 条踩坑线索、每一轮的实测记录）在 Claude 的记忆文件
`deerflow-parity-harness-plan` 里；这里只放接手一轮所需的最小集合。

**每推完一个阶段（一轮 wave），就地更新这份文档，然后开始下一轮。**

---

## 当前状态（截至 wave 21，2026-09-02）

- 分支 `main-wc`。HEAD = `132cd0bb`（marker chore），`ac7df53f` = wave 21。
- **对照台账 0 行**，38 个样本，`make -C frontend-vue e2e-parity` 46 条全绿。
- **upstream marker 已推到 `ac7df53f`**。
- 已彻底对齐的域（14 个）：chat / artifacts / 会话列表 / scheduled-tasks / channels /
  integrations + 设置外壳 / mermaid / subtask-card / workspace 头部 / sidebar /
  messages / sidecar / browser / **composer**。

### 门禁实测值（wave 21 收工时逐条跑过，全绿）

```
make -C frontend-vue verify        225 文件 / 1870 单测；词典 953 key、48 unused
make -C frontend-vue e2e-parity    46    台账 0 行，38 样本
make -C frontend-vue e2e-mock      262 + 19 + 15 + 2 + 6   (= e2e + auth + infra + proxy-options + stream)
make -C frontend-vue e2e-backend   2 + 5 + 2 + 3 + 3 + 5 + 1 + 1
                                   (= protocol + real + scheduled + channels + agents + settings + shell + browser)
make -C frontend-vue e2e-visual    8     **不在 make e2e 里**
make -C frontend-vue e2e-external  3
```

产品 SFC **209**（总 211）。动了 `frontend/` 再加
`python3 scripts/pnpm.py --dir frontend check` / `test`（1010）/ `test:e2e`（**146**）。

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
4. **「本仓可能更好」的一律先问用户。** wave 17/18/20/21 各问过一次，
   **答案从来不是预设的那个。**

### 边界

默认只改 `frontend-vue/`。**根因确实在 `frontend/` 时可以两边同改**——同一处修法
同时落到两个应用，两边的树仍逐行一致，台账不增行。判据：**这处不改，React 自己是不是
也是坏的？** 是，才动 `frontend/`。改完必须跑 `make -C frontend-vue upstream-accept`
并**单独提一个 chore 提交**（范本 `git show 132cd0bb`）。**React 侧注释写英文。**

### 台账天生看不见的七类差异

① 需要交互才看得见的；② 藏在请求 body 里的；③ portal 出去还会遮蔽页面的浮层；
④ 顺序与层级（aria 去缩进后按多重集比）；⑤ primitive 的默认值；
⑥ 只在某种后端状态下才分叉的渲染路径；⑦ **这一屏压根没被取样**。

wave 20/21 连着两轮正面打了 ① 和 ⑦。**判据：一个域收工前，把它所有「点一下才出现」
的东西列出来，逐个问「这一屏进过取样面没有」。** 挂展开态很便宜：场景 id 受
`baseline/parity-scenario-coverage.json` 的棘轮约束，但**夹具与 steps 不受**，
直接挂现成场景，基线不用加记录。

---

## 上一轮（wave 21）做了什么

**斜杠建议整簇**，composer 域最后一块硬骨头。8 行台账差异 + 七条行为分叉。

- 新模块 `frontend-vue/app/core/skills/slash-suggestions.ts`（查询解析 + 四条匹配判据）
  与 `app/core/threads/builtin-command.ts`（`isCompleteBuiltinCommand`，两个消费者共用）。
- 展开态挂进 `sidebar` 场景的 `steps`。**这个场景不能有 click 步骤**——活动项现在
  两边都跟指针走，Playwright 的虚拟指针会停在上一步点过的地方。
- 两处两边同改（用户拍板）：打全的内建命令 Enter 直接执行；给内建命令预留名额
  （上游 ≥6 个启用技能时 `/goal`/`/compact` 会从列表里彻底消失）。
- 负向验证 36 条全红，其中两条第一次是假绿（见下面的新线索）。

### wave 21 新增的踩坑线索（记忆里编号 104~106）

- **104. probe 自己会被自己前面的步骤污染。** 一页跑多个交互态时，前一步留下的
  持久状态（例如 dismiss 记的那行文本）会让后一步量出假结论。
  **每测一种交互态换一个 fresh context。**
- **105. `@vue/test-utils` 的 `trigger()` 对 disabled 元素静默不做事。**
  「禁用态下不该发生 X」的用例如果路径要经过 `trigger()`，会假绿。
  改成「先开着、把状态做出来、再 `setProps({disabled:true})`」。
- **106. 元素被 `v-if` 换掉时不派发 blur**，焦点标志会停在上一个元素留下的 true 上。
  给互斥的两个元素挂同一个标志时，A/B 两半都要断言。

---

## 下一轮（wave 22）：settings 其余 section

**composer 域已收工**，只剩两条明确判定为「台账测不到、各自需要单独一轮」的账
（见下面「挂着的账」）。

### 入口

`settings.memory.markdown.*` **七条 unused 词条，已核实是真缺 UI**：
上游 `frontend/src/components/workspace/settings/memory-settings-page.tsx:153-200`
用 `historyBackground` / `overview` / `userContext` / `rawJson` + 三个
`table.confidenceLevel.*` **拼一份 markdown** 再渲染；本仓 `MemorySettings.vue`
是另一套结构。

### 域的全貌

六个面板（account / appearance / notification / tools / skills / memory）内部都还是
自己长的结构：裸 `<h2>`、手搓按钮、没有 shadcn primitive。about 两边差最远——
React 是一份 markdown 走 SafeStreamdown，本仓是手写 article。
**外壳部分 wave 6 已经做完**，`make e2e-settings` 覆盖生产路径。

之后是 auth / setup / showcase。

---

## 挂着的账（有意没修；**当假设重新验**）

### composer 域剩下的两条

- **follow-up 确认框仍是手搓副本。** 上游 `input-box.tsx:2750` 是真 `<Dialog>`
  （portal / 焦点陷阱 / 遮罩 / Escape / DialogTitle+DialogDescription + 三个 Button）；
  本仓 `ChatComposer.vue` 是 `absolute bottom-full` 的
  `div[role=dialog][aria-modal=true]` + 手搓按钮，**且多渲染一段 `pendingFollowup`
  正文（上游没有）**。本仓 `ui/dialog` 早就有了。改动会动焦点顺序与「第一个可聚焦
  元素」的断言。**顺带把 follow-up chip 那五条缺失守卫一起做掉**：上游
  `showFollowups`（`input-box.tsx:1965`）是
  `!disabled && !isWelcomeMode && !showSkillSuggestions && !selectedSlashSkill &&
  !followupsHidden && status !== "streaming" && (...)`，本仓 `AgentChat.vue:1871`
  只有 `!bootstrap && !isWelcomeMode && (loading || length)`。要给 ChatComposer 加一个
  emit（上游对应 `onFollowupsVisibilityChange`）。
- **模式图标与 golden-text 整簇。** 上游模式触发器与每个菜单项都带
  Zap/Lightbulb/GraduationCap/Rocket，ultra 还有金色 `golden-text`
  （`frontend/src/styles/globals.css:405`）；本仓一个都没有，`app/assets/css/main.css`
  里连 `.golden-text` 都没有。**图标不进可访问性树、菜单不是几何锚点，
  所以台账永远测不到这一条。**

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
- **run 成功结束之后退回「重新取的 checkpoint」**（跨域候选）。
- **上游种子取数失败会弹 toast**（`hooks.ts:1839`），本仓静默降级（S8 明写 403/404 属常态）。
- **上游 `MessageList` 的 `handleSubmitHumanInput` 在 catch 里 `toast.error`**，
  本仓静默清 pending。
- **`messages.clarification` / `messages.conversation` / `messages.subtask` 是既有
  死条目**，unused 扫描器按叶子名匹配看不见它们。清理整簇属词典手术，单独一轮。
- **`browser.trigger` / `browser.navigationFailed` 也是死条目**（只有测试在消费）。
- **`inputBox.voiceInputStop` 是上游自己也零消费的死条目**，有意留着，**不是缺 UI**。
- **chip 编辑区上游是 `<span contentEditable>`、本仓是 `<div>`**（role 都是 textbox）。

### 剩余 48 条 unused 词条

逐条 grep 时注意**扫描器按叶子名匹配，双向都会漏报**：不在 unused 里不等于有人用
（`inputBox.mode` 就是这样被埋了很久）。当前清单见记忆文件。

---

## 很省时间的调查手段

临时写 `frontend-vue/tests/e2e-parity/probe.spec.ts`，复用 `support/scenarios.ts` 的
`runScenario` 把页面带到 settle 状态，再 `page.evaluate` 直接读 DOM，dump 成 json：

```bash
cd frontend-vue && PROBE_OUT=/tmp/p.json node scripts/with-loopback-no-proxy.mjs -- python3 ../scripts/pnpm.py --dir frontend-vue exec playwright test -c playwright.parity.config.ts probe.spec.ts --workers=1 --reporter=line
```

- **必须在 `frontend-vue/` 目录下跑**（`with-loopback-no-proxy.mjs` 是模块内路径）。
- **`--workers=1` 不能省**：`test.afterAll` 写文件，多 worker 下模块级 results 收不齐。
- `captureScenario` 在 `runScenario` 之后还静置 700ms，probe 要复现这个时序。
- 取 aria 之后**在本地用 `normalizeAriaSnapshot` + 去缩进多重集算一遍**再比——
  直接 unified diff 会看到一堆台账根本不管的层级差异。
- `page.evaluate` 传字符串形式的函数不会执行，**要传真的函数**。
- **每测一种交互态换一个 fresh context**（线索 104）。
- **提交前记得删掉 probe**（留着会让门禁条数对不上，`any` 会让 lint 红，
  删了不 `git add` 会让 `doc-references` 守卫假红）。

## 负向验证的做法

逐条变异 → **回读文件确认变异真的落地** → 只跑相关单测/e2e 文件 → 还原，
结果做成表格贴进提交说明。**假绿要如实写进去，连同成因。**
变异脚本跑完确认 `git status` 干净再提交。
只有对照门禁抓得到的那几条，要**真跑一遍 parity** 证实——把几处一起变异跑一次，
看报出的行是否逐条可归因，再还原后跑一次干净的。
（macOS 的 BSD sed 不支持 `0,/pat/`，**退出码 0 但文件一个字节没改**；用 python harness。）

## 其他常踩的坑（完整 106 条在记忆文件里）

- **新增 Vue SFC 要同步三个数字**：`I18N_INVENTORY.md` 的「共有 N 个 Vue SFC」与
  「N 个产品 SFC」（**211 / 209**）、`tests/unit/i18n/source-guard.test.ts` 的
  `toHaveLength(209)`。`tests/guards/doc-facts.test.ts` 把 key 数与 unused 数对死
  （**953 / 48**）——改 i18n 后跑 `make i18n-refresh`，那两句话也要一起改。
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

## 背景在哪

- 每一轮的实测记录、106 条踩坑线索：Claude 记忆 `deerflow-parity-harness-plan`
- 判据与踩过的坑写在各文件头注释里，**不要跳过**：
  `frontend-vue/tests/e2e-parity/support/{capture,scenarios,react-preview,context-options,fixture-thread}.ts`、
  `frontend-vue/tests/e2e-parity/diff.spec.ts`、`frontend-vue/scripts/lib/aria-parity.mjs`、
  `app/components/chat/*.vue`、`app/components/ui/command/*.vue`、
  `app/core/skills/slash-suggestions.ts`、`workspace/sidecar/SidecarPanel.vue`、
  `workspace/browser-view/BrowserPanel.vue`
- 取数合同在 `frontend-vue/BEHAVIOR_CONTRACTS.md` 的 **S8 / S8a / S8b / S8c**
- **文件头里写着「实测过、做不到」的结论，也要看它给的机制对不对。已经翻案十一次。**
  **上一轮写下的推断，下一轮仍要当假设重新验。**
