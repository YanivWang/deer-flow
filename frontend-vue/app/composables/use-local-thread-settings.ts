import { computed, ref, toValue, watch, type MaybeRefOrGetter } from "vue";

import type { AgentThreadContext } from "../core/api/thread/types";
import {
  readLocalSettings,
  readThreadModelName,
  sanitizeContext,
  writeLocalSettings,
  writeThreadModelName,
  type LocalSettingsStorage,
  type LocalThreadContext,
} from "../core/settings/local";

export function useLocalThreadSettings(
  threadId: MaybeRefOrGetter<string>,
  serverContext: MaybeRefOrGetter<AgentThreadContext | null | undefined>,
  options: { storage?: LocalSettingsStorage | null } = {},
) {
  const storage = options.storage ?? readBrowserStorage();
  const settings = ref(readLocalSettings(storage));
  const threadModelName = ref<string | undefined>(undefined);

  watch(
    () => toValue(threadId),
    (nextThreadId) => {
      threadModelName.value = readThreadModelName(nextThreadId, storage);
    },
    { immediate: true },
  );

  const effectiveContext = computed<AgentThreadContext>(() => ({
    ...(toValue(serverContext) ?? {}),
    ...settings.value.context,
    ...(threadModelName.value ? { model_name: threadModelName.value } : {}),
  }));

  function updateContext(patch: LocalThreadContext) {
    settings.value = {
      ...settings.value,
      context: sanitizeContext({
        ...settings.value.context,
        ...patch,
      }),
    };
    writeLocalSettings(settings.value, storage);
    if (Object.prototype.hasOwnProperty.call(patch, "model_name")) {
      threadModelName.value = patch.model_name;
      writeThreadModelName(toValue(threadId), patch.model_name, storage);
    }
  }

  function resetContext() {
    settings.value = {
      ...settings.value,
      context: {},
    };
    threadModelName.value = undefined;
    writeLocalSettings(settings.value, storage);
    writeThreadModelName(toValue(threadId), undefined, storage);
  }

  return {
    effectiveContext,
    localSettings: settings,
    resetContext,
    threadModelName,
    updateContext,
  };
}

function readBrowserStorage(): LocalSettingsStorage | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage;
}
