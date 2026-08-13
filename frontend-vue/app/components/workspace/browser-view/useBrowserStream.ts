/*
  【文件职责】     管理 browser-view WebSocket 生命周期、状态和输入转发。
  【对应 frontend/】 src/components/workspace/browser-view/hooks.ts
  【架构位置】     L3
  【主要导出】     useBrowserStream
  【依赖关系】     browser-api · frame-buffer · Vue lifecycle
  【边界与注意】   每个面板独立实例；不得变成模块级连接单例。
*/

import { onBeforeUnmount, ref, watch, type Ref } from "vue";

import { browserStreamURL } from "./browser-api";
import { LatestBrowserFrameBuffer } from "./frame-buffer";

export type BrowserInputEvent =
  | { type: "click"; nx: number; ny: number }
  | { type: "move"; nx: number; ny: number }
  | { type: "wheel"; dx: number; dy: number; nx?: number; ny?: number }
  | { type: "key"; key: string }
  | { type: "text"; text: string }
  | { type: "navigate"; url: string }
  | { type: "back" | "forward" }
  | { type: "activate_tab"; index: number };

export function useBrowserStream(
  threadId: Ref<string>,
  enabled: Ref<boolean>,
  seedUrl?: Ref<string | undefined>,
) {
  const status = ref<"idle" | "connecting" | "open" | "closed">("idle");
  const frameUrl = ref<string | null>(null);
  const liveUrl = ref<string | null>(null);
  const tabs = ref<
    Array<{ index: number; title: string; url: string; active: boolean }>
  >([]);
  const error = ref<string | null>(null);
  const buffer = new LatestBrowserFrameBuffer((url) => (frameUrl.value = url));
  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let attempts = 0;

  function sendInput(event: BrowserInputEvent) {
    if (socket?.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(event));
    return true;
  }

  function close() {
    clearTimeout(reconnectTimer);
    socket?.close();
    socket = null;
    buffer.dispose();
    status.value = "idle";
  }

  function connect() {
    close();
    if (!enabled.value || !threadId.value) return;
    status.value = "connecting";
    const current = new WebSocket(
      browserStreamURL(threadId.value, seedUrl?.value),
    );
    socket = current;
    current.binaryType = "blob";
    current.onopen = () => {
      attempts = 0;
      status.value = "open";
    };
    current.onmessage = (message) => {
      if (message.data instanceof Blob) {
        buffer.push(
          message.data.type === "image/jpeg"
            ? message.data
            : new Blob([message.data], { type: "image/jpeg" }),
        );
        return;
      }
      if (message.data instanceof ArrayBuffer) {
        buffer.push(new Blob([message.data], { type: "image/jpeg" }));
        return;
      }
      if (typeof message.data !== "string") return;
      try {
        const payload = JSON.parse(message.data) as {
          type?: string;
          data?: string;
          url?: string;
          message?: string;
          tabs?: typeof tabs.value;
        };
        if (payload.type === "frame" && payload.data)
          buffer.replaceWithUrl(`data:image/jpeg;base64,${payload.data}`);
        else if (payload.type === "url" && payload.url)
          liveUrl.value = payload.url;
        else if (payload.type === "tabs" && payload.tabs)
          tabs.value = payload.tabs;
        else if (payload.type === "nav_rejected")
          error.value = payload.message ?? "Navigation rejected";
      } catch {
        // Malformed control frames are ignored; binary frames remain independent.
      }
    };
    current.onclose = () => {
      if (socket !== current || !enabled.value) return;
      status.value = "closed";
      if (attempts >= 6) return;
      const delay = Math.min(800 * 2 ** attempts++, 10_000);
      reconnectTimer = setTimeout(connect, delay);
    };
    current.onerror = () => {
      if (socket === current) status.value = "closed";
    };
  }

  watch([threadId, enabled], connect, { immediate: true });
  watch(
    () => seedUrl?.value,
    (next) => {
      if (next && status.value === "open" && next !== liveUrl.value)
        sendInput({ type: "navigate", url: next });
    },
  );
  onBeforeUnmount(close);
  return { status, frameUrl, liveUrl, tabs, error, sendInput };
}
