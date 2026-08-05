/*
  【文件职责】     用 DeerFlow Gateway 实现内核的 RunProtocol 四个方法。
  【对应 frontend/】 frontend/src/core/api/api-client.ts（被替代的对象）
  【架构位置】     L3
  【主要导出】     DeerFlowRunInput · DEERFLOW_DURABLE_STATUS · createDeerFlowRunProtocol
  【依赖关系】     @deerflow/agent-core · ./endpoints · @/core/api/stream-mode · @/core/api/fetcher
  【边界与注意】   **stream mode 校验在这里、在 HTTP 之前（05 A2）。**
                   上游是在调 SDK 之前校验的；改成自研 transport 之后那个时机
                   没有了，所以契约挪到「适配层构造请求时」——把它固定在一个有
                   测试覆盖的模块里，比指望每个调用点自觉可靠。
                   `sanitizeRunStreamOptions` 仍然落在 `@/core/api/stream-mode`
                   而不是本目录：它是 COPIED 档，逐字节等同上游，移动会让它退出
                   hash 护城河并逼一个生成测试转手工维护。位置与所属层不一致，
                   但"不在内核里"这条已由 architecture.test.ts 守住。

                   durable status → 内核 outcome 的映射也在这里。内核不认识
                   `"interrupted"` 这类字符串（L1 禁入清单第 2/3 条），
                   它只收 completed/cancelled/failed 三选一。
*/

import type {
  CancelResult,
  InspectedRun,
  OpenedStream,
  RunOutcome,
  RunProtocol,
} from "@deerflow/agent-core";
import { AgentStreamError } from "@deerflow/agent-core";

import { fetch as fetchWithAuth } from "@/core/api/fetcher";
import { sanitizeRunStreamOptions } from "@/core/api/stream-mode";

import type { DeerFlowRunHandle } from "./endpoints";
import {
  parseRunHandle,
  runCancelUrl,
  runResourceUrl,
  runResumeUrl,
  runStreamUrl,
} from "./endpoints";

export interface DeerFlowRunInput {
  threadId: string;
  /** 原样转发给 Gateway 的 run 请求体（assistant_id / input / context / …）。 */
  payload: Record<string, unknown>;
}

/**
 * 把 wire 请求体桥接成 `sanitizeRunStreamOptions` 认识的形状再校验。
 *
 * ⚠️ **这个桥是必需的，05 §A2 没有算到它。** 那条不变式说「stream-mode.ts
 * 原样保留，校验时机从『SDK 调用前』改为『适配层构造请求时』」——但到了适配层
 * 构造请求的时刻，手里已经不是 SDK 的 options 对象而是 wire 请求体了：
 * SDK 写 `streamMode` / `streamResumable`（camelCase），Gateway 收
 * `stream_mode` / `stream_resumable`（snake_case）。把 COPIED 档直接套在
 * wire 请求体上，`"streamMode" in options` 恒为 false，**校验一声不响地什么
 * 都不做**——这是被本文件的 A2 测试抓出来的，不是推理出来的。
 *
 * 桥而不是改 stream-mode.ts：后者是 COPIED 档，改一个字节就退出 hash 护城河，
 * 而这里要修的本来也不是它的逻辑，是两种命名之间少了一次翻译。
 */
function assertSupportedStreamModes(payload: Record<string, unknown>): void {
  const streamMode = payload.stream_mode ?? payload.streamMode;
  if (streamMode == null) return;
  sanitizeRunStreamOptions({ streamMode });
}

/** 05 A3：`streamResumable` 不得出现在请求里，两种命名都挡。 */
function withoutStreamResumable(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(payload).filter(
      ([key]) => key !== "stream_resumable" && key !== "streamResumable",
    ),
  );
}

/**
 * Gateway 的 durable run status 全集，以及它们到内核终态的冻结映射（08 §258）。
 *
 * `pending` / `running` 不是终态，所以没有 outcome——它们对应内核的
 * `creating` / `streaming`，由会话自己维护，不从这里读。
 */
export const DEERFLOW_DURABLE_STATUS: Record<string, RunOutcome | null> = {
  pending: null,
  running: null,
  success: "completed",
  interrupted: "cancelled",
  error: "failed",
  timeout: "failed",
};

