# React → Vue 对照对齐：轮次交接文档

**这份文档是每一轮开工的第一读物。** 它记录「上一轮做完了什么、下一轮做什么、
有哪些账挂着」。深度背景（踩坑线索、每一轮的实测记录）在 Claude 的记忆文件
`deerflow-parity-harness-plan` 里；这里只放接手一轮所需的最小集合。

**每推完一个阶段（一轮 wave），就地更新这份文档，然后开始下一轮。**

---

## 当前状态（截至 wave 70，2026-09-05）

- 分支 `main-wc`。`b700cf17` = wave 39（chore `b09adb80`），
  `aef3618d` = wave 40（chore `2f9627fa`），`096c17d4` = wave 41，`706b3785` = wave 42，
  `54454b7c` = wave 43，`46f62dea` = wave 44，`f15c7181` = wave 45，`ca1c7f1d` = wave 46，
  `c12c4d37` = wave 47，`3f152764` = wave 48，`5978d533` = wave 49，`80ef4d15` = wave 50，
  `a1d675d6` = wave 51，`3382f7e0` = wave 52，`333edeef` = wave 53，`ff2cd759` = wave 54，`c8b2d1a8` = wave 55，`509219ea` = wave 56，`ccf6d0b8` = wave 57，`3e47b1fd` = wave 58，`cffb11f4` = wave 59，`ed0439ee` = wave 60，`88d4859d` = wave 61（chore `891d3f7a`），`ff9552d8` = wave 62（chore `088ea168`），`85ca893a` = wave 63，`2759b3e8` = wave 64，`bc34c7b3` = wave 65，`2b2f56b7` = wave 66，`5cf9d44d` = wave 67，`e775ba9e` = wave 68，`585e0bc7` = wave 69（chore `eec54d3c`），`43d5f289` = wave 70。
- **动过 `frontend/` 的是十五轮**（wave 52 实测订正，wave 62 又加一轮）：
  wave **3 / 4 / 6 / 11 / 17 / 20 / 21 / 22 / 23 / 27 / 28 / 36 / 39 / 40 / 62**。
  此前这里只列了 36/39/40（那三行本身没说错，它们的范围是「wave 30 以来」），
  而记忆里的压缩版把它读成了「总共三次」。**别再传这个数字，用命令量**：

  ```bash
  git log --format='%h %ci %s' --since=2026-08-25 -- frontend/src frontend/tests
  ```

  **marker 已推到 `ff9552d8`**（wave 62）；`node scripts/upstream-drift.mjs`
  wave 52 实测**无漂移**，marker 也确实是 HEAD 的祖先——
  **边界规则本身有机器在守，需要人记的只有「这类改动做过哪些轮」。**
  最近三轮的内容：wave 40 重连预算耗尽后那颗键在说反话；wave 39 命令面板搜索框的
  可访问名；wave 36 `SidebarTrigger` 的窄屏图标。wave 41~59 都没动过。

- **对照台账 0 行**，**39** 个样本，`make -C frontend-vue e2e-parity` **47** 条全绿。
- 覆盖率棘轮：covered **24**，pending **仍是 1 条**（`chat-thread-init-ordering`）——
  **wave 63 用 23 个样本重测过，仍然不能加**（React 两个终态 19B/4A，Vue 23/23 单一）。
  翻案判据已从「连取 5 次」**收紧到连取 20 次**，连同复现脚本一起写在 `$pendingReasons` 里。
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
  **重连预算耗尽后的模式键**（wave 40，两边同改）与
  **run 结束后重取 checkpoint**（wave 41）与**提交键的出错态**（wave 43）。
  **wave 42/44 把「请求体」这一整类扫完并补上了守卫**（台账只比 method+path+query，
  请求体从来没进过任何比对；wave 44 在这一类里撞出并修掉了 `sortBy`→`sort_by`）。

> **`app/pages/` 下的路由已经一条不剩地量过了**（wave 28 量完最后三条）。
> **要找活只能去「挂着的账」里挑**，不要再指望「还有没量过的路由」。

> **settings 域有一个取样点**（`settings-notification`，wave 25 的 `stubs`）。
> 其余六个面板仍然没有合法的场景 id（棘轮要求 id 逐字等于 React spec 文件名），
> 它们的差异只能靠 probe 找、靠单测守（线索 107）。

### 门禁实测值（wave 70 收工时逐条跑过）

```
make -C frontend-vue verify        exit 0；256 文件 / 2120 单测，词典 944 key、18 unused
make -C frontend-vue asset-budget  exit 0（wave 66 起才是绿的，**从此进每轮清单**）
make -C frontend-vue audit         **预期红**：14 条，分诊写在 Makefile 的 audit 上方
make -C frontend-vue coverage      语句 73.22% / 分支 64.72% / 函数 70.55% / 行 74.9%
                                   **诊断工具，不进 verify，没有阈值**
                                   standalone-check BLOCKING 0 处 / 0 个文件（DECLARED 39 处 / 17 个文件）
make -C frontend-vue e2e-parity    47    台账 0 行，39 样本（NEW=0 GONE=0）
make -C frontend-vue e2e-mock      265 + 22 + 15 + 2 + 6   (= e2e + auth + infra + proxy-options + stream)
make -C frontend-vue e2e-backend   2 + 5 + 2 + 3 + 3 + 5 + 1 + 1
make -C frontend-vue e2e-visual    8    **不在 make e2e 里**
make -C frontend-vue e2e-external  3
```

产品 SFC **216**（总 218；wave 69 新增 `TruncatedTooltip.vue`，是 wave 30 以来第一个）。动了 `frontend/` 再加
`python3 scripts/pnpm.py --dir frontend check` / `test`（**1029**）/ `test:e2e`（**146**）。
**wave 62 三条全真跑过**：check 0、test 1029 passed、test:e2e 146 passed。
（1023 → 1029 是 wave 62 加的 6 条：3 条 auth-callback 路由位置 + 3 条图标按钮可访问名。）

> **wave 40 实测：`test:e2e` 的 `webServer` 那 120 秒窗口在这台机器上喂不饱一次
> `next build`**（负载 30+ 时编译要 6.6 分钟，`Timed out waiting 120000ms from
config.webServer` 在任何测试跑起来之前就炸）。**绕法**：先自己 `next build`，
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

**第五条已知抖动（wave 66 新增）**：`tests/e2e/thread-history.spec.ts:695`
（`new chat does not show previous optimistic user message after client-side navigation`）
报 `element(s) not found`。**因果够不着**：那一轮唯一影响产物的改动是
`chunkFileNames`，只改**文件名**、不改分组也不改执行，而**同一份改动在同一轮更早
那次 `make e2e` 里这条是绿的**。整份 spec `--repeat-each=5` **90/90 全过**。
机制与前四条同类：异步 + 固定超时。

**第四条已知抖动（wave 54 新增）**：`tests/e2e/i18n-theme.spec.ts:45` 里
`sidebarPanel.locator('[data-sidebar="trigger"]').click()` 30s 超时，
call log 是 `element is not visible / not stable`——**一个 hover 才出现的控件**。
因果够不着：那一轮改的 `app/` 两处**都在块注释里**（编译产物逐字节不变），
其余改动是脚本注释、fixture 的 `$comment` 和一条门禁测试。
负载降到 ~2.5 后 `--repeat-each=5` **35/35 全绿**，整套 `e2e-mock` 重跑到 265。
机制与前三条同类：hover/滚动/异步 + 固定超时。

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

1. **台账保持 0。** 不要用 `make parity-accept` 收工。
   **真正的判据是 `e2e-parity` 本身**——`diff.spec.ts` 做的是
   `expect(entries).toEqual(baseline.entries)`，**整棵结构深比**，
   新增、消失、内容变更、场景增减全覆盖，比「NEW/GONE 都是 0」更严。
   要把结果读成人话就跑 **`node scripts/parity-ledger-report.mjs`**，
   **不要再手搓第二套比法**——wave 50 复核发现，此前每轮临时写的那段 python
   走 `d.get("scenarios", d)` 兜底，而基线的顶层键是 **`entries`**，
   于是**基线行数恒为 0 与内容无关**：`NEW` 那一半是真量的，
   **`GONE` 那一半是结构决定的、从来没测出过任何东西**，
   「两边场景集合一不一致」更是压根没查。结论没错（门禁一直在深比），
   但那句「独立复核过」是空的。
   新增场景时基线加一条**五个数组全空**的记录。
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

## 上一轮（wave 65~66）做了什么：**全套跑一遍,三处红全部定性并处理**

用户要求「全面测试 frontend-vue」，14 项门禁串行跑完，**3 项红**。

### 红一：`e2e-mock` —— **是我 wave 62 埋的**（wave 65 修）

`i18n-theme.spec.ts:45` 报
`strict mode violation: getByLabel('复制到剪贴板') resolved to 2 elements`。
wave 62 给消息轮次的复制键补上可访问名之后，这一屏同名元素从 1 个变 3 个，
那条裸定位器能不能唯一**取决于轮次操作条那一刻渲染没渲染**。
**它在 wave 62 与 wave 64 两次全跑里都是绿的**——**绿过两次不等于它是对的。**

两颗同名按钮**不是缺陷**（上游 `artifact-file-detail.tsx:563` 用的也是同一句），
所以改的是定位器：`ArtifactPanel.vue` 的 `<header>` 加 `data-testid`，用例限定作用域。
变异实测（拿掉 testid → 当场红）+ `--repeat-each=6` **42/42**。

### 红二：`asset-budget` —— **一个测错了东西的门禁**（wave 66）

