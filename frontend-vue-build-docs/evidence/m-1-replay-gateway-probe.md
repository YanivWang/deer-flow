# M-1 Gateway 运行探针（去敏）

> 采集日期：2026-08-04。探针启动的是仓库当前 checkout 的真实 FastAPI Gateway，模型上游使用仓库自带 deterministic replay fixture；认证通过 `DEER_FLOW_AUTH_DISABLED=1` 关闭。它证明 HTTP/SSE 路由与运行时行为，不证明外部 LLM、生产 TLS/OIDC、Nuxt/Nitro 代理或多 worker Redis 行为。

## 启动边界

```bash
cd backend
DEER_FLOW_AUTH_DISABLED=1 uv run python scripts/run_replay_gateway.py \
  --port 18011 \
  --cors http://localhost:3101 \
  --fixture tests/fixtures/replay/write_read_file.ultra.json
```

脚本内部自行创建临时 `DEER_FLOW_HOME` 与 config，并固定监听 `127.0.0.1`；不接受也不需要外部 `--host/--config` 参数。

- `/health`：HTTP `200`。
- `POST /api/threads`：HTTP `200`，成功创建探针 thread。
- 随机 thread/run id、时间戳和本机临时路径均已去除或替换为占位符。

## 创建并消费 stream

请求：

```http
POST /api/threads/<thread-id>/runs/stream HTTP/1.1
Content-Type: application/json
Origin: http://localhost:3101

{
  "assistant_id": "lead_agent",
  "input": {"messages": [{"role": "user", "content": "<fixture prompt>"}]},
  "stream_mode": ["values", "messages-tuple", "updates", "custom"],
  "on_disconnect": "continue"
}
```

响应头：

```http
HTTP/1.1 200 OK
content-type: text/event-stream; charset=utf-8
cache-control: no-cache
connection: keep-alive
x-accel-buffering: no
content-location: /api/threads/<thread-id>/runs/<run-id>
access-control-expose-headers: Content-Location
```

没有观察到 `Location`。帧序列以 `metadata` 开始，随后出现 `values`、`updates`、`messages` 等事件；请求名 `messages-tuple` 对应 wire event `messages`。普通事件带单调递增的服务端 `id`，终止帧如下：

```text
event: end
data: null

```

终止帧没有 `id`。本次 fixture 与上述多 mode 请求组合最终得到 durable run `status=error`；因此本证据只确认路由、响应头、分帧、cursor 与终止协议，**不声称该业务 run 成功**。

## `Last-Event-ID` 恢复

使用首个 `metadata` 帧的服务端 id：

```http
GET /api/threads/<thread-id>/runs/<run-id>/stream HTTP/1.1
Last-Event-ID: <metadata-event-id>
```

响应为 HTTP `200` SSE，第一条重放帧是该 cursor **之后**的 `values`，随后按原顺序重放直至无 id 的 `end`。这确认了 resume 是 GET、cursor 为排他游标，且不能重新 POST create。

## inspect 与 cancel 边界

- `GET /api/threads/<thread-id>/runs/<run-id>`：HTTP `200`，本次 durable status 为 `error`。
- 对该终态调用 `POST .../cancel?action=interrupt&wait=false`：HTTP `409`，符合“终态不可取消”。
- 本次探针没有稳定制造仍处于 active 状态的 run，因而没有把 `202 accepted`、`wait=true -> 204`、heartbeat、gap 或跨 worker cancel 记成运行验证；这些行为目前只由源码和仓库测试确认，仍是 M0 的真实代理/运行 gate。

## 证据分级

| 结论                                                         | 证据等级                                             |
| ------------------------------------------------------------ | ---------------------------------------------------- |
| create SSE 为 `200`，使用 `Content-Location` 而非 `Location` | 当前 Gateway 运行探针                                |
| resume GET + `Last-Event-ID` 从 cursor 后一帧继续            | 当前 Gateway 运行探针                                |
| `messages-tuple` 请求映射到 `messages` wire event            | 当前 Gateway 运行探针 + 源码/测试                    |
| 普通帧有 id，heartbeat/end 不应推进 cursor                   | 当前 Gateway 运行探针（end）+ 源码/测试（heartbeat） |
| active cancel 的 `200/202/204`、gap、跨 worker行为           | 仅源码/测试；M0 继续运行验证                         |
| 外部模型、生产 Redis、TLS/OIDC、Nuxt 代理                    | 未验证；不能由此探针推出                             |
