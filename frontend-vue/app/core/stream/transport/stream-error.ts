export type StreamEngineErrorKind =
  | "abort"
  | "network"
  | "backend"
  | "protocol"
  | "gap";

export class StreamEngineError extends Error {
  constructor(
    readonly kind: StreamEngineErrorKind,
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "StreamEngineError";
  }
}