它报 `vendor-ui 728591 > 380000`，而注释写着这一格装的是 Reka 的那些 primitive。
**量出来：最大的两个 chunk（320 KB / 192 KB）一个匹配包都不含。**
根因是 chunk 名字按「chunk 里任意一个模块 id 命中」贴，而原来的种子里有
`lucide-vue-next|cva|clsx|tailwind-merge`——**几乎每个组件都 import**。

收窄种子（24→10 chunk）+ **删掉注释里那个做不到的承诺**（这一格是漂移警报，
不是字节归属；收窄之后仍有 4 个 chunk 两个标记都搜不到）+ 按实测重定预算。
新门禁 `chunk-buckets.test.ts` 钉「预算的桶 ↔ 命名规则的桶」双向对应。
**route-payload 复跑全绿——改名不动分组，用户下载的东西一个字节没变。**

### 红三：`audit` —— **逐条查可达性，结论是不动**（wave 66）

三个 high 全部不可达（`js-yaml` 0 个客户端 chunk；`nanoid` 要传自定义生成器；
`lodash-es` 的 `_.template` 注入，chevrotain 不这么用）。
**mermaid 那条有意不升**：上游经 `@streamdown/mermaid` 解析成 **11.12.2**，
本仓精确锁同一版**为的是两个应用画出同一张图**，而 mermaid 渲染直接进对照取样面。
单边升级台账当场分叉；两边一起升要覆盖被 vendored 的依赖树。
**归属方是上游，不是这个 fork。** 分诊写进 Makefile 与 README。

### 顺带

`asset-budget` 与 `audit` **此前不在任何一轮的门禁清单里**——和 `make coverage`
之前的处境一样。`asset-budget` 现在是绿的，已进清单；`audit` 预期红，分诊已记。

## 上一轮（wave 70）做了什么：**回答「全排查完了吗」——没有，并把数字量准**

提交 `43d5f289`。用户问「所有页面和组件全部排查完毕了吗」，
并明确了判据：**「只要功能和交互一致样式一致就行，拆的更细没问题」**。

### 修掉的

- **artifact 工具条八颗键**：三颗画错字形（`Edit3`(=PenLine) vs 上游 `Pencil`、
  `X` vs 上游 `PencilOff`、`ExternalLink` vs 上游 `SquareArrowOutUpRight`）、
  八颗 15px vs 上游 16px、**只有一颗 hover 有反应**而上游八颗都包 `<Tooltip>`、
  手写按钮少了 `disabled:opacity-50`（保存与复制禁用时和能点一样）与焦点环。
  整排改走 `<Button>`。
- **agent 卡片页脚三颗**：聊天键没图标、设置键画的是**文字 `⚙`**、
  删除键是文字 `×` 且用固定色 `text-red-600`（深色主题不跟着变）。
- **消息附件卡**画 `FileText` 而上游 `File`。
- **15 处「禁用了但看不出来」**，并加 `tests/guards/disabled-affordance.test.ts`。

### 量出来的剩余面（**下一轮正题**）

| 项                              | 数字                                                  |
| ------------------------------- | ----------------------------------------------------- |
| 手写 `<button>`                 | **Vue 102 / React 12**，9 倍                          |
| 其中自己画外观                  | **80**                                                |
| **没有 `focus-visible` 焦点环** | **100**                                               |
| `icon-parity` 未核实字形线索    | 30 → 剩 **20**（全在 `ai-elements/`、`ui/` 或豁免面） |
| `dom-parity` 几何档             | 仍**只有 `/login`** 真验过                            |

**焦点环那 100 处不能机械补**：有的按钮贴着容器边，加 3px 环会顶到别的元素，
要逐处看。分布：AgentChat 9、ChatComposer 7、ThreadSidebar 6、MemorySettings 6、
MermaidDownloadMenu 4、ChannelConnections 4，其余 1~3。

### icon-parity 自己的第 6~8 次

1. **我写的注释把 `CheckCircle` 从扫描里静默剔掉了**——按逗号切 import 块时
   注释粘在名字前，整段当无效名丢弃，于是报告说「`CircleCheckBig` 只有 React 用」，
   而那一处当轮刚改对。**方向是漏报，比误报更难发现。**
2. tooltip / aria 那档**跟一层委托**（用户已确认「拆得更细没问题」）。
3. **尺寸加了一档全仓的**——按文件只覆盖 57/199，本仓 71% 的组件从没被那档看过。

### 第六条负载抖动

`tests/e2e-auth/auth-contract.spec.ts:192`（`?next=` 深链回跳）。
因果够不着（本轮对 login.vue 的唯一改动是给一颗按钮加两个 `disabled:` class），
`--repeat-each=3` **42/42**。

## wave 69 做了什么：**把 wave 68 的手法做成机械扫描，又扫出六处**

提交 `585e0bc7`（chore `eec54d3c`）。wave 68 那十六处是**读 React 源码**读出来的，
而「图标字形 / 图标尺寸 / 有没有 Tooltip」这三样都不进可访问性树，几何档也只在
两边同时跑起来、且元素当时可见时才够得着。做成 `make icon-parity`
（`scripts/icon-parity.mjs`，**只读源码，不用把应用跑起来**，所以够得着登录后的屏），
扫出 30 条线索，逐条回源码核实后确认六处。

| 处  | 内容                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------- |
| 1~2 | `SubtaskCard` 画 `CheckCircle2`(=CircleCheck)，上游 `CheckCircleIcon`(=**CircleCheckBig**)——两颗不同字形  |
| 3   | `CitationSourcesPanel` 外链图标 13px，上游 `size-3.5` = 14px                                              |
| 4   | `SidecarPanel` 回形针 14px，上游 `size-3` = 12px                                                          |
| 5   | `GoalStatus` 续跑计数用原生 `title`，上游包在 `<Tooltip>` 里                                              |
| 6   | `ArtifactTrigger` 没有 Tooltip；窄屏下文字被 `hidden sm:inline` 收起来，那时它是纯图标键                  |
| 7~8 | `AgentCard` 的名字与描述被截断后**没有任何办法看到全文**（新增 `TruncatedTooltip.vue`，只在真截断时才出） |

### 两条量过的否定结论

- **消息点赞/点踩不是「Vue 缺功能」。** 本仓 `core/api/feedback.ts` 零消费者，
  看着像少了一整个功能；但**全 React 仓库没有一处**传 `feedback={...}`，
  而 `FeedbackButtons` 的渲染条件是 `feedback !== undefined`，
  `MessageListItem` 又只被 `message-list.tsx` 引用——**上游那套 UI 也从来不渲染**，
  也没有任何测试。两边都带着死的反馈代码，位置不同而已。
- **workspace 改动面板的逐文件 `+N/-N` 不是缺失**，本仓放在内联徽章列表里、
  上游放在展开面板里；状态本仓用文字、上游用带色图标。**两边双视图结构不同，
  记成待核线索，没有半修。**

### 这把新尺子自己被修了五次（与 wave 68 的 `dom-parity` 同源）

1. `size-3.5` 被 `size-(\d+)` 读成 `size-3` → 14px 报成 12px，
   **三条里两条是这么来的假线索**。
2. 只比「两边同名的图标」，名字不同就完全看不见——而 wave 68 一轮已被这一类咬两次。
   改成按两个包各自的 `.d.ts` 解析成 lucide 规范名。
3. 字形档拿「写了尺寸的」当「用没用过」，把 composer 在用的 `Zap` 报成「只有 React 用」。
   改成从 import 语句收集。
4. 按文件问「有没有这颗」全是噪声（两边组件切分方式不同）。
   **尺寸按文件比，字形按全仓比。**
5. `DialogPrimitive` 这类也带 `size-*` 但不是图标。只认在别名表里的名字。

配两条 exit 2 形状断言 + `tests/guards/icon-parity-tool.test.ts` 钉「那些断言还在」。
工具按 `upstream-drift.mjs` 的先例进 `CROSS_APP_BY_DESIGN`，
**并真的做到「上游缺席时打印一行退出 0」**（否则声明就是假的）。

### 负向验证

五条变异全部转红。**头两次 N5/N6 是无效变异**：单边替换开标签把 SFC 改坏了，
整个测试文件加载失败（14 条变 8 条 / 6 条）——**「跑出来少了几条」和「红了几条」
要分清**，重做成成对替换才算数。

### 一条负载抖动

`thread-list-infinite-scroll.spec.ts:74`（已登记的第四条）。因果够不着：
侧栏子树的传递闭包是 **88 文件 / 31 SFC**，七个改动件一个都不在。
（第一版遍历只跟 `@/….vue`、漏了桶导出，只数出 7 个 SFC——
**从少算的集合里得出「无命中」不算数**。）`--repeat-each=5` **15/15**。

## wave 68 做了什么：**用户报了一处间距，量下来一屏十六处**

提交 `e775ba9e`。**入口是用户自己看出来的**：「标题和描述怎么跟输入框没有间距」。

### 最值钱的一条不是样式：撤销优化会吞掉用户后来打的字

上游 `input-box.tsx:1339` 的撤销判据是三条与——没在润色中、有过一次成功改写、
**而且输入框现在的文本仍逐字等于那一版改写**。本仓只有前两条。用户润色完接着
往下打字时，那颗键仍写着「撤销优化」，按下去把新打的一起换回润色前那一版，
且没有二次撤销。补第三条（新增 `polishRewritten`）。

### 十六处的分布

