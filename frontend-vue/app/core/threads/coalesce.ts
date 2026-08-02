export const STREAM_RENDER_COALESCE_MS = 80;

export type CoalesceDecision = {
  shouldFlush: boolean;
  delayMs: number;
};

export function decideCoalesce(
  now: number,
  lastFlushAt: number | undefined,
  hasPendingUpdate: boolean,
): CoalesceDecision {
  if (!hasPendingUpdate) {
    return { delayMs: 0, shouldFlush: false };
  }

  if (lastFlushAt === undefined) {
    return { delayMs: 0, shouldFlush: true };
  }

  const elapsed = Math.max(0, now - lastFlushAt);
  if (elapsed >= STREAM_RENDER_COALESCE_MS) {
    return { delayMs: 0, shouldFlush: true };
  }

  return {
    delayMs: STREAM_RENDER_COALESCE_MS - elapsed,
    shouldFlush: false,
  };
}
