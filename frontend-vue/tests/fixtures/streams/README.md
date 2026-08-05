# raw SSE golden traces

06 §M2 B 的**第 2 类证据**。它验证的是分帧、事件顺序、chunk 合并、心跳、gap、
`end`/`error` 与 event id；它**不验证**真实代理与网络行为（那是第 4 类）。

不要拿 `thread.json`（516 条最终消息）代替这里的任何一条断言——最终 checkpoint
是 adapter 的 oracle，不是 transport 的（05 L14）。

## 清单

| 文件                      | 来源                                                        | 内容                                                                                                                                                                                                      |
| ------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `deerflow-create.sse`     | `POST /api/langgraph/threads/:id/runs/stream` 的完整响应体  | 226 个事件帧（`metadata` 1 · `values` 13 · `updates` 50 · `messages` 9 · `checkpoints` 52 · `tasks` 100 · `end` 1）+ 1 个 `: heartbeat` 注释帧。225 个帧带 `id:`，`end` **不带**。1.1 MB（gzip 后 18 KB） |
| `deerflow-resume-gap.sse` | `GET …/runs/:runId/stream` 带一个已被逐出的 `Last-Event-ID` | 单个 `gap` 事件，payload 为 `stream_replay_gap` / `reload_durable_state`                                                                                                                                  |

## 元数据

| 字段                | 值                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| schema              | `deerflow-gateway-sse/1`                                                                          |
| 录制时的仓库 commit | `548bf3ae`（M2 收尾重录，加入 `checkpoints` / `tasks`）                                           |
| 录制场景            | `backend/tests/fixtures/replay/write_read_file.ultra.json`（仓库自带 replay fixture，非用户内容） |
| Gateway             | `tests/support/run_m0_gateway.py --queue-maxsize 128`                                             |
| 请求的 stream_mode  | `values` `messages-tuple` `updates` `custom` `checkpoints` `tasks`                                |
| 路径                | 经 Nuxt preview 代理，不是直连 Gateway                                                            |

## 重新录制

```bash
cd frontend-vue && make run-protocol-smoke
cp test-results/real-backend/run-protocol*/create.redacted.sse tests/fixtures/streams/deerflow-create.sse
cp test-results/real-backend/run-protocol*/resume-gap.redacted.sse tests/fixtures/streams/deerflow-resume-gap.sse
```

去敏由 `tests/m0-real-backend/run-protocol.spec.ts::redactRawBody` 完成，**不是手工做的**——
手工去敏无法复跑，也无法证明下一次录制去干净了。它只改三类字节：

- uuid → 稳定占位符（**每个不同的 uuid 有各自的占位符**：`gap` 事件里的 run_id
  必须仍然等于 `metadata` 里的那个，压成同一个常量会毁掉 gap 测试要断言的关系）；
- ISO 时间戳 → 固定值；
- sandbox 绝对路径前缀 → `/tmp/m0-replay-gw`（原文带本机用户名与随机后缀）。

帧结构、chunk 边界、`id:` 值一律不动。`id:` 是 bridge 的序号游标不是凭据，
而且它正是续传测试要重放的东西。

## 为什么 `checkpoints` / `tasks` 是靠改请求拿到的，不是重新录一次 LLM

它们是**请求模式**，不是场景产物：同一份 replay fixture 换一个 `stream_mode`
就会产出。所以 08 §402 点名要的这两种，代价只是改 `run-protocol.spec.ts` 的一行。

**`debug` 有意不录。** 08 §402 的 raw-trace 清单里没有它（§349 的 event-map
清单里才有），而它一个人就把 fixture 从 1.1 MB 顶到 2.1 MB、事件数从 226 顶到 378。
实测数据留在 `playwright.m0-real-backend.config.ts` 的注释里，要录随时能录。

`--queue-maxsize` 必须跟着重调：它要**大于 live burst、小于总事件数**。
实测 32 会让 create 流自己被 gap（原来的 74 帧下没问题），128 通过；
加上 `debug` 之后 384 又会大到不再逐出首个游标。run-protocol spec 的两条失败
消息会直接告诉你破在哪一侧，照着调即可。

## 已知缺口

录制场景里仍然**没有** `custom`、`debug` 事件，也没有 subagent namespace 与
reasoning。前两者是场景不产生（`custom` 已在请求里、这个场景就是不发），
后两者要换录制场景——`write_read_file.ultra` 的提示词明确禁止委派子 agent，
而 replay 模型不产出 reasoning。**tool-call 碎片与临时 id 重写不在缺口里**：
上一份 README 说它们没覆盖，那是错的，录制里本来就有（9 个 `messages` 帧里
2 个带 `tool_call_chunks`，human 消息的 id 从 `X` 变成 `X__user`）。
详见 `frontend-vue-build-docs/evidence/m2-agent-core.md`。
