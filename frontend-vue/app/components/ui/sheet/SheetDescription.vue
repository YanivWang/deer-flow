<!--
  【文件职责】     Sheet 可访问描述。
  【架构位置】     L2
  【主要导出】     SheetDescription 组件
  【依赖关系】     Reka DialogDescription · cn
  【边界与注意】   视觉不需要时用 sr-only，不要省略。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import {
  DialogDescription,
  type DialogDescriptionProps,
  useForwardProps,
} from "reka-ui";

import { cn } from "@/lib/utils";

const props = defineProps<
  DialogDescriptionProps & { class?: HTMLAttributes["class"] }
>();
const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const { class: _class, ...rest } = forwarded.value;
  void _class;
  return rest;
});
</script>

<template>
  <DialogDescription
    data-slot="sheet-description"
    v-bind="delegated"
    :class="cn('text-muted-foreground text-sm', props.class)"
  >
    <slot />
  </DialogDescription>
</template>