| 处    | 内容                                                                                                                                                            |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | 撤销判据缺第三条 → 数据丢失                                                                                                                                     |
| 2~4   | 润色中的胶囊：没 `role="status"`/`aria-live`、8px 脉冲点而非 12px 转圈、取消键被放到页脚顶替优化键                                                              |
| 5     | 撤销态不换 `Undo2Icon`                                                                                                                                          |
| 6     | 欢迎区渲染成 composer 的**兄弟节点** → 零高度锚点挂到外层容器（top 304 而非 288），宽 2px 之差让段落少折一行                                                    |
| 7~9   | 三颗图标键 `size-8`（32×32）而上游 `h-8 px-2` + 12px 图标（28×32）                                                                                              |
| 10~11 | 优化键多渲染「优化输入」（28px→82px）、且没有 Tooltip                                                                                                           |
| 12    | 语音键用原生 `:title` 而不是 Tooltip 组件                                                                                                                       |
| 13    | 优化键图标 `WandSparkles` 而上游 `SparklesIcon`                                                                                                                 |
| 14~16 | 登录页**整页绕开 Input/Button primitive** 手写 class：输入框 42/16px vs 36/14px、复选框 13px vs 16px、提交键 40px vs 36px、链接撑满整行 vs 行内、少一层字段分组 |

**这十六处 `ariaSnapshot()` 一处都看不见**，对照台账也全绿——两边 role、可访问名、
层级、顺序**全都一样**，只是画在不同位置和尺寸上；`sampleGeometry` 又只量场景
settle 锚点（线索 137）。所以给 `dom-parity` 加了几何档（按 `data-testid`、
否则 role+可访问名连接，比位置/尺寸/字号/内边距/圆角/边框）。

### 加完当轮，这把新尺子自己踩了线索 176 三次

1. **`diffBoxes` 不报连上了几个。** 补上计数后当场炸出问题——三个完全不同的页面
   都恰好「连上 7 个」。
2. **`waitUntil: "networkidle"` 在开发服务器上永不成立**（HMR 长连接）。landing 每次
   走到 30s 超时，catch 里**静默返回空 boxes**，印出来是「几何差异 0 处」，
   和「逐条量过、确实一样」长得一模一样。改 `domcontentloaded` + 有上限静置后
   landing 才真的加载（连上 12 个 / 27 处差异，豁免区只记录）。
3. **不校验落地 URL。** `/setup` 与 `/showcase/<id>` 在本机这套 Docker 栈上两边都要
   登录、各自跳 `/login`，于是拍到的是**同一张登录页**，aria 与几何自然逐字相同。
   `showcase` 是当轮刚加的场景，**差点把「第三次量登录页」当成「工作区对齐了」
   写进结论**。现在跳转会明说「下面的 0 不构成这一屏的对齐证据」。

### 视觉基线重录九张（取舍）

零容差下逐张量两遍：六张逐像素稳定（dark-mode 11895 / empty-chat 9167 /
streaming 5574 / zh-CN settings 990 / settings 599 / reasoning 234），
只有 artifact panel 带 ~80px 抖动（249/332）。**全在 `maxDiffPixelRatio: 0.01`
的地板之下才没红**——留着不录等于把容差预算花在一次已经发生的改动上。
注意 `-u all` 会无条件重写（含逐像素相同的那张），字节差里混着编码噪声，
**不能拿它当「变了」的证据**；正确做法是把容差临时压到 0 再 `--update-snapshots`。

### 三条旧断言改了钉法（不是为了变绿）

两条钉「按钮的可见文字」，而上游这颗键三态都只有一颗图标——**拿可见文字当断言
等于把落差写进合同**，改成钉可访问名 + 图标类名。一条钉含换行缩进的源码子串，
套上 Tooltip 后 prettier 折了行、表达式一个字没变就红了，改成压掉空白再比。

### 量过的否定结论

`next` 参数编码**不是缺陷**。实测 React 跳 `next=%2Fshowcase%2F…`、Vue 跳
`next=/showcase/…`，但两边源码都调 `encodeURIComponent`，差别来自 vue-router
导航后重新序列化 query 时不给 `/` 重新编码；登录页读的是 `route.query.next`
（已解码），两种形态回跳一致。

### 负向验证

六条变异逐条落盘后只跑 composer 单测，全部转红，**无假绿**：撤销判据退回旧式 1、
撤销态画回 Sparkles 1、胶囊去 role/aria-live 1、取消键换 testid 2、
页脚优化键润色时消失 1、语音键丢 disabled 1。

## 下一轮：**三条**

### 零、100 处没有焦点环的手写按钮（**最大的一块**）

键盘用户看不见焦点在哪。**不能机械补**——贴边的按钮加 3px 环会顶到相邻元素。
先按文件分批，每批跑 `make e2e-visual` 看有没有把布局挤动。

### 一、几何这一档只够得着免登录页

`dom-parity` 现在只能扫 landing / login 两屏（setup 与 showcase 都跳登录）。
**工作区那些屏要么把几何接进对照台账**（`sampleGeometry` 现在只量 settle 锚点，
这是线索 137 的正题），**要么给 `dom-parity` 接上两边的 mock 网关**——
后者是重造一遍台账已有的东西，前者动的是有基线的门禁。**先想清楚再动。**

### 二、`icon-parity` 还剩 30 条**没核实的**线索

字形档 22 条「只有 React 用」+ 5 条「只有 Vue 用」，加上按文件的尺寸差。
**它们是线索不是结论**——wave 69 核过的那批里，假线索比真差异还多。
已核实并排除的：ThumbsUp/ThumbsDown（两边都是死代码）、
Bookmark/GripVertical/OctagonX/TriangleAlert（在 `ui/` 与 `ai-elements/` 里，
两边 primitive 实现不同）、FileMinus/FilePlus/FilePenLine（改动面板双视图结构不同）。

**如果要开别的，先说清楚「这一轮要让哪个用户的什么体验变好」。**
覆盖率地图（`app/components` 66%）**不是待办清单**。

## wave 64 做了什么：**把覆盖率接上，并订正 wave 63 的误判**

### 订正：不是「配置工程」，是一个 devDependency 装错了大版本

wave 63 说「要出真数字得先做配置工程」——**错的**。裸
`pnpm add -Dw @vitest/coverage-v8` 装到了 **5.0.0**（peer 要 vitest 5.0.0），
而本仓是 **vitest 4.1.10**。报出来的是

```
AssertionError: coverageFilesDirectory is required
```

出现在**每一个 worker** 上、一次 251 个未处理错误、summary 是
`0/14384 statements`，而且 node / dom / nuxt 三个 project **全都一样**
——**看起来像「这套三-project 配置不支持覆盖率」，实际是 v5 的 provider
在跟 v4 的核心说话**。装同一条 range 之后一次就过，
**`vitest.config.ts` 一个字都不用改**（试过加 `coverage` 块，再还原成
只用命令行参数，一样跑通）。

### 实测的覆盖率

```
语句 73.22%   分支 64.72%   函数 70.55%   行 74.90%
```

| 目录                  | 行覆盖 |     | 目录                                        | 行覆盖                 |
| --------------------- | ------ | --- | ------------------------------------------- | ---------------------- |
| `app/lib`             | 100.0% |     | `app/composables`                           | 72.4%                  |
| `packages/agent-core` | 94.3%  |     | **`app/components`**                        | **66.0%**（3995/6052） |
| `app/pages`           | 91.6%  |     | `server/utils`                              | 21.9%                  |
| `app/core`            | 85.5%  |     | `app/layouts` / `server/routes` / `app.vue` | **0%**                 |

**那几个 0% 不代表没测**：layouts、Nitro 路由、`app.vue` 靠 **e2e** 覆盖，
而 v8 只看得见单测进程里执行的代码。**这个数是「单测行覆盖」，不是「测试覆盖」。**

### 落地的三样

1. **`@vitest/coverage-v8` 与 `vitest` 用同一条 range**（`^4.1.10`）。
2. **`make coverage`** —— **有意不进 `verify`，也没有阈值**。覆盖率当门禁会逼着
   写凑数的测试；它是**诊断工具**，用来找「哪一块没人测」。
3. **`tests/guards/tooling-contracts.test.ts`**（新）：
   - **成组依赖的 range 必须逐字相同**——钉的不是版本号（那会让每次升级都要改守卫），
     是「这两条一起动」。变异实测：把 provider 跳到 `^5.0.0` 当场红。
   - **`.PHONY` 与实际 target 一一对应**。wave 60 手工量过一次（53:53 全对）
     **但没留门禁**；wave 64 变异实测：把 `coverage:` 改名而 `.PHONY` 不动，
     **当时一条用例都不红**。两个方向都钉（有 target 没声明最阴——
     目录里有同名文件时 make 会静默什么都不做）。

### 负向验证 6/6 全红，其中两条第一次是假绿

| 变异                                  | 结果                                                                                                                                     |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| provider 跳到大版本 5（正是踩过的坑） | RED                                                                                                                                      |
| 整条依赖被删掉                        | RED                                                                                                                                      |
| 只升 vitest 不升 provider             | RED                                                                                                                                      |
| **LOCKSTEP 清单清空**                 | **第一次 GREEN**——两个 for 都不进循环，断言全部落空却照样绿（**线索 176 本人**）。补 `expect(LOCKSTEP.length).toBeGreaterThan(0)` 后 RED |
| **target 改名而 `.PHONY` 没跟**       | **第一次 GREEN**——那条门禁当时还不存在，写出来之后 RED                                                                                   |
| 反方向：`.PHONY` 里去掉 `coverage`    | RED                                                                                                                                      |

## wave 63 做了什么：**去补最后一条场景，量完是「补不了」**

覆盖率棘轮里 `chat-thread-init-ordering` 的翻案判据是「竞态修好之后连取 5 次
只出现一个终态」，而 wave 62 刚说竞态没了。去验证 —— **判据没满足，
而且 wave 62 那句是错的。**

### 错在哪：量的取样点不对

