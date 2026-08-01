# DeerFlow frontend-vue 交接检查点

> 状态:2026-08-01 生效。
> 本文件只保留 `frontend-vue/` 后续工作的滚动检查点。
> 旧的连续轮次 prompt / 执行流水账已从本文移除;需要历史细节时查 git 历史。

## 1. 冷启动必读

新窗口按以下顺序读取:

1. `AGENTS.md`
2. `frontend/AGENTS.md`
3. `backend/AGENTS.md`
4. `frontend-refactor-docs/README.md`
5. `frontend-refactor-docs/12-vue-execution-workflow.md`
6. 本文件最新检查点
7. `frontend-vue/tests/SPEC-GAPS.md`

执行前必须先跑:

```bash
git status --short
git status --short -- frontend backend docker Makefile pnpm-workspace.yaml .gitignore
```

## 2. 硬边界

- 不要乱动既有 staged 状态;每次改完并验证后先不要自动暂存;只在用户明确授权后,才精确暂存本次实际修改过的允许范围文件。
- 不要修改现有 `frontend/`、`backend/`、`docker/`、根 `Makefile`、根 `pnpm-workspace`、DeerFlow `.gitignore`。
- 只处理 `frontend-vue/`、`docker-vue/`,以及用户明确授权的 `frontend-refactor-docs/`。
- 不要为了过检查使用 `any`、关闭 lint、跳过测试或全局绕过。
- 不要恢复旧“第 N/15 轮”自动连跑;按 `12-vue-execution-workflow.md` 的 Domain Completion Sprint 推进。

## 3. 当前执行口径

默认主线是 **Domain Completion Sprint**:

- 没有真实 Gateway、账号、scheduler、IM provider、Docker daemon 时,不要优先排 M1/M2/M3/M4/M5 live signoff。
- 默认一次只选择一个页面域或产品域,在该域内把当前源码和环境能 source-backed 实现的完整功能连续做完,不要每个小纵切后停顿。
- 开发中只跑局部相关测试;域收口、风险改动或准备交接时再跑完整门禁。
- 一个 sprint 只覆盖一个页面域或一个产品域;遇到 protected path、shared stream/auth/proxy/core contract、跨域修复或验证失败需要改共享层时,立即停止继续叠功能,完成修复、完整门禁和 HANDOFF 后重新开包或等待用户确认。
- 每个 open gap 先分级为 Release must、P2 candidate、Live-only 或 Downgrade candidate;不要让 React 全量细节 parity 拖住 release 主路径。
- `SPEC-GAPS.md` 只作为 release ledger,只记录 Open Gap 被关闭、降级、新增或边界变化。
- 本文件只维护最新状态、验证时间、风险/边界、下一步 1-3 项和下一窗口可复制 prompt。

Live Signoff Lane 只有在环境具备时执行:

| 里程碑 | 需要条件 | 不具备时 |
| --- | --- | --- |
| M1 Live Gateway auth | Gateway、Vue runtime、真实账号或允许创建临时账号 | 记录阻塞,不使用 mock 关闭 |
| M2 Live scheduler | `scheduler.enabled:true`、Gateway、可等待 poller | 记录阻塞,不使用静态契约冒充 live |
| M3 Real Gateway SSE replay | 可创建真实 thread/run,可触发 retained/dropped replay | 记录阻塞,保留 gap |
| M4 Live IM channels | Gateway、真实 provider/bot account、可收发消息 | 记录阻塞,保留 gap |
| M5 Docker runtime | Docker daemon、网络、可 build/up | 记录环境边界 |

## 4. 最新检查点

**验证时间:2026-08-02 01:34:29 CST**

**最新状态**

- 本次执行 **P2 non-live/source-backed convergence**:在不做 `$t()` / language-pack replacement、不替换 Streamdown/runtime/right-panel/chat-shell 架构的前提下,补齐当前源码可控的 broader a11y、窄屏控制堆叠、Message thin-renderer 小行为、Artifact/Chat/Scheduled/Auth/Agents 状态语义 anchors。
- 只改 `frontend-vue/` 与授权文档 `frontend-refactor-docs/HANDOFF.md`、`frontend-vue/tests/SPEC-GAPS.md`;未改 `frontend/`、`backend/`、`docker/`、根 Makefile、根 pnpm-workspace.yaml 或 `.gitignore`;未自动暂存。
- `SPEC-GAPS.md` 已同步:新增 auth/setup/callback status/error semantics、agents/new validation/status semantics、chat skip/active-current/live status、scheduled create/edit error association/filter pressed/selected current、artifact expanded/current/live-region semantics、<=560px source-backed responsive stacking、CommonMark ATX h1-h6 heading closing-sequence anchor。
- Full `$t()` / language-pack replacement 已明确标为用户排除边界,不再作为后续建议任务;typed i18n scaffold 可保留,但页面静态文案不迁移进 `$t()` dictionary。

**完成内容**

- A11y / status semantics:
  - `login.vue`、`setup.vue`、`auth/callback.vue`、`agents/new.vue`、`scheduled-tasks.vue`、chat/artifact 页面补 `role=status/alert`、`aria-describedby`、`aria-invalid`、`aria-pressed`、`aria-current`、`aria-expanded/controls`、skip anchor 和 live-region 状态反馈。
- Mobile/source-backed UX:
  - `main.scss` 增加 <=560px 控制堆叠:workspace/chat/header/sidebar actions、scheduled filters、settings skill/integration actions、new-agent composer、artifact code header、settings editor/code/snapshot 宽度约束;不替换页面架构。
