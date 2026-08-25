<!--
  【文件职责】     Command 的搜索输入：输入时方向键仍然驱动列表高亮。
  【架构位置】     L2
  【主要导出】     CommandInput 组件
  【依赖关系】     Reka ListboxFilter · cn
  【边界与注意】   焦点留在 input 上，选中项通过 aria-activedescendant 宣告——
                   所以调用方不要再把焦点搬到列表项上。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import {
  ListboxFilter,
  type ListboxFilterProps,
  useForwardProps,
} from "reka-ui";
import { Search } from "lucide-vue-next";

import { cn } from "@/lib/utils";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<
    ListboxFilterProps & {
      class?: HTMLAttributes["class"];
      wrapperClass?: HTMLAttributes["class"];
    }
  >(),
  {
    autoFocus: true,
    class: undefined,
    wrapperClass: undefined,
  },
);
const emits = defineEmits<{ "update:modelValue": [value: string] }>();

const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const {
    class: _class,
    wrapperClass: _wrapperClass,
    ...rest
  } = forwarded.value;
  void _class;
  void _wrapperClass;
  return rest;
});
</script>

<template>
  <div
    data-slot="command-input-wrapper"
    :class="
      cn(
        'border-border flex items-center gap-2 border-b px-3',
        props.wrapperClass,
      )
    "
  >
    <Search
      :size="16"
      class="text-muted-foreground shrink-0"
      aria-hidden="true"
    />
    <ListboxFilter
      data-slot="command-input"
      v-bind="{ ...delegated, ...$attrs }"
      :class="
        cn(
          'h-12 min-w-0 flex-1 bg-transparent text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50',
          props.class,
        )
      "
      @update:model-value="emits('update:modelValue', $event)"
    />
  </div>
</template>
