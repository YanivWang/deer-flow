# M6 remaining L3 evidence

> 历史快照：2026-08-13。当前状态以后续的
> [10-current-status-and-next.md](../10-current-status-and-next.md)、当前 checkout 与新实跑结果为准。

## 1. 起点与 M5 事实

本轮冷启动时先执行了 `make handoff-check`，并读取根/前端/后端模块指南、文档 10、
迁移计划 M6 与 M5 evidence。提示中的“约 32 个未提交 M5 条目”已经过时：初始工作树和
暂存区均为空，M5 已由当前 `HEAD` 的
`0cd0b7c39ad6aa7ac5a1626e3c22676ab3022d11 feat(frontend-vue): complete M5 artifacts and sidecar`
提交。该提交相对 `524beace` 是 34 个文件、3,865 additions / 548 deletions，
`git diff 524beace..0cd0b7c3 --check` 通过且不含 `.env`。因此本轮没有重复提交 M5，
也没有把 M6 混入 M5 历史。

## 2. 精确 inventory

M6 不是候选页面清单，而是计划已冻结的 8 个共享 Playwright spec、I/K/N 归属项与其
真实 React/Gateway 调用链的交集。

| 能力 | React 来源 | Vue 最终落点 | 共享合同 / 后端事实 |
| --- | --- | --- | --- |
| sidebar / mobile | `workspace-sidebar.tsx`、`ui/sidebar.tsx`、workspace route | `ThreadSidebar.vue`、`WorkspacePanels.vue` | `sidebar.spec.ts` 4、`ui-polish-mobile.spec.ts` 3；现有 thread search/pin/state API |
| settings | `settings/` 15 个组件、`workspace-settings-deep-link.tsx` | `settings/` 9 个页面、`SettingsDialog.vue`、`useSettingsDialog.ts` | `settings-notification.spec.ts` 2、`integrations.spec.ts` 3；auth、MCP、skills、memory、integrations、channels REST |
| browser | `browser-view/` 8 个文件 | `browser-view/` 5 个文件、`useWorkspaceFeatures.ts` | `browser-feature.spec.ts` 2；POST `/threads/{id}/browser/navigate` 与 WS `/threads/{id}/browser/stream` |
| channels | `channels/` 3 个组件、`core/channels/*` | `ChannelConnections.vue`、`useChannels.ts`；复用已迁 core | `channels.spec.ts` 5；GET `/api/channels/` 与 provider config/connect API |
| scheduled tasks | scheduled-tasks page/input/link、`core/scheduled-tasks/*` | `scheduled-tasks.vue`；复用已迁 API/types/recipes | `scheduled-tasks.spec.ts` 6；list/create/detail/patch/pause/resume/trigger/delete/runs/thread-filter REST |
| agents | agents app routes、gallery/card/settings/disabled、`core/agents/*` | agents index/new、复用唯一 `AgentChat`/thread/run/stream | `agents-feature-disabled.spec.ts` 2；features + agent name-check/get/list/update/delete API |
| goal/mode/source | goal status/helpers、mode guide/chat mode、thread source | `GoalStatus.vue`、`goal.ts`、`ChatComposer.vue`、已有 source badge | M6 散件；GET/PUT/DELETE `/threads/{id}/goal`，目标 4,000 字符上限由后端模型与前端共同约束 |
| K4/K5/N2 | sidebar rename、tool settings、notification hooks | thread store/sidebar、`ToolSettings.vue`、`useNotifications.ts` | K4 失败不关 dialog；K5 单 server PATCH 后 refetch；N2 permission/test/run completion |

精确门禁固定在 `tests/m6-inventory.json`：8 files / 27 tests；
`scripts/m6-inventory.mjs` 同时校验文件与测试数，不能用全量 collection 自证。

## 3. 本里程碑实际实现

- 建立唯一全局 Settings dialog，支持 query deep link 与 Account、Appearance、Notification、
  Tools、Skills、Memory、Integrations、Channels、About 九个真实 section；写操作调用现有
  Gateway/core API，错误保持可见且不伪造成功。
- MCP 开关调用单 server PATCH，成功后重新读取权威配置；thread rename 继续调用
  LangGraph `threads.updateState`，失败时保留 dialog 和错误。
- Browser panel 按 feature flag 显隐，navigate 走 REST，画面与输入走真实 WebSocket；
  接受 binary JPEG 与旧 base64 frame，latest-frame buffer 在 animation frame 边界替换帧，
  回收 object URL，一个物理 click 只发一个 `click` 事件，并有有界重连。
- Channels 在 sidebar/settings 共用一份状态，按 Gateway 返回的 provider schema 编辑配置；
  写响应不回显 secret/schema 时重新 GET 权威 provider。secret 使用文本输入加
  `-webkit-text-security`，并禁止 password manager 自动接管，符合共享合同。
- Scheduled Tasks 接通 list/filter/create/pause/resume/trigger/runs/thread deep link；没有静态
  假任务路径。