- Message / Artifact:
  - thin renderer 支持 CommonMark ATX h1-h6 heading 与 closing `#` trimming,并保留 `# C#` 这类正文字符。
  - Artifact panel/detail 选中态、展开态、copy/install/loading/error 状态有可测试语义;仍使用当前 Vue page-layout controls。
- 测试同步:
  - 扩展 `auth-pages.nuxt.test.ts`、`agents-new.nuxt.test.ts`、`scheduled-tasks.nuxt.test.ts`、`workspace-chat.nuxt.test.ts`、`rich-content.test.ts`、`message-list.test.ts`,锁住上述用户可见行为/请求契约/高风险回归。

**验证结果**

- 初始禁改目录检查 `git status --short -- frontend backend docker Makefile pnpm-workspace.yaml .gitignore`:为空。
- 局部 P2 convergence 验证通过:
  - `cd frontend-vue && corepack pnpm vitest run tests/unit/pages/auth-pages.nuxt.test.ts tests/unit/pages/agents-new.nuxt.test.ts tests/unit/pages/scheduled-tasks.nuxt.test.ts tests/unit/pages/workspace-chat.nuxt.test.ts tests/unit/core/messages/rich-content.test.ts tests/unit/components/workspace/messages/message-list.test.ts` → 6 files / 120 tests passed。
- 中途完整 `verify` 通过:
  - `cd frontend-vue && corepack pnpm verify` → lint, stylelint, typecheck, and 62 files / 353 tests passed。
- 本 HANDOFF 写入后仍需执行包尾完整非 E2E 门禁并以最终结果为准。

**风险/边界**

- 当前 staged 状态包含大量 `frontend-vue/`、`docker-vue/` 与 `frontend-refactor-docs/` 文件;不要自动 `git add`,只在用户明确授权后精确暂存本次实际修改过的允许范围文件。
- 本次未关闭任何 live gap,也未跑 E2E 或真实浏览器人工视觉审查。
- 本轮证据是 source-backed/unit/page/type/lint/style 证据,不是真实 Gateway runtime、live scheduler、retained/dropped SSE replay、provider account、Docker container runtime、manual screen-reader/WCAG、manual mobile visual、PDF/media visual signoff。
- Vue 仍使用当前 rich-message thin parser;本轮 h1-h6 heading anchor 不代表 full Streamdown runtime/component parity,也不关闭完整 HTML5 entity table、math delimiter edge、broad media/manual visual QA。
- Artifact 仍保留 manual PDF/media visual QA、mobile/resizable drawer visual signoff、broader React right-panel/sheet/resizable visual parity边界;未引入大依赖或替换 shared chat shell。
- Settings 仍保留 live runtime MCP schema discovery、real Lark provider/account signoff;自定义技能创建已按 React parity 走 `/workspace/chats/new?mode=skill` 的 skill-creator 对话入口,Settings 仅保留本地 SKILL.md 草稿/归档安装/编辑既有 custom skill,不把 direct create API/form 作为当前迁移待办;`$t()` / language-pack replacement 是用户明确排除项,不作为待办。
- M1/M2/M3/M4/M5 live signoff 仍分别依赖真实 Gateway/账号、scheduler runtime、retained stream、IM provider/bot、Docker daemon/network。

## 5. 下一步 1-3 项

1. 跑完包尾完整非 E2E 门禁后等待用户审查与暂存授权。
2. 没有 live/browser/manual 条件时,不要继续用 mock/source-backed 证据关闭 live/manual gap。
3. 后续只在用户提供真实 Gateway、账号、scheduler、IM provider、Docker 或明确要求人工浏览器验收时,进入对应 Live Signoff Lane/manual lane。

## 6. 下一窗口可复制 prompt

```text
接手 DeerFlow frontend-vue Vue/Nuxt 重构后续工作。工作目录 /Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow。先运行 git status --short,确认 staged/unstaged;再确认 git status --short -- frontend backend docker Makefile pnpm-workspace.yaml .gitignore 为空。不要乱动既有 staged 状态;每次改完并验证后先不要自动暂存,只在我明确授权后,才精确暂存本次实际修改过的允许范围文件。只改 frontend-vue、docker-vue、以及我明确授权的 frontend-refactor-docs。冷启动先读 AGENTS.md、frontend/AGENTS.md、backend/AGENTS.md、frontend-refactor-docs/README.md、frontend-refactor-docs/12-vue-execution-workflow.md、frontend-refactor-docs/HANDOFF.md、frontend-vue/tests/SPEC-GAPS.md。当前流程为 Domain Completion Sprint,但当前 non-live/source-backed P2 convergence 已完成:auth/setup/callback、agents/new、scheduled tasks、chat/artifact 的状态/错误/选择语义和 <=560px 控制堆叠已有测试 anchors;Message thin renderer 支持 CommonMark ATX h1-h6 heading closing sequence;Artifact panel 有 expanded/current/live-region semantics。用户明确排除 `$t()` / language-pack replacement:不要迁移页面文案到 `$t()`,不要扩大 i18n dictionary 来承接页面静态文案,也不要把它作为后续建议任务。没有真实 Gateway/账号/scheduler/Docker/IM provider 或明确人工浏览器条件时,不要优先排 M1/M2/M3/M4/M5 live signoff,也不要把 mocked/source-backed 证据冒充 live/manual signoff。
```
