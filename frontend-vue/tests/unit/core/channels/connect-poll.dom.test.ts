/*
  【文件职责】     保留 React baseline poll cases，并固定 Vue WP-08 的到期即停语义。
  【架构位置】     L3 hand-maintained baseline adaptation
  【主要导出】     无；Vitest cases
  【依赖关系】     core/channels/connect-poll
  【边界与注意】   已登记 HAND_MAINTAINED；deadline 到达后不得再发一个无意义请求。
*/

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { startConnectionPoll } from "@/core/channels/connect-poll";
import type { ChannelConnection } from "@/core/channels/types";

function connection(provider: string, status: string): ChannelConnection {
  return {
    id: `${provider}-1`,
    provider,
    status,
    scopes: [],
    metadata: {},
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("startConnectionPoll", () => {
  test("polls connections until the provider is connected, then resolves once", async () => {
    const responses: ChannelConnection[][] = [
      [connection("telegram", "pending")],
      [connection("telegram", "connected")],
    ];
    const fetchConnections = vi.fn(async () => responses.shift() ?? []);
    const onConnected = vi.fn();

    startConnectionPoll({
      provider: "telegram",
      expiresInSeconds: 600,
      fetchConnections,
      onConnected,
      intervalMs: 1000,
    });

    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchConnections).toHaveBeenCalledTimes(1);
    expect(onConnected).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchConnections).toHaveBeenCalledTimes(2);
    expect(onConnected).toHaveBeenCalledTimes(1);

    // No further polling after the connection resolves.
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchConnections).toHaveBeenCalledTimes(2);
  });

  test("cancel() stops scheduled polling and fires no further fetches", async () => {
    const fetchConnections = vi.fn(async () => [
      connection("telegram", "pending"),
    ]);
    const handle = startConnectionPoll({
      provider: "telegram",
      expiresInSeconds: 600,
      fetchConnections,
      onConnected: vi.fn(),
      intervalMs: 1000,
    });

    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchConnections).toHaveBeenCalledTimes(1);

    handle.cancel();
    await vi.advanceTimersByTimeAsync(10000);
    expect(fetchConnections).toHaveBeenCalledTimes(1);
  });

  test("a non-finite expires_in falls back to a finite deadline and terminates", async () => {
    const fetchConnections = vi.fn(async () => [
      connection("telegram", "pending"),
    ]);
    let nowValue = 0;
    const onExpired = vi.fn();
    startConnectionPoll({
      provider: "telegram",
      expiresInSeconds: Number.NaN,
      fetchConnections,
      onConnected: vi.fn(),
      onExpired,
      intervalMs: 1000,
      now: () => nowValue,
    });

    nowValue = 1;
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchConnections).toHaveBeenCalledTimes(1);

    // Jump past the fallback expiry window: the loop must stop instead of
    // running forever (Date.now() >= NaN would otherwise never be true).
    nowValue = 10_000_000;
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchConnections).toHaveBeenCalledTimes(1);
    expect(onExpired).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(10000);
    expect(fetchConnections).toHaveBeenCalledTimes(1);
    expect(onExpired).toHaveBeenCalledTimes(1);
  });
});
