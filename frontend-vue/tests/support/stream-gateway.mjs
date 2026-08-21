/*
  【文件职责】     一个会**真正分块吐帧**的假 Gateway，供 M4a 的流式 gate 使用。
  【对应 frontend/】 无；M4a 测试夹具
  【架构位置】     测试夹具
  【主要导出】     本地 8014 HTTP server
  【依赖关系】     被 playwright.m4a-stream.config.ts 当 webServer 启动，
                   Nuxt preview 的 DEER_FLOW_INTERNAL_GATEWAY_BASE_URL 指向它
  【边界与注意】   ⚠️ **它存在的唯一理由是 `route.fulfill` 做不到分块。**
                   Playwright 的路由拦截只能一次性给出完整 body，于是
                   `tests/m4a/chat-dataflow.spec.ts` 里的四条用例虽然跑在真浏览器里，
                   走的却是「一帧到齐」的假流——分帧边界、心跳、`Last-Event-ID`
                   续传、gap→rejoin 这四件**只在分块到达时才会出错**的事，
                   在那份用例里一次都没被走到。本文件把它们补上。

                   与 `run_m0_gateway.py` 的分工：那个是**真** Gateway（跑 backend
                   replay fixture），验的是协议层的真实性（G0-8）；它跑一次要十几秒，
                   而且脚本是固定的 agent run，没法按用例编排 gap。本文件相反——
                   它不真实，但**可编排**：每个用例通过 `?script=` 指定要哪种流。
                   两者不互相替代。

                   它**不是** `proxy-probe.mjs` 的扩写：那个探针刻意「不冒充 Gateway」，
                   只回显代理行为。这里必须冒充（要发 Content-Location、要接受
                   Last-Event-ID、要能 204 cancel），所以另起一个文件而不是往
                   探针里加分支——混在一起会让 M0 的代理断言开始依赖业务语义。
*/

import { createServer } from "node:http";

const port = Number(process.env.M4A_STREAM_PORT ?? 8014);
const THREAD_ID = "00000000-0000-0000-0000-0000000000a1";
const RUN_ID = "00000000-0000-0000-0000-0000000000b1";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function frame(event, data, id) {
  return (
    `event: ${event}\n` +
    (id ? `id: ${id}\n` : "") +
    `data: ${JSON.stringify(data)}\n\n`
  );
}

/**
 * 逐段 delta 的 AI 回答。分成 5 片是为了让**分帧边界落在字符中间**：
 * 每片都不是一个完整的 JSON，只有帧解析正确时拼起来才是 "Hello from DeerFlow!"。
 */
const DELTAS = ["Hello", " from", " Deer", "Flow", "!"];

/**
 * 足够撑满桌面聊天视口的逐片回答。每一片都落在同一个 AI message/group 上，
 * 专门覆盖「消息数量不变、只有已渲染内容高度持续增长」的 follow-bottom 路径。
 */
const SCROLL_DELTAS = Array.from(
  { length: 18 },
  (_, index) =>
    `\n\nStreaming paragraph ${index + 1}: ` +
    "DeerFlow keeps the active answer visible while new model tokens arrive. ".repeat(
      3,
    ),
);

/** 初始段：metadata → 一个乱序的 AI 步骤 → human（values）→ 逐片 delta。 */
function* initialScript(deltas = DELTAS) {
  yield frame("metadata", { run_id: RUN_ID, thread_id: THREAD_ID }, "e1");
  // 05 C8 的形状：AI 步骤先于 human 到达。
  yield frame(
    "messages",
    [{ id: "ai-early", type: "ai", content: "" }, {}],
    "e2",
  );
  yield frame(
    "values",
    {
      title: "Generated Title",
      messages: [
        { id: "ai-early", type: "ai", content: "" },
        { id: "human-1__user", type: "human", content: "Build a deck" },
      ],
    },
    "e3",
  );
  let index = 4;
  for (const delta of deltas) {
    yield frame(
      "messages",
      [{ id: "ai-early", type: "ai", content: delta }, {}],
      `e${index}`,
    );
    index += 1;
  }
}

async function writeTaskScript(response) {
  response.write(
    frame("metadata", { run_id: RUN_ID, thread_id: THREAD_ID }, "t1"),
  );
  await sleep(40);
  response.write(
    frame(
      "values",
      {
        title: "Market research",
        messages: [
          {
            id: "human-task__user",
            type: "human",
            content: "Research the market",
          },
          {
            id: "ai-task",
            type: "ai",
            content: "",
            tool_calls: [
              {
                id: "task-1",
                name: "task",
                type: "tool_call",
                args: {
                  description: "Research the market",
                  prompt: "Find current evidence",
                },
              },
            ],
          },
        ],
      },
      "t2",
    ),
  );
  await sleep(40);
  response.write(
    frame(
      "custom",
      {
        type: "llm_retry",
        attempt: 1,
        max_attempts: 2,
        wait_ms: 500,
        reason: "rate_limit",
        message: "The model is busy. Retrying…",
      },
      "t3",
    ),
  );
  // Keep the retry visible long enough for the browser to observe the
  // transient state before task progress clears it.
  await sleep(700);
  response.write(
    frame(
      "custom",
      {
        type: "task_started",
        task_id: "task-1",
        description: "Research the market",
        prompt: "Find current evidence",
        subagent_type: "research",
        model_name: "scenario-model",
      },
      "t4",
    ),
  );
  await sleep(80);
  response.write(
    frame(
      "custom",
      {
        type: "task_running",
        task_id: "task-1",
        message_index: 1,
        message: { type: "ai", content: "Planning the research" },
        model_name: "scenario-model",
        usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
      },
      "t5",
    ),
  );
  await sleep(80);
  response.write(
    frame(
      "custom",
      {
        type: "task_running",
        task_id: "task-1",
        message_index: 2,
        message: {
          type: "tool",
          name: "web_search",
          content: "Found evidence",
        },
        model_name: "scenario-model",
        usage: { input_tokens: 20, output_tokens: 10, total_tokens: 30 },
      },
      "t6",
    ),
  );
  await sleep(80);
  response.write(
    frame(
      "custom",
      {
        type: "task_completed",
        task_id: "task-1",
        result: "Market evidence ready.",
        model_name: "scenario-model",
        usage: { input_tokens: 20, output_tokens: 10, total_tokens: 30 },
      },
      "t7",
    ),
  );
  await sleep(80);
  response.write(frame("end", {}, "t8"));
  response.end();
}