wave 62 的探针**等了 30 秒**才读标题；棘轮的取样点是 `captureScenario` 的
**`settleMs = 700`**，它不会多等（硬规则 2 还明写这个数不许动）。
**按 700ms 重测 23 个样本（5 + 6 + 12 三批，同一次构建）**：
React 仍是**两个终态、19 B / 4 A（约 17%）**；Vue **23/23 单一**。

变的只有一件事：**A 不再是吸收态**（wave 29 时 5 次里 2 次等满 30s，
现在 14/14 都会清掉）。**A 从「终态」变成了「慢」——但对等不了那么久的
那个消费者来说仍然是缺陷。**

### 产出不是新场景，是三样

1. **两个终态的精确差异钉进 `$pendingReasons`**：
   B（55 行 / 23 请求）播报区空、`token-usage` + `messages/page` + `threads/{id}`
   三条已发；A（56 行 / 20 请求）播报区仍是 `Loading... - DeerFlow`、那三条没发、
   **乐观的用户消息还没去重**（`Completed in <1s Hello` + 一颗
   `button "Copy to clipboard"`）。**wave 29 记的「无名按钮」就是这颗复制键。**
2. **复现脚本一并写进去** —— wave 29 只记了现象，害得 34 轮之后要重建整套观测。
3. **翻案判据从「连取 5 次」收紧到「连取 20 次」。** 17% 翻面率下一批干净的 5 次
   并不罕见，**旧判据等于允许靠重跑收工**（撞硬规则 3）。本轮第二批 6/6 全同，
   就此收工正好满足旧判据 —— 而第一批与第三批里两个终态都出现过。

### 顺带答了「frontend-vue 全面测过吗」

**本仓此前从来没有测过行覆盖率**（没配任何工具）。wave 63 临时装
`@vitest/coverage-v8` 挂不上，当时判成「要做配置工程」——**那句 wave 64 订正了，
是错的**：真正的原因是裸 `pnpm add` 装到了 **5.0.0** 而本仓是 vitest **4.1.10**，
报的 `coverageFilesDirectory is required` 完全看不出是版本问题。
**装同一条 range 之后一次就过，`vitest.config.ts` 一个字都不用改。**

规模是：单测 251 文件 / 2090 条；e2e-mock 310、e2e-backend 22、e2e-parity 47
（台账 0 行 / 39 样本）、visual 8、external 3;门禁测试 13 文件。
**已知盲区**：台账天生看不见的八类差异、六个 settings 面板没有合法场景 id、
命令面板那一屏没被取样、以及这条 pending。

## wave 62 做了什么：**按产品价值挑了三条，做完；顺手翻出三颗无名控件**

判据换了：**不是「哪里还没对齐」，是「哪一条对真实用户有好处」**（2026-09-04 用户
明确「React 那一侧有 bug，你也得修」）。挑出三条，全部做完。

### 一：`/auth/callback` 吞掉 `?next=` 深链（**改的是 `frontend/`**）

上游 `(auth)/layout.tsx` 见到 `authenticated` 就服务端 `redirect("/workspace")`，
而真实 OAuth 走到 callback 时 session cookie 已经在了——**那一页从来没渲染过**，
它自己对 `next` 的处理是死代码。用户从别人分享的深链登录，登完被扔到工作区首页。

**修法就是 wave 28 记的那条「更小的」**：`src/app/(auth)/auth/` → `src/app/auth/`，
自带一个 `dynamic = "force-dynamic"` 的 layout（不带 AuthProvider / I18nProvider，
那页本来就不用）。守卫按**结构**钉：`/auth/callback` 上方不许有任何 layout 在
`authenticated` 时跳走。**本仓一个字都不用改**——它的全局 middleware 只在
`/workspace/*` 上探 session，一直是对的。

### 二：模型选择器补上 cmdk 的模糊匹配 + 评分排序

把 `cmdk@1.1.1` 的 `command-score` **逐行移植**进
`app/core/models/command-score.ts`，实测 **950 组逐值差 0**。
筛选与排序改走 `app/core/models/filter.ts`。wave 37 那条「分隔符不敏感」删掉了
——**不是放弃是被覆盖**（`formatInput` 把 `[\s-]` 归成空格，`MiniMax M3` 打
`minimax-m3` 得 0.9996）。**原来的理由「引评分库不划算」成立，
但结论应该是「移植算法」而不是「不做」。**

### 三：首次发送那一屏 —— 两条账过期，**第三条我说过头了（wave 63 订正）**

`Completed in <1s` 本仓从 `524beace`（2026-08-13）就画了，比记这条账早两周;
`Edit and rerun` 上游也早有 `aria-label`。**这两条确实过期。**

**但「竞态已经没有了」这句是错的。** wave 62 量的是「等 `Loading…` 消失」
（14/14 都清掉），而**棘轮的取样点是 `settleMs=700`，不会多等**。
wave 63 按那个取样点重测 23 个样本：**React 仍是两个终态（19 B / 4 A，约 17%）**，
Vue 23/23 单一。变的只是 **A 不再是吸收态**（wave 29 时 5 次里 2 次等满 30s）。
**详见「挂着的账」那一节与 `$pendingReasons`。**

### 但同一次普查翻出了三颗真的无名控件，两边都有

探针里顺手加了一条「跑完一轮之后，屏幕上还有哪些交互控件没有可访问名」：

| 控件                         | React | Vue                |
| ---------------------------- | ----- | ------------------ |
| 复制键（human turn）         | 无名  | 无名（**照抄的**） |
| 复制键（assistant turn）     | 无名  | 无名（**照抄的**） |
| 侧栏底部设置触发器（收起态） | 无名  | 无名               |

**tooltip 不是可访问名** —— Radix / Reka 都把它挂成 `aria-describedby`，
读屏器念出来就是一颗「按钮」。两个 Vue 文件头此前都写着「不给可访问名，
因为上游只有图标和 tooltip」——**对上游的描述是准的，照抄的却是缺陷**。
按 wave 28 的判据三处**两边同改**。

### 门禁与负向验证

见下面「门禁实测值」。**9 条有效变异全红**；**1 条第一次假绿**（排序那条用例的
输入序恰好等于分数序，删掉 `.sort()` 照样绿，已补一条输入序≠分数序的）；
**1 条无效变异**（空查询短路——所有分数都是 0.99，删掉它一条用例都不红，
`filter.ts` 里那条「不短路会打乱顺序」的理由因此**是错的，已订正**）。

## wave 61 做了什么：**按 C2 跑了第一轮，清单已经空了**

wave 60 提的新判据 C2 是「不数写错的记录，改数**还没有机器看着的记录类别**；
一个类别要么上门禁，要么写下为什么上不了」。wave 61 就是按它跑的第一轮，
把 wave 60 点名剩下的两条全部收口。**这一轮翻出来的东西，是 C2 第一次被执行
就撞到的**——用旧判据（找一句写错的话）根本找不到它。

### 翻出来的：30 份文件自称 L2，而 L2 的进口边界只遍历白名单

`tests/architecture.test.ts` 有两条 L2 断言：白名单里每一份都要有 `【架构位置】 L2` 头，
以及白名单里每一份都不许 import 产品层（`l2ForbiddenImports`：`@/core/{auth,api,threads…}`、
`@/components/{chat,workspace}`、`@/composables`、`@/stores`、`#app`、`#imports`）。
**两条都只从白名单出发**，于是「自称 L2 但没上白名单」的文件**谁都不检查**。

实测：**162 份文件自称 L2，白名单里只有 132 份**。缺的 30 份**全部**创建于白名单
最后一次改动（`fa2cde27`，**2026-08-13**）之后——`MarkdownTable.vue` 是 08-24，
`dropdown-menu` 的 Sub 三件是 08-26，`select` / `card` / `alert` / `input` / `badge`
是 08-30，横跨至少四次提交。**也就是说，「新增 L2 组件要加进 `l2Files`」这条成文规则，
三周里每一次都被违反，而没有任何门禁变红。**

**其中一份拿边界一跑就违规**：`app/core/auth/logout.ts` 头写着 `L2 core`，
而它 import `@/core/auth/client-state`，正好命中 `l2ForbiddenImports` 第一条。
它本来就不该是 L2——ARCHITECTURE.md 的分层表把 L2 圈定在 `app/core/markdown/`、
`app/core/code-editor/`、`app/components/markdown/`、`app/components/ui/`、
`app/lib/{utils,focusable}.ts`，并明写 L2 **不得依赖**「DeerFlow API、线程、认证、
产物和业务 store」。**已改成 L3，理由写进它自己的文件头。**

**门禁**：`architecture.test.ts` 的 L2 段补三条——① 形状先断言（扫到的数不是零）；
② **自称 L2 的集合逐个等于 `l2Files`**（双向：多出来的会绕过进口边界，少掉的说明
名单里有份文件改了头）；③ 名单按字母序（插入位置唯一）。
名单同时从 132 → **161**（新增 29 + logout 改判 L3），并**排序**——它此前是
「按冻结时间追加」（`app/lib/focusable.ts` 卡在第 30 位、`app/core/code-editor/*`
在第 41 位），而本文件一直写着「按字母序」，**那句话也是错的**。

### 另一条 C2 类别：`【依赖关系】`

逐条读完一遍，**这一栏整体不可能有单一真值**：同一个字段里混着四种东西——
「我 import 什么」（`cn`、`Reka DialogRoot`）、「谁 import 我」（20 份写「被产品组件
显式导入」、`被 Badge.vue 引用`）、一个指路（23 份写「见下方 import。」）、
和散文（`零运行时依赖，纯 type-only`）。**方向都不统一的字段，分类器的豁免表会比
门禁本身长**（线索 180）。

**唯一可证伪的一档是「无 / 零依赖」**：31 份文件这么写，**实测 31 份全对**。
已上门禁（`file-header-claims.test.ts` 的第二个 describe）——
**这是「量过、成立、并且从此有机器看着」，不是「没查」。**

