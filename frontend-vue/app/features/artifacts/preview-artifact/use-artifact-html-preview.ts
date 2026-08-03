import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  toValue,
  watch,
  type ComponentPublicInstance,
  type MaybeRefOrGetter,
} from "vue";

import {
  appendHtmlPreviewScrollRestoration,
  collectHtmlPreviewResourceUrls,
  createHtmlPreviewScrollKey,
  HTML_PREVIEW_SCROLL_MESSAGE_SOURCE,
  resolveHtmlPreviewResourceReference,
  rewriteHtmlPreviewResourceUrls,
} from "../../../core/artifacts/preview";
import { loadArtifactResourceBlob } from "../../../core/artifacts/loader";

export type ArtifactHtmlPreviewElement = Element | ComponentPublicInstance | null;
export type ArtifactHtmlPreviewIframeRef = (element: ArtifactHtmlPreviewElement) => void;

type ArtifactViewMode = "preview" | "code";

export function useArtifactHtmlPreview({
  content,
  errorMessage,
  filepath,
  isLoading,
  previewKind,
  sourceUrl,
  viewMode,
}: {
  content: MaybeRefOrGetter<string | null>;
  errorMessage: MaybeRefOrGetter<string | null>;
  filepath: MaybeRefOrGetter<string | null | undefined>;
  isLoading: MaybeRefOrGetter<boolean>;
  previewKind: MaybeRefOrGetter<string | null | undefined>;
  sourceUrl: MaybeRefOrGetter<string | null | undefined>;
  viewMode: MaybeRefOrGetter<ArtifactViewMode>;
}) {
  const previewUrl = ref<string | null>(null);
  const previewErrorMessage = ref<string | null>(null);
  const iframeRef = ref<HTMLIFrameElement | null>(null);
  const scrollPosition = ref({ x: 0, y: 0 });
  const scrollKey = computed(() => {
    const artifactPath = toValue(filepath);
    return artifactPath ? createHtmlPreviewScrollKey(artifactPath) : "";
  });
  let activeAbortController: AbortController | null = null;

  function setIframeElement(element: ArtifactHtmlPreviewElement): void {
    if (typeof HTMLIFrameElement === "undefined" || !(element instanceof HTMLIFrameElement)) {
      iframeRef.value = null;
      return;
    }
    iframeRef.value = element;
  }

  function revokePreviewUrl(): void {
    const currentUrl = previewUrl.value;
    if (currentUrl?.startsWith("blob:") && typeof URL.revokeObjectURL === "function") {
      URL.revokeObjectURL(currentUrl);
    }
    previewUrl.value = null;
  }

  function setPreviewUrl(nextContent: string): void {
    revokePreviewUrl();
    if (typeof URL.createObjectURL === "function") {
      previewUrl.value = URL.createObjectURL(
        new Blob([nextContent], { type: "text/html;charset=utf-8" }),
      );
      return;
    }
    previewUrl.value = `data:text/html;charset=utf-8,${encodeURIComponent(nextContent)}`;
  }

  watch(scrollKey, () => {
    scrollPosition.value = { x: 0, y: 0 };
  });

  watch(
    [
      () => toValue(content),
      () => toValue(errorMessage),
      () => toValue(isLoading),
      () => toValue(sourceUrl),
      () => toValue(viewMode),
      () => toValue(previewKind),
      () => toValue(filepath),
    ],
    (_value, _oldValue, onCleanup) => {
      const abortController = new AbortController();
      let isCancelled = false;
      activeAbortController = abortController;

      onCleanup(() => {
        isCancelled = true;
        abortController.abort();
        if (activeAbortController === abortController) {
          activeAbortController = null;
        }
        revokePreviewUrl();
      });

      const shouldBuildHtmlPreview =
        toValue(viewMode) === "preview" && toValue(previewKind) === "html";
      if (!shouldBuildHtmlPreview) {
        revokePreviewUrl();
        previewErrorMessage.value = null;
        return;
      }

      if (toValue(isLoading)) {
        revokePreviewUrl();
        previewErrorMessage.value = null;
        return;
      }

      const sourceContent = toValue(content);
      const sourceArtifactUrl = toValue(sourceUrl);
      if (sourceContent === null) {
        revokePreviewUrl();
        previewErrorMessage.value = toValue(errorMessage);
        return;
      }

      void buildPreview({
        abortController,
        isCancelled: () => isCancelled,
        scrollKey: toValue(filepath) ?? "artifact",
        sourceContent,
        sourceArtifactUrl,
      });
    },
    { immediate: true },
  );

  function handlePreviewMessage(event: MessageEvent): void {
    if (event.source !== iframeRef.value?.contentWindow) {
      return;
    }
    if (!isArtifactHtmlPreviewScrollMessage(event.data, scrollKey.value)) {
      return;
    }

    if (event.data.type === "save") {
      const x = scrollCoordinate(event.data.x);
      const y = scrollCoordinate(event.data.y);
      if (x !== undefined && y !== undefined) {
        scrollPosition.value = { x, y };
      }
      return;
    }

    iframeRef.value?.contentWindow?.postMessage(
      {
        source: HTML_PREVIEW_SCROLL_MESSAGE_SOURCE,
        key: scrollKey.value,
        type: "restore",
        ...scrollPosition.value,
      },
      "*",
    );
  }

  onMounted(() => {
    window.addEventListener("message", handlePreviewMessage);
  });

  onUnmounted(() => {
    window.removeEventListener("message", handlePreviewMessage);
    activeAbortController?.abort();
    activeAbortController = null;
    revokePreviewUrl();
    iframeRef.value = null;
  });

  return {
    errorMessage: previewErrorMessage,
    iframeRef,
    previewUrl,
    scrollKey,
    setIframeElement,
    scrollPosition,
  };

  async function buildPreview({
    abortController,
    isCancelled,
    scrollKey: sourceScrollKey,
    sourceContent,
    sourceArtifactUrl,
  }: {
    abortController: AbortController;
    isCancelled: () => boolean;
    scrollKey: string;
    sourceContent: string;
    sourceArtifactUrl: string | null | undefined;
  }): Promise<void> {
    try {
      const resourceUrlMap = new Map<string, string>();
      const resourceUrls = [
        ...new Set(
          collectHtmlPreviewResourceUrls(sourceContent)
            .map((value) => resolveHtmlPreviewResourceReference({
              url: sourceArtifactUrl,
              value,
            }))
            .filter((resourceUrl) => isInlineableArtifactResource(resourceUrl)),
        ),
      ];

      await Promise.all(
        resourceUrls.map(async (resourceUrl) => {
          try {
            resourceUrlMap.set(resourceUrl, await blobToDataUrl(await loadArtifactResourceBlob(resourceUrl, abortController.signal)));
          } catch (error) {
            if (!abortController.signal.aborted) {
              console.warn("Failed to inline HTML preview resource", error);
            }
          }
        }),
      );

      if (isCancelled() || abortController.signal.aborted) {
        return;
      }

      const rewrittenContent = rewriteHtmlPreviewResourceUrls({
        content: sourceContent,
        resourceUrlMap,
        url: sourceArtifactUrl,
      });
      setPreviewUrl(appendHtmlPreviewScrollRestoration(rewrittenContent, sourceScrollKey));
      previewErrorMessage.value = null;
    } catch (error) {
      if (abortController.signal.aborted || isCancelled()) {
        return;
      }
      revokePreviewUrl();
      previewErrorMessage.value = error instanceof Error
        ? error.message
        : "无法构建 HTML 预览。";
    }
  }

  function isInlineableArtifactResource(resourceUrl: string): boolean {
    const currentHref = globalThis.location?.href ?? "http://localhost/";
    try {
      const parsed = new URL(resourceUrl, currentHref);
      const currentOrigin = new URL(currentHref).origin;
      if (parsed.origin !== currentOrigin) {
        return false;
      }
      const threadId = threadIdFromArtifactPath(parsed.pathname);
      const selectedArtifactPath = toValue(filepath);
      if (!threadId || !selectedArtifactPath) {
        return false;
      }
      return threadId === threadIdFromArtifactUrl(toValue(sourceUrl))
        && parsed.pathname.startsWith(`/api/threads/${threadId}/artifacts/`);
    } catch {
      return false;
    }
  }

  function threadIdFromArtifactUrl(url: string | null | undefined): string | null {
    if (!url) {
      return null;
    }
    try {
      const parsed = new URL(url, globalThis.location?.href ?? "http://localhost/");
      return threadIdFromArtifactPath(parsed.pathname);
    } catch {
      return null;
    }
  }

  function threadIdFromArtifactPath(pathname: string): string | null {
    const match = /^\/api\/threads\/([^/]+)\/artifacts\//.exec(pathname);
    return match?.[1] ?? null;
  }
}

function isArtifactHtmlPreviewScrollMessage(
  data: unknown,
  key: string,
): data is {
  source: typeof HTML_PREVIEW_SCROLL_MESSAGE_SOURCE;
  key: string;
  type: "save" | "restore-request";
  x?: unknown;
  y?: unknown;
} {
  return (
    typeof data === "object"
    && data !== null
    && "source" in data
    && data.source === HTML_PREVIEW_SCROLL_MESSAGE_SOURCE
    && "key" in data
    && data.key === key
    && "type" in data
    && (data.type === "save" || data.type === "restore-request")
  );
}

function scrollCoordinate(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  if (typeof blob.arrayBuffer === "function" && typeof btoa === "function") {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return `data:${blob.type || "application/octet-stream"};base64,${btoa(binary)}`;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("无法读取 HTML 预览资源。"));
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("无法读取 HTML 预览资源。"));
    };
    reader.readAsDataURL(blob);
  });
}
