<script setup lang="ts">
/*
  【文件职责】     工作区列表页的外壳：面包屑头部 + 居中的主体。
  【架构位置】     L3 application shell
  【主要导出】     默认 WorkspaceContainer 组件
  【依赖关系】     ui/tooltip · vue-router · i18n
  【边界与注意】   对照的是 React 的 WorkspaceContainer / WorkspaceHeader / WorkspaceBody
                   三件套（frontend/src/components/workspace/workspace-container.tsx）。
                   React 把它们拆成三个组件是因为 JSX 里要用 children 往头部塞第三级
                   面包屑；Vue 用具名 slot 表达同一件事，一个组件就够。

                   **只有列表页用这层壳。** 会话页走的是 chat-page.tsx 自己的头部，
                   那里没有面包屑——把这层套到会话页上，读屏器会在每个对话里都先念
                   一遍「导航，面包屑，工作区，对话」。

                   面包屑从路径的前两段推出来，与 React 的
                   `pathname.split("/").slice(1, 3)` 同一份规则；两段都在时**两段都是
                   链接**（React 的 `segments.length >= 2` 分支），当前页不退化成
                   BreadcrumbPage。

                   GitHub 那个链接刻意**没有可访问名**：React 给它的全部内容是一个
                   aria-hidden 的 svg 加一个 hover tooltip，可访问性树上就是一个匿名
                   link。补一个 aria-label 听起来更好，但那样两个应用念出来的不一样。
*/
import { ChevronRight } from "lucide-vue-next";
import { computed } from "vue";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const route = useRoute();
const { $i18n } = useNuxtApp();

const segments = computed(() => route.path.split("/").slice(1, 3));

function nameOfSegment(segment: string | undefined) {
  if (!segment) return $i18n.t.value.common.home;
  if (segment === "workspace") return $i18n.t.value.breadcrumb.workspace;
  if (segment === "chats") return $i18n.t.value.breadcrumb.chats;
  return segment[0]!.toUpperCase() + segment.slice(1);
}

function toggleSidebar() {
  globalThis.dispatchEvent(new CustomEvent("deerflow:toggle-sidebar"));
}
</script>

<template>
  <div class="flex h-screen w-full flex-col">
    <header
      class="top-0 right-0 left-0 z-20 flex h-16 shrink-0 items-center justify-between gap-2 border-b backdrop-blur-sm transition-[width,height] ease-out"
    >
      <div class="flex min-w-0 items-center gap-2 px-2 sm:px-4">
        <button
          type="button"
          data-sidebar="trigger"
          class="hover:bg-sidebar-accent size-8 items-center justify-center rounded-md md:hidden"
          :aria-label="$i18n.t.value.primitives.toggleSidebar"
          @click="toggleSidebar"
        >
          <ChevronRight :size="16" />
        </button>
        <nav :aria-label="$i18n.t.value.primitives.breadcrumb">
          <ol
            class="text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm break-words sm:gap-2.5"
          >
            <li v-if="segments[0]" class="hidden items-center gap-1.5 md:block">
              <NuxtLink
                :to="`/${segments[0]}`"
                class="hover:text-foreground transition-colors"
                >{{ nameOfSegment(segments[0]) }}</NuxtLink
              >
            </li>
            <template v-if="segments[1]">
              <li
                role="presentation"
                aria-hidden="true"
                class="hidden md:block [&>svg]:size-3.5"
              >
                <ChevronRight />
              </li>
              <li class="inline-flex items-center gap-1.5">
                <NuxtLink
                  :to="`/${segments[0]}/${segments[1]}`"
                  class="hover:text-foreground transition-colors"
                  >{{ nameOfSegment(segments[1]) }}</NuxtLink
                >
              </li>
            </template>
            <template v-if="$slots.breadcrumb">
              <li
                role="presentation"
                aria-hidden="true"
                class="[&>svg]:size-3.5"
              >
                <ChevronRight />
              </li>
              <slot name="breadcrumb" />
            </template>
          </ol>
        </nav>
      </div>
      <div class="pr-4">
        <Tooltip :delay-duration="500">
          <TooltipTrigger>
            <a
              href="https://github.com/bytedance/deer-flow"
              target="_blank"
              rel="noopener noreferrer"
              class="opacity-75 transition hover:opacity-100"
            >
              <svg
                height="32"
                width="32"
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="currentColor"
                class="size-6"
              >
                <path
                  d="M12 1C5.923 1 1 5.923 1 12c0 4.867 3.149 8.979 7.521 10.436.55.096.756-.233.756-.522 0-.262-.013-1.128-.013-2.049-2.764.509-3.479-.674-3.699-1.292-.124-.317-.66-1.293-1.127-1.554-.385-.207-.936-.715-.014-.729.866-.014 1.485.797 1.691 1.128.99 1.663 2.571 1.196 3.204.907.096-.715.385-1.196.701-1.471-2.448-.275-5.005-1.224-5.005-5.432 0-1.196.426-2.186 1.128-2.956-.111-.275-.496-1.402.11-2.915 0 0 .921-.288 3.024 1.128a10.193 10.193 0 0 1 2.75-.371c.936 0 1.871.123 2.75.371 2.104-1.43 3.025-1.128 3.025-1.128.605 1.513.221 2.64.111 2.915.701.77 1.127 1.747 1.127 2.956 0 4.222-2.571 5.157-5.019 5.432.399.344.743 1.004.743 2.035 0 1.471-.014 2.654-.014 3.025 0 .289.206.632.756.522C19.851 20.979 23 16.854 23 12c0-6.077-4.922-11-11-11Z"
                />
              </svg>
            </a>
          </TooltipTrigger>
          <TooltipContent>{{
            $i18n.t.value.workspace.githubTooltip
          }}</TooltipContent>
        </Tooltip>
      </div>
    </header>
    <main class="relative flex min-h-0 w-full flex-1 flex-col items-center">
      <div class="flex h-full w-full flex-col items-center">
        <slot />
      </div>
    </main>
  </div>
</template>
