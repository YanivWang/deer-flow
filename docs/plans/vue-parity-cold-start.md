# 冷启动 prompt：继续 React → Vue 平替的下一轮

> **用法**：新开一个窗口，把下面「开工指令」整段贴进去（或者直接说
> 「读 `/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/plans/vue-parity-cold-start.md` 并按它执行」）。
> 这份文件只写「怎么接手」，**深度背景不在这里**——在下面点名的三份东西里。

---

## 开工指令（整段贴给新窗口）

你接手一个已经跑了 100 轮的长期任务：把 `frontend-vue/`（Nuxt/Vue）对齐
`frontend/`（Next.js/React），目标是「移走 `frontend/` 之后 Vue 仍能自足」。
仓库在 `/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow`，
分支 `main-wc`，接手时 HEAD 是 wave 88 的 docs 提交。

### 第一步：按这个顺序读，不要跳

1. `docs/plans/vue-parity-open-accounts.md` —— **一页纸的挂账总清单**，
   先看「还欠什么」。三分钟读完。
2. `docs/plans/vue-parity-handoff.md` —— **轮次交接文档**，2500 行。
   必读：开头的「当前状态 / 门禁实测值」、「下一轮」那一节、
   结尾的「其他常踩的坑」（259 条里最近的十几条）。中间各轮的记录按需查。
3. Claude 记忆 `deerflow-parity-harness-plan`
   （`/Users/wangcheng/.claude/projects/-Users-wangcheng-Documents-workSpace-frontEnd-aiAppSpace-deer-flow/memory/`）
   —— 每一轮的实测记录与 **259 条踩坑线索全文**。同目录下另有
   `deerflow-fork-boundary` / `deerflow-vue-replacement-goal` /
   `deerflow-no-midway-questions` / `deerflow-vue-alignment-scope`。
4. `AGENTS.md`（仓库根）与 `frontend-vue/README.md` —— 命令与门禁。

### 硬规则（违反会白干一轮）

- **默认只改 `frontend-vue/`。** 例外只有一种：**上游自己是坏的**——
  那时按「业界主流做法两边同改」，`frontend/` 与 `frontend-vue/` 同一条提交里改，
  再单独一条 chore 提交把 `frontend-vue/baseline/upstream-marker.json` 推到那条 fix
  （`make -C frontend-vue upstream-accept`）。**动过 `frontend/` 的至今是二十二轮**，
  别传这个数字，用 `git log --format='%h %ci %s' --since=2026-08-25 -- frontend/src frontend/tests` 量。
- **不要中途提问。** 取舍自己定，写进提交说明。分歧的兜底判据是**按业界主流做法**。
- **每轮收工写交接文档 + 一页纸清单 + 记忆，然后自动开下一轮**，
  推到我喊停为止；**不要停下来问「要不要继续」**。
- **台账的规则现在是「新出现、还没定过的行只能减不能增」**，不再是「保持 0」。
  `frontend-vue/baseline/parity-diff.json` 当前 **95 行 / 73 样本**。
  其中 51 行**已决定**（2 行 reka tooltip 播报节点 + 42 行「上游写死英文」+ 7 行焦点），
  **wave 97 把 tab 序那 64 行逐条结清了**（修掉 52 行、接受 2 行），
  剩下那 42 行 **wave 98 也核完了**：差异全来自上游给建议行套的那层
  `Suggestions`（`ai-elements/suggestion`），而**它永远不会真的滚动**
  （内容 `flex-wrap`、横向滚动条写着 `hidden`），**决定不跟**。
  **也就是说：95 行现在全部有名有姓、且都已决定。**两类都在一页纸清单第一节
  逐条交代，各带翻案判据。
  **注意它钉的是「两个应用一不一致」，不是「这一处对不对」**——wave 88 量出
  22 颗按钮两边都缺 `aria-pressed`，三档全是 0 行。接上一块新表面之后，
  要另问一句「这一块本身对不对」，并把答案钉进**各自**的用例里。
  `make -C frontend-vue parity-accept` 现在会逐行比对、有新增行就拒写；
  确实要接受得 `PARITY_ACCEPT_GROW=1`，并在提交说明里逐行交代。
