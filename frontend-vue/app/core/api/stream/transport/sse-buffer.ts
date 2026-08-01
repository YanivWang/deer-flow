export type SseBufferResult = {
  frame: string;
  remaining: string;
};

const FRAME_SEPARATOR = /\r?\n\r?\n/;

export function readNextSseFrame(buffer: string): SseBufferResult | undefined {
  const match = FRAME_SEPARATOR.exec(buffer);
  if (!match || match.index < 0) {
    return undefined;
  }

  const separatorLength = match[0].length;
  return {
    frame: buffer.slice(0, match.index),
    remaining: buffer.slice(match.index + separatorLength),
  };
}

export function flushSseRemainder(buffer: string): string | undefined {
  const trimmed = buffer.replace(/\r?\n$/, "");
  return trimmed.length > 0 ? trimmed : undefined;
}
