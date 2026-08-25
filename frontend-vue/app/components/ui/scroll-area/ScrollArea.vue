<!--
  【文件职责】     可滚动区域：统一滚动条外观，但保留原生滚动与键盘行为。
  【架构位置】     L2
  【主要导出】     ScrollArea 组件
  【依赖关系】     Reka ScrollAreaRoot/Viewport/Scrollbar/Thumb/Corner · cn
  【边界与注意】   viewport 保持 tabindex 可聚焦：只用滚轮不用键盘的滚动区域，
                   纯键盘用户根本到不了。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import {
  ScrollAreaCorner,
  ScrollAreaRoot,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
  type ScrollAreaRootProps,
  useForwardProps,
} from "reka-ui";

import { cn } from "@/lib/utils";

const props = withDefaults(
  defineProps<
    ScrollAreaRootProps & {
      class?: HTMLAttributes["class"];
      viewportClass?: HTMLAttributes["class"];
      orientation?: "vertical" | "horizontal" | "both";
    }
  >(),
  {
    type: "hover",
    orientation: "vertical",
    class: undefined,
    viewportClass: undefined,
  },
);

const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const {
    class: _class,
    viewportClass: _viewportClass,
    orientation: _orientation,
    ...rest
  } = forwarded.value;
  void _class;
  void _viewportClass;
  void _orientation;
  return rest;
});
const scrollbarClass =
  "flex touch-none p-0.5 transition-colors select-none data-[orientation=horizontal]:h-2 data-[orientation=horizontal]:flex-col data-[orientation=vertical]:w-2";
</script>

<template>
  <ScrollAreaRoot
    data-slot="scroll-area"
    v-bind="delegated"
    :class="cn('relative overflow-hidden', props.class)"
  >
    <ScrollAreaViewport
      data-slot="scroll-area-viewport"
      :class="
        cn('size-full rounded-[inherit] outline-none', props.viewportClass)
      "
    >
      <slot />
    </ScrollAreaViewport>
    <ScrollAreaScrollbar
      v-if="props.orientation !== 'horizontal'"
      data-slot="scroll-area-scrollbar"
      orientation="vertical"
      :class="scrollbarClass"
    >
      <ScrollAreaThumb class="bg-border relative flex-1 rounded-full" />
    </ScrollAreaScrollbar>
    <ScrollAreaScrollbar
      v-if="props.orientation !== 'vertical'"
      data-slot="scroll-area-scrollbar"
      orientation="horizontal"
      :class="scrollbarClass"
    >
      <ScrollAreaThumb class="bg-border relative flex-1 rounded-full" />
    </ScrollAreaScrollbar>
    <ScrollAreaCorner />
  </ScrollAreaRoot>
</template>
