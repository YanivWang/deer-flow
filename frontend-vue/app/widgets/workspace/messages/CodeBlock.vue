<script setup lang="ts">
import { codeToHtml, bundledLanguages, type BundledLanguage } from "shiki";
import { onBeforeUnmount, ref, watch } from "vue";

import TrustedRichHtml from "./TrustedRichHtml.vue";

const props = defineProps<{
  code: string;
  language: string | null;
  reveal?: boolean;
  streaming?: boolean;
}>();

const copyState = ref<"idle" | "copied" | "error">("idle");
const highlightedLight = ref<string | null>(null);
const highlightedDark = ref<string | null>(null);
const highlightState = ref<"idle" | "loading" | "ready" | "error">("idle");
let generation = 0;
let copyResetTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => [props.code, props.language] as const,
  ([code, language]) => {
    void highlight(code, language);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  generation += 1;
  if (copyResetTimer !== null) {
    clearTimeout(copyResetTimer);
  }
});

async function highlight(code: string, language: string | null): Promise<void> {
  const currentGeneration = ++generation;
  highlightedLight.value = null;
  highlightedDark.value = null;
  highlightState.value = "loading";

  try {
    const lang = toBundledLanguage(language);
    if (!lang) {
      highlightState.value = "error";
      return;
    }
    const [light, dark] = await Promise.all([
      codeToHtml(code, { lang, theme: "github-light-default" }),
      codeToHtml(code, { lang, theme: "github-dark-default" }),
    ]);
    if (currentGeneration !== generation) return;
    highlightedLight.value = light;
    highlightedDark.value = dark;
    highlightState.value = "ready";
  } catch {
    if (currentGeneration !== generation) return;
    highlightState.value = "error";
  }
}

async function copyCode(): Promise<void> {
  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error("Clipboard API unavailable");
    }
    await navigator.clipboard.writeText(props.code);
    copyState.value = "copied";
    scheduleCopyReset();
  } catch {
    copyState.value = "error";
  }
}

function scheduleCopyReset(): void {
  if (copyResetTimer !== null) {
    clearTimeout(copyResetTimer);
  }
  copyResetTimer = setTimeout(() => {
    copyState.value = "idle";
    copyResetTimer = null;
  }, 2000);
}

function toBundledLanguage(language: string | null): BundledLanguage | null {
  const normalized = language?.trim().toLowerCase() || "text";
  const aliases: Record<string, string> = {
    cs: "csharp",
    htm: "html",
    js: "javascript",
    md: "markdown",
    py: "python",
    rb: "ruby",
    sh: "shellscript",
    shell: "shellscript",
    ts: "typescript",
    yml: "yaml",
  };
  const candidate = aliases[normalized] ?? normalized;
  return candidate in bundledLanguages
    ? candidate as BundledLanguage
    : null;
}
</script>

<template>
  <figure
    class="rich-message-content__code-figure"
    :class="{ 'rich-message-content__streaming-reveal': props.reveal }"
    :data-language="props.language || undefined"
    :data-testid="props.reveal ? 'vue-message-streaming-reveal' : 'vue-message-code-block'"
  >
    <figcaption class="rich-message-content__code-caption">
      <span data-testid="vue-message-code-language">{{ props.language || "text" }}</span>
      <button
        type="button"
        class="rich-message-content__code-copy"
        data-testid="vue-message-code-copy"
        @click="copyCode"
      >
        {{ copyState === "copied" ? "已复制" : "复制" }}
      </button>
      <small
        v-if="copyState === 'copied'"
        data-testid="vue-message-code-copy-status"
      >已复制</small>
      <small
        v-else-if="copyState === 'error'"
        class="rich-message-content__code-copy-error"
        data-testid="vue-message-code-copy-error"
        role="alert"
      >复制失败，请检查剪贴板权限</small>
    </figcaption>
    <div
      v-if="!props.streaming && highlightState === 'ready' && highlightedLight && highlightedDark"
      class="rich-message-content__code-highlight"
      data-streamdown="code-block-body"
    >
      <div class="rich-message-content__code-highlight-light">
        <TrustedRichHtml :html="highlightedLight" />
      </div>
      <div class="rich-message-content__code-highlight-dark">
        <TrustedRichHtml :html="highlightedDark" />
      </div>
    </div>
    <pre
      v-else
      class="rich-message-content__code-block"
      data-streamdown="code-block-body"
    ><code>{{ props.code }}</code></pre>
  </figure>
</template>