export interface DeerFlowProtocolOptions {
  /** `/api/langgraph` 前缀的完整 base（02：前缀不能改，它是 nginx 与 E2E 的挂载点）。 */
  baseUrl: string;
  /** 便于测试注入；默认走带 CSRF 与 credentials 的 fetcher。 */
  fetchImpl?: typeof fetchWithAuth;
}

async function failFromResponse(
  response: Response,
  action: string,
): Promise<never> {
  const body = await response.text().catch(() => "");
  throw new AgentStreamError(
    "http",
    `${action} failed with HTTP ${response.status}${body ? `: ${body}` : ""}`,
  );
}

export function createDeerFlowRunProtocol(
  options: DeerFlowProtocolOptions,
): RunProtocol<DeerFlowRunInput, DeerFlowRunHandle> {
  const { baseUrl, fetchImpl = fetchWithAuth } = options;

  return {
    async create(input, signal): Promise<OpenedStream<DeerFlowRunHandle>> {
      // 05 A2：含不支持模式时必须**在 HTTP 之前**抛错，不能部分转发、
      // 也不能静默降级为 values。这两行的位置就是那条不变式。
      assertSupportedStreamModes(input.payload);
      const payload = withoutStreamResumable(input.payload);

      const response = await fetchImpl(runStreamUrl(baseUrl, input.threadId), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify(payload),
        signal,
      });
      if (!response.ok) await failFromResponse(response, "Run creation");

      // 05 L12：只认 Content-Location。实测 Gateway 不发 Location，
      // 找不到就 fail closed——没有 handle 就不能自动续传（08 §硬规则 2）。
      const handle = parseRunHandle(response.headers.get("Content-Location"));
      if (!handle) {
        throw new AgentStreamError(
          "missing_handle",
          "Gateway did not return a Content-Location for the new run.",
        );
      }
      return { handle, response };
    },

    async resume(handle, cursor, signal): Promise<Response> {
      const response = await fetchImpl(runResumeUrl(baseUrl, handle), {
        method: "GET",
        headers: {
          Accept: "text/event-stream",
          // 游标为空时**不发**这个头：发一个空的 Last-Event-ID 与"从头开始"
          // 不是一回事，后端会把它当成一个真实的、已经不存在的游标。
          ...(cursor ? { "Last-Event-ID": cursor } : {}),
        },
        signal,
      });
      if (!response.ok) await failFromResponse(response, "Run resume");
      return response;
    },

    async cancel(handle, _cursor, signal): Promise<CancelResult> {
      const response = await fetchImpl(runCancelUrl(baseUrl, handle), {
        method: "POST",
        signal,
      });

      // 三种结果各有含义，压成 void 就等于把「run 到底停没停」这个问题丢掉
      // （05 L16）。204 是已确认终态；202 是收到了但还没停；200 带 SSE body
      // 说明要继续读尾帧。
      if (response.status === 204) {
        return { kind: "terminal", outcome: "cancelled" };
      }
      if (response.status === 202) return { kind: "accepted" };
      if (response.ok && response.body) {
        return { kind: "drain", response };
      }
      if (response.ok) return { kind: "accepted" };
      return failFromResponse(response, "Run cancel");
    },

    async inspect(handle, signal): Promise<InspectedRun> {
      const response = await fetchImpl(runResourceUrl(baseUrl, handle), {
        method: "GET",
        headers: { Accept: "application/json" },
        signal,
      });
      if (!response.ok) await failFromResponse(response, "Run inspect");

      const run = (await response.json()) as { status?: unknown };
      const status = typeof run.status === "string" ? run.status : "";
      const outcome = DEERFLOW_DURABLE_STATUS[status];

      // 未知 status 当作**还没到终态**，不是失败：多一个枚举值就把 run 判死，
      // 会在后端加状态的那天让所有停止操作都报错。有界轮询本身会兜底。
      if (outcome === undefined || outcome === null) {
        return { terminal: false, reason: status };
      }
      return { terminal: true, outcome, reason: status };
    },
  };
}
