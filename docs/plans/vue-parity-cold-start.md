# 冷启动 prompt：继续 React → Vue 平替的下一轮

> **用法**：新开一个窗口，把下面「开工指令」整段贴进去（或者直接说
> 「读 `/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/plans/vue-parity-cold-start.md` 并按它执行」）。
> 这份文件只写「怎么接手」，**深度背景不在这里**——在下面点名的三份东西里。

---

## 开工指令（整段贴给新窗口）

你接手一个已经跑了 87 轮的长期任务：把 `frontend-vue/`（Nuxt/Vue）对齐
`frontend/`（Next.js/React），目标是「移走 `frontend/` 之后 Vue 仍能自足」。
仓库在 `/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow`，
分支 `main-wc`，接手时 HEAD 是 `4cc06d5a`。

### 第一步：按这个顺序读，不要跳

1. `docs/plans/vue-parity-open-accounts.md` —— **一页纸的挂账总清单**，
   先看「还欠什么」。三分钟读完。
2. `docs/plans/vue-parity-handoff.md` —— **轮次交接文档**，2400 行。
   必读：开头的「当前状态 / 门禁实测值」、「下一轮」那一节、
   结尾的「其他常踩的坑」（237 条里最近的十几条）。中间各轮的记录按需查。
3. Claude 记忆 `deerflow-parity-harness-plan`
   （`/Users/wangcheng/.claude/projects/-Users-wangcheng-Documents-workSpace-frontEnd-aiAppSpace-deer-flow/memory/`）
   —— 每一轮的实测记录与 **237 条踩坑线索全文**。同目录下另有
   `deerflow-fork-boundary` / `deerflow-vue-replacement-goal` /
   `deerflow-no-midway-questions` / `deerflow-vue-alignment-scope`。
4. `AGENTS.md`（仓库根）与 `frontend-vue/README.md` —— 命令与门禁。

### 硬规则（违反会白干一轮）

- **默认只改 `frontend-vue/`。** 例外只有一种：**上游自己是坏的**——
  那时按「业界主流做法两边同改」，`frontend/` 与 `frontend-vue/` 同一条提交里改，
  再单独一条 chore 提交把 `frontend-vue/baseline/upstream-marker.json` 推到那条 fix
  （`make -C frontend-vue upstream-accept`）。**动过 `frontend/` 的至今是十九轮**，
  别传这个数字，用 `git log --format='%h %ci %s' --since=2026-08-25 -- frontend/src frontend/tests` 量。
- **不要中途提问。** 取舍自己定，写进提交说明。分歧的兜底判据是**按业界主流做法**。
- **每轮收工写交接文档 + 一页纸清单 + 记忆，然后自动开下一轮**，
  推到我喊停为止；**不要停下来问「要不要继续」**。
- **对照台账只能缩短。** `frontend-vue/baseline/parity-diff.json` 当前 **0 行 / 40 样本**。
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
make -C <abs>/frontend-vue verify          # exit 0；260 文件 / 2168 单测；词典 942 key / 18 unused
make -C <abs>/frontend-vue standalone-sim  # exit 0；跑过 12 / 未跑 5 / 红 0
make -C <abs>/frontend-vue e2e-parity      # 48 passed；台账 0 行 / 40 样本
make -C <abs>/frontend-vue e2e-mock        # 265 + 22 + 15 + 2 + 6
make -C <abs>/frontend-vue e2e-visual      # 8 passed（只有 -darwin 基线，本机门禁）
make -C <abs>/frontend-vue asset-budget    # exit 0
make -C <abs>/frontend-vue e2e-backend     # 2+5+2+3+3+5+1+1（需要 backend 的 uv 环境）
node frontend-vue/scripts/icon-parity.mjs  # 0 处待核，不报 stale
make -C <abs>/frontend-vue audit           # **预期红 14**，分诊写在 Makefile 的 audit 上方
```

动过 `frontend/` 的话再加 React 三条：
`python3 scripts/pnpm.py --dir frontend check`（0）/ `test`（**1034**）/
`test:e2e`（**146**，要用 3002 端口的绕法，写在交接文档「React 的 test:e2e 绕法」那一段）。

产品 SFC **218 / 总 220**；新增 SFC 要同步改三处数字（`tests/unit/i18n/source-guard.test.ts`
的 `toHaveLength`、`I18N_INVENTORY.md` 的两句、`tests/architecture.test.ts` 的 `l2Files` 按字母序）。

### 跑门禁的操作纪律（都踩过）

- 长门禁**丢后台**，`> file 2>&1`，**不要接 `| tail`**（管道会缓冲到命令结束）。
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

### A. 给取样面接互斥的交互态（命中率最高）

wave 86 接三处量出 16 行、wave 87 接一处量出 7 行。**wave 87 起对照场景支持
`states` 轴**（`ParityScenario.states?: { id, steps }[]`，与 `steps` 二选一），
互斥的模态终态不必再二选一；台账键是 `场景#终态/断点/主题/语言`。

