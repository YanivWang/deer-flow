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
