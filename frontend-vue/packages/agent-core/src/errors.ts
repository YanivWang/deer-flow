/*
  【文件职责】     内核统一的错误类型与「能不能退避重连」的唯一判据。
  【对应 frontend/】 无；上游把这些情况散在 SDK 与 hooks 里
  【架构位置】     L1
  【主要导出】     AgentErrorKind · AgentStreamError · isRetryableKind
  【依赖关系】     无
  【边界与注意】   `retryable` 不是调用方随手填的布尔，默认由 kind 推出——
                   08 §硬规则 4 只给了网络错误与意外 EOF 这一类退避资格，
                   后端 error、解析错误、权限错误一律不重试。让每个构造点自己
                   决定，等于把那条规则复制到 N 个地方，改一处漏一处。

                   枚举里没有单独的 `eof`：意外 EOF 与网络中断对重连策略是同一
                   件事（连接没了，run 可能还活着），所以归入 `network`，靠
                   message 区分。真要分开，得先说清它们的策略差在哪。
*/

export type AgentErrorKind =
  | "network"
  | "abort"
  | "http"
  | "backend_error"
  | "parse_error"
  | "missing_handle"
  | "reconnect_exhausted"
  | "replay_gap"
  | "unknown";

/**
 * 唯一可退避重连的一类。
 *
 * `http` 不在内：4xx 重试没有意义，5xx 看似可重试，但重连走的是 `resume()`，
 * 而 resume 的 5xx 说明 run resource 本身有问题，退避只会把同一个错误重放 N 次。
 * 真需要放宽，改这里一处，不要在调用点上传 `retryable: true`。
 */
const RETRYABLE_KINDS: ReadonlySet<AgentErrorKind> = new Set<AgentErrorKind>([
  "network",
]);

export function isRetryableKind(kind: AgentErrorKind): boolean {
  return RETRYABLE_KINDS.has(kind);
}

export class AgentStreamError extends Error {
  readonly kind: AgentErrorKind;
  readonly retryable: boolean;

  constructor(
    kind: AgentErrorKind,
    message: string,
    options?: { cause?: unknown; retryable?: boolean },
  ) {
    super(
      message,
      options?.cause === undefined ? undefined : { cause: options.cause },
    );
    this.name = "AgentStreamError";
    this.kind = kind;
    this.retryable = options?.retryable ?? isRetryableKind(kind);
  }
}

/**
 * 把任意 thrown 值收敛成 `AgentStreamError`。
 *
 * `AbortError` 走 `abort` 而不是 `network`：两者都是「读到一半没了」，但一个是
 * 我们自己叫停的、另一个不是，混在一起会让 abort 触发自动重连——正好是 08
 * §硬规则 7「cancel 与 stream abort 分开」要防的事。
 */
export function toAgentStreamError(
  error: unknown,
  fallbackKind: AgentErrorKind = "unknown",
): AgentStreamError {
  if (error instanceof AgentStreamError) return error;

  const name =
    typeof error === "object" && error !== null
      ? String(Reflect.get(error, "name") ?? "")
      : "";
  const message = error instanceof Error ? error.message : String(error);

  if (name === "AbortError") {
    return new AgentStreamError("abort", message || "Stream aborted.", {
      cause: error,
    });
  }
  return new AgentStreamError(fallbackKind, message || "Unknown error.", {
    cause: error,
  });
}
