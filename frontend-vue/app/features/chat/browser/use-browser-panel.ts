import { computed, ref, watch, type Ref } from "vue";

import { browserFrameFromMessage, type BrowserFrame } from "../../../core/api/browser/client";

export function useBrowserPanel(messages: Readonly<Ref<readonly { raw: unknown }[]>>) {
  const browserOpen = ref(false);
  const latestBrowserFrame = computed<BrowserFrame | null>(() => {
    for (const message of [...messages.value].reverse()) {
      const frame = browserFrameFromMessage(message.raw);
      if (frame) return frame;
    }
    return null;
  });

  watch(
    () => latestBrowserFrame.value?.screenshot,
    (screenshot, previousScreenshot) => {
      if (screenshot && screenshot !== previousScreenshot) browserOpen.value = true;
    },
    { immediate: true },
  );

  return { browserOpen, latestBrowserFrame };
}
