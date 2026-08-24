/*
  【文件职责】     WP-06 有界加载正式 UTF-8 artifact，并保留 Gateway 错误与 revision。
  【架构位置】     L3
  【主要导出】     ARTIFACT_PREVIEW_MAX_BYTES / loadArtifactContent / loadArtifactContentFromToolCall
  【依赖关系】     见下方 import。
  【边界与注意】   ADAPTED：只有显式 text policy 可调用；.skill/未知/二进制没有兼容分支。
*/

import type { BaseStream } from "@/core/types/message";
import { fetch } from "@/core/api/fetcher";

import type { AgentThreadState } from "../threads";

import { buildWriteFileDraftContent } from "./preview";
import { urlOfArtifact } from "./utils";

async function sha256OfText(content: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(content),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export const ARTIFACT_PREVIEW_MAX_BYTES = 1024 * 1024;

function parseContentRange(value: string | null) {
  const match = value?.match(/^bytes (?:(\d+)-(\d+)|\*)\/(\d+)$/);
  if (!match) return undefined;
  return {
    end: match[2] === undefined ? undefined : Number(match[2]),
    total: Number(match[3]),
  };
}

export async function loadArtifactContent({
  filepath,
  threadId,
  isMock,
  full = false,
  signal,
}: {
  filepath: string;
  threadId: string;
  isMock?: boolean;
  full?: boolean;
  signal?: AbortSignal;
}) {
  const url = urlOfArtifact({ filepath, threadId, isMock });
  const response = await fetch(url, {
    cache: "no-store",
    headers: full
      ? undefined
      : { Range: `bytes=0-${ARTIFACT_PREVIEW_MAX_BYTES - 1}` },
    signal,
  });
  const contentRange = parseContentRange(response.headers.get("Content-Range"));
  if (response.status === 416 && contentRange?.total === 0) {
    return {
      content: "",
      url,
      truncated: false,
      previewBytes: 0,
      totalBytes: 0,
      sha256: await sha256OfText(""),
    };
  }
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as {
      detail?: unknown;
    };
    const detail =
      typeof data.detail === "string"
        ? data.detail
        : `HTTP ${response.status}: ${response.statusText}`;
    throw new Error(detail);
  }

  const bytes = await response.arrayBuffer();
  const truncated =
    !full &&
    response.status === 206 &&
    (contentRange?.end === undefined ||
      contentRange.total > contentRange.end + 1);
  // Streaming decode intentionally holds an incomplete trailing UTF-8 code
  // point instead of fabricating U+FFFD at the range boundary.
  const content = new TextDecoder().decode(bytes, { stream: truncated });
  const etag = response.headers.get("etag");
  const sha256 =
    etag?.match(/^"([0-9a-f]{64})"$/)?.[1] ??
    (!truncated ? await sha256OfText(content) : undefined);
  const contentLengthHeader = response.headers.get("Content-Length");
  const contentLength =
    contentLengthHeader === null ? undefined : Number(contentLengthHeader);
  return {
    content,
    url,
    sha256,
    truncated,
    previewBytes: bytes.byteLength,
    totalBytes:
      contentRange?.total ??
      (contentLength !== undefined && Number.isFinite(contentLength)
        ? contentLength
        : undefined),
  };
}

export function loadArtifactContentFromToolCall({
  url: urlString,
  thread,
}: {
  url: string;
  thread: BaseStream<AgentThreadState>;
}) {
  const draftContent = buildWriteFileDraftContent({
    filepath: urlString,
    messages: thread.messages,
  });
  if (draftContent !== undefined) {
    return draftContent;
  }

  const url = new URL(urlString);
  const toolCallId = url.searchParams.get("tool_call_id");
  const messageId = url.searchParams.get("message_id");
  if (messageId && toolCallId) {
    const message = thread.messages.find((message) => message.id === messageId);
    if (message?.type === "ai" && message.tool_calls) {
      const toolCall = message.tool_calls.find(
        (toolCall) => toolCall.id === toolCallId,
      );
      if (toolCall) {
        return toolCall.args.content;
      }
    }
  }
}
