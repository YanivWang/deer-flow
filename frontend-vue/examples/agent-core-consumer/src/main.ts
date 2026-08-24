/*
  【文件职责】     隔离 consumer 的最小可运行 session 验证。
  【架构位置】     consumer composition root
  【主要导出】     无（CLI）
  【依赖关系】     RunProtocol + EventReducer + message adapter + external store
  【边界与注意】   只用 bare specifier；make consumer-check 会 pack/install/typecheck/run。
*/

import {
  AGENT_CORE_CONTRACT_VERSION,
  AgentStreamError,
  createAgentExternalStore,
  createRunSession,
  readSseFrames,
} from "@deerflow/agent-core";
import type { SseEvent } from "@deerflow/agent-core";

import { createExampleRunProtocol } from "./protocol";
import { reduceExampleEvent, type ExampleState } from "./reducer";

const assert: (condition: unknown, message: string) => asserts condition = (
  condition,
  message,
) => {
  if (!condition) throw new Error(`consumer check failed: ${message}`);
};

assert(AGENT_CORE_CONTRACT_VERSION === "m8", "contract version");
assert(typeof readSseFrames === "function", "transport export");

const body =
  'event: snapshot\ndata: {"title":"custom backend","messages":[{"message_id":"m-1","speaker":"agent","text":"hello","trace_id":"trace-1"}]}\nid: 1\n\n' +
  ": keep-alive\n\n" +
  "event: done\ndata: {}\n\n";

const fakeFetch: typeof globalThis.fetch = async (input, init) => {
  assert(String(input).endsWith("/sessions"), "custom create endpoint");
  assert(init?.method === "POST", "custom create method");
  return new Response(body, { headers: { "x-session-id": "session-1" } });
};

const store = createAgentExternalStore<ExampleState, SseEvent>({
  initialState: { title: "" },
  reducer: reduceExampleEvent,
  createId: () => "id",
  now: () => 0,
});
const session = createRunSession<{ prompt: string }, { sessionId: string }>({
  protocol: createExampleRunProtocol({
    baseUrl: "https://custom.example.test/api",
    fetch: fakeFetch,
  }),
  classifyEvent: (event) =>
    event.event === "done"
      ? { kind: "completed" }
      : event.event === "error"
        ? {
            kind: "failed",
            error: new AgentStreamError("backend_error", event.data),
          }
        : { kind: "data" },
  maxBufferBytes: 65_536,
  maxReconnects: 0,
});

let terminal = "";
let heartbeats = 0;
for await (const output of session.run({ prompt: "hello" })) {
  if (output.kind === "heartbeat") heartbeats += 1;
  if (output.kind === "event") store.dispatch(output.event);
  if (output.kind === "state") terminal = output.state.status;
}
store.flushNotifications();

const snapshot = store.getSnapshot();
assert(terminal === "completed", `terminal state was ${terminal}`);
assert(heartbeats === 1, `heartbeats was ${heartbeats}`);
assert(snapshot.state.title === "custom backend", "reduced state");
assert(snapshot.messages["m-1"]?.content === "hello", "message adapter");
assert(snapshot.messages["m-1"]?.meta?.traceId === "trace-1", "wire metadata");

console.log("consumer session OK");