还没接的五处，各自的已知难点：

| 目标                             | 已知难点                                                                                     |
| -------------------------------- | -------------------------------------------------------------------------------------------- |
| `integrations` 的权限面板        | **最干净**，建议从这里开始。夹具已经点亮了 22 个域按钮与自定义 scope，只差交互态             |
| `channels` 的连接对话框          | 两边**没有共用的 testid**（本仓有 `channel-provider-*`，上游没有），按钮文字又都是 "Connect"；先想清楚触发器怎么定位 |
| `branch-thread`                  | 分支入口在消息动作条上，那一排是 tooltip 触发（**没有 hover 步骤类型**，可能要先加一档）      |
| `thread-history-mermaid` 的下载菜单 | 上游那一侧是 **streamdown 的发布产物**，不是上游源码；锚点名字要去 node_modules 里核         |
| `chat` 那一屏的 composer 菜单    | 注意 `sidebar` 场景明写着**不能有 click 步骤**（活动项跟着指针走），别照抄                    |

**加锚点的两条判据**（本轮踩出来的）：
- 一个锚点加进来之前，先问**它在这个场景的每一个维度上都成立吗**（语言维度最容易漏，
  按可访问名找的锚点天生只在一种语言下成立；两边有共用 testid 就优先用 testid）。
- **别照着词典 key 猜锚点**——先量一遍它到底有没有被渲染成可见文字。

### B. 给现成的尺子加一档

`icon-parity`（wave 75）、几何锚点（wave 76）、`states` 轴（wave 87）都是这么来的。
**一把新尺子最先要量的是它自己**：任何输出 0 的工具，都要能回答「这个 0 是算出来的、
还是没算」。

### C. 把散文里的断言变成守卫

wave 83/84/85 连着三轮证明这条最值钱。判据两条：**「哪一行代码读它」**，
以及**「这把尺子能不能自证盖全」**。
- 已经量过、**不必再查**的：`tests/guards/` 下各豁免表都已双向守着；
  9 份扫 `.vue` 的正则剥法今天一处都没错（219 份逐个比对过）。
- 同形的下一个目标：各文件头「实测过、做不到」的结论（**已经翻案十一次**）。

### D. 两条挂着的账（都不急）

1. **artifact 头部长文件名的 18px 零头**：上游 `scrollWidth 481 / clientWidth 458`、
   本仓 `497 / 492`，溢出的是标题那一侧、不含任何动作键。**追之前先决定「这算不算差异」。**
2. **覆盖率棘轮的 pending 1 条**（`chat-thread-init-ordering`）：React 自己在那一屏上
   两个终态（23 个样本里 19 B / 4 A），翻案判据已收紧到连取 20 次，复现脚本写在
   `baseline/parity-scenario-coverage.json` 的 `$pendingReasons` 里。**不是「还没做」。**

---

## 别忘了的两件事

- **台账 0 行的准确含义是「当前 40 个取样点上量不出差异」**，不是「两个应用一样」。
  天生看不见的八类列在交接文档里。
- **这条尾巴没有自然终点。** 历史命中率：wave 75 捞出 6 处、wave 76 捞出 27 处、
  wave 82 捞出一个两个应用都存在的产品缺陷、wave 83 证伪了验收判据自己、
  wave 86 捞出 16 行、wave 87 捞出 7 行。**什么时候收是停止规则问题，不是能算出来的轮数。**
