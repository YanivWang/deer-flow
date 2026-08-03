import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import { browserFrameFromMessage, browserFrameUrl, browserStreamUrl } from "../../../../../app/core/api/browser/client";
import { decideBrowserKeyInput } from "../../../../../app/widgets/workspace/browser-view/keyboard";
import BrowserViewStatus from "../../../../../app/widgets/workspace/browser-view/BrowserViewStatus.vue";
import BrowserViewTrigger from "../../../../../app/widgets/workspace/browser-view/BrowserViewTrigger.vue";

describe("Browser View widgets", () => {
  it("keeps artifact paths and live data frames on their respective URL contracts", () => {
    expect(browserFrameUrl({ screenshot: "/browser/screenshot.jpg" }, "thread-1")).toContain(
      "/api/threads/thread-1/artifacts/browser/screenshot.jpg",
    );
    expect(browserFrameUrl({ screenshot: "data:image/jpeg;base64,frame" }, "thread-1")).toBe(
      "data:image/jpeg;base64,frame",
    );
    expect(browserStreamUrl("thread/1", "https://example.com/a?b=1")).toContain(
      "/api/threads/thread%2F1/browser/stream?seed=https%3A%2F%2Fexample.com%2Fa%3Fb%3D1",
    );
    expect(browserFrameFromMessage({ additional_kwargs: { browser_view: {
      screenshot: "/browser/step.png",
      url: "https://example.com",
      title: "Example",
    } } })).toEqual({
      screenshot: "/browser/step.png",
      url: "https://example.com",
      title: "Example",
    });
  });

  it("maps live keyboard input without stealing editable or IME composition", () => {
    expect(decideBrowserKeyInput({ live: true, editableTarget: false, composing: false, key: "a", metaKey: false, ctrlKey: false })).toEqual({ type: "text", text: "a" });
    expect(decideBrowserKeyInput({ live: true, editableTarget: false, composing: false, key: "Enter", metaKey: false, ctrlKey: false })).toEqual({ type: "key", key: "Enter" });
    expect(decideBrowserKeyInput({ live: true, editableTarget: false, composing: true, key: "Enter", metaKey: false, ctrlKey: false })).toBeNull();
    expect(decideBrowserKeyInput({ live: true, editableTarget: true, composing: false, key: "a", metaKey: false, ctrlKey: false })).toBeNull();
  });

  it("exposes status and toggles the browser panel through semantic controls", async () => {
    const status = mount(BrowserViewStatus, {
      props: { live: true, navigating: false, status: "open" },
    });
    expect(status.get('[data-testid="browser-view-status"]').text()).toBe("实时");

    const trigger = mount(BrowserViewTrigger, {
      props: { enabled: true, open: false, sidecarOpen: false },
    });
    expect(trigger.get('[data-testid="browser-trigger"]').text()).toBe("浏览器");
    await trigger.get('[data-testid="browser-trigger"]').trigger("click");
    expect(trigger.emitted("toggle")).toHaveLength(1);
  });
});
