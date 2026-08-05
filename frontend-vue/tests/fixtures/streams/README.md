# raw SSE golden traces

06 §M2 B 的**第 2 类证据**。它验证的是分帧、事件顺序、chunk 合并、心跳、gap、
`end`/`error` 与 event id；它**不验证**真实代理与网络行为（那是第 4 类）。

不要拿 `thread.json`（516 条最终消息）代替这里的任何一条断言——最终 checkpoint
是 adapter 的 oracle，不是 transport 的（05 L14）。

## 清单

| 文件                      | 来源                                                        | 内容                                                                                                                                          |
| ------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `deerflow-create.sse`     | `POST /api/langgraph/threads/:id/runs/stream` 的完整响应体  | 74 个事件帧（`metadata` 1 · `values` 13 · `updates` 50 · `messages` 9 · `end` 1）+ 1 个 `: heartbeat` 注释帧。73 个帧带 `id:`，`end` **不带** |
| `deerflow-resume-gap.sse` | `GET …/runs/:runId/stream` 带一个已被逐出的 `Last-Event-ID` | 单个 `gap` 事件，payload 为 `stream_replay_gap` / `reload_durable_state`                                                                      |

## 元数据

| 字段                | 值                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| schema              | `deerflow-gateway-sse/1`                                                                          |
| 录制时的仓库 commit | `055d593c`                                                                                        |
| 录制场景            | `backend/tests/fixtures/replay/write_read_file.ultra.json`（仓库自带 replay fixture，非用户内容） |
| Gateway             | `tests/support/run_m0_gateway.py --queue-maxsize 32`                                              |
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

## 已知缺口

录制场景里**没有** `custom`、`checkpoints`、`tasks`、`debug` 事件，也没有
subagent namespace、reasoning、tool-call 碎片与临时 id 重写。08 §349 要求 raw
trace 覆盖这些。当前这份只覆盖了 `metadata`/`values`/`updates`/`messages`/`end`/
`gap`/heartbeat 七种，其余仍未被任何 golden 证据覆盖——见
`frontend-vue-build-docs/evidence/m2-agent-core.md`。
