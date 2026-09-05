<!--
  【文件职责】     DropdownMenu 子菜单内容层。
  【架构位置】     L2
  【主要导出】     DropdownMenuSubContent 组件
  【依赖关系】     Reka DropdownMenuSubContent/Portal · cn
  【边界与注意】   与 DropdownMenuContent 同样 portal 到 body，所以同样要
                   `inheritAttrs: false` 并把 `$attrs` 绑到内容元素上——否则调用方的
                   data-testid 会落在不渲染 DOM 的 Portal 上，静默消失。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import {
  DropdownMenuPortal,
  DropdownMenuSubContent,
  useForwardProps,
  type DropdownMenuSubContentProps,
} from "reka-ui";

import { cn } from "@/lib/utils";

defineOptions({ inheritAttrs: false });

const props = defineProps<
  DropdownMenuSubContentProps & { class?: HTMLAttributes["class"] }
>();

const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const { class: _class, ...rest } = forwarded.value;
  void _class;
  return rest;
});
</script>

<template>
  <DropdownMenuPortal>
    <DropdownMenuSubContent
      data-slot="dropdown-menu-sub-content"
      v-bind="{ ...$attrs, ...delegated }"
      :class="
        cn(
          'bg-popover text-popover-foreground border-border data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-80 min-w-32 origin-(--reka-dropdown-menu-content-transform-origin) overflow-hidden rounded-md border p-1 text-sm shadow-lg',
          props.class,
        )
      "
    >
      <slot />
    </DropdownMenuSubContent>
  </DropdownMenuPortal>
</template>
