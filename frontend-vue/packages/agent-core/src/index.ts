/*
  【文件职责】     agent-core 的公共导出面——包外唯一可见的东西。
  【对应 frontend/】 无；M0 新增边界
  【架构位置】     L1
  【主要导出】     transport · session · store · message · errors · watchdog
  【依赖关系】     不依赖任何宿主框架
  【边界与注意】   应用侧只能从这里 import（08 §包与 workspace 契约）。深路径
                   `@deerflow/agent-core/src/*` 由 tests/architecture.test.ts 挡住：
                   绕过本文件会让「整包搬走」当场作废——消费方拿到包之后才发现
                   自己依赖的是没导出的内部路径。
                   新增导出等于扩大对外承诺，改这里要当接口变更看。
*/

export const AGENT_CORE_CONTRACT_VERSION = "m2" as const;

export type { AgentErrorKind } from "./errors";
export {
  AgentStreamError,
  isRetryableKind,
  toAgentStreamError,
} from "./errors";

export type {
  AgentContentPart,
  AgentMessage,
  AgentMessageContent,
  AgentMessageRole,
  AgentToolCall,
} from "./message";
export { createAgentMessage } from "./message";

export type { SseEvent, SseFrame } from "./transport/sse-event";
export type { FrameReaderOptions } from "./transport/read-sse-frames";
export { readSseFrames } from "./transport/read-sse-frames";
export { flushSseRemainder, readNextSseFrame } from "./transport/sse-buffer";
export { parseSseFrame } from "./transport/parse-sse-event";

export type { BackoffOptions } from "./session/backoff";
export { computeBackoffDelay, DEFAULT_BACKOFF } from "./session/backoff";
export type {
  CancelResult,
  ClassifyEvent,
  InspectedRun,
  OpenedStream,
  RunOutcome,
  RunProtocol,
  StreamRequest,
  StreamSignal,
} from "./session/protocol";
export type { RunSessionState, SessionOutput } from "./session/state";
export type { RunSession, RunSessionOptions } from "./session/run-session";
export { createRunSession } from "./session/run-session";

export type {
  AgentSnapshot,
  EventReducer,
  ReduceAction,
} from "./store/snapshot";
export type { AgentExternalStore } from "./store/external-store";
export {
  applyReduceActions,
  createAgentExternalStore,
} from "./store/external-store";

export type {
  WatchdogInput,
  WatchdogOptions,
  WatchdogVerdict,
} from "./watchdog";
export { DEFAULT_WATCHDOG, evaluateWatchdog } from "./watchdog";
