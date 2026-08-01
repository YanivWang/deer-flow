# 12 · Vue/Nuxt 重构执行工作流

> 状态:2026-08-01 生效;同日升级为 **Domain Completion Sprint**。
> 本文是 `frontend-vue/` 后续执行的工作流规范,用于替代旧的连续轮次、单纵切停顿和过度交接。
> 目标是让实现时间占绝对多数:一个页面域或产品域一次收口,包尾统一验证与交接。
> 当前阶段默认不跑 E2E;优先实现业务功能,用相关 unit/contract/guard/typecheck 保障质量。

## 1. 核心改动

旧流程的问题不是写代码能力,而是流程把实现切得太碎:

| 问题 | 影响 | 新规则 |
| --- | --- | --- |
| 轮次驱动 | 每轮都读、测、写交接,产品增量偏小 | 改为按域收口,一个域做完才停 |
| 单纵切后暂停 | 每完成 1-2 个小功能就等待确认,上下文切换过高 | 默认不中途停,直到当前域 source-backed 功能完成 |
| 过早全量验证 | `test` / `verify` / strict install 反复吞掉实现时间 | 开发中只跑局部测试,域收口后统一门禁 |
| 文档过度维护 | HANDOFF/SPEC-GAPS 变成流水账 | 只在域收口、gap 分级变化或真实阻塞时更新 |
| live gap 反复阻塞 | 没有 Gateway/账号/Docker 时重复记录同一问题 | live signoff 独立成环境车道 |
| proof-only tests 过多 | 测试数量增长但行为增量有限 | 新测试必须保护用户行为、请求契约或高风险回归 |
| scope 不分级 | React 全量 parity 拖慢 release 主路径 | 每个 gap 明确 Release must / P2 / Live-only / Downgrade |

## 2. 默认执行模型

默认使用 **Domain Completion Sprint**:

1. 一次只选择一个页面域或产品域,例如 `Settings`、`Message/Artifact`、`Scheduled Tasks`、`Chat vertical smoke`。
2. 在这个域内,当前源码和环境能 source-backed 实现的功能一次做完,不按小纵切停顿。
3. live-only 项不算域内未完成;没有真实 Gateway、账号、scheduler、Docker 或 IM provider 时,只记录为环境车道。
4. 包尾统一跑门禁、更新 HANDOFF/SPEC-GAPS、汇报实际修改文件和建议暂存命令。
5. 没有用户明确授权时,永远不自动 `git add`。

“完整域”的定义:

- 包含:页面 UI、状态管理、API client/composable、请求体/错误态、用户可见反馈、相关测试。
- 包含:当前域内能从真实源码契约或 Gateway-shaped mock 证明的 release/P2 行为。
- 不包含:必须依赖真实账号、真实 Gateway runtime、真实 Docker daemon、真实 IM bot、真实 retained stream 的 live signoff。
- 不包含:跨域扫全量 parity,例如 Settings 包中顺手改 Message renderer。

## 3. 开包前最小流程

每个域开始前只做一次:

```bash
git status --short
git status --short -- frontend backend docker Makefile pnpm-workspace.yaml .gitignore
```

然后读取:

1. `frontend-refactor-docs/HANDOFF.md` 最新检查点。
2. `frontend-vue/tests/SPEC-GAPS.md` 的 Open Gaps Scope。
3. 当前域相关源码和测试。

冷启动新窗口仍需读 `AGENTS.md`、`frontend/AGENTS.md`、`backend/AGENTS.md`、`frontend-refactor-docs/README.md` 和本文。若同一窗口刚读过且文件未变,不要反复重读整套文档;用当前源码和 `git diff` 校准即可。

开包只输出一次:

```text
目标:
域边界:
验收标准:
1.
2.
3.
4.
5.
不关闭的 live/P2 gap:
开发验证:
包尾验证:
```

验收标准必须是用户可观察行为或真实契约/API 请求形状,不要写“新增测试覆盖”这类内部指标当主验收。

## 4. 域内执行规则

域内执行采用“实现优先、局部快验、包尾收口”:

1. 先盘点当前域缺口,只看本域源码、测试和 SPEC-GAPS 行。
2. 连续实现本域功能,不要每个小功能后停下来问确认。
3. 相关测试失败时立即修,但不进入全量门禁。
4. 只有在域内所有 source-backed 功能完成后,才更新 HANDOFF/SPEC-GAPS。
5. 包尾统一跑完整非 E2E 门禁。