- **先量再改。** 这个项目已经十几次证明「形状看着像上次那处」会改出新差异来。
  改之前先让尺子报出读数，改之后复量，两组数都写进提交说明。
- **负向验证**：每条改动逐条变异（`cp` 备份 → 改 → 只跑相关用例 → `cp` 回来 → `diff` 确认），
  结果做成表格贴进提交说明。**假绿要如实写进去。**
- **长内容给文件不要贴进对话**（这是我的全局约定）；回答里给绝对路径。

### 工作循环（一轮 = 一个 wave）

1. 从「还没接的交互态」或三个方向里挑一件（见下）。
2. **先量**：给对照取样面加锚点 / 跑现成的尺子 / 写探针，拿到读数。
3. 归因到**根因**，不要逐行修表象（历轮经验：N 行差异通常归到 2~5 处根因）。
4. 改，复量，把台账清回 0。
5. 跑收工门禁（下面那张表**逐条真跑**，不要抄上一轮的读数）。
6. 提交（fix / chore / docs 分开），更新交接文档 + 一页纸清单 + 记忆。
7. **直接开下一轮。**

### 收工门禁（逐条真跑，命令与上一轮实测读数）

```bash
make -C <abs>/frontend-vue verify          # exit 0；263 文件 / 2183 单测；词典 942 key / 18 unused
make -C <abs>/frontend-vue standalone-sim  # exit 0；跑过 13 / 未跑 5 / 红 0
make -C <abs>/frontend-vue e2e-parity      # 81 passed；台账 95 行 / 73 样本
make -C <abs>/frontend-vue e2e-mock        # 265 + 22 + 15 + 2 + 6
make -C <abs>/frontend-vue e2e-visual      # 8 passed（只有 -darwin 基线，本机门禁）
make -C <abs>/frontend-vue asset-budget    # exit 0
make -C <abs>/frontend-vue e2e-backend     # 2+5+2+3+3+5+1+1（需要 backend 的 uv 环境）
make -C <abs>/frontend-vue icon-parity     # 0 处待核，不报 stale
make -C <abs>/frontend-vue audit           # **预期红 14**，分诊写在 Makefile 的 audit 上方
```

**`icon-parity` 一定要用 `make -C` 跑，并且读输出**：直接
`node frontend-vue/scripts/icon-parity.mjs` 在仓库根下按 cwd 找不到 `../frontend/src`，
会打一句「跳过」然后 **exit 0**——那一行「0 处待核」看起来照样成立（线索 239）。

动过 `frontend/` 的话再加 React 三条：
`python3 scripts/pnpm.py --dir frontend check`（0）/ `test`（**1034**）/
`test:e2e`（**146**，要用 3002 端口的绕法，写在交接文档「React 的 test:e2e 绕法」那一段）。

产品 SFC **218 / 总 220**；新增 SFC 要同步改三处数字（`tests/unit/i18n/source-guard.test.ts`
的 `toHaveLength`、`I18N_INVENTORY.md` 的两句、`tests/architecture.test.ts` 的 `l2Files` 按字母序）。

### 跑门禁的操作纪律（都踩过）

- 长门禁**丢后台**，`> file 2>&1`，**不要接 `| tail`**（管道会缓冲到命令结束）。
- **写文件的命令不要和长任务一起丢后台**（线索 259）：那次改文件的断言失败了，
  traceback 被后台吞掉，下游拿 `undefined` 比 `undefined`，报出一个看起来很干净的
  「0 行」。写完立刻回读确认，或者拆成两条命令。
- **等后台门禁收工要锚在行首**：`until grep -qE '^ *[0-9]+ (passed|failed)'`。
  裸 `grep -q "passed"` 会被 Gateway 横幅里的 `authentication is bypassed` 骗到，
  在一条测试都没跑的时候就退出（线索 240）。更稳的是命令末尾追一行
  `echo "EXIT=$?" >> <log>`，然后等 `^EXIT=`。
