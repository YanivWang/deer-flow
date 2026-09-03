<!--
  【文件职责】     mermaid 图的全屏查看（上游 streamdown 的 `MermaidFullscreenButton`）。
  【架构位置】     L2 —— 通用渲染层组件
  【主要导出】     默认组件
  【依赖关系】     ./MarkdownIcon.vue · ./MermaidChart.vue · @/core/markdown/rendering-context
  【边界与注意】   ① **不是 shadcn 的 Dialog。** 上游是一个 `createPortal` 到 body 的
                   裸遮罩，带 `role="button"` + `tabIndex=0`（点它任意处关闭），
                   没有 dialog 语义、没有焦点陷阱、没有 aria-modal。换成 Dialog
                   会多出 dialog/title/description 三层节点与一层 portal 容器，
                   两边的可访问性树对不上。这是**照抄上游**而不是本仓的偏好。

                   **「上游哪天改成真正的 dialog，这里跟着改」这句话原来在这里，
                   wave 42 删掉了——它会把人引去 `frontend/src` 找一个不在那里的东西。**
                   这里的「上游」是第三方 npm 包 `@streamdown/mermaid`，**不在 fork
                   边界内**：两边同改那条规矩的对象是 `frontend/`，而这块代码在
                   `node_modules` 里，两个应用引的是同一个包。所以它与 `/auth/callback`
                   同一档——**能改的只有本仓一侧，改了就是纯粹制造差异，对齐价值为零**。
                   要动它得先换包或提上游 issue，那不是一轮平替能装下的事。

                   ② 遮罩层同时听 click 与 Escape 关闭；内容层 `role="presentation"`
                   并把 click / keydown 挡住，否则点图上任何一处都会关掉全屏——
                   而全屏的用途正是在图上拖拽和缩放。

                   ③ 打开期间锁 `document.body` 的滚动，且是**引用计数**的：
                   直接置空还原会在两层遮罩嵌套时把外层的锁一起解掉。计数放在模块级
                   （上游同样是模块级 `ke`），组件卸载时也要还原，否则一次异常关闭
                   会让整页永久不能滚。
-->

<script lang="ts">
import { computed, inject, onBeforeUnmount, ref, watch } from "vue";

import { markdownStreamingKey } from "@/core/markdown/rendering-context";

import MarkdownIcon from "./MarkdownIcon.vue";
import MermaidChart from "./MermaidChart.vue";

/** 见文件头 ③：模块级引用计数，与上游 `ke` 同义。 */
const scrollLock = { depth: 0 };

function lockBodyScroll() {
  scrollLock.depth += 1;
  if (scrollLock.depth === 1) document.body.style.overflow = "hidden";
}

function unlockBodyScroll() {
  scrollLock.depth = Math.max(0, scrollLock.depth - 1);
  if (scrollLock.depth === 0) document.body.style.overflow = "";
}
</script>

<script setup lang="ts">
/* ⚠️ import 全部写在上面那个普通 `<script>` 块里：两个块会被合成同一个模块，
   `import/first` 看的是合并后的顺序，setup 块里的 import 会排在模块级
   `scrollLock` 之后而报错。模块级绑定在 setup 里可以直接用。 */
const props = defineProps<{ svg: string }>();

const open = ref(false);
const streaming = inject(
  markdownStreamingKey,
  computed(() => false),
);

function onDocumentKeyDown(event: KeyboardEvent) {
  if (event.key === "Escape") open.value = false;
}

watch(open, (active, _previous, onCleanup) => {
  if (!active) return;
  lockBodyScroll();
  document.addEventListener("keydown", onDocumentKeyDown);
  onCleanup(() => {
    document.removeEventListener("keydown", onDocumentKeyDown);
    unlockBodyScroll();
  });
});

onBeforeUnmount(() => {
  if (!open.value) return;
  document.removeEventListener("keydown", onDocumentKeyDown);
  unlockBodyScroll();
});
</script>

<template>
  <button
    class="text-muted-foreground hover:text-foreground cursor-pointer p-1 transition-all disabled:cursor-not-allowed disabled:opacity-50"
    :disabled="streaming"
    :title="$i18n.t.value.markdown.viewFullscreen"
    type="button"
    @click="open = !open"
  >
    <MarkdownIcon name="Maximize2Icon" :size="14" />
  </button>
  <Teleport v-if="open" to="body">
    <div
      class="bg-background/95 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
      role="button"
      :tabindex="0"
      @click="open = false"
      @keydown.escape="open = false"
    >
      <button
        class="text-muted-foreground hover:bg-muted hover:text-foreground absolute top-4 right-4 z-10 rounded-md p-2 transition-all"
        :title="$i18n.t.value.markdown.exitFullscreen"
        type="button"
        @click="open = false"
      >
        <MarkdownIcon name="XIcon" :size="20" />
      </button>
      <!-- 见文件头 ②。 -->
      <div
        class="flex size-full items-center justify-center p-4"
        role="presentation"
        @click.stop
        @keydown.stop
      >
        <MermaidChart
          class="size-full [&_svg]:h-auto [&_svg]:w-auto"
          fullscreen
          :svg="props.svg"
        />
      </div>
    </div>
  </Teleport>
</template>