允许中途停止的情况只有这些:

- 保护路径出现变动: `frontend/`、`backend/`、`docker/`、根 `Makefile`、根 `pnpm-workspace.yaml`、DeerFlow `.gitignore`。
- 需要改变 shared stream/auth/proxy/core contract,且影响跨域边界。
- 需要后端新增接口或 live 环境才能继续,当前前端无法 source-backed 完成。
- 局部验证失败且修复会扩大到当前域之外。
- 用户明确要求暂停、改方向或审查。

不要因为“完成了一个小纵切”而停。

## 5. Gap 分级

`frontend-vue/tests/SPEC-GAPS.md` 是 release ledger,不是流水账。开始域包前确认 Open Gaps Scope;新增、关闭、降级或重新定级 gap 时才修改。

| 等级 | 含义 | 处理 |
| --- | --- | --- |
| Release must | 没有它不能替换 React 前端或不能验收主路径 | 当前域或下一域优先收口 |
| P2 candidate | 不阻塞主路径,但影响完整 React parity | 当前域若顺手成块可做,否则记录边界 |
| Live-only | 需要真实 Gateway、账号、scheduler、Docker、IM provider 或 retained stream | 等环境齐备后进入 Live Signoff Lane |
| Downgrade candidate | 价值低或成本高,可能不做完整 parity | 需要用户确认后从 release scope 移出 |

默认 Release must:

- 基础 chat 主路径:新建 thread、发送、停止、历史、错误态、artifact 展示。
- Settings 中会影响真实使用的 skill/tool/memory/account 基本操作。
- Nitro/auth/proxy/CSRF/SSE contract 不回归。
- 最小可部署 runtime:Docker/Nitro 配置可解释,live runtime 待环境签字。

默认 P2 candidate:

- Full Streamdown/math/HTML plugin parity。
- PDF/media visual QA 和完整 React artifact drawer parity。
- 完整 Lark OAuth/config wizard、notification/channels、dialog deep-link parity,除非当前目标域就是 Settings 收口。
- 全量 i18n/a11y/mobile polish,除非目标 release 明确要求。

## 6. 车道模型

### 6.1 Domain Completion Sprint(默认车道)

没有 live 环境时默认走这条。每次选一个域并尽量收口:

1. **Settings 域**
   - account / appearance / about
   - memory / skills / tools-MCP
   - integrations-Lark / notification / channels
   - query/hash deep-link 和 dialog/state 闭环
2. **Message + Artifact 域**
   - message rich rendering
   - tool/browser rich cards
   - artifact preview/download/code loading
   - Markdown/math/media 渲染深度
3. **Chat vertical smoke 域**
   - 新建 thread
   - 发送/停止/错误态
   - Gateway-shaped SSE
   - message/artifact/settings context 页面闭环
4. **Scheduled Tasks 域**
   - cron/once create/edit/filter
   - timezone-aware affordances
   - run history / conflict / disabled states
   - i18n labels

### 6.2 Live Signoff Lane(环境车道)

只有条件满足时才执行,否则记录一次阻塞后退出,不要反复尝试。

| 里程碑 | 进入条件 | 退出证据 |
| --- | --- | --- |
| M1 Live Gateway auth | Gateway running、Vue running、真实账号或允许创建临时账号 | login/logout/password-change/client session 浏览器或 API 证据 |
| M2 Live scheduler | `scheduler.enabled:true`、Gateway running、可用账号、可等待 poller | create/run-once/cron/disable/delete/timing/lease/overlap/run completion 证据 |
| M3 Real Gateway SSE replay | 可创建真实 thread/run,可触发 retained/dropped replay | `Last-Event-ID`、gap、durable state reload、join tail 证据 |
| M4 Live IM channels | Gateway running、真实 provider/bot account、可收发消息 | auth/config/deep-link、runtime restart、inbound delivery 证据 |
| M5 Docker runtime | Docker daemon/network 可用,可 build/up | container health、logs、Vue runtime browser smoke |

### 6.3 Quality Lane(收口车道)

只在以下场景进入:

- 当前域 source-backed 功能完成。
- 修改了 shared stream/auth/proxy/core contracts。
- 准备交给人工验收、暂存或提交 PR。

## 7. 验证策略

### 7.1 开发中

只跑与当前域直接相关的测试:

