import { onBeforeUnmount, ref, watch } from "vue";
import { browserStreamUrl } from "../../../core/api/browser/client";
import type { BrowserFrame, BrowserTab } from "../../../core/api/browser/client";

export type BrowserInputEvent =
  | { type: "click"; nx: number; ny: number }
  | { type: "move"; nx: number; ny: number }
  | { type: "down"; nx: number; ny: number }
  | { type: "up"; nx: number; ny: number }
  | { type: "wheel"; dx: number; dy: number; nx?: number; ny?: number }
  | { type: "key"; key: string }
  | { type: "text"; text: string }
  | { type: "navigate"; url: string }
  | { type: "back" }
  | { type: "forward" }
  | { type: "activate_tab"; index: number };

export type BrowserStreamStatus = "idle" | "connecting" | "open" | "closed";

type BrowserSocketMessage =
  | { type: "frame"; data: string }
  | { type: "url"; url: string }
  | { type: "tabs"; tabs: BrowserTab[] }
  | { type: "nav_rejected"; url?: string; message?: string };

const reconnectBaseDelay = 800;
const reconnectMaxDelay = 10_000;
const reconnectMaxAttempts = 6;

function normalizeSeedUrl(url: string | null | undefined): string {
  return (url ?? "").split("#", 1)[0]?.replace(/\/+$/, "") ?? "";
}

export function parseBrowserSocketMessage(raw: string): BrowserSocketMessage | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null || !("type" in value)) return null;
    if (value.type === "frame" && "data" in value && typeof value.data === "string") {
      return { type: "frame", data: value.data };
    }
    if (value.type === "url" && "url" in value && typeof value.url === "string") {
      return { type: "url", url: value.url };
    }
    if (value.type === "tabs" && "tabs" in value && Array.isArray(value.tabs)) {
      const tabs = value.tabs.flatMap((tab) => {
        if (typeof tab !== "object" || tab === null) return [];
        const index = Reflect.get(tab, "index");
        const title = Reflect.get(tab, "title");
        const url = Reflect.get(tab, "url");
        const active = Reflect.get(tab, "active");
        return typeof index === "number" && typeof title === "string" && typeof url === "string" && typeof active === "boolean"
          ? [{ index, title, url, active }]
          : [];
      });
      return { type: "tabs", tabs };
    }
    if (value.type === "nav_rejected") {
      return {
        type: "nav_rejected",
        url: "url" in value && typeof value.url === "string" ? value.url : undefined,
        message: "message" in value && typeof value.message === "string" ? value.message : undefined,
      };
    }
  } catch {
    // A malformed frame must not tear down a live browser session.
  }
  return null;
}

export function useBrowserStream(
  threadId: Readonly<Ref<string>>,
  enabled: Readonly<Ref<boolean>>,
  seedUrl: Readonly<Ref<string | undefined>>,
  onNavigationRejected: (url: string | undefined, message: string | undefined) => void,
) {
  const status = ref<BrowserStreamStatus>("idle");
  const frameUrl = ref<string | null>(null);
  const liveUrl = ref<string | null>(null);
  const latestFrame = ref<BrowserFrame | null>(null);
  const tabs = ref<BrowserTab[]>([]);
  const connectionAttempt = ref(0);
  const socket = ref<WebSocket | null>(null);
  const pendingNavigate = ref<Extract<BrowserInputEvent, { type: "navigate" }> | null>(null);
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function sendInput(event: BrowserInputEvent): boolean {
    if (socket.value?.readyState === WebSocket.OPEN) {
      socket.value.send(JSON.stringify(event));
      return true;
    }
    if (event.type === "navigate") pendingNavigate.value = event;
    return false;
  }

  function closeSocket(): void {
    if (reconnectTimer !== null) clearTimeout(reconnectTimer);
    reconnectTimer = null;
    socket.value?.close();
    socket.value = null;
  }

  function scheduleReconnect(): void {
    if (!enabled.value || reconnectTimer !== null || connectionAttempt.value >= reconnectMaxAttempts) return;
    const delay = Math.min(reconnectBaseDelay * 2 ** connectionAttempt.value, reconnectMaxDelay);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connectionAttempt.value += 1;
    }, delay);
  }

  watch([enabled, threadId, connectionAttempt], ([isEnabled, id], _oldValue, onCleanup) => {
    closeSocket();
    if (!isEnabled) {
      status.value = "idle";
      frameUrl.value = null;
      liveUrl.value = null;
      latestFrame.value = null;
      tabs.value = [];
      connectionAttempt.value = 0;
      return;
    }

    status.value = "connecting";
    liveUrl.value = seedUrl.value ?? null;
    const activeSocket = new WebSocket(browserStreamUrl(id, seedUrl.value));
    socket.value = activeSocket;
    let closedByCleanup = false;
    activeSocket.onopen = () => {
      if (pendingNavigate.value) {
        activeSocket.send(JSON.stringify(pendingNavigate.value));
        pendingNavigate.value = null;
      }
      connectionAttempt.value = 0;
      status.value = "open";
    };
    activeSocket.onmessage = async (message: MessageEvent) => {
      const raw = typeof message.data === "string"
        ? message.data
        : message.data instanceof Blob
          ? await message.data.text()
          : message.data instanceof ArrayBuffer
            ? new TextDecoder().decode(message.data)
            : String(message.data);
      if (closedByCleanup) return;
      const payload = parseBrowserSocketMessage(raw);
      if (!payload) return;
      if (payload.type === "frame") {
        frameUrl.value = `data:image/jpeg;base64,${payload.data}`;
        latestFrame.value = { screenshot: frameUrl.value, url: liveUrl.value ?? undefined };
      } else if (payload.type === "url") {
        liveUrl.value = payload.url;
        latestFrame.value = latestFrame.value ? { ...latestFrame.value, url: payload.url } : latestFrame.value;
      } else if (payload.type === "tabs") {
        tabs.value = payload.tabs;
      } else {
        onNavigationRejected(payload.url, payload.message);
      }
    };
    activeSocket.onclose = () => {
      if (!closedByCleanup) {
        status.value = "closed";
        scheduleReconnect();
      }
    };
    activeSocket.onerror = () => {
      if (!closedByCleanup) {
        status.value = "closed";
        scheduleReconnect();
      }
    };
    onCleanup(() => {
      closedByCleanup = true;
      activeSocket.close();
    });
  }, { immediate: true });

  watch([enabled, seedUrl, liveUrl], ([isEnabled, target, current]) => {
    if (!isEnabled || status.value !== "open" || !target || normalizeSeedUrl(target) === normalizeSeedUrl(current)) return;
    sendInput({ type: "navigate", url: target });
  });

  onBeforeUnmount(closeSocket);

  return { frameUrl, latestFrame, liveUrl, sendInput, status, tabs };
}
