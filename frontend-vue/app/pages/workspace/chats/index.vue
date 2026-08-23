<script setup lang="ts">
/*
  【文件职责】     提供新会话入口并接入 bootstrap AgentChat。
  【对应 frontend/】 src/app/workspace/chats/page.tsx
  【架构位置】     L3 application page
  【主要导出】     默认 chats index page
  【依赖关系】     AgentChat · workspace routing
  【边界与注意】   DeerFlow 路由接线，不属于 L2。
*/
import { computed, onMounted, onUnmounted, ref, watch } from "vue";

import { useThreads } from "@/composables/useThreads";
import {
  channelSourceOfThread,
  pathOfThread,
  titleOfThread,
} from "@/core/threads/utils";
import { formatThreadUpdatedTime } from "@/core/threads/updated-time";

definePageMeta({ layout: "workspace" });
const { $i18n } = useNuxtApp();
const threads = useThreads();
const search = ref("");
const sentinel = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;
const displayThreadTitle = (thread: Parameters<typeof titleOfThread>[0]) =>
  titleOfThread(thread, $i18n.t.value.pages.untitled);
const filtered = computed(() => {
  const query = search.value.trim().toLowerCase();
  return query
    ? threads.displayedThreads.filter((thread) =>
        displayThreadTitle(thread).toLowerCase().includes(query),
      )
    : threads.displayedThreads;
});

function updatedTime(value: string | null | undefined) {
  return formatThreadUpdatedTime(value, new Date(), $i18n.locale.value);
}

onMounted(() => {
  void threads.loadInitial();
  observer = new IntersectionObserver((entries) => {
    if (!search.value && entries.some((entry) => entry.isIntersecting)) {
      void threads.loadMore();
    }
  });
  if (sentinel.value) observer.observe(sentinel.value);
});
watch(sentinel, (element, previous) => {
  if (previous) observer?.unobserve(previous);
  if (element) observer?.observe(element);
});
onUnmounted(() => observer?.disconnect());
</script>

<template>
  <section class="mx-auto max-w-4xl space-y-5 p-8">
    <h1 class="text-2xl font-semibold">{{ $i18n.t.value.pages.chats }}</h1>
    <input
      v-model="search"
      :placeholder="$i18n.t.value.chats.searchChats"
      class="border-input w-full rounded-md border px-3 py-2"
    />
    <div class="grid gap-2">
      <NuxtLink
        v-for="thread in filtered"
        :key="thread.thread_id"
        :to="pathOfThread(thread)"
        class="border-border hover:bg-accent flex items-center justify-between rounded-lg border p-4"
      >
        <span class="min-w-0">
          <span class="block truncate">{{ displayThreadTitle(thread) }}</span>
          <time
            v-if="updatedTime(thread.updated_at)"
            :datetime="thread.updated_at"
            class="text-muted-foreground mt-1 block text-xs"
          >
            {{ $i18n.t.value.chats.updatedAt(updatedTime(thread.updated_at)!) }}
          </time>
        </span>
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
      {{ $i18n.t.value.common.loadMore }}
    </button>
    <div
      v-else-if="threads.hasMore"
      ref="sentinel"
      data-testid="chats-page-sentinel"
      class="h-1"
    />
  </section>
</template>
