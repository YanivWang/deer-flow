/*
  【文件职责】     DeerFlow Gateway 的 run 相关 URL 与 run handle 解析。
  【架构位置】     L3
  【主要导出】     DeerFlowRunHandle · parseRunHandle · runStreamUrl
                   runResumeUrl · runCancelUrl · runResourceUrl
  【依赖关系】     无
  【边界与注意】   endpoint 只能出现在这一层。内核里出现 `/api/` 路径会被
                   tests/architecture.test.ts 当场拦下——那条规则存在的理由就是
                   这个文件：把 URL 拼装收在一处，内核才可能被别的后端复用。

                   **`Content-Location` 与 `Location` 不是一回事（05 L12）。**
                   上游 SDK 的 metadata 提取读前者、reconnect helper 找后者，
                   两个 header 被当成等价的；M0 实测 Gateway **只发前者**，
                   Location 根本不存在。所以这里只认 Content-Location，
                   缺了就返回 null 让调用方 fail closed，不去猜另一个 header。
*/

export interface DeerFlowRunHandle {
  threadId: string;
  runId: string;
}

/**
 * Gateway 在 create 响应里给的是**内部路径** `/api/threads/{tid}/runs/{rid}`，
 * 不带 `/langgraph` 段。它是 run 的 durable 标识来源，不是可以直接请求的地址——
 * 对外请求要用下面几个 builder 重新拼，前缀是 `/api/langgraph`。
 */
const CONTENT_LOCATION = /^\/api\/threads\/([^/]+)\/runs\/([^/]+)\/?$/;

export function parseRunHandle(
  contentLocation: string | null | undefined,
): DeerFlowRunHandle | null {
  if (!contentLocation) return null;
  const match = CONTENT_LOCATION.exec(contentLocation);
  const threadId = match?.[1];
  const runId = match?.[2];
  if (!threadId || !runId) return null;
  return { threadId, runId };
}

const trimEnd = (base: string) => base.replace(/\/+$/, "");

/** create：POST。整个协议里唯一一个不带 runId 的地址——run 还不存在。 */
export function runStreamUrl(base: string, threadId: string): string {
  return `${trimEnd(base)}/threads/${encodeURIComponent(threadId)}/runs/stream`;
}

/** resume/join：GET，带 `Last-Event-ID`。 */
export function runResumeUrl(base: string, handle: DeerFlowRunHandle): string {
  return `${runResourceUrl(base, handle)}/stream`;
}

/**
 * cancel：POST。
 *
 * `action` 与 `wait` 都显式写出来（08 §DeerFlow RunProtocol 的已知映射）。
 * 依赖服务端默认值意味着默认值一变，客户端的停止语义跟着变而没人察觉。
 */
export function runCancelUrl(base: string, handle: DeerFlowRunHandle): string {
  return `${runResourceUrl(base, handle)}/cancel?wait=true&action=interrupt`;
}

/** inspect：GET durable run resource。**不带** `/stream`。 */
export function runResourceUrl(
  base: string,
  handle: DeerFlowRunHandle,
): string {
  return (
    `${trimEnd(base)}/threads/${encodeURIComponent(handle.threadId)}` +
    `/runs/${encodeURIComponent(handle.runId)}`
  );
}
