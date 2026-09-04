<script setup lang="ts">
/*
  【文件职责】     会话列表页：搜索、无限滚动分页与会话入口。
  【架构位置】     L3 application page
  【主要导出】     默认 chats index page
  【依赖关系】     useThreads · WorkspaceContainer · ScrollArea · thread channel source
  【边界与注意】   DeerFlow 路由接线，不属于 L2。

                   一行**就是一个链接**，标题与相对时间都是链接里的普通 div：React 的
                   renderItem 就是这个形状（frontend/src/app/workspace/chats/page.tsx），
                   于是链接的可访问名是「Conversation 001 about 1 year ago」一整句。
                   把时间换成 <time> 看起来更语义，实测却会在可访问性树里多出一个
                   `time` 节点，并把标题挤成一个独立的 `text` 节点——同一行，React 报
                   1 个节点、Vue 报 3 个。

                   搜索框是 `type="search"`（role=searchbox），不是普通 textbox：
                   读屏器据此念出「搜索框」，两边必须一致。

                   分页有两条互斥的路：没有搜索时是哨兵自动加载，搜索时换成一颗显式
                   按钮。理由写在 React 那边（issue #3482）：过滤到空列表时哨兵会一直
                   停在视口里，把后端整份列表一页一页抽干。
*/
import { computed, onMounted, onUnmounted, ref, watch } from "vue";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import ThreadChannelBadge from "@/components/workspace/ThreadChannelBadge.vue";
import ThreadChannelIcon from "@/components/workspace/ThreadChannelIcon.vue";
import VirtualThreadList from "@/components/workspace/VirtualThreadList.vue";
import WorkspaceContainer from "@/components/workspace/WorkspaceContainer.vue";
import { useThreads } from "@/composables/useThreads";
import {
  channelSourceOfThread,
  pathOfThread,
  titleOfThread,
} from "@/core/threads/utils";
import { formatThreadUpdatedTime } from "@/core/threads/updated-time";

definePageMeta({ layout: "workspace" });
const { $i18n } = useNuxtApp();
/*
  页面标题：React 的 ChatsPage 用 useEffect 写 `document.title`。列表页没有 h1，
  所以浏览器标签、书签和读屏器打开页面时的播报全靠它——只留 nuxt.config 的根标题
  "DeerFlow"，用户开着十个标签页时分不出哪个是会话列表。
*/
useHead(() => ({
  title: `${$i18n.t.value.pages.chats} - ${$i18n.t.value.pages.appName}`,
}));
const threads = useThreads();
const search = ref("");
const isSearching = computed(() => search.value.trim().length > 0);
const searchInput = ref<HTMLInputElement | null>(null);
const sentinel = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;
const displayThreadTitle = (thread: Parameters<typeof titleOfThread>[0]) =>
  titleOfThread(thread, $i18n.t.value.pages.untitled);
const filtered = computed(() => {
  const query = search.value.toLowerCase();
  return threads.threads.filter((thread) =>
    displayThreadTitle(thread).toLowerCase().includes(query),
  );
});

function updatedTime(value: string | null | undefined) {
  return formatThreadUpdatedTime(value, $i18n.locale.value);
}

onMounted(() => {
  /*
    `autofocus` 属性只在**首次解析文档**时生效；从别的路由走过来时浏览器不会理它。
    React 用的是 `autoFocus` prop，两种进入方式都会聚焦——挂载后显式 focus 一次，
    才是同一个行为。
  */
  searchInput.value?.focus();
  void threads.loadInitial();
  observer = new IntersectionObserver(
    (entries) => {
      if (!isSearching.value && entries.some((entry) => entry.isIntersecting)) {
        void threads.loadMore();
      }
    },
    { rootMargin: "200px 0px 200px 0px" },
  );
  if (sentinel.value) observer.observe(sentinel.value);
});
watch(sentinel, (element, previous) => {
  if (previous) observer?.unobserve(previous);
  if (element) observer?.observe(element);
});
onUnmounted(() => observer?.disconnect());
</script>

<template>
  <WorkspaceContainer>
    <div class="flex size-full flex-col">
      <header class="flex shrink-0 items-center justify-center pt-8">
        <input
          ref="searchInput"
          v-model="search"
          type="search"
          data-slot="input"
          autofocus
          :placeholder="$i18n.t.value.chats.searchChats"
          class="placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 h-12 w-full max-w-[var(--container-width-md)] min-w-0 rounded-md border bg-transparent px-3 py-1 text-xl shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px]"
        />
      </header>
      <main class="min-h-0 flex-1">
        <ScrollArea class="size-full py-4">
          <div
            class="mx-auto flex size-full max-w-[var(--container-width-md)] flex-col"
          >
            <VirtualThreadList
              :estimate-size="76"
              :items="filtered"
              scroll-parent-selector='[data-slot="scroll-area-viewport"]'
            >
              <template #default="{ thread }">
                <NuxtLink :to="pathOfThread(thread)">
                  <div class="flex flex-col gap-2 border-b p-4">
                    <div class="flex min-w-0 items-center gap-2">
                      <ThreadChannelIcon
                        :source="channelSourceOfThread(thread)"
                      />
                      <div class="min-w-0 flex-1 truncate">
                        {{ displayThreadTitle(thread) }}
                      </div>
                      <ThreadChannelBadge
                        :source="channelSourceOfThread(thread)"
                        class="hidden sm:inline-flex"
                      />
                    </div>
                    <div
                      v-if="thread.updated_at"
                      class="text-muted-foreground text-sm"
                    >
                      {{ updatedTime(thread.updated_at) }}
                    </div>
                  </div>
                </NuxtLink>
              </template>
            </VirtualThreadList>
            <div
              v-if="threads.hasMore && !isSearching"
              ref="sentinel"
              aria-hidden="true"
              data-testid="chats-page-sentinel"
              class="h-px w-full"
            />
            <div
              v-if="threads.hasMore && isSearching"
              class="flex justify-center p-4"
            >
              <!--
                上游 `app/workspace/chats/page.tsx:135` 是
                `<Button variant="outline">`。手写那版把 outline 变体抄了一半：
                少 `cursor-pointer`（Tailwind 4 的 preflight 不给按钮小手，
                上游每个变体都显式写了）、少 `focus-visible` 的 3px 软环，
                还把 `bg-background` 写成 `bg-transparent`、`border` 写成
                `border-input`，于是深色主题下上游那三条
                （`dark:bg-input/30 dark:border-input dark:hover:bg-input/50`）
                一条都没有——深色下这颗键是透明的，上游是浅一档的填色。
              -->
              <Button
                variant="outline"
                data-testid="chats-page-load-more"
                :disabled="threads.loadingMore"
                @click="threads.loadMore()"
              >
                {{
                  threads.loadingMore
                    ? $i18n.t.value.chats.loadingMore
                    : $i18n.t.value.chats.loadMoreToSearch
                }}
              </Button>
            </div>
          </div>
        </ScrollArea>
      </main>
    </div>
  </WorkspaceContainer>
</template>
