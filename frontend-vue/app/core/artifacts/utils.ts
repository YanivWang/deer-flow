/*
  【文件职责】     见下方源码；本文件由 frontend/src/core/artifacts/utils.ts retype 而来。
  【对应 frontend/】 frontend/src/core/artifacts/utils.ts
  【架构位置】     L3
  【主要导出】     buildWriteFileArtifactURL / urlOfArtifact / extractArtifactsFromThread / resolveArtifactURL / resolveMarkdownArtifactURL / resolveMessageImageURL
  【依赖关系】     见下方 import；改写清单由 scripts/land-retyped.mjs 声明
  【边界与注意】   RETYPED：内容**不是**上游逐字节等同，因此不参与 COPIED hash 护城河。
                   相对上游的改动只有这些：依赖不迁的模块（static-mode.ts），该 import 必须删除或改写。删掉 isStaticWebsiteOnly 早返回与随之无消费方的 staticDemoArtifactURL。
                   勿手改——`make land-retyped-check` 会红；确需手改就登记进
                   land-retyped.mjs 的 HAND_MAINTAINED 并写明理由。
*/

import { getBackendBaseURL } from "../config";
import type { AgentThreadState } from "../threads";

const EMPTY_ARTIFACT_PATHS: readonly string[] = [];

function decodePathSegment(segment: string) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function splitPathSuffix(src: string) {
  const [path = ""] = src.split(/[?#]/, 1);
  return {
    path,
    suffix: src.slice(path.length),
  };
}

function encodeArtifactPath(filepath: string) {
  return filepath
    .split("/")
    .map((segment) => encodeURIComponent(decodePathSegment(segment)))
    .join("/");
}

export function buildWriteFileArtifactURL({
  filepath,
  messageId,
  toolCallId,
}: {
  filepath: string;
  messageId?: string;
  toolCallId?: string;
}) {
  const url = new URL("write-file:/");
  url.pathname = filepath.replaceAll("%", "%25");
  if (messageId) {
    url.searchParams.set("message_id", messageId);
  }
  if (toolCallId) {
    url.searchParams.set("tool_call_id", toolCallId);
  }
  return url.toString();
}

function decodeRelativeArtifactPath(filepath: string) {
  return filepath.split("/").map(decodePathSegment).join("/");
}

function normalizeMessageImagePath(src: string) {
  const { path: relativePath, suffix } = splitPathSuffix(src);
  const normalizedPath = relativePath.replace(/^(?:\.\/)+/, "");
  if (
    !normalizedPath ||
    normalizedPath.startsWith("/") ||
    /^[a-z][a-z\d+.-]*:/i.test(normalizedPath) ||
    normalizedPath.startsWith("//") ||
    normalizedPath.split("/").includes("..")
  ) {
    return null;
  }
  return {
    normalizedPath,
    decodedNormalizedPath: decodeRelativeArtifactPath(normalizedPath),
    suffix,
  };
}

export function urlOfArtifact({
  filepath,
  threadId,
  download = false,
  isMock = false,
}: {
  filepath: string;
  threadId: string;
  download?: boolean;
  isMock?: boolean;
}) {
  const encodedThreadId = encodeURIComponent(threadId);
  const encodedFilepath = encodeArtifactPath(filepath);
  if (isMock) {
    return `${getBackendBaseURL()}/mock/api/threads/${encodedThreadId}/artifacts${encodedFilepath}${download ? "?download=true" : ""}`;
  }
  return `${getBackendBaseURL()}/api/threads/${encodedThreadId}/artifacts${encodedFilepath}${download ? "?download=true" : ""}`;
}

export function extractArtifactsFromThread(thread: {
  values: Pick<AgentThreadState, "artifacts">;
}) {
  return thread.values.artifacts ?? EMPTY_ARTIFACT_PATHS;
}

export function resolveArtifactURL(
  absolutePath: string,
  threadId: string,
  options: { isMock?: boolean } = {},
) {
  if (options.isMock) {
    return urlOfArtifact({ filepath: absolutePath, threadId, isMock: true });
  }
  return `${getBackendBaseURL()}/api/threads/${encodeURIComponent(threadId)}/artifacts${encodeArtifactPath(absolutePath)}`;
}

export function resolveMarkdownArtifactURL(
  src: string,
  threadId: string,
  options: { isMock?: boolean } = {},
) {
  const { path, suffix } = splitPathSuffix(src);
  return `${resolveArtifactURL(path, threadId, options)}${suffix}`;
}

export function resolveMessageImageURL(
  src: string,
  threadId: string,
  artifactPaths: readonly string[],
  options: { fallbackToOutputs?: boolean; isMock?: boolean } = {},
) {
  if (src.startsWith("/mnt/")) {
    return resolveMarkdownArtifactURL(src, threadId, options);
  }

  const imagePath = normalizeMessageImagePath(src);
  if (imagePath === null) {
    return src;
  }

  const matches = artifactPaths.filter((path) =>
    path.endsWith(`/${imagePath.decodedNormalizedPath}`),
  );
  if (matches.length === 1) {
    return `${resolveArtifactURL(matches[0]!, threadId, options)}${imagePath.suffix}`;
  }

  if (!options.fallbackToOutputs) {
    return src;
  }

  return `${resolveArtifactURL(
    `/mnt/user-data/outputs/${imagePath.decodedNormalizedPath}`,
    threadId,
    options,
  )}${imagePath.suffix}`;
}
