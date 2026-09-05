<!--
  【文件职责】     Command 的 listbox 容器。
  【架构位置】     L2
  【主要导出】     CommandList 组件
  【依赖关系】     Reka ListboxContent · cn
  【边界与注意】   可访问名字由调用方通过 aria-label 提供。

                   class 串照上游 `ui/command.tsx:102`。本仓原来多了 `p-2`
                   （每项左右各缩 8px、上下各多 8px——台账上模型选择器那几行
                   `option x Δ8` / `width Δ-16` 与 `dialog height` 里的 16px
                   就是它）与一条无处生效的 `outline-none`，`max-h` 也差 20px，
                   还少了 `scroll-py-1`（键盘上下键滚动时给高亮项留的余量）。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import {
  ListboxContent,
  type ListboxContentProps,
  useForwardProps,
} from "reka-ui";

import { cn } from "@/lib/utils";

const props = defineProps<
  ListboxContentProps & { class?: HTMLAttributes["class"] }
>();
const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const { class: _class, ...rest } = forwarded.value;
  void _class;
  return rest;
});
</script>

<template>
  <ListboxContent
    data-slot="command-list"
    v-bind="delegated"
    :class="
      cn(
        'max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto',
        props.class,
      )
    "
  >
    <slot />
  </ListboxContent>
</template>
