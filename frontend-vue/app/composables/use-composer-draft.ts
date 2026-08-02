import { onBeforeUnmount, onMounted, ref, watch, type Ref } from "vue";

import {
  buildComposerDraftKey,
  clearComposerDraft,
  getSessionComposerDraftStorage,
  readComposerDraft,
  writeComposerDraft,
  type ComposerDraft,
} from "../core/threads/composer-draft";

const SAVE_DELAY_MS = 250;

export function useComposerDraft(options: {
  text: Ref<string>;
  skillName: Ref<string | null>;
  threadId: Ref<string>;
  agentName: Ref<string | null>;
  userId?: Ref<string | null>;
}) {
  const userId = options.userId ?? ref("anonymous");
  const key = ref("");
  const hydrated = ref(false);
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  function flushDraft() {
    if (!hydrated.value || !key.value) return;
    writeComposerDraft(getSessionComposerDraftStorage(), key.value, {
      text: options.text.value,
      skillName: options.skillName.value,
    });
  }

  function resolveKey() {
    return buildComposerDraftKey({
      userId: userId.value ?? "anonymous",
      agentName: options.agentName.value,
      threadId: options.threadId.value,
    });
  }

  function hydrate() {
    key.value = resolveKey();
    const storage = getSessionComposerDraftStorage();
    const saved = readComposerDraft(storage, key.value);
    if (saved) {
      options.text.value = saved.text;
      options.skillName.value = saved.skillName;
    }
    hydrated.value = true;
  }

  function clear() {
    if (key.value) clearComposerDraft(getSessionComposerDraftStorage(), key.value);
  }

  onMounted(() => {
    hydrate();
    window.addEventListener("beforeunload", flushDraft);
    window.addEventListener("pagehide", flushDraft);
  });

  watch(
    [options.text, options.skillName, options.threadId, options.agentName, userId],
    () => {
      const nextKey = resolveKey();
      if (nextKey !== key.value) {
        key.value = nextKey;
        hydrated.value = false;
        hydrate();
        return;
      }
      if (!hydrated.value) return;
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        const draft: ComposerDraft = {
          text: options.text.value,
          skillName: options.skillName.value,
        };
        writeComposerDraft(getSessionComposerDraftStorage(), key.value, draft);
        saveTimer = null;
      }, SAVE_DELAY_MS);
    },
    { flush: "post" },
  );

  onBeforeUnmount(() => {
    if (saveTimer) clearTimeout(saveTimer);
    flushDraft();
    window.removeEventListener("beforeunload", flushDraft);
    window.removeEventListener("pagehide", flushDraft);
  });

  return { clear, key, hydrated, hydrate };
}
