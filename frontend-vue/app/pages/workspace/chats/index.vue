<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";

import { useThreadsStore } from "@/stores/threads";
import {
  channelSourceOfThread,
  pathOfThread,
  titleOfThread,
} from "@/core/threads/utils";

definePageMeta({ layout: "workspace" });
const threads = useThreadsStore();
const search = ref("");
const sentinel = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;
const filtered = computed(() => {
  const query = search.value.trim().toLowerCase();
  return query
    ? threads.displayedThreads.filter((thread) =>
        titleOfThread(thread).toLowerCase().includes(query),
      )
    : threads.displayedThreads;
});

onMounted(() => {
  void threads.loadInitial();
  observer = new IntersectionObserver((entries) => {
    if (!search.value && entries.some((entry) => entry.isIntersecting)) {
      void threads.loadMore();
    }
  });
  if (sentinel.value) observer.observe(sentinel.value);
});
onUnmounted(() => observer?.disconnect());
</script>

<template>
  <section class="mx-auto max-w-4xl space-y-5 p-8">
    <h1 class="text-2xl font-semibold">Chats</h1>
    <input
      v-model="search"
      placeholder="Search chats"
      class="border-input w-full rounded-md border px-3 py-2"
    />
    <div class="grid gap-2">
      <NuxtLink
        v-for="thread in filtered"
        :key="thread.thread_id"
        :to="pathOfThread(thread)"
        class="border-border hover:bg-accent flex items-center justify-between rounded-lg border p-4"
      >
        <span>{{ titleOfThread(thread) }}</span>
        <span
          v-if="channelSourceOfThread(thread)"
          class="text-xs text-gray-500"
          >{{ channelSourceOfThread(thread)?.label }}</span
        >
      </NuxtLink>
    </div>
    <button
      v-if="search && threads.hasMore"
      data-testid="chats-page-load-more"
      type="button"
      class="rounded-md border px-3 py-2"
      @click="threads.loadMore()"
    >
      Load more
    </button>
    <div
      v-else-if="threads.hasMore"
      ref="sentinel"
      data-testid="chats-page-sentinel"
      class="h-1"
    />
  </section>
</template>
