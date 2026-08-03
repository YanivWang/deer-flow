<script setup lang="ts">
import type { ChatListPageController } from "../../../features/chat-list/use-chat-list-page";

const props = defineProps<{ chats: ChatListPageController }>();

function updateSearch(event: Event): void {
  const target = event.target;
  props.chats.setSearchText(target instanceof HTMLInputElement ? target.value : "");
}
</script>

<template>
  <section class="workspace-simple-page" data-testid="vue-workspace-chats-index">
    <h1>新建对话</h1>
    <p>创建新的工作区对话，或从对话路由打开已有线程。</p>
    <NuxtLink class="workspace-button workspace-button--primary" to="/workspace/chats/new">
      打开新对话路由
    </NuxtLink>
    <input
      class="workspace-chats-search"
      placeholder="Search chats"
      :value="props.chats.searchText.value"
      @input="updateSearch"
    >
    <section
      class="workspace-recent-threads"
      data-testid="vue-workspace-recent-threads"
    >
      <header class="workspace-recent-threads__header">
        <h2>最近对话</h2>
        <span
          v-if="props.chats.isLoadingThreads.value"
          data-testid="vue-workspace-recent-threads-loading"
        >
          加载中
        </span>
      </header>
      <p v-if="props.chats.isLoadingThreads.value" class="workspace-recent-threads__status">
        正在从 Gateway 加载最近对话。
      </p>
      <p
        v-else-if="props.chats.visibleThreads.value.length === 0"
        class="workspace-recent-threads__status"
        data-testid="vue-workspace-recent-threads-empty"
      >
        还没有最近对话。
      </p>
      <ul v-else class="workspace-recent-threads__list">
        <li
          v-for="thread in props.chats.visibleThreads.value"
          :key="thread.thread_id"
          class="workspace-recent-threads__item"
          :data-testid="`vue-workspace-recent-thread-${thread.thread_id}`"
        >
          <NuxtLink class="workspace-recent-threads__link" :to="props.chats.pathOfThread(thread)">
            <span class="workspace-recent-threads__title">
              {{ props.chats.titleOfThread(thread) }}
            </span>
            <span
              class="workspace-recent-threads__meta workspace-thread-meta"
              :data-status="thread.status"
              v-bind="props.chats.channelSourceOfThread(thread)
                ? { [(['aria', 'label'].join('-'))]: `${props.chats.channelSourceOfThread(thread)?.label} channel` }
                : {}"
            >
              <span class="workspace-thread-meta__updated">
                {{ props.chats.formatThreadUpdatedAt(thread.updated_at) }}
              </span>
              <span
                v-if="props.chats.channelSourceOfThread(thread)"
                class="workspace-thread-meta__channel"
              >
                {{ props.chats.channelSourceOfThread(thread)?.label }}
              </span>
            </span>
          </NuxtLink>
          <span
            v-if="props.chats.isThreadPinned(thread)"
            class="workspace-recent-threads__badge"
            data-testid="vue-workspace-recent-thread-pinned"
          >
            已置顶
          </span>
        </li>
      </ul>
      <div
        v-if="!props.chats.isSearching.value && props.chats.hasMoreThreads.value"
        :ref="props.chats.observeSentinel"
        data-testid="chats-page-sentinel"
      />
      <button
        v-if="props.chats.isSearching.value && props.chats.hasMoreThreads.value"
        data-testid="chats-page-load-more"
        type="button"
        :disabled="props.chats.isLoadingMoreThreads.value"
        @click="() => { void props.chats.loadMoreThreads(); }"
      >
        {{ props.chats.isLoadingMoreThreads.value ? "加载中" : "加载更多" }}
      </button>
    </section>
  </section>
</template>
