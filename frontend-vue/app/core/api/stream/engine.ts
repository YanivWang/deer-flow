import type { CanonicalStreamEvent } from "./canonical";
import { decideCoalesce, STREAM_RENDER_COALESCE_MS } from "../../threads/coalesce";
import {
  initialStreamSnapshot,
  reduceStreamSnapshot,
  type StreamSnapshot,
} from "./reducer";

export class ThreadStreamEngine {
  private snapshot: StreamSnapshot = initialStreamSnapshot();
  private listeners = new Set<() => void>();
  private owner = 0;
  private lastFlushAt: number | undefined;
  private notificationTimer: ReturnType<typeof setTimeout> | undefined;
  private hasPendingNotification = false;

  getSnapshot(): StreamSnapshot {
    return this.snapshot;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose(): void {
    this.owner += 1;
    this.clearNotificationTimer();
    this.listeners.clear();
  }

  reset(): void {
    this.snapshot = initialStreamSnapshot();
    this.notifyImmediately();
  }

  startOwner({ reset = true }: { reset?: boolean } = {}): number {
    this.owner += 1;
    if (reset) {
      this.snapshot = initialStreamSnapshot();
      this.notifyImmediately();
    }
    return this.owner;
  }

  accept(owner: number, event: CanonicalStreamEvent): boolean {
    if (owner !== this.owner) {
      return false;
    }
    this.snapshot = reduceStreamSnapshot(this.snapshot, event);
    if (event.type === "done" || event.type === "error" || event.type === "aborted") {
      this.notifyImmediately();
    } else {
      this.scheduleNotification();
    }
    return true;
  }

  flush(): void {
    if (!this.hasPendingNotification) {
      return;
    }
    this.clearNotificationTimer();
    this.notifyImmediately();
  }

  private scheduleNotification(): void {
    if (this.hasPendingNotification) {
      return;
    }

    this.hasPendingNotification = true;
    const decision = decideCoalesce(Date.now(), this.lastFlushAt, true);
    if (decision.shouldFlush) {
      this.notifyImmediately();
      return;
    }

    this.notificationTimer = setTimeout(() => {
      this.notificationTimer = undefined;
      const next = decideCoalesce(Date.now(), this.lastFlushAt, this.hasPendingNotification);
      if (next.shouldFlush) {
        this.notifyImmediately();
        return;
      }
      this.notificationTimer = setTimeout(() => this.notifyImmediately(), Math.max(next.delayMs, STREAM_RENDER_COALESCE_MS));
    }, Math.max(decision.delayMs, STREAM_RENDER_COALESCE_MS));
  }

  private notifyImmediately(): void {
    this.clearNotificationTimer();
    this.hasPendingNotification = false;
    this.lastFlushAt = Date.now();
    for (const listener of this.listeners) {
      listener();
    }
  }

  private clearNotificationTimer(): void {
    if (this.notificationTimer !== undefined) {
      clearTimeout(this.notificationTimer);
      this.notificationTimer = undefined;
    }
  }
}