### 写下了「为什么上不了门禁」的

- **`【架构位置】` 的 L1 / L3**（写在 `architecture.test.ts` 的 L2 段前）：L2 有牙
  （对应白名单与进口边界，写错会让产品代码混进可复用层），L1/L3 **没有任何被强制的
  后果**——L1 的定义域就是 `packages/agent-core/`（实测 23 份 src 文件全写着 L1，
  一份不漏），L3 是「除此之外的一切」。**一条只保护注释、不保护任何约束的门禁，
  不如把理由写下来。** 实测唯一的第二义是 `app/core/channels/provider-state.ts`
  的 `L1 framework-neutral channel policy`（只 import 一个同目录 type，说的是
  「与框架无关」这条另一个轴）——**有意保留**。
- **`【文件职责】` 与 `【边界与注意】`**（写在 `file-header-claims.test.ts` 头）：
  它们是**解释**不是断言，没有可判真假的形式。里面**引用**的东西（路径、上游
  file:line、行数、make target、裸文件名、词典 key）另有五条守卫在管，
  **剩下的就是散文，靠读它的人**——wave 57/58/59/60 那几条正是这么翻出来的。
- **测试标题**：wave 59（`it`/`test`）与 wave 60（`describe`）两轮把机械可核对的那半
  扫完了（符号名、数字、上游断言），**语义那半不可机械化**——「这条标题说的是不是
  这段代码在做的事」要读代码。同上，写下理由，不立门禁。

### 门禁

verify **250 文件 / 2080 单测**（wave 60 是 250 / 2075；+5 = 3 条 L2 反向断言 +
2 条 `【依赖关系】`），词典 945/18，BLOCKING 0/0，DECLARED 37/16。
e2e 五套全绿、数字与 wave 59/60 逐条相同。

---

## wave 60 做了什么（保留全文——两个新门禁的口径都在这里）

**扫三类从来没被任何东西验过的记录：`describe` 标题、`app/**` 的 `【主要导出】`、
`Makefile` 每条 target 的说明。三类各翻出一条，其中两类当场上了门禁。**

### 一：`【主要导出】` 点名了七个不存在的符号（**这一栏此前零消费者**）

全模块 478 份文件写着这一行，而只有 `【架构位置】` 有人读
（`tests/architecture.test.ts:373`，且只读 L2 那一档）。逐条撞了一遍：

| 文件                                                    | 头里点的名                  | 文件真正导出的                              |
| ------------------------------------------------------- | --------------------------- | ------------------------------------------- |
| `app/components/ui/chain-of-thought/context.ts`         | `provideChainOfThought`     | `injectChainOfThought`（+ key + interface） |
| `app/components/ui/effects/confetti.ts`                 | `confettiOrigin`            | `emitConfettiFrom`                          |
| `app/components/ui/effects/flickering-grid.ts`          | `updateFlickeringOpacities` | `prefersReducedMotion`                      |
| `app/components/workspace/browser-view/frame-buffer.ts` | `createFrameBuffer`         | `LatestBrowserFrameBuffer`（class）         |
| `app/composables/useSkillsCatalog.ts`                   | `SKILLS_CATALOG_QUERY_KEY`  | `SKILLS_QUERY_KEY`                          |
| `app/core/auth/session.ts`                              | `probeAuthSession`          | `probeSession`                              |
| `app/core/input/keyboard.ts`                            | `isEditableEventTarget`     | `isEditableKeyboardTarget`                  |

**七个幽灵名在整个 checkout 里各自只有一处——自己那一行。** 真名的引入提交
早于或等于幽灵名的引入提交，所以**七条全都是写下那天就错的**，没有一条是改名漂掉的。
五条出自同一个批量补文件头的提交 `fa2cde27`，其中 `keyboard.ts` 那条**真名就在
错行下面三行、同一个 diff hunk 里**。

**门禁**：`tests/guards/file-header-claims.test.ts`——`app`/`server`/`packages`/`scripts`
下每份 `.ts`/`.mts`/`.mjs` 的 `【主要导出】` 里，凡是长得像标识符的 token 都必须真的被
这个文件导出。实测 331 份文件 / 261 份写了这一行 / 209 份点了名 / 502 个 token /
**0 条豁免**。只钉一个方向（点名的必须存在），反过来不钉——`主要`两个字就是说它是索引。
`tests/` **有意不在范围里**：那边同一行写的是「被测对象是谁」，套上去会产 14 条误报
（那 12 个被测符号逐条撞过，在 `app/` 里全找得到）。

### 二：`reducer.test.ts` 的 describe 标题与同一份文件里的机器断言互相矛盾

`describe("合成载荷（write_read_file.ultra 不产生这些帧）")` 里六条用例测的全是
`updates` 与 `values`——而**同一份文件 90 行之外的帧普查一直在断言
`updates: 50, values: 13`**。写下那天（`d6048f81`）录制里就已经是 50 / 13，
**不是过期、是从头就说反了**。同一段里 `节点写 null（录制里 7 帧都是这样）`
实测是 **38** 帧，当天也是 38。

**这条比错字重**：这份文件存在的理由就是「分开写，读的人才知道哪条结论的证据强度是多少」，
而这个标题把「有 50 帧真实录制佐证」说成了「录制里根本没有」——**恰好朝着它要防的
方向说反**。修法是把分档说明搬进分节注释，并把「录制到底佐证了哪几条」加进普查那一条
（38 个 null 节点写 / 10 帧写 messages 通道 / remove 与 values 重排各 0），
**数字只留在那一处**。

### 三：`make verify` 的步骤表，四处散文互不相同、且都和 recipe 对不上

| 出处                  | 写的                                           | 缺 / 多                               |
| --------------------- | ---------------------------------------------- | ------------------------------------- |
| `Makefile` help       | lint + format-check + typecheck + unit + build | 缺 i18n / OpenAPI / 契约常量 / 独立性 |
| `ARCHITECTURE.md:361` | …、**清单**、i18n、OpenAPI、独立性、build      | **多一个幽灵步骤**，缺契约常量        |
| `README_zh.md:66`     | …、i18n、OpenAPI、独立性、build                | 缺契约常量                            |
| `README.md:78`        | …, i18n, OpenAPI, standalone, build            | 缺契约常量                            |

`清单` 是 `collected-check`，`1209651f`（2026-08-25 **00:11**）已把它从 verify 里删掉，
而这句话是同一天 **12:57** 的 `c6fc60b4` 写下的——**提交说明恰好是
「make every documented command and path real, and gate it」**。
写下那一刻就是错的，同线索 178。

**门禁**：`doc-facts.test.ts` 里新的 `make verify 的步骤表`——一张
「类别名 → 真实 target」的表，断言 ① 表的并集逐个等于 `verify:` 的先决条件、
② 四处散文逐字按表写、③ 散文里不许再出现 `collected-check` / `header-check` / `清单`。

### 扫过没问题的

`describe` 标题 421 条：以 PascalCase 开头的 24 条全是英文散文不是符号引用；
带数字/上游断言的 30 条逐条撞过（`13 个 checkpoint 夹具` 由 `toHaveLength(13)` 自守、
issue #3482 与上游逐字同、`ui/sidebar.tsx` 路径在）。
`.vue` 的 `【主要导出】` **217/217 全对**（184 份有可判 token）。
`Makefile` 的 `.PHONY` 与实际 target **53 : 53 一一对应**，help 里点名的 35 条全部存在。

---

## 更早几轮的记录（49~59 一句话，48 保留全文）

- **wave 59**：`cron.test.ts:265` 的标题 `Asia/Shanghai is UTC-8` 符号写反，
  **断言是对的、括号里就是它自己的反证**，同 describe 另三条同类断言符号全对。
- **wave 58**：`Button` as-child 那条账说「两边都没有任何选择器消费 data-*」，
  **而本仓 14 个测试文件在消费它，最早那条比「两次复验」早十四轮**；
  **决定不变，错的是翻案判据太松**，已收紧成两条 grep 的交集（→ 线索 182）。
- **wave 57**：`scenarios.ts` 同一份文件里两句话互相矛盾（`Notification.permission`
  默认值），**量了四次全是 `denied`，错的是没带日期的那句**（→ 线索 181）。
- **wave 56**：把本文件里每个数字逐条量，两个错的**都是自己造的**（「176 条线索」是
  同一数字写三处、改两处漏一处；「L2 约 60 个文件」是 wave 55 随手估的，实际 104）。
  **修法：一个数字只写一处。** 同轮真跑复核了 React 侧 1023 / 146，全对；
  路径守卫收进兄弟树（172 处此前一条不查）。
- **wave 55**：本文件写着「`BrowserPanel.vue` 文件头已同步改过（四处 → 三处）」，
  而文件头从 wave 39 起就写着**两处**，文档十六轮没跟。同轮给
  `packages/agent-core/tests/contract.test.ts` 补上了一个真存在的单向断言
  （文档多点名一个源码里没有的 kind，收紧前全绿）。
- **wave 54**：三条**不带反引号**的死引用（`lib/source-facts.mjs` 是 `1209651f` 删的
  第三处遗留；另两条从写下那天起就是错的），其中一条**本文件 wave 41 就记过是错的、
  代码里没人改**（→ 线索 180）。门禁补第四档：顶层目录前缀的路径带不带反引号都查。
- **wave 53**：`message-merge.test.ts` 的「上游 1,740 行」在 `44832a5e`（合上游）之后
  变成 2,095，两个文件各挂一份、错了三周；`globals.css` 的 453→454 是本仓自己改的。
  **三处都是写下时准确的——过期不是记错**。门禁是「行数断言 == 实际行数」（→ 线索 179）。
