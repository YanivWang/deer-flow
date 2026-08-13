# M5 artifacts / sidecar 退出证据

> 证据日期：2026-08-13。本文记录 M5 关闭时的实现与实跑事实；后续续接仍以
> 当前 checkout、`make handoff-check` 和
> [10-current-status-and-next.md](../10-current-status-and-next.md) 为准。

## 1. 精确范围

M5 由当前 React 源码实数得到，不使用旧摘要推断：

- `frontend/src/components/workspace/artifacts/`：6 个文件；
- `frontend/src/components/workspace/sidecar/`：5 个文件；
- `frontend/src/components/workspace/changes/`：3 个文件；
- 合计 14 个文件 / 3,395 行。

共享浏览器合同固定为 6 个 spec / 27 个 tests：
`artifact-preview`、`artifact-stream-state`、`artifact-batched-stream`、
`artifact-panel-resize`、`workspace-changes`、`sidecar-chat`。

真实 Gateway 语义由下列调用链证明：

- artifact GET/PUT 读取与更新 thread workspace 文件；
- workspace-changes 按 thread/run 获取变更；
- sidecar 是带父线程 metadata 的普通隐藏 thread，沿用同一 run protocol、
  history 与 stream 状态机，不是本地伪会话。

M6 的 settings、browser view、agents、channels、scheduled tasks 等均未进入本次范围。

## 2. 实现落点

- `WorkspacePanels.vue` 统一编排主聊天与右面板；artifact 和 sidecar 互斥复用同一槽位。
- `useArtifactsPanel.ts` 管理 thread-scoped artifact 清单、选中项、面板宽度、
  session 恢复与 presented 文件；初始 history 尚未完成时不覆盖恢复状态。
- `ArtifactPanel.vue` 接通 write/replace/finalize/present 工具事件、真实文件 GET/PUT、
  冲突处理、Markdown/HTML/code/media/PDF 预览、大文件显式加载、编辑与下载。
- `useSidecar.ts` 与 `SidecarPanel.vue` 接通选区引用、父线程 metadata、独立
  model/mode/context、恢复/删除/自愈以及引用回主会话。
- `WorkspaceChangesBadge.vue` 接通真实 workspace-changes API 与 diff 展示。
- `AgentChat.vue`、`ChatComposer.vue`、`MessageList.vue` 继续消费唯一
  `useThreadStream`；引用通过隐藏 input message 进入同一提交路径，没有第二套状态机。
- `message-adapt.ts` 修复跨 SSE frame 的 tool-call 参数合并：后续完整
  `tool_call_chunks` 会替换首帧可解析但不完整的 `tool_calls.args`。
- 长历史在“乐观提交 + 最新分页推进”时使用显式尾部跟随状态；内容重排不能误解除，
  用户 wheel/touch/pointer/键盘或显式 scroll 仍可回看历史。

## 3. 共享合同适配边界

共享 React `artifact-batched-stream.spec.ts` 的外部 SSE fixture 不返回真实 Gateway
必需的 `Content-Location`，也不发送终止 `end` 帧。Vue run protocol 按冻结合同
fail closed，不能为测试削弱生产路径。因此 M5 inventory 使用语义相同的本地版本：

- 保留原来的两个断言和分批 tool-call 数据；
- 只补真实 Gateway 已提供的 `Content-Location` /
  `Access-Control-Expose-Headers` 与终止 `end`；
- 其余 5 个共享 spec 原样运行。

这 27 项是 M5 精确门禁，不等于全量 25-file/120-test 共享合同已经通过。

## 4. 实跑结果

| 命令                         | 结果                                                                                    |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| `make e2e-m5-list`           | 6 files / 27 tests，清单精确匹配                                                        |
| `make e2e-m5`                | 27/27 通过，Nuxt build 通过                                                             |
| `make e2e-m5-real-backend`   | 1/1 通过；真实回放 Gateway 的 `write_file` 自动打开 `note.txt` 并显示 `hi from replay.` |
| 定向 `message-adapt.test.ts` | 17/17 通过                                                                              |
| `make verify`                | 102 files / 1064 tests 通过；lint/format/type/unit/build 全通过                         |
| `make migration-check`       | 通过                                                                                    |
| `make consumer-check`        | pack/install/typecheck/minimal run 通过                                                 |
| `make e2e-m4b`               | 11 specs / 66 tests 通过                                                                |
| `make e2e-m4a`               | 4/4 通过                                                                                |
| `make e2e-m4a-stream`        | 3/3 通过                                                                                |
| `make e2e-real-backend`      | 3/3 通过                                                                                |
| `make e2e-m0`                | 14/14 通过                                                                              |

首次在沙箱内运行 `make verify` 与 `make e2e-m4b` 时，分别因本机 socket
`listen EPERM` 失败；`make consumer-check` 首次因沙箱 DNS `ENOTFOUND` 失败。
三者均在获准的本机环境用同一命令重跑并通过，不能把沙箱失败写成产品断言失败。

M4b 完整回归曾稳定暴露长历史虚拟窗口红项（65/66），修复尾部跟随状态后完整
66/66 通过。M4a 首轮 2/4：一项是 fixture 错配
`/api/threads/*/state` 而真实调用为 `/api/langgraph/threads/*/state`，另一项是
图标化按钮把可访问名称从 `Send` 改为 `Submit`；修正真实路径与可访问合同后 4/4。

## 5. 未扩大结论

- 全量共享套件仍只是收集到 25 files / 120 tests，本轮没有把它写成通过。
- M6/M7/M8 未实现；默认 Docker/Nginx 仍使用 React，双前端生产 readiness 仍属于 M7。
- `e2e-external` 沿用 M4b 当前 checkout 的 WebSocket 1/1、OIDC 1/1 证据；
  M5 收口后未重跑，不把它写成本轮新增验证。
- 真实后端视觉快照位于该套件自己的 ignored `*-snapshots/` 本地基线目录；
  M5 只更新本机验收图，不改变 Git 忽略策略。

在上述范围内，M5 的功能、状态、数据流、专项浏览器合同和真实 Gateway
关键链路均已满足退出条件；下一里程碑是 M6，但本次没有开始 M6。
