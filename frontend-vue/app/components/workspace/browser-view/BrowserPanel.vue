<script setup lang="ts">
import { computed, ref } from "vue";
import { ArrowLeft, ArrowRight, Monitor, X } from "lucide-vue-next";

import { useBrowserStream } from "./useBrowserStream";

const props = defineProps<{ threadId: string; active: boolean }>();
const emit = defineEmits<{ close: [] }>();
const threadId = computed(() => props.threadId);
const active = computed(() => props.active);
const url = ref("");
const surface = ref<HTMLImageElement | null>(null);
const stream = useBrowserStream(threadId, active);

function navigate() {
  const target = url.value.trim();
  if (!target) return;
  const normalized = /^https?:\/\//i.test(target)
    ? target
    : `https://${target}`;
  url.value = normalized;
  stream.sendInput({ type: "navigate", url: normalized });
}

function clickFrame(event: MouseEvent) {
  const image = surface.value;
  if (!image) return;
  const rect = image.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  stream.sendInput({
    type: "click",
    nx: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
    ny: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
  });
}

function onKeydown(event: KeyboardEvent) {
  if (
    (event.target as HTMLElement)?.matches(
      "input,textarea,[contenteditable=true]",
    )
  )
    return;
  stream.sendInput({ type: "key", key: event.key });
}
</script>

<template>
  <section
    class="bg-background flex size-full flex-col"
    tabindex="0"
    @keydown="onKeydown"
  >
    <header
      class="border-border flex h-12 shrink-0 items-center gap-2 border-b px-3"
    >
      <Monitor :size="16" /><span class="font-medium">Browser</span>
      <button
        type="button"
        aria-label="Back"
        class="rounded p-1"
        @click="stream.sendInput({ type: 'back' })"
      >
        <ArrowLeft :size="16" />
      </button>
      <button
        type="button"
        aria-label="Forward"
        class="rounded p-1"
        @click="stream.sendInput({ type: 'forward' })"
      >
        <ArrowRight :size="16" />
      </button>
      <form class="flex min-w-0 flex-1" @submit.prevent="navigate">
        <input
          v-model="url"
          placeholder="Enter a URL and press Enter"
          class="border-input w-full rounded-md border px-3 py-1.5 text-sm"
        />
      </form>
      <span class="text-muted-foreground text-xs">{{
        stream.status.value
      }}</span>
      <button
        type="button"
        aria-label="Close browser"
        class="rounded p-1"
        @click="emit('close')"
      >
        <X :size="16" />
      </button>
    </header>
    <p
      v-if="stream.error.value"
      role="alert"
      class="bg-red-50 px-3 py-2 text-sm text-red-700"
    >
      {{ stream.error.value }}
    </p>
    <main class="relative min-h-0 flex-1 bg-neutral-950">
      <img
        v-if="stream.frameUrl.value"
        ref="surface"
        :src="stream.frameUrl.value"
        alt="Browser view"
        draggable="false"
        class="absolute inset-0 size-full object-contain"
        @click="clickFrame"
      />
      <div
        v-else
        class="text-muted-foreground absolute inset-0 grid place-items-center"
      >
        Connecting to live browser…
      </div>
    </main>
  </section>
</template>
