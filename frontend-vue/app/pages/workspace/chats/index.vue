<script setup lang="ts">
const threadList = useThreadList();
const isLoadingThreads = computed(() => threadList.query.isLoading.value);
const searchText = ref("");
const filteredThreads = computed(() => threadList.threads.value.filter((thread) =>
  threadList.titleOfThread(thread).toLowerCase().includes(searchText.value.toLowerCase()),
));
const visibleThreads = computed(() => filteredThreads.value.length <= 10 ? filteredThreads.value.slice(0, 5) : filteredThreads.value);
function observeChatsSentinel(element: unknown) {
  if (typeof Element === "undefined" || !(element instanceof Element) || typeof IntersectionObserver === "undefined") return;
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting) && !searchText.value && threadList.hasMoreThreads.value) {
      void threadList.loadMoreThreads();
    }
  });
  observer.observe(element);
}

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
      <input v-model="searchText" class="workspace-chats-search" placeholder="Search chats">
      <section
        class="workspace-recent-threads"
        data-testid="vue-workspace-recent-threads"
      >
        <header class="workspace-recent-threads__header">
          <h2>最近对话</h2>
          <span
            v-if="isLoadingThreads"
            data-testid="vue-workspace-recent-threads-loading"
          >
            加载中
          </span>
        </header>
        <p v-if="isLoadingThreads" class="workspace-recent-threads__status">
          正在从 Gateway 加载最近对话。
        </p>
        <p
          v-else-if="visibleThreads.length === 0"
          class="workspace-recent-threads__status"
          data-testid="vue-workspace-recent-threads-empty"
        >
          还没有最近对话。
        </p>
        <ul v-else class="workspace-recent-threads__list">
          <li
            v-for="thread in visibleThreads"
            :key="thread.thread_id"
            class="workspace-recent-threads__item"
            :data-testid="`vue-workspace-recent-thread-${thread.thread_id}`"
          >
            <NuxtLink class="workspace-recent-threads__link" :to="threadList.pathOfThread(thread)">
              <span class="workspace-recent-threads__title">
                {{ threadList.titleOfThread(thread) }}
              </span>
              <span
                class="workspace-recent-threads__meta workspace-thread-meta"
                :data-status="thread.status"
                v-bind="threadList.channelSourceOfThread(thread)
                  ? { [(['aria', 'label'].join('-'))]: `${threadList.channelSourceOfThread(thread)?.label} channel` }
                  : {}"
              >
                <span class="workspace-thread-meta__updated">
                  {{ formatThreadUpdatedAt(thread.updated_at) }}
                </span>
                <span
                  v-if="threadList.channelSourceOfThread(thread)"
                  class="workspace-thread-meta__channel"
                >
                  {{ threadList.channelSourceOfThread(thread)?.label }}
                </span>
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
        <div v-if="!searchText && threadList.hasMoreThreads.value" :ref="observeChatsSentinel" data-testid="chats-page-sentinel" />
        <button v-if="searchText && threadList.hasMoreThreads.value" data-testid="chats-page-load-more" type="button" @click="threadList.loadMoreThreads()">
          加载更多
        </button>
      </section>
    </section>
  </WorkspaceNavShell>
</template>