| 改动类型 | 开发中验证 |
| --- | --- |
| 页面/组件 | 对应 `tests/unit/pages/*` 或 component test |
| API client | 对应 `tests/unit/core/api/*` |
| composable/store | 对应 `tests/unit/composables/*` 或 store test |
| stream/auth/proxy/scheduler 契约 | 相关 contract + unit |
| SPEC-GAPS | `cd frontend-vue && corepack pnpm vitest run tests/contract/spec-gaps.test.ts` |
| 纯流程文档 | `git diff --check` |

### 7.2 域收口

默认完成验证不含 E2E:

```bash
cd frontend-vue && corepack pnpm test
cd frontend-vue && corepack pnpm verify
cd frontend-vue && corepack pnpm install --strict-peer-dependencies
git diff --check -- frontend-vue docker-vue frontend-refactor-docs/HANDOFF.md frontend-refactor-docs/README.md frontend-refactor-docs/12-vue-execution-workflow.md frontend-vue/tests/SPEC-GAPS.md
```

允许降级:

- 纯文档流程更新:只跑 `git diff --check`。
- 只改 `SPEC-GAPS.md`:跑 `cd frontend-vue && corepack pnpm vitest run tests/contract/spec-gaps.test.ts` + `git diff --check`。
- 小型 UI 文案/样式但未动逻辑:跑相关 page/component test + `git diff --check`;完整门禁并入当前域收口。

### 7.3 E2E 与 live

当前阶段默认不跑 E2E。E2E 只在这些情况触发:

- 用户明确要求本域做浏览器验收。
- 最终验收或 release signoff。
- live auth/chat/navigation/runtime UI signoff 需要浏览器证据。

普通沙箱出现 `listen EPERM` 时,记录为环境边界;只有确实需要 E2E 时才走手动 Nuxt server + `PLAYWRIGHT_SKIP_WEB_SERVER=1`。

## 8. 文档与交接

### 8.1 HANDOFF 滚动块

每个域收口后只维护一个短块:

```text
最新状态(验证时间):
本域完成:
验证结果:
仍未关闭:
下一域建议:
下一窗口可复制 prompt:
```

规则:

- 不追加历史流水账。
- 不复制旧“第 N/15 轮”prompt。
- 不写“写本段后需重跑”作为最终状态;写完后要重跑对应轻量检查并更新成最终结果。
- 不把 mocked/source-backed 证据写成 live signoff。
- 不在每个小功能后更新 HANDOFF;域完成或真实阻塞时才更新。

### 8.2 SPEC-GAPS 使用边界

只在以下情况修改:

- Open Gap 被关闭、降级或新增。
- Closed/Anchored 覆盖范围发生实质变化。
- live/manual/container 边界需要重新表述。

不要因为新增一个小测试就写一行 gap;只有 release ledger 的状态变化才写。

### 8.3 对用户的中间更新

中间更新保持短:

- 正在实现哪个域。
- 当前完成到哪组功能。
- 是否遇到 stop condition。

不要把中间更新写成计划文档;实现时间优先。

## 9. 决策树

开始一个新域时按这个顺序:

1. `git status --short`,确认 staged/unstaged。
2. `git status --short -- frontend backend docker Makefile pnpm-workspace.yaml .gitignore`,必须为空。
3. 如果用户给了 live 环境和账号,优先处理对应 Live Signoff Lane。
4. 如果没有 live 环境,从 Domain Completion Sprint 选择一个域。
5. 读取该域相关 Open Gaps,确认 Release must / P2 candidate / Live-only / Downgrade candidate。
6. 写 3-5 条用户可见验收标准。
7. 连续实现当前域 source-backed 功能;不要小纵切完成就停。
8. 开发中只跑局部测试,失败立即修。
9. 域收口后跑完整非 E2E 门禁。
10. 更新 HANDOFF/SPEC-GAPS。
11. 汇报实际修改文件、验证结果、`git status --short` 和建议暂存命令。
12. 仅在用户明确授权后,精确暂存本域实际修改过的允许范围文件。

## 10. 下一域推荐

当前默认下一步不再是 live auth/scheduler/SSE。除非用户提供真实环境,下一域建议:

1. **Settings 域收口**:Lark OAuth/config wizard、about markdown、query/hash/dialog deep-link、剩余 source-backed settings polish。
2. **Message + Artifact 域收口**:syntax/code interactions、HTML/resource behavior、media/PDF fallback、rich renderer depth。
3. **Scheduled Tasks 域收口**:structured cron builder、timezone-aware calendar affordances、remaining i18n labels。