- **`run_in_background` 就不要再加 `nohup … &`**——被追踪的是外层 shell，
  会立刻假报 "completed (exit 0)"，而真活还在跑（线索 227）。
- **量退出码不要接管道**：zsh 没有 `${PIPESTATUS[0]}`，`cmd | head` 之后的 `$?` 是 head 的（线索 228）。
- **重定向之前先 `mkdir -p` 目标目录**，否则整条命令根本没跑而退出码是 1（本轮踩了两次）。
- **同一时刻只能有一个后台门禁任务**（Nuxt 构建锁）。
- 写文件一律用绝对路径并回读确认；`cd X && …` 在 cd 失败时整条链不跑而退出码是绿的（线索 208）。
- 「测试红了」第一步永远是分「用例过期」还是「产品回归」，两者修法相反。
- 遇到疑似抖动：**先证因果**——干净树连跑 N 次、`git stash` 之后再跑、
  只还原可疑的那一个文件再跑。本轮就是这么把一条「看着像抖动」的查成了真因果。

---

## 下一轮可以挑的活（按性价比排）

### A. ~~给取样面接互斥的交互态~~ —— **wave 93 起这张表是空的**

wave 86/87/88/90/91/93 逐个做完：`integrations` 的权限面板与换应用表单、
`channels` 的两条连接对话框分支、`branch-thread` 的悬停动作条、
`thread-history-mermaid` 的下载菜单。最后一条「`chat` 的 composer 菜单」
wave 93 查明**是过期的**——四个能展开的控件都已经在取样面里，只是挂在别的场景上：

```
斜杠建议    → sidebar 的 fill 步骤（那个场景明写着不能有 click）
模型选择器  → agent-chat
模式菜单    → user-message-plain-text（桌面）+ ui-polish-mobile（移动端）
推理强度    → workspace-changes#reasoning-menu
```

`addAttachments` 是操作系统文件对话框，取样够不着。
**别再从这条方向找活了**；下面 B / C 两条还在。

### B. 给现成的尺子加一档

`icon-parity`（wave 75）、几何锚点（wave 76）、`states` 轴（wave 87）、
`opacity` 与 `hover`（wave 91）、`focus`（wave 94）都是这么来的。
**一把新尺子最先要量的是它自己**：任何输出 0 的工具，都要能回答「这个 0 是算出来的、
还是没算」；而任何输出**很多行**的新档，先问「其中几行是它自己造的」——
wave 94 的焦点档第一版 17 行里有 **10 行是描述器的噪声**。

**「天生看不见的八类」现在少了两类半**：第⑧类（焦点）wave 94 补完，
第④类的**顺序**那一半 wave 95 补完（层级那一半仍看不见）。
**tab 序 wave 96 也补完了；第④类的「层级」那一半 wave 99 量完判定不必做**
（序列化的树里「换爹」必然「换位置」，`order` 那一档先撞上——实测过）。
**wave 100 又补上「命中测试」**（锚点中心的 `elementFromPoint`），
它同时覆盖了 `pointer-events` 与「被别的东西盖住」这两件事。
**方向 B 的存量到此基本见底**；名义上只剩滚动位置，而那是**故意不比**的
（见 capture.ts 文件头）。
**加之前先按坑 258 问一句：有没有一种变异能让它响、而现有的档都不响？**
举不出来就别加（层级那一档就是这么被撤掉的）。
再问「它是不是真的几档都看不见」，加完先问两句：
**「其中几行是它自己造的」**（wave 94：17 行里 10 行是描述器噪声）与
**「其中几行是别的档已经报过的」**（wave 96：114 行里约 48 行是重复，线索 255）。

### C. 把散文里的断言变成守卫

> **wave 95 量过一条，结果是「货很少」**：「各文件头『实测过、做不到』的结论」
> 全仓只有 10 处，**多数是过去式的历史说明**（「本仓*此前*……做不到」讲的是修好
> 之前的状态），真正的活断言两三条而且成立。**别再照旧文档追这一条。**