- **wave 52**：`react-parity-scope.json` 的 `$comment` 说「product-surface.test.ts 是它
  唯一的消费者」，而 `scenario-coverage.test.ts` 在那句话落地 **30 分钟后**就开始读它，
  错了九天约五十轮。修法是 `$readers` 数组 + 门禁与实测引用集逐字比对（→ 线索 178）。
  同轮订正了「三次动 `frontend/`」（实际十四轮）。
- **wave 51**：`tests/fixtures/streams/README.md` 说「debug 实测数据留在
  `playwright.m0-real-backend.config.ts` 的注释里」，而那份 config 在 `1209651f`
  ——**正是写下 `doc-references.test.ts` 的那次重命名**——里被拆掉，数字没跟着搬。
  漏掉是因为守卫**两半覆盖面差得远**，路径那半的正则按顶层目录前缀收口，
  模块根上的裸文件名两半都不匹配（→ 线索 177）。修法：数字搬回活着的 config +
  「裸文件名在 checkout 里搜得到」新门禁 + streams README 的「怎么录的」== 录制器
  实际所做 + 把 wave 46 的引用守卫从 `app/**` 推到整个模块（+91 处）。

- **wave 49**：`react-markdown-dom.json` 的 `recordedFrom` 说「录自 streamdown 2.5.0」，
  没有任何东西验过。修法是两条一起：录制器从 `node_modules/<pkg>/package.json` 读真版本，
  守卫钉「标签 == 实际装的版本」（→ 线索 175）。
- **wave 50**：每轮收工手搓的「独立复核台账」脚本走 `d.get("scenarios", d)` 兜底，
  而基线顶层键是 `entries`——**基线行数恒为 0 与内容无关**。改掉硬规则 1 +
  固化 `scripts/parity-ledger-report.mjs`（形状先断言再计算，→ 线索 176）。

## wave 48 做了什么

**扫从来没有被任何东西验过的那一类：`baseline/` 下的纯数据文件——它们说的话没有任何代码验。**
翻出一条，**所以收尾判据重新计数**（47 干净、48 不干净）。

### 翻出来的：`exemptModes` 声明了一条豁免，零消费者

`react-parity-scope.json` 的 `exemptModes` 写着「静态整站模式不欠」，**没有任何东西读它**。
这是**线索 131 的第二次发作**（wave 29 的 `$pendingReasons` 挂了十几轮没人读）。

**它确实是纯说明，不是漏接**：`product-surface.test.ts` 比的是**路由**，
而静态模式不是路由、是 env 开关（`NEXT_PUBLIC_STATIC_WEBSITE_ONLY`，上游 35 处）下的分支，
路由级比对里天生没有它要排除的东西。**问题在归错了类**——本仓约定 `$` 开头 = 纯说明，
它没带 `$`，长得像真数据。已改名 `$exemptModes`。

### 把约定变成门禁，而不是只修这一个键

`tests/guards/baseline-keys-consumed.test.ts`：**`baseline/*.json` 里每个不带 `$` 前缀的
顶层键都必须至少有一个 `.ts`/`.mjs`/`.vue` 读它。**
`$` 开头 = 纯说明；不带 `$` = 真数据，没人读就是「写了没人看」——**改错了不会有任何门禁变红**。
**只钉顶层键**（深层字段的消费方式太多，钉进去是噪声；顶层键是这些文件的目录）。

### 守卫自己第一版假绿了 → 线索 174

第一版对 K1（把 `$exemptModes` 改回 `exemptModes`）**绿**：守卫扫 `tests/**`，
而**它自己的文件头注释里提到了 `exemptModes`**，注释被算成了消费者。
**这是线索 126 反咬守卫本身。** 改成**先剥注释再判**才红。
**写「有没有人用 X」这类守卫时，第一件事是把注释剥掉**——否则守卫的文档会把被测对象救活。

---

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

### ~~`/auth/callback`~~ —— **wave 62 做掉了（改的是 `frontend/`）**

> **判据是「有人真的因深链被吞而报障」——没等到报障就做了，理由写在这里。**
> 2026-09-04 用户明确「React 那一侧有 bug，你也得修」，并要求按产品价值排序
> 而不是按对齐价值。这一条的产品损失是实打实的：从别人分享的
> `/workspace/chats/<id>` 深链发起 OAuth，登录完被扔到 `/workspace`，
> 原本要去的那一屏丢了。**对齐价值仍然是零**（这一屏在 `AUTH_DISABLED` 下
> 两边打开的不是同一个页面，进不了取样面），所以它**不占一轮平替**，
> 是一次纯 React 缺陷修复。
>
> **做法就是 wave 28 记的那条「更小的修法」**：把 `auth/callback` 从
> `(auth)` 路由组里移出来（`src/app/auth/callback/`），自带一个
> `dynamic = "force-dynamic"` 的 layout，不带 AuthProvider 也不带 I18nProvider
> ——那个页面本来就不用它们（一句 `t` 都没有）。`/login` 的服务端跳转不受影响。
> 守卫 `frontend/tests/unit/app/auth-callback-route.test.ts`：**结构上**钉住
> 「`/auth/callback` 上方不许有任何一个 layout 在 `authenticated` 时
> `redirect("/workspace")`」，并钉 `?next=` 的处理还在。
> 变异实测：把页面挪回 `(auth)` 组，守卫当场红。
>
> **剩下的一条没做**：React 的 callback 页三句状态文案是写死英文的
> （`Signing you in...` / `Redirecting...` / `Authentication failed...`），
> 而本仓那三句走词典。这一条**没有跟着修**——它要给新 layout 加回
> I18nProvider，属于另一件事；记在这里当下一个候选。

以下保留 wave 28/33 当时的分析。

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

### ~~首次发送之后那一屏~~ —— **wave 62 全部结清，四条里三条是过期账**

wave 29 记了四条，wave 62 逐条量了一遍（replay Gateway，React/Vue 各取样，
探针跑完即删）：

- **上游那条竞态 —— wave 62 说「已经没有了」，那句说过头了，wave 63 订正。**
  **竞态还在，变的是 A 不再是终态。**
  - wave 62 量的是「等 `Loading…` 消失」：14/14 都清掉了，用户消息每次 1 份。
    wave 29 同样的等法是 5 次里 2 次等满 30s 超时。**这一半确实变了**：
    A 以前是吸收态，现在只是慢。
  - **wave 63 按棘轮自己的取样点（`settleMs=700`）重测 23 个样本**：
    React 仍然是**两个终态，19 B / 4 A（约 17%）**；Vue **23/23 单一终态**。
    **wave 62 之所以没看见，是因为它多等了 30 秒**——而棘轮不会多等，
    `settleMs=700` 是硬规则 2 明写不许动的。
  - 两个终态的**精确差异**已经钉进 `$pendingReasons`（wave 29 只记了现象）：
    B（55 行 / 23 请求）播报区空、三条后续请求已发；
    A（56 行 / 20 请求）播报区仍是 `Loading... - DeerFlow`、那三条没发、
    **乐观的用户消息还没去重**（aria 里是 `Completed in <1s Hello` + 一颗
    `button "Copy to clipboard"`——wave 29 记的「无名按钮」就是这颗复制键，
    wave 62 已两边同改给了名字）。
  - **翻案判据 wave 63 收紧了**：原来「连取 5 次只出现一个终态」太松——
    17% 翻面率下一批干净的 5 次并不罕见，**那等于允许靠重跑收工**（撞硬规则 3）。
    改成 **连取 20 次只出现一个终态**。复现脚本也一并写进 `$pendingReasons`。
- ~~上游画 `Completed in <1s`，本仓不画~~ —— **这条从写下那天就是错的。**
  本仓 `MessageList.vue:1415` 从 `524beace`（**2026-08-13**）起就渲染回合耗时
  （`data-testid="run-duration"` + 时钟图标），比 wave 29 早两周，
  而且有两条测试守着（`thread-history.spec.ts:381` 断言 count 1、
  `message-surfaces.dom.test.ts:126` 断言图标）。
- ~~本仓多一颗 `Edit and rerun`，上游那个位置是无名按钮~~ —— **也过期了。**
  上游 `message-list-item.tsx:246` 写着 `aria-label={t.common.editAndRerun}`。
- 播报区那条**仍然不算差异**（框架自带的路由播报区，线索 135）。

**但同一次普查翻出了三颗真的无名控件，两边都有，wave 62 两边同改**：
两颗复制键（human/assistant turn，上游 `copy-button.tsx` 只有图标 + tooltip，
而 tooltip 在 Radix / Reka 里挂的是 `aria-describedby`，**不是可访问名**）
与侧栏底部的设置触发器（收起态只渲染一个图标，上游
`workspace-nav-menu.tsx` 既不传 tooltip 也没有 `aria-label`）。
**本仓此前是照抄了这处缺陷**，两个文件头都写着「不给可访问名，因为上游没有」。

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
- ~~模型选择器的筛选~~ —— **wave 62 做完了，这一条已结清。** wave 37 补的
  「分隔符不敏感」那一档已删掉——不是放弃而是**被覆盖**。现在走
  `@/core/models/command-score`，**`cmdk@1.1.1` 的 `command-score` 逐行移植**：
  实测 19 名 × 25 查询 × 带/不带 aliases = **950 组逐值差 0**。
  于是本仓与 React **筛出同一批、排出同一序**（上游把 `value={m.name}` 交给
  cmdk，cmdk 的默认 filter 就是这个函数）。
  原来的理由是「要连排序一起来，而引评分库不划算」——**引依赖确实不划算，
  移植算法划算**：`cmdk` 是 React 组件库（本仓用 Reka），`command-score` 也没有
  可直接用的独立发布包。等价性那次比对**没有签入**（它要 require
  `../frontend/node_modules`，撞 `standalone-check`），留存是
  `tests/unit/models/command-score.test.ts` 里 22 组从真实现取回的定值。
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
  **另一条「关闭按钮没有可访问名」wave 28 就两边同改结清了**，于是
  `BrowserPanel.vue` 文件头现在写的是**两处**：`role="alert"` 的内联错误 + 重试，
  以及画面上的 `@mousemove`（上游 forwardMouse 只接 onClick）。
  **这里原来写着「四处 → 三处」，从 wave 39（`b700cf17`）起就过期了**——
  记录与被记录的东西是两份（线索 180）。
