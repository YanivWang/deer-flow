import type { CanonicalStreamEvent } from "./canonical";
import {
  initialStreamSnapshot,
  reduceStreamSnapshot,
  type StreamSnapshot,
} from "./reducer";

export class ThreadStreamEngine {
  private snapshot: StreamSnapshot = initialStreamSnapshot();
  private listeners = new Set<() => void>();
  private owner = 0;

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
    this.listeners.clear();
  }

  reset(): void {
    this.snapshot = initialStreamSnapshot();
    this.notify();
  }

  startOwner({ reset = true }: { reset?: boolean } = {}): number {
    this.owner += 1;
    if (reset) {
      this.snapshot = initialStreamSnapshot();
      this.notify();
    }
    return this.owner;
  }

  accept(owner: number, event: CanonicalStreamEvent): boolean {
    if (owner !== this.owner) {
      return false;
    }
    this.snapshot = reduceStreamSnapshot(this.snapshot, event);
    this.notify();
    return true;
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
