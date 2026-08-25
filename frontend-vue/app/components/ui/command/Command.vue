<!--
  【文件职责】     Command 根：搜索 + 列表的命令面板容器。
  【架构位置】     L2
  【主要导出】     Command 组件
  【依赖关系】     Reka ListboxRoot · cn
  【边界与注意】   建在 Listbox 而不是 Combobox 上：命令面板是**内联**列表，
                   不需要 portal、定位或 dismissable layer。多一层 dismissable
                   会先吃掉 Escape，外层 Dialog 就关不掉了。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import {
  ListboxRoot,
  type ListboxRootEmits,
  type ListboxRootProps,
  useForwardProps,
} from "reka-ui";

import { cn } from "@/lib/utils";

const props = withDefaults(
  defineProps<ListboxRootProps & { class?: HTMLAttributes["class"] }>(),
  {
    highlightOnHover: true,
    selectionBehavior: "replace",
    class: undefined,
  },
);
const emits = defineEmits<ListboxRootEmits>();

const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const { class: _class, ...rest } = forwarded.value;
  void _class;
  return rest;
});
</script>

<template>
  <ListboxRoot
    data-slot="command"
    v-bind="delegated"
    :class="cn('flex w-full flex-col overflow-hidden', props.class)"
    @update:model-value="emits('update:modelValue', $event)"
    @highlight="emits('highlight', $event)"
    @entry-focus="emits('entryFocus', $event)"
    @leave="emits('leave', $event)"
  >
    <slot />
  </ListboxRoot>
</template>