- **`Button` 的 as-child —— wave 37 量完决定不做，wave 58 订正了理由。** 上游
  `<Button asChild>` 会把 `data-slot`/`data-variant`/`data-size` 放到 `<a>` 上，
  本仓裸调 `buttonVariants()` 只出 class。**决定不变**（要动 L2 primitive 的 9 个
  消费者，而 `data-*` 不进 aria 快照），**但「两边都没有任何选择器消费它」是错的**：
  `tests/unit/settings/settings-panels.dom.test.ts` 里那条
  `button[data-slot="button"]` 既选 `data-slot` 又断言 `data-variant`，
  而它是 **wave 23（`3d6bb266`）** 落的——**比 wave 37 那次「复验」还早十四轮**
  （线索 152：「已核实」三个字本身要重验）。而且它不是孤例：
  **全仓有 14 个测试文件在按 `data-slot="button"` / `data-variant` 选或断言。**
  **它不影响这个决定**：那条选择器要的是真 `<button>` 上的 `data-*`，本仓的
  `Button.vue` 一直就有；as-child 缺的只是**裸调 `buttonVariants()` 的那两处
  `<NuxtLink>`**（`app/pages/index.vue:51`、`app/components/chat/AgentChat.vue:1659`）
  上的 `data-*`，而没有任何选择器去选它们。
  **翻案判据也跟着收紧**（原来那句松到会被上面那条误触发）：

  ```bash
  # 有没有人按 data-* 去选一个「裸调 buttonVariants 的元素」（当前是那两处 NuxtLink）
  grep -rn 'buttonVariants(' frontend-vue/app | grep -v 'ui/button/'
  grep -rn 'data-slot=.button.\|data-variant' frontend-vue/tests frontend-vue/app | grep -v 'ui/button/'
  ```

  两条的交集非空时才翻案。**wave 58 实测：交集为空。**

- ~~run 成功结束之后退回「重新取的 checkpoint」~~ —— **wave 41 做完了。**
  `useThreadStream` 的 `onSettled` 在 `completed` 上重取一次，走新加的
  `runner.refreshDurableState`（`seedDurableState` 的 `idle` 判据会把这一帧**无声丢掉**
  ——run settle 之后状态停在 `completed`，永远不会自己回到 `idle`）。
  **三条不能省的判据**：① 不能复用 `seedDurableState`；② 也不能把它一起放宽
  （那道 `idle` 守的是「run 之前发出、run 之后落地」的那一帧，放进来会抹掉整个 run）；
  ③ 线程 id 取 `adoptedThreadId` 不取路由（`/chats/new` 提交后路由换得晚，
  run settle 时 `threadId.value` 还可能是 `null`，而首个回合最可能压缩）。
  **只在 `completed` 上做**，取消跟上游一样不刷，台账的请求多重集因此仍然齐平。
  **wave 38 记的 e2e 范本路径是错的**（`tests/e2e-backend/thread-summarized-checkpoint.spec.ts`
  不存在，真身是 `tests/e2e-real/summarized-checkpoint.spec.ts`），而且「需要专门造后端状态」
  只对一半——`e2e-real` 的 replay gateway 驱动不了一次真 run，**mock 后端的
  `tests/e2e/` 才能跑完整条流**，落点在 `chat-dataflow.spec.ts`。

- **上游种子取数失败会弹 toast**（`hooks.ts:1839`），本仓静默降级（S8 明写 403/404 属常态）。
  **这一条 wave 31 有意没动**：它不是「缺一层播报」，是 S8 写死的「403/404 属常态」，
  弹 toast 会在每次打开只读线程时报一次假故障。
  **wave 42 复核过这条引用，它是对的，机制比记的更准**：`hooks.ts:1839` 是**流**的
  `onError`，看起来像引错了——但 SDK 把 history 取数的错误接进了同一个回调
  （`useThreadHistory(client, threadId, historyLimit, { …, onError: options.onError })`），
  所以种子取失败时上游确实走到那里，而且除了 toast 还会**清掉乐观消息**。
  本仓静默那一侧在两半上都更好，**没有「只在一部分上更好」**（线索 163 撞过）。
- ~~`messages.*` 与 `browser.*` 的死条目~~ —— **wave 33 做完了**：连同
  `navigation.*` 那五条一共 **10 条**，全部删掉（953 → 943，再加命令面板两条 → 945）。
  **剩下的是共有块里的死条目**：要判准得先有类型感知的分析（wave 33 实测正则会误报
  122 条），那是一次工具投资而不是一轮平替，**先问它值不值**。
- **inputBox 下的 voiceInputStop 是上游自己也零消费的死条目**，有意留着，**不是缺 UI**。
- ~~chip 编辑区~~ —— **wave 33 做完了**（span + `aria-multiline` + `aria-placeholder`
  - `data-empty`/`data-placeholder` 的空态占位 + `tabindex`）。
    ~~只剩布局那两个类（`min-h-10 flex-1`）~~ —— **这条记错了，wave 45 翻案**：
    那两个类从 **wave 37（`7eea78f0`）** 起就从元素上去掉了（那一轮把 chip 行改成上游的
    行内可滚行），只有 `ChatComposer.vue` 的注释和这条账留在原地，**一挂八轮**。
    现在那个 span 的 class 里没有任何布局类，尺寸由外层容器给，与上游同形。
    **这一条已结清。**

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

### 量「这一轮动没动 `frontend/`」

```bash
git log --format='%h %ci %s' --since=2026-08-25 -- frontend/src frontend/tests
node scripts/upstream-drift.mjs        # marker 之后上游/本仓有没有改动被监视的路径
```

**别传数字，跑命令。** wave 52 就是因为传了一个数字，把十四轮记成了三轮。

## 负向验证的做法

逐条变异 → **回读文件确认变异真的落地** → 只跑相关单测/e2e 文件 → 还原，
结果做成表格贴进提交说明。**假绿要如实写进去，连同成因。**
变异脚本跑完确认 `git status` 干净再提交。
只有对照门禁抓得到的那几条，要**真跑一遍 parity** 证实。
（macOS 的 BSD sed 不支持 `0,/pat/`，**退出码 0 但文件一个字节没改**；用 python harness。）
**锚点要按 prettier 格式化之后的样子写**：wave 28 有一条变异因为把三元写成一行而
锚点 0 次命中，脚本报了「变异没落地」——那一条如果没被脚本自己抓住，就是一条假绿。

## 其他常踩的坑（完整 194 条在记忆文件里）

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
- **几何容差 `GEOMETRY_TOLERANCE_PX = 2` 在 `diff.spec.ts:76`，不要动。**（wave 42 复核：
  文件长了，原来记的 66 行已经漂了——**行号也要当假设撞**，线索 167。）
- **同一时刻只能有一个后台门禁任务**（Nuxt 构建锁，线索 120）。
- **`sampleGeometry` 只量 settle 里的 `visible` 锚点，而 settle 跑在 steps 之前**——
  所以**靠交互才出现的东西，位置永远进不了台账**，只能单测守（线索 137）。
- **注释里带点写一条死词条会把它从 unused 集里弄没**（线索 126）。要写成
  「container 下的 leafName」，改完跑 `make i18n-unused` 核对。
- **一条「有意保留」的账，越老越可能已经被别人修掉了**（线索 187）。
  wave 62 拿 wave 29 记的竞态去复现，同一条账里另外两句确实过期。
  **复现优先于修复**：先花五分钟量一遍，比照着账改代码省一整轮。
  **mock 复现不了的要回到当初观测它的环境**，而且 replay Gateway 上**提示词要用
  录制里的原句**——换一句会 replay miss，量到的不是那一屏。
  **竞态类的账要记「怎么复现」，不要只记「什么现象」。**
- **「按名字聚合」的预算，名字来自哪一个模块决定了它有多不像话**（线索 193，wave 66）。
  `vendor-ui` 的种子里有 `lucide/cva/clsx/tailwind-merge`——几乎每个组件都 import，
  于是任何产品 chunk 只要碰过一个图标就被叫成 vendor-ui，最大的两个（320/192 KB）
  **一个匹配包都不含**。收窄种子只能减少误标（24→10），**「按 chunk 名字做字节归属」
  本身做不到**：Rollup 把 vendor 与产品代码 co-locate，名字只取自其中一个模块。
  **正确做法是把注释里那个做不到的承诺删掉**，而不是继续抬数字或去拆包——
  真正量用户下载什么的是 `route-payload-budget.json`，两条没有对应关系。
- **一条长期红着、又不在任何门禁清单里的 gate，等于不存在**（线索 194，wave 66）。
  `asset-budget` 的预算定于 2026-08-25，之后 UI 一路加，它就一直红着；
  `audit` 同理。**收工清单里没有的门禁，红多久都没人知道。**
- **一个「看起来像架构不支持」的错，先查依赖版本**（线索 192，wave 64 补）。
  `coverageFilesDirectory is required` 出现在每个 worker 上、三个 project 全一样、
  summary 是 `0/14384`——**长得像「这套配置不支持覆盖率」，实际是 provider 装了
  大版本 5 配 vitest 4**。裸 `pnpm add` 默认抓 latest，这类错会被伪装成架构问题。
  **判据：报错来自工具链内部断言（不是你的代码）+ 全环境一致复现 → 先对版本。**
  修法是把成组依赖的 range 钉成逐字相同（不钉版本号，那会让每次升级都要改守卫）。