- Agents 对 `agents_api=false` fail-sticky，避免 403 storm；gallery、模型设置、更新和删除
  均接真实 API。新 Agent 先调用 name-check，再以 `is_bootstrap=true` 进入既有 `AgentChat`
  和同一 thread/run/stream 状态机，没有第二套流状态机。
- `/goal` status/clear/set 接真实 endpoint；set 后把 objective 通过同一消息提交链启动 run，
  streamed/store goal 状态、continuation 与错误均可见。Mode selector 传递 mode、thinking、
  reasoning context，并提供 hover 说明。
- 移动端 sidebar/drawer、artifact 移动端 dialog 与 thread detail merge 完成；列表刷新不再
  用摘要对象覆盖当前 thread 的 values/metadata。
- 增加 `make e2e-m6-list`、`make e2e-m6`、`make e2e-m6-real-backend`，以及 goal/store/源级
  invariant tests。`app/core/PROVENANCE.md` 登记新增 adapted goal 纯函数。

## 4. 首轮失败、根因与修复

| 首轮现象 | 根因 | 最终修复 |
| --- | --- | --- |
| M6 基线 4 passed / 18 failed / 5 not run | Vue 尚无 M6 产品 surface | 按 inventory 接通上述真实 UI/API，未弱化共享 spec |
| build 报 `v-else` adjacency | agents 条件误挂到 New Chat 邻接结构 | 恢复合法分支结构并重跑 build |
| typecheck 报 readonly channel refs / style 类型 | composable 暴露类型与 WebKit style 表达不匹配 | 以显式 mutation API 与 scoped CSS 表达 |
| M6 实现后 22 passed / 5 failed | channel 写响应不含 secret/schema；通知读最终消息过早；mobile marker/z-index；thread 摘要覆盖详情 | 写后 refetch；有界等待新 route final message；补 marker/z-index；merge values/metadata |
| M6 再跑 26/27 | completion notification 的 0ms 调度仍早于最终消息 | 最多 8 次、每次 25ms 的有界等待，不改变 run 完成判定 |
| M4b 65/66 | welcome 建议文本 `Research a topic` 与真实 Research mode button 形成歧义 selector | 改为 `Explore a topic`；随后完整 M4b 66/66 |
| `make verify` 首轮 lint 2 errors | Channels 未用 props 变量；Agents 弹窗形成多模板根 | 移除绑定变量；加单一模板根 |
| `make verify` 首轮 unit 阶段另有 12 timeout | 沙箱禁止监听 `127.0.0.1`，明确 `listen EPERM` | 按要求以本机权限原命令重跑，104 files / 1071 tests 全过 |
| provenance/collected-check 各报 1 项 | 新 `threads/goal.ts` 和放在 generated core-test 路径的手写测试未登记 | 登记 ADAPTED；手写测试移到 `tests/unit/threads/`，不污染生成区 |
| `consumer-check` 首轮阻塞 | 沙箱 registry DNS `ENOTFOUND` | 中断等待并以本机网络权限原命令重跑通过 |

环境 EPERM/ENOTFOUND 均没有写成产品断言失败。

## 5. 2026-08-13 最终实跑

| 命令 | 结果 |
| --- | --- |
| `make verify` | 通过：104 files / 1071 tests；59 migrated test files / 560 tests；lint 无 error、format、typecheck、i18n、OpenAPI、Nuxt build 通过 |
| `make migration-check` | 通过：provenance/test manifest、58 generated tests、24 RETYPED |
| `make consumer-check` | 通过：pack、clean install、consumer typecheck、最小 session |
| `make e2e-m0` | 14/14 |
| `make e2e-m4a` / `make e2e-m4a-stream` | 4/4；3/3 |
| `make e2e-m4b` | 精确 11 files / 66 tests，66/66 |
| `make e2e-m5` / `make e2e-m5-real-backend` | 27/27；1/1 |
| `make e2e-m6-list` / `make e2e-m6` | 精确 8 files / 27 tests；27/27 |
| `make e2e-m6-real-backend` | 1/1：真实 Gateway navigate + browser WS binary Blob frame 渲染 |
| `make e2e-real-backend` | 3/3 |
| `make e2e-external` | WebSocket 1/1；OIDC 1/1（本轮当前 checkout 新证据） |
| `make e2e-list` | 仅收集 25 files / 120 tests；没有执行或声明 120 passed |

## 6. 退出结论与边界

M6 的计划退出项 I1-I5、K4、K5、N2、精确 8-spec/27-test 合同及 browser 真实 Gateway
关键链路均已满足，M6 可以关闭。

明确未进入 M7：H1-H6 完整三面板 splitpanes、25-file/120-test 全共享合同执行、完整认证、
关键视觉与性能门禁、双 hostname/Nginx/Compose/生产切换和 production readiness。明确未进入
M8：L2 公共组件/包契约、外部消费者文档与最终资产收口。

仍不可由本轮证明的运行时语义：真实第三方 Lark/channel 远端授权与收发、scheduler daemon
按时触发、带真实模型/provider 的 agent bootstrap 最终产物、任意公网网站上的 browser tool
长期运行，以及真实桌面 OS notification 展示。这些不影响已冻结 M6 本地/协议门禁，但不得
扩大写成生产完成。
