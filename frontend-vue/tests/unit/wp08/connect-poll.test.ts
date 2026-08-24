/*
  【文件职责】     固定 channel connect poll 的成功、过期、异常 expires 与取消清理。
  【架构位置】     WP-08 纯生命周期测试
  【主要导出】     无；Vitest cases
  【依赖关系】     core/channels/connect-poll
  【边界与注意】   cancel 必须 abort 在途请求；非法 expires 也必须落到有限 deadline。
*/

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  normalizeConnectExpiresSeconds,
  startConnectionPoll,
} from "@/core/channels/connect-poll";
import type { ChannelConnection } from "@/core/channels/types";

function row(status: string): ChannelConnection {
  return {
    id: "connection-a",
    provider: "slack",
    status,
    scopes: [],
    metadata: {},
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("connect poll lifecycle", () => {
  it("stops after success and aborts no completed request", async () => {
    const fetchConnections = vi
      .fn<(signal: AbortSignal) => Promise<ChannelConnection[]>>()
      .mockResolvedValueOnce([row("pending")])
      .mockResolvedValueOnce([row("connected")]);
    const onConnected = vi.fn();
    const onExpired = vi.fn();

    startConnectionPoll({
      provider: "slack",
      expiresInSeconds: 30,
      fetchConnections,
      onConnected,
      onExpired,
      intervalMs: 1000,
    });

    await vi.advanceTimersByTimeAsync(2000);
    expect(fetchConnections).toHaveBeenCalledTimes(2);
    expect(fetchConnections.mock.calls[0]?.[0]).toBeInstanceOf(AbortSignal);
    expect(onConnected).toHaveBeenCalledTimes(1);
    expect(onExpired).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchConnections).toHaveBeenCalledTimes(2);
  });

  it("does not let an existing account complete a new multi-account bind", async () => {
    const fetchConnections = vi
      .fn<(signal: AbortSignal) => Promise<ChannelConnection[]>>()
      .mockResolvedValueOnce([row("connected")])
      .mockResolvedValueOnce([
        row("connected"),
        { ...row("connected"), id: "connection-b" },
      ]);
    const onConnected = vi.fn();

    startConnectionPoll({
      provider: "slack",
      expiresInSeconds: 30,
      ignoreConnectedIds: new Set(["connection-a"]),
      fetchConnections,
      onConnected,
      intervalMs: 1000,
    });

    await vi.advanceTimersByTimeAsync(1000);
    expect(onConnected).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(onConnected).toHaveBeenCalledTimes(1);
  });

  it("reports expiry once without scheduling a post-deadline request", async () => {
    let now = 0;
    const fetchConnections = vi.fn(async () => [row("pending")]);
    const onExpired = vi.fn();

    startConnectionPoll({
      provider: "slack",
      expiresInSeconds: 2,
      fetchConnections,
      onConnected: vi.fn(),
      onExpired,
      intervalMs: 1000,
      now: () => now,
    });

    now = 1000;
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchConnections).toHaveBeenCalledTimes(1);
    now = 2000;
    await vi.advanceTimersByTimeAsync(1000);

    expect(fetchConnections).toHaveBeenCalledTimes(1);
    expect(onExpired).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it("normalizes negative, non-finite and enormous expires to a finite bound", () => {
    for (const value of [-1, Number.NaN, Number.POSITIVE_INFINITY, 1e300]) {
      const normalized = normalizeConnectExpiresSeconds(value);
      expect(Number.isFinite(normalized)).toBe(true);
      expect(normalized).toBeGreaterThan(0);
      expect(normalized).toBeLessThanOrEqual(3600);
    }
  });

  it("cancel aborts an in-flight observer and ignores its late result", async () => {
    let resolve!: (rows: ChannelConnection[]) => void;
    let observedSignal: AbortSignal | undefined;
    const fetchConnections = vi.fn((signal: AbortSignal) => {
      observedSignal = signal;
      return new Promise<ChannelConnection[]>((done) => {
        resolve = done;
      });
    });
    const onConnected = vi.fn();
    const onExpired = vi.fn();
    const handle = startConnectionPoll({
      provider: "slack",
      expiresInSeconds: 30,
      fetchConnections,
      onConnected,
      onExpired,
      intervalMs: 1000,
    });

    await vi.advanceTimersByTimeAsync(1000);
    expect(observedSignal?.aborted).toBe(false);
    handle.cancel();
    expect(observedSignal?.aborted).toBe(true);
    resolve([row("connected")]);
    await Promise.resolve();
    await Promise.resolve();

    expect(onConnected).not.toHaveBeenCalled();
    expect(onExpired).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
