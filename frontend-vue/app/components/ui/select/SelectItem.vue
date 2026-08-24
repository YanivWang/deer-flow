<!--
  【文件职责】     Select 单个选项。
  【架构位置】     L2
  【主要导出】     SelectItem 组件
  【依赖关系】     Reka SelectItem/ItemText/ItemIndicator · cn
  【边界与注意】   选项文本必须放进 SelectItemText，否则触发器读不到当前值。
                   字符串 value 会镜像到 data-value：原生 `<option value>` 暴露过这条
                   信息，换成自定义 listbox 后如果不补上，"选中值为 X 的那一项" 就只能
                   靠可见文案去猜，而可见文案是会被翻译的。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import {
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  type SelectItemProps,
  useForwardProps,
} from "reka-ui";
import { Check } from "lucide-vue-next";

import { cn } from "@/lib/utils";

const props = defineProps<
  SelectItemProps & { class?: HTMLAttributes["class"] }
>();
const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const { class: _class, ...rest } = forwarded.value;
  void _class;
  return rest;
});
</script>

<template>
  <SelectItem
    data-slot="select-item"
    :data-value="typeof props.value === 'string' ? props.value : undefined"
    v-bind="delegated"
    :class="
      cn(
        'hover:bg-accent focus:bg-accent relative flex w-full cursor-default items-center rounded py-1.5 pr-2 pl-7 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        props.class,
      )
    "
  >
    <span
      class="pointer-events-none absolute left-1.5 flex size-4 items-center justify-center"
    >
      <SelectItemIndicator>
        <Check :size="14" aria-hidden="true" />
      </SelectItemIndicator>
    </span>
    <SelectItemText><slot /></SelectItemText>
  </SelectItem>
</template>
