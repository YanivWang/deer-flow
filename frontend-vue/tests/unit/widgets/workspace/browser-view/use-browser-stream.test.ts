import { defineComponent, nextTick, ref } from "vue";
import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useBrowserStream } from "../../../../../app/widgets/workspace/browser-view/use-browser-stream";

class FakeWebSocket {
  static readonly OPEN = 1;
  static readonly instances: FakeWebSocket[] = [];
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((message: MessageEvent) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(public readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  send(payload: string): void {
    this.sent.push(payload);
  }

  close(): void {
    this.readyState = 3;
  }

  open(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  receive(payload: unknown): void {
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent);
  }

  drop(): void {
    this.readyState = 3;
    this.onclose?.();
  }
}

describe("useBrowserStream", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeWebSocket.instances.length = 0;
    vi.stubGlobal("WebSocket", FakeWebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("forwards pending navigation, frames, tabs, and controls over the live socket", async () => {
    const enabled = ref(true);
    const host = mount(defineComponent({
      setup() {
        return useBrowserStream(ref("thread-1"), enabled, ref("https://example.com"), vi.fn());
      },
      template: "<div />",
    }));
    await nextTick();
    const socket = FakeWebSocket.instances[0];
    expect(socket?.url).toContain("seed=https%3A%2F%2Fexample.com");
    expect(host.vm.sendInput({ type: "navigate", url: "https://example.org" })).toBe(false);
    socket?.open();
    expect(socket?.sent).toEqual([JSON.stringify({ type: "navigate", url: "https://example.org" })]);
    socket?.receive({ type: "url", url: "https://example.org/" });
    socket?.receive({ type: "tabs", tabs: [{ index: 0, title: "Example", url: "https://example.org/", active: true }] });
    socket?.receive({ type: "frame", data: "jpeg" });
    await nextTick();
    expect(host.vm.liveUrl).toBe("https://example.org/");
    expect(host.vm.tabs).toEqual([{ index: 0, title: "Example", url: "https://example.org/", active: true }]);
    expect(host.vm.frameUrl).toBe("data:image/jpeg;base64,jpeg");
    expect(host.vm.sendInput({ type: "click", nx: 0.4, ny: 0.6 })).toBe(true);
    expect(JSON.parse(socket?.sent.at(-1) ?? "{}" )).toEqual({ type: "click", nx: 0.4, ny: 0.6 });
    host.unmount();
  });

  it("reconnects with bounded backoff after an unexpected close", async () => {
    const enabled = ref(true);
    const host = mount(defineComponent({
      setup() {
        return useBrowserStream(ref("thread-1"), enabled, ref(undefined), vi.fn());
      },
      template: "<div />",
    }));
    await nextTick();
    const first = FakeWebSocket.instances[0];
    first?.drop();
    expect(host.vm.status).toBe("closed");
    vi.advanceTimersByTime(799);
    await nextTick();
    expect(FakeWebSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    await nextTick();
    expect(FakeWebSocket.instances).toHaveLength(2);
    host.unmount();
  });
});
