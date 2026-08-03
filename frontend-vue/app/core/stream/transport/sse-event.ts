export type ParsedSseEvent = {
  event: string;
  data: string;
  id?: string;
};

export type SseFrame =
  | { kind: "event"; event: ParsedSseEvent }
  | { kind: "heartbeat"; comment: string };
