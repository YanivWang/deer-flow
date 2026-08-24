/*
  【文件职责】     在有限 bind window 内观察用户 connections，直到新 instance 成功或到期。
  【架构位置】     L3 channel lifecycle
  【主要导出】     startConnectionPoll · normalizeConnectExpiresSeconds
  【依赖关系】     ./types · AbortController · timers
  【边界与注意】   已存在账号不完成新绑定；cancel 必须 abort 在途请求且抑制 late result。
*/

import type { ChannelConnection, ChannelProviderId } from "./types";

export const CONNECT_POLL_INTERVAL_MS = 2000;
// Fallback bind window used when the backend response omits or garbles
// `expires_in`, so a non-finite value can never produce an unbounded poll loop.
const DEFAULT_CONNECT_EXPIRES_S = 600;
const MAX_CONNECT_EXPIRES_S = 3600;

export interface ConnectPollHandle {
  cancel: () => void;
}

export interface ConnectPollOptions {
  provider: ChannelProviderId;
  /** Already-connected rows must not complete a new multi-account bind. */
  ignoreConnectedIds?: ReadonlySet<string>;
  expiresInSeconds: number;
  /** Fetch the latest connections — the single source of truth for "connected". */
  fetchConnections: (signal: AbortSignal) => Promise<ChannelConnection[]>;
  /** Invoked once when the provider's connection resolves to "connected". */
  onConnected: () => void;
  /** Receives each authoritative connections snapshot before status matching. */
  onObserved?: (connections: ChannelConnection[]) => void;
  /** Invoked once when the finite backend bind window elapses. */
  onExpired?: () => void;
  intervalMs?: number;
  now?: () => number;
}

export function normalizeConnectExpiresSeconds(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_CONNECT_EXPIRES_S;
  }
  return Math.min(value, MAX_CONNECT_EXPIRES_S);
}

/**
 * Poll the connections endpoint until the given provider reports `connected`
 * or the bind window elapses. Returns a handle whose `cancel()` stops the loop
 * (used to dedup repeated connects and to clean up on unmount).
 *
 * Only the connections endpoint is polled; `onConnected` lets the caller refresh
 * derived provider state exactly once when the bind lands, instead of fetching
 * both endpoints on every tick.
 */
export function startConnectionPoll(
  options: ConnectPollOptions,
): ConnectPollHandle {
  const {
    provider,
    ignoreConnectedIds = new Set<string>(),
    expiresInSeconds,
    fetchConnections,
    onConnected,
    onObserved = () => undefined,
    onExpired = () => undefined,
    intervalMs = CONNECT_POLL_INTERVAL_MS,
    now = Date.now,
  } = options;

  const expires = normalizeConnectExpiresSeconds(expiresInSeconds);
  const deadline = now() + expires * 1000;

  let timer: ReturnType<typeof setTimeout> | undefined;
  let requestController: AbortController | undefined;
  let cancelled = false;
  let settled = false;

  const cancel = () => {
    cancelled = true;
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    requestController?.abort();
    requestController = undefined;
  };

  const expire = () => {
    if (cancelled || settled) return;
    settled = true;
    onExpired();
  };

  const schedule = () => {
    timer = setTimeout(() => {
      timer = undefined;
      if (cancelled) {
        return;
      }
      if (now() >= deadline) {
        expire();
        return;
      }
      const controller = new AbortController();
      requestController = controller;
      void fetchConnections(controller.signal)
        .then((connections) => {
          if (cancelled || controller.signal.aborted || settled) {
            return;
          }
          onObserved(connections);
          const connected = connections.some(
            (item) =>
              item.provider === provider &&
              item.status === "connected" &&
              !ignoreConnectedIds.has(item.id),
          );
          if (connected) {
            settled = true;
            onConnected();
            return;
          }
          if (now() < deadline) {
            schedule();
          } else {
            expire();
          }
        })
        .catch(() => {
          if (cancelled || controller.signal.aborted || settled) return;
          if (now() < deadline) {
            schedule();
          } else {
            expire();
          }
        })
        .finally(() => {
          if (requestController === controller) {
            requestController = undefined;
          }
        });
    }, intervalMs);
  };

  schedule();
  return { cancel };
}