async function writeChunked(
  response,
  chunks,
  { delayMs = 40, heartbeat = false } = {},
) {
  for (const chunk of chunks) {
    if (response.writableEnded) return false;
    if (heartbeat) {
      // 心跳是注释帧，必须在传输层就被吃掉，不能进 reducer（05 L9）。
      response.write(": keep-alive\n\n");
    }
    response.write(chunk);
    await sleep(delayMs);
  }
  return true;
}

function openSse(response) {
  response.writeHead(200, {
    "cache-control": "no-cache",
    "content-type": "text/event-stream",
    "content-location": `/api/threads/${THREAD_ID}/runs/${RUN_ID}`,
    "x-accel-buffering": "no",
  });
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
  const script =
    url.searchParams.get("script") ?? process.env.M4A_SCRIPT ?? "plain";

  if (url.pathname === "/health") {
    response.setHeader("content-type", "application/json");
    response.end('{"status":"ok"}');
    return;
  }

  // Thread lifecycle: the production Gateway requires an explicit thread
  // before a run starts, so this fixture must model the same contract.
  if (url.pathname === "/api/threads" && request.method === "POST") {
    let raw = "";
    for await (const chunk of request) raw += chunk;
    const body = raw ? JSON.parse(raw) : {};
    const now = new Date().toISOString();
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({
        thread_id: body.thread_id ?? THREAD_ID,
        created_at: now,
        updated_at: now,
        metadata: body.metadata ?? {},
        status: "idle",
        values: { title: "", messages: [] },
        interrupts: {},
      }),
    );
    return;
  }

  if (/\/api\/threads\/[^/]+$/.test(url.pathname)) {
    const now = new Date().toISOString();
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({
        thread_id: url.pathname.split("/").at(-1),
        created_at: now,
        updated_at: now,
        metadata: {},
        status: "idle",
        values: { title: "Generated Title", messages: [] },
        interrupts: {},
      }),
    );
    return;
  }

  // create：POST /api/threads/:id/runs/stream
  if (
    /\/threads\/[^/]+\/runs\/stream$/.test(url.pathname) &&
    request.method === "POST"
  ) {
    request.resume();
    openSse(response);
    if (script === "task") {
      await writeTaskScript(response);
      return;
    }
    const deltas = script === "scroll" ? SCROLL_DELTAS : DELTAS;
    const ok = await writeChunked(response, [...initialScript(deltas)], {
      delayMs: script === "scroll" ? 90 : 40,
      heartbeat: true,
    });
    if (!ok) return;
    if (script === "gap") {
      // 缺口：告诉客户端「你要的游标已经被淘汰了，从 latest 重来」。
      response.write(
        frame(
          "gap",
          {
            code: "stream_replay_gap",
            run_id: RUN_ID,
            requested_event_id: null,
            earliest_available_event_id: "e7",
            latest_available_event_id: "e8",
            recovery: "reload_durable_state",
          },
          "e9",
        ),
      );
      response.end();
      return;
    }
    response.write(frame("end", {}, "e9"));
    response.end();
    return;
  }

  // resume/join：GET /api/threads/:id/runs/:run/stream，带 Last-Event-ID
  if (
    /\/threads\/[^/]+\/runs\/[^/]+\/stream$/.test(url.pathname) &&
    request.method === "GET"
  ) {
    const cursor = request.headers["last-event-id"];
    openSse(response);
    // 把收到的游标回显成一条 AI 消息：用例据此断言**续传真的带了游标**，
    // 而不是从头重放。
    await writeChunked(response, [
      frame(
        "messages",
        [
          {
            id: "ai-resumed",
            type: "ai",
            content: `resumed@${cursor ?? "none"}`,
          },
          {},
        ],
        "r1",
      ),
      frame("end", {}, "r2"),
    ]);
    response.end();
    return;
  }

  // cancel
  if (/\/runs\/[^/]+\/cancel/.test(url.pathname)) {
    request.resume();
    response.writeHead(204).end();
    return;
  }

  // durable state（gap 之后的 reload）
  if (/\/threads\/[^/]+\/state$/.test(url.pathname)) {
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({
        values: {
          title: "Generated Title",
          messages: [
            { id: "human-1__user", type: "human", content: "Build a deck" },
            { id: "ai-early", type: "ai", content: "Hello from DeerFlow!" },
          ],
        },
      }),
    );
    return;
  }

  // 历史分页
  if (/\/threads\/[^/]+\/messages\/page$/.test(url.pathname)) {
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({ data: [], has_more: false, next_before_seq: null }),
    );
    return;
  }

  if (/\/threads\/[^/]+\/runs\/[^/]+\/events$/.test(url.pathname)) {
    response.setHeader("content-type", "application/json");
    response.end("[]");
    return;
  }

  response.setHeader("content-type", "application/json");
  response.end("{}");
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`m4a stream gateway on ${port}\n`);
});
