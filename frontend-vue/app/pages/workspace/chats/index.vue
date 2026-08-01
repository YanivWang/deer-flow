<script setup lang="ts">
const threadList = useThreadList();
const recentThreads = computed(() => threadList.threads.value.slice(0, 5));
const isLoadingThreads = computed(() => threadList.query.isLoading.value);

function formatThreadUpdatedAt(value: string): string {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return value;
  }
  return new Date(timestamp).toISOString().slice(0, 16).replace("T", " ");
}
</script>

<template>
  <WorkspaceNavShell>
    <section class="workspace-simple-page" data-testid="vue-workspace-chats-index">
      <h1>新建对话</h1>
      <p>创建新的工作区对话，或从对话路由打开已有线程。</p>
      <NuxtLink class="workspace-button workspace-button--primary" to="/workspace/chats/new">
        打开新对话路由
      </NuxtLink>
      <section
        class="workspace-recent-threads"
        data-testid="vue-workspace-recent-threads"
        :aria-busy="isLoadingThreads"
      >
        <header class="workspace-recent-threads__header">
          <h2>最近对话</h2>
          <span
            v-if="isLoadingThreads"
            aria-live="polite"
            data-testid="vue-workspace-recent-threads-loading"
          >
            加载中
          </span>
        </header>
        <p v-if="isLoadingThreads" class="workspace-recent-threads__status">
          正在从 Gateway 加载最近对话。
        </p>
        <p
          v-else-if="recentThreads.length === 0"
          class="workspace-recent-threads__status"
          data-testid="vue-workspace-recent-threads-empty"
        >
          还没有最近对话。
        </p>
        <ul v-else class="workspace-recent-threads__list" aria-label="最近对话">
          <li
            v-for="thread in recentThreads"
            :key="thread.thread_id"
            class="workspace-recent-threads__item"
            :data-testid="`vue-workspace-recent-thread-${thread.thread_id}`"
          >
            <NuxtLink class="workspace-recent-threads__link" :to="threadList.pathOfThread(thread)">
              <span class="workspace-recent-threads__title">
                {{ threadList.titleOfThread(thread) }}
              </span>
              <span class="workspace-recent-threads__meta">
                {{ thread.status }} · {{ formatThreadUpdatedAt(thread.updated_at) }}
                <template v-if="threadList.channelSourceOfThread(thread)">
                  · {{ threadList.channelSourceOfThread(thread)?.label }}
                </template>
              </span>
            </NuxtLink>
            <span
              v-if="threadList.isThreadPinned(thread)"
              class="workspace-recent-threads__badge"
              data-testid="vue-workspace-recent-thread-pinned"
            >
              已置顶
            </span>
          </li>
        </ul>
      </section>
    </section>
  </WorkspaceNavShell>
</template>
