import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, ref, type Ref } from "vue";
import { describe, expect, it, vi } from "vitest";

import {
  useArtifactHtmlPreview,
  type ArtifactHtmlPreviewIframeRef,
} from "../../../../app/features/artifacts/preview-artifact/use-artifact-html-preview";
import { HTML_PREVIEW_SCROLL_MESSAGE_SOURCE } from "../../../../app/core/artifacts/preview";

function mountPreview(options: {
  content: Ref<string | null>;
  filepath: Ref<string | null>;
  isLoading?: Ref<boolean>;
  previewKind?: Ref<string | null>;
  sourceUrl: Ref<string | null>;
  viewMode?: Ref<"preview" | "code">;
}) {
  const isLoading = options.isLoading ?? ref(false);
  const previewKind = options.previewKind ?? ref("html");
  const viewMode = options.viewMode ?? ref<"preview" | "code">("preview");
  const errorMessage = ref<string | null>(null);
  let owner: ReturnType<typeof useArtifactHtmlPreview> | undefined;
  let mountedWrapper: ReturnType<typeof mount> | undefined;

  const Probe = defineComponent({
    setup(_, { expose }) {
      owner = useArtifactHtmlPreview({
        content: options.content,
        errorMessage,
        filepath: options.filepath,
        isLoading,
        previewKind,
        sourceUrl: options.sourceUrl,
        viewMode,
      });
      expose(owner);
      return () => h("iframe", { ref: owner?.setIframeElement as ArtifactHtmlPreviewIframeRef });
    },
  });

  return {
    errorMessage,
    iframe: () => mountedWrapper?.get("iframe").element as HTMLIFrameElement,
    mount: () => {
      mountedWrapper = mount(Probe);
      return mountedWrapper;
    },
    owner: () => owner,
  };
}

describe("useArtifactHtmlPreview", () => {
  it("inlines only same-origin resources from the selected artifact thread with credentials", async () => {
    const createdBlobs: Blob[] = [];
    const NativeURL = URL;
    vi.stubGlobal("URL", class extends NativeURL {
      static createObjectURL(blob: Blob) {
        createdBlobs.push(blob);
        return "blob:artifact-preview";
      }
    });
    const fetchMock = vi.fn(async () => new Response("resource", {
      headers: { "content-type": "text/plain" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const content = ref([
      "<html><body>",
      "<img src='./image.png'>",
      "<img src='/api/threads/thread-b/artifacts/other.png'>",
      "<img src='/assets/other.png'>",
      "<img src='https://example.com/external.png'>",
      "</body></html>",
    ].join(""));
    const preview = mountPreview({
      content,
      filepath: ref("/workspace/site/index.html"),
      sourceUrl: ref("/api/threads/thread-a/artifacts/workspace/site/index.html"),
    });
    const wrapper = preview.mount();

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      `${window.location.origin}/api/threads/thread-a/artifacts/workspace/site/image.png`,
      expect.objectContaining({
        credentials: "include",
        signal: expect.any(AbortSignal) as AbortSignal,
      }),
    );
    await flushPromises();
    expect(createdBlobs).toHaveLength(1);
    expect(await createdBlobs[0]?.text()).toContain("data:text/plain");

    wrapper.unmount();
  });

  it("aborts pending resource work on view changes and revokes the generated blob on unmount", async () => {
    const NativeURL = URL;
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", class extends NativeURL {
      static createObjectURL() {
        return "blob:artifact-preview";
      }
      static revokeObjectURL(url: string) {
        revokeObjectURL(url);
      }
    });
    let resolveResource: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => {
      resolveResource = resolve;
    }));
    vi.stubGlobal("fetch", fetchMock);
    const viewMode = ref<"preview" | "code">("preview");
    const preview = mountPreview({
      content: ref("<img src='./image.png'>"),
      filepath: ref("/workspace/site/index.html"),
      sourceUrl: ref("/api/threads/thread-a/artifacts/workspace/site/index.html"),
      viewMode,
    });
    const wrapper = preview.mount();

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const signal = fetchMock.mock.calls[0]?.[1]?.signal as AbortSignal;
    viewMode.value = "code";
    await flushPromises();
    expect(signal.aborted).toBe(true);

    viewMode.value = "preview";
    await flushPromises();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    resolveResource?.(new Response("resource", {
      headers: { "content-type": "text/plain" },
    }));
    await flushPromises();
    wrapper.unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:artifact-preview");
  });

  it("accepts save/restore messages only from the wired HTML iframe and matching key", async () => {
    const preview = mountPreview({
      content: ref("<html><body>preview</body></html>"),
      filepath: ref("/workspace/site/index.html"),
      sourceUrl: ref("/api/threads/thread-a/artifacts/workspace/site/index.html"),
    });
    const wrapper = preview.mount();
    const iframe = preview.iframe();
    const postMessage = vi.fn();
    const iframeWindow = { postMessage } as unknown as WindowProxy;
    Object.defineProperty(iframe, "contentWindow", {
      configurable: true,
      value: iframeWindow,
    });
    const key = preview.owner()?.scrollKey.value;

    window.dispatchEvent(new MessageEvent("message", {
      data: { source: HTML_PREVIEW_SCROLL_MESSAGE_SOURCE, key, type: "save", x: 12, y: 34 },
      source: iframeWindow,
    }));
    window.dispatchEvent(new MessageEvent("message", {
      data: { source: HTML_PREVIEW_SCROLL_MESSAGE_SOURCE, key: "wrong", type: "restore-request" },
      source: iframeWindow,
    }));
    window.dispatchEvent(new MessageEvent("message", {
      data: { source: HTML_PREVIEW_SCROLL_MESSAGE_SOURCE, key, type: "restore-request" },
      source: iframeWindow,
    }));

    expect(preview.owner()?.scrollPosition.value).toEqual({ x: 12, y: 34 });
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        key,
        source: HTML_PREVIEW_SCROLL_MESSAGE_SOURCE,
        type: "restore",
        x: 12,
        y: 34,
      }),
      "*",
    );
    wrapper.unmount();
  });
});
