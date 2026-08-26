<script setup lang="ts">
/*
  【文件职责】     路由切换时向辅助技术播报新页面名。
  【架构位置】     L3 application shell
  【主要导出】     默认 RouteAnnouncer 组件
  【依赖关系】     vue-router
  【边界与注意】   对齐 Next.js 注入的 `<next-route-announcer>`：React 每条路由上
                   都有它，Vue 一条都没有，于是读屏用户在 React 上换页会听到页面名、
                   在 Vue 上什么都听不到。这是 make dom-parity 报出的 `- alert`。

                   **不复制 Next 的 custom element 与 shadow DOM。** 那是框架内部
                   结构；ARCHITECTURE 的判据是可观察行为，可访问性树里能观察到的
                   就是一个 role=alert 的实时区域。

                   **已知差异（窄屏、模态面板打开时）：** React 这个播报器会从可访问性树里
                   消失，Vue 的还在。根因量清楚了，两边都不是产品决定：Radix 的 hideOthers
                   把 `<body>` 的直接子节点逐个标 aria-hidden，而 Next 的播报器正是 body 的
                   子节点、且实时区域藏在 shadow root 里（宿主本身没有 aria-live，所以不被
                   「实时区域豁免」放过）；Reka 的 hideOthers 只从对话框往上走到 workspace
                   外壳那层就停了，够不到播报器。实测把 aria-live 挪进内层、再把整块
                   Teleport 到 body，都不能让 Reka 藏住它——它根本不在那条行走路径上。
                   影响：模态打开期间的路由播报，React 静音、Vue 不静音；而模态开着时
                   本来就不会换路由。留在 baseline/parity-diff.json 里，
                   见 artifact-preview/mobile 的那一条 `- alert`。

                   播报名的取法与 Next 一致：`document.title` → `h1` 文本 → pathname，
                   且**只有名字变了才播报**。少了这个判断，同名页面之间跳转会让读屏
                   重复念同一句话。实测本仓当前每条路由的 title 都是 "DeerFlow"，
                   所以它现在什么都不播——React 也一样，等 blog/docs 落地才会有区别。

                   首次加载不播报：页面本来就会被读一遍，再播一次是重复。
*/
import { nextTick, onMounted, ref, watch } from "vue";

const announcement = ref("");
const previousName = ref<string | null>(null);
const route = useRoute();

function currentPageName(): string {
  if (typeof document === "undefined") return "";
  const title = document.title.trim();
  if (title) return title;
  const heading = document.querySelector("h1")?.textContent?.trim();
  if (heading) return heading;
  return globalThis.location?.pathname ?? "";
}

onMounted(() => {
  previousName.value = currentPageName();
});

watch(
  () => route.fullPath,
  async () => {
    // 等这一帧渲染完，标题与 h1 才是新页面的。
    await nextTick();
    const name = currentPageName();
    if (!name || name === previousName.value) return;
    previousName.value = name;
    announcement.value = name;
  },
);
</script>

<template>
  <div
    id="__route-announcer__"
    role="alert"
    aria-live="assertive"
    style="
      position: absolute;
      border: 0;
      height: 1px;
      margin: -1px;
      padding: 0;
      width: 1px;
      clip: rect(0, 0, 0, 0);
      overflow: hidden;
      white-space: nowrap;
      overflow-wrap: normal;
    "
  >
    {{ announcement }}
  </div>
</template>
