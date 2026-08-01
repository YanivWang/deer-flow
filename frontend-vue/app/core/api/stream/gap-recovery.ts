export const MAX_STREAM_GAP_RECOVERIES = 5;

export function canRecoverGap(attempts: number): boolean {
  return attempts < MAX_STREAM_GAP_RECOVERIES;
}