- **但「复现不出来」要先问「我量的是不是它量的那个点」**（线索 191，wave 63 补）。
  wave 62 据此宣布竞态「已经没有了」——**说过头了**：它等了 30 秒才读，
  而棘轮在 `settleMs=700` 就取样。**换个取样点重测，两个终态原样还在（19 B / 4 A）。**
  一个「等久一点就好了」的现象，对**等不了那么久的那个消费者**来说仍然是缺陷。
  **判据里写死的那个观测点，就是复现时必须照抄的那个点。**
- **顺手加一条普查，往往比正题更值钱**（线索 188）。wave 62 的探针本来只为复现竞态，
  顺手加了「还有哪些交互控件没有可访问名」，一次跑出三颗真缺陷、两个应用都有。
  **`tooltip` 不是可访问名**（Radix / Reka 都挂 `aria-describedby`）。
  **最值钱的一半**：本仓两个文件头写着「不给可访问名，因为上游只有图标和 tooltip」
  ——**对上游的描述完全准确，照抄的却是缺陷**。**「与上游一致」不是正确性论据**，
  还要问「上游那处对吗」。
- **「引一个库不划算」的正确结论常常是「移植那段算法」**（线索 189）。
  `command-score` 只有 60 行；移植进来与 `cmdk@1.1.1` 实测 950 组逐值差 0。
  **等价性比对不能签入**（要 require `../frontend/node_modules`，撞
  `standalone-check`），**留存方式是把真实现算出来的值当定值签进单测**。
- **测排序的用例，输入序必须与期望序不同，否则删掉 `sort()` 照样绿**（线索 190）。
  同轮还撞到一次无效变异（空查询短路——所有分数都是 0.99，删掉它产出不变），
  **而它顺带证伪了我自己刚写下的那句理由**。
  **变异跑出假绿时先别急着补用例：先看被删的那段到底保证了什么，
  它旁边那句注释可能一起错了。**
- **只从白名单出发的门禁，看不见「自称是、但没上名单」的那些**（线索 186）。
  `architecture.test.ts` 的两条 L2 断言都遍历 `l2Files`，于是 30 份自称 L2 的文件
  三周里一直不受进口边界约束，其中一份（`app/core/auth/logout.ts`）一跑就违规。
  **凡是「清单 + 逐条检查」的门禁，都要再问一句：清单本身谁在维护？**
  修法是让清单**可推导**（实测集合 == 清单，双向），再给它一条顺序断言，
  让插入位置唯一——顺序对这份清单没有语义，但没有顺序规则，下一个人只会往末尾追加。
- **「跑出来少了几条」和「红了几条」是两回事**（wave 69）。负向验证时单边替换
  一个开标签，SFC 编译不过，**整个测试文件不加载**——报表上是「8 passed」，
  看起来像绿的，实际是那个文件的 8 条根本没跑。**变异必须保持文件可编译**，
  并且核对总条数有没有变。
- **「上游那边有、本仓没有」不等于本仓缺功能**（wave 69）。`core/api/feedback.ts`
  零消费者，看着像少了点赞点踩；实测**上游那套 UI 也从来不渲染**
  （没有一处传 `feedback={...}`，而渲染条件是 `feedback !== undefined`）。
  **先问「上游那边真的活着吗」，再问「本仓少了吗」。**
- **一把新尺子最先要量的是它自己**（线索 186~188，wave 68 一轮踩了三次；
  wave 69 的 `icon-parity` 又五次）。wave 69 那五次分别是：正则漏掉 `size-3.5`
  的小数点（14px 报成 12px，**三条线索里两条是假的**）、只比同名图标（名字不同
  就完全看不见，而这正是要找的那一类）、拿「写了尺寸的」当「用没用过」、
  按文件问「有没有这颗」（两边组件切分方式不同，全是噪声）、
  把 `DialogPrimitive` 这类非图标也算进来。
  **收口原则：尺寸按文件比，字形按全仓比；名字先解析成规范名再比。**
  几何档加进 `dom-parity` 的当轮：① 不报「连上了几个元素」，于是三个完全不同的
  页面都「连上 7 个」这种事没人看得见；② `waitUntil: "networkidle"` 在开发服务器上
  永不成立，超时后 catch 里**静默返回空数据**，印出来的「差异 0 处」和「量过、
  确实一样」逐字相同；③ 不校验落地 URL，两边都跳登录页时**拍到的是同一张页面**，
  0 差异是白送的。**判据：任何输出 0 的工具，都要能回答「这个 0 是算出来的、
  还是没算」**——这是线索 176 的同一条，只是这次踩它的是我自己刚写的工具。
- **拿「可见文字」当断言，可能是把落差写进合同**（wave 68）。两条老用例钉
  `button.text()` 等于「优化输入」，而上游那颗键三态都只有一颗图标——那段文字
  本身就是差异。图标按钮钉**可访问名 + 图标类名**，不钉可见文字。
  同理，钉「含换行缩进的源码子串」钉的是格式不是语义，包一层组件就会假红。
- **视觉基线的容差地板会静默吃掉真实改动**（wave 68）。`maxDiffPixelRatio: 0.01`
  之下，九张里八张都变了却全绿。**留着不录 = 把容差预算花在一次已经发生的改动上**，
  下一次回归的余量就少了。量法：把容差**临时压到 0** 再 `--update-snapshots`，
  并**跑两遍**分清「稳定 = 我改的」与「每次不同 = 固有抖动」。
  **别用 `-u all`**：它无条件重写，字节差里混着 PNG 编码噪声，不构成「变了」的证据。
- **翻案判据写太松，会被毫不相干的东西误触发，和写错一样坏**（线索 182）。
  好判据要能把「该翻」和「不该翻」分开——as-child 那条收紧成两条 grep 的**交集**才够。
- **一栏「零消费者」的元数据，写错了不会有任何征兆——它长得和写对的一模一样**
  （线索 183）。`【主要导出】` 478 份文件写着它，零代码读它，七处点名的符号
  在 checkout 里只剩自己那一行。**判「有没有人读」用 grep 剥掉自身头注释之后再看**，
  别看「有多少文件写着它」。
- **同一份文件里，散文和机器断言打起来时，信机器**（线索 184）。
  `reducer.test.ts` 的 describe 标题说「录制不产生这些帧」，90 行之外的
  `expect(byName).toEqual({... updates: 50, values: 13 ...})` 一直在说反话。
  **线索 181 的升级版：那次是两句散文，这次一边是断言，冲突的一刻就该结束了。**
- **一段「批量补文件头 / 批量对齐文档」的提交，是这一类错误的产地**（线索 185）。
  `fa2cde27` 一次给几十份文件补头，七个幽灵名里五个出自它；
  `c6fc60b4` 的提交说明写着「make every documented command and path real, and gate it」，
  同一次落下的 `清单` 在 **12 小时 46 分钟前**就已经不存在了。
  **翻这类提交时不要按「后来漂了吗」查，要按「当天就对吗」查。**
- **先在本仓内部找「自相矛盾的两句」，比拿去撞上游更快**（线索 181）。
  冲突时**信带日期的实测标注**，不信不带日期的断言。
  **结论对、理由错比两者都错更危险**：结论让人以为这条验过了。
- **「账记对了」不等于「那处改掉了」**（线索 180）。交接文档在 wave 41 记下
  「那条 e2e 路径是错的」，而代码里那行注释又挂了十三轮——**记录与被记录的东西
  是两份，改一份不会改另一份**。翻旧账时要问的是「那处真的改了吗」，不是「记了吗」。
- **引用上游的一个「值」（行数、class 串、常量）会随上游前进静默过期**（线索 179）。
  `文件:行号` 允许漂几行，**「N 行」不允许**——它是关于整份文件的精确断言。
  **不承重的数字干脆别写。** 另：`git log -- <path>` 默认做历史简化，
  **合并进来的上游改动看不见**，查这类过期要 `--full-history`。
- **散文里「谁在引我 / 谁是唯一消费者」这类话，写下当天就可能过期**（线索 178）。
  `react-parity-scope.json` 那句 30 分钟后就错了。**改成数据 + 门禁比对**，
  而且口径要选**能量准**的那个（「引用」可以，「读取」要靠正则猜行）。
- **一条「证据在那边」的指路比一条说错的事实更难发现**：它不含任何可判真假的断言，
  只含一个文件名（线索 177）。而**守卫的覆盖面要按半边分开问**——
  `doc-references` 的 make target 那半扫全部文本文件，路径那半只扫 Markdown、
  还要求带目录前缀，模块根上的裸文件名两半都漏。

## 背景在哪

- 每一轮的实测记录与踩坑线索：Claude 记忆 `deerflow-parity-harness-plan`
  （**条数只在上面那一节写一处**——同一个数字写三处，就会像 wave 56 撞见的那样，
  改两处漏一处）
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
- **`tests/guards/` 下已有九条「把散文变门禁」的守卫**（doc-facts / doc-references /
  upstream-citations / upstream-zero-claims / golden-fixture-provenance /
  baseline-keys-consumed / invariant-ownership / e2e-suite-contract /
  **file-header-claims**）。`doc-facts` 里现在有两张表：文档数字、`make verify` 步骤表；
  `architecture.test.ts` 的 L2 段 wave 61 补了反向断言。
  **加新守卫前先读它们的覆盖面**——wave 51 那条就躺在现成守卫的正则缝里。
  **上一轮写下的推断，下一轮仍要当假设重新验。**
