/*
  【文件职责】     校验发往 DeerFlow Gateway 的 LangGraph stream mode 白名单。
  【对应 frontend/】 frontend/src/core/api/stream-mode.ts
  【架构位置】     L3 DeerFlow 应用适配层
  【主要导出】     warnUnsupportedStreamModes · sanitizeRunStreamOptions
  【依赖关系】     无
  【边界与注意】   只校验并拒绝不支持的 stream mode，不重写其他请求字段。
                   Vue wire 层负责 camelCase/snake_case 桥接；本文件不进入
                   @deerflow/agent-core，也不承担 HTTP transport。
*/

const SUPPORTED_RUN_STREAM_MODES = new Set([
  "values",
  "messages-tuple",
  "updates",
  "debug",
  "tasks",
  "checkpoints",
  "custom",
] as const);

const warnedUnsupportedStreamModes = new Set<string>();

export function warnUnsupportedStreamModes(
  modes: string[],
  warn: (message: string) => void = console.warn,
) {
  const unseenModes = modes.filter((mode) => {
    if (warnedUnsupportedStreamModes.has(mode)) {
      return false;
    }
    warnedUnsupportedStreamModes.add(mode);
    return true;
  });

  if (unseenModes.length === 0) {
    return;
  }

  warn(
    `[deer-flow] Rejected unsupported LangGraph stream mode(s): ${unseenModes.join(", ")}`,
  );
}

export function sanitizeRunStreamOptions<T>(options: T): T {
  if (typeof options !== "object" || options === null) {
    return options;
  }

  if (!("streamMode" in options)) {
    return options;
  }

  const streamMode = options.streamMode;
  if (streamMode == null) {
    return options;
  }

  const requestedModes = Array.isArray(streamMode) ? streamMode : [streamMode];
  const droppedModes = requestedModes.filter(
    (mode) => !SUPPORTED_RUN_STREAM_MODES.has(mode),
  );
  if (droppedModes.length > 0) {
    warnUnsupportedStreamModes(droppedModes);
    throw new Error(
      `[deer-flow] Unsupported LangGraph stream mode(s): ${droppedModes.join(", ")}`,
    );
  }

  return options;
}