wave 83/84/85 连着三轮证明这条最值钱，**wave 89 又证一次**（把 wave 88 的线索 238
做成守卫，当场扫出两边各 12 颗）。判据**三**条：**「哪一行代码读它」**、
**「这把尺子能不能自证盖全」**，以及**「这条规则要不要豁免表」**——
要豁免表，多半是判据没选对（线索 180）。
还要记住**一条守卫守不住两件事**：静态守卫只看得见「属性在不在」，
「值跟着状态走」得另配一条真渲染的用例（wave 89 的 N5 实测）。
- 已经量过、**不必再查**的：`tests/guards/` 下各豁免表都已双向守着；
  9 份扫 `.vue` 的正则剥法今天一处都没错（219 份逐个比对过）。
- 同形的下一个目标：各文件头「实测过、做不到」的结论（**已经翻案十一次**）。

### D. 挂着的账（第 2、3 条 wave 101/102 已经处理掉，只剩第 1 条）

1. **artifact 头部长文件名的 18px 零头**：上游 `scrollWidth 481 / clientWidth 458`、
   本仓 `497 / 492`，溢出的是标题那一侧、不含任何动作键。**追之前先决定「这算不算差异」。**
2. ~~**覆盖率棘轮的 pending 1 条**~~ —— **wave 101 按判据量到底了，结论是「不翻案」**：
   连取 20 次，React 仍是两个终态（**15 B / 5 A**），Vue 20/20 单一，
   **判据「只出现一个终态」未满足，`pending` 保留**。**不许改判据凑绿**（硬规则 3）。
   **wave 102 又第一次逐行量出两个终态差哪几行**：只在 A 的是
   `text: Completed in <1s Hello`、`button "Copy to clipboard"`、`alert: Loading... - DeerFlow`，
   只在 B 的是 `text: Completed in <1s`、`alert`——**两件产品层面的事加一件框架层面的事**；
   **请求集合两边完全相同**（此前记的「A 缺三条请求」是假的）。
   读数与复现方法逐字写在 `baseline/parity-scenario-coverage.json` 的 `$pendingReasons`。
   **不必再复量判据本身**；真要往下追，盯的是「乐观消息去没去重」那一行。
3. ~~**上游那个不会自愈的加载态**~~ —— **wave 102 定性完毕：不是产品缺陷，账作废**。
   wave 101 把它归到 `LoadMoreHistoryIndicator`，**错的**：命中元素在 shadow root 里
   （`host=next-route-announcer`、无 `button` 祖先、`querySelectorAll` 找不到它——
   Playwright 文本引擎穿开放 shadow root，`querySelectorAll` 不穿），是 **Next 自带的
   路由播报器**，1×1 裁剪、内容是上一拍的 `document.title`。**屏幕上没有东西在转。**
   mock 与请求都不是嫌疑人（`messages/page` 永远 fulfill 200；三条请求在 A 里同样发了、
   +588ms 前全部 200 回来）。真正剩下的不确定性回到第 2 条：**乐观消息在 700ms 这一刻
   去没去重**。要追就盯 `text: Completed in <1s Hello` 这一行。

---

## 别忘了的两件事

- **台账当前是 95 行 / 73 个取样点**（此处原写「0 行 / 40 个取样点」，wave 101 订正——
  那是 wave 87 的数字）。**「量不出差异」的准确含义是「这些取样点上量不出」**，
  不是「两个应用一样」；而 95 行**全部已决定**，规则是「新出现、还没定过的行只能减不能增」。
  天生看不见的八类列在交接文档里（第⑧类、第④类的顺序那一半、tab 序都已补上）。
- **这条尾巴没有自然终点。** 历史命中率：wave 75 捞出 6 处、wave 76 捞出 27 处、
  wave 82 捞出一个两个应用都存在的产品缺陷、wave 83 证伪了验收判据自己、
  wave 86 捞出 16 行、wave 87 捞出 7 行。**什么时候收是停止规则问题，不是能算出来的轮数。**
